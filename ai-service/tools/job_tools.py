"""
AgenticMeadows Job Tools
Generates PendingAction objects for job creation and rescheduling.
The actual API calls to the backend only happen in confirm_action().
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


async def create_job_action(
    client_id: str,
    title: str,
    scheduled_start: str,
    scheduled_end: Optional[str] = None,
    property_id: Optional[str] = None,
    assigned_user_id: Optional[str] = None,
    description: Optional[str] = None,
    auth_token: str = "",
) -> dict:
    """
    Returns a PendingAction dict for job creation.
    Does NOT call the backend -- the frontend must call /ai/confirm-action.

    Args:
        client_id: The Prisma Client.id
        title: Job title (e.g., "Spring Cleanup")
        scheduled_start: ISO datetime string for job start
        scheduled_end: Optional ISO datetime string for job end
        property_id: Optional property to associate
        assigned_user_id: Optional user to assign
        description: Optional job description
        auth_token: Bearer token (unused here, kept for signature consistency)

    Returns:
        PendingAction dict with type, payload, description
    """
    return {
        "type": "CREATE_JOB",
        "payload": {
            "clientId": client_id,
            "title": title,
            "scheduledStart": scheduled_start,
            "scheduledEnd": scheduled_end,
            "propertyId": property_id,
            "assignedUserId": assigned_user_id,
            "description": description,
        },
        "description": f"Schedule job '{title}' starting {scheduled_start}",
    }


async def execute_create_job(payload: dict, auth_token: str) -> dict:
    """
    Actually creates the job in the backend.
    Called by confirm_action() endpoint -- NOT by the AI directly.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/jobs",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def reschedule_job_action(
    job_id: str,
    new_start: str,
    new_end: Optional[str] = None,
    reason: Optional[str] = None,
    auth_token: str = "",
) -> dict:
    """
    Returns a PendingAction dict for rescheduling a job.
    Fetches the current job first to display context in the confirmation.

    Args:
        job_id: The job ID to reschedule
        new_start: New ISO datetime for job start
        new_end: Optional new ISO datetime for job end
        reason: Optional reason for rescheduling
        auth_token: Bearer token for fetching current job details

    Returns:
        PendingAction dict with type, payload, description
    """
    # Fetch current job to show the change in the confirmation
    job = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"{BACKEND_URL}/api/jobs/{job_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            if resp.status_code == 200:
                job = resp.json()
        except Exception:
            pass

    description = f"Reschedule '{job.get('title', 'job')}' to {new_start}"
    if reason:
        description += f" -- {reason}"

    return {
        "type": "RESCHEDULE_JOB",
        "payload": {
            "job_id": job_id,
            "scheduledStart": new_start,
            "scheduledEnd": new_end,
        },
        "description": description,
    }


async def execute_reschedule_job(payload: dict, auth_token: str) -> dict:
    """
    Actually reschedules the job in the backend via PUT.
    Called by confirm_action() endpoint -- NOT by the AI directly.
    """
    job_id = payload.pop("job_id")
    # Remove None values so we don't overwrite fields unnecessarily
    update_data = {k: v for k, v in payload.items() if v is not None}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.put(
            f"{BACKEND_URL}/api/jobs/{job_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()
