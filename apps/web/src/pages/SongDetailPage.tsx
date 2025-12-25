import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSongs, useAuth, useMedia, useSupabase, parseSongMarkdown, buildSongMarkdown } from '@mobileworship/shared';
import type { SongMetadata } from '@mobileworship/shared';
import { SongEditor } from '../components/SongEditor';
import { MediaPicker } from '../components/MediaPicker';

export function SongDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const supabase = useSupabase();
  const { songs, updateSong, deleteSong } = useSongs();
  const { can } = useAuth();
  const { media, getPublicUrl } = useMedia();

  const song = songs.find((s) => s.id === id);

  // Local state for editing
  const [metadata, setMetadata] = useState<SongMetadata>({ title: '' });
  const [lyrics, setLyrics] = useState('');
  const [backgroundId, setBackgroundId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [isAIFormatting, setIsAIFormatting] = useState(false);

  // Parse song lyrics on load
  useEffect(() => {
    if (song) {
      try {
        const parsed = parseSongMarkdown(song.lyrics || '', song.title);
        setMetadata({ ...parsed.metadata, author: parsed.metadata.author || song.author || undefined });
        // Extract just the lyrics body (without frontmatter)
        if (song.lyrics) {
          const bodyMatch = song.lyrics.match(/^---[\s\S]*?---\r?\n([\s\S]*)$/);
          setLyrics(bodyMatch ? bodyMatch[1].trim() : song.lyrics);
        } else {
          setLyrics('');
        }
      } catch {
        // Fallback for songs without proper markdown
        setMetadata({ title: song.title, author: song.author || undefined });
        setLyrics('');
      }
      setBackgroundId(song.default_background_id || null);
      setHasChanges(false);
    }
  }, [song]);

  // Track changes
  useEffect(() => {
    if (!song) return;

    const lyricsChanged = lyrics !== (song.lyrics?.match(/^---[\s\S]*?---\r?\n([\s\S]*)$/)?.[1]?.trim() || '');
    const metadataChanged = metadata.title !== song.title ||
                           metadata.author !== (song.author || undefined) ||
                           metadata.key !== (song.key || undefined) ||
                           metadata.tempo !== (song.tempo || undefined);
    const backgroundChanged = backgroundId !== (song.default_background_id || null);

    setHasChanges(lyricsChanged || metadataChanged || backgroundChanged);
  }, [metadata, lyrics, backgroundId, song]);

  if (!song) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">{t('songs.notFound')}</p>
        <Link
          to="/dashboard/songs"
          className="text-primary-600 hover:text-primary-700 hover:underline"
        >
          {t('songs.backToSongs')}
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    if (!id) return;
    setError(null);

    if (!metadata.title.trim()) {
      setError(t('songs.edit.titleRequired'));
      return;
    }

    try {
      // Build full markdown by combining frontmatter with lyrics body
      const frontmatter = buildSongMarkdown({
        metadata,
        sections: [],
      }).trim();
      const fullMarkdown = `${frontmatter}\n\n${lyrics}`;

      await updateSong.mutateAsync({
        id,
        title: metadata.title.trim(),
        author: metadata.author?.trim() || undefined,
        lyrics: fullMarkdown,
        key: metadata.key,
        tempo: metadata.tempo,
        tags: metadata.tags,
        defaultBackgroundId: backgroundId || undefined,
      });
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('songs.edit.saveFailed'));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = window.confirm(t('songs.edit.deleteConfirm', { title: song.title }));
    if (!confirmed) return;

    try {
      await deleteSong.mutateAsync(id);
      navigate('/dashboard/songs');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('songs.edit.deleteFailed'));
    }
  };

  const handleAIFormat = async () => {
    if (!lyrics.trim()) return;
    setError(null);
    setIsAIFormatting(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ai-format-lyrics', {
        body: {
          rawText: lyrics,
          hints: {
            title: metadata.title,
            author: metadata.author,
          },
        },
      });

      if (fnError) throw fnError;

      // Convert JSON sections to markdown format
      const sections = data?.sections || [];
      const formattedLyrics = sections
        .map((section: { label: string; lines: string[] }) => {
          return `# ${section.label}\n${section.lines.join('\n')}`;
        })
        .join('\n\n');

      setLyrics(formattedLyrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('songs.edit.aiFormatFailed'));
    } finally {
      setIsAIFormatting(false);
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
          &larr; {t('songs.backToSongs')}
        </Link>
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">{t('songs.edit.title')}</h2>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting || isSaving}
                className="px-4 py-2 border border-red-600 text-red-600 dark:border-red-500 dark:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
              >
                {isDeleting ? t('songs.edit.deleting') : t('songs.edit.delete')}
              </button>
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving || isDeleting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
              >
                {isSaving ? t('songs.edit.saving') : t('songs.edit.save')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Song Editor */}
      <SongEditor
        metadata={metadata}
        lyrics={lyrics}
        onMetadataChange={setMetadata}
        onLyricsChange={setLyrics}
        onAIFormat={handleAIFormat}
        isAIFormatting={isAIFormatting}
        readOnly={!canEdit || isSaving || isDeleting}
      />

      {/* Background Section */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">{t('songs.edit.background')}</label>
        <div className="flex items-start gap-4">
          {backgroundId ? (
            <div className="relative w-48 aspect-video rounded-lg overflow-hidden border dark:border-gray-700">
              {(() => {
                const backgroundMedia = media.find((m) => m.id === backgroundId);
                if (!backgroundMedia) {
                  return (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
                      <span className="text-gray-400 text-sm">{t('songs.edit.notFoundMedia')}</span>
                    </div>
                  );
                }
                const publicUrl = getPublicUrl(backgroundMedia.storage_path);
                return (
                  <img src={publicUrl} alt={t('songs.edit.background')} className="w-full h-full object-cover" />
                );
              })()}
            </div>
          ) : (
            <div className="w-48 aspect-video rounded-lg bg-gray-100 dark:bg-gray-900 border dark:border-gray-700 flex items-center justify-center">
              <span className="text-gray-400 text-sm">{t('songs.edit.noBackground')}</span>
            </div>
          )}
          <button
            onClick={() => setIsMediaPickerOpen(true)}
            disabled={!canEdit || isSaving || isDeleting}
            className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            {t('songs.edit.changeBackground')}
          </button>
        </div>
      </div>

      <MediaPicker
        isOpen={isMediaPickerOpen}
        onClose={() => setIsMediaPickerOpen(false)}
        onSelect={setBackgroundId}
        selectedId={backgroundId || undefined}
      />
    </div>
  );
}
