"""
AgenticMeadows Update Tools
Generates PendingAction objects for entity updates (clients, jobs, line items).
The actual API calls to the backend only happen in confirm_action().
"""

import os
import httpx

BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:4000")


def update_client_action(client_id, updates, client_name=""):
    return {
        "type": "UPDATE_CLIENT",
        "payload": {"clientId": client_id, **updates},
        "description": f"Update client {client_name}: {', '.join(f'{k}={v}' for k, v in updates.items())}",
    }


def update_job_action(job_id, updates, job_title=""):
    return {
        "type": "UPDATE_JOB",
        "payload": {"jobId": job_id, **updates},
        "description": f"Update job '{job_title}': {', '.join(f'{k}={v}' for k, v in updates.items())}",
    }


def mark_job_complete_action(job_id, job_title=""):
    return {
        "type": "MARK_JOB_COMPLETE",
        "payload": {"jobId": job_id},
        "description": f"Mark job '{job_title}' as completed",
    }


def add_line_item_action(entity_type, entity_id, description, quantity, unit_price, entity_title=""):
    total = quantity * unit_price
    return {
        "type": "ADD_LINE_ITEM",
        "payload": {
            "entityType": entity_type,
            "entityId": entity_id,
            "description": description,
            "quantity": quantity,
            "unitPrice": unit_price,
        },
        "description": f"Add '{description}' ({quantity} x ${unit_price:.2f} = ${total:.2f}) to {entity_type} '{entity_title}'",
        "display_items": [{"description": description, "quantity": quantity, "unitPrice": unit_price}],
        "total": total,
    }


def remove_line_item_action(entity_type, entity_id, line_item_id, item_description=""):
    return {
        "type": "REMOVE_LINE_ITEM",
        "payload": {
            "entityType": entity_type,
            "entityId": entity_id,
            "lineItemId": line_item_id,
        },
        "description": f"Remove '{item_description}' from {entity_type}",
    }


async def execute_update_client(payload, auth_token):
    client_id = payload.pop("clientId")
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.put(
            f"{BACKEND_URL}/api/clients/{client_id}",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        return r.json()


async def execute_update_job(payload, auth_token):
    job_id = payload.pop("jobId")
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.put(
            f"{BACKEND_URL}/api/jobs/{job_id}",
            json=payload,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        return r.json()


async def execute_mark_complete(payload, auth_token):
    job_id = payload["jobId"]
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.put(
            f"{BACKEND_URL}/api/jobs/{job_id}",
            json={"status": "COMPLETED"},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        return r.json()


async def execute_add_line_item(payload, auth_token):
    entity_type = payload["entityType"]  # "quote" or "invoice"
    entity_id = payload["entityId"]
    item = {
        "description": payload["description"],
        "quantity": payload["quantity"],
        "unitPrice": payload["unitPrice"],
    }
    endpoint = f"{BACKEND_URL}/api/{entity_type}s/{entity_id}/line-items"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(
            endpoint,
            json=item,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        return r.json()


async def execute_remove_line_item(payload, auth_token):
    entity_type = payload["entityType"]
    entity_id = payload["entityId"]
    item_id = payload["lineItemId"]
    endpoint = f"{BACKEND_URL}/api/{entity_type}s/{entity_id}/line-items/{item_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.delete(
            endpoint,
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        r.raise_for_status()
        return {"deleted": True}
