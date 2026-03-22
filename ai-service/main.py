"""
AgenticMeadows AI Service
FastAPI application with ReAct agent engine + Qwen 3.5 via Ollama.
Optional NVIDIA Nemotron cloud inference with local Ollama fallback.

Architecture:
- POST /ai/chat       — Process user message via ReAct agent, return reply + optional pending_action
- POST /ai/confirm-action — Execute a pending_action after user confirmation
- POST /ai/confirm-batch  — Execute multiple pending actions in batch
- GET  /health        — Health check

Security:
  This service runs inside a NemoClaw OpenShell sandbox that restricts
  network access to ONLY the backend API, Ollama, and optionally NVIDIA cloud.
  All write operations use the PendingAction pattern (AI proposes, user confirms).
  Safety rails are integrated into the ReAct system prompt.

Inference routing:
  - If NVIDIA_API_KEY is set: try Nemotron cloud first, fallback to local Ollama
  - If not set: use Ollama directly with Qwen 3.5 (zero-config)
"""

import asyncio
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from react_engine import ReActEngine
from tools.quote_tools import execute_create_quote
from tools.job_tools import execute_create_job, execute_reschedule_job
from tools.invoice_tools import execute_create_invoice
from tools.chemical_tools import execute_log_chemical
from tools.recurring_tools import execute_create_recurring
from tools.update_tools import (
    execute_update_client, execute_update_job, execute_mark_complete,
    execute_add_line_item, execute_remove_line_item,
)
from tools.audit_tools import log_audit_event

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────
PHOTOS_DIR = os.getenv("PHOTOS_DIR", "/app/photos")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")
MODEL_FILE = Path(PHOTOS_DIR) / "current_model.txt"
NEMOCLAW_SANDBOX_ACTIVE = os.getenv("NEMOCLAW_SANDBOX_ACTIVE", "false") == "true"

# ── NVIDIA API key loading ────────────────────────────────────────────────
# Priority: 1) env var  2) settings.json on shared volume (saved via Settings UI)
import json as _json


def _load_nvidia_key() -> str:
    """Load NVIDIA API key from env var or settings file."""
    key = os.getenv("NVIDIA_API_KEY", "")
    if key:
        return key
    settings_file = Path(PHOTOS_DIR) / "settings.json"
    try:
        if settings_file.exists():
            data = _json.loads(settings_file.read_text())
            key = data.get("nvidia_api_key", "")
            if key:
                log.info("Loaded NVIDIA API key from settings.json")
                return key
    except Exception:
        pass
    return ""


def _get_nvidia_key() -> str:
    """Get NVIDIA API key, checking settings file each time (allows hot-reload from Settings UI)."""
    key = os.getenv("NVIDIA_API_KEY", "")
    if key:
        return key
    settings_file = Path(PHOTOS_DIR) / "settings.json"
    try:
        if settings_file.exists():
            data = _json.loads(settings_file.read_text())
            return data.get("nvidia_api_key", "")
    except Exception:
        pass
    return ""


# Initial load for startup logging
NVIDIA_API_KEY = _load_nvidia_key()
NEMOCLAW_INFERENCE_MODE = "cloud_with_fallback" if NVIDIA_API_KEY else os.getenv("NEMOCLAW_INFERENCE_MODE", "local_only")

# ── In-memory pending action store ─────────────────────────────────────────
# Keyed by conversation_id. In production, replace with Redis.
pending_actions: dict[str, dict] = {}

# ── Model detection ────────────────────────────────────────────────────────


def get_model_name(retries: int = 30, delay: float = 2.0) -> str:
    """
    Read the Ollama model name from the shared volume file.
    Retries for up to (retries * delay) seconds to allow ollama-init to complete.
    """
    for attempt in range(retries):
        if MODEL_FILE.exists():
            model = MODEL_FILE.read_text().strip()
            if model:
                log.info(f"Using Ollama model: {model}")
                return model
        if attempt < retries - 1:
            log.info(f"Waiting for model file ({attempt + 1}/{retries})...")
            time.sleep(delay)
    log.warning(f"Model file not found after {retries} attempts, defaulting to qwen3.5:0.8b")
    return "qwen3.5:0.8b"


# ── NVIDIA Cloud Inference ─────────────────────────────────────────────────

