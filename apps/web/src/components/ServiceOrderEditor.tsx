import { useState } from 'react';
import type { EventItem } from '@mobileworship/shared';

interface Song {
  id: string;
  title: string;
  author?: string | null;
}

interface ServiceOrderEditorProps {
  items: EventItem[];
  onChange: (items: EventItem[]) => void;
  songs: Song[];
  readOnly?: boolean;
}

export function ServiceOrderEditor({ items, onChange, songs, readOnly }: ServiceOrderEditorProps) {
  const [selectedSongId, setSelectedSongId] = useState('');

  const handleAddSong = () => {
    if (!selectedSongId) return;

    const song = songs.find((s) => s.id === selectedSongId);
    if (!song) return;

    const newItem: EventItem = {
      type: 'song',
      id: selectedSongId,
    };

    onChange([...items, newItem]);
    setSelectedSongId('');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    onChange(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    onChange(newItems);
  };

  const handleRemove = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const getItemTitle = (item: EventItem): string => {
    if (item.type === 'song') {
      const song = songs.find((s) => s.id === item.id);
      return song?.title || 'Unknown Song';
    }
    return item.type.charAt(0).toUpperCase() + item.type.slice(1);
  };

  const getTypeBadgeClass = (type: string): string => {
    const baseClass = 'px-2 py-0.5 text-xs rounded';
    switch (type) {
      case 'song':
        return `${baseClass} bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300`;
      case 'scripture':
        return `${baseClass} bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300`;
      case 'announcement':
        return `${baseClass} bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300`;
      default:
        return `${baseClass} bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`;
    }
  };

  return (
    <div className="space-y-4">
      {/* Item List */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border border-dashed dark:border-gray-700 rounded-lg">
          <p>No items in service order. Add songs to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"
            >
              {/* Item Number */}
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded font-medium text-sm">
                {index + 1}
              </div>

              {/* Item Info */}
              <div className="flex-1">
                <div className="font-medium">{getItemTitle(item)}</div>
                <span className={getTypeBadgeClass(item.type)}>{item.type}</span>
              </div>

              {/* Actions */}
              {!readOnly && (
                <div className="flex gap-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === items.length - 1}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleRemove(index)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                    title="Remove"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Song Section */}
      {!readOnly && (
        <div className="flex gap-2">
          <select
            value={selectedSongId}
            onChange={(e) => setSelectedSongId(e.target.value)}
            className="flex-1 px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-600"
          >
            <option value="">Select a song to add...</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
                {song.author ? ` - ${song.author}` : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddSong}
            disabled={!selectedSongId}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add Song
          </button>
        </div>
      )}
    </div>
  );
}
