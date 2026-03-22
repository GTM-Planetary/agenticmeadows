"""
AgenticMeadows Batch Tools
Decomposes multi-intent messages into individual PendingActions using LLM inference.
"""

import json
import logging
import os
import re
from datetime import datetime, timedelta

import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")

log = logging.getLogger(__name__)

# ── LLM call (same pattern as main.py generate_response) ────────────────────

def _load_nvidia_key() -> str:
    from pathlib import Path
    PHOTOS_DIR = os.getenv("PHOTOS_DIR", "/app/photos")
    key = os.getenv("NVIDIA_API_KEY", "")
    if key:
        return key
    settings_file = Path(PHOTOS_DIR) / "settings.json"
    try:
        if settings_file.exists():
            data = json.loads(settings_file.read_text())
            return data.get("nvidia_api_key", "")
    except Exception:
        pass
    return ""


def _get_model_name() -> str:
    from pathlib import Path
    PHOTOS_DIR = os.getenv("PHOTOS_DIR", "/app/photos")
    model_file = Path(PHOTOS_DIR) / "current_model.txt"
    try:
        if model_file.exists():
            model = model_file.read_text().strip()
            if model:
                return model
    except Exception:
        pass
    return "qwen3.5:0.8b"


async def _call_llm(messages: list[dict], max_tokens: int = 1024) -> str:
    """Call LLM using NVIDIA cloud (if available) with Ollama fallback."""
    nvidia_key = _load_nvidia_key()
    if nvidia_key:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    "https://integrate.api.nvidia.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {nvidia_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "nvidia/nemotron-3-super-120b-a12b",
                        "messages": messages,
                        "max_tokens": max_tokens,
                        "temperature": 0.3,
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data["choices"][0]["message"]["content"]
        except Exception as e:
            log.warning(f"NVIDIA cloud failed for batch parsing, falling back to Ollama: {e}")

    # Ollama fallback
    model = _get_model_name()
    async with httpx.AsyncClient(timeout=300.0) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": model,
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


# ── Intent-to-action mapping ────────────────────────────────────────────────

async def _resolve_intent(intent: dict, context: dict, auth_token: str) -> dict | None:
    """Convert a parsed intent into a PendingAction dict."""
    from tools.update_tools import mark_job_complete_action, add_line_item_action, update_client_action
    from tools.job_tools import create_job_action, reschedule_job_action
    from tools.quote_tools import draft_quote
    from tools.invoice_tools import create_invoice_action

    intent_type = intent.get("intent", "")
    params = intent.get("params", {})

    try:
        if intent_type == "mark_complete":
            job_id = params.get("job_id") or context.get("job_id")
            if not job_id:
                search = params.get("address") or params.get("client_name") or ""
                if search:
                    job_id = await _find_job_id(search, auth_token)
            if not job_id:
                # Try getting the most recent active job
                try:
                    async with httpx.AsyncClient(timeout=10.0) as c:
                        r = await c.get(f"{BACKEND_URL}/api/jobs", headers={"Authorization": f"Bearer {auth_token}"})
                        jobs = r.json() if r.status_code == 200 else []
                        active = [j for j in jobs if j.get("status") in ("IN_PROGRESS", "SCHEDULED")]
                        if active:
                            job_id = active[0]["id"]
                except Exception:
                    pass
            if not job_id:
                return {"type": "MARK_JOB_COMPLETE", "payload": {}, "description": "Mark job as completed (no active job found — please specify)"}

            job_title = await _get_job_title(job_id, auth_token)
            return mark_job_complete_action(job_id=job_id, job_title=job_title)

        elif intent_type == "add_line_item":
            target = params.get("target", "quote")
            client_id = context.get("client_id")
            if not client_id:
                client_id = await _find_client_id(params.get("client_name", ""), auth_token) if params.get("client_name") else None
            entity_id = context.get(f"{target}_id") or await _find_entity_id(
                target, client_id, auth_token
            )
            if not entity_id:
                return {"type": "ADD_LINE_ITEM", "payload": {"description": params.get("service", "Service")}, "description": f"Add {params.get('service', 'item')} to {target} (no active {target} found)"}

            service_name = params.get("service", "Service")
            quantity = params.get("quantity", 1)
            unit_price = params.get("unit_price", 0)

            # Look up service from catalog if price not given
            if unit_price == 0:
                unit_price = await _lookup_service_price(service_name, auth_token)

            return add_line_item_action(
                entity_type=target,
                entity_id=entity_id,
                description=service_name,
                quantity=quantity,
                unit_price=unit_price,
                entity_title=target,
            )

        elif intent_type == "create_job":
            client_id = context.get("client_id")
            if not client_id and params.get("client_name"):
                client_id = await _find_client_id(params["client_name"], auth_token)
            if not client_id:
                # Try getting the first client as default
                try:
                    async with httpx.AsyncClient(timeout=10.0) as c:
                        r = await c.get(f"{BACKEND_URL}/api/clients", headers={"Authorization": f"Bearer {auth_token}"})
                        clients = r.json() if r.status_code == 200 else []
                        if clients:
                            client_id = clients[0]["id"]
                except Exception:
                    pass
            if not client_id:
                return {"type": "CREATE_JOB", "payload": {}, "description": "Schedule a new job (no client specified)"}

            title = params.get("title", "New Job")
            # Parse timing/date
            scheduled_start = _parse_timing(params.get("date") or params.get("timing"))

            return await create_job_action(
                client_id=client_id,
                title=title,
                scheduled_start=scheduled_start,
                property_id=context.get("property_id"),
                description=params.get("description"),
                auth_token=auth_token,
            )

        elif intent_type == "reschedule_job":
            job_id = params.get("job_id") or context.get("job_id")
            if not job_id:
                return None
            new_start = _parse_timing(params.get("new_date") or params.get("timing"))
            return await reschedule_job_action(
                job_id=job_id,
                new_start=new_start,
                reason="Batch rescheduled via AI",
                auth_token=auth_token,
            )

        elif intent_type == "update_client":
            client_id = context.get("client_id")
            if not client_id and params.get("client_name"):
                client_id = await _find_client_id(params["client_name"], auth_token)
            if not client_id:
                return None
            field = params.get("field", "")
            value = params.get("value", "")
            if not field or not value:
                return None
            return update_client_action(
                client_id=client_id,
                updates={field: value},
                client_name=params.get("client_name", ""),
            )

        elif intent_type == "create_quote":
            client_id = context.get("client_id")
            if not client_id and params.get("client_name"):
                client_id = await _find_client_id(params["client_name"], auth_token)
            if not client_id:
                return None
            items = [{"description": "Landscaping Services", "quantity": 1, "unitPrice": 150.0}]
            return draft_quote(
                client_id=client_id,
                title="Landscaping Quote",
                items=items,
                notes="Generated by AgenticMeadows (batch)",
            )

        elif intent_type == "create_invoice":
            client_id = context.get("client_id")
            if not client_id and params.get("client_name"):
                client_id = await _find_client_id(params["client_name"], auth_token)
            if not client_id:
                return None
            items = [{"description": "Landscaping Services", "quantity": 1, "unitPrice": 150.0}]
            return create_invoice_action(
                client_id=client_id,
                line_items=items,
            )

        elif intent_type == "lookup":
            # Lookups don't produce pending actions -- skip
            return None

    except Exception as e:
        log.warning(f"Failed to resolve intent '{intent_type}': {e}")
        return None

    return None


