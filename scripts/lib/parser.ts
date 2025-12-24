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
        content = content.replace(/&quot;/g, '"');
        content = content.replace(/&apos;/g, "'");
        content = content.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
        content = content.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

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
