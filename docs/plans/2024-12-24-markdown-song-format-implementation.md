# Markdown Song Format Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace JSONB song storage with markdown format using YAML frontmatter and `#` section headers.

**Architecture:** Songs stored as plain TEXT with YAML frontmatter for metadata (title, author, key, tempo, etc.) and `# SectionName` headers for lyrics sections. Parser converts to/from structured data for rendering. Editor uses hybrid form fields + textarea approach.

**Tech Stack:** TypeScript, Vitest (new), Supabase migrations, React

---

## Task 1: Set Up Vitest for Shared Package

**Files:**
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/utils/__tests__/markdown-song.test.ts`
- Modify: `packages/shared/package.json`

**Step 1: Add vitest dependencies**

```bash
cd packages/shared && pnpm add -D vitest
```

**Step 2: Create vitest config**

Create `packages/shared/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

**Step 3: Add test script to package.json**

In `packages/shared/package.json`, add to scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Create test file with first failing test**

Create `packages/shared/src/utils/__tests__/markdown-song.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSongMarkdown } from '../markdown-song';

describe('parseSongMarkdown', () => {
  it('parses minimal song with just title', () => {
    const markdown = `---
title: Test Song
---

# Verse
Hello world`;

    const result = parseSongMarkdown(markdown);

    expect(result.metadata.title).toBe('Test Song');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].label).toBe('Verse 1');
    expect(result.sections[0].lines).toEqual(['Hello world']);
  });
});
```

**Step 5: Run test to verify it fails**

```bash
cd packages/shared && pnpm test
```

Expected: FAIL with "Cannot find module '../markdown-song'"

**Step 6: Commit**

```bash
git add packages/shared/vitest.config.ts packages/shared/package.json packages/shared/src/utils/__tests__
git commit -m "test: set up vitest for shared package with first failing test"
```

---

## Task 2: Implement Core Parser - Metadata Extraction

**Files:**
- Create: `packages/shared/src/utils/markdown-song.ts`

**Step 1: Create parser file with types and metadata parsing**

Create `packages/shared/src/utils/markdown-song.ts`:

```typescript
export interface SongMetadata {
  title: string;
  author?: string;
  ccli?: string;
  key?: string;
  tempo?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface SongSection {
  type: string;
  label: string;
  lines: string[];
}

export interface ParsedSong {
  metadata: SongMetadata;
  sections: SongSection[];
}

/**
 * Parse YAML frontmatter from markdown string
 */
function parseFrontmatter(markdown: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: markdown };
  }

  const yamlContent = match[1];
  const body = match[2];

  // Simple YAML parser for our use case
  const metadata: Record<string, unknown> = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Handle arrays like [tag1, tag2]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim());
    }
    // Handle numbers
    else if (typeof value === 'string' && /^\d+$/.test(value)) {
      value = parseInt(value, 10);
    }

    metadata[key] = value;
  }

  return { metadata, body };
}

/**
 * Parse section headers and content from markdown body
 */
function parseSections(body: string): SongSection[] {
  const sections: SongSection[] = [];
  const sectionRegex = /^#\s+(.+)$/gm;
  const parts = body.split(sectionRegex);

  // parts[0] is content before first header (usually empty)
  // parts[1] is first header, parts[2] is content after first header, etc.
  for (let i = 1; i < parts.length; i += 2) {
    const headerText = parts[i].trim();
    const content = parts[i + 1] || '';
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length > 0) {
      sections.push({
        type: headerText,
        label: headerText, // Will be processed for auto-numbering
        lines,
      });
    }
  }

  return sections;
}

/**
 * Apply auto-numbering to sections with bare type names
 */
function applyAutoNumbering(sections: SongSection[]): SongSection[] {
  const typeCounts: Record<string, number> = {};

  return sections.map((section) => {
    const lowerType = section.type.toLowerCase();

    // Check if already has a number
    const hasNumber = /\d+$/.test(section.type);
    if (hasNumber) {
      return section;
    }

    // Auto-number common section types
    const numberableTypes = ['verse', 'chorus', 'bridge', 'pre-chorus', 'tag'];
    const isNumberable = numberableTypes.some(
      (t) => lowerType === t || lowerType.startsWith(t + ' ')
    );

    if (isNumberable && lowerType === section.type.toLowerCase()) {
      typeCounts[lowerType] = (typeCounts[lowerType] || 0) + 1;
      const count = typeCounts[lowerType];

      // Capitalize first letter
      const capitalizedType = section.type.charAt(0).toUpperCase() + section.type.slice(1).toLowerCase();
      return {
        ...section,
        label: `${capitalizedType} ${count}`,
      };
    }

    return section;
  });
}

/**
 * Parse markdown string into structured song data
 */
export function parseSongMarkdown(markdown: string): ParsedSong {
  const { metadata, body } = parseFrontmatter(markdown);

  if (!metadata.title) {
    throw new Error('Song must have a title in frontmatter');
  }

  const rawSections = parseSections(body);
  const sections = applyAutoNumbering(rawSections);

  return {
    metadata: metadata as SongMetadata,
    sections,
  };
}
```

