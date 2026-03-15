# Set Library Scraping — Design Spec

**Date:** 2026-03-14
**Status:** Approved

## Overview

Replace manual checklist import with a pre-populated library of sets scraped from an external source. Admins control scraping deliberately (credit-aware). Users browse the library to add sets to their collection, with manual import as a fallback for sets not yet in the library.

## Goals

- Build a library of sets to reduce manual data entry for users
- Keep scraping admin-only and intentional (limited API credits)
- No visible connection to the external data source in code, schema, or UI

---

## Data Model

### Changes to `library_sets`

Three new nullable columns:

| Column | Type | Notes |
|--------|------|-------|
| `source_ref` | integer, unique | Opaque identifier from external source |
| `source_url` | text | Full URL used for scraping; not displayed |
| `scrape_status` | text (check constraint) | `'pending'`, `'scraped'`, or `'failed'`; nullable (null = never attempted) |

The `source_ref` unique constraint prevents duplicate imports across discovery runs.

### Changes to `set_type` enum

The existing `set_type` enum (`base | insert | rainbow | multi_year_insert`) gains one new value:

- **`parallel`** — a full parallel set (all cards in the set, one color/variation); child of a `base` or `insert` set via `parent_set_id`
- **`rainbow`** remains — card-level variant tracking within a set (multiple parallels of individual cards)

### `parent_set_id` usage

`library_sets.parent_set_id` already exists. It is used to express:
- Insert set → base set
- Parallel set → base set or insert set

A set with no `parent_set_id` is a top-level set.

Migration DDL for new columns:
```sql
ALTER TABLE library_sets
  ADD COLUMN source_ref integer UNIQUE,
  ADD COLUMN source_url text,
  ADD COLUMN scrape_status text CHECK (scrape_status IN ('pending', 'scraped', 'failed'));

ALTER TABLE library_checklist_items
  ADD COLUMN notes text;

-- Add parallel to set_type enum
-- NOTE: must run outside a transaction block in PostgreSQL
ALTER TYPE set_type ADD VALUE 'parallel';
```

### Changes to `library_checklist_items`

One new nullable column:

| Column | Type | Notes |
|--------|------|-------|
| `notes` | text | Variant descriptions and flags (e.g. "SP, VAR — Smiling in background") |

No other schema changes. Existing `card_number`, `player_name`, and `team` columns cover all required fields.

---

## Edge Functions

### `discover-sets`

**Input:** `{ year: number, sport: string }`
**Output:** `Array<{ name: string, source_ref: number, source_url: string, card_count: number }>`

- Calls Firecrawl on the external source's year/sport listing page
- Returns available sets without writing to the database
- No credits consumed for sets the admin chooses not to scrape
- Base URL stored as Supabase secret `CHECKLIST_SOURCE_URL` — not hardcoded

### `scrape-set-checklist`

**Input:** `{ source_ref: number, source_url: string, set_metadata: SetMetadata }`

Where `SetMetadata` is:
```ts
{
  name: string;
  year: number;
  sport: string;
  brand?: string;         // defaults to '' if not provided — avoids null guard work in existing code
  product_line?: string;  // defaults to '' if not provided
  set_type?: string;
}
```

**Output:** `{ cards_inserted: number, parse_errors: string[] }`

- Calls Firecrawl on the specific set page
- Parses the returned markdown table via a pure `parseExternalChecklist()` function
- Inserts a new row into `library_sets` with `scrape_status = pending` — this is the moment the library row is created; discovery does not write to the DB. The unique constraint on `source_ref` acts as a server-side safety net; if a duplicate insert arrives concurrently, the constraint violation is treated as a no-op (the function proceeds to scrape).
- Selects a cover image from the parsed cards using this priority: card `"1"` → card `"1a"` → first card in set. Downloads the first thumbnail URL for that card, uploads to Supabase Storage at `set-covers/{source_ref}.jpg`, and stores the resulting Storage URL as `cover_image_url`. If the download or upload fails, scraping continues without a cover image (non-fatal).
- On success: updates `scrape_status = scraped`; on error: updates `scrape_status = failed`
- Bulk-inserts into `library_checklist_items`
- Returns summary of cards inserted, cover image status, and any parse warnings

### Auth

Both functions require an `Authorization` header validated against a Supabase secret `ADMIN_SECRET`. Requests without it return 401.