async def call_nvidia_cloud(messages: list[dict], max_tokens: int = 1024) -> str | None:
    """
    Call NVIDIA Nemotron cloud API (OpenAI-compatible endpoint).
    Returns the response text, or None if unavailable/failed.
    """
    api_key = _get_nvidia_key()
    if not api_key:
        return None

    import httpx
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "nvidia/nemotron-3-super-120b-a12b",
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": 0.7,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        log.warning(f"NVIDIA cloud inference failed: {e}")
        return None


async def call_ollama(messages: list[dict], max_tokens: int = 1024) -> str:
    """
    Call local Ollama with Qwen 3.5.
    """
    import httpx
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": _model_name,
                "messages": messages,
                "stream": False,
                "think": False,
                "options": {"num_predict": max_tokens},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        msg = data.get("message", {})
        content = msg.get("content", "")
        if not content and msg.get("thinking"):
            thinking = msg["thinking"].strip()
            paragraphs = [p.strip() for p in thinking.split("\n\n") if p.strip()]
            content = paragraphs[-1] if paragraphs else thinking[-500:]
        return content


async def generate_response(messages: list[dict], max_tokens: int = 1024) -> tuple[str, str]:
    """
    Route inference based on NemoClaw configuration.
    Cloud first with local fallback, or local only.
    Re-checks settings.json each call so key changes take effect without restart.

    Returns (reply_text, inference_mode_used) where inference_mode_used is one of:
    "nvidia_cloud", "ollama_fallback", or "ollama_local".
    """
    global NVIDIA_API_KEY, NEMOCLAW_INFERENCE_MODE
    current_key = _load_nvidia_key()
    if current_key != NVIDIA_API_KEY:
        NVIDIA_API_KEY = current_key
        NEMOCLAW_INFERENCE_MODE = "cloud_with_fallback" if NVIDIA_API_KEY else "local_only"
        log.info(f"NVIDIA API key {'loaded' if NVIDIA_API_KEY else 'cleared'}, inference: {NEMOCLAW_INFERENCE_MODE}")

    if NEMOCLAW_INFERENCE_MODE == "cloud_with_fallback" and NVIDIA_API_KEY:
        cloud_reply = await call_nvidia_cloud(messages, max_tokens)
        if cloud_reply:
            return cloud_reply, "nvidia_cloud"
        log.info("Cloud inference unavailable, falling back to local Ollama")
        reply = await call_ollama(messages, max_tokens)
        return reply, "ollama_fallback"

    reply = await call_ollama(messages, max_tokens)
    return reply, "ollama_local"


# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="AgenticMeadows AI Service",
    description="ReAct agent for landscaping field service intelligence",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state — initialized on startup
_model_name = "qwen3.5:9b"


@app.on_event("startup")
async def startup():
    global _model_name
    _model_name = get_model_name()
    log.info(f"AgenticMeadows AI Service started")
    log.info(f"  Model: {_model_name}")
    log.info(f"  Inference: {NEMOCLAW_INFERENCE_MODE}")
    log.info(f"  NemoClaw sandbox: {'active' if NEMOCLAW_SANDBOX_ACTIVE else 'inactive'}")
    log.info(f"  ReAct engine: enabled")
    if NVIDIA_API_KEY:
        log.info(f"  NVIDIA cloud: enabled (Nemotron)")
    else:
        log.info(f"  NVIDIA cloud: disabled (no API key)")


# ── Request/Response Models ──────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    image_url: Optional[str] = None
    # Auth token forwarded from frontend so tools can call the backend on behalf of user
    auth_token: Optional[str] = None
    # Client context injected by the frontend (e.g., current job's clientId)
    client_id: Optional[str] = None
    job_id: Optional[str] = None
    property_id: Optional[str] = None
    zip_code: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    pending_action: Optional[dict] = None
    entities: Optional[list[dict]] = None
    batch_actions: Optional[list[dict]] = None


class ConfirmRequest(BaseModel):
    conversation_id: str
    auth_token: Optional[str] = None


# ── Core routing logic (ReAct agent) ─────────────────────────────────────────