**Step 2: Run the test**

```bash
cd packages/shared && pnpm test
```

Expected: PASS

**Step 3: Commit**

```bash
git add packages/shared/src/utils/markdown-song.ts
git commit -m "feat: implement markdown song parser with metadata extraction"
```

---

## Task 3: Add Parser Tests for Edge Cases

**Files:**
- Modify: `packages/shared/src/utils/__tests__/markdown-song.test.ts`

**Step 1: Add comprehensive tests**

Update `packages/shared/src/utils/__tests__/markdown-song.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseSongMarkdown } from '../markdown-song';

describe('parseSongMarkdown', () => {
  it('parses minimal song with just title', () => {
    const markdown = `---
title: Test Song
---

# Verse
Hello world`;

    const result = parseSongMarkdown(markdown);

    expect(result.metadata.title).toBe('Test Song');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].label).toBe('Verse 1');
    expect(result.sections[0].lines).toEqual(['Hello world']);
  });

  it('parses full metadata', () => {
    const markdown = `---
title: Amazing Grace
author: John Newton
ccli: 1234567
key: G
tempo: 72
tags: [hymn, grace, classic]
customField: custom value
---

# Verse
Amazing grace`;

    const result = parseSongMarkdown(markdown);

    expect(result.metadata.title).toBe('Amazing Grace');
    expect(result.metadata.author).toBe('John Newton');
    expect(result.metadata.ccli).toBe('1234567');
    expect(result.metadata.key).toBe('G');
    expect(result.metadata.tempo).toBe(72);
    expect(result.metadata.tags).toEqual(['hymn', 'grace', 'classic']);
    expect(result.metadata.customField).toBe('custom value');
  });

  it('auto-numbers multiple verses', () => {
    const markdown = `---
title: Test
---

# Verse
First verse

# Verse
Second verse

# Verse
Third verse`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].label).toBe('Verse 1');
    expect(result.sections[1].label).toBe('Verse 2');
    expect(result.sections[2].label).toBe('Verse 3');
  });

  it('preserves explicit numbering', () => {
    const markdown = `---
title: Test
---

# Verse 1
First verse

# Chorus
The chorus

# Verse 2
Second verse`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].label).toBe('Verse 1');
    expect(result.sections[1].label).toBe('Chorus 1');
    expect(result.sections[2].label).toBe('Verse 2');
  });

  it('handles freeform section names', () => {
    const markdown = `---
title: Test
---

# Intro
Instrumental intro

# Verse
Main verse

# Turnaround
Musical break

# Outro
Ending`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].label).toBe('Intro');
    expect(result.sections[1].label).toBe('Verse 1');
    expect(result.sections[2].label).toBe('Turnaround');
    expect(result.sections[3].label).toBe('Outro');
  });

  it('parses multi-line sections', () => {
    const markdown = `---
title: Test
---

# Verse
Line one
Line two
Line three
Line four`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].lines).toEqual([
      'Line one',
      'Line two',
      'Line three',
      'Line four',
    ]);
  });

  it('throws error when title is missing', () => {
    const markdown = `---
author: Someone
---

# Verse
Hello`;

    expect(() => parseSongMarkdown(markdown)).toThrow('Song must have a title');
  });

  it('ignores blank lines between sections', () => {
    const markdown = `---
