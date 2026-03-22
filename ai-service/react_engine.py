"""
AgenticMeadows ReAct Engine
=======================
A Reason + Act agentic loop that replaces the keyword-matching if/else chain
in main.py with a proper tool-calling agent.

Architecture:
    1. Takes a user message
    2. Builds a system prompt with available tools described in JSON schema format
    3. Sends to the LLM via a `generate_fn` callback (handles Ollama/NVIDIA routing)
    4. Parses the response for tool calls using <tool_call> JSON format
    5. Executes the tool
    6. Feeds the observation back to the LLM
    7. Repeats until the LLM produces a <final_answer> (no more tool calls)
    8. Returns the final answer + any pending actions or entity cards

The generate_fn is an async callback `async (messages: list[dict]) -> str`
passed in by main.py so the engine is decoupled from inference provider details.

Usage:
    engine = ReActEngine(generate_fn=my_generate, auth_token="abc123")
    result = await engine.run("What's on my schedule today?", conversation_id="conv-1")
"""

import json
import logging
import re
import traceback
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable, Optional

# ── Tool function imports ──────────────────────────────────────────────────
from tools import entity_tools
from tools import client_tools
from tools import schedule_tools
from tools import service_tools
from tools import agent_tools
from tools import weather_tools
from tools import quote_tools
from tools import job_tools
from tools import update_tools
from tools import invoice_tools
from tools import chemical_tools
from tools import maintenance_tools

log = logging.getLogger(__name__)

MAX_ITERATIONS = 5

