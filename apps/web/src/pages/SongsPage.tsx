import { useState } from 'react';
import { useSongs, useAuth } from '@mobileworship/shared';

export function SongsPage() {
  const { songs, isLoading, createSong, deleteSong } = useSongs();
  const { can } = useAuth();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return <div className="text-gray-500">Loading songs...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Songs</h2>
        {can('songs:write') && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            Add Song
          </button>
        )}
      </div>

      {songs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No songs yet. Add your first song to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {songs.map((song) => (
            <div
              key={song.id}
              className="p-4 border dark:border-gray-700 rounded-lg hover:border-primary-500 transition"
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
            </div>
          ))}
        </div>
      )}

      {/* TODO: Add CreateSongModal component */}
    </div>
  );
}
