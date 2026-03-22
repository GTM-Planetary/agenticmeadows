import os
import httpx
import logging

log = logging.getLogger(__name__)
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")

async def log_audit_event(
    session_id: str,
    event_type: str,  # ENTITY_VIEW, ACTION_PROPOSED, ACTION_CONFIRMED, ACTION_REJECTED, BATCH_PROPOSED, BATCH_CONFIRMED, SESSION_START
    summary: str,
    auth_token: str = "",
    entity_type: str = None,
    entity_id: str = None,
    action_type: str = None,
    payload: dict = None,
    result: dict = None,
    inference_mode: str = None,
    model_used: str = None,
    latency_ms: int = None,
):
    """Log an event to the audit trail. Fire-and-forget (errors are logged, not raised)."""
    try:
        body = {
            "sessionId": session_id,
            "eventType": event_type,
            "summary": summary,
        }
        if entity_type: body["entityType"] = entity_type
        if entity_id: body["entityId"] = entity_id
        if action_type: body["actionType"] = action_type
        if payload: body["payload"] = payload
        if result: body["result"] = result
        if inference_mode: body["inferenceMode"] = inference_mode
        if model_used: body["modelUsed"] = model_used
        if latency_ms is not None: body["latencyMs"] = latency_ms

        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{BACKEND_URL}/api/audit",
                json=body,
                headers={"Authorization": f"Bearer {auth_token}"} if auth_token else {},
            )
    except Exception as e:
        log.warning(f"Audit log failed: {e}")
