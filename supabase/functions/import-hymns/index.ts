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
      verseNum = 0;
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
