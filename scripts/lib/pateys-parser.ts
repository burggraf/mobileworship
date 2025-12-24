/**
 * Parses hymn data from Pateys.nf.ca hymn database.
 * Site has ~325 public domain hymns with lyrics.
 */

export interface PateysHymn {
  hymnNumber: number;
  title: string;
  tuneName: string | null;
  meter: string | null;
  lyrics: string;
  sourceUrl: string;
}

const BASE_URL = 'https://www.pateys.nf.ca';

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code)));
}

/**
 * Parse the hymn index page to extract all hymn numbers that have lyrics
 */
export function parseHymnIndex(html: string): number[] {
  const hymnNumbers: number[] = [];

  // Match links to lyrics.pl with hymn numbers
  // HTML encodes & as &amp; so we need to match both patterns
  // Pattern: <a href="/cgi-bin/lyrics.pl?font=regular&amp;hymnnumber=123">
  const linkPattern = /href="\/cgi-bin\/lyrics\.pl\?font=regular&(?:amp;)?hymnnumber=(\d+)"/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    hymnNumbers.push(parseInt(match[1]));
  }

  return [...new Set(hymnNumbers)].sort((a, b) => a - b);
}

/**
 * Parse the database entry page for metadata (tune name, meter)
 */
export function parseMetadataPage(html: string): { tuneName: string | null; meter: string | null } {
  // Extract tune name - format is "Tune name: XXXX <a href..."
  // Example: "Tune name: Tallis' Ordinal <a href="
  const tuneMatch = html.match(/Tune name:\s*([^<]+)</i);
  let tuneName = tuneMatch?.[1]?.trim() || null;

  // Extract meter - format is "-- 8 6 8 6 CM <a href..."
  const meterMatch = html.match(/--\s*(\d+\s+\d+\s+\d+\s+\d+(?:\s+[A-Z]+)?)\s*<a/);
  const meter = meterMatch?.[1]?.trim() || null;

  // Clean up tune name - decode HTML entities
  if (tuneName) {
    tuneName = tuneName
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code)));
  }

  return { tuneName, meter };
}

/**
 * Parse a lyrics page to extract the hymn content
 */
export function parseLyricsPage(html: string, hymnNumber: number): PateysHymn | null {
  try {
    // Extract title - usually in <title> or <h1>/<h2>
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i) ||
                       html.match(/<h[12][^>]*>([^<]+)<\/h[12]>/i);
    let title = titleMatch?.[1]?.trim() || '';

    // Decode HTML entities and clean up title
    title = decodeHtmlEntities(title);
    title = title.replace(/^Lyrics for Hymn #\d+,\s*/i, '');
    title = title.replace(/^Hymn\s*#?\d+[:\s]*/i, '');
    title = title.replace(/\s*[-|].*$/, '').trim();
    // Remove surrounding quotes
    title = title.replace(/^['"](.*)['"]$/, '$1');

    if (!title) {
      title = `Hymn ${hymnNumber}`;
    }

    // Extract lyrics from the page body
    // The lyrics are in plain text between specific markers
    let lyrics = '';

    // Try to find lyrics in <pre> tags first
    const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    if (preMatch) {
      lyrics = preMatch[1];
    } else {
      // Extract from body, looking for verse content
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        let content = bodyMatch[1];

        // Remove scripts and styles
        content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
        content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

        // Remove navigation and header elements
        content = content.replace(/<nav[\s\S]*?<\/nav>/gi, '');
        content = content.replace(/<header[\s\S]*?<\/header>/gi, '');
        content = content.replace(/<footer[\s\S]*?<\/footer>/gi, '');

        // Convert <br> to newlines
        content = content.replace(/<br\s*\/?>/gi, '\n');
        // Convert <p> to double newlines
        content = content.replace(/<\/p>/gi, '\n\n');
        content = content.replace(/<p[^>]*>/gi, '');

        // Remove remaining HTML tags
        content = content.replace(/<[^>]+>/g, '');

        // Decode HTML entities
        content = content.replace(/&nbsp;/g, ' ');
        content = content.replace(/&amp;/g, '&');
        content = content.replace(/&lt;/g, '<');
        content = content.replace(/&gt;/g, '>');
        content = content.replace(/&quot;/g, '"');
        content = content.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code)));

        // Extract just the lyrics portion - look for numbered verses
        const lines = content.split('\n');
        const lyricLines: string[] = [];
        let inLyrics = false;
        let lastWasBlank = false;

        for (const line of lines) {
          const trimmed = line.trim();

          // Start capturing at first numbered verse
          if (/^[1-9]\.?\s/.test(trimmed) || /^[1-9]\s/.test(trimmed)) {
            inLyrics = true;
          }

          // Stop at navigation links or footer content
          if (inLyrics && /^(search|database|home|back|click|©|see database|go to)/i.test(trimmed)) {
            break;
          }

          if (inLyrics) {
            if (trimmed === '') {
              if (!lastWasBlank) {
                lyricLines.push('');
                lastWasBlank = true;
              }
            } else {
              lyricLines.push(trimmed);
              lastWasBlank = false;
            }
          }
        }

        lyrics = lyricLines.join('\n').trim();
      }
    }

    if (!lyrics) {
      return null;
    }

    // Format lyrics into markdown sections
    const formattedLyrics = formatLyrics(lyrics, hymnNumber, title);

    return {
      hymnNumber,
      title,
      tuneName: null, // Will be filled from metadata page
      meter: null,    // Will be filled from metadata page
      lyrics: formattedLyrics,
      sourceUrl: `${BASE_URL}/cgi-bin/lyrics.pl?font=regular&hymnnumber=${hymnNumber}`,
    };
  } catch (error) {
    console.error(`Failed to parse hymn ${hymnNumber}:`, error);
    return null;
  }
}

