-- Migration: Convert songs from JSONB content to markdown TEXT lyrics
-- This is a fresh start migration (no data to migrate)

-- Drop the old content column
ALTER TABLE songs DROP COLUMN IF EXISTS content;

-- Add the new lyrics column
ALTER TABLE songs ADD COLUMN lyrics TEXT NOT NULL DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN songs.lyrics IS 'Markdown format: YAML frontmatter for metadata, # headers for sections';
