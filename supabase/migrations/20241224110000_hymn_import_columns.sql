-- Make church_id nullable to support global hymns (church_id = NULL)
-- Note: This intentionally relaxes the NOT NULL constraint to allow
-- a church-independent hymn library. Global hymns (church_id IS NULL)
-- are read-only via RLS and managed by service role only.
ALTER TABLE songs ALTER COLUMN church_id DROP NOT NULL;

-- Add columns for hymn attribution and source tracking
ALTER TABLE songs ADD COLUMN IF NOT EXISTS composer TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_public_domain BOOLEAN NOT NULL DEFAULT false;

-- Allow reading global hymns (church_id IS NULL) for authenticated users
DROP POLICY IF EXISTS "Anyone can view global hymns" ON songs;
CREATE POLICY "Anyone can view global hymns" ON songs
  FOR SELECT USING (
    church_id IS NULL AND
    auth.uid() IS NOT NULL
  );

-- Index for efficient global hymn browsing by title
CREATE INDEX IF NOT EXISTS idx_songs_global ON songs(title) WHERE church_id IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN songs.composer IS 'Music composer (distinct from author/lyricist)';
COMMENT ON COLUMN songs.source_url IS 'Original source URL for imported songs';
COMMENT ON COLUMN songs.is_public_domain IS 'True if song is in public domain (no licensing required)';