async def _process_message(req: ChatRequest, conv_id: str) -> ChatResponse:
    """Route message through the ReAct agent engine."""

    # Build the generate function that routes to NVIDIA cloud or local Ollama
    async def generate_fn(messages: list[dict]) -> str:
        reply, mode = await generate_response(messages)
        return reply

    context = {
        "client_id": req.client_id,
        "job_id": req.job_id,
        "property_id": req.property_id,
        "zip_code": req.zip_code,
    }

    engine = ReActEngine(
        generate_fn=generate_fn,
        auth_token=req.auth_token or "",
        context=context,
    )

    result = await engine.run(req.message, conv_id)

    # Store pending actions for confirmation
    if result.get("pending_action"):
        pending_actions[conv_id] = result["pending_action"]
    if result.get("batch_actions"):
        pending_actions[f"{conv_id}_batch"] = result["batch_actions"]

    # Audit logging
    if result.get("tool_calls"):
        await log_audit_event(
            session_id=conv_id,
            event_type="AGENT_REASONING",
            summary=f"ReAct loop: {result['iterations']} iterations, {len(result['tool_calls'])} tool calls",
            auth_token=req.auth_token or "",
            payload={"tool_calls": result["tool_calls"], "iterations": result["iterations"]},
        )

    return ChatResponse(
        reply=result["reply"],
        conversation_id=conv_id,
        pending_action=result.get("pending_action"),
        entities=result.get("entities"),
        batch_actions=result.get("batch_actions"),
    )


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "agenticmeadows-ai",
        "model": _model_name,
        "react_engine": True,
        "nemoclaw": {
            "sandbox_active": NEMOCLAW_SANDBOX_ACTIVE,
            "inference_mode": NEMOCLAW_INFERENCE_MODE,
            "nvidia_cloud": bool(NVIDIA_API_KEY),
        },
    }


