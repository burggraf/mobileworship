/**
 * Scraper for Pateys.nf.ca public domain hymn database.
 * Fetches hymns with rate limiting and error handling.
 */

import {
  parseHymnIndex,
  parseLyricsPage,
  parseMetadataPage,
  type PateysHymn,
} from './pateys-parser.ts';

const BASE_URL = 'https://www.pateys.nf.ca';
const INDEX_URL = `${BASE_URL}/cgi-bin/lyrics_pd.pl`;
const RATE_LIMIT_MS = 150; // Be respectful to the server

export interface ScrapedHymn {
  title: string;
  author: string | null;
  composer: string | null;
  lyrics: string;
  sourceUrl: string;
  isPublicDomain: boolean;
}

export interface ScrapeResult {
  succeeded: ScrapedHymn[];
  failed: { hymnNumber: number; error: string }[];
}

export interface ScrapeOptions {
  limit?: number;
  onProgress?: (current: number, total: number, title: string) => void;
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MobileWorship Hymn Importer (https://github.com/burggraf/mobileworship)',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrape all hymns from Pateys.nf.ca
 */
export async function scrapeAllHymns(options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const { limit, onProgress } = options;
  const succeeded: ScrapedHymn[] = [];
  const failed: { hymnNumber: number; error: string }[] = [];

  // Fetch the index page
  console.log('Fetching hymn index...');
  const indexHtml = await fetchWithTimeout(INDEX_URL);
  let hymnNumbers = parseHymnIndex(indexHtml);

  console.log(`Found ${hymnNumbers.length} hymn numbers`);

  if (limit) {
    hymnNumbers = hymnNumbers.slice(0, limit);
    console.log(`Limited to first ${limit} hymns`);
  }

  // Scrape each hymn
  for (let i = 0; i < hymnNumbers.length; i++) {
    const hymnNumber = hymnNumbers[i];

    try {
      // Fetch lyrics page
      const lyricsUrl = `${BASE_URL}/cgi-bin/lyrics.pl?font=regular&hymnnumber=${hymnNumber}`;
      const lyricsHtml = await fetchWithTimeout(lyricsUrl);
      const hymn = parseLyricsPage(lyricsHtml, hymnNumber);

      if (!hymn) {
        failed.push({ hymnNumber, error: 'Failed to parse lyrics' });
        continue;
      }

      // Fetch metadata page for tune name
      try {
        const metadataUrl = `${BASE_URL}/cgi-bin/getnametune.pl?hymnnumbers=${hymnNumber}`;
        const metadataHtml = await fetchWithTimeout(metadataUrl);
        const metadata = parseMetadataPage(metadataHtml);
        hymn.tuneName = metadata.tuneName;
        hymn.meter = metadata.meter;
      } catch {
        // Metadata is optional, continue without it
      }

      // Convert to ScrapedHymn format
      const scrapedHymn: ScrapedHymn = {
        title: hymn.title,
        author: null, // Pateys doesn't provide author info directly
        composer: hymn.tuneName, // Use tune name as composer info
        lyrics: hymn.lyrics,
        sourceUrl: hymn.sourceUrl,
        isPublicDomain: true,
      };

      succeeded.push(scrapedHymn);

      if (onProgress) {
        onProgress(i + 1, hymnNumbers.length, hymn.title);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failed.push({ hymnNumber, error: errorMsg });
    }

    // Rate limiting
    await delay(RATE_LIMIT_MS);
  }

  return { succeeded, failed };
}

// CLI runner
if (import.meta.main) {
  const args = Deno.args;
  const limit = args.find(a => a.startsWith('--limit='))?.split('=')[1];

  console.log('Pateys.nf.ca Hymn Scraper');
  console.log('=========================\n');

  const result = await scrapeAllHymns({
    limit: limit ? parseInt(limit) : undefined,
    onProgress: (current, total, title) => {
      const pct = Math.round((current / total) * 100);
      console.log(`[${pct}%] ${current}/${total}: ${title}`);
    },
  });

  console.log(`\n✅ Scraped: ${result.succeeded.length} hymns`);
  console.log(`❌ Failed: ${result.failed.length} hymns`);

  if (result.failed.length > 0) {
    console.log('\nFailed hymns:');
    for (const f of result.failed.slice(0, 10)) {
      console.log(`  - #${f.hymnNumber}: ${f.error}`);
    }
  }
}
