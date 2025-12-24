export interface SongMetadata {
  title: string;
  author?: string;
  ccli?: string;
  key?: string;
  tempo?: number;
  tags?: string[];
  [key: string]: unknown;
}

export interface SongSection {
  type: string;
  label: string;
  lines: string[];
}

export interface ParsedSong {
  metadata: SongMetadata;
  sections: SongSection[];
}

/**
 * Parse YAML frontmatter from markdown string
 */
function parseFrontmatter(markdown: string): { metadata: Record<string, unknown>; body: string } {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: markdown };
  }

  const yamlContent = match[1];
  const body = match[2];

  // Simple YAML parser for our use case
  const metadata: Record<string, unknown> = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value: unknown = line.slice(colonIndex + 1).trim();

    // Handle arrays like [tag1, tag2]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim());
    }
    // Handle numbers
    else if (typeof value === 'string' && /^\d+$/.test(value)) {
      value = parseInt(value, 10);
    }

    metadata[key] = value;
  }

  return { metadata, body };
}

/**
 * Parse section headers and content from markdown body
 */
function parseSections(body: string): SongSection[] {
  const sections: SongSection[] = [];
  const sectionRegex = /^#\s+(.+)$/gm;
  const parts = body.split(sectionRegex);

  // parts[0] is content before first header (usually empty)
  // parts[1] is first header, parts[2] is content after first header, etc.
  for (let i = 1; i < parts.length; i += 2) {
    const headerText = parts[i].trim();
    const content = parts[i + 1] || '';
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length > 0) {
      sections.push({
        type: headerText,
        label: headerText, // Will be processed for auto-numbering
        lines,
      });
    }
  }

  return sections;
}

/**
 * Apply auto-numbering to sections with bare type names
 */
function applyAutoNumbering(sections: SongSection[]): SongSection[] {
  const typeCounts: Record<string, number> = {};

  return sections.map((section) => {
    const lowerType = section.type.toLowerCase();

    // Check if already has a number
    const hasNumber = /\d+$/.test(section.type);
    if (hasNumber) {
      return section;
    }

    // Auto-number common section types
    const numberableTypes = ['verse', 'chorus', 'bridge', 'pre-chorus', 'tag'];
    const isNumberable = numberableTypes.some(
      (t) => lowerType === t || lowerType.startsWith(t + ' ')
    );

    if (isNumberable && lowerType === section.type.toLowerCase()) {
      typeCounts[lowerType] = (typeCounts[lowerType] || 0) + 1;
      const count = typeCounts[lowerType];

      // Capitalize first letter
      const capitalizedType = section.type.charAt(0).toUpperCase() + section.type.slice(1).toLowerCase();
      return {
        ...section,
        label: `${capitalizedType} ${count}`,
      };
    }

    return section;
  });
}

/**
 * Parse markdown string into structured song data
 */
export function parseSongMarkdown(markdown: string): ParsedSong {
  const { metadata, body } = parseFrontmatter(markdown);

  if (!metadata.title) {
    throw new Error('Song must have a title in frontmatter');
  }

  const rawSections = parseSections(body);
  const sections = applyAutoNumbering(rawSections);

  return {
    metadata: metadata as SongMetadata,
    sections,
  };
}
