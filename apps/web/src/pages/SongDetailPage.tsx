import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useSongs, useAuth } from '@mobileworship/shared';
import type { SongContent } from '@mobileworship/shared';
import { SongEditor } from '../components/SongEditor';

export function SongDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { songs, updateSong, deleteSong } = useSongs();
  const { can } = useAuth();

  // Find the song
  const song = songs.find((s) => s.id === id);

  // Local state for editing
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState<SongContent>({ sections: [] });
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize state when song loads
  useEffect(() => {
    if (song) {
      setTitle(song.title);
      setAuthor(song.author || '');
      setContent((song.content as unknown) as SongContent);
      setHasChanges(false);
    }
  }, [song]);

  // Track changes
  useEffect(() => {
    if (!song) return;
    const titleChanged = title !== song.title;
    const authorChanged = author !== (song.author || '');
    const contentChanged = JSON.stringify(content) !== JSON.stringify(song.content);
    setHasChanges(titleChanged || authorChanged || contentChanged);
  }, [title, author, content, song]);

  if (!song) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Song not found</p>
        <Link
          to="/dashboard/songs"
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          Back to Songs
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;
    setError(null);

    // Validation
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (content.sections.length === 0) {
      setError('Song must have at least one section');
      return;
    }

    try {
      await updateSong.mutateAsync({
        id,
        title: title.trim(),
        author: author.trim() || undefined,
        content,
      });
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save song');
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${song.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteSong.mutateAsync(id);
      navigate('/dashboard/songs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete song');
    }
  };

  const canEdit = can('songs:write');
  const isSaving = updateSong.isPending;
  const isDeleting = deleteSong.isPending;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/dashboard/songs"
          className="text-primary-600 hover:text-primary-700 hover:underline text-sm mb-4 inline-block"
        >
          &larr; Back to Songs
        </Link>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Edit Song</h2>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="px-4 py-2 border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || isDeleting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
        >
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Song Form */}
      <div className="space-y-6">
        {/* Title Field */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!canEdit || isSaving || isDeleting}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Enter song title"
          />
        </div>

        {/* Author Field */}
        <div>
          <label htmlFor="author" className="block text-sm font-medium mb-1">
            Author
          </label>
          <input
            id="author"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            disabled={!canEdit || isSaving || isDeleting}
            className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="Enter author name"
          />
        </div>

        {/* Lyrics Editor */}
        <div>
          <label className="block text-sm font-medium mb-2">Lyrics</label>
          <SongEditor
            content={content}
            onChange={setContent}
            readOnly={!canEdit || isSaving || isDeleting}
          />
        </div>
      </div>
    </div>
  );
}
