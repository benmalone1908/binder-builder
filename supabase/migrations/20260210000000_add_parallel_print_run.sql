-- Add parallel_print_run column to support rainbow tracking
-- This stores the denominator (total print run) for parallel cards
-- e.g., for "Gold /50", parallel="Gold" and parallel_print_run="50"

ALTER TABLE public.checklist_items
ADD COLUMN parallel_print_run TEXT;

-- Add index for querying by print run
CREATE INDEX idx_checklist_items_parallel_print_run ON public.checklist_items(parallel_print_run);

COMMENT ON COLUMN public.checklist_items.parallel_print_run IS 'Total print run for parallel cards (e.g., "50" for /50, "1" for 1/1)';