# ── Tool Registry ──────────────────────────────────────────────────────────
# Each entry maps a tool name to its description, parameter schema, and the
# dotted function path.  The _call_tool method resolves these at runtime.
TOOL_REGISTRY: dict[str, dict] = {
    "lookup_client": {
        "description": "Look up a client by name, email, or phone. Returns client details with properties and recent jobs.",
        "parameters": {"query": "string - client name, email, or phone to search for"},
        "function": "entity_tools.lookup_client",
    },
    "lookup_property": {
        "description": "Look up a property by address (fuzzy match). Returns property details with measurements and chemical history.",
        "parameters": {"address": "string - full or partial street address"},
        "function": "entity_tools.lookup_property",
    },
    "lookup_job": {
        "description": "Look up a job by ID or description. Returns job details with status and photos.",
        "parameters": {"query": "string - job ID or search term"},
        "function": "entity_tools.lookup_job",
    },
    "lookup_quote": {
        "description": "Look up a quote by ID or title. Returns quote with line items.",
        "parameters": {"query": "string - quote ID or search term"},
        "function": "entity_tools.lookup_quote",
    },
    "list_clients": {
        "description": (
            "List all clients, optionally filtered by search term. "
            "Use when user asks 'do we have clients' or 'show all clients'."
        ),
        "parameters": {"search": "string (optional) - filter by name/email"},
        "function": "client_tools.get_clients",
    },
    "get_schedule": {
        "description": (
            "Get scheduled jobs for a date range. "
            "Use when user asks about upcoming jobs, today's schedule, etc."
        ),
        "parameters": {
            "start_date": "string (optional) - ISO date",
            "end_date": "string (optional) - ISO date",
        },
        "function": "schedule_tools.get_schedule",
    },
    "get_service_catalog": {
        "description": (
            "List available services/prices from the service catalog. "
            "Use when user asks about services, pricing, or what we offer."
        ),
        "parameters": {
            "category": "string (optional) - filter by category like MOWING, FERTILIZATION, etc.",
        },
        "function": "service_tools.get_service_catalog",
    },
    "get_dashboard_stats": {
        "description": (
            "Get business analytics: revenue, job counts, overdue invoices. "
            "Use when user asks 'how are we doing' or about revenue/stats."
        ),
        "parameters": {},
        "function": "agent_tools.get_dashboard_stats",
    },
    "check_weather": {
        "description": "Check weather forecast for a ZIP code. Use when user asks about weather or rain.",
        "parameters": {
            "zip_code": "string - 5-digit ZIP code",
            "days": "number (optional) - forecast days (1-7, default 5)",
        },
        "function": "weather_tools.check_weather",
    },
    "draft_quote": {
        "description": "Create a draft quote for a client with line items. Returns a pending action for user confirmation.",
        "parameters": {
            "client_id": "string - client ID",
            "title": "string - quote title",
            "items": "array of {description, quantity, unitPrice}",
            "notes": "string (optional)",
        },
        "function": "quote_tools.draft_quote",
    },
    "create_job": {
        "description": "Create a new job/appointment. Returns a pending action for user confirmation.",
        "parameters": {
            "client_id": "string - client ID",
            "property_id": "string (optional) - property ID",
            "title": "string - job title",
            "description": "string (optional)",
            "scheduled_start": "string - ISO datetime",
            "scheduled_end": "string (optional) - ISO datetime",
        },
        "function": "job_tools.create_job_action",
    },
    "mark_job_complete": {
        "description": "Mark a job as completed. Returns a pending action for user confirmation.",
        "parameters": {"job_id": "string - job ID"},
        "function": "update_tools.mark_job_complete_action",
    },
    "update_client": {
        "description": (
            "Update a client's information (phone, email, name, notes). "
            "Returns a pending action for user confirmation."
        ),
        "parameters": {
            "client_id": "string - client ID",
            "updates": "object - fields to update like {phone, email, name, notes}",
        },
        "function": "update_tools.update_client_action",
    },
    "add_line_item": {
        "description": (
            "Add a line item to an existing quote or invoice. "
            "Returns a pending action for user confirmation."
        ),
        "parameters": {
            "entity_type": "string - 'quote' or 'invoice'",
            "entity_id": "string - quote or invoice ID",
            "description": "string - service/item description",
            "quantity": "number",
            "unit_price": "number",
        },
        "function": "update_tools.add_line_item_action",
    },
    "create_invoice": {
        "description": "Create a new invoice for a client. Returns a pending action for user confirmation.",
        "parameters": {
            "client_id": "string - client ID",
            "items": "array of {description, quantity, unitPrice}",
            "due_date": "string (optional) - ISO date",
        },
        "function": "invoice_tools.create_invoice_action",
    },
    "log_chemical": {
        "description": (
            "Log a chemical/fertilizer application at a property. "
            "Returns a pending action for user confirmation."
        ),
        "parameters": {
            "property_id": "string - property ID",
            "product_name": "string - chemical/fertilizer name",
            "quantity_applied": "string (optional) - e.g. '40 sqft'",
            "notes": "string (optional)",
        },
        "function": "chemical_tools.log_chemical_action",
    },
    "create_client": {
        "description": (
            "Create a new client record with their contact info and optional property address. "
            "Returns a pending action for user confirmation."
        ),
        "parameters": {
            "name": "string - client's full name or business name",
            "email": "string (optional) - email address",
            "phone": "string (optional) - phone number",
            "notes": "string (optional) - any notes about the client",
            "property_address": "string (optional) - street address of their property",
            "property_city": "string (optional) - city",
            "property_state": "string (optional) - state",
            "property_zip": "string (optional) - ZIP code",
        },
        "function": "client_tools.create_client_action",
    },
    "send_notification": {
        "description": "Create a notification/reminder for the user.",
        "parameters": {
            "title": "string - notification title",
            "message": "string - notification body",
        },
        "function": "agent_tools.create_notification",
    },
    "analyze_lawn": {
        "description": "Analyze a lawn photo description to diagnose diseases, pests, weeds, and nutrient issues. Uses the built-in lawn care knowledge base. Use when user shares a photo or describes lawn problems.",
        "parameters": {"image_description": "string - description of what's visible in the lawn/landscape photo"},
        "function": "maintenance_tools.analyze_lawn_photo",
    },
    "get_treatment": {
        "description": "Get detailed treatment recommendations for a specific lawn disease, pest, or weed. Includes chemical, organic, and cultural treatment options with application rates.",
        "parameters": {"issue_name": "string - name of the disease, pest, or weed (e.g., 'brown patch', 'grubs', 'crabgrass')"},
        "function": "maintenance_tools.get_treatment_info",
    },
    "seasonal_guide": {
        "description": "Get seasonal lawn care guide with tasks and timing. Use when user asks about seasonal maintenance or what to do this time of year.",
        "parameters": {"grass_type": "string - 'cool_season' or 'warm_season'", "season": "string (optional) - spring/summer/fall/winter, auto-detected if not provided"},
        "function": "maintenance_tools.get_seasonal_guide",
    },
    "log_equipment_service": {
        "description": "Log a maintenance service on equipment (oil change, blade sharpening, etc). Fuzzy-matches equipment by name. Returns confirmation before logging.",
        "parameters": {
            "equipment_name": "string - name or partial name of the equipment",
            "task_name": "string - what service was performed",
            "hours": "number (optional) - engine hours at time of service",
            "mileage": "number (optional) - mileage at time of service",
            "cost": "number (optional) - cost of service",
            "notes": "string (optional)",
        },
        "function": "maintenance_tools.log_maintenance_via_chat",
    },
    "maintenance_alerts": {
        "description": "Check for overdue or upcoming equipment maintenance. Use when user asks about maintenance status or what needs servicing.",
        "parameters": {},
        "function": "maintenance_tools.get_maintenance_alerts",
    },
    "repair_or_replace": {
        "description": "Analyze whether to repair or replace a piece of equipment based on repair history and costs. Use when user asks about equipment replacement decisions.",
        "parameters": {"equipment_id": "string - equipment ID"},
        "function": "maintenance_tools.analyze_repair_vs_replace",
    },
}

