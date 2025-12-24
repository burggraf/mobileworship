import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSongs, useAuth } from '@mobileworship/shared';
import { CreateSongModal } from '../components/CreateSongModal';
import { SearchHymnsModal } from '../components/SearchHymnsModal';

export function SongsPage() {
  const { t } = useTranslation();
  const { songs, isLoading } = useSongs();
  const { can } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return <div role="status" className="text-gray-500">{t('common.loading')}</div>;
  }

  // Filter songs based on search query and selected tag
  const filteredSongs = songs.filter(song => {
    const matchesSearch = !searchQuery ||
      song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      song.author?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag = !selectedTag || song.tags?.includes(selectedTag);

    return matchesSearch && matchesTag;
  });

  // Get unique tags from all songs
  const allTags = [...new Set(songs.flatMap(s => s.tags || []))].sort();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('songs.title')}</h2>
        {can('songs:write') && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center gap-2"
            >
              {t('songs.addSong')}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-1 z-10">
                <button
                  onClick={() => {
                    setShowCreate(true);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  {t('songs.addMenu.pasteLyrics')}
                </button>
                <button
                  onClick={() => {
                    setShowSearch(true);
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  {t('songs.addMenu.searchDatabase')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {songs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>{t('songs.noSongs')}</p>
        </div>
      ) : (
        <>
          {/* Search and Filter Controls */}
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              placeholder={t('songs.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <select
              value={selectedTag || ''}
              onChange={(e) => setSelectedTag(e.target.value || null)}
              className="px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">{t('songs.allTags')}</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* Filtered Count */}
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {t('songs.showing', { count: filteredSongs.length, total: songs.length })}
          </div>

          {/* Song Grid */}
          {filteredSongs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>{t('songs.noResults')}</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSongs.map((song) => (
                <Link
                  key={song.id}
                  to={`/dashboard/songs/${song.id}`}
                  className="p-4 border dark:border-gray-700 rounded-lg hover:border-primary-500 transition block"
                >
                  <h3 className="font-semibold">{song.title}</h3>
                  {song.author && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{song.author}</p>
                  )}
                  {song.tags && song.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {song.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <CreateSongModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
      />

      <SearchHymnsModal
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
      />
    </div>
  );
}