title: Test
---

# Verse
First verse


# Chorus
The chorus`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].lines).toEqual(['First verse']);
    expect(result.sections[1].lines).toEqual(['The chorus']);
  });
});
```

**Step 2: Run tests**

```bash
cd packages/shared && pnpm test
```

Expected: All tests PASS

**Step 3: Commit**

```bash
git add packages/shared/src/utils/__tests__/markdown-song.test.ts
git commit -m "test: add comprehensive parser tests for edge cases"
```

---

## Task 4: Implement Markdown Builder

**Files:**
- Modify: `packages/shared/src/utils/markdown-song.ts`
- Modify: `packages/shared/src/utils/__tests__/markdown-song.test.ts`

**Step 1: Add failing test for builder**

Add to test file:

```typescript
import { parseSongMarkdown, buildSongMarkdown } from '../markdown-song';

describe('buildSongMarkdown', () => {
  it('builds markdown from parsed song', () => {
    const song: ParsedSong = {
      metadata: {
        title: 'Test Song',
        author: 'Test Author',
        key: 'G',
      },
      sections: [
        { type: 'Verse', label: 'Verse 1', lines: ['Line one', 'Line two'] },
        { type: 'Chorus', label: 'Chorus', lines: ['Chorus line'] },
      ],
    };

    const markdown = buildSongMarkdown(song);

    expect(markdown).toContain('title: Test Song');
    expect(markdown).toContain('author: Test Author');
    expect(markdown).toContain('key: G');
    expect(markdown).toContain('# Verse');
    expect(markdown).toContain('Line one');
    expect(markdown).toContain('# Chorus');
  });

  it('round-trips correctly', () => {
    const original = `---
title: Amazing Grace
author: John Newton
key: G
tempo: 72
tags: [hymn, grace]
---

# Verse
Amazing grace how sweet the sound
That saved a wretch like me

# Chorus
I once was lost but now am found
Was blind but now I see`;

    const parsed = parseSongMarkdown(original);
    const rebuilt = buildSongMarkdown(parsed);
    const reparsed = parseSongMarkdown(rebuilt);

    expect(reparsed.metadata.title).toBe(parsed.metadata.title);
    expect(reparsed.metadata.author).toBe(parsed.metadata.author);
    expect(reparsed.sections.length).toBe(parsed.sections.length);
    expect(reparsed.sections[0].lines).toEqual(parsed.sections[0].lines);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/shared && pnpm test
```

Expected: FAIL with "buildSongMarkdown is not exported"

**Step 3: Implement buildSongMarkdown**

Add to `packages/shared/src/utils/markdown-song.ts`:

```typescript
/**
 * Build markdown string from structured song data
 */
export function buildSongMarkdown(song: ParsedSong): string {
  const lines: string[] = [];

  // Build frontmatter
  lines.push('---');
  lines.push(`title: ${song.metadata.title}`);

  if (song.metadata.author) {
    lines.push(`author: ${song.metadata.author}`);
  }
  if (song.metadata.ccli) {
    lines.push(`ccli: ${song.metadata.ccli}`);
  }
  if (song.metadata.key) {
    lines.push(`key: ${song.metadata.key}`);
  }
  if (song.metadata.tempo) {
    lines.push(`tempo: ${song.metadata.tempo}`);
  }
  if (song.metadata.tags && song.metadata.tags.length > 0) {
    lines.push(`tags: [${song.metadata.tags.join(', ')}]`);
  }

  // Add any custom fields
  const knownFields = ['title', 'author', 'ccli', 'key', 'tempo', 'tags'];
  for (const [key, value] of Object.entries(song.metadata)) {
    if (!knownFields.includes(key) && value !== undefined) {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');
  lines.push('');

  // Build sections
  for (const section of song.sections) {
    lines.push(`# ${section.type}`);
    for (const line of section.lines) {
      lines.push(line);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
```

**Step 4: Run tests**

```bash
cd packages/shared && pnpm test
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/shared/src/utils/markdown-song.ts packages/shared/src/utils/__tests__/markdown-song.test.ts
git commit -m "feat: implement markdown song builder with round-trip support"
```

---

## Task 5: Add Slide Generation Utility

**Files:**
- Modify: `packages/shared/src/utils/markdown-song.ts`
- Modify: `packages/shared/src/utils/__tests__/markdown-song.test.ts`

**Step 1: Add failing test**

Add to test file:

```typescript
import { parseSongMarkdown, buildSongMarkdown, songToSlides } from '../markdown-song';

describe('songToSlides', () => {
  it('splits sections into slides', () => {
    const markdown = `---
title: Test
---

# Verse
Line 1
Line 2
Line 3
Line 4
Line 5
Line 6`;

    const slides = songToSlides(markdown, 4);

    expect(slides).toHaveLength(2);
    expect(slides[0].sectionLabel).toBe('Verse 1');
    expect(slides[0].lines).toEqual(['Line 1', 'Line 2', 'Line 3', 'Line 4']);
    expect(slides[1].sectionLabel).toBe('Verse 1');
    expect(slides[1].lines).toEqual(['Line 5', 'Line 6']);
  });

  it('handles multiple sections', () => {
    const markdown = `---
title: Test
---

# Verse
Verse line 1
Verse line 2

# Chorus
Chorus line 1
Chorus line 2`;

    const slides = songToSlides(markdown, 4);

    expect(slides).toHaveLength(2);
    expect(slides[0].sectionLabel).toBe('Verse 1');
    expect(slides[1].sectionLabel).toBe('Chorus 1');
  });

  it('includes slide indices', () => {
    const markdown = `---
title: Test
---

# Verse
Line 1
Line 2

# Chorus
Line 1
Line 2`;

    const slides = songToSlides(markdown, 4);

    expect(slides[0].index).toBe(0);
    expect(slides[1].index).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd packages/shared && pnpm test
```

Expected: FAIL

**Step 3: Implement songToSlides**

Add to `packages/shared/src/utils/markdown-song.ts`:

```typescript
export interface Slide {
  sectionLabel: string;
  lines: string[];
  index: number;
}

/**
 * Convert song markdown to array of slides for display
 */
export function songToSlides(markdown: string, linesPerSlide = 4): Slide[] {
  const parsed = parseSongMarkdown(markdown);
  const slides: Slide[] = [];
  let index = 0;

  for (const section of parsed.sections) {
    // Split section lines into chunks
    for (let i = 0; i < section.lines.length; i += linesPerSlide) {
      slides.push({
        sectionLabel: section.label,
        lines: section.lines.slice(i, i + linesPerSlide),
        index: index++,
      });
    }
  }

  return slides;
}
```

**Step 4: Run tests**

```bash
cd packages/shared && pnpm test
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add packages/shared/src/utils/markdown-song.ts packages/shared/src/utils/__tests__/markdown-song.test.ts
git commit -m "feat: add slide generation utility for song display"
```

---

## Task 6: Update Exports and Types

**Files:**
- Modify: `packages/shared/src/utils/index.ts`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Update utils/index.ts**

Replace `packages/shared/src/utils/index.ts`:

```typescript
export {
  parseSongMarkdown,
  buildSongMarkdown,
  songToSlides,
  type ParsedSong,
  type SongMetadata,
  type SongSection,
  type Slide,
} from './markdown-song';
export { getContrastColor } from './colors';
```

**Step 2: Update types/index.ts**

Replace the song-related types in `packages/shared/src/types/index.ts`:

```typescript
// Re-export generated database types
export type { Database } from './database';

// Re-export song types from utils
export type {
  ParsedSong,
  SongMetadata,
  SongSection,
  Slide,
} from '../utils/markdown-song';

// Domain types
export type Role = 'admin' | 'editor' | 'operator';

export type Permission =
  | 'church:manage'
  | 'church:users'
  | 'songs:read'
  | 'songs:write'
  | 'media:read'
  | 'media:write'
  | 'events:read'
  | 'events:write'
  | 'control:operate'
  | 'integrations:manage';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'church:manage',
    'church:users',
    'songs:read',
    'songs:write',
    'media:read',
    'media:write',
    'events:read',
    'events:write',
    'control:operate',
    'integrations:manage',
  ],
  editor: [
    'songs:read',
    'songs:write',
    'media:read',
    'media:write',
    'events:read',
    'events:write',
    'control:operate',
  ],
  operator: ['songs:read', 'media:read', 'events:read', 'control:operate'],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

// Event item structure (stored in JSONB)
export type EventItemType = 'song' | 'scripture' | 'announcement' | 'video';

export interface EventItem {
  type: EventItemType;
  id: string;
  arrangement?: string[]; // Section labels for songs
  backgroundId?: string;
}

// Transition types
export type TransitionType = 'none' | 'fade' | 'slide-left' | 'slide-right' | 'dissolve';

// Attendance brackets for billing
export type AttendanceBracket = '<100' | '100-500' | '500-1000' | '1000+';
```

**Step 3: Run typecheck**

```bash
cd packages/shared && pnpm typecheck
```

Expected: PASS (may have errors in hooks that we'll fix next)

**Step 4: Commit**

```bash
git add packages/shared/src/utils/index.ts packages/shared/src/types/index.ts
git commit -m "refactor: update exports to use new markdown song types"
```

---

## Task 7: Create Database Migration

**Files:**
- Create: `supabase/migrations/20241224000000_markdown_songs.sql`

**Step 1: Create migration file**

Create `supabase/migrations/20241224000000_markdown_songs.sql`:

```sql
-- Migration: Convert songs from JSONB content to markdown TEXT lyrics
-- This is a fresh start migration (no data to migrate)

-- Drop the old content column
ALTER TABLE songs DROP COLUMN IF EXISTS content;

-- Add the new lyrics column
ALTER TABLE songs ADD COLUMN lyrics TEXT NOT NULL DEFAULT '';

-- Add comment for documentation
COMMENT ON COLUMN songs.lyrics IS 'Markdown format: YAML frontmatter for metadata, # headers for sections';
```

**Step 2: Commit**

```bash
git add supabase/migrations/20241224000000_markdown_songs.sql
git commit -m "feat: add migration to replace JSONB content with TEXT lyrics"
```

---

## Task 8: Update useSongs Hook

**Files:**
- Modify: `packages/shared/src/hooks/useSongs.ts`

**Step 1: Update the hook**

Replace `packages/shared/src/hooks/useSongs.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase } from './useSupabase';
import { useAuth } from './useAuth';

export function useSongs() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const songsQuery = useQuery({
    queryKey: ['songs', user?.churchId],
    queryFn: async () => {
      if (!user?.churchId) return [];
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('church_id', user.churchId)
        .order('title');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.churchId,
  });

  const createSong = useMutation({
    mutationFn: async (song: {
      title: string;
      author?: string;
      lyrics: string;
      ccliSongId?: string;
      key?: string;
      tempo?: number;
      tags?: string[];
    }) => {
      if (!user?.churchId) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('songs')
        .insert({
          church_id: user.churchId,
          title: song.title,
          author: song.author,
          lyrics: song.lyrics,
          ccli_song_id: song.ccliSongId,
          key: song.key,
          tempo: song.tempo,
          tags: song.tags,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', user?.churchId] });
    },
  });

  const updateSong = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      title?: string;
      author?: string;
      lyrics?: string;
      key?: string;
      tempo?: number;
      defaultBackgroundId?: string;
      transitionType?: string;
      tags?: string[];
      defaultArrangement?: string[];
    }) => {
      const { data, error } = await supabase
        .from('songs')
        .update({
          title: updates.title,
          author: updates.author,
          lyrics: updates.lyrics,
          key: updates.key,
          tempo: updates.tempo,
          default_background_id: updates.defaultBackgroundId,
          transition_type: updates.transitionType,
          tags: updates.tags,
          default_arrangement: updates.defaultArrangement,
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', user?.churchId] });
    },
  });

  const deleteSong = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('songs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', user?.churchId] });
    },
  });

  return {
    songs: songsQuery.data ?? [],
    isLoading: songsQuery.isLoading,
    error: songsQuery.error,
    createSong,
    updateSong,
    deleteSong,
  };
}
```

**Step 2: Commit**

```bash
git add packages/shared/src/hooks/useSongs.ts
git commit -m "refactor: update useSongs hook to use lyrics TEXT column"
```

---

## Task 9: Rewrite SongEditor Component

**Files:**
- Modify: `apps/web/src/components/SongEditor.tsx`

**Step 1: Rewrite SongEditor as hybrid form + textarea**

Replace `apps/web/src/components/SongEditor.tsx`:

```typescript
import { useState, useEffect } from 'react';
import type { SongMetadata } from '@mobileworship/shared';