# ── Function resolution map ────────────────────────────────────────────────
# Maps the dotted string in TOOL_REGISTRY["function"] to actual callables.
_FUNCTION_MAP: dict[str, Callable] = {
    "entity_tools.lookup_client": entity_tools.lookup_client,
    "entity_tools.lookup_property": entity_tools.lookup_property,
    "entity_tools.lookup_job": entity_tools.lookup_job,
    "entity_tools.lookup_quote": entity_tools.lookup_quote,
    "client_tools.get_clients": client_tools.get_clients,
    "schedule_tools.get_schedule": schedule_tools.get_schedule,
    "service_tools.get_service_catalog": service_tools.get_service_catalog,
    "agent_tools.get_dashboard_stats": agent_tools.get_dashboard_stats,
    "weather_tools.check_weather": weather_tools.check_weather,
    "quote_tools.draft_quote": quote_tools.draft_quote,
    "job_tools.create_job_action": job_tools.create_job_action,
    "update_tools.mark_job_complete_action": update_tools.mark_job_complete_action,
    "update_tools.update_client_action": update_tools.update_client_action,
    "update_tools.add_line_item_action": update_tools.add_line_item_action,
    "invoice_tools.create_invoice_action": invoice_tools.create_invoice_action,
    "chemical_tools.log_chemical_action": chemical_tools.log_chemical_action,
    "client_tools.create_client_action": client_tools.create_client_action,
    "agent_tools.create_notification": agent_tools.create_notification,
    "maintenance_tools.analyze_lawn_photo": maintenance_tools.analyze_lawn_photo,
    "maintenance_tools.get_treatment_info": maintenance_tools.get_treatment_info,
    "maintenance_tools.get_seasonal_guide": maintenance_tools.get_seasonal_guide,
    "maintenance_tools.log_maintenance_via_chat": maintenance_tools.log_maintenance_via_chat,
    "maintenance_tools.get_maintenance_alerts": maintenance_tools.get_maintenance_alerts,
    "maintenance_tools.analyze_repair_vs_replace": maintenance_tools.analyze_repair_vs_replace,
}

# Tools whose functions are synchronous (not async).  All others are async.
_SYNC_TOOLS: set[str] = {
    "draft_quote",
    "create_client",
    "mark_job_complete",
    "update_client",
    "add_line_item",
}


def _build_tools_schema() -> str:
    """Render the tool registry as a JSON-schema-style block for the system prompt."""
    tools = []
    for name, meta in TOOL_REGISTRY.items():
        tools.append({
            "name": name,
            "description": meta["description"],
            "parameters": meta["parameters"],
        })
    return json.dumps(tools, indent=2)


