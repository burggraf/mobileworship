# Hymn Import System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import ~800 public domain hymns from HymnsToGod.org into a shared global library that churches can browse and copy.

**Architecture:** Local Deno scraper for development/testing, Supabase Edge Function for production. Hymns stored with `church_id = NULL` as global library. Deterministic lyrics parser (no AI) converts raw text to markdown sections.

**Tech Stack:** Deno, Supabase Edge Functions, PostgreSQL, TypeScript

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20241224100000_hymn_import_columns.sql`

**Step 1: Write the migration**

```sql
-- Add columns for hymn attribution and source tracking
ALTER TABLE songs ADD COLUMN IF NOT EXISTS composer TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_public_domain BOOLEAN DEFAULT false;

-- Allow reading global hymns (church_id IS NULL) for all authenticated users
CREATE POLICY "Anyone can view global hymns" ON songs
  FOR SELECT USING (church_id IS NULL);

-- Index for efficient global hymn browsing
CREATE INDEX IF NOT EXISTS idx_songs_global ON songs(title) WHERE church_id IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN songs.composer IS 'Music composer (distinct from author/lyricist)';
COMMENT ON COLUMN songs.source_url IS 'Original source URL for imported songs';
COMMENT ON COLUMN songs.is_public_domain IS 'True if song is in public domain (no licensing required)';
```

**Step 2: Apply the migration**

Run: `pnpm db:migrate`
Expected: Migration applies successfully

**Step 3: Regenerate TypeScript types**

Run: `pnpm db:types`
Expected: `packages/shared/src/types/database.ts` updated with new columns

**Step 4: Commit**

```bash
git add supabase/migrations/20241224100000_hymn_import_columns.sql packages/shared/src/types/database.ts
git commit -m "feat(db): add composer, source_url, is_public_domain columns for hymn imports"
```

---

## Task 2: Lyrics Formatter Module

**Files:**
- Create: `scripts/lib/formatter.ts`

**Step 1: Create the formatter with tests inline**

```typescript
/**
 * Converts raw hymn lyrics to markdown format with section headers.
 * Detects verses, choruses, and refrains from common patterns.
 */

export interface FormattedLyrics {
  markdown: string;
  sectionCount: number;
}

/**
 * Detect if a line is a section marker and return its type
 */
function parseSectionMarker(line: string): { type: string; number?: number } | null {
  const trimmed = line.trim();

  // Numbered verse: "1.", "2.", "1)", "Verse 1", etc.
  const arabicMatch = trimmed.match(/^(\d+)[.\)]\s*$/);
  if (arabicMatch) {
    return { type: 'Verse', number: parseInt(arabicMatch[1]) };
  }

  const verseMatch = trimmed.match(/^verse\s*(\d+)/i);
  if (verseMatch) {
    return { type: 'Verse', number: parseInt(verseMatch[1]) };
  }

  // Roman numerals: "I.", "II.", "III.", etc.
  const romanMatch = trimmed.match(/^(I{1,3}|IV|V|VI{0,3}|IX|X)[.\)]\s*$/i);
  if (romanMatch) {
    const romanToArabic: Record<string, number> = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
      'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
    };
    return { type: 'Verse', number: romanToArabic[romanMatch[1].toUpperCase()] || 1 };
  }

  // Chorus/Refrain markers
  if (/^(chorus|refrain)[:\s]*$/i.test(trimmed)) {
    return { type: 'Chorus' };
  }

  // Bridge marker
  if (/^bridge[:\s]*$/i.test(trimmed)) {
    return { type: 'Bridge' };
  }

  return null;
}

/**
 * Format raw lyrics text into markdown with section headers
 */
