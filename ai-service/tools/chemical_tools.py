"""
AgenticMeadows Chemical Tools
Generates PendingAction objects for chemical application logging.
The actual API call to the backend only happens in confirm_action().
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


def log_chemical_action(
    property_id: str,
    product_name: str,
    job_id: Optional[str] = None,
    application_rate: Optional[str] = None,
    area_treated_sqft: Optional[float] = None,
    reentry_hours: int = 24,
    auth_token: str = "",
) -> dict:
    """
    Returns a PendingAction dict for logging a chemical application.
    Does NOT call the backend -- the frontend must call /ai/confirm-action.

    Args:
        property_id: The property where chemical was applied
        product_name: Name of the chemical product
        job_id: Optional associated job
        application_rate: Optional rate string (e.g., "2 oz/1000 sqft")
        area_treated_sqft: Optional area treated in square feet
        reentry_hours: Hours before re-entry is safe (default 24)
        auth_token: Bearer token (unused here, kept for signature consistency)

    Returns:
        PendingAction dict with type, payload, description
    """
    description = f"Log application of {product_name}"
    if application_rate:
        description += f" ({application_rate})"

    return {
        "type": "LOG_CHEMICAL",
        "payload": {
            "propertyId": property_id,
            "productName": product_name,
            "jobId": job_id,
            "applicationRate": application_rate,
            "areaTreatedSqft": area_treated_sqft,
            "reentryHours": reentry_hours,
        },
        "description": description,
    }


async def execute_log_chemical(payload: dict, auth_token: str) -> dict:
    """
    Actually creates the chemical application record in the backend.
    Called by confirm_action() endpoint -- NOT by the AI directly.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/chemicals",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_property_chemical_history(
    property_id: str,
    auth_token: str = "",
) -> list[dict]:
    """
    Fetches chemical application history for a property.

    Args:
        property_id: The property to look up
        auth_token: Bearer token for backend auth

    Returns:
        List of chemical application records
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/chemicals",
            params={"propertyId": property_id},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


def format_chemical_history(applications: list[dict]) -> str:
    """Format chemical application history for chat display."""
    if not applications:
        return "No chemical applications recorded for this property."

    lines = ["Chemical Application History:"]
    for app in applications:
        line = f"  - {app.get('date', 'N/A')}: {app.get('productName', 'Unknown product')}"
        if app.get("applicationRate"):
            line += f" @ {app['applicationRate']}"
        if app.get("areaTreatedSqft"):
            line += f" ({app['areaTreatedSqft']:,.0f} sqft)"
        if app.get("reentryHours"):
            line += f" [re-entry: {app['reentryHours']}h]"
        lines.append(line)

    return "\n".join(lines)