def _build_system_prompt(context: Optional[dict] = None) -> str:
    """
    Build the system prompt that instructs the LLM how to behave,
    what tools are available, and how to format responses.

    Args:
        context: Optional dict with client_id, job_id, property_id, zip_code
                 that represent the user's current navigation context.
    """
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    tools_json = _build_tools_schema()

    # Build optional context section
    context_section = ""
    if context:
        parts = []
        if context.get("client_id"):
            parts.append(f"- Current client ID: {context['client_id']}")
        if context.get("job_id"):
            parts.append(f"- Current job ID: {context['job_id']}")
        if context.get("property_id"):
            parts.append(f"- Current property ID: {context['property_id']}")
        if context.get("zip_code"):
            parts.append(f"- User's ZIP code: {context['zip_code']}")
        if context.get("user_id"):
            parts.append(f"- User ID: {context['user_id']}")
        if parts:
            context_section = (
                "\n\n## Current Context\n"
                "The user is currently viewing or working with:\n"
                + "\n".join(parts)
                + "\nUse these IDs when relevant instead of asking the user for them."
            )

    return f"""You are Glen AI, the intelligent assistant built into AgenticMeadows, a landscaping field service management platform. You help manage clients, jobs, quotes, invoices, properties, chemical applications, scheduling, and weather planning.

Current date/time: {now}
{context_section}

## How to Respond

You operate in a Think-Act-Observe loop:

1. **Think**: Reason about what the user needs and which tool (if any) to use.
2. **Act**: Call a tool if needed using the format below.
3. **Observe**: Review the tool result and decide if you need another tool or can give a final answer.

### Calling a Tool

When you need to use a tool, output EXACTLY this format (no other text around it):

<tool_call>{{"name": "tool_name", "arguments": {{"param1": "value1", "param2": "value2"}}}}</tool_call>

Only call ONE tool at a time. Wait for the observation before calling another.

### Giving a Final Answer

When you have enough information to answer the user, wrap your response in:

<final_answer>
Your response to the user goes here. Be helpful, concise, and specific to landscaping/field service.
</final_answer>

### Important Rules

- Always use tools to look up real data. Do NOT make up client names, job IDs, prices, or dates.
- If the user asks about a client, property, or job, look it up first before answering.
- For write operations (creating quotes, jobs, invoices, marking jobs complete, updating clients, logging chemicals), the tool will return a pending action. Tell the user what will happen and that they need to confirm.
- Keep answers professional but friendly. You are a landscaping business assistant.
- If you cannot determine what the user needs, ask a clarifying question in your final answer.
- When showing monetary values, format as dollars (e.g., $150.00).
- When showing dates, use a friendly format (e.g., Monday, March 21).

## Available Tools

{tools_json}
"""


# ── Argument mapping helpers ───────────────────────────────────────────────
# The LLM-facing parameter names don't always match the Python function
# signatures.  These mappers translate tool_call arguments into the kwargs
# expected by each underlying function.

def _map_args_lookup_client(args: dict) -> dict:
    """entity_tools.lookup_client(name_or_search, auth_token)"""
    return {"name_or_search": args.get("query", "")}


def _map_args_lookup_property(args: dict) -> dict:
    """entity_tools.lookup_property(address_fragment, auth_token)"""
    return {"address_fragment": args.get("address", "")}


def _map_args_lookup_job(args: dict) -> dict:
    """entity_tools.lookup_job(job_id, search, client_id, auth_token)"""
    query = args.get("query", "")
    # Heuristic: if the query looks like an ID (UUID or short alphanum), use job_id
    if len(query) > 8 and "-" in query:
        return {"job_id": query}
    return {"search": query}


def _map_args_lookup_quote(args: dict) -> dict:
    """entity_tools.lookup_quote(quote_id, client_id, status, auth_token)"""
    query = args.get("query", "")
    if len(query) > 8 and "-" in query:
        return {"quote_id": query}
    return {"client_id": None, "status": None}


def _map_args_list_clients(args: dict) -> dict:
    """client_tools.get_clients(search, auth_token)"""
    return {"search": args.get("search", "")}


def _map_args_get_schedule(args: dict) -> dict:
    """schedule_tools.get_schedule(start, end, auth_token)"""
    kwargs: dict[str, Any] = {}
    if args.get("start_date"):
        try:
            kwargs["start"] = datetime.fromisoformat(args["start_date"])
        except ValueError:
            pass
    if args.get("end_date"):
        try:
            kwargs["end"] = datetime.fromisoformat(args["end_date"])
        except ValueError:
            pass
    return kwargs


def _map_args_get_service_catalog(args: dict) -> dict:
    """service_tools.get_service_catalog(category, auth_token)"""
    kwargs: dict[str, Any] = {}
    if args.get("category"):
        kwargs["category"] = args["category"]
    return kwargs


def _map_args_get_dashboard_stats(args: dict) -> dict:
    """agent_tools.get_dashboard_stats(auth_token)"""
    return {}


def _map_args_check_weather(args: dict) -> dict:
    """weather_tools.check_weather(zip_code, days, auth_token)"""
    kwargs: dict[str, Any] = {"zip_code": args.get("zip_code", "")}
    if args.get("days"):
        kwargs["days"] = int(args["days"])
    return kwargs


def _map_args_draft_quote(args: dict) -> dict:
    """quote_tools.draft_quote(client_id, title, items, property_id, notes) -- sync"""
    kwargs: dict[str, Any] = {
        "client_id": args.get("client_id", ""),
        "title": args.get("title", ""),
        "items": args.get("items", []),
    }
    if args.get("notes"):
        kwargs["notes"] = args["notes"]
    return kwargs