export function formatLyrics(rawText: string, sourceUrl: string): FormattedLyrics {
  const lines = rawText.split('\n');
  const sections: { header: string; lines: string[] }[] = [];
  let currentSection: { header: string; lines: string[] } | null = null;
  let verseCount = 0;
  let hasExplicitMarkers = false;

  for (const line of lines) {
    const marker = parseSectionMarker(line);

    if (marker) {
      hasExplicitMarkers = true;
      // Start new section
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      const header = marker.number ? `${marker.type} ${marker.number}` : marker.type;
      if (marker.type === 'Verse') verseCount = marker.number || verseCount + 1;
      currentSection = { header, lines: [] };
    } else if (line.trim() === '') {
      // Blank line - might be section separator if no explicit markers
      if (currentSection && currentSection.lines.length > 0 && !hasExplicitMarkers) {
        sections.push(currentSection);
        verseCount++;
        currentSection = { header: `Verse ${verseCount + 1}`, lines: [] };
      }
    } else {
      // Content line
      if (!currentSection) {
        verseCount = 1;
        currentSection = { header: 'Verse 1', lines: [] };
      }
      currentSection.lines.push(line.trim());
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  // Build markdown
  const frontmatter = `---
source: hymnstogod.org
source_url: ${sourceUrl}
---`;

  const body = sections
    .map(s => `# ${s.header}\n${s.lines.join('\n')}`)
    .join('\n\n');

  return {
    markdown: `${frontmatter}\n\n${body}`,
    sectionCount: sections.length
  };
}

// Simple test runner for development
if (import.meta.main) {
  const testLyrics = `1.
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind but now I see

2.
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed`;

  const result = formatLyrics(testLyrics, 'https://example.com/test');
  console.log('=== Formatter Test ===');
  console.log(result.markdown);
  console.log(`\nSection count: ${result.sectionCount}`);
}
```

**Step 2: Test the formatter**

Run: `deno run scripts/lib/formatter.ts`
Expected: Output shows formatted markdown with Verse 1 and Verse 2 headers

**Step 3: Commit**

```bash
git add scripts/lib/formatter.ts
git commit -m "feat(scripts): add lyrics formatter module"
```

---

## Task 3: HTML Parser Module

**Files:**
- Create: `scripts/lib/parser.ts`

**Step 1: Create the HTML parser**

```typescript
/**
 * Parses hymn data from HymnsToGod.org HTML pages.
 */

export interface ParsedHymn {
  title: string;
  author: string | null;
  composer: string | null;
  lyrics: string;
  sourceUrl: string;
}

/**
 * Extract hymn URLs from the complete list page HTML
 */
export function parseHymnList(html: string, baseUrl: string): string[] {
  const urls: string[] = [];

  // Match href patterns like "./A-Hymns/Amazing-Grace.html"
  const linkPattern = /href="\.\/([A-Z]-Hymns\/[^"]+\.html)"/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const relativePath = match[1];
    const fullUrl = `${baseUrl}/${relativePath}`;
    urls.push(fullUrl);
  }

  return [...new Set(urls)]; // Remove duplicates
}

/**
 * Parse a single hymn page HTML to extract metadata and lyrics
 */
export function parseHymnPage(html: string, sourceUrl: string): ParsedHymn | null {
  try {
    // Extract title - usually in <title> or <h1>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const rawTitle = titleMatch?.[1]?.trim() || 'Unknown Hymn';
    // Clean title - remove site name suffix if present
    const title = rawTitle.replace(/\s*[-|].*$/, '').trim();

    // Extract author (lyricist) - look for "Lyrics:" or "Words:" pattern
    const authorMatch = html.match(/(?:Lyrics|Words)[:\s]*([^<\n]+)/i);
    const author = authorMatch?.[1]?.trim().replace(/^by\s+/i, '') || null;

    // Extract composer - look for "Music:" or "Tune:" pattern
    const composerMatch = html.match(/(?:Music|Tune|Composer)[:\s]*([^<\n]+)/i);
    const composer = composerMatch?.[1]?.trim() || null;

    // Extract lyrics - find the main content area
    // HymnsToGod uses plain text between metadata and footer
    let lyrics = '';

    // Try to find lyrics in a pre tag or main content div
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) {
      lyrics = preMatch[1];
    } else {
      // Extract text between common boundaries
      // Look for content after metadata, before footer/navigation
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        let content = bodyMatch[1];
        // Remove script, style, nav elements
        content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
        content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
        content = content.replace(/<nav[\s\S]*?<\/nav>/gi, '');
        // Remove HTML tags but keep line breaks
        content = content.replace(/<br\s*\/?>/gi, '\n');
        content = content.replace(/<\/p>/gi, '\n\n');
        content = content.replace(/<\/div>/gi, '\n');
        content = content.replace(/<[^>]+>/g, '');
        // Decode HTML entities
        content = content.replace(/&nbsp;/g, ' ');
        content = content.replace(/&amp;/g, '&');
        content = content.replace(/&lt;/g, '<');
        content = content.replace(/&gt;/g, '>');
        content = content.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));

        // Find the lyrics section - usually after metadata, contains numbered verses
        const lines = content.split('\n').map(l => l.trim()).filter(l => l);
        let inLyrics = false;
        const lyricLines: string[] = [];

        for (const line of lines) {
          // Start capturing at first verse number
          if (/^[1IVX][\.\)]/.test(line) || /^verse\s*\d/i.test(line)) {
            inLyrics = true;
          }
          // Stop at footer markers
          if (/copyright|all rights|hymns to god|public domain/i.test(line) && inLyrics) {
            break;
          }
          if (inLyrics) {
            lyricLines.push(line);
          }
        }

        lyrics = lyricLines.join('\n');
      }
    }

    if (!lyrics.trim()) {
      return null; // No lyrics found
    }

    return {
      title,
      author,
      composer,
      lyrics: lyrics.trim(),
      sourceUrl
    };
  } catch (error) {
    console.error(`Failed to parse ${sourceUrl}:`, error);
    return null;
  }
}

