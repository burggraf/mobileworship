import { describe, it, expect } from 'vitest';
import { parseSongMarkdown, buildSongMarkdown, type ParsedSong } from '../markdown-song';

describe('parseSongMarkdown', () => {
  it('parses minimal song with just title', () => {
    const markdown = `---
title: Test Song
---

# Verse
Hello world`;

    const result = parseSongMarkdown(markdown);

    expect(result.metadata.title).toBe('Test Song');
    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].label).toBe('Verse 1');
    expect(result.sections[0].lines).toEqual(['Hello world']);
  });

  it('parses full metadata', () => {
    const markdown = `---
title: Amazing Grace
author: John Newton
ccli: 1234567
key: G
tempo: 72
tags: [hymn, grace, classic]
customField: custom value
---

# Verse
Amazing grace`;

    const result = parseSongMarkdown(markdown);

    expect(result.metadata.title).toBe('Amazing Grace');
    expect(result.metadata.author).toBe('John Newton');
    expect(result.metadata.ccli).toBe(1234567);
    expect(result.metadata.key).toBe('G');
    expect(result.metadata.tempo).toBe(72);
    expect(result.metadata.tags).toEqual(['hymn', 'grace', 'classic']);
    expect(result.metadata.customField).toBe('custom value');
  });

  it('auto-numbers multiple verses', () => {
    const markdown = `---
title: Test
---

# Verse
First verse

# Verse
Second verse

# Verse
Third verse`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].label).toBe('Verse 1');
    expect(result.sections[1].label).toBe('Verse 2');
    expect(result.sections[2].label).toBe('Verse 3');
  });

  it('preserves explicit numbering', () => {
    const markdown = `---
title: Test
---

# Verse 1
First verse

# Chorus
The chorus

# Verse 2
Second verse`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].label).toBe('Verse 1');
    expect(result.sections[1].label).toBe('Chorus 1');
    expect(result.sections[2].label).toBe('Verse 2');
  });

  it('handles freeform section names', () => {
    const markdown = `---
title: Test
---

# Intro
Instrumental intro

# Verse
Main verse

# Turnaround
Musical break

# Outro
Ending`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].label).toBe('Intro');
    expect(result.sections[1].label).toBe('Verse 1');
    expect(result.sections[2].label).toBe('Turnaround');
    expect(result.sections[3].label).toBe('Outro');
  });

  it('parses multi-line sections', () => {
    const markdown = `---
title: Test
---

# Verse
Line one
Line two
Line three
Line four`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections[0].lines).toEqual([
      'Line one',
      'Line two',
      'Line three',
      'Line four',
    ]);
  });

  it('throws error when title is missing', () => {
    const markdown = `---
author: Someone
---

# Verse
Hello`;

    expect(() => parseSongMarkdown(markdown)).toThrow('Song must have a title');
  });

  it('ignores blank lines between sections', () => {
    const markdown = `---
title: Test
---

# Verse
First verse


# Chorus
The chorus`;

    const result = parseSongMarkdown(markdown);

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].lines).toEqual(['First verse']);
    expect(result.sections[1].lines).toEqual(['The chorus']);
  });
});

describe('buildSongMarkdown', () => {
  it('builds markdown from parsed song', () => {
    const song: ParsedSong = {
      metadata: {
        title: 'Test Song',
        author: 'Test Author',
        key: 'G',
      },
      sections: [
        { type: 'Verse', label: 'Verse 1', lines: ['Line one', 'Line two'] },
        { type: 'Chorus', label: 'Chorus', lines: ['Chorus line'] },
      ],
    };

    const markdown = buildSongMarkdown(song);

    expect(markdown).toContain('title: Test Song');
    expect(markdown).toContain('author: Test Author');
    expect(markdown).toContain('key: G');
    expect(markdown).toContain('# Verse');
    expect(markdown).toContain('Line one');
    expect(markdown).toContain('# Chorus');
  });

  it('round-trips correctly', () => {
    const original = `---
title: Amazing Grace
author: John Newton
key: G
tempo: 72
tags: [hymn, grace]
---

# Verse
Amazing grace how sweet the sound
That saved a wretch like me

# Chorus
I once was lost but now am found
Was blind but now I see`;

    const parsed = parseSongMarkdown(original);
    const rebuilt = buildSongMarkdown(parsed);
    const reparsed = parseSongMarkdown(rebuilt);

    expect(reparsed.metadata.title).toBe(parsed.metadata.title);
    expect(reparsed.metadata.author).toBe(parsed.metadata.author);
    expect(reparsed.sections.length).toBe(parsed.sections.length);
    expect(reparsed.sections[0].lines).toEqual(parsed.sections[0].lines);
  });
});
