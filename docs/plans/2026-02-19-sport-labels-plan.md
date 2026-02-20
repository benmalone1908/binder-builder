# Sport Labels & Filters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `sport` column to sets so users can categorize and filter by sport (baseball, basketball, football, hockey, soccer, other).

**Architecture:** Text column with CHECK constraint on `library_sets`, sport tabs as outermost navigation on listing pages, Select field in the set creation form. All existing data backfilled as 'baseball'.

**Tech Stack:** Supabase (PostgreSQL), React, TypeScript, shadcn/ui Tabs + Select components, Zod

---

## Shared Constants

Create a shared constants file used by all tasks. This avoids duplicating the sport list across files.

**File:** `src/lib/sports.ts`

```typescript
export const SPORTS = [
  "baseball",
  "basketball",
  "football",
  "hockey",
  "soccer",
  "other",
] as const;

export type Sport = (typeof SPORTS)[number];

export const SPORT_LABELS: Record<Sport, string> = {
  baseball: "Baseball",
  basketball: "Basketball",
  football: "Football",
  hockey: "Hockey",
  soccer: "Soccer",
  other: "Other",
};
```

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260219000001_add_sport_to_library_sets.sql`

**Step 1: Write the migration**

```sql
-- Add sport column to library_sets
-- All existing rows default to 'baseball'
ALTER TABLE library_sets
  ADD COLUMN sport TEXT NOT NULL DEFAULT 'baseball';

ALTER TABLE library_sets
  ADD CONSTRAINT library_sets_sport_check
  CHECK (sport IN ('baseball', 'basketball', 'football', 'hockey', 'soccer', 'other'));
```

**Step 2: Apply migration to local Supabase**

Run: `cd /Users/ben/Claude\ Code\ Projects/baseball-card-tracker && npx supabase db push`

If local Supabase isn't running, apply via the Supabase dashboard SQL editor instead.

**Step 3: Commit**

```bash
git add supabase/migrations/20260219000001_add_sport_to_library_sets.sql
git commit -m "feat: add sport column to library_sets with CHECK constraint"
```

---

### Task 2: Update TypeScript Types + Shared Constants

**Files:**
- Modify: `src/integrations/supabase/types.ts` (lines 48-92, the `library_sets` type block)
- Create: `src/lib/sports.ts`

**Step 1: Create shared constants file**

Create `src/lib/sports.ts` with the code from the "Shared Constants" section above.

**Step 2: Update Supabase types**

Add `sport: string` to the `library_sets` Row type (after `notes`):

```typescript
// In Row block (line ~60, after notes):
sport: string

// In Insert block (line ~74, after notes):
sport?: string

// In Update block (line ~88, after notes):
sport?: string
```

**Step 3: Commit**

```bash
git add src/lib/sports.ts src/integrations/supabase/types.ts
git commit -m "feat: add Sport type constants and update Supabase types"
```

---

### Task 3: Update Zod Schema + Set Form

**Files:**
- Modify: `src/lib/schemas.ts` (entire file, 14 lines)
- Modify: `src/components/sets/SetFormDialog.tsx` (form fields + reset logic)

**Step 1: Update schemas.ts**

Add sport to the Zod schema. Import SPORTS from the constants file:

```typescript
import { z } from "zod";
import { SPORTS } from "./sports";

export const setFormSchema = z.object({
  sport: z.enum(SPORTS).default("baseball"),
  name: z.string().min(1, "Name is required"),
  year: z.coerce.number().int().min(1900, "Year must be 1900 or later").max(2100, "Year must be 2100 or earlier"),
  brand: z.string().min(1, "Brand is required"),
  product_line: z.string().min(1, "Product line is required"),
  set_type: z.enum(["base", "insert", "rainbow", "multi_year_insert"]),
  insert_set_name: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  notes: z.string().optional().default(""),
});