// Test runner
if (import.meta.main) {
  console.log('Parser module loaded. Use with scraper.ts');
}
```

**Step 2: Commit**

```bash
git add scripts/lib/parser.ts
git commit -m "feat(scripts): add HTML parser module for HymnsToGod.org"
```

---

## Task 4: Scraper Module

**Files:**
- Create: `scripts/lib/scraper.ts`

**Step 1: Create the scraper**

```typescript
/**
 * Fetches hymns from HymnsToGod.org with rate limiting and error handling.
 */

import { parseHymnList, parseHymnPage, ParsedHymn } from './parser.ts';
import { formatLyrics } from './formatter.ts';

export interface ScrapedHymn {
  title: string;
  author: string | null;
  composer: string | null;
  lyrics: string; // Markdown format
  sourceUrl: string;
  isPublicDomain: true;
}

export interface ScrapeResult {
  succeeded: ScrapedHymn[];
  failed: { url: string; error: string }[];
}

const BASE_URL = 'https://hymnstogod.org/Hymns-PD';
const LIST_URL = `${BASE_URL}/ZZ-CompletePDHymnList.html`;
const DELAY_MS = 100; // Be polite to the server

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and error handling
 */
async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Scrape all hymns from HymnsToGod.org
 */
export async function scrapeAllHymns(
  options: {
    limit?: number;
    onProgress?: (current: number, total: number, title: string) => void;
  } = {}
): Promise<ScrapeResult> {
  const { limit, onProgress } = options;
  const result: ScrapeResult = { succeeded: [], failed: [] };

  // Step 1: Get list of all hymn URLs
  console.log('Fetching hymn list...');
  const listHtml = await fetchWithTimeout(LIST_URL);
  let urls = parseHymnList(listHtml, BASE_URL);

  console.log(`Found ${urls.length} hymn URLs`);

  if (limit && limit > 0) {
    urls = urls.slice(0, limit);
    console.log(`Limited to first ${limit} hymns`);
  }

  // Step 2: Fetch each hymn page
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];

    try {
      const html = await fetchWithTimeout(url);
      const parsed = parseHymnPage(html, url);

      if (!parsed) {
        result.failed.push({ url, error: 'Failed to parse page content' });
        continue;
      }

      const formatted = formatLyrics(parsed.lyrics, url);

      const hymn: ScrapedHymn = {
        title: parsed.title,
        author: parsed.author,
        composer: parsed.composer,
        lyrics: formatted.markdown,
        sourceUrl: url,
        isPublicDomain: true
      };

      result.succeeded.push(hymn);
      onProgress?.(i + 1, urls.length, parsed.title);

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ url, error: message });
    }

    // Rate limiting
    if (i < urls.length - 1) {
      await delay(DELAY_MS);
    }
  }

  return result;
}

