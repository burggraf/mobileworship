-- Add pixabay to allowed media sources
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_source_check;
ALTER TABLE media ADD CONSTRAINT media_source_check
  CHECK (source IN ('upload', 'unsplash', 'pexels', 'pixabay'));