# ── Helper functions ────────────────────────────────────────────────────────

def _parse_timing(timing_str: str | None) -> str:
    """Convert a relative timing string into an ISO datetime."""
    if not timing_str:
        return (datetime.utcnow() + timedelta(days=1)).replace(
            hour=9, minute=0, second=0, microsecond=0
        ).isoformat() + "Z"

    timing_lower = timing_str.lower().strip()

    # "2 weeks from now", "in 2 weeks"
    weeks_match = re.search(r"(\d+)\s*weeks?", timing_lower)
    if weeks_match:
        weeks = int(weeks_match.group(1))
        return (datetime.utcnow() + timedelta(weeks=weeks)).replace(
            hour=9, minute=0, second=0, microsecond=0
        ).isoformat() + "Z"

    # "3 days from now", "in 3 days"
    days_match = re.search(r"(\d+)\s*days?", timing_lower)
    if days_match:
        days = int(days_match.group(1))
        return (datetime.utcnow() + timedelta(days=days)).replace(
            hour=9, minute=0, second=0, microsecond=0
        ).isoformat() + "Z"

    # "tomorrow"
    if "tomorrow" in timing_lower:
        return (datetime.utcnow() + timedelta(days=1)).replace(
            hour=9, minute=0, second=0, microsecond=0
        ).isoformat() + "Z"

    # "next week"
    if "next week" in timing_lower:
        return (datetime.utcnow() + timedelta(weeks=1)).replace(
            hour=9, minute=0, second=0, microsecond=0
        ).isoformat() + "Z"

    # Default: next day at 9am
    return (datetime.utcnow() + timedelta(days=1)).replace(
        hour=9, minute=0, second=0, microsecond=0
    ).isoformat() + "Z"


async def _find_job_id(search: str, auth_token: str) -> str | None:
    """Search for a job by address or client name."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/jobs",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code == 200:
                jobs = resp.json()
                search_lower = search.lower()
                for job in jobs:
                    prop = job.get("property", {}) or {}
                    addr = (prop.get("streetAddress", "") or "").lower()
                    title = (job.get("title", "") or "").lower()
                    if search_lower in addr or search_lower in title:
                        return job["id"]
    except Exception:
        pass
    return None


async def _get_job_title(job_id: str, auth_token: str) -> str:
    """Fetch job title for display."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/jobs/{job_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code == 200:
                return resp.json().get("title", "job")
    except Exception:
        pass
    return "job"


