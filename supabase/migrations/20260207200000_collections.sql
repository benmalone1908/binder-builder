-- Collections table (simple reference table with just name)
CREATE TABLE public.collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Junction table for many-to-many relationship between sets and collections
CREATE TABLE public.set_collections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES public.sets(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(set_id, collection_id)
);

-- RLS policies
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.set_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to collections" ON public.collections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to set_collections" ON public.set_collections FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for efficient lookups
CREATE INDEX idx_set_collections_set_id ON public.set_collections(set_id);
CREATE INDEX idx_set_collections_collection_id ON public.set_collections(collection_id);