interface SongEditorProps {
  lyrics: string;
  metadata: SongMetadata;
  onLyricsChange: (lyrics: string) => void;
  onMetadataChange: (metadata: SongMetadata) => void;
  readOnly?: boolean;
}

const KEY_OPTIONS = ['', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                     'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];

export function SongEditor({
  lyrics,
  metadata,
  onLyricsChange,
  onMetadataChange,
  readOnly = false,
}: SongEditorProps) {
  const [tagInput, setTagInput] = useState('');

  const updateMetadata = (updates: Partial<SongMetadata>) => {
    onMetadataChange({ ...metadata, ...updates });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !metadata.tags?.includes(tag)) {
      updateMetadata({ tags: [...(metadata.tags || []), tag] });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateMetadata({
      tags: metadata.tags?.filter((t) => t !== tagToRemove),
    });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-6">
      {/* Metadata Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div className="md:col-span-2">
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={metadata.title}
            onChange={(e) => updateMetadata({ title: e.target.value })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="Song title"
          />
        </div>

        {/* Author */}
        <div className="md:col-span-2">
          <label htmlFor="author" className="block text-sm font-medium mb-1">
            Author
          </label>
          <input
            id="author"
            type="text"
            value={metadata.author || ''}
            onChange={(e) => updateMetadata({ author: e.target.value || undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="Song author"
          />
        </div>

        {/* Key */}
        <div>
          <label htmlFor="key" className="block text-sm font-medium mb-1">
            Key
          </label>
          <select
            id="key"
            value={metadata.key || ''}
            onChange={(e) => updateMetadata({ key: e.target.value || undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
          >
            {KEY_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k || 'Select key...'}
              </option>
            ))}
          </select>
        </div>

        {/* Tempo */}
        <div>
          <label htmlFor="tempo" className="block text-sm font-medium mb-1">
            Tempo (BPM)
          </label>
          <input
            id="tempo"
            type="number"
            min="20"
            max="300"
            value={metadata.tempo || ''}
            onChange={(e) => updateMetadata({ tempo: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="72"
          />
        </div>

        {/* CCLI */}
        <div>
          <label htmlFor="ccli" className="block text-sm font-medium mb-1">
            CCLI Song #
          </label>
          <input
            id="ccli"
            type="text"
            value={metadata.ccli || ''}
            onChange={(e) => updateMetadata({ ccli: e.target.value || undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="1234567"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {metadata.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm"
              >
                {tag}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    &times;
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1 px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                placeholder="Add tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lyrics Section */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="lyrics" className="block text-sm font-medium">
            Lyrics
          </label>
          {!readOnly && (
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              title="AI Format (coming soon)"
              disabled
            >
              <span>AI</span>
              <span>✨</span>
            </button>
          )}
        </div>
        <textarea
          id="lyrics"
          value={lyrics}
          onChange={(e) => onLyricsChange(e.target.value)}
          disabled={readOnly}
          rows={16}
          className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 font-mono text-sm"
          placeholder={`# Verse
Amazing grace how sweet the sound
That saved a wretch like me

# Chorus
I once was lost but now am found
Was blind but now I see`}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Use # headers for sections: # Verse, # Chorus, # Bridge, etc.
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/SongEditor.tsx
git commit -m "refactor: rewrite SongEditor as hybrid metadata form + lyrics textarea"
```

---

## Task 10: Update SongDetailPage

**Files:**
- Modify: `apps/web/src/pages/SongDetailPage.tsx`

**Step 1: Update to use new editor**

Replace `apps/web/src/pages/SongDetailPage.tsx`:

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSongs, useAuth, useMedia, parseSongMarkdown, buildSongMarkdown } from '@mobileworship/shared';
import type { SongMetadata } from '@mobileworship/shared';
import { SongEditor } from '../components/SongEditor';
import { MediaPicker } from '../components/MediaPicker';

export function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { songs, updateSong, deleteSong } = useSongs();
  const { can } = useAuth();
  const { media, getPublicUrl } = useMedia();

  const song = songs.find((s) => s.id === id);

  // Local state for editing
  const [metadata, setMetadata] = useState<SongMetadata>({ title: '' });
  const [lyrics, setLyrics] = useState('');
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);

  // Parse song lyrics on load
  useEffect(() => {
    if (song) {
      try {
        if (song.lyrics) {
          const parsed = parseSongMarkdown(song.lyrics);
          setMetadata(parsed.metadata);
          // Extract just the lyrics body (without frontmatter)
          const bodyMatch = song.lyrics.match(/^---[\s\S]*?---\r?\n([\s\S]*)$/);
          setLyrics(bodyMatch ? bodyMatch[1].trim() : '');
        } else {
          setMetadata({ title: song.title, author: song.author || undefined });
          setLyrics('');
        }
      } catch {
        // Fallback for songs without proper markdown
        setMetadata({ title: song.title, author: song.author || undefined });
        setLyrics('');
      }
      setBackgroundId(song.default_background_id || null);
      setHasChanges(false);
    }
  }, [song]);

  // Track changes
  useEffect(() => {
    if (!song) return;

    const currentMarkdown = buildSongMarkdown({ metadata, sections: [] });
    const lyricsChanged = lyrics !== (song.lyrics?.match(/^---[\s\S]*?---\r?\n([\s\S]*)$/)?.[1]?.trim() || '');
    const metadataChanged = metadata.title !== song.title ||
                           metadata.author !== (song.author || undefined) ||
                           metadata.key !== (song.key || undefined) ||
                           metadata.tempo !== (song.tempo || undefined);
    const backgroundChanged = backgroundId !== (song.default_background_id || null);

    setHasChanges(lyricsChanged || metadataChanged || backgroundChanged);
  }, [metadata, lyrics, backgroundId, song]);

  if (!song) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Song not found</p>
        <Link
          to="/dashboard/songs"
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          Back to Songs
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;
    setError(null);

    if (!metadata.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      // Build full markdown
      const fullMarkdown = buildSongMarkdown({
        metadata,
        sections: [], // Sections are in the lyrics body
      }).replace(/---\n\n$/, `---\n\n${lyrics}`);

      await updateSong.mutateAsync({
        id,
        title: metadata.title.trim(),
        author: metadata.author?.trim() || undefined,
        lyrics: fullMarkdown,
        key: metadata.key,
        tempo: metadata.tempo,
        tags: metadata.tags,
        defaultBackgroundId: backgroundId || undefined,
      });
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save song');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${song.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await deleteSong.mutateAsync(id);
      navigate('/dashboard/songs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete song');
    }
  };

  const canEdit = can('songs:write');
  const isSaving = updateSong.isPending;
  const isDeleting = deleteSong.isPending;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard/songs"
          className="text-primary-600 hover:text-primary-700 hover:underline text-sm mb-4 inline-block"
        >
          &larr; Back to Songs
        </Link>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Song</h2>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="px-4 py-2 border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || isDeleting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Song Editor */}
      <SongEditor
        metadata={metadata}
        lyrics={lyrics}
        onMetadataChange={setMetadata}
        onLyricsChange={setLyrics}
        readOnly={!canEdit || isSaving || isDeleting}
      />

      {/* Background Section */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">Background</label>
        <div className="flex items-start gap-4">
          {backgroundId ? (
            <div className="relative w-48 aspect-video rounded-lg overflow-hidden border dark:border-gray-700">
              {(() => {
                const backgroundMedia = media.find((m) => m.id === backgroundId);
                if (!backgroundMedia) {
                  return (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">Not found</span>
                    </div>
                  );
                }
                const publicUrl = getPublicUrl(backgroundMedia.storage_path);
                return (
                  <img src={publicUrl} alt="Background" className="w-full h-full object-cover" />
                );
              })()}
            </div>
          ) : (
            <div className="w-48 aspect-video rounded-lg bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 flex items-center justify-center">
              <span className="text-gray-400 text-sm">No background</span>
            </div>
          )}
          <button
            onClick={() => setIsMediaPickerOpen(true)}
            disabled={!canEdit || isSaving || isDeleting}
            className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            Change Background
          </button>
        </div>
      </div>

      <MediaPicker
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={setBackgroundId}
        selectedId={backgroundId || undefined}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/pages/SongDetailPage.tsx
git commit -m "refactor: update SongDetailPage to use markdown format"
```

---

## Task 11: Simplify CreateSongModal

**Files:**
- Modify: `apps/web/src/components/CreateSongModal.tsx`

**Step 1: Simplify to title + lyrics only**

Replace `apps/web/src/components/CreateSongModal.tsx`:

```typescript
import { useState, FormEvent } from 'react';
import { useSongs, buildSongMarkdown } from '@mobileworship/shared';

interface CreateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSongModal({ isOpen, onClose }: CreateSongModalProps) {
  const { createSong } = useSongs();
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      // Build markdown with title and lyrics
      const markdown = buildSongMarkdown({
        metadata: { title: title.trim() },
        sections: [],
      }).replace(/---\n\n$/, `---\n\n${lyrics.trim()}`);

      await createSong.mutateAsync({
        title: title.trim(),
        lyrics: markdown,
      });

      setTitle('');
      setLyrics('');
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create song');
    }
  };

  const handleClose = () => {
    if (!createSong.isPending) {
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-semibold">Create New Song</h2>
          <button
            onClick={handleClose}
            disabled={createSong.isPending}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={createSong.isPending}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
                placeholder="Enter song title"
                autoFocus
              />
            </div>

            {/* Lyrics */}
            <div>
              <label htmlFor="lyrics" className="block text-sm font-medium mb-1">
                Lyrics
              </label>
              <textarea
                id="lyrics"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                disabled={createSong.isPending}
                rows={12}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 font-mono text-sm"
                placeholder={`# Verse
Amazing grace how sweet the sound
That saved a wretch like me

# Chorus
I once was lost but now am found`}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use # headers for sections. Add more details after creation.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={createSong.isPending}
              className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSong.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {createSong.isPending ? 'Creating...' : 'Create Song'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/CreateSongModal.tsx
git commit -m "refactor: simplify CreateSongModal to title + lyrics"
```

---

## Task 12: Delete Old Lyrics Utility

**Files:**
- Delete: `packages/shared/src/utils/lyrics.ts`

**Step 1: Delete the file**

```bash
rm packages/shared/src/utils/lyrics.ts
```

**Step 2: Commit**

```bash
git add -u packages/shared/src/utils/lyrics.ts
git commit -m "chore: remove old lyrics.ts utility (replaced by markdown-song.ts)"
```

---

## Task 13: Update Shared Package Exports

**Files:**
- Modify: `packages/shared/src/index.ts`

**Step 1: Update main exports**

Update `packages/shared/src/index.ts` to export the new functions:

```typescript
// Types
export * from './types';

// Hooks
export * from './hooks';

// Utils
export {
  parseSongMarkdown,
  buildSongMarkdown,
  songToSlides,
} from './utils/markdown-song';
export { getContrastColor } from './utils/colors';
```

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

**Step 3: Commit**

```bash
git add packages/shared/src/index.ts
git commit -m "refactor: update shared package exports for markdown song format"
```

---

## Task 14: Run Full Build and Tests

**Step 1: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 2: Run typecheck**

```bash
pnpm typecheck
```

Expected: No type errors

**Step 3: Run build**

```bash
pnpm build
```

Expected: Build succeeds

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete markdown song format implementation"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Set up Vitest for shared package |
| 2 | Implement core parser with metadata extraction |
| 3 | Add comprehensive parser tests |
| 4 | Implement markdown builder |
| 5 | Add slide generation utility |
| 6 | Update exports and types |
| 7 | Create database migration |
| 8 | Update useSongs hook |
| 9 | Rewrite SongEditor component |
| 10 | Update SongDetailPage |
| 11 | Simplify CreateSongModal |
| 12 | Delete old lyrics utility |
| 13 | Update shared package exports |
| 14 | Run full build and tests |