// Test runner
if (import.meta.main) {
  console.log('Testing scraper with limit=3...');
  const result = await scrapeAllHymns({
    limit: 3,
    onProgress: (current, total, title) => {
      console.log(`[${current}/${total}] ${title}`);
    }
  });

  console.log(`\nSucceeded: ${result.succeeded.length}`);
  console.log(`Failed: ${result.failed.length}`);

  if (result.succeeded.length > 0) {
    console.log('\n=== First hymn ===');
    console.log(JSON.stringify(result.succeeded[0], null, 2));
  }

  if (result.failed.length > 0) {
    console.log('\n=== Failures ===');
    console.log(result.failed);
  }
}
```

**Step 2: Test the scraper with a small limit**

Run: `deno run --allow-net scripts/lib/scraper.ts`
Expected: Successfully scrapes 3 hymns and displays first one

**Step 3: Commit**

```bash
git add scripts/lib/scraper.ts
git commit -m "feat(scripts): add hymn scraper with rate limiting"
```

---

## Task 5: CLI Import Script

**Files:**
- Create: `scripts/import-hymns.ts`

**Step 1: Create the CLI script**

```typescript
#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * CLI script to import hymns from HymnsToGod.org into Supabase.
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/import-hymns.ts [options]
 *
 * Options:
 *   --limit=N       Only import first N hymns (for testing)
 *   --dry-run       Scrape and validate but don't insert to database
 *   --output=FILE   Write scraped data to JSON file
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { scrapeAllHymns, ScrapedHymn } from './lib/scraper.ts';

interface ImportOptions {
  limit?: number;
  dryRun: boolean;
  outputFile?: string;
}

function parseArgs(): ImportOptions {
  const args = Deno.args;
  const options: ImportOptions = { dryRun: false };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--output=')) {
      options.outputFile = arg.split('=')[1];
    }
  }

  return options;
}

async function loadEnv(): Promise<void> {
  try {
    const envText = await Deno.readTextFile('.env');
    for (const line of envText.split('\n')) {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#')) {
        const value = valueParts.join('=').trim();
        if (value) {
          Deno.env.set(key.trim(), value.replace(/^["']|["']$/g, ''));
        }
      }
    }
  } catch {
    // .env file not found, rely on environment variables
  }
}

async function insertHymns(hymns: ScrapedHymn[]): Promise<{ inserted: number; skipped: number; errors: string[] }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get existing hymns by source_url to avoid duplicates
  const { data: existing } = await supabase
    .from('songs')
    .select('source_url')
    .is('church_id', null)
    .not('source_url', 'is', null);

  const existingUrls = new Set(existing?.map(s => s.source_url) || []);

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const hymn of hymns) {
    if (existingUrls.has(hymn.sourceUrl)) {
      skipped++;
      continue;
    }

    const { error } = await supabase.from('songs').insert({
      church_id: null, // Global library
      title: hymn.title,
      author: hymn.author,
      composer: hymn.composer,
      lyrics: hymn.lyrics,
      source_url: hymn.sourceUrl,
      is_public_domain: true,
      tags: ['hymn', 'public-domain']
    });

    if (error) {
      errors.push(`${hymn.title}: ${error.message}`);
    } else {
      inserted++;
    }
  }

  return { inserted, skipped, errors };
}

