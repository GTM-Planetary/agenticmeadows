"""
AgenticMeadows Schedule Tools
Provides schedule lookup for the AI agent.
"""

import os
import httpx
from datetime import datetime, timedelta


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


async def get_schedule(
    start: datetime = None,
    end: datetime = None,
    auth_token: str = "",
) -> list[dict]:
    """Fetch jobs in a date range. Defaults to the current week."""
    if start is None:
        # Default to current week (Monday to Sunday)
        today = datetime.utcnow()
        start = today - timedelta(days=today.weekday())
    if end is None:
        end = start + timedelta(days=7)

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/schedule",
            params={
                "start": start.isoformat() + "Z",
                "end": end.isoformat() + "Z",
            },
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


def format_schedule_summary(jobs: list[dict]) -> str:
    """Format a list of scheduled jobs as a readable text summary."""
    if not jobs:
        return "No jobs scheduled in this period."

    lines = []
    for job in jobs:
        client_name = ""
        if job.get("client"):
            c = job["client"]
            client_name = f"{c['firstName']} {c['lastName']}"

        start_str = ""
        if job.get("scheduledStart"):
            try:
                dt = datetime.fromisoformat(job["scheduledStart"].replace("Z", "+00:00"))
                start_str = dt.strftime("%a %b %d, %I:%M %p")
            except Exception:
                start_str = job["scheduledStart"]

        status_emoji = {
            "PENDING": "⏳",
            "SCHEDULED": "📅",
            "IN_PROGRESS": "🔧",
            "COMPLETED": "✅",
            "CANCELLED": "❌",
        }.get(job.get("status", ""), "•")

        lines.append(
            f"{status_emoji} {start_str} — {job['title']} (Client: {client_name}, Status: {job.get('status', 'Unknown')})"
        )

    return "\n".join(lines)
