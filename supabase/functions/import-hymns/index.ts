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
  // Extract title from <title> tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.replace(/\s*[-|].*$/, '').trim() || 'Unknown';

  // Extract author from <a> tag after "Lyrics:" header
  const authorMatch = html.match(/Lyrics:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) ||
                      html.match(/Words:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
  const author = authorMatch?.[1]?.trim() || null;

  // Extract composer from <a> tag after "Music:" header
  const composerMatch = html.match(/Music:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) ||
                        html.match(/Tune:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
  const composer = composerMatch?.[1]?.trim() || null;

  // Extract lyrics from <div ID="Lyrics"> section
  const lyricsDiv = html.match(/<div[^>]*ID="Lyrics"[^>]*>([\s\S]*?)<\/div>/i);
  if (!lyricsDiv) return null;

  let content = lyricsDiv[1];
  // Skip title and author lines at start (w3-center class)
  content = content.replace(/<p[^>]*class="[^"]*w3-center[^"]*"[^>]*>[\s\S]*?<\/p>/gi, '');
  // Convert <br> to newlines
  content = content.replace(/<br\s*\/?>/gi, '\n');
  // Add verse separator between </p> and <p>
  content = content.replace(/<\/p>\s*<p>/gi, '\n\nVERSE_BREAK\n\n');
  // Remove remaining HTML tags
  content = content.replace(/<[^>]+>/g, '');
  // Decode HTML entities
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  content = content.replace(/&quot;/g, '"');
  content = content.replace(/&apos;/g, "'");
  content = content.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code)));
  content = content.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));

  // Process verses - split by VERSE_BREAK and format
  const verses = content.split('VERSE_BREAK').map(v => v.trim()).filter(v => v);
  const sections: string[] = [];
  let verseNum = 1;

  for (const verse of verses) {
    // Check if this is a Refrain/Chorus marker
    if (/^(refrain|chorus)$/i.test(verse.trim())) {
      sections.push('# Chorus');
    } else if (verse.trim()) {
      const prevWasChorusMarker = sections.length > 0 &&
        /^# (refrain|chorus)$/i.test(sections[sections.length - 1]);

      if (prevWasChorusMarker) {
        // This is the chorus content
        sections[sections.length - 1] = `# Chorus\n${verse}`;
      } else {
        sections.push(`# Verse ${verseNum}\n${verse}`);
        verseNum++;
      }
    }
  }

  if (sections.length === 0) return null;

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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Check for service role key authentication (for batch imports)
    const isServiceRoleAuth = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRoleAuth) {
      // Fall back to user-based admin authentication
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
    }

    const { limit, dryRun }: ImportRequest = await req.json().catch(() => ({}));

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: existing } = await serviceSupabase
      .from("songs")
      .select("source_url")
      .is("church_id", null)
      .not("source_url", "is", null);
    const existingUrls = new Set(existing?.map(s => s.source_url) || []);

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
