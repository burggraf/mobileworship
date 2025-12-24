import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalHymns, useSongs, parseSongMarkdown } from '@mobileworship/shared';
import type { GlobalHymn } from '@mobileworship/shared';

interface SearchHymnsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchHymnsModal({ isOpen, onClose }: SearchHymnsModalProps) {
  const { t } = useTranslation();
  const { createSong } = useSongs();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedHymn, setSelectedHymn] = useState<GlobalHymn | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { hymns, isLoading } = useGlobalHymns(debouncedQuery);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setDebouncedQuery('');
      setSelectedHymn(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleImport = async () => {
    if (!selectedHymn) return;

    setImporting(true);
    setError(null);

    try {
      await createSong.mutateAsync({
        title: selectedHymn.title,
        author: selectedHymn.author || undefined,
        lyrics: selectedHymn.lyrics || '',
        tags: selectedHymn.tags || ['hymn', 'public-domain'],
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('songs.search.importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (!importing) {
      onClose();
    }
  };

  // Parse lyrics for preview - need to inject title into frontmatter since hymns only have source metadata
  const parsedLyrics = (() => {
    if (!selectedHymn?.lyrics) return null;
    try {
      // Replace the source-only frontmatter with full metadata frontmatter
      const lyricsWithTitle = selectedHymn.lyrics.replace(
        /^---\n([\s\S]*?)\n---/,
        `---\ntitle: ${selectedHymn.title}\nauthor: ${selectedHymn.author || ''}\n$1\n---`
      );
      return parseSongMarkdown(lyricsWithTitle);
    } catch {
      return null;
    }
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <h2 id="modal-title" className="text-xl font-semibold">{t('songs.search.title')}</h2>
          <button
            onClick={handleClose}
            disabled={importing}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Search Results */}
          <div className="w-1/2 border-r dark:border-gray-700 flex flex-col">
            {/* Search Input */}
            <div className="p-4 border-b dark:border-gray-700">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('songs.search.placeholder')}
                className="w-full px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600"
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('songs.search.hint')}
              </p>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500">
                  {t('common.loading')}
                </div>
              ) : hymns.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  {debouncedQuery ? t('songs.search.noResults') : t('songs.search.startTyping')}
                </div>
              ) : (
                <ul className="divide-y dark:divide-gray-700">
                  {hymns.map((hymn) => (
                    <li key={hymn.id}>
                      <button
                        onClick={() => setSelectedHymn(hymn)}
                        className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${
                          selectedHymn?.id === hymn.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                        }`}
                      >
                        <div className="font-medium">{hymn.title}</div>
                        {hymn.author && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {hymn.author}
                          </div>
                        )}
                        {hymn.composer && hymn.composer !== hymn.author && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {t('songs.search.composedBy', { name: hymn.composer })}
                          </div>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Results Count */}
            {hymns.length > 0 && (
              <div className="px-4 py-2 border-t dark:border-gray-700 text-xs text-gray-500">
                {t('songs.search.resultsCount', { count: hymns.length })}
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="w-1/2 flex flex-col">
            {selectedHymn ? (
              <>
                {/* Preview Header */}
                <div className="p-4 border-b dark:border-gray-700">
                  <h3 className="text-lg font-semibold">{selectedHymn.title}</h3>
                  {selectedHymn.author && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('songs.search.writtenBy', { name: selectedHymn.author })}
                    </p>
                  )}
                  {selectedHymn.composer && selectedHymn.composer !== selectedHymn.author && (
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {t('songs.search.composedBy', { name: selectedHymn.composer })}
                    </p>
                  )}
                  {selectedHymn.source_url && (
                    <p className="text-xs text-gray-400 mt-1">
                      {t('songs.search.source')}: {new URL(selectedHymn.source_url).hostname}
                    </p>
                  )}
                </div>

                {/* Preview Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {parsedLyrics?.sections && parsedLyrics.sections.length > 0 ? (
                    parsedLyrics.sections.map((section, idx) => (
                      <div key={idx} className="mb-4">
                        <div className="text-xs font-semibold text-primary-600 dark:text-primary-400 uppercase mb-1">
                          {section.label || section.type}
                        </div>
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">
                          {section.lines.join('\n')}
                        </div>
                      </div>
                    ))
                  ) : (
                    <pre className="text-sm whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
                      {selectedHymn.lyrics?.replace(/^---[\s\S]*?---\n*/, '') || ''}
                    </pre>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="mx-4 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                {/* Import Button */}
                <div className="p-4 border-t dark:border-gray-700">
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
                  >
                    {importing ? t('songs.search.importing') : t('songs.search.import')}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <p>{t('songs.search.selectToPreview')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