/**
 * Format raw lyrics text into markdown with section headers
 */
function formatLyrics(rawLyrics: string, hymnNumber: number, title: string): string {
  const lines = rawLyrics.split('\n');
  const sections: string[] = [];
  let currentSection: string[] = [];
  let currentSectionType = '';
  let verseNum = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for verse number at start of line
    const verseMatch = trimmed.match(/^(\d+)\.?\s*(.*)/);

    if (verseMatch) {
      // Save previous section
      if (currentSection.length > 0) {
        const header = currentSectionType || `Verse ${verseNum}`;
        sections.push(`# ${header}\n${currentSection.join('\n')}`);
      }

      verseNum = parseInt(verseMatch[1]);
      currentSectionType = `Verse ${verseNum}`;
      currentSection = [];

      // Add remaining text on same line as verse number
      if (verseMatch[2]) {
        currentSection.push(verseMatch[2]);
      }
    } else if (/^(chorus|refrain)/i.test(trimmed)) {
      // Save previous section
      if (currentSection.length > 0) {
        const header = currentSectionType || `Verse ${verseNum}`;
        sections.push(`# ${header}\n${currentSection.join('\n')}`);
      }
      currentSectionType = 'Chorus';
      currentSection = [];
    } else if (trimmed === '') {
      // Blank line - might indicate section break
      if (currentSection.length > 0 && !currentSectionType) {
        verseNum++;
        currentSectionType = `Verse ${verseNum}`;
      }
    } else {
      currentSection.push(trimmed);
    }
  }

  // Don't forget the last section
  if (currentSection.length > 0) {
    const header = currentSectionType || `Verse ${verseNum || 1}`;
    sections.push(`# ${header}\n${currentSection.join('\n')}`);
  }

  // Build final markdown
  const frontmatter = `---
source: pateys.nf.ca
source_url: ${BASE_URL}/cgi-bin/lyrics.pl?font=regular&hymnnumber=${hymnNumber}
---`;

  return `${frontmatter}\n\n${sections.join('\n\n')}`;
}

// Test runner
if (import.meta.main) {
  console.log('Pateys parser module loaded. Use with pateys-scraper.ts');
}
