"""
AgenticMeadows MCP Server
Stdio-based MCP server exposing AgenticMeadows platform tools to OpenClaw.
"""

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import httpx
import os
import json

BACKEND_URL = os.getenv("AGENTICMEADOWS_BACKEND_URL", "http://backend:4000")
AUTH_TOKEN = os.getenv("AGENTICMEADOWS_AUTH_TOKEN", "")

server = Server("agenticmeadows")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _headers() -> dict:
    h = {"Content-Type": "application/json"}
    if AUTH_TOKEN:
        h["Authorization"] = f"Bearer {AUTH_TOKEN}"
    return h


def _text(content: str) -> list[TextContent]:
    return [TextContent(type="text", text=content)]


def _error(msg: str) -> list[TextContent]:
    return _text(f"**Error:** {msg}")


def _pending_action(action_type: str, description: str, payload: dict, total: float | None = None) -> list[TextContent]:
    action = {
        "type": action_type,
        "description": description,
        "payload": payload,
    }
    if total is not None:
        action["total"] = total
    return _text(json.dumps({"type": "PENDING_ACTION", "action": action}, indent=2))


# ---------------------------------------------------------------------------
# READ formatters
# ---------------------------------------------------------------------------

def _fmt_client(c: dict) -> str:
    name = c.get("name", "Unknown")
    email = c.get("email", "N/A")
    phone = c.get("phone", "N/A")
    props = c.get("properties_count", c.get("properties", 0))
    if isinstance(props, list):
        props = len(props)
    notes = c.get("notes", "")
    lines = [
        f"### {name}",
        f"- **Email:** {email}",
        f"- **Phone:** {phone}",
        f"- **Properties:** {props}",
    ]
    if notes:
        lines.append(f"- **Notes:** {notes}")
    client_id = c.get("id") or c.get("_id")
    if client_id:
        lines.insert(1, f"- **ID:** {client_id}")
    return "\n".join(lines)


def _fmt_clients(clients: list[dict]) -> str:
    if not clients:
        return "No clients found."
    return "\n\n".join(_fmt_client(c) for c in clients)


def _fmt_property(p: dict) -> str:
    address = p.get("address", "Unknown address")
    client = p.get("client_name") or p.get("client", {}).get("name", "N/A")
    size = p.get("lot_size", "N/A")
    prop_id = p.get("id") or p.get("_id", "")
    lines = [
        f"### {address}",
        f"- **ID:** {prop_id}",
        f"- **Client:** {client}",
        f"- **Lot size:** {size}",
    ]
    notes = p.get("notes", "")
    if notes:
        lines.append(f"- **Notes:** {notes}")
    return "\n".join(lines)


def _fmt_job(j: dict) -> str:
    title = j.get("title", "Untitled job")
    status = j.get("status", "N/A")
    client = j.get("client_name") or j.get("client", {}).get("name", "N/A")
    scheduled = j.get("scheduled_start", "N/A")
    job_id = j.get("id") or j.get("_id", "")
    lines = [
        f"### {title}",
        f"- **ID:** {job_id}",
        f"- **Client:** {client}",
        f"- **Status:** {status}",
        f"- **Scheduled:** {scheduled}",
    ]
    notes = j.get("notes", "")
    if notes:
        lines.append(f"- **Notes:** {notes}")
    return "\n".join(lines)


def _fmt_quote(q: dict) -> str:
    title = q.get("title", "Untitled quote")
    status = q.get("status", "N/A")
    client = q.get("client_name") or q.get("client", {}).get("name", "N/A")
    total = q.get("total", 0)
    quote_id = q.get("id") or q.get("_id", "")
    lines = [
        f"### {title}",
        f"- **ID:** {quote_id}",
        f"- **Client:** {client}",
        f"- **Status:** {status}",
        f"- **Total:** ${total:,.2f}",
    ]
    items = q.get("items", [])
    if items:
        lines.append("- **Line items:**")
        for item in items:
            desc = item.get("description", "")
            qty = item.get("quantity", 1)
            price = item.get("unit_price", 0)
            lines.append(f"  - {desc} (x{qty}) @ ${price:,.2f}")
    return "\n".join(lines)


def _fmt_schedule_entry(s: dict) -> str:
    date = s.get("date", s.get("scheduled_start", "N/A"))
    time_str = s.get("time", "")
    title = s.get("title", "Untitled")
    client = s.get("client_name") or s.get("client", {}).get("name", "N/A")
    status = s.get("status", "N/A")
    when = f"{date} {time_str}".strip()
    return f"| {when} | {title} | {client} | {status} |"