def _map_args_create_job(args: dict) -> dict:
    """job_tools.create_job_action(client_id, title, scheduled_start, ...)"""
    kwargs: dict[str, Any] = {
        "client_id": args.get("client_id", ""),
        "title": args.get("title", ""),
        "scheduled_start": args.get("scheduled_start", ""),
    }
    if args.get("scheduled_end"):
        kwargs["scheduled_end"] = args["scheduled_end"]
    if args.get("property_id"):
        kwargs["property_id"] = args["property_id"]
    if args.get("description"):
        kwargs["description"] = args["description"]
    return kwargs


def _map_args_mark_job_complete(args: dict) -> dict:
    """update_tools.mark_job_complete_action(job_id, job_title) -- sync"""
    return {"job_id": args.get("job_id", "")}


def _map_args_update_client(args: dict) -> dict:
    """update_tools.update_client_action(client_id, updates, client_name) -- sync"""
    return {
        "client_id": args.get("client_id", ""),
        "updates": args.get("updates", {}),
    }


def _map_args_add_line_item(args: dict) -> dict:
    """update_tools.add_line_item_action(entity_type, entity_id, description, quantity, unit_price) -- sync"""
    return {
        "entity_type": args.get("entity_type", ""),
        "entity_id": args.get("entity_id", ""),
        "description": args.get("description", ""),
        "quantity": args.get("quantity", 1),
        "unit_price": args.get("unit_price", 0),
    }


def _map_args_create_invoice(args: dict) -> dict:
    """invoice_tools.create_invoice_action(client_id, line_items, job_id, due_date, auth_token)"""
    kwargs: dict[str, Any] = {
        "client_id": args.get("client_id", ""),
        "line_items": args.get("items", []),
    }
    if args.get("due_date"):
        kwargs["due_date"] = args["due_date"]
    return kwargs


def _map_args_log_chemical(args: dict) -> dict:
    """chemical_tools.log_chemical_action(property_id, product_name, ...)"""
    kwargs: dict[str, Any] = {
        "property_id": args.get("property_id", ""),
        "product_name": args.get("product_name", ""),
    }
    if args.get("quantity_applied"):
        kwargs["area_treated_sqft"] = None  # Keep signature compat
    if args.get("notes"):
        pass  # log_chemical_action doesn't have a notes param directly
    return kwargs


def _map_args_send_notification(args: dict) -> dict:
    """agent_tools.create_notification(user_id, notification_type, title, message, ...)"""
    return {
        "user_id": "",  # Will be filled from context
        "notification_type": "REMINDER",
        "title": args.get("title", "Reminder"),
        "message": args.get("message", ""),
    }


def _map_args_analyze_lawn(args: dict) -> dict:
    """maintenance_tools.analyze_lawn_photo(image_description, auth_token)"""
    return {"image_description": args.get("image_description", "")}


def _map_args_get_treatment(args: dict) -> dict:
    """maintenance_tools.get_treatment_info(issue_name, auth_token)"""
    return {"issue_name": args.get("issue_name", "")}


def _map_args_seasonal_guide(args: dict) -> dict:
    """maintenance_tools.get_seasonal_guide(grass_type, season, auth_token)"""
    kwargs: dict[str, Any] = {}
    if args.get("grass_type"):
        kwargs["grass_type"] = args["grass_type"]
    if args.get("season"):
        kwargs["season"] = args["season"]
    return kwargs


def _map_args_log_equipment_service(args: dict) -> dict:
    """maintenance_tools.log_maintenance_via_chat(equipment_name, task_name, hours, mileage, cost, notes, auth_token)"""
    kwargs: dict[str, Any] = {
        "equipment_name": args.get("equipment_name", ""),
        "task_name": args.get("task_name", ""),
    }
    if args.get("hours"):
        kwargs["hours"] = float(args["hours"])
    if args.get("mileage"):
        kwargs["mileage"] = float(args["mileage"])
    if args.get("cost"):
        kwargs["cost"] = float(args["cost"])
    if args.get("notes"):
        kwargs["notes"] = args["notes"]
    return kwargs


def _map_args_maintenance_alerts(args: dict) -> dict:
    """maintenance_tools.get_maintenance_alerts(auth_token)"""
    return {}


def _map_args_repair_or_replace(args: dict) -> dict:
    """maintenance_tools.analyze_repair_vs_replace(equipment_id, auth_token)"""
    return {"equipment_id": args.get("equipment_id", "")}