async def _find_client_id(name: str, auth_token: str) -> str | None:
    """Search for a client by name."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/clients?search={name}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code == 200:
                clients = resp.json()
                if clients:
                    return clients[0]["id"]
    except Exception:
        pass
    return None


async def _find_entity_id(entity_type: str, client_id: str | None, auth_token: str) -> str | None:
    """Find the most recent draft entity (quote or invoice) for a client."""
    if not client_id:
        return None
    try:
        endpoint = f"{BACKEND_URL}/api/{entity_type}s"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                endpoint,
                params={"clientId": client_id, "status": "DRAFT"},
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code == 200:
                entities = resp.json()
                if entities:
                    return entities[0]["id"]
    except Exception:
        pass
    return None


async def _lookup_service_price(service_name: str, auth_token: str) -> float:
    """Look up a service price from the catalog by fuzzy name match."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{BACKEND_URL}/api/services",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code == 200:
                services = resp.json()
                name_lower = service_name.lower()
                for svc in services:
                    svc_name = (svc.get("name", "") or "").lower()
                    if name_lower in svc_name or svc_name in name_lower:
                        return float(svc.get("basePrice", 0))
                # Partial match on category keywords
                for svc in services:
                    cat = (svc.get("category", "") or "").lower().replace("_", " ")
                    if name_lower in cat or any(w in name_lower for w in cat.split()):
                        return float(svc.get("basePrice", 0))
    except Exception:
        pass
    # Default price when no match found
    return 50.0


# ── Main batch parsing function ─────────────────────────────────────────────

async def parse_batch_message(message: str, context: dict, auth_token: str) -> list[dict]:
    """
    Use the LLM to decompose a multi-intent message into individual actions.

    Example input: "Finished at Geneva Pl, add 40 sqft of fertilizer to the quote, and schedule next visit for 2 weeks"

    Returns a list of PendingAction dicts ready for batch confirmation.
    """
    context_summary = []
    if context.get("client_id"):
        context_summary.append(f"Current client ID: {context['client_id']}")
    if context.get("job_id"):
        context_summary.append(f"Current job ID: {context['job_id']}")
    if context.get("property_id"):
        context_summary.append(f"Current property ID: {context['property_id']}")
    ctx_str = "; ".join(context_summary) if context_summary else "No specific context"

    system_prompt = (
        "You are a landscaping CRM intent parser. Break the user's message into individual actions.\n"
        "Return ONLY a JSON array where each element has \"intent\" and \"params\".\n\n"
        "Valid intents:\n"
        "- mark_complete: Mark a job as completed. Params: {job_id?, address?, client_name?}\n"
        "- add_line_item: Add a service to a quote/invoice. Params: {service, quantity?, unit?, unit_price?, target: \"quote\"|\"invoice\", client_name?}\n"
        "- create_job: Schedule a new job. Params: {title?, client_name?, address?, date?, timing?}\n"
        "- reschedule_job: Move a job. Params: {job_id?, new_date?, timing?}\n"
        "- update_client: Update client info. Params: {client_name, field, value}\n"
        "- create_quote: Draft a new quote. Params: {client_name?}\n"
        "- create_invoice: Create an invoice. Params: {client_name?}\n"
        "- lookup: Look up an entity. Params: {type: \"client\"|\"job\"|\"quote\"|\"property\", search}\n\n"
        f"User message: \"{message}\"\n\n"
        f"Context: {ctx_str}\n\n"
        "JSON array:"
    )

    raw_response = await _call_llm(
        messages=[{"role": "user", "content": system_prompt}],
        max_tokens=1024,
    )

    # Parse JSON from response (handle code blocks, extra text, etc.)
    intents = _extract_json_array(raw_response)
    if not intents:
        log.warning(f"Batch parsing returned no intents from: {raw_response[:200]}")
        return []

    # Resolve each intent into a PendingAction
    actions = []
    for intent in intents:
        action = await _resolve_intent(intent, context, auth_token)
        if action:
            actions.append(action)

    return actions


def _extract_json_array(text: str) -> list[dict]:
    """Extract a JSON array from LLM output, handling markdown code blocks."""
    # Strip markdown code fences
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    text = text.strip()

    # Try to find a JSON array in the text
    # First: try parsing the whole thing
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass

    # Second: find the first [ ... ] block
    bracket_match = re.search(r"\[.*\]", text, re.DOTALL)
    if bracket_match:
        try:
            parsed = json.loads(bracket_match.group())
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

    return []
