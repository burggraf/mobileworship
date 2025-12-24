# Public Domain Hymn Import System

## Overview

Import ~800 public domain hymns from HymnsToGod.org into a shared global library. Churches can browse and copy hymns to their own library for customization.

## Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage model | Shared global library (null church_id) | Avoid duplicating 800 hymns × N churches |
| Import mechanism | Copy on "Add to Library" | Simple, churches own their copy, can edit freely |
| Scraper runtime | Local script + Edge function | Local for dev/testing, edge function for production |
| Lyrics formatting | Deterministic parser (no AI) | Hymns have predictable structure, saves API costs |
| First source | HymnsToGod.org | Curated ~800 PD hymns with clear attribution |

## Database Changes

### New columns on `songs` table

```sql
ALTER TABLE songs ADD COLUMN composer TEXT;
ALTER TABLE songs ADD COLUMN source_url TEXT;
ALTER TABLE songs ADD COLUMN is_public_domain BOOLEAN DEFAULT false;
```

### RLS policy for global hymns

```sql
-- Anyone can read global hymns (church_id IS NULL)
CREATE POLICY "Anyone can view global hymns" ON songs
  FOR SELECT USING (church_id IS NULL);

-- Index for browsing
CREATE INDEX idx_songs_global ON songs(title) WHERE church_id IS NULL;
```

## File Structure

```
scripts/
  import-hymns.ts           # Local CLI script (Deno)
  lib/
    scraper.ts              # Fetch hymn list + individual pages
    parser.ts               # HTML → structured hymn data
    formatter.ts            # Raw lyrics → markdown

supabase/functions/
  import-hymns/
    index.ts                # Edge function (admin-only)
```

## Scraping Flow

1. Fetch `ZZ-CompletePDHymnList.html`
2. Extract all hymn URLs (~800 links)
3. For each hymn:
   - Fetch page HTML
   - Parse: title, lyricist, composer, lyrics
   - Format lyrics to markdown
   - Rate limit: 100ms delay between requests
4. Output JSON array
5. Insert to Supabase with `church_id = NULL`

## Data Model

### Scraped hymn structure

```typescript
interface ScrapedHymn {
  title: string;
  author: string;        // Lyricist
  composer: string | null;
  lyrics: string;        // Markdown format
  source_url: string;
  is_public_domain: true;
}
```

### Markdown lyrics format

```markdown
---
source: hymnstogod.org
source_url: https://hymnstogod.org/Hymns-PD/A-Hymns/Amazing-Grace.html
---

# Verse 1
Amazing grace, how sweet the sound
That saved a wretch like me

# Verse 2
'Twas grace that taught my heart to fear
And grace my fears relieved

# Chorus
When we've been there ten thousand years
Bright shining as the sun
```

## Lyrics Parsing Rules

1. Split raw text into stanzas by double newline
2. Detect section type:
   - Starts with number (1., 2., I., II.) → "Verse N"
   - Contains "Chorus" or "Refrain" marker → "Chorus"
   - Repeated stanza pattern → likely Chorus
3. Generate markdown with `# Section` headers
4. Fallback: ambiguous text → single "Verse 1" section

## Church Import Flow

```typescript
async function importHymnToChurch(hymnId: string, churchId: string) {
  // 1. Fetch global hymn
  const { data: hymn } = await supabase
    .from('songs')
    .select('*')
    .eq('id', hymnId)
    .is('church_id', null)
    .single();

  // 2. Copy to church library
  const { data: copy } = await supabase
    .from('songs')
    .insert({
      ...hymn,
      id: undefined,           // New UUID
      church_id: churchId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  return copy;
}
```

### What gets copied
- title, author (lyricist), composer
- lyrics (markdown)
- is_public_domain, source_url

### What church can customize
- key, tempo
- default_background_id, default_arrangement
- tags
- lyrics (can edit formatting)

## Error Handling

### Scraper resilience

```typescript
interface ScrapeResult {
  succeeded: ScrapedHymn[];
  failed: { url: string; error: string }[];
}
```

- Log individual failures, continue to next hymn
- Don't abort entire import for one bad page
- Report failures at end for manual review

### Edge function security

```typescript
// Require admin role
const { data: { user } } = await supabase.auth.getUser(token);
const role = await getUserRole(user.id);
if (role !== 'admin') {
  return new Response('Forbidden', { status: 403 });
}
```

### Idempotency

- Check `source_url` before inserting
- Skip hymns already in database
- Safe to re-run without duplicates

## Future Enhancements

- Add PDHymns.com as second source
- Selective imports from Hymnary.org
- Full-text search on global library
- "Popular hymns" sorting by import count
