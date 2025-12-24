import { useState, FormEvent } from 'react';
import { useSongs, buildSongMarkdown } from '@mobileworship/shared';

interface CreateSongModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSongModal({ isOpen, onClose }: CreateSongModalProps) {
  const { createSong } = useSongs();
  const [title, setTitle] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      // Build markdown with title and lyrics
      const markdown = buildSongMarkdown({
        metadata: { title: title.trim() },
        sections: [],
      }).replace(/---\n\n$/, `---\n\n${lyrics.trim()}`);

      await createSong.mutateAsync({
        title: title.trim(),
        lyrics: markdown,
      });

      setTitle('');
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
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-semibold">Create New Song</h2>
          <button
            onClick={handleClose}
            disabled={createSong.isPending}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium mb-1">
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

            {/* Lyrics */}
            <div>
              <label htmlFor="lyrics" className="block text-sm font-medium mb-1">
                Lyrics
              </label>
              <textarea
                id="lyrics"
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                disabled={createSong.isPending}
                rows={12}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 font-mono text-sm"
                placeholder={`# Verse
Amazing grace how sweet the sound
That saved a wretch like me

# Chorus
I once was lost but now am found`}
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Use # headers for sections. Add more details after creation.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={createSong.isPending}
              className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSong.isPending}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {createSong.isPending ? 'Creating...' : 'Create Song'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