def _fmt_weather_day(d: dict) -> str:
    date = d.get("date", "N/A")
    high = d.get("high", d.get("temp_high", "N/A"))
    low = d.get("low", d.get("temp_low", "N/A"))
    conditions = d.get("conditions", d.get("description", "N/A"))
    precip = d.get("precipitation_chance", d.get("precip", "N/A"))
    if isinstance(precip, (int, float)):
        precip = f"{precip}%"
    return f"| {date} | {high}F / {low}F | {conditions} | {precip} |"


# ---------------------------------------------------------------------------
# Tool definitions
# ---------------------------------------------------------------------------

TOOLS = [
    # --- READ tools ---
    Tool(
        name="lookup_client",
        description="Look up a client by name, email, or phone number. Returns client details including properties count and notes.",
        inputSchema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Client name, email, or phone number to search for"}
            },
            "required": ["query"],
        },
    ),
    Tool(
        name="lookup_property",
        description="Fuzzy search for a property by address. Returns property details including client and lot size.",
        inputSchema={
            "type": "object",
            "properties": {
                "address": {"type": "string", "description": "Full or partial property address to search for"}
            },
            "required": ["address"],
        },
    ),
    Tool(
        name="lookup_job",
        description="Find a job by its ID or by a search query. Returns job details including status and schedule.",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Job ID (if known)"},
                "query": {"type": "string", "description": "Search text to find jobs"},
            },
        },
    ),
    Tool(
        name="lookup_quote",
        description="Find a quote by its ID or by a search query. Returns quote details including line items and total.",
        inputSchema={
            "type": "object",
            "properties": {
                "id": {"type": "string", "description": "Quote ID (if known)"},
                "query": {"type": "string", "description": "Search text to find quotes"},
            },
        },
    ),
    Tool(
        name="list_clients",
        description="List all clients, optionally filtered by a search string. Returns a summary of each client.",
        inputSchema={
            "type": "object",
            "properties": {
                "search": {"type": "string", "description": "Optional filter text", "default": ""},
            },
        },
    ),
    Tool(
        name="get_schedule",
        description="Get scheduled jobs for a date range. Returns a table of upcoming work.",
        inputSchema={
            "type": "object",
            "properties": {
                "start": {"type": "string", "description": "Start date (YYYY-MM-DD)"},
                "end": {"type": "string", "description": "End date (YYYY-MM-DD)"},
            },
            "required": ["start", "end"],
        },
    ),
    Tool(
        name="get_service_catalog",
        description="Get available services and pricing from the service catalog, optionally filtered by category.",
        inputSchema={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "Service category to filter by (e.g. 'mowing', 'fertilization')", "default": ""},
            },
        },
    ),
    Tool(
        name="get_dashboard_stats",
        description="Get dashboard statistics: revenue summary, job counts, and overdue invoices.",
        inputSchema={
            "type": "object",
            "properties": {},
        },
    ),
    Tool(
        name="check_weather",
        description="Get weather forecast for a zip code. Returns daily high/low, conditions, and precipitation chance.",
        inputSchema={
            "type": "object",
            "properties": {
                "zip": {"type": "string", "description": "5-digit ZIP code"},
                "days": {"type": "integer", "description": "Number of forecast days (default 3)", "default": 3},
            },
            "required": ["zip"],
        },
    ),
    # --- WRITE tools (return PendingAction) ---
    Tool(
        name="draft_quote",
        description="Draft a new quote for a client. Returns a pending action for user confirmation before creating.",
        inputSchema={
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "Client ID"},
                "title": {"type": "string", "description": "Quote title (e.g. 'Spring Cleanup')"},
                "items": {
                    "type": "array",
                    "description": "Line items for the quote",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "quantity": {"type": "number"},
                            "unit_price": {"type": "number"},
                        },
                        "required": ["description", "quantity", "unit_price"],
                    },
                },
                "notes": {"type": "string", "description": "Optional notes for the quote", "default": ""},
            },
            "required": ["client_id", "title", "items"],
        },
    ),
    Tool(
        name="create_job",
        description="Schedule a new job. Returns a pending action for user confirmation before creating.",
        inputSchema={
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "Client ID"},
                "property_id": {"type": "string", "description": "Property ID"},
                "title": {"type": "string", "description": "Job title"},
                "scheduled_start": {"type": "string", "description": "Start date/time (ISO 8601)"},
                "scheduled_end": {"type": "string", "description": "End date/time (ISO 8601)"},
                "notes": {"type": "string", "description": "Optional job notes", "default": ""},
            },
            "required": ["client_id", "property_id", "title", "scheduled_start"],
        },
    ),
    Tool(
        name="mark_job_complete",
        description="Mark a job as completed. Returns a pending action for user confirmation.",
        inputSchema={
            "type": "object",
            "properties": {
                "job_id": {"type": "string", "description": "Job ID to mark complete"},
            },
            "required": ["job_id"],
        },
    ),
    Tool(
        name="update_client",
        description="Update client information. Returns a pending action for user confirmation before saving.",
        inputSchema={
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "Client ID"},
                "updates": {
                    "type": "object",
                    "description": "Fields to update (e.g. name, email, phone, notes)",
                    "properties": {
                        "name": {"type": "string"},
                        "email": {"type": "string"},
                        "phone": {"type": "string"},
                        "notes": {"type": "string"},
                    },
                },
            },
            "required": ["client_id", "updates"],
        },
    ),
    Tool(
        name="add_line_item",
        description="Add a line item to a quote or invoice. Returns a pending action for user confirmation.",
        inputSchema={
            "type": "object",
            "properties": {
                "entity_type": {"type": "string", "description": "'quote' or 'invoice'", "enum": ["quote", "invoice"]},
                "entity_id": {"type": "string", "description": "Quote or invoice ID"},
                "description": {"type": "string", "description": "Line item description"},
                "quantity": {"type": "number", "description": "Quantity"},
                "unit_price": {"type": "number", "description": "Unit price in dollars"},
            },
            "required": ["entity_type", "entity_id", "description", "quantity", "unit_price"],
        },
    ),
    Tool(
        name="create_invoice",
        description="Create a new invoice for a client. Returns a pending action for user confirmation.",
        inputSchema={
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "Client ID"},
                "items": {
                    "type": "array",
                    "description": "Invoice line items",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "quantity": {"type": "number"},
                            "unit_price": {"type": "number"},
                        },
                        "required": ["description", "quantity", "unit_price"],
                    },
                },
                "due_date": {"type": "string", "description": "Due date (YYYY-MM-DD)"},
            },
            "required": ["client_id", "items", "due_date"],
        },
    ),
    Tool(
        name="log_chemical",
        description="Log a chemical/product application to a property. Returns a pending action for user confirmation.",
        inputSchema={
            "type": "object",
            "properties": {
                "property_id": {"type": "string", "description": "Property ID"},
                "product_name": {"type": "string", "description": "Product/chemical name"},
                "quantity_applied": {"type": "string", "description": "Amount applied (e.g. '2 lbs', '1.5 gal')"},
                "notes": {"type": "string", "description": "Application notes", "default": ""},
            },
            "required": ["property_id", "product_name", "quantity_applied"],
        },
    ),
    # --- Notification tool ---
    Tool(
        name="send_notification",
        description="Send a notification to a user or client. This is sent immediately without confirmation.",
        inputSchema={
            "type": "object",
            "properties": {
                "recipient_id": {"type": "string", "description": "User or client ID to notify"},
                "message": {"type": "string", "description": "Notification message"},
                "channel": {"type": "string", "description": "Delivery channel", "enum": ["email", "sms", "in_app"], "default": "in_app"},
            },
            "required": ["recipient_id", "message"],
        },
    ),
]


