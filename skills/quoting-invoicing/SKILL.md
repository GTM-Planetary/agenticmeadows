---
name: quoting-invoicing
description: Draft quotes, manage line items, create invoices, and handle the quote-to-invoice workflow
version: 1.0.0
openclaw:
  emoji: "💲"
---

# Quoting & Invoicing

You handle the money side of the landscaping business. Quotes win jobs, invoices collect payment. Getting pricing right matters — underbid and you lose money, overbid and you lose the client.

## The Golden Rule: Always Check the Service Catalog First

### `get_service_catalog`

**Before quoting anything, call `get_service_catalog`.** This returns the current price list with per-unit rates, minimum charges, and any seasonal adjustments.

Never guess at pricing. Never use stale numbers from a previous conversation. The catalog is the single source of truth. Prices can change — the business owner updates them in AgenticMeadows, and your job is to use whatever's current.

The catalog returns entries like:

```
Service:        Mow & Edge
Unit:           per visit
Base Rate:      $45 (up to 5,000 sq ft)
Overage:        $8 per additional 1,000 sq ft
Min Charge:     $45
```

When the user says "Quote me a mow for the Peterson place," you need to:
1. `get_service_catalog` to get current mow pricing
2. `lookup_property` for Peterson's lot to get lawn square footage
3. Calculate the price based on lot size and the catalog rate
4. Present the quote for confirmation

## Drafting Quotes

### `draft_quote`

Creates a new quote tied to a client and optionally a property.

Required fields: `client_id`, `line_items` (array of service + price)
Optional fields: `property_id`, `notes`, `valid_until`, `discount`

Always build quotes with itemized line items. Landscaping clients want to see what they're paying for.

Workflow when user says "Put together a quote for spring cleanup at the Henderson property":

1. `lookup_client` — find Henderson, get `client_id`
2. `lookup_property` — find their property, get `property_id` and measurements
3. `get_service_catalog` — get spring cleanup pricing
4. Calculate based on property measurements
5. Present for confirmation:

```
QUOTE #Q-2026-0042
Client:   Sarah Henderson
Property: 4520 Birchwood Dr

  Spring Cleanup (leaf removal, bed clearing)    $285.00
  Mulch — 8 yards @ $65/yard                     $520.00
  Bed Edging — 240 linear ft @ $1.50/ft          $360.00
                                          ──────────────
  Subtotal:                                     $1,165.00
  Discount:                                         —
  Total:                                        $1,165.00

  Valid until: April 15, 2026

Send this quote? (yes/no)
```

### Pricing Calculations

Use property measurements from the property record to calculate accurately:

- **Mowing**: Based on lawn area (sq ft). Use catalog's base rate + overage formula.
- **Mulch**: Based on bed area. Rule of thumb: 1 cubic yard covers ~100 sq ft at 3" depth. Round up — clients prefer a little extra over bare spots.
- **Edging**: Based on edging linear feet from the property record.
- **Chemical apps (fertilizer, weed control)**: Based on lawn area. Measured in 1,000 sq ft increments.
- **Irrigation**: Typically flat rate per zone or per head, from the catalog.
- **Tree/shrub work**: Usually hourly or per-job. Ask the user for scope if not clear.

### Multi-Service Quotes

Landscaping quotes often bundle multiple services. If the user says "Full spring package for Henderson" — think about what a spring package includes:
- Spring cleanup (debris, leaf removal)
- First mow of the season
- Pre-emergent herbicide application
- Mulch installation
- Bed edging refresh

Pull catalog pricing for each, calculate per the property measurements, and present as a single bundled quote.

## Adding Line Items

### `add_line_item`

Adds a service line to an existing quote. Use when the user says things like:
- "Add mulch to that quote"
- "Throw in an aeration too"
- "They also want the hedges trimmed"

Requires `quote_id` and the line item details (`service`, `quantity`, `unit_price`).

Always show the updated quote total after adding a line item.

## Creating Invoices

### `create_invoice`

Generates an invoice, typically after a job is completed.

Required fields: `client_id`, `line_items`
Optional fields: `property_id`, `quote_id` (for quote conversion), `due_date`, `notes`

Default payment terms: Net 30 (but check if the client has custom terms in their notes).

```
INVOICE #INV-2026-0089
Client:   Sarah Henderson
Property: 4520 Birchwood Dr
Date:     March 21, 2026
Due:      April 20, 2026

  Spring Cleanup                                  $285.00
  Mulch — 8 yards                                 $520.00
  Bed Edging — 240 linear ft                      $360.00
                                          ──────────────
  Total Due:                                    $1,165.00

  Payment Terms: Net 30

Create this invoice? (yes/no)
```

## Quote to Invoice Conversion

This is the most common workflow. A quote gets approved, the work gets done, now it's time to bill.

When the user says "Henderson approved the spring quote — invoice it":

1. Look up the quote (by client name or quote number)
2. Convert the quote line items directly into an invoice
3. Use `create_invoice` with the `quote_id` reference so they're linked
4. Present for confirmation — the amounts should match the quote unless the user specifies changes

If scope changed during the job (common in landscaping — "we found an extra bed that needed mulch"), the user may want to adjust line items before invoicing. Handle that by presenting the original quote items and asking if anything changed.

## Important Business Rules

- **Never auto-send quotes or invoices.** Always confirm with the user first. These go to real clients with real money.
- **Tax**: Check if the business charges sales tax on services (varies by state/locality). If the catalog includes tax rates, apply them. If not, present pre-tax totals and note that tax may apply.
- **Discounts**: The user may offer percentage or flat discounts. Show the discount as a separate line so the client sees the value they're getting.
- **Deposits**: Some large jobs (installs, hardscaping) require deposits. If the user mentions a deposit, split the invoice or note the deposit terms.
- **Recurring billing**: For maintenance contracts (weekly mow, monthly chem apps), the user may want monthly invoices that aggregate completed jobs. Support this by pulling completed jobs for the billing period.
