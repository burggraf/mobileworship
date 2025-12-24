import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BackgroundSearchBarProps {
  onSearch: (query: string) => void;
  isLoading: boolean;
}

const SUGGESTED_TERMS = [
  'mountains',
  'sky',
  'sunset',
  'bokeh',
  'light rays',
  'nature',
  'abstract',
  'church',
  'cross',
  'water',
];

export function BackgroundSearchBar({ onSearch, isLoading }: BackgroundSearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleSuggestionClick = (term: string) => {
    setQuery(term);
    onSearch(term);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('media.backgrounds.searchPlaceholder')}
            className="w-full px-4 py-2 pl-10 border dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
        >
          {t('media.backgrounds.search')}
        </button>
      </form>

      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
          {t('media.backgrounds.suggestedSearches')}
        </p>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TERMS.map((term) => (
            <button
              key={term}
              onClick={() => handleSuggestionClick(term)}
              className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              {term}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
