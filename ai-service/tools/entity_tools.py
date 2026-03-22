"""
AgenticMeadows Entity Tools
Provides entity lookup and EntityCard building for the AI chat interface.
Supports fuzzy matching for clients, jobs, quotes, and properties.
"""

import os
from difflib import SequenceMatcher
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


def _fuzzy_score(query, candidate):
    q = query.lower().strip()
    c = candidate.lower().strip()
    if q in c:
        return 0.9 + (len(q) / max(len(c), 1)) * 0.1
    return SequenceMatcher(None, q, c).ratio()


def build_entity_card(entity_type, data, editable=True):
    """Build an EntityCard dict for the ChatResponse."""
    editable_fields_map = {
        "client": ["firstName", "lastName", "email", "phone", "company", "notes"],
        "job": ["title", "description", "notes"],
        "quote": ["title", "notes"],
        "invoice": ["notes"],
        "property": ["notes"],
        "service": ["name", "description", "basePrice"],
    }
    actions_map = {
        "client": [
            {"label": "View Jobs", "action": "view_jobs", "params": {"clientId": data.get("id")}},
            {"label": "Draft Quote", "action": "draft_quote", "params": {"clientId": data.get("id")}, "requiresConfirmation": True},
        ],
        "job": [
            {"label": "Mark Complete", "action": "mark_complete", "params": {"jobId": data.get("id")}, "requiresConfirmation": True},
            {"label": "Reschedule", "action": "reschedule", "params": {"jobId": data.get("id")}, "requiresConfirmation": True},
        ],
        "quote": [
            {"label": "Add Line Item", "action": "add_line_item", "params": {"quoteId": data.get("id")}},
            {"label": "Convert to Invoice", "action": "convert_invoice", "params": {"quoteId": data.get("id")}, "requiresConfirmation": True},
        ],
        "invoice": [
            {"label": "Mark Paid", "action": "mark_paid", "params": {"invoiceId": data.get("id")}, "requiresConfirmation": True},
        ],
        "property": [
            {"label": "View Chemical History", "action": "view_chemicals", "params": {"propertyId": data.get("id")}},
        ],
        "service": [],
    }
    return {
        "type": entity_type,
        "id": data.get("id", ""),
        "data": data,
        "editable": editable,
        "editableFields": editable_fields_map.get(entity_type, []),
        "actions": actions_map.get(entity_type, []),
    }


async def lookup_client(name_or_search, auth_token=""):
    """Search clients and return EntityCard(s)."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{BACKEND_URL}/api/clients",
            params={"search": name_or_search},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        clients = r.json()
    if not clients:
        return None, "No clients found matching that search."
    cards = [build_entity_card("client", c) for c in clients[:3]]
    return cards, None


async def lookup_job(job_id=None, search=None, client_id=None, auth_token=""):
    """Fetch job by ID or search."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        if job_id:
            r = await client.get(
                f"{BACKEND_URL}/api/jobs/{job_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        else:
            params = {}
            if client_id:
                params["clientId"] = client_id
            r = await client.get(
                f"{BACKEND_URL}/api/jobs",
                params=params,
                headers={"Authorization": f"Bearer {auth_token}"},
            )
        r.raise_for_status()
        data = r.json()
    if isinstance(data, list):
        if not data:
            return None, "No jobs found."
        cards = [build_entity_card("job", j) for j in data[:3]]
        return cards, None
    return [build_entity_card("job", data)], None


async def lookup_quote(quote_id=None, client_id=None, status=None, auth_token=""):
    """Fetch quote by ID or find active quote for client."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        if quote_id:
            r = await client.get(
                f"{BACKEND_URL}/api/quotes/{quote_id}",
                headers={"Authorization": f"Bearer {auth_token}"},
            )
            r.raise_for_status()
            return [build_entity_card("quote", r.json())], None
        params = {}
        if client_id:
            params["clientId"] = client_id
        if status:
            params["status"] = status
        r = await client.get(
            f"{BACKEND_URL}/api/quotes",
            params=params,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        quotes = r.json()
    if not quotes:
        return None, "No quotes found."
    cards = [build_entity_card("quote", q) for q in quotes[:3]]
    return cards, None


async def lookup_property(address_fragment, auth_token=""):
    """Fuzzy match property by address."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(
            f"{BACKEND_URL}/api/clients",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        clients = r.json()

    candidates = []
    for cl in clients:
        for prop in cl.get("properties", []):
            full_addr = f"{prop.get('streetAddress', '')}, {prop.get('city', '')}"
            score = max(
                _fuzzy_score(address_fragment, prop.get("streetAddress", "")),
                _fuzzy_score(address_fragment, full_addr),
            )
            prop_with_client = {
                **prop,
                "client": {
                    "id": cl["id"],
                    "firstName": cl.get("firstName", ""),
                    "lastName": cl.get("lastName", ""),
                },
            }
            candidates.append((score, prop_with_client))

    candidates.sort(key=lambda x: x[0], reverse=True)

    if not candidates or candidates[0][0] < 0.3:
        return None, f"No property found matching '{address_fragment}'."

    if candidates[0][0] > 0.6:
        return [build_entity_card("property", candidates[0][1])], None

    # Ambiguous -- return top 3
    top = candidates[:min(3, len(candidates))]
    cards = [build_entity_card("property", c[1]) for c in top]
    return cards, "I found a few possible matches. Which property did you mean?"