@app.post("/ai/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    conv_id = req.conversation_id or str(uuid.uuid4())
    try:
        return await _process_message(req, conv_id)
    except Exception as e:
        log.error(f"ReAct engine error: {e}")
        import traceback
        log.error(traceback.format_exc())
        return ChatResponse(
            reply="I'm having trouble processing your request. Please try again or rephrase your message.",
            conversation_id=conv_id,
        )


@app.post("/ai/confirm-action")
async def confirm_action(req: ConfirmRequest):
    action = pending_actions.pop(req.conversation_id, None)
    if not action:
        raise HTTPException(
            status_code=404,
            detail="No pending action found for this conversation. It may have already been confirmed or cancelled.",
        )

    action_type = action.get("type")

    await log_audit_event(
        session_id=req.conversation_id,
        event_type="ACTION_CONFIRMED",
        summary=f"Action confirmed: {action_type} — {action.get('description', '')}",
        auth_token=req.auth_token or "",
        action_type=action_type,
        payload=action.get("payload"),
    )

    if action_type == "CREATE_CLIENT":
        try:
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{BACKEND_URL}/api/clients",
                    json=action["payload"],
                    headers={"Authorization": f"Bearer {req.auth_token or ''}"},
                )
                resp.raise_for_status()
                result = resp.json()
            return {
                "success": True,
                "type": "CREATE_CLIENT",
                "result": result,
                "message": f"Client created successfully!",
            }
        except Exception as e:
            log.error(f"Failed to create client: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create client: {str(e)}")

    if action_type == "CREATE_QUOTE":
        try:
            result = await execute_create_quote(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "CREATE_QUOTE",
                "result": result,
                "message": f"Quote created successfully! Quote ID: {result.get('id', 'N/A')}",
            }
        except Exception as e:
            log.error(f"Failed to create quote: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create quote: {str(e)}")

    if action_type == "CREATE_JOB":
        try:
            result = await execute_create_job(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "CREATE_JOB",
                "result": result,
                "message": f"Job created successfully! Job ID: {result.get('id', 'N/A')}",
            }
        except Exception as e:
            log.error(f"Failed to create job: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create job: {str(e)}")

    if action_type == "RESCHEDULE_JOB":
        try:
            result = await execute_reschedule_job(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "RESCHEDULE_JOB",
                "result": result,
                "message": f"Job rescheduled successfully!",
            }
        except Exception as e:
            log.error(f"Failed to reschedule job: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to reschedule job: {str(e)}")

    if action_type == "CREATE_INVOICE":
        try:
            result = await execute_create_invoice(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "CREATE_INVOICE",
                "result": result,
                "message": f"Invoice created successfully! Invoice ID: {result.get('id', 'N/A')}",
            }
        except Exception as e:
            log.error(f"Failed to create invoice: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create invoice: {str(e)}")

    if action_type == "LOG_CHEMICAL":
        try:
            result = await execute_log_chemical(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "LOG_CHEMICAL",
                "result": result,
                "message": f"Chemical application logged successfully!",
            }
        except Exception as e:
            log.error(f"Failed to log chemical application: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to log chemical application: {str(e)}")

    if action_type == "CREATE_RECURRING":
        try:
            result = await execute_create_recurring(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "CREATE_RECURRING",
                "result": result,
                "message": f"Recurring template created successfully!",
            }
        except Exception as e:
            log.error(f"Failed to create recurring template: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to create recurring template: {str(e)}")

    if action_type == "UPDATE_CLIENT":
        try:
            result = await execute_update_client(
                payload=dict(action["payload"]),
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "UPDATE_CLIENT",
                "result": result,
                "message": "Client updated successfully!",
            }
        except Exception as e:
            log.error(f"Failed to update client: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update client: {str(e)}")

    if action_type == "UPDATE_JOB":
        try:
            result = await execute_update_job(
                payload=dict(action["payload"]),
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "UPDATE_JOB",
                "result": result,
                "message": "Job updated successfully!",
            }
        except Exception as e:
            log.error(f"Failed to update job: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to update job: {str(e)}")

    if action_type == "MARK_JOB_COMPLETE":
        try:
            result = await execute_mark_complete(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "MARK_JOB_COMPLETE",
                "result": result,
                "message": "Job marked as completed!",
            }
        except Exception as e:
            log.error(f"Failed to mark job complete: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to mark job complete: {str(e)}")

    if action_type == "ADD_LINE_ITEM":
        try:
            result = await execute_add_line_item(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "ADD_LINE_ITEM",
                "result": result,
                "message": "Line item added successfully!",
            }
        except Exception as e:
            log.error(f"Failed to add line item: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to add line item: {str(e)}")

    if action_type == "REMOVE_LINE_ITEM":
        try:
            result = await execute_remove_line_item(
                payload=action["payload"],
                auth_token=req.auth_token or "",
            )
            return {
                "success": True,
                "type": "REMOVE_LINE_ITEM",
                "result": result,
                "message": "Line item removed successfully!",
            }
        except Exception as e:
            log.error(f"Failed to remove line item: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to remove line item: {str(e)}")

    if action_type == "LOG_MAINTENANCE":
        try:
            import httpx
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{BACKEND_URL}/api/maintenance/equipment/{action['payload']['equipmentId']}/log",
                    json=action["payload"],
                    headers={"Authorization": f"Bearer {req.auth_token or ''}"},
                )
                resp.raise_for_status()
                result = resp.json()
            return {"success": True, "type": "LOG_MAINTENANCE", "result": result, "message": "Maintenance logged successfully!"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to log maintenance: {str(e)}")

    raise HTTPException(status_code=400, detail=f"Unknown action type: {action_type}")


@app.delete("/ai/pending-action/{conversation_id}")
async def cancel_action(conversation_id: str):
    """Cancel a pending action without executing it."""
    if conversation_id in pending_actions:
        del pending_actions[conversation_id]
    # Also clean up any batch actions for this conversation
    batch_key = f"{conversation_id}_batch"
    if batch_key in pending_actions:
        del pending_actions[batch_key]
    return {"success": True, "message": "Pending action cancelled."}


@app.post("/ai/confirm-batch")
async def confirm_batch(req: dict):
    """Execute multiple pending actions in batch (e.g., from a multi-line-item flow)."""
    conv_id = req.get("conversation_id", "")
    action_indices = req.get("action_indices")  # Optional: which actions to confirm
    auth_token = req.get("auth_token", "")

    batch = pending_actions.pop(f"{conv_id}_batch", None)
    if not batch:
        raise HTTPException(status_code=404, detail="No batch actions found for this conversation.")

    results = []
    errors = []
    for i, action in enumerate(batch):
        if action_indices is not None and i not in action_indices:
            continue
        action_type = action.get("type")
        try:
            if action_type == "UPDATE_CLIENT":
                result = await execute_update_client(dict(action["payload"]), auth_token)
            elif action_type == "UPDATE_JOB":
                result = await execute_update_job(dict(action["payload"]), auth_token)
            elif action_type == "MARK_JOB_COMPLETE":
                result = await execute_mark_complete(action["payload"], auth_token)
            elif action_type == "ADD_LINE_ITEM":
                result = await execute_add_line_item(action["payload"], auth_token)
            elif action_type == "REMOVE_LINE_ITEM":
                result = await execute_remove_line_item(action["payload"], auth_token)
            elif action_type == "CREATE_CLIENT":
                import httpx
                async with httpx.AsyncClient(timeout=15.0) as hc:
                    resp = await hc.post(f"{BACKEND_URL}/api/clients", json=action["payload"], headers={"Authorization": f"Bearer {auth_token}"})
                    resp.raise_for_status()
                    result = resp.json()
            elif action_type == "CREATE_QUOTE":
                result = await execute_create_quote(action["payload"], auth_token)
            elif action_type == "CREATE_JOB":
                result = await execute_create_job(action["payload"], auth_token)
            elif action_type == "CREATE_INVOICE":
                result = await execute_create_invoice(action["payload"], auth_token)
            elif action_type == "RESCHEDULE_JOB":
                result = await execute_reschedule_job(dict(action["payload"]), auth_token)
            elif action_type == "LOG_CHEMICAL":
                result = await execute_log_chemical(action["payload"], auth_token)
            elif action_type == "LOG_MAINTENANCE":
                import httpx
                async with httpx.AsyncClient(timeout=15.0) as hc:
                    resp = await hc.post(
                        f"{BACKEND_URL}/api/maintenance/equipment/{action['payload']['equipmentId']}/log",
                        json=action["payload"],
                        headers={"Authorization": f"Bearer {auth_token}"},
                    )
                    resp.raise_for_status()
                    result = resp.json()
            else:
                errors.append({"index": i, "error": f"Unknown action type: {action_type}"})
                continue
            results.append({"index": i, "type": action_type, "result": result})
        except Exception as e:
            log.error(f"Batch action {i} ({action_type}) failed: {e}")
            errors.append({"index": i, "type": action_type, "error": str(e)})

    await log_audit_event(
        session_id=conv_id,
        event_type="BATCH_CONFIRMED",
        summary=f"Batch confirmed: {len(results)} executed, {len(errors)} errors",
        auth_token=auth_token,
        action_type="BATCH",
        payload={"executed": len(results), "errors": len(errors), "action_types": [r["type"] for r in results]},
    )

    return {
        "success": len(errors) == 0,
        "results": results,
        "errors": errors,
        "executed": len(results),
    }


@app.post("/ai/proactive-check")
async def proactive_check(req: dict):
    """
    Run proactive checks for overdue invoices, weather alerts, and recurring
    templates that are due for job generation.  Called by the backend scheduler
    or manually from the dashboard.
    """
    from tools.weather_tools import check_schedule_weather
    from tools.agent_tools import get_dashboard_stats
    from tools.recurring_tools import generate_recurring_jobs

    auth_token = req.get("auth_token", "")
    alerts: list[str] = []

    # ── Overdue invoices ──────────────────────────────────────────────
    try:
        stats = await get_dashboard_stats(auth_token=auth_token)
        overdue = stats.get("invoices", {}).get("overdue", [])
        if overdue:
            overdue_total = stats.get("invoices", {}).get("overdueTotal", 0)
            alerts.append(
                f"You have {len(overdue)} overdue invoice(s) totaling ${overdue_total:,.2f}. "
                "Consider sending payment reminders."
            )
    except Exception as e:
        log.warning(f"Proactive check — overdue invoices failed: {e}")

    # ── Weather alerts for upcoming schedule ──────────────────────────
    try:
        from datetime import datetime, timedelta
        start = datetime.utcnow().isoformat() + "Z"
        end = (datetime.utcnow() + timedelta(days=3)).isoformat() + "Z"
        weather_data = await check_schedule_weather(start=start, end=end, auth_token=auth_token)
        weather_alerts = weather_data.get("alerts", [])
        if weather_alerts:
            high_severity = [a for a in weather_alerts if a.get("severity") == "high"]
            if high_severity:
                alerts.append(
                    f"{len(high_severity)} job(s) may need rescheduling due to severe weather in the next 3 days."
                )
            elif weather_alerts:
                alerts.append(
                    f"{len(weather_alerts)} job(s) have weather concerns in the next 3 days. Review your schedule."
                )
    except Exception as e:
        log.warning(f"Proactive check — weather alerts failed: {e}")

    # ── Recurring templates due for generation ────────────────────────
    try:
        gen_result = await generate_recurring_jobs(auth_token=auth_token)
        generated_count = gen_result.get("generatedCount", 0)
        if generated_count > 0:
            alerts.append(
                f"{generated_count} recurring job(s) were auto-generated from templates."
            )
    except Exception as e:
        log.warning(f"Proactive check — recurring generation failed: {e}")

    return {
        "alerts": alerts,
        "alert_count": len(alerts),
        "message": "No proactive alerts at this time." if not alerts else f"{len(alerts)} alert(s) found.",
    }
