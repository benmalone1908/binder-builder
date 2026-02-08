-- Create custom types
CREATE TYPE public.set_type AS ENUM ('base', 'insert', 'rainbow', 'multi_year_insert');
CREATE TYPE public.card_status AS ENUM ('missing', 'pending', 'owned');

-- Create sets table
CREATE TABLE public.sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  brand TEXT NOT NULL,
  product_line TEXT NOT NULL,
  set_type public.set_type NOT NULL DEFAULT 'base',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create checklist_items table
CREATE TABLE public.checklist_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id UUID NOT NULL REFERENCES public.sets(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  player_name TEXT NOT NULL,
  team TEXT,
  subset_name TEXT,
  parallel TEXT,
  serial_owned TEXT,
  status public.card_status NOT NULL DEFAULT 'missing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(set_id, card_number)
);

-- Enable Row Level Security
ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth for MVP)
CREATE POLICY "Allow all access to sets" ON public.sets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to checklist_items" ON public.checklist_items FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_checklist_items_set_id ON public.checklist_items(set_id);
CREATE INDEX idx_checklist_items_status ON public.checklist_items(status);
CREATE INDEX idx_sets_year ON public.sets(year);
CREATE INDEX idx_sets_brand ON public.sets(brand);

-- Timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sets_updated_at
  BEFORE UPDATE ON public.sets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_checklist_items_updated_at
  BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
