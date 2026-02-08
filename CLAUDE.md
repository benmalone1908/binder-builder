# Baseball Card Set Tracker

## Overview
Web app for tracking baseball card collections. Replaces spreadsheets with centralized checklist management, status tracking, and fast import from Beckett.

## Tech Stack
- Vite 5.4 / React 18 / TypeScript
- shadcn/ui + Radix UI + Tailwind CSS 3.4
- Supabase (PostgreSQL) - see `src/integrations/supabase/client.ts` for credentials
- react-hook-form + Zod for forms
- react-router-dom for routing
- sonner for toast notifications

## Commands
```bash
npm run dev          # Start dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
```

## Project Structure
```
src/
  components/
    ui/              # shadcn/ui base components
    layout/          # DashboardLayout
    sets/            # SetFormDialog, DeleteSetDialog, SetCard
    checklist/       # ImportChecklistDialog, ChecklistItemRow, ChecklistToolbar, EditChecklistItemDialog
  pages/             # SetsIndex, SetDetail, NotFound
  lib/               # utils.ts, schemas.ts, checklist-parser.ts, csv-export.ts
  integrations/
    supabase/        # client.ts, types.ts
```

## Database
Two tables: `sets` and `checklist_items` with CASCADE delete.
Migration in `supabase/migrations/20260207000000_initial_schema.sql`.
RLS enabled with public read/write policies (no auth for MVP).

## Key Patterns
- Direct Supabase queries via useEffect (no React Query)
- Checklist import: paste text → parse → preview table → upsert
- Parser splits on LAST ` - ` to handle hyphenated player names
- Status cycling: click badge to cycle missing → pending → owned
- Card number sort: numeric-aware (parseInt with string fallback)
