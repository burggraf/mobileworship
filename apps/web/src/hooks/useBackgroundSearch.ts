import { useState, useCallback } from 'react';
import { useSupabase } from '@mobileworship/shared';
import type { BackgroundSource, BackgroundSearchResult, BackgroundSearchResponse } from '../types/backgrounds';

export function useBackgroundSearch() {
  const supabase = useSupabase();
  const [results, setResults] = useState<BackgroundSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentSource, setCurrentSource] = useState<BackgroundSource>('pexels');

  const searchBackgrounds = useCallback(async (query: string, source: BackgroundSource, page: number): Promise<BackgroundSearchResponse> => {
    const { data, error } = await supabase.functions.invoke('search-backgrounds', {
      body: { source, query, page },
    });

    if (error) {
      throw new Error(error.message || 'search_failed');
    }

    if (data.error) {
      throw new Error(data.error);
    }

    return data as BackgroundSearchResponse;
  }, [supabase]);

  const search = useCallback(async (query: string, source: BackgroundSource) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setCurrentQuery(query);
    setCurrentSource(source);
    setCurrentPage(1);

    try {
      const response = await searchBackgrounds(query, source, 1);
      setResults(response.results);
      setHasMore(response.hasMore);
      setCurrentPage(response.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'search_failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchBackgrounds]);

  const loadMore = useCallback(async () => {
    if (!currentQuery || isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const response = await searchBackgrounds(currentQuery, currentSource, currentPage);
      setResults(prev => [...prev, ...response.results]);
      setHasMore(response.hasMore);
      setCurrentPage(response.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'search_failed');
    } finally {
      setIsLoading(false);
    }
  }, [searchBackgrounds, currentQuery, currentSource, currentPage, isLoading, hasMore]);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
    setHasMore(false);
    setCurrentPage(1);
    setCurrentQuery('');
  }, []);

  return {
    results,
    isLoading,
    error,
    hasMore,
    search,
    loadMore,
    clear,
  };
}