# Master map: tool name -> argument mapper
_ARG_MAPPERS: dict[str, Callable[[dict], dict]] = {
    "lookup_client": _map_args_lookup_client,
    "lookup_property": _map_args_lookup_property,
    "lookup_job": _map_args_lookup_job,
    "lookup_quote": _map_args_lookup_quote,
    "list_clients": _map_args_list_clients,
    "get_schedule": _map_args_get_schedule,
    "get_service_catalog": _map_args_get_service_catalog,
    "get_dashboard_stats": _map_args_get_dashboard_stats,
    "check_weather": _map_args_check_weather,
    "draft_quote": _map_args_draft_quote,
    "create_job": _map_args_create_job,
    "mark_job_complete": _map_args_mark_job_complete,
    "update_client": _map_args_update_client,
    "add_line_item": _map_args_add_line_item,
    "create_invoice": _map_args_create_invoice,
    "log_chemical": _map_args_log_chemical,
    "send_notification": _map_args_send_notification,
    "analyze_lawn": _map_args_analyze_lawn,
    "get_treatment": _map_args_get_treatment,
    "seasonal_guide": _map_args_seasonal_guide,
    "log_equipment_service": _map_args_log_equipment_service,
    "maintenance_alerts": _map_args_maintenance_alerts,
    "repair_or_replace": _map_args_repair_or_replace,
}


# ── Response parsing helpers ───────────────────────────────────────────────

_TOOL_CALL_PATTERN = re.compile(
    r"<tool_call>\s*(\{.*?\})\s*</tool_call>",
    re.DOTALL,
)

_FINAL_ANSWER_PATTERN = re.compile(
    r"<final_answer>(.*?)</final_answer>",
    re.DOTALL,
)


def _parse_tool_call(text: str) -> Optional[dict]:
    """
    Extract the first <tool_call>...</tool_call> JSON block from LLM output.

    Returns:
        dict with "name" and "arguments" keys, or None if no valid tool call found.
    """
    match = _TOOL_CALL_PATTERN.search(text)
    if not match:
        return None
    try:
        call = json.loads(match.group(1))
        if "name" in call:
            call.setdefault("arguments", {})
            return call
    except json.JSONDecodeError as exc:
        log.warning("Failed to parse tool_call JSON: %s", exc)
    return None


def _parse_final_answer(text: str) -> Optional[str]:
    """
    Extract the content of the first <final_answer>...</final_answer> block.

    Returns:
        The answer string (stripped), or None if not found.
    """
    match = _FINAL_ANSWER_PATTERN.search(text)
    if match:
        return match.group(1).strip()
    return None


def _format_tool_result(result: Any) -> str:
    """
    Convert a tool function's return value into a string suitable for
    injection as an observation in the conversation.

    Handles the various return shapes:
      - (cards_list, error_str) tuples from entity_tools
      - plain dicts (pending actions, stats)
      - lists (client lists, schedule lists, service catalogs)
      - strings
    """
    if result is None:
        return "No result returned."

    # entity_tools return (cards_or_none, error_or_none) tuples
    if isinstance(result, tuple) and len(result) == 2:
        cards, error = result
        if error and not cards:
            return f"Error: {error}"
        parts = []
        if error:
            parts.append(error)
        if cards:
            parts.append(json.dumps(cards, indent=2, default=str))
        return "\n".join(parts) if parts else "No results."

    if isinstance(result, dict):
        return json.dumps(result, indent=2, default=str)

    if isinstance(result, list):
        return json.dumps(result, indent=2, default=str)

    return str(result)


def _extract_structured_data(result: Any) -> dict:
    """
    Pull entity_cards, pending_action, and batch_actions out of a tool result
    so they can be accumulated across iterations.

    Returns a dict with optional keys: entity_cards, pending_action, batch_actions.
    """
    extracted: dict[str, Any] = {}

    # entity_tools return (cards_or_none, error_or_none)
    if isinstance(result, tuple) and len(result) == 2:
        cards, _error = result
        if cards and isinstance(cards, list):
            extracted["entity_cards"] = cards
        return extracted

    if isinstance(result, dict):
        # Tools returning structured dicts
        if result.get("entity_cards"):
            extracted["entity_cards"] = result["entity_cards"]
        # Pending actions come from tools that build PendingAction dicts
        if result.get("type") and result.get("payload"):
            extracted["pending_action"] = result
        if result.get("pending_action"):
            extracted["pending_action"] = result["pending_action"]
        if result.get("batch_actions"):
            extracted["batch_actions"] = result["batch_actions"]
        if result.get("result"):
            # Some tools wrap everything in a {result, entity_cards, pending_action} envelope
            if isinstance(result["result"], dict) and result["result"].get("type"):
                extracted["pending_action"] = result["result"]

    return extracted


