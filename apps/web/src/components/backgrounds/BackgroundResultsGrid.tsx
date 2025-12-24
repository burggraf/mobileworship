import { useTranslation } from 'react-i18next';
import type { BackgroundSearchResult } from '../../types/backgrounds';
import { LoadingSpinner } from '../LoadingSpinner';

interface BackgroundResultsGridProps {
  results: BackgroundSearchResult[];
  isLoading: boolean;
  error: string | null;
  query: string;
  hasMore: boolean;
  onSelect: (background: BackgroundSearchResult) => void;
  onLoadMore: () => void;
}

export function BackgroundResultsGrid({
  results,
  isLoading,
  error,
  query,
  hasMore,
  onSelect,
  onLoadMore,
}: BackgroundResultsGridProps) {
  const { t } = useTranslation();

  if (error === 'rate_limited') {
    return (
      <div className="text-center py-12">
        <p className="text-amber-600 dark:text-amber-400">
          {t('media.backgrounds.rateLimited')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">
          {t('media.backgrounds.importError')}
        </p>
      </div>
    );
  }

  if (!isLoading && results.length === 0 && query) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          {t('media.backgrounds.noResults', { query })}
        </p>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {results.map((background) => (
          <button
            key={background.id}
            onClick={() => onSelect(background)}
            className="relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group hover:ring-2 hover:ring-primary-500 transition"
          >
            <img
              src={background.thumbnailUrl}
              alt={`Photo by ${background.photographer}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-white text-sm font-medium transition">
                {t('media.backgrounds.preview')}
              </span>
            </div>
            <span className="absolute bottom-2 left-2 px-2 py-0.5 text-xs bg-black/50 text-white rounded capitalize">
              {background.source}
            </span>
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <LoadingSpinner />
        </div>
      )}

      {hasMore && !isLoading && (
        <div className="flex justify-center">
          <button
            onClick={onLoadMore}
            className="px-6 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            {t('media.backgrounds.loadMore')}
          </button>
        </div>
      )}
    </div>
  );
}