# ---------------------------------------------------------------------------
# List tools handler
# ---------------------------------------------------------------------------

@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


# ---------------------------------------------------------------------------
# Call tool handler
# ---------------------------------------------------------------------------

@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    try:
        # ----- READ tools -----
        if name == "lookup_client":
            return await _handle_lookup_client(arguments)
        elif name == "lookup_property":
            return await _handle_lookup_property(arguments)
        elif name == "lookup_job":
            return await _handle_lookup_job(arguments)
        elif name == "lookup_quote":
            return await _handle_lookup_quote(arguments)
        elif name == "list_clients":
            return await _handle_list_clients(arguments)
        elif name == "get_schedule":
            return await _handle_get_schedule(arguments)
        elif name == "get_service_catalog":
            return await _handle_get_service_catalog(arguments)
        elif name == "get_dashboard_stats":
            return await _handle_get_dashboard_stats(arguments)
        elif name == "check_weather":
            return await _handle_check_weather(arguments)
        # ----- WRITE tools -----
        elif name == "draft_quote":
            return _handle_draft_quote(arguments)
        elif name == "create_job":
            return _handle_create_job(arguments)
        elif name == "mark_job_complete":
            return _handle_mark_job_complete(arguments)
        elif name == "update_client":
            return _handle_update_client(arguments)
        elif name == "add_line_item":
            return _handle_add_line_item(arguments)
        elif name == "create_invoice":
            return _handle_create_invoice(arguments)
        elif name == "log_chemical":
            return _handle_log_chemical(arguments)
        # ----- Notification -----
        elif name == "send_notification":
            return await _handle_send_notification(arguments)
        else:
            return _error(f"Unknown tool: {name}")
    except httpx.HTTPStatusError as exc:
        return _error(f"Backend returned {exc.response.status_code}: {exc.response.text[:500]}")
    except httpx.RequestError as exc:
        return _error(f"Could not reach backend: {exc}")
    except Exception as exc:
        return _error(f"Unexpected error: {exc}")


