#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

/**
 * Invokes the import-hymns edge function using service role authentication.
 *
 * Usage:
 *   deno run --allow-net --allow-env --allow-read scripts/invoke-import.ts [options]
 *
 * Options:
 *   --limit=N     Only import first N hymns (for testing)
 *   --dry-run     Scrape and validate but don't insert to database
 */

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

interface ImportOptions {
  limit?: number;
  dryRun: boolean;
}

function parseArgs(): ImportOptions {
  const args = Deno.args;
  const options: ImportOptions = { dryRun: false };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function main() {
  await loadEnv();
  const options = parseArgs();

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    console.error('');
    console.error('Get the service role key from:');
    console.error('  https://supabase.com/dashboard/project/nyhkkpusgxszcvdmvxmd/settings/api');
    console.error('');
    console.error('Then add to .env:');
    console.error('  SUPABASE_SERVICE_ROLE_KEY=your-key-here');
    Deno.exit(1);
  }

  console.log('🎵 Hymn Import via Edge Function');
  console.log('=================================');
  console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
  if (options.limit) console.log(`Limit: ${options.limit} hymns`);
  console.log('');
  console.log('Invoking edge function...');

  const response = await fetch(`${supabaseUrl}/functions/v1/import-hymns`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit: options.limit,
      dryRun: options.dryRun,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Error: ${response.status} - ${error}`);
    Deno.exit(1);
  }

  const result = await response.json();
  console.log('');
  console.log('Results:');
  console.log(`  ✅ Scraped: ${result.scraped} hymns`);
  console.log(`  📥 Inserted: ${result.inserted} hymns`);
  console.log(`  ⏭️  Skipped (duplicates): ${result.skipped}`);
  console.log(`  ❌ Failed: ${result.failed}`);

  if (result.failures && result.failures.length > 0) {
    console.log('');
    console.log('Failures (first 10):');
    for (const f of result.failures) {
      console.log(`  - ${f.url}: ${f.error}`);
    }
  }

  console.log('');
  console.log('✨ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  Deno.exit(1);
});
