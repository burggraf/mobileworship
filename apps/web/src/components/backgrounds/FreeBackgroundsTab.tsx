import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackgroundSource, BackgroundSearchResult } from '../../types/backgrounds';
import { useBackgroundSearch } from '../../hooks/useBackgroundSearch';
import { useImportBackground } from '../../hooks/useImportBackground';
import { SourceSelector } from './SourceSelector';
import { BackgroundSearchBar } from './BackgroundSearchBar';
import { BackgroundResultsGrid } from './BackgroundResultsGrid';
import { BackgroundPreviewModal } from './BackgroundPreviewModal';

interface FreeBackgroundsTabProps {
  onImportSuccess: () => void;
}

export function FreeBackgroundsTab({ onImportSuccess }: FreeBackgroundsTabProps) {
  const { t } = useTranslation();
  const [source, setSource] = useState<BackgroundSource>('pexels');
  const [selectedBackground, setSelectedBackground] = useState<BackgroundSearchResult | null>(null);
  const [currentQuery, setCurrentQuery] = useState('');

  const { results, isLoading, error, hasMore, search, loadMore } = useBackgroundSearch();
  const importBackground = useImportBackground();

  const handleSearch = (query: string) => {
    setCurrentQuery(query);
    search(query, source);
  };

  const handleSourceChange = (newSource: BackgroundSource) => {
    setSource(newSource);
    if (currentQuery) {
      search(currentQuery, newSource);
    }
  };

  const handleSelect = (background: BackgroundSearchResult) => {
    setSelectedBackground(background);
  };

  const handleImport = async () => {
    if (!selectedBackground) return;

    try {
      await importBackground.mutateAsync(selectedBackground);
      setSelectedBackground(null);
      onImportSuccess();
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  return (
    <div className="space-y-6">
      <SourceSelector selected={source} onChange={handleSourceChange} />

      <BackgroundSearchBar onSearch={handleSearch} isLoading={isLoading} />

      <BackgroundResultsGrid
        results={results}
        isLoading={isLoading}
        error={error}
        query={currentQuery}
        hasMore={hasMore}
        onSelect={handleSelect}
        onLoadMore={loadMore}
      />

      <BackgroundPreviewModal
        background={selectedBackground}
        isOpen={!!selectedBackground}
        isImporting={importBackground.isPending}
        onClose={() => setSelectedBackground(null)}
        onImport={handleImport}
      />
    </div>
  );
}