# ---------------------------------------------------------------------------
# READ tool handlers
# ---------------------------------------------------------------------------

async def _handle_lookup_client(args: dict) -> list[TextContent]:
    query = args.get("query", "")
    if not query:
        return _error("A search query is required.")
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.get("/api/clients", params={"search": query})
        resp.raise_for_status()
    data = resp.json()
    clients = data if isinstance(data, list) else data.get("data", data.get("clients", []))
    if not clients:
        return _text(f"No clients found matching **{query}**.")
    return _text(f"## Client search: {query}\n\n{_fmt_clients(clients)}")


async def _handle_lookup_property(args: dict) -> list[TextContent]:
    address = args.get("address", "")
    if not address:
        return _error("An address is required.")
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.get("/api/properties/search", params={"q": address})
        resp.raise_for_status()
    data = resp.json()
    props = data if isinstance(data, list) else data.get("data", data.get("properties", []))
    if not props:
        return _text(f"No properties found matching **{address}**.")
    formatted = "\n\n".join(_fmt_property(p) for p in props)
    return _text(f"## Property search: {address}\n\n{formatted}")


async def _handle_lookup_job(args: dict) -> list[TextContent]:
    job_id = args.get("id")
    query = args.get("query")
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        if job_id:
            resp = await client.get(f"/api/jobs/{job_id}")
        elif query:
            resp = await client.get("/api/jobs", params={"search": query})
        else:
            return _error("Provide either an id or a search query.")
        resp.raise_for_status()
    data = resp.json()
    if job_id:
        return _text(f"## Job details\n\n{_fmt_job(data if not data.get('data') else data['data'])}")
    jobs = data if isinstance(data, list) else data.get("data", data.get("jobs", []))
    if not jobs:
        return _text(f"No jobs found matching **{query}**.")
    formatted = "\n\n".join(_fmt_job(j) for j in jobs)
    return _text(f"## Job search: {query}\n\n{formatted}")


async def _handle_lookup_quote(args: dict) -> list[TextContent]:
    quote_id = args.get("id")
    query = args.get("query")
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        if quote_id:
            resp = await client.get(f"/api/quotes/{quote_id}")
        elif query:
            resp = await client.get("/api/quotes", params={"search": query})
        else:
            return _error("Provide either an id or a search query.")
        resp.raise_for_status()
    data = resp.json()
    if quote_id:
        return _text(f"## Quote details\n\n{_fmt_quote(data if not data.get('data') else data['data'])}")
    quotes = data if isinstance(data, list) else data.get("data", data.get("quotes", []))
    if not quotes:
        return _text(f"No quotes found matching **{query}**.")
    formatted = "\n\n".join(_fmt_quote(q) for q in quotes)
    return _text(f"## Quote search: {query}\n\n{formatted}")


async def _handle_list_clients(args: dict) -> list[TextContent]:
    search = args.get("search", "")
    params = {}
    if search:
        params["search"] = search
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.get("/api/clients", params=params)
        resp.raise_for_status()
    data = resp.json()
    clients = data if isinstance(data, list) else data.get("data", data.get("clients", []))
    header = f"## Clients (filtered: {search})" if search else "## All clients"
    return _text(f"{header}\n\n{_fmt_clients(clients)}")