async function main() {
  await loadEnv();
  const options = parseArgs();

  console.log('🎵 Hymn Import Tool');
  console.log('==================');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (options.limit) console.log(`Limit: ${options.limit} hymns`);
  console.log('');

  // Scrape hymns
  const result = await scrapeAllHymns({
    limit: options.limit,
    onProgress: (current, total, title) => {
      const pct = Math.round((current / total) * 100);
      console.log(`[${pct}%] ${current}/${total}: ${title}`);
    }
  });

  console.log('');
  console.log(`✅ Scraped: ${result.succeeded.length} hymns`);
  console.log(`❌ Failed: ${result.failed.length} hymns`);

  // Save to file if requested
  if (options.outputFile) {
    await Deno.writeTextFile(options.outputFile, JSON.stringify(result, null, 2));
    console.log(`📄 Saved to: ${options.outputFile}`);
  }

  // Show failures
  if (result.failed.length > 0) {
    console.log('\nFailed URLs:');
    for (const { url, error } of result.failed.slice(0, 10)) {
      console.log(`  - ${url}: ${error}`);
    }
    if (result.failed.length > 10) {
      console.log(`  ... and ${result.failed.length - 10} more`);
    }
  }

  // Insert to database
  if (!options.dryRun && result.succeeded.length > 0) {
    console.log('\nInserting to database...');
    const dbResult = await insertHymns(result.succeeded);
    console.log(`  Inserted: ${dbResult.inserted}`);
    console.log(`  Skipped (duplicates): ${dbResult.skipped}`);
    if (dbResult.errors.length > 0) {
      console.log(`  Errors: ${dbResult.errors.length}`);
      for (const err of dbResult.errors.slice(0, 5)) {
        console.log(`    - ${err}`);
      }
    }
  }

  console.log('\n✨ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  Deno.exit(1);
});
```

**Step 2: Test with dry run**

Run: `deno run --allow-net --allow-env --allow-read scripts/import-hymns.ts --limit=5 --dry-run`
Expected: Scrapes 5 hymns, shows progress, does not insert to DB

**Step 3: Commit**

```bash
git add scripts/import-hymns.ts
git commit -m "feat(scripts): add CLI import script for hymns"
```

---

## Task 6: Edge Function for Production

**Files:**
- Create: `supabase/functions/import-hymns/index.ts`

**Step 1: Create the edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportRequest {
  limit?: number;
  dryRun?: boolean;
}

interface ScrapedHymn {
  title: string;
  author: string | null;
  composer: string | null;
  lyrics: string;
  sourceUrl: string;
}

const BASE_URL = 'https://hymnstogod.org/Hymns-PD';
const LIST_URL = `${BASE_URL}/ZZ-CompletePDHymnList.html`;

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function parseHymnList(html: string): string[] {
  const urls: string[] = [];
  const linkPattern = /href="\.\/([A-Z]-Hymns\/[^"]+\.html)"/gi;
  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    urls.push(`${BASE_URL}/${match[1]}`);
  }
  return [...new Set(urls)];
}

function parseHymnPage(html: string, sourceUrl: string): ScrapedHymn | null {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s*[-|].*$/, '').trim() || 'Unknown';

  const authorMatch = html.match(/(?:Lyrics|Words)[:\s]*([^<\n]+)/i);
  const author = authorMatch?.[1]?.trim().replace(/^by\s+/i, '') || null;

  const composerMatch = html.match(/(?:Music|Tune)[:\s]*([^<\n]+)/i);
  const composer = composerMatch?.[1]?.trim() || null;

  // Extract lyrics (simplified for edge function)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!bodyMatch) return null;

  let content = bodyMatch[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  let inLyrics = false;
  const lyricLines: string[] = [];

  for (const line of lines) {
    if (/^[1IVX][\.\)]/.test(line)) inLyrics = true;
    if (/copyright|public domain|hymns to god/i.test(line) && inLyrics) break;
    if (inLyrics) lyricLines.push(line);
  }

  if (lyricLines.length === 0) return null;

  // Format to markdown
  const sections: string[] = [];
  let currentSection: string[] = [];
  let verseNum = 0;

  for (const line of lyricLines) {
    if (/^(\d+)[.\)]$/.test(line)) {
      if (currentSection.length > 0) {
        sections.push(`# Verse ${verseNum}\n${currentSection.join('\n')}`);
      }
      verseNum = parseInt(line);
      currentSection = [];
    } else if (/^chorus/i.test(line)) {
      if (currentSection.length > 0) {
        sections.push(`# Verse ${verseNum}\n${currentSection.join('\n')}`);
      }
      currentSection = [];
      verseNum = 0; // Mark as chorus
    } else {
      currentSection.push(line);
    }
  }
  if (currentSection.length > 0) {
    const header = verseNum > 0 ? `Verse ${verseNum}` : 'Chorus';
    sections.push(`# ${header}\n${currentSection.join('\n')}`);
  }

  const lyrics = `---
source: hymnstogod.org
source_url: ${sourceUrl}
---

${sections.join('\n\n')}`;

  return { title, author, composer, lyrics, sourceUrl };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userData } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { limit, dryRun }: ImportRequest = await req.json().catch(() => ({}));

    // Use service role for inserts
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get existing URLs
    const { data: existing } = await serviceSupabase
      .from("songs")
      .select("source_url")
      .is("church_id", null)
      .not("source_url", "is", null);
    const existingUrls = new Set(existing?.map(s => s.source_url) || []);

    // Scrape
    const listHtml = await fetchWithTimeout(LIST_URL);
    let urls = parseHymnList(listHtml);
    if (limit) urls = urls.slice(0, limit);

    const succeeded: ScrapedHymn[] = [];
    const failed: { url: string; error: string }[] = [];
    let inserted = 0;
    let skipped = 0;

    for (const url of urls) {
      try {
        if (existingUrls.has(url)) {
          skipped++;
          continue;
        }

        const html = await fetchWithTimeout(url);
        const hymn = parseHymnPage(html, url);
        if (!hymn) {
          failed.push({ url, error: "Parse failed" });
          continue;
        }

        succeeded.push(hymn);

        if (!dryRun) {
          const { error } = await serviceSupabase.from("songs").insert({
            church_id: null,
            title: hymn.title,
            author: hymn.author,
            composer: hymn.composer,
            lyrics: hymn.lyrics,
            source_url: hymn.sourceUrl,
            is_public_domain: true,
            tags: ["hymn", "public-domain"]
          });
          if (error) {
            failed.push({ url, error: error.message });
          } else {
            inserted++;
          }
        }

        // Rate limit
        await new Promise(r => setTimeout(r, 100));
      } catch (err) {
        failed.push({ url, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return new Response(JSON.stringify({
      scraped: succeeded.length,
      inserted: dryRun ? 0 : inserted,
      skipped,
      failed: failed.length,
      failures: failed.slice(0, 10)
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: "Import failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/import-hymns/index.ts
git commit -m "feat(functions): add import-hymns edge function for production"
```

---

## Task 7: Test Full Import (Limited)

**Step 1: Run local import with limit**

Run: `deno run --allow-net --allow-env --allow-read scripts/import-hymns.ts --limit=10 --output=test-hymns.json`
Expected: Scrapes 10 hymns, saves to test-hymns.json

**Step 2: Review output quality**

Run: `cat test-hymns.json | head -100`
Expected: Properly formatted hymns with titles, authors, markdown lyrics

**Step 3: Run actual import to database (if satisfied)**

Run: `deno run --allow-net --allow-env --allow-read scripts/import-hymns.ts --limit=10`
Expected: Inserts 10 hymns to database

**Step 4: Verify in database**

Run: `pnpm supabase db execute "SELECT title, author, composer FROM songs WHERE church_id IS NULL LIMIT 5"`
Expected: Shows imported hymns

**Step 5: Commit test output**

```bash
echo "test-hymns.json" >> .gitignore
git add .gitignore
git commit -m "chore: ignore test hymn output files"
```

---

## Task 8: Full Production Import

**Step 1: Run full import (no limit)**

Run: `deno run --allow-net --allow-env --allow-read scripts/import-hymns.ts`
Expected: Imports all ~800 hymns (takes ~2-3 minutes with rate limiting)

**Step 2: Verify count**

Run: `pnpm supabase db execute "SELECT COUNT(*) FROM songs WHERE church_id IS NULL AND is_public_domain = true"`
Expected: ~800 hymns

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete hymn import system - imported ~800 public domain hymns"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Database migration | `supabase/migrations/20241224100000_hymn_import_columns.sql` |
| 2 | Lyrics formatter | `scripts/lib/formatter.ts` |
| 3 | HTML parser | `scripts/lib/parser.ts` |
| 4 | Scraper module | `scripts/lib/scraper.ts` |
| 5 | CLI import script | `scripts/import-hymns.ts` |
| 6 | Edge function | `supabase/functions/import-hymns/index.ts` |
| 7 | Test import | Verify with 10 hymns |
| 8 | Production import | Full ~800 hymns |
