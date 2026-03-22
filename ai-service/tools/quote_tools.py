"""
AgenticMeadows Quote Tools
Generates PendingAction objects for quote creation.
The actual API call to the backend only happens in confirm_action().
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


def draft_quote(
    client_id: str,
    title: str,
    items: list[dict],
    property_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    """
    Returns a PendingAction dict for quote creation.
    Does NOT call the backend — the frontend must call /ai/confirm-action.

    Args:
        client_id: The Prisma Client.id
        title: Quote title (e.g., "Spring Cleanup — 123 Meadow Lane")
        items: List of {description, quantity, unitPrice} dicts
        property_id: Optional property to associate
        notes: Optional quote notes

    Returns:
        PendingAction dict with type, payload, description, and display_items
    """
    total = sum(item.get("quantity", 1) * item.get("unitPrice", 0) for item in items)

    return {
        "type": "CREATE_QUOTE",
        "payload": {
            "clientId": client_id,
            "propertyId": property_id,
            "title": title,
            "status": "DRAFT",
            "notes": notes,
            "lineItems": items,
        },
        "description": f'Create quote "{title}" — {len(items)} line item(s), total ${total:.2f}',
        "display_items": items,
        "total": total,
    }


async def execute_create_quote(payload: dict, auth_token: str) -> dict:
    """
    Actually creates the quote in the backend.
    Called by confirm_action() endpoint — NOT by the AI directly.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/quotes",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()
