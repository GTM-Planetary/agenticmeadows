"""
AgenticMeadows Agent Tools
Provides agent action logging, notifications, and dashboard analytics.
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


async def create_agent_action(
    action_type: str,
    summary: str,
    details: Optional[dict] = None,
    user_id: Optional[str] = None,
    auth_token: str = "",
) -> dict:
    """
    Creates an AgentAction record to log what the AI did.

    Args:
        action_type: Type of action (e.g., "QUOTE_DRAFTED", "JOB_RESCHEDULED")
        summary: Human-readable summary of the action
        details: Optional dict of additional action details
        user_id: Optional user who triggered the action
        auth_token: Bearer token for backend auth

    Returns:
        Created agent action record
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/agent/actions",
            json={
                "actionType": action_type,
                "summary": summary,
                "details": details,
                "userId": user_id,
            },
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def create_notification(
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    auth_token: str = "",
) -> dict:
    """
    Creates a notification for a user.

    Args:
        user_id: User to notify
        notification_type: Type of notification (e.g., "REMINDER", "ALERT", "INFO")
        title: Notification title
        message: Notification body text
        action_url: Optional URL for the notification action button
        auth_token: Bearer token for backend auth

    Returns:
        Created notification record
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"{BACKEND_URL}/api/notifications",
            json={
                "userId": user_id,
                "type": notification_type,
                "title": title,
                "message": message,
                "actionUrl": action_url,
            },
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_dashboard_stats(auth_token: str = "") -> dict:
    """
    Fetches business analytics from the dashboard stats endpoint.

    Args:
        auth_token: Bearer token for backend auth

    Returns:
        dict with revenue, jobs, invoices stats
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


def format_analytics_summary(stats: dict) -> str:
    """Format business metrics for chat display."""
    r = stats.get("revenue", {})
    j = stats.get("jobs", {})

    lines = [
        "Business Overview:",
        f"  Revenue this month: ${r.get('thisMonth', 0):,.2f}",
        f"  Last month: ${r.get('lastMonth', 0):,.2f}",
        f"  Outstanding: ${r.get('outstanding', 0):,.2f}",
        f"  Jobs: {j.get('pending', 0)} pending, {j.get('scheduled', 0)} scheduled, "
        f"{j.get('inProgress', 0)} in progress, {j.get('completedThisMonth', 0)} completed this month",
    ]

    overdue = stats.get("invoices", {}).get("overdue", [])
    if overdue:
        overdue_total = stats.get("invoices", {}).get("overdueTotal", 0)
        lines.append(f"  WARNING: {len(overdue)} overdue invoice(s) totaling ${overdue_total:,.2f}")

    return "\n".join(lines)
