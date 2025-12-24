import { useState, FormEvent } from 'react';
import { useSongs } from '@mobileworship/shared';
import type { SongSection } from '@mobileworship/shared';

interface CreateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSongModal({ isOpen, onClose }: CreateSongModalProps) {
  const { createSong } = useSongs();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!lyrics.trim()) {
      setError('Lyrics are required');
      return;
    }

    try {
      // Parse lyrics into sections
      const sections: SongSection[] = [];
      const rawSections = lyrics
        .split(/\n\s*\n/) // Split by double newline (blank line)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      rawSections.forEach((rawSection, index) => {
        const lines = rawSection
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0);

        if (lines.length > 0) {
          sections.push({
            type: 'verse',
            label: `Verse ${index + 1}`,
            lines,
          });
        }
      });

      if (sections.length === 0) {
        setError('Could not parse lyrics into sections');
        return;
      }

      // Create the song
      await createSong.mutateAsync({
        title: title.trim(),
        author: author.trim() || undefined,
        content: { sections },
      });

      // Reset form and close modal on success
      setTitle('');
      setAuthor('');
      setLyrics('');
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create song');
    }
  };

  const handleClose = () => {
    if (!createSong.isPending) {
      setError(null);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold">Create New Song</h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Title Field */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium mb-1"
              >
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={createSong.isPending}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
                placeholder="Enter song title"
                autoFocus
              />
            </div>

            {/* Author Field */}
            <div>
              <label
                htmlFor="author"
                className="block text-sm font-medium mb-1"
              >
                Author
              </label>
              <input
                id="author"
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                disabled={createSong.isPending}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50"
                placeholder="Enter author name (optional)"
              />
            </div>

            {/* Lyrics Textarea */}
            <div>
              <label
                htmlFor="lyrics"
                className="block text-sm font-medium mb-1"
              >
                Lyrics <span className="text-red-500">*</span>
              </label>
              <textarea
                id="lyrics"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                disabled={createSong.isPending}
                rows={12}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 font-mono text-sm"
                placeholder="Enter lyrics here. Separate sections with blank lines."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tip: Separate sections with blank lines. Each section will be
                labeled as verses.
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            )}
          </div>

          {/* Footer with Buttons */}
          <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={createSong.isPending}
              className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSong.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createSong.isPending ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Song'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
