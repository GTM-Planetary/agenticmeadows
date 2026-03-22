---
name: client-management
description: Manage landscaping clients — lookup, list, create, and update client records
version: 1.0.0
openclaw:
  emoji: "👥"
---

# Client Management

You know how to manage the client database for a landscaping business. Clients are the lifeblood of the operation — every property, job, quote, and invoice ties back to a client record.

## When to Use Each Tool

### `lookup_client` — Find a Specific Client

Use this when the user asks about a specific person or company. Accepts partial names, phone numbers, or email addresses and performs a fuzzy search.

Trigger phrases:
- "Look up John"
- "Do we have a client named Ramirez?"
- "Who's the client at 555-0142?"
- "Find the account for Greenfield HOA"

Pass the search term directly. The tool handles partial matching — "John" will match "John Peterson" and "Johnson Landscaping LLC."

### `list_clients` — Browse the Full Client List

Use this when the user wants to see everyone, filter by status, or get a count.

Trigger phrases:
- "Show me all my clients"
- "How many active clients do we have?"
- "List clients we haven't serviced in a while"
- "Do we have any clients?" (yes — use this, not lookup)

Supports optional filters: `status` (active, inactive, lead), `sort_by` (name, last_service, revenue).

### `create_client` — Add a New Client

Use this when the user wants to add someone new to the system. **Always confirm before creating.** Show a confirmation card with the details you're about to save.

Required fields: `name`, `phone`
Optional fields: `email`, `address`, `notes`, `type` (residential, commercial, hoa)

If the user says "Add a new client, Bob Martinez, 555-0199" — first present:

```
New Client:
  Name:  Bob Martinez
  Phone: 555-0199
  Type:  Residential (default)

Create this client? (yes/no)
```

### `update_client` — Modify Existing Client Info

Use this when the user wants to change a phone number, email, address, notes, or status. Requires the `client_id` — so always `lookup_client` first if you don't have it.

The tool returns a confirmation with the old and new values. Present this clearly so the user can verify the change took effect.

## Presenting Client Data

When you show a client record, format it as a readable card:

```
CLIENT: John Peterson
  Phone:    (555) 012-3456
  Email:    john.peterson@email.com
  Type:     Residential
  Status:   Active
  Properties: 2
  Since:    March 2024
  Notes:    Prefers service on Tuesdays. Dog in backyard — use side gate.
```

Always include the notes field if it has content. Landscaping crews rely on client notes for things like gate codes, pet warnings, and scheduling preferences. These details matter.

## Handling Edge Cases

- **Duplicate detection**: If `create_client` returns a potential duplicate warning, surface it to the user. "Looks like we already have a Bob Martinez on file — want to see that record instead?"
- **Inactive clients**: If a lookup returns an inactive client, mention the status. "Found them, but they're marked inactive. Want to reactivate?"
- **No results**: If lookup returns nothing, suggest creating a new client. "No match for 'Greenfield' — want to add them as a new client?"
- **Multiple matches**: If lookup returns several results, list them briefly and ask the user to pick one.
