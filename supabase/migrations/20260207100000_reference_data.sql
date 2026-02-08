-- Reference data tables for admin-managed dropdown values

-- Brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Product lines table (independent of brands)
CREATE TABLE public.product_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert sets table
CREATE TABLE public.insert_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insert_sets ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth for MVP)
CREATE POLICY "Allow all access to brands" ON public.brands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to product_lines" ON public.product_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to insert_sets" ON public.insert_sets FOR ALL USING (true) WITH CHECK (true);

-- Indexes for faster lookups
CREATE INDEX idx_brands_name ON public.brands(name);
CREATE INDEX idx_product_lines_name ON public.product_lines(name);
CREATE INDEX idx_insert_sets_name ON public.insert_sets(name);

-- Seed from existing data in sets table
INSERT INTO brands (name)
SELECT DISTINCT brand FROM sets WHERE brand IS NOT NULL AND brand != ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO product_lines (name)
SELECT DISTINCT product_line FROM sets WHERE product_line IS NOT NULL AND product_line != ''
ON CONFLICT (name) DO NOTHING;

-- Add insert_set_name column to sets table for tracking which insert set a set belongs to
ALTER TABLE public.sets ADD COLUMN insert_set_name TEXT;
