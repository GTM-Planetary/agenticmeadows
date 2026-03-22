"""
AgenticMeadows Weather Tools
Provides weather forecast lookups and schedule impact checks.
"""

import os
import httpx
from typing import Optional


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


async def check_weather(
    zip_code: str,
    days: int = 7,
    auth_token: str = "",
) -> dict:
    """
    Fetches weather forecast from the backend weather endpoint.

    Args:
        zip_code: ZIP code to look up weather for
        days: Number of forecast days (default 7)
        auth_token: Bearer token for backend auth

    Returns:
        dict with zipCode, days (list of daily forecasts)
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/weather",
            params={"zip": zip_code, "days": days},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def check_schedule_weather(
    start: str,
    end: str,
    auth_token: str = "",
) -> dict:
    """
    Checks weather impacts on scheduled jobs in a date range.

    Args:
        start: ISO date string for range start
        end: ISO date string for range end
        auth_token: Bearer token for backend auth

    Returns:
        dict with alerts (list of weather-impacted jobs)
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/weather/schedule-check",
            params={"start": start, "end": end},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


def format_weather_summary(data: dict) -> str:
    """Format weather forecast for chat display."""
    lines = [f"Weather forecast for {data.get('zipCode', 'your area')}:"]
    for day in data.get("days", []):
        if day.get("weatherCode", 99) < 3:
            emoji = "☀️"
        elif day.get("precipMm", 0) > 1:
            emoji = "🌧️"
        else:
            emoji = "⛅"

        line = f"  {emoji} {day['date']}: {day['tempHighF']:.0f}F/{day['tempLowF']:.0f}F -- {day['description']}"
        if day.get("precipMm", 0) > 0:
            line += f", {day['precipMm']:.1f}mm rain"
        lines.append(line)

    return "\n".join(lines)


def format_weather_alerts(data: dict) -> str:
    """Format weather alerts for scheduled jobs."""
    alerts = data.get("alerts", [])
    if not alerts:
        return "No weather concerns for scheduled jobs."

    lines = ["Weather alerts for your schedule:"]
    for a in alerts:
        icon = "!!" if a.get("severity") == "high" else "!"
        lines.append(f"  {icon} {a['jobTitle']} ({a['date']}): {a['issue']}")
    return "\n".join(lines)