async def _handle_get_schedule(args: dict) -> list[TextContent]:
    start = args.get("start", "")
    end = args.get("end", "")
    if not start or not end:
        return _error("Both start and end dates are required (YYYY-MM-DD).")
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.get("/api/schedule", params={"start": start, "end": end})
        resp.raise_for_status()
    data = resp.json()
    entries = data if isinstance(data, list) else data.get("data", data.get("schedule", []))
    if not entries:
        return _text(f"No scheduled jobs between **{start}** and **{end}**.")
    header = f"## Schedule: {start} to {end}\n\n| Date/Time | Job | Client | Status |\n|---|---|---|---|"
    rows = "\n".join(_fmt_schedule_entry(e) for e in entries)
    return _text(f"{header}\n{rows}")


async def _handle_get_service_catalog(args: dict) -> list[TextContent]:
    category = args.get("category", "")
    params = {}
    if category:
        params["category"] = category
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.get("/api/services", params=params)
        resp.raise_for_status()
    data = resp.json()
    services = data if isinstance(data, list) else data.get("data", data.get("services", []))
    if not services:
        return _text("No services found." + (f" (category: {category})" if category else ""))
    lines = []
    for svc in services:
        name = svc.get("name", "Unnamed")
        price = svc.get("price", svc.get("base_price", "N/A"))
        unit = svc.get("unit", "")
        cat = svc.get("category", "")
        price_str = f"${price:,.2f}" if isinstance(price, (int, float)) else str(price)
        desc = svc.get("description", "")
        line = f"- **{name}** {f'({cat})' if cat else ''} -- {price_str}{f' / {unit}' if unit else ''}"
        if desc:
            line += f"\n  {desc}"
        lines.append(line)
    header = "## Service catalog"
    if category:
        header += f" ({category})"
    return _text(f"{header}\n\n" + "\n".join(lines))


async def _handle_get_dashboard_stats(args: dict) -> list[TextContent]:
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.get("/api/dashboard/stats")
        resp.raise_for_status()
    data = resp.json()
    stats = data if not data.get("data") else data["data"]

    revenue = stats.get("revenue", {})
    jobs = stats.get("jobs", {})
    invoices = stats.get("invoices", {})

    lines = ["## Dashboard Stats", ""]

    # Revenue
    lines.append("### Revenue")
    if isinstance(revenue, dict):
        for key, val in revenue.items():
            label = key.replace("_", " ").title()
            if isinstance(val, (int, float)):
                lines.append(f"- **{label}:** ${val:,.2f}")
            else:
                lines.append(f"- **{label}:** {val}")
    elif isinstance(revenue, (int, float)):
        lines.append(f"- **Total:** ${revenue:,.2f}")

    # Jobs
    lines.append("")
    lines.append("### Jobs")
    if isinstance(jobs, dict):
        for key, val in jobs.items():
            label = key.replace("_", " ").title()
            lines.append(f"- **{label}:** {val}")
    elif isinstance(jobs, (int, float)):
        lines.append(f"- **Total:** {jobs}")

    # Invoices
    lines.append("")
    lines.append("### Invoices")
    if isinstance(invoices, dict):
        for key, val in invoices.items():
            label = key.replace("_", " ").title()
            if isinstance(val, (int, float)) and "amount" in key.lower():
                lines.append(f"- **{label}:** ${val:,.2f}")
            else:
                lines.append(f"- **{label}:** {val}")
    elif isinstance(invoices, (int, float)):
        lines.append(f"- **Overdue:** {invoices}")

    return _text("\n".join(lines))


async def _handle_check_weather(args: dict) -> list[TextContent]:
    zip_code = args.get("zip", "")
    days = args.get("days", 3)
    if not zip_code:
        return _error("A ZIP code is required.")
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.get("/api/weather", params={"zip": zip_code, "days": days})
        resp.raise_for_status()
    data = resp.json()
    forecast = data if isinstance(data, list) else data.get("data", data.get("forecast", []))
    if not forecast:
        return _text(f"No weather data available for **{zip_code}**.")
    header = f"## Weather forecast for {zip_code} ({days} days)\n\n| Date | Temp | Conditions | Precip |\n|---|---|---|---|"
    rows = "\n".join(_fmt_weather_day(d) for d in forecast)
    return _text(f"{header}\n{rows}")


# ---------------------------------------------------------------------------
# WRITE tool handlers (return PendingAction JSON, no API calls)
# ---------------------------------------------------------------------------

