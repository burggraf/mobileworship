import { describe, it, expect } from 'vitest';
import { parseSongMarkdown } from '../markdown-song';

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
});
