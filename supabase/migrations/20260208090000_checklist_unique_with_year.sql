-- Update unique constraint on checklist_items to include year and parallel
-- This allows the same card_number to appear in different years (for multi-year insert sets)
-- and allows parallel versions of the same card (e.g., base + Refractor)

-- Drop the old constraints (both the original and any previously applied version of this migration)
ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_set_id_card_player_key;
DROP INDEX IF EXISTS checklist_items_set_card_player_year_unique;

-- Add new constraint that includes year and parallel
-- Using COALESCE to handle nulls: null year -> 0, null parallel -> ''
-- For regular sets (year is null), the constraint still prevents duplicate card numbers
-- For multi-year sets, the same card number can appear with different years
-- The same card can also appear as different parallels (base, Refractor, Gold, etc.)
CREATE UNIQUE INDEX checklist_items_set_card_player_year_parallel_unique
ON public.checklist_items (set_id, card_number, player_name, COALESCE(year, 0), COALESCE(parallel, ''));
