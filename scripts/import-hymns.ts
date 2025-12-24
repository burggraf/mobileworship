#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-write

/**
 * CLI script to import hymns from HymnsToGod.org into Supabase.
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read --allow-write scripts/import-hymns.ts [options]
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
