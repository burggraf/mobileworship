import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDisplays, isDisplayOnline, useAuth } from '@mobileworship/shared';
import { AddDisplayModal } from '../components/AddDisplayModal';

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Never';
  const date = new Date(lastSeenAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return 'Yesterday';
  return `${diffDay} days ago`;
}

export function DisplaysPage() {
  const { t } = useTranslation();
  const { displays, isLoading } = useDisplays();
  const { can } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [, setTick] = useState(0);

  // Re-evaluate online status every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <div className="text-gray-500">{t('common.loading')}</div>;
  }

  const filteredDisplays = displays.filter(display => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      display.name.toLowerCase().includes(query) ||
      display.location?.toLowerCase().includes(query)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('displays.title')}</h2>
        {can('church:manage') && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            {t('displays.addDisplay')}
          </button>
        )}
      </div>

      {displays.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="mb-4">{t('displays.noDisplays')}</p>
          {can('church:manage') && (
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
            >
              {t('displays.addDisplay')}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder={t('displays.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full max-w-md px-3 py-2 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Display List */}
          <div className="space-y-2">
            {filteredDisplays.map((display) => {
              const online = isDisplayOnline(display.lastSeenAt);
              return (
                <Link
                  key={display.id}
                  to={`/dashboard/displays/${display.id}`}
                  className="flex items-center p-4 border dark:border-gray-700 rounded-lg hover:border-primary-500 transition"
                >
                  <div
                    className={`w-3 h-3 rounded-full mr-4 ${
                      online ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold">{display.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {display.location && `${display.location} • `}
                      {t('displays.lastSeen')}: {formatLastSeen(display.lastSeenAt)}
                    </p>
                  </div>
                  {display.deviceInfo && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mr-4">
                      {display.deviceInfo.platform} • {display.deviceInfo.resolution.width}x{display.deviceInfo.resolution.height}
                    </div>
                  )}
                  <span className={`px-2 py-1 text-xs rounded ${
                    online
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {online ? t('displays.online') : t('displays.offline')}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <AddDisplayModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
      />
    </div>
  );
}