### Parser: `parseExternalChecklist(markdown: string): ParsedCard[]`

Pure function, no Supabase dependency.

The source table has 27 columns per row. The meaningful ones (1-indexed):
- **Columns 1–2**: Card image thumbnails (ignored)
- **Columns 3–9**: Empty
- **Column 10**: Card number link (e.g. `[1](...)`, `[1b](...)`)
- **Columns 11–18**: Empty
- **Column 19**: Player name link + optional flags + optional `<br>` variant description
- **Columns 20–26**: Empty
- **Column 27**: Team name link

Rows with fewer than 27 pipe-separated segments are skipped (header/separator rows).

Handles:
- **Card number** — link text from column 10; includes variant suffixes (`1b`, `5b`)
- **Player name** — first link text in column 19, before any `<br>`
- **Team** — link text from column 27
- **Thumbnail URL** — `src` of the first `<img>` in column 1; included in `ParsedCard` for cover image selection, not stored per card
- **Flags** (`SP`, `VAR`, `ASR`, `RC`) — uppercase tokens after player name link in column 19, stored in `notes`
- **Variant description** — text after `<br>` in column 19, appended to `notes`
- **Multi-page sets** — Firecrawl crawl mode handles pagination; parser processes concatenated output

---

## Admin UI

Lives on the existing `/admin` route. A new "Set Library" section with two panels.

### Discovery Panel

Fields: Year (number input) + Sport (dropdown: Baseball, Football, Basketball, Hockey) + "Discover" button.

Results table columns: **Set Name** | **Cards** | **Status** | **Action**

- On page load, the admin UI fetches all existing `source_ref` values from `library_sets` (single query). When discovery results arrive, each row's status is resolved client-side by checking against this fetched set — no extra network call per row.
- Status values: "In Library" (grey, no action), "Failed / Stuck" (red, re-scrapeable), or blank (not yet imported)
- `'pending'` and `'failed'` scrape statuses are both treated as re-scrapeable — prevents rows getting permanently stuck if the Edge Function crashes mid-flight
- Action: "Scrape" button per row — one at a time, no bulk scrape; shown for unimported rows, failed rows, and stuck pending rows
- During scrape: row shows inline spinner, then updates to "Scraped ✓" or "Failed — [reason]"
- Failed rows remain re-scrapeable

No source URLs, source IDs, or external branding displayed anywhere in the UI.

### Post-Scrape Editing

Each scraped set in the library view has two inline edit actions:

**Rename:** Edit the set name in place. Name is the only editable metadata field (year, sport, brand are considered stable after import).

**Link to parent set:** A searchable dropdown of existing `library_sets` rows. Selecting one sets `parent_set_id` on the current set.
- If the admin types a name not found in the library, the UI shows: *"[Name] not in library — discover it first?"* with a button that jumps to the Discovery Panel
- A freshly scraped set lands with `set_type = 'base'` (the DB default) — this is acceptable as an interim state; the admin corrects it when linking a parent
- Saving the parent prompts the admin to confirm/set `set_type` (insert, parallel) if it is still `'base'`
- Parent can be cleared (set to null) to make a set top-level again

### Library Stats Panel (read-only)

- Total sets in library
- Breakdown by sport and year
- Recently scraped sets with card counts

---

## User-Facing Integration

Two connection points to the existing user flow:

1. **Library browsing** (`/library`) — users browse pre-scraped sets and add them to their collection via `user_sets`
2. **Manual import fallback** — `ImportChecklistDialog` remains available for sets not yet in the library; no change to existing import flow

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Firecrawl API error | Edge Function returns 500; admin UI shows error message on the row |
| Parse produces zero cards | Treated as failure; `scrape_status` set to `failed` |
| `source_ref` already exists with `scrape_status = 'scraped'` | Discovery marks row as "In Library"; scrape button hidden |
| `source_ref` exists with `scrape_status = 'pending'` or `'failed'` | Discovery marks row as "Failed / Stuck"; scrape button shown |
| Partial parse (some rows fail) | Insert succeeds with cards parsed; parse errors returned in response and shown as a warning |

---

## What's Out of Scope

- Automated/scheduled scraping
- User-triggered scraping
- Re-scraping sets with `scrape_status = scraped` (only failed scrapes are re-scrapeable)
- Bulk "scrape all" action
- `/library` browsing UI — the route exists but its design is a separate spec
