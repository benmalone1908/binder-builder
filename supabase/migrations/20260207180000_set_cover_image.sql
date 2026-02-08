-- Add cover image URL column to sets table
ALTER TABLE public.sets ADD COLUMN cover_image_url TEXT;

-- Create storage bucket for set cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('set-covers', 'set-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to set covers
CREATE POLICY "Public read access for set covers"
ON storage.objects FOR SELECT
USING (bucket_id = 'set-covers');

-- Allow authenticated/anon insert for MVP (no auth)
CREATE POLICY "Allow uploads to set covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'set-covers');

-- Allow updates and deletes
CREATE POLICY "Allow updates to set covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'set-covers');

CREATE POLICY "Allow deletes from set covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'set-covers');
