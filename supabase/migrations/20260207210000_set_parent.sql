-- Add parent_set_id to support multi-year sets with sub-year sets
ALTER TABLE public.sets ADD COLUMN parent_set_id UUID REFERENCES public.sets(id) ON DELETE SET NULL;

-- Index for efficient lookups of child sets
CREATE INDEX idx_sets_parent_set_id ON public.sets(parent_set_id) WHERE parent_set_id IS NOT NULL;
