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
