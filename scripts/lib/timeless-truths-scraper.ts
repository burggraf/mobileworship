/**
 * Scraper for library.timelesstruths.org public domain hymn database.
 * Fetches hymns with rate limiting and error handling.
 */

import {
  parseHymnIndex,
  parseHymnPage,
  type TimelessTruthsHymn,
} from './timeless-truths-parser.ts';

const BASE_URL = 'https://library.timelesstruths.org';
const INDEX_URL = `${BASE_URL}/music/_/_/`;
const RATE_LIMIT_MS = 200; // Be respectful to the server

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
  failed: { slug: string; error: string }[];
}

export interface ScrapeOptions {
  limit?: number;
  onProgress?: (current: number, total: number, title: string) => void;
  publicDomainOnly?: boolean;
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
 * Scrape all hymns from library.timelesstruths.org
 */
export async function scrapeAllHymns(options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const { limit, onProgress, publicDomainOnly = true } = options;
  const succeeded: ScrapedHymn[] = [];
  const failed: { slug: string; error: string }[] = [];

  // Fetch the index page
  console.log('Fetching hymn index...');
  const indexHtml = await fetchWithTimeout(INDEX_URL);
  let hymnSlugs = parseHymnIndex(indexHtml);

  console.log(`Found ${hymnSlugs.length} hymn slugs`);

  if (limit) {
    hymnSlugs = hymnSlugs.slice(0, limit);
    console.log(`Limited to first ${limit} hymns`);
  }

  // Scrape each hymn
  for (let i = 0; i < hymnSlugs.length; i++) {
    const slug = hymnSlugs[i];

    try {
      // Fetch hymn page
      const hymnUrl = `${BASE_URL}/music/${slug}/`;
      const hymnHtml = await fetchWithTimeout(hymnUrl);
      const hymn = parseHymnPage(hymnHtml, slug);

      if (!hymn) {
        failed.push({ slug, error: 'Failed to parse lyrics' });
        continue;
      }

      // Skip non-public domain if requested
      if (publicDomainOnly && !hymn.isPublicDomain) {
        failed.push({ slug, error: 'Not public domain' });
        continue;
      }

      // Convert to ScrapedHymn format
      const scrapedHymn: ScrapedHymn = {
        title: hymn.title,
        author: hymn.author,
        composer: hymn.composer,
        lyrics: hymn.lyrics,
        sourceUrl: hymn.sourceUrl,
        isPublicDomain: hymn.isPublicDomain,
      };

      succeeded.push(scrapedHymn);

      if (onProgress) {
        onProgress(i + 1, hymnSlugs.length, hymn.title);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      failed.push({ slug, error: errorMsg });
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

  console.log('Timeless Truths Hymn Scraper');
  console.log('============================\n');

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
      console.log(`  - ${f.slug}: ${f.error}`);
    }
    if (result.failed.length > 10) {
      console.log(`  ... and ${result.failed.length - 10} more`);
    }
  }
}
