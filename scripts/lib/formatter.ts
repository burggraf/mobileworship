/**
 * Converts raw hymn lyrics to markdown format with section headers.
 * Detects verses, choruses, and refrains from common patterns.
 */

export interface FormattedLyrics {
  markdown: string;
  sectionCount: number;
}

/**
 * Detect if a line is a section marker and return its type
 */
function parseSectionMarker(line: string): { type: string; number?: number } | null {
  const trimmed = line.trim();

  // Numbered verse: "1.", "2.", "1)", "Verse 1", etc.
  const arabicMatch = trimmed.match(/^(\d+)[.\)]\s*$/);
  if (arabicMatch) {
    return { type: 'Verse', number: parseInt(arabicMatch[1]) };
  }

  const verseMatch = trimmed.match(/^verse\s*(\d+)/i);
  if (verseMatch) {
    return { type: 'Verse', number: parseInt(verseMatch[1]) };
  }

  // Roman numerals: "I.", "II.", "III.", etc.
  const romanMatch = trimmed.match(/^(I{1,3}|IV|V|VI{0,3}|IX|X)[.\)]\s*$/i);
  if (romanMatch) {
    const romanToArabic: Record<string, number> = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
      'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
    };
    return { type: 'Verse', number: romanToArabic[romanMatch[1].toUpperCase()] || 1 };
  }

  // Chorus/Refrain markers
  if (/^(chorus|refrain)[:\s]*$/i.test(trimmed)) {
    return { type: 'Chorus' };
  }

  // Bridge marker
  if (/^bridge[:\s]*$/i.test(trimmed)) {
    return { type: 'Bridge' };
  }

  return null;
}

/**
 * Format raw lyrics text into markdown with section headers
 */
export function formatLyrics(rawText: string, sourceUrl: string): FormattedLyrics {
  // Validate input
  if (!rawText.trim()) {
    return { markdown: '', sectionCount: 0 };
  }

  const lines = rawText.split('\n');
  const sections: { header: string; lines: string[] }[] = [];
  let currentSection: { header: string; lines: string[] } | null = null;
  let verseCount = 0;
  let hasExplicitMarkers = false;

  for (const line of lines) {
    const marker = parseSectionMarker(line);

    if (marker) {
      hasExplicitMarkers = true;
      // Start new section
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }
      const header = marker.number ? `${marker.type} ${marker.number}` : marker.type;
      if (marker.type === 'Verse') {
        verseCount = marker.number ?? (verseCount + 1);
      }
      currentSection = { header, lines: [] };
    } else if (line.trim() === '') {
      // Blank line - might be section separator if no explicit markers
      if (currentSection && currentSection.lines.length > 0 && !hasExplicitMarkers) {
        sections.push(currentSection);
        verseCount++;
        currentSection = { header: `Verse ${verseCount}`, lines: [] };
      }
    } else {
      // Content line
      if (!currentSection) {
        verseCount = 1;
        currentSection = { header: 'Verse 1', lines: [] };
      }
      currentSection.lines.push(line.trim());
    }
  }

  // Don't forget the last section
  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  // Build markdown
  const source = new URL(sourceUrl).hostname.replace(/^www\./, '');
  const frontmatter = `---
source: ${source}
source_url: ${sourceUrl}
---`;

  const body = sections
    .map(s => `# ${s.header}\n${s.lines.join('\n')}`)
    .join('\n\n');

  return {
    markdown: `${frontmatter}\n\n${body}`,
    sectionCount: sections.length
  };
}

// Simple test runner for development
if (import.meta.main) {
  const testLyrics = `1.
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind but now I see

2.
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed`;

  const result = formatLyrics(testLyrics, 'https://example.com/test');
  console.log('=== Formatter Test ===');
  console.log(result.markdown);
  console.log(`\nSection count: ${result.sectionCount}`);
}
