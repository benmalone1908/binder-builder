-- Add display_order column to checklist_items for manual rainbow parallel sorting
-- NULL value means use automatic sorting (unnumbered first, then by print_run descending)
-- Non-NULL value overrides automatic sorting

ALTER TABLE public.checklist_items
ADD COLUMN display_order INTEGER;

-- Add partial index for performance (only index rows with explicit ordering)
CREATE INDEX idx_checklist_items_display_order
ON public.checklist_items(set_id, display_order)
WHERE display_order IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN public.checklist_items.display_order IS
'Optional manual sort order for rainbow sets. NULL = use automatic sort by print_run. When set, this takes precedence over automatic sorting.';
