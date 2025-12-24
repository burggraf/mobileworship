import type { SongContent, SongSection, SectionType } from '../types';

const SECTION_PATTERNS: Record<string, SectionType> = {
  verse: 'verse',
  v: 'verse',
  chorus: 'chorus',
  c: 'chorus',
  bridge: 'bridge',
  b: 'bridge',
  'pre-chorus': 'pre-chorus',
  'pre chorus': 'pre-chorus',
  pc: 'pre-chorus',
  tag: 'tag',
  t: 'tag',
  intro: 'intro',
  i: 'intro',
  outro: 'outro',
  o: 'outro',
};

/**
 * Parse raw lyrics text with section markers into structured SongContent
 * Supports markers like [Verse 1], [Chorus], etc.
 */
export function parseLyrics(rawText: string): SongContent {
  const lines = rawText.split('\n');
  const sections: SongSection[] = [];
  let currentSection: SongSection | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section marker like [Verse 1] or [Chorus]
    const markerMatch = trimmed.match(/^\[(.+?)\]$/);
    if (markerMatch) {
      // Save previous section
      if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
      }

      const label = markerMatch[1];
      const type = detectSectionType(label);
      currentSection = { type, label, lines: [] };
      continue;
    }

    // Add non-empty lines to current section
    if (trimmed && currentSection) {
      currentSection.lines.push(trimmed);
    } else if (trimmed && !currentSection) {
      // Start a default section if none exists
      currentSection = { type: 'verse', label: 'Verse 1', lines: [trimmed] };
    }
  }

  // Add final section
  if (currentSection && currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return { sections };
}

function detectSectionType(label: string): SectionType {
  const lower = label.toLowerCase();
  for (const [pattern, type] of Object.entries(SECTION_PATTERNS)) {
    if (lower.startsWith(pattern)) {
      return type;
    }
  }
  return 'verse';
}

/**
 * Format structured SongContent back into raw text with markers
 */
export function formatLyrics(content: SongContent): string {
  return content.sections
    .map((section) => `[${section.label}]\n${section.lines.join('\n')}`)
    .join('\n\n');
}

/**
 * Split a section's lines into slides based on max lines per slide
 */
export function splitIntoSlides(lines: string[], maxLinesPerSlide = 4): string[][] {
  const slides: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLinesPerSlide) {
    slides.push(lines.slice(i, i + maxLinesPerSlide));
  }
  return slides;
}
