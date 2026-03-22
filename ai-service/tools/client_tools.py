"""
AgenticMeadows Client Tools
Provides read-only client and property lookups for the AI agent.
"""

import os
import httpx


BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


async def get_clients(search: str = "", auth_token: str = "") -> list[dict]:
    """Fetch clients from the backend, optionally filtered by search term."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        params = {"search": search} if search else {}
        resp = await client.get(
            f"{BACKEND_URL}/api/clients",
            params=params,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


async def get_client(client_id: str, auth_token: str = "") -> dict:
    """Fetch a single client with their properties and recent jobs."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"{BACKEND_URL}/api/clients/{client_id}",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        resp.raise_for_status()
        return resp.json()


def create_client_action(
    name: str,
    email: str = "",
    phone: str = "",
    notes: str = "",
    property_address: str = "",
    property_city: str = "",
    property_state: str = "",
    property_zip: str = "",
    auth_token: str = "",
) -> dict:
    """
    Build a PendingAction to create a new client.
    Does NOT call the API — returns a confirmation dict for the user.
    """
    payload: dict = {"name": name}
    if email:
        payload["email"] = email
    if phone:
        payload["phone"] = phone
    if notes:
        payload["notes"] = notes

    # If property info provided, include it
    if property_address:
        payload["properties"] = [{
            "streetAddress": property_address,
            "city": property_city or "",
            "state": property_state or "",
            "zip": property_zip or "",
        }]

    description = f"Create client: {name}"
    if email:
        description += f" ({email})"
    if property_address:
        description += f" with property at {property_address}"

    return {
        "type": "CREATE_CLIENT",
        "description": description,
        "payload": payload,
    }


def format_client_summary(client: dict) -> str:
    """Format a client record as a concise text summary for the AI context."""
    name = f"{client['firstName']} {client['lastName']}"
    company = f" ({client['company']})" if client.get("company") else ""
    props = client.get("properties", [])
    prop_summary = ""
    if props:
        prop_list = ", ".join(p["streetAddress"] + ", " + p["city"] for p in props)
    prop_summary = f"\n  Properties: {prop_list}"
    return f"Client: {name}{company} — ID: {client['id']}{prop_summary}"
