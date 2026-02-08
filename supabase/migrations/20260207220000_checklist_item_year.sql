-- Add year column to checklist_items for multi-year insert sets
ALTER TABLE public.checklist_items ADD COLUMN year INTEGER;

-- Index for efficient grouping/filtering by year
CREATE INDEX idx_checklist_items_year ON public.checklist_items(year) WHERE year IS NOT NULL;

-- Drop the parent_set_id column since we're using card-level years instead
ALTER TABLE public.sets DROP COLUMN parent_set_id;
