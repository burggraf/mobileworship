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

    // Extract author (lyricist) - HymnsToGod.org has names in <a> tags after "Lyrics:" header
    // Pattern: <th>Lyrics:</th><td...><a href="...">Author Name</a></td>
    const authorMatch = html.match(/Lyrics:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) ||
                        html.match(/Words:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) ||
                        html.match(/by\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)/);
    const author = authorMatch?.[1]?.trim() || null;

    // Extract composer - HymnsToGod.org has names in <a> tags after "Music:" header
    const composerMatch = html.match(/Music:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i) ||
                          html.match(/Tune:<\/th>\s*<td[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i);
    const composer = composerMatch?.[1]?.trim() || null;

    // Extract lyrics - HymnsToGod.org uses <div ID="Lyrics"> with <p> tags for verses
    let lyrics = '';

    // First try: Look for the specific Lyrics div used by HymnsToGod.org
    const lyricsDiv = html.match(/<div[^>]*ID="Lyrics"[^>]*>([\s\S]*?)<\/div>/i);
    if (lyricsDiv) {
      let content = lyricsDiv[1];
      // Skip the title and author lines at the start (first two <p> tags with w3-center class)
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

      // Process verses - split by VERSE_BREAK and number them
      const verses = content.split('VERSE_BREAK').map(v => v.trim()).filter(v => v);
      const numberedVerses: string[] = [];
      let verseNum = 1;

      for (const verse of verses) {
        // Check if this is a Refrain/Chorus marker
        if (/^(refrain|chorus)$/i.test(verse.trim())) {
          numberedVerses.push('Chorus:');
        } else if (verse.trim()) {
          // Check if verse already has a number or is the chorus content
          const prevWasChorusMarker = numberedVerses.length > 0 &&
            /^(refrain|chorus):?$/i.test(numberedVerses[numberedVerses.length - 1]);

          if (prevWasChorusMarker) {
            // This is the chorus content, don't number it
            numberedVerses[numberedVerses.length - 1] = `Chorus:\n${verse}`;
          } else {
            numberedVerses.push(`${verseNum}.\n${verse}`);
            verseNum++;
          }
        }
      }

      lyrics = numberedVerses.join('\n\n');
    } else {
      // Fallback: Try to find lyrics in a pre tag or parse body content
      const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      if (preMatch) {
        lyrics = preMatch[1];
      } else {
        // Extract from body as last resort
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        if (bodyMatch) {
          let content = bodyMatch[1];
          content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
          content = content.replace(/<style[\s\S]*?<\/style>/gi, '');
          content = content.replace(/<br\s*\/?>/gi, '\n');
          content = content.replace(/<\/p>/gi, '\n\n');
          content = content.replace(/<[^>]+>/g, '');
          content = content.replace(/&nbsp;/g, ' ');
          content = content.replace(/&amp;/g, '&');

          // Find lyrics by looking for verse-like content
          const lines = content.split('\n').map(l => l.trim()).filter(l => l);
          let inLyrics = false;
          const lyricLines: string[] = [];

          for (const line of lines) {
            if (/^[1IVX][\.\)]/.test(line) || /^verse\s*\d/i.test(line)) {
              inLyrics = true;
            }
            if (/copyright|all rights|hymns to god|page design/i.test(line) && inLyrics) {
              break;
            }
            if (inLyrics) {
              lyricLines.push(line);
            }
          }
          lyrics = lyricLines.join('\n');
        }
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
