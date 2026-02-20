# Sport Labels & Filters Design

## Problem
The app assumes all sets are baseball. Users who collect multiple sports need to categorize sets by sport and filter their views accordingly.

## Decisions
- **Fixed sport list**: baseball, basketball, football, hockey, soccer, other
- **Required field**: every set must have a sport, defaulting to baseball
- **Data model**: TEXT column with CHECK constraint on `library_sets` (not enum, not reference table)
- **UI filtering**: top-level tabs on My Sets and Browse Library (not dropdown filters)

## Database

Add `sport` column to `library_sets`:

```sql
ALTER TABLE library_sets
  ADD COLUMN sport TEXT NOT NULL DEFAULT 'baseball'
  CONSTRAINT library_sets_sport_check
  CHECK (sport IN ('baseball', 'basketball', 'football', 'hockey', 'soccer', 'other'));
```

All existing rows backfilled as 'baseball' via the DEFAULT.

## Form Changes

**schemas.ts**: Add `sport` field with enum validation, default 'baseball'.

**SetFormDialog.tsx**: Add `<Select>` as the first form field (before name). Fixed options, not ComboboxWithCreate. Default: baseball.

## Listing Pages

**SetsIndex.tsx** and **BrowseLibrary.tsx**:
- Sport tabs as outermost navigation: Baseball | Basketball | Football | Hockey | Soccer | Other | All
- Default tab: Baseball
- Existing set_type tabs (Regular/Multi-Year/Rainbows) nest inside sport tab on SetsIndex
- Filter queries include `sport` in WHERE clause (except "All" tab)

## Set Card Display

**SetCard.tsx**: Show sport badge only when viewing "All" sports tab. When filtered to a specific sport, the badge is redundant.

## Files to Modify

| File | Change |
|------|--------|
| New migration SQL | Add sport column with CHECK constraint |
| `src/lib/schemas.ts` | Add sport to Zod schema |
| `src/integrations/supabase/types.ts` | Regenerate types |
| `src/components/sets/SetFormDialog.tsx` | Add sport Select field |
| `src/pages/SetsIndex.tsx` | Add sport tabs + filter logic |
| `src/pages/BrowseLibrary.tsx` | Add sport tabs + filter logic |
| `src/components/sets/SetCard.tsx` | Conditional sport badge |
