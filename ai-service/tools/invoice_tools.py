"""
AgenticMeadows Invoice Tools
Generates PendingAction objects for invoice creation.
The actual API call to the backend only happens in confirm_action().
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


def create_invoice_action(
    client_id: str,
    line_items: Optional[list[dict]] = None,
    job_id: Optional[str] = None,
    due_date: Optional[str] = None,
    auth_token: str = "",
) -> dict:
    """
    Returns a PendingAction dict for invoice creation.
    Does NOT call the backend -- the frontend must call /ai/confirm-action.

    Args:
        client_id: The Prisma Client.id
        line_items: List of {description, quantity, unitPrice} dicts
        job_id: Optional job to associate the invoice with
        due_date: Optional ISO date string for payment due date
        auth_token: Bearer token (unused here, kept for signature consistency)

    Returns:
        PendingAction dict with type, payload, description, display_items, total
    """
    items = line_items or []
    total = sum(item.get("quantity", 1) * item.get("unitPrice", 0) for item in items)

    return {
        "type": "CREATE_INVOICE",
        "payload": {
            "clientId": client_id,
            "jobId": job_id,
            "lineItems": items,
            "dueDate": due_date,
        },
        "description": f"Create invoice for ${total:.2f}",
        "display_items": items,
        "total": total,
    }


async def execute_create_invoice(payload: dict, auth_token: str) -> dict:
    """
    Actually creates the invoice in the backend.
    Called by confirm_action() endpoint -- NOT by the AI directly.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/invoices",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()