export type SetFormValues = z.infer<typeof setFormSchema>;
```

**Step 2: Update SetFormDialog.tsx**

Add import for SPORT_LABELS:

```typescript
import { SPORT_LABELS } from "@/lib/sports";
import type { Sport } from "@/lib/sports";
```

Add `sport: "baseball"` to both `defaultValues` blocks in `useForm` (line 58) and the `form.reset` calls (lines 72 and 93).

In the editing reset (line 72), add: `sport: (set.sport as Sport) || "baseball"`

Add sport Select field as the FIRST form field, before the Name field (before line 163). Insert this JSX:

```tsx
<FormField
  control={form.control}
  name="sport"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Sport</FormLabel>
      <Select onValueChange={field.onChange} value={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          {Object.entries(SPORT_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Step 3: Verify the dev server compiles without errors**

Run: `npm run build` from the project root.

**Step 4: Commit**

```bash
git add src/lib/schemas.ts src/components/sets/SetFormDialog.tsx
git commit -m "feat: add sport field to set form and validation schema"
```

---

### Task 4: Add Sport Tabs to SetsIndex (My Sets)

**Files:**
- Modify: `src/pages/SetsIndex.tsx`

**Step 1: Add imports and state**

Import the sport constants:

```typescript
import { SPORTS, SPORT_LABELS } from "@/lib/sports";
import type { Sport } from "@/lib/sports";
```

Add sport filter state (near line 74, alongside existing state):

```typescript
const [sportFilter, setSportFilter] = useState<Sport | "all">("baseball");
```

**Step 2: Add sport filtering to filteredSets**

In the `filteredSets` useMemo (line 237), add sport filtering BEFORE the existing tab filter. Add `sportFilter` to the dependency array:

```typescript
const filteredSets = useMemo(() => {
  let result = sets;

  // Filter by sport
  if (sportFilter !== "all") {
    result = result.filter((s) => (s as any).sport === sportFilter);
  }

  // Filter by tab (existing code unchanged)
  if (activeTab === "regular") {
    result = result.filter((s) => s.set_type !== "multi_year_insert" && s.set_type !== "rainbow");
  } else if (activeTab === "multi_year") {
    result = result.filter((s) => s.set_type === "multi_year_insert");
  } else if (activeTab === "rainbow") {
    result = result.filter((s) => s.set_type === "rainbow");
  }

  // Filter by search term (existing code unchanged)
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.brand.toLowerCase().includes(term) ||
        s.product_line.toLowerCase().includes(term) ||
        (s.insert_set_name && s.insert_set_name.toLowerCase().includes(term)) ||
        String(s.year).includes(term)
    );
  }

  return result;
}, [sets, searchTerm, activeTab, sportFilter]);
```

**Step 3: Add sport tabs UI**

Wrap the existing content in sport tabs. Insert BEFORE the existing `<Tabs>` component (line 355) and AFTER the header div (line 353):

```tsx
<Tabs value={sportFilter} onValueChange={(v) => setSportFilter(v as Sport | "all")}>
  <TabsList>
    {SPORTS.map((sport) => (
      <TabsTrigger key={sport} value={sport}>
        {SPORT_LABELS[sport]}
      </TabsTrigger>
    ))}
    <TabsTrigger value="all">All</TabsTrigger>
  </TabsList>
</Tabs>
```

Note: This is a SEPARATE `<Tabs>` component from the existing set_type tabs. It controls `sportFilter` state, not `activeTab`. The existing set_type tabs remain nested inside and unchanged. Both Tabs components are "controlled" — they use `value`/`onValueChange` and render their content below independently (no `<TabsContent>` needed for the sport tabs since filtering happens via state).

**Step 4: Verify the dev server compiles**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/pages/SetsIndex.tsx
git commit -m "feat: add sport filter tabs to My Sets page"
```

---

### Task 5: Add Sport Tabs to BrowseLibrary

**Files:**
- Modify: `src/pages/BrowseLibrary.tsx`

**Step 1: Add imports and state**

Import sport constants and the Tabs components:

```typescript
import { SPORTS, SPORT_LABELS } from "@/lib/sports";
import type { Sport } from "@/lib/sports";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
```

Add sport filter state (near line 47):

```typescript
const [sportFilter, setSportFilter] = useState<Sport | "all">("baseball");
```

**Step 2: Add sport filtering to filtered memo**

In the `filtered` useMemo (line 90), add sport filtering BEFORE the existing filters. Add `sportFilter` to the dependency array:

```typescript
const filtered = useMemo(() => {
  let result = librarySets.filter(
    (s) => s.set_type !== "rainbow" && s.set_type !== "multi_year_insert"
  );

  // Filter by sport
  if (sportFilter !== "all") {
    result = result.filter((s) => (s as any).sport === sportFilter);
  }

  // existing search/year/brand/type filters unchanged...

  return result;
}, [librarySets, searchTerm, yearFilter, brandFilter, typeFilter, sportFilter]);
```

**Step 3: Add sport tabs UI**

Insert sport tabs between the header and the filters section. After the closing `</div>` of the header (line 160), before the `{/* Filters */}` comment (line 162):

```tsx
<Tabs value={sportFilter} onValueChange={(v) => setSportFilter(v as Sport | "all")}>
  <TabsList>
    {SPORTS.map((sport) => (
      <TabsTrigger key={sport} value={sport}>
        {SPORT_LABELS[sport]}
      </TabsTrigger>
    ))}
    <TabsTrigger value="all">All</TabsTrigger>
  </TabsList>
</Tabs>
```

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/pages/BrowseLibrary.tsx
git commit -m "feat: add sport filter tabs to Browse Library page"
```

---

### Task 6: Add Sport Badge to SetCard

**Files:**
- Modify: `src/components/sets/SetCard.tsx`

**Step 1: Update SetCard props**

Add `showSportBadge` to the props interface (line 33):

```typescript
interface SetCardProps {
  set: SetRow;
  stats: SetStats;
  onEdit: (set: SetRow) => void;
  onDelete: (set: SetRow) => void;
  onEditImage: (set: SetRow) => void;
  onClick?: () => void;
  showSportBadge?: boolean;
}
```

Update the destructuring (line 42):

```typescript
export function SetCard({ set, stats, onEdit, onDelete, onEditImage, onClick, showSportBadge }: SetCardProps) {
```

**Step 2: Add sport badge to metadata pills**

Import SPORT_LABELS:

```typescript
import { SPORT_LABELS } from "@/lib/sports";
import type { Sport } from "@/lib/sports";
```

In the metadata pills section (line 154, after the opening `<div className="px-3 pb-2 ..."`), add the sport badge BEFORE the brand pill:

```tsx
{showSportBadge && (set as any).sport && (
  <span className={`
    inline-flex items-center gap-0.5 px-1.5 py-0.5
    text-[10px] font-medium rounded-full
    bg-amber-100/80 backdrop-blur-sm
    text-amber-800
    border border-amber-200
  `}>
    {SPORT_LABELS[(set as any).sport as Sport] || (set as any).sport}
  </span>
)}
```

**Step 3: Pass showSportBadge from parent pages**

In `SetsIndex.tsx`, find all `<SetCard` usages and add the prop:

```tsx
showSportBadge={sportFilter === "all"}
```

There are 4 occurrences of `<SetCard` in SetsIndex.tsx (lines ~481, ~551, ~677, ~795). Add the prop to each.

BrowseLibrary doesn't use SetCard (it has inline card rendering), so no change needed there. If you want a sport badge in BrowseLibrary grid view, add it inline in the card JSX — but this is optional and can be skipped.

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add src/components/sets/SetCard.tsx src/pages/SetsIndex.tsx
git commit -m "feat: show sport badge on set cards when viewing all sports"
```

---

### Task 7: Final Verification

**Step 1: Run full build**

Run: `npm run build`

Verify zero errors.

**Step 2: Run lint**

Run: `npm run lint`

Fix any issues.

**Step 3: Manual smoke test**

Run: `npm run dev`

Verify:
- Sport tabs appear on My Sets page above the set_type tabs
- Sport tabs appear on Browse Library page above the filters
- Default tab is Baseball
- Clicking other sport tabs shows empty (expected — all data is baseball)
- "All" tab shows all sets
- Set form has Sport select as first field, defaults to Baseball
- Creating a set with a non-baseball sport works and it appears under the correct tab

**Step 4: Final commit if any fixes needed**
