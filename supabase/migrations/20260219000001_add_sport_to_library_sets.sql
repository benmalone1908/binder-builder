-- Add sport column to library_sets
-- All existing rows default to 'baseball'
ALTER TABLE library_sets
  ADD COLUMN sport TEXT NOT NULL DEFAULT 'baseball';

ALTER TABLE library_sets
  ADD CONSTRAINT library_sets_sport_check
  CHECK (sport IN ('baseball', 'basketball', 'football', 'hockey', 'soccer', 'other'));