# ── ReAct Engine ───────────────────────────────────────────────────────────

class ReActEngine:
    """
    ReAct (Reason + Act) agent engine for AgenticMeadows.

    Orchestrates a multi-turn loop where an LLM reasons about a user query,
    calls tools to fetch or mutate data, observes results, and produces a
    final natural-language answer along with any entity cards or pending
    actions for the frontend to render.
    """

    def __init__(
        self,
        generate_fn: Callable[[list[dict]], Awaitable[str]],
        auth_token: str = "",
        context: Optional[dict] = None,
    ):
        """
        Initialize the ReAct engine.

        Args:
            generate_fn: Async callable that takes a list of message dicts
                         (each with 'role' and 'content') and returns the
                         LLM's response as a string.  This callback is
                         provided by main.py and abstracts Ollama vs NVIDIA.
            auth_token:  Bearer token forwarded to backend API calls.
            context:     Optional dict with keys like client_id, job_id,
                         property_id, zip_code, user_id representing the
                         user's current navigation state in the frontend.
        """
        self._generate = generate_fn
        self._auth_token = auth_token
        self._context = context or {}

    # ── Public API ─────────────────────────────────────────────────────

    async def run(self, user_message: str, conversation_id: str = "") -> dict:
        """
        Execute the ReAct loop for a single user turn.

        Args:
            user_message:    The raw text message from the user.
            conversation_id: An opaque ID for logging/tracing.

        Returns:
            {
                "reply": str,                       # Final text response
                "entities": list[dict],             # Entity cards to show in chat
                "pending_action": dict | None,      # Single pending action
                "batch_actions": list[dict] | None, # Multiple pending actions
                "tool_calls": list[dict],           # Audit log of tools called
                "iterations": int,                  # How many ReAct loops ran
            }
        """
        log.info(
            "[ReAct:%s] Starting run | message=%r",
            conversation_id,
            user_message[:120],
        )

        system_prompt = _build_system_prompt(self._context)

        messages: list[dict] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        # Accumulators across iterations
        all_entities: list[dict] = []
        all_pending_actions: list[dict] = []
        tool_call_log: list[dict] = []
        final_reply: Optional[str] = None

        for iteration in range(1, MAX_ITERATIONS + 1):
            log.info("[ReAct:%s] Iteration %d", conversation_id, iteration)

            # ── Think + Act: send to LLM ──────────────────────────────
            try:
                llm_output = await self._generate(messages)
            except Exception:
                log.error(
                    "[ReAct:%s] LLM generation failed:\n%s",
                    conversation_id,
                    traceback.format_exc(),
                )
                final_reply = (
                    "I'm sorry, I encountered an error processing your request. "
                    "Please try again in a moment."
                )
                break

            log.debug(
                "[ReAct:%s] LLM output (iter %d): %s",
                conversation_id,
                iteration,
                llm_output[:500],
            )

            # ── Check for final answer first ──────────────────────────
            answer = _parse_final_answer(llm_output)
            if answer is not None:
                final_reply = answer
                log.info(
                    "[ReAct:%s] Final answer received at iteration %d",
                    conversation_id,
                    iteration,
                )
                break

            # ── Check for tool call ───────────────────────────────────
            tool_call = _parse_tool_call(llm_output)

            if tool_call is None:
                # Graceful fallback: no tags found, treat entire output as
                # the final answer.  This handles models that don't follow
                # the formatting perfectly.
                final_reply = llm_output.strip()
                log.info(
                    "[ReAct:%s] No tool_call or final_answer tags; "
                    "using raw output as final answer (iter %d)",
                    conversation_id,
                    iteration,
                )
                break

            tool_name = tool_call["name"]
            tool_args = tool_call.get("arguments", {})

            log.info(
                "[ReAct:%s] Tool call: %s(%s)",
                conversation_id,
                tool_name,
                json.dumps(tool_args, default=str)[:200],
            )

            # Append the assistant's reasoning/tool-call to the conversation
            messages.append({"role": "assistant", "content": llm_output})

            # ── Observe: execute the tool ─────────────────────────────
            try:
                result = await self._call_tool(tool_name, tool_args)
            except Exception as exc:
                log.error(
                    "[ReAct:%s] Tool %s raised: %s\n%s",
                    conversation_id,
                    tool_name,
                    exc,
                    traceback.format_exc(),
                )
                result = f"Tool error: {exc}"

            # Record for audit
            tool_call_log.append({
                "tool": tool_name,
                "arguments": tool_args,
                "iteration": iteration,
            })

            # Extract structured data (entity cards, pending actions)
            structured = _extract_structured_data(result)
            if structured.get("entity_cards"):
                all_entities.extend(structured["entity_cards"])
            if structured.get("pending_action"):
                all_pending_actions.append(structured["pending_action"])
            if structured.get("batch_actions"):
                all_pending_actions.extend(structured["batch_actions"])

            # Format observation for the LLM
            observation_text = _format_tool_result(result)
            messages.append({
                "role": "user",
                "content": f"[Observation from {tool_name}]\n{observation_text}",
            })

        else:
            # Exhausted MAX_ITERATIONS without a final answer
            log.warning(
                "[ReAct:%s] Hit max iterations (%d) without final answer",
                conversation_id,
                MAX_ITERATIONS,
            )
            # Try to salvage: ask the LLM to wrap up
            messages.append({
                "role": "user",
                "content": (
                    "You have reached the maximum number of tool calls. "
                    "Please provide your best final answer now based on "
                    "the information gathered so far."
                ),
            })
            try:
                wrap_up = await self._generate(messages)
                answer = _parse_final_answer(wrap_up)
                final_reply = answer if answer else wrap_up.strip()
            except Exception:
                final_reply = (
                    "I gathered some information but ran into a limit. "
                    "Here's what I found so far -- please try a more "
                    "specific question if you need more details."
                )

        # ── Build return payload ──────────────────────────────────────
        # Determine single pending_action vs batch_actions
        pending_action: Optional[dict] = None
        batch_actions: Optional[list[dict]] = None

        if len(all_pending_actions) == 1:
            pending_action = all_pending_actions[0]
        elif len(all_pending_actions) > 1:
            batch_actions = all_pending_actions

        result_payload = {
            "reply": final_reply or "",
            "entities": all_entities,
            "pending_action": pending_action,
            "batch_actions": batch_actions,
            "tool_calls": tool_call_log,
            "iterations": min(iteration, MAX_ITERATIONS),
        }

        log.info(
            "[ReAct:%s] Complete | iterations=%d tools=%d entities=%d "
            "pending_actions=%d",
            conversation_id,
            result_payload["iterations"],
            len(tool_call_log),
            len(all_entities),
            len(all_pending_actions),
        )

        return result_payload

    # ── Tool execution layer ───────────────────────────────────────────

    async def _call_tool(self, tool_name: str, arguments: dict) -> Any:
        """
        Look up a tool by name, map LLM arguments to function kwargs,
        and execute it.

        Args:
            tool_name:  Name of the tool (key in TOOL_REGISTRY).
            arguments:  Raw argument dict from the LLM's <tool_call> JSON.

        Returns:
            The tool function's return value (shape varies by tool).

        Raises:
            ValueError: If the tool name is not in the registry.
            Exception:  Propagated from the underlying tool function.
        """
        if tool_name not in TOOL_REGISTRY:
            raise ValueError(f"Unknown tool: {tool_name}")

        registry_entry = TOOL_REGISTRY[tool_name]
        func_key = registry_entry["function"]

        func = _FUNCTION_MAP.get(func_key)
        if func is None:
            raise ValueError(
                f"Tool '{tool_name}' references unregistered function '{func_key}'"
            )

        # Map LLM-facing arguments to Python function kwargs
        mapper = _ARG_MAPPERS.get(tool_name)
        if mapper:
            kwargs = mapper(arguments)
        else:
            # Fallback: pass arguments through as-is
            kwargs = dict(arguments)

        # Inject auth_token for tools that accept it.
        # Sync tools that build PendingAction dicts generally don't need it
        # (the actual execution happens later in confirm_action), but some
        # still accept it for signature consistency.
        if tool_name not in _SYNC_TOOLS:
            kwargs["auth_token"] = self._auth_token

        # Inject context-derived values for tools that need them
        if tool_name == "send_notification" and not kwargs.get("user_id"):
            kwargs["user_id"] = self._context.get("user_id", "")

        # Call the function
        if tool_name in _SYNC_TOOLS:
            result = func(**kwargs)
        else:
            result = await func(**kwargs)

        return result
