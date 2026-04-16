-- Remove duplicate library_sets rows, keeping the oldest (by created_at).
DELETE FROM public.library_sets
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY name, year, brand, product_line, set_type, COALESCE(insert_set_name, '')
        ORDER BY created_at
      ) AS rn
    FROM public.library_sets
  ) dupes
  WHERE rn > 1
);

-- Prevent future duplicates. insert_set_name is NULLable so we coalesce to ''
-- to make nulls compare equal within the index.
CREATE UNIQUE INDEX library_sets_unique
  ON public.library_sets (name, year, brand, product_line, set_type, COALESCE(insert_set_name, ''));
