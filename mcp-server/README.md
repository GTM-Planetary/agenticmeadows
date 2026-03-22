# AgenticMeadows MCP Server

Stdio-based MCP server that exposes AgenticMeadows platform tools to OpenClaw.

## Setup

```bash
cd mcp-server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `AGENTICMEADOWS_BACKEND_URL` | Backend API base URL | `http://backend:4000` |
| `AGENTICMEADOWS_AUTH_TOKEN` | Bearer token for API auth | (empty) |

## Running

OpenClaw spawns this as a child process via stdio:

```bash
AGENTICMEADOWS_BACKEND_URL=http://localhost:4000 \
AGENTICMEADOWS_AUTH_TOKEN=your-token \
python server.py
```

## OpenClaw MCP Config

Add to your OpenClaw MCP configuration:

```json
{
  "mcpServers": {
    "agenticmeadows": {
      "command": "python",
      "args": ["path/to/mcp-server/server.py"],
      "env": {
        "AGENTICMEADOWS_BACKEND_URL": "http://localhost:4000",
        "AGENTICMEADOWS_AUTH_TOKEN": "your-token"
      }
    }
  }
}
```

## Tools

**Read tools** (call the backend API and return formatted data):
- `lookup_client` - Search clients by name, email, or phone
- `lookup_property` - Fuzzy search properties by address
- `lookup_job` - Find a job by ID or search query
- `lookup_quote` - Find a quote by ID or search query
- `list_clients` - List all or filtered clients
- `get_schedule` - Get scheduled jobs for a date range
- `get_service_catalog` - Get available services and pricing
- `get_dashboard_stats` - Revenue, job counts, overdue invoices
- `check_weather` - Weather forecast by zip code

**Write tools** (return PendingAction JSON for frontend confirmation):
- `draft_quote` - Draft a new quote
- `create_job` - Schedule a new job
- `mark_job_complete` - Mark a job as completed
- `update_client` - Update client information
- `add_line_item` - Add a line item to a quote or invoice
- `create_invoice` - Create a new invoice
- `log_chemical` - Log a chemical application

**Notification:**
- `send_notification` - Send a notification directly
