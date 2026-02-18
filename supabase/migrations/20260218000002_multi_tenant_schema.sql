-- Migration: Multi-tenant schema transformation
-- Renames existing tables to library_* prefix and creates user-specific tables

-- =============================================================
-- 1. Rename existing tables to library_* prefix
-- =============================================================

ALTER TABLE public.sets RENAME TO library_sets;
ALTER TABLE public.checklist_items RENAME TO library_checklist_items;

-- Rename the FK column
ALTER TABLE public.library_checklist_items RENAME COLUMN set_id TO library_set_id;

-- =============================================================
-- 2. Drop old permissive RLS policies
-- =============================================================

DROP POLICY IF EXISTS "Allow all access to sets" ON public.library_sets;
DROP POLICY IF EXISTS "Allow all access to checklist_items" ON public.library_checklist_items;
DROP POLICY IF EXISTS "Allow all access to collections" ON public.collections;
DROP POLICY IF EXISTS "Allow all access to set_collections" ON public.set_collections;

-- =============================================================
-- 3. New RLS policies for library tables (read-only for users, write for admins)
-- =============================================================

-- Library sets: everyone can read, admins can write
CREATE POLICY "Anyone can view library sets" ON public.library_sets
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage library sets" ON public.library_sets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update library sets" ON public.library_sets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete library sets" ON public.library_sets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Library checklist items: everyone can read, admins can write
CREATE POLICY "Anyone can view library checklist items" ON public.library_checklist_items
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage library checklist items" ON public.library_checklist_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update library checklist items" ON public.library_checklist_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can delete library checklist items" ON public.library_checklist_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =============================================================
-- 4. Create user_sets table
-- =============================================================

CREATE TABLE public.user_sets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  library_set_id UUID NOT NULL REFERENCES public.library_sets(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  UNIQUE(user_id, library_set_id)
);

ALTER TABLE public.user_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sets" ON public.user_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add sets" ON public.user_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sets" ON public.user_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can remove own sets" ON public.user_sets
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_user_sets_user_id ON public.user_sets(user_id);
CREATE INDEX idx_user_sets_library_set_id ON public.user_sets(library_set_id);

-- =============================================================
-- 5. Create user_card_status table
-- References library_checklist_items directly (handles parallels cleanly)
-- =============================================================

CREATE TABLE public.user_card_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  library_checklist_item_id UUID NOT NULL REFERENCES public.library_checklist_items(id) ON DELETE CASCADE,
  status public.card_status NOT NULL DEFAULT 'need',
  serial_owned TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, library_checklist_item_id)
);

ALTER TABLE public.user_card_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own card status" ON public.user_card_status
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add card status" ON public.user_card_status
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own card status" ON public.user_card_status
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own card status" ON public.user_card_status
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_user_card_status_user_item ON public.user_card_status(user_id, library_checklist_item_id);
CREATE INDEX idx_user_card_status_status ON public.user_card_status(status);

CREATE TRIGGER update_user_card_status_updated_at
  BEFORE UPDATE ON public.user_card_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 6. Rename collections tables and add user_id
-- =============================================================

ALTER TABLE public.collections RENAME TO user_collections;
ALTER TABLE public.set_collections RENAME TO user_collection_sets;

-- Add user_id to user_collections
ALTER TABLE public.user_collections ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Rename FK column in junction table
ALTER TABLE public.user_collection_sets RENAME COLUMN set_id TO library_set_id;
ALTER TABLE public.user_collection_sets RENAME COLUMN collection_id TO user_collection_id;

-- Drop old unique constraint and create new one
ALTER TABLE public.user_collections DROP CONSTRAINT IF EXISTS collections_name_key;
ALTER TABLE public.user_collections ADD CONSTRAINT user_collections_user_name_unique UNIQUE(user_id, name);

-- Drop old junction unique constraint and create new one
ALTER TABLE public.user_collection_sets DROP CONSTRAINT IF EXISTS set_collections_set_id_collection_id_key;
ALTER TABLE public.user_collection_sets ADD CONSTRAINT user_collection_sets_unique UNIQUE(user_collection_id, library_set_id);

-- New RLS policies for user_collections
DROP POLICY IF EXISTS "Allow all access to collections" ON public.user_collections;

CREATE POLICY "Users can view own collections" ON public.user_collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own collections" ON public.user_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own collections" ON public.user_collections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own collections" ON public.user_collections
  FOR DELETE USING (auth.uid() = user_id);

-- New RLS policies for user_collection_sets
DROP POLICY IF EXISTS "Allow all access to set_collections" ON public.user_collection_sets;

CREATE POLICY "Users can view own collection sets" ON public.user_collection_sets
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = user_collection_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can manage own collection sets" ON public.user_collection_sets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = user_collection_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update own collection sets" ON public.user_collection_sets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = user_collection_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete own collection sets" ON public.user_collection_sets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = user_collection_id AND user_id = auth.uid())
  );

CREATE INDEX idx_user_collections_user_id ON public.user_collections(user_id);
CREATE INDEX idx_user_collection_sets_collection ON public.user_collection_sets(user_collection_id);
CREATE INDEX idx_user_collection_sets_set ON public.user_collection_sets(library_set_id);

-- =============================================================
-- 7. Remove user-specific columns from library_checklist_items
-- (status, serial_owned, and display_order move to user_card_status)
-- =============================================================

-- Note: display_order stays on library_checklist_items as it controls
-- the library-level ordering of parallels, not user-specific data.

-- status and serial_owned are user-specific and will be on user_card_status.
-- We keep them on library_checklist_items for now until data migration runs,
-- then they can be dropped in a follow-up migration.
