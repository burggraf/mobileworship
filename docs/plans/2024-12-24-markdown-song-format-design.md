# Markdown Song Format Design

## Overview

Replace the current JSONB song storage with a simpler markdown format. Songs are stored as plain text with YAML frontmatter for metadata and `#` headers for sections.

## Format Specification

### Example Song

```markdown
---
title: Amazing Grace
author: John Newton
ccli: 1234567
key: G
tempo: 72
tags: [hymn, grace]
---

# Verse
Amazing grace how sweet the sound
That saved a wretch like me

# Verse
I once was lost but now am found
Was blind but now I see

# Chorus
'Twas grace that taught my heart to fear
And grace my fears relieved
```

### Frontmatter Rules

- Enclosed between `---` markers
- `title` is the only required field
- All other fields are optional: `author`, `ccli`, `key`, `tempo`, `tags`
- Additional custom fields are preserved (extensible metadata)

### Section Rules

- Sections start with `# SectionName`
- Section names are freeform - any `# Whatever` is valid
- Common names: Verse, Chorus, Bridge, Pre-Chorus, Tag, Intro, Outro, Instrumental
- Auto-numbering: bare `# Verse` becomes "Verse 1", "Verse 2" by order of appearance
- Explicit numbering honored: `# Verse 1` stays as-is
- Blank lines between sections are ignored
- All lines under a header until the next header are lyrics

## Database Schema

### Changes to `songs` table

```sql
-- Drop the JSONB content column
ALTER TABLE songs DROP COLUMN content;

-- Add plain text lyrics column
ALTER TABLE songs ADD COLUMN lyrics TEXT NOT NULL DEFAULT '';
```

### Columns remaining in songs table

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `church_id` | UUID | Multi-tenant isolation |
| `title` | TEXT | Song title (denormalized for queries) |
| `author` | TEXT | Song author (denormalized for queries) |
| `ccli_song_id` | TEXT | CCLI reference |
| `key` | TEXT | Musical key |
| `tempo` | INTEGER | BPM |
| `lyrics` | TEXT | **New** - Full markdown content |
| `default_arrangement` | JSONB | Section order for default playback |
| `default_background_id` | UUID | Default background media |
| `transition_type` | TEXT | Slide transition style |
| `tags` | TEXT[] | Searchable tags |
| `last_used_at` | TIMESTAMPTZ | For "recently used" sorting |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

Note: `title`, `author`, `key`, `tempo`, `tags` are stored both in markdown frontmatter AND as columns for efficient querying/filtering. The markdown is the source of truth; columns are synced on save.

## Parser Implementation

### New file: `packages/shared/src/utils/markdown-song.ts`

```typescript
interface SongMetadata {
  title: string;
  author?: string;
  ccli?: string;
  key?: string;
  tempo?: number;
  tags?: string[];
  [key: string]: unknown; // extensible
}

interface SongSection {
  type: string;      // raw header text, e.g., "Verse" or "Verse 1"
  label: string;     // display label, e.g., "Verse 1" (auto-numbered if needed)
  lines: string[];
}

interface ParsedSong {
  metadata: SongMetadata;
  sections: SongSection[];
}

// Parse markdown string → structured data (for rendering slides)
function parseSongMarkdown(markdown: string): ParsedSong

// Build markdown string ← structured data (for saving from editor)
function buildSongMarkdown(song: ParsedSong): string

// Extract just metadata without full parse (for list views, if needed)
function extractSongMetadata(markdown: string): SongMetadata
```

### Auto-numbering Logic

1. Track count per section type: `{ verse: 0, chorus: 0, ... }`
2. If header is bare (e.g., `# Verse`), increment counter and label as "Verse 1"
3. If header already has number (e.g., `# Verse 1`), use as-is
4. Non-standard headers (e.g., `# Instrumental`) used verbatim, no numbering

## Slide Rendering

### Slide Structure

```typescript
interface Slide {
  sectionLabel: string;  // "Verse 1", "Chorus", etc.
  lines: string[];       // 2-4 lines of lyrics per slide
  index: number;         // slide number within song
}

function songToSlides(markdown: string, linesPerSlide = 4): Slide[]
```

### Arrangement

- `default_arrangement` JSONB column stores section references by label
- Example: `["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"]`
- When building slides, follow arrangement order if set; otherwise use document order

## Editor UI

### Hybrid Approach

Form fields for metadata (validated inputs) + raw textarea for lyrics markdown.

```
┌─────────────────────────────────────────────────────────────┐
│  Song Details                                               │
├─────────────────────────────────────────────────────────────┤
│  Title: [________________________] * required               │
│  Author: [_______________________]                          │
│                                                             │
│  Key: [G v]    Tempo: [72]    CCLI: [_______]              │
│                                                             │
│  Tags: [hymn] [grace] [+ Add]                              │
├─────────────────────────────────────────────────────────────┤
│  Lyrics                                            [AI ✨]  │
├─────────────────────────────────────────────────────────────┤
│  # Verse                                                    │
│  Amazing grace how sweet the sound                          │
│  That saved a wretch like me                                │
│                                                             │
│  # Chorus                                                   │
│  I once was lost but now am found                          │
│  (monospace textarea)                                       │
└─────────────────────────────────────────────────────────────┘
```

### Behaviors

- On load: parse markdown, populate form fields + textarea separately
- On save: combine form fields + textarea into full markdown
- "AI" button calls `ai-format-lyrics` to clean up pasted text
- Create modal simplified: just title + lyrics textarea

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: drop `content`, add `lyrics` |
| `packages/shared/src/utils/markdown-song.ts` | **New** - parser & builder |
| `packages/shared/src/utils/lyrics.ts` | **Delete** - replaced |
| `packages/shared/src/types/index.ts` | Update types |
| `packages/shared/src/hooks/useSongs.ts` | Use `lyrics` column |
| `apps/web/src/components/SongEditor.tsx` | Rewrite: hybrid editor |
| `apps/web/src/components/CreateSongModal.tsx` | Simplify |
| `apps/web/src/pages/SongDetailPage.tsx` | Use new editor |
| `supabase/functions/ai-format-lyrics/` | Return markdown format |
| `packages/shared/src/types/database.ts` | Regenerate |

## What Stays the Same

- Protocol messages (still send slide data to host)
- Host display rendering
- Media, events, users tables
- Authentication and RLS policies
- All other edge functions
