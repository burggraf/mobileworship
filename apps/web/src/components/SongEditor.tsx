import { useState } from 'react';
import type { SongMetadata } from '@mobileworship/shared';

interface SongEditorProps {
  lyrics: string;
  metadata: SongMetadata;
  onLyricsChange: (lyrics: string) => void;
  onMetadataChange: (metadata: SongMetadata) => void;
  readOnly?: boolean;
}

const KEY_OPTIONS = ['', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
                     'Cm', 'C#m', 'Dm', 'D#m', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'A#m', 'Bm'];

export function SongEditor({
  lyrics,
  metadata,
  onLyricsChange,
  onMetadataChange,
  readOnly = false,
}: SongEditorProps) {
  const [tagInput, setTagInput] = useState('');

  const updateMetadata = (updates: Partial<SongMetadata>) => {
    onMetadataChange({ ...metadata, ...updates });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !metadata.tags?.includes(tag)) {
      updateMetadata({ tags: [...(metadata.tags || []), tag] });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateMetadata({
      tags: metadata.tags?.filter((t) => t !== tagToRemove),
    });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="space-y-6">
      {/* Metadata Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Title */}
        <div className="md:col-span-2">
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={metadata.title}
            onChange={(e) => updateMetadata({ title: e.target.value })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="Song title"
          />
        </div>

        {/* Author */}
        <div className="md:col-span-2">
          <label htmlFor="author" className="block text-sm font-medium mb-1">
            Author
          </label>
          <input
            id="author"
            type="text"
            value={metadata.author || ''}
            onChange={(e) => updateMetadata({ author: e.target.value || undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="Song author"
          />
        </div>

        {/* Key */}
        <div>
          <label htmlFor="key" className="block text-sm font-medium mb-1">
            Key
          </label>
          <select
            id="key"
            value={metadata.key || ''}
            onChange={(e) => updateMetadata({ key: e.target.value || undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
          >
            {KEY_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k || 'Select key...'}
              </option>
            ))}
          </select>
        </div>

        {/* Tempo */}
        <div>
          <label htmlFor="tempo" className="block text-sm font-medium mb-1">
            Tempo (BPM)
          </label>
          <input
            id="tempo"
            type="number"
            min="20"
            max="300"
            value={metadata.tempo || ''}
            onChange={(e) => updateMetadata({ tempo: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="72"
          />
        </div>

        {/* CCLI */}
        <div>
          <label htmlFor="ccli" className="block text-sm font-medium mb-1">
            CCLI Song #
          </label>
          <input
            id="ccli"
            type="text"
            value={metadata.ccli || ''}
            onChange={(e) => updateMetadata({ ccli: e.target.value || undefined })}
            disabled={readOnly}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
            placeholder="1234567"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {metadata.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm"
              >
                {tag}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-gray-500 hover:text-red-500"
                  >
                    &times;
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                className="flex-1 px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 text-sm"
                placeholder="Add tag..."
              />
              <button
                type="button"
                onClick={addTag}
                className="px-3 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lyrics Section */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="lyrics" className="block text-sm font-medium">
            Lyrics
          </label>
          {!readOnly && (
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
              title="AI Format (coming soon)"
              disabled
            >
              <span>AI</span>
              <span>✨</span>
            </button>
          )}
        </div>
        <textarea
          id="lyrics"
          value={lyrics}
          onChange={(e) => onLyricsChange(e.target.value)}
          disabled={readOnly}
          rows={16}
          className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 font-mono text-sm"
          placeholder={`# Verse
Amazing grace how sweet the sound
That saved a wretch like me

# Chorus
I once was lost but now am found
Was blind but now I see`}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Use # headers for sections: # Verse, # Chorus, # Bridge, etc.
        </p>
      </div>
    </div>
  );
}