def _handle_draft_quote(args: dict) -> list[TextContent]:
    client_id = args.get("client_id", "")
    title = args.get("title", "")
    items = args.get("items", [])
    notes = args.get("notes", "")
    if not client_id or not title or not items:
        return _error("client_id, title, and items are required.")
    total = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
    payload = {
        "client_id": client_id,
        "title": title,
        "items": items,
        "notes": notes,
    }
    return _pending_action(
        "CREATE_QUOTE",
        f"Draft quote: {title}",
        payload,
        total=total,
    )


def _handle_create_job(args: dict) -> list[TextContent]:
    required = ["client_id", "property_id", "title", "scheduled_start"]
    for field in required:
        if not args.get(field):
            return _error(f"{field} is required.")
    payload = {
        "client_id": args["client_id"],
        "property_id": args["property_id"],
        "title": args["title"],
        "scheduled_start": args["scheduled_start"],
    }
    if args.get("scheduled_end"):
        payload["scheduled_end"] = args["scheduled_end"]
    if args.get("notes"):
        payload["notes"] = args["notes"]
    return _pending_action(
        "CREATE_JOB",
        f"Create job: {args['title']}",
        payload,
    )


def _handle_mark_job_complete(args: dict) -> list[TextContent]:
    job_id = args.get("job_id", "")
    if not job_id:
        return _error("job_id is required.")
    return _pending_action(
        "MARK_JOB_COMPLETE",
        f"Mark job {job_id} as complete",
        {"job_id": job_id},
    )


def _handle_update_client(args: dict) -> list[TextContent]:
    client_id = args.get("client_id", "")
    updates = args.get("updates", {})
    if not client_id or not updates:
        return _error("client_id and updates are required.")
    fields = ", ".join(updates.keys())
    return _pending_action(
        "UPDATE_CLIENT",
        f"Update client {client_id}: {fields}",
        {"client_id": client_id, "updates": updates},
    )


def _handle_add_line_item(args: dict) -> list[TextContent]:
    required = ["entity_type", "entity_id", "description", "quantity", "unit_price"]
    for field in required:
        if args.get(field) is None:
            return _error(f"{field} is required.")
    line_total = args["quantity"] * args["unit_price"]
    payload = {
        "entity_type": args["entity_type"],
        "entity_id": args["entity_id"],
        "description": args["description"],
        "quantity": args["quantity"],
        "unit_price": args["unit_price"],
    }
    return _pending_action(
        "ADD_LINE_ITEM",
        f"Add line item to {args['entity_type']} {args['entity_id']}: {args['description']}",
        payload,
        total=line_total,
    )


def _handle_create_invoice(args: dict) -> list[TextContent]:
    client_id = args.get("client_id", "")
    items = args.get("items", [])
    due_date = args.get("due_date", "")
    if not client_id or not items or not due_date:
        return _error("client_id, items, and due_date are required.")
    total = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
    payload = {
        "client_id": client_id,
        "items": items,
        "due_date": due_date,
    }
    return _pending_action(
        "CREATE_INVOICE",
        f"Create invoice for client {client_id}, due {due_date}",
        payload,
        total=total,
    )


def _handle_log_chemical(args: dict) -> list[TextContent]:
    required = ["property_id", "product_name", "quantity_applied"]
    for field in required:
        if not args.get(field):
            return _error(f"{field} is required.")
    payload = {
        "property_id": args["property_id"],
        "product_name": args["product_name"],
        "quantity_applied": args["quantity_applied"],
    }
    if args.get("notes"):
        payload["notes"] = args["notes"]
    return _pending_action(
        "LOG_CHEMICAL",
        f"Log application: {args['product_name']} ({args['quantity_applied']}) at property {args['property_id']}",
        payload,
    )


# ---------------------------------------------------------------------------
# Notification handler (direct POST, no confirmation)
# ---------------------------------------------------------------------------

async def _handle_send_notification(args: dict) -> list[TextContent]:
    recipient_id = args.get("recipient_id", "")
    message = args.get("message", "")
    channel = args.get("channel", "in_app")
    if not recipient_id or not message:
        return _error("recipient_id and message are required.")
    body = {
        "recipient_id": recipient_id,
        "message": message,
        "channel": channel,
    }
    async with httpx.AsyncClient(base_url=BACKEND_URL, headers=_headers(), timeout=15) as client:
        resp = await client.post("/api/notifications", json=body)
        resp.raise_for_status()
    return _text(f"Notification sent to **{recipient_id}** via **{channel}**.")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
