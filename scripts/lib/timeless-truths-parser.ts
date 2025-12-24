/**
 * Parses hymn data from library.timelesstruths.org
 * Site has ~1850 public domain hymns with lyrics.
 */

export interface TimelessTruthsHymn {
  title: string;
  author: string | null;
  authorYear: number | null;
  composer: string | null;
  lyrics: string;
  sourceUrl: string;
  isPublicDomain: boolean;
}

const BASE_URL = 'https://library.timelesstruths.org';

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
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '...')
    .replace(/&#9837;/g, '♭')
    .replace(/&#9839;/g, '♯')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(parseInt(code)));
}

/**
 * Parse the whole list page to extract all hymn slugs
 */
export function parseHymnIndex(html: string): string[] {
  const slugs: string[] = [];

  // Match hymn links: href="../../../music/HYMN_SLUG/"
  // Exclude collection pages like Select_Hymns, Evening_Light_Songs, etc.
  const linkPattern = /href="[^"]*\/music\/([A-Za-z0-9_]+)\/"/g;
  const excludePatterns = [
    '_', 'Select_Hymns', 'Evening_Light_Songs', 'Echoes_from_Heaven_Hymnal',
    'The_Blue_Book', 'Sing_unto_the_Lord'
  ];

  let match;
  while ((match = linkPattern.exec(html)) !== null) {
    const slug = match[1];
    if (!excludePatterns.includes(slug) && !slugs.includes(slug)) {
      slugs.push(slug);
    }
  }

  return slugs;
}

/**
 * Parse a hymn page to extract the hymn content
 */
export function parseHymnPage(html: string, slug: string): TimelessTruthsHymn | null {
  try {
    // Check if it's public domain
    const isPublicDomain = /Public Domain/i.test(html) ||
      /publicdomain\/mark/i.test(html);

    // Extract title from <span class="current">TITLE</span> or <title>
    let title = '';
    const titleMatch = html.match(/<span class="current">([^<]+)<\/span>/i) ||
      html.match(/<title>([^>|]+)/i);
    if (titleMatch) {
      title = decodeHtmlEntities(titleMatch[1].trim());
      // Clean up title - remove " > Lyrics" suffix
      title = title.replace(/\s*>\s*Lyrics.*$/, '').trim();
    }

    if (!title) {
      title = slug.replace(/_/g, ' ');
    }

    // Extract author from <p class='author'>
    let author: string | null = null;
    let authorYear: number | null = null;
    const authorMatch = html.match(/<p class=['"]author['"][^>]*>.*?<a[^>]*>([^<]+)<\/a>,?\s*(\d{4})?/is);
    if (authorMatch) {
      author = decodeHtmlEntities(authorMatch[1].trim());
      if (authorMatch[2]) {
        authorYear = parseInt(authorMatch[2]);
      }
    }

    // Extract composer from tuneinfo section
    // The composer is in a <p> tag with data-editable containing "author", after the scoretitle
    let composer: string | null = null;
    const composerMatch = html.match(/<fieldset class="tuneinfo">[\s\S]*?<p[^>]*data-editable[^>]*author[^>]*>.*?<a[^>]*>([^<]+)<\/a>/i);
    if (composerMatch) {
      composer = decodeHtmlEntities(composerMatch[1].trim());
    }

    // Extract lyrics from <div class='verses'>
    let lyrics = '';
    const versesMatch = html.match(/<div class=['"]verses['"][^>]*>([\s\S]*?)<\/div>/i);
    if (versesMatch) {
      const versesHtml = versesMatch[1];

      // Find all list items (verses)
      const versePattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
      const verses: string[] = [];
      let verseMatch;

      while ((verseMatch = versePattern.exec(versesHtml)) !== null) {
        let verseText = verseMatch[1];
        // Convert <br /> to newlines
        verseText = verseText.replace(/<br\s*\/?>/gi, '\n');
        // Remove any remaining HTML tags
        verseText = verseText.replace(/<[^>]+>/g, '');
        // Decode entities
        verseText = decodeHtmlEntities(verseText.trim());
        if (verseText) {
          verses.push(verseText);
        }
      }

      // Format into markdown with verse headers
      lyrics = formatLyrics(verses, slug, title);
    }

    if (!lyrics) {
      return null;
    }

    return {
      title,
      author,
      authorYear,
      composer,
      lyrics,
      sourceUrl: `${BASE_URL}/music/${slug}/`,
      isPublicDomain,
    };
  } catch (error) {
    console.error(`Failed to parse hymn ${slug}:`, error);
    return null;
  }
}

/**
 * Format verses into markdown with section headers
 */
function formatLyrics(verses: string[], slug: string, title: string): string {
  if (verses.length === 0) return '';

  const sections: string[] = [];

  for (let i = 0; i < verses.length; i++) {
    const verseText = verses[i];
    // Check if this looks like a chorus (common patterns)
    const isChorus = /^(chorus|refrain):/i.test(verseText) ||
      (i > 0 && verses[i] === verses[i - 1]); // Repeated verse is likely chorus

    const header = isChorus ? 'Chorus' : `Verse ${i + 1}`;
    let cleanVerse = verseText.replace(/^(chorus|refrain):\s*/i, '');
    sections.push(`# ${header}\n${cleanVerse}`);
  }

  // Build final markdown
  const frontmatter = `---
source: library.timelesstruths.org
source_url: ${BASE_URL}/music/${slug}/
---`;

  return `${frontmatter}\n\n${sections.join('\n\n')}`;
}

// Test runner
if (import.meta.main) {
  console.log('Timeless Truths parser module loaded. Use with timeless-truths-scraper.ts');
}
