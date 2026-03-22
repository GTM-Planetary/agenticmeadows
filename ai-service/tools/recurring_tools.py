"""
AgenticMeadows Recurring Tools
Generates PendingAction objects for recurring service template creation.
The actual API call to the backend only happens in confirm_action().
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


def create_recurring_template_action(
    client_id: str,
    title: str,
    frequency: str,
    season: str = "ALL_YEAR",
    service_id: Optional[str] = None,
    property_id: Optional[str] = None,
    auth_token: str = "",
) -> dict:
    """
    Returns a PendingAction dict for creating a recurring service template.
    Does NOT call the backend -- the frontend must call /ai/confirm-action.

    Args:
        client_id: The Prisma Client.id
        title: Template title (e.g., "Weekly Mowing - Smith Residence")
        frequency: Recurrence frequency (e.g., "WEEKLY", "BIWEEKLY", "MONTHLY")
        season: Season constraint (e.g., "ALL_YEAR", "SPRING_SUMMER", "FALL")
        service_id: Optional service catalog ID
        property_id: Optional property to associate
        auth_token: Bearer token (unused here, kept for signature consistency)

    Returns:
        PendingAction dict with type, payload, description
    """
    return {
        "type": "CREATE_RECURRING",
        "payload": {
            "clientId": client_id,
            "title": title,
            "frequency": frequency,
            "season": season,
            "serviceId": service_id,
            "propertyId": property_id,
        },
        "description": f"Create {frequency.lower()} recurring template '{title}' ({season.replace('_', ' ').title()})",
    }


async def execute_create_recurring(payload: dict, auth_token: str) -> dict:
    """
    Actually creates the recurring template in the backend.
    Called by confirm_action() endpoint -- NOT by the AI directly.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/recurring",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def generate_recurring_jobs(
    template_id: Optional[str] = None,
    season: Optional[str] = None,
    auth_token: str = "",
) -> dict:
    """
    Triggers job generation from recurring templates.

    Args:
        template_id: Optional specific template to generate from
        season: Optional season filter for generation
        auth_token: Bearer token for backend auth

    Returns:
        dict with generated job count and details
    """
    params = {}
    if template_id:
        params["templateId"] = template_id
    if season:
        params["season"] = season

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/recurring/generate",
            params=params,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()
