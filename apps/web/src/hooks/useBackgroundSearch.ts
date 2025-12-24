import { useState, useCallback } from 'react';
import type { BackgroundSource, BackgroundSearchResult, BackgroundSearchResponse } from '../types/backgrounds';

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY;
const UNSPLASH_ACCESS_KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
const PIXABAY_API_KEY = import.meta.env.VITE_PIXABAY_API_KEY;

const PER_PAGE = 20;

async function searchPexels(query: string, page: number): Promise<BackgroundSearchResponse> {
  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${PER_PAGE}&page=${page}`,
    { headers: { Authorization: PEXELS_API_KEY } }
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error('rate_limited');
    throw new Error('search_failed');
  }

  const data = await response.json();

  return {
    results: data.photos.map((photo: any) => ({
      id: `pexels-${photo.id}`,
      source: 'pexels' as BackgroundSource,
      thumbnailUrl: photo.src.medium,
      previewUrl: photo.src.large,
      fullUrl: photo.src.original,
      width: photo.width,
      height: photo.height,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      sourcePageUrl: photo.url,
    })),
    totalResults: data.total_results,
    hasMore: data.next_page != null,
    nextPage: page + 1,
  };
}

async function searchUnsplash(query: string, page: number): Promise<BackgroundSearchResponse> {
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${PER_PAGE}&page=${page}`,
    { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error('rate_limited');
    throw new Error('search_failed');
  }

  const data = await response.json();

  return {
    results: data.results.map((photo: any) => ({
      id: `unsplash-${photo.id}`,
      source: 'unsplash' as BackgroundSource,
      thumbnailUrl: photo.urls.small,
      previewUrl: photo.urls.regular,
      fullUrl: photo.urls.full,
      width: photo.width,
      height: photo.height,
      photographer: photo.user.name,
      photographerUrl: photo.user.links.html,
      sourcePageUrl: photo.links.html,
    })),
    totalResults: data.total,
    hasMore: page * PER_PAGE < data.total,
    nextPage: page + 1,
  };
}

async function searchPixabay(query: string, page: number): Promise<BackgroundSearchResponse> {
  const response = await fetch(
    `https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(query)}&orientation=horizontal&per_page=${PER_PAGE}&page=${page}&safesearch=true&image_type=photo`
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error('rate_limited');
    throw new Error('search_failed');
  }

  const data = await response.json();

  return {
    results: data.hits.map((photo: any) => ({
      id: `pixabay-${photo.id}`,
      source: 'pixabay' as BackgroundSource,
      thumbnailUrl: photo.webformatURL,
      previewUrl: photo.webformatURL,
      fullUrl: photo.largeImageURL,
      width: photo.imageWidth,
      height: photo.imageHeight,
      photographer: photo.user,
      photographerUrl: `https://pixabay.com/users/${photo.user}-${photo.user_id}/`,
      sourcePageUrl: photo.pageURL,
    })),
    totalResults: data.totalHits,
    hasMore: page * PER_PAGE < data.totalHits,
    nextPage: page + 1,
  };
}

export function useBackgroundSearch() {
  const [results, setResults] = useState<BackgroundSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentSource, setCurrentSource] = useState<BackgroundSource>('pexels');

  const search = useCallback(async (query: string, source: BackgroundSource) => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setCurrentQuery(query);
    setCurrentSource(source);
    setCurrentPage(1);

    try {
      const searchFn = source === 'pexels' ? searchPexels
        : source === 'unsplash' ? searchUnsplash
        : searchPixabay;

      const response = await searchFn(query, 1);
      setResults(response.results);
      setHasMore(response.hasMore);
      setCurrentPage(response.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'search_failed');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!currentQuery || isLoading || !hasMore) return;

    setIsLoading(true);

    try {
      const searchFn = currentSource === 'pexels' ? searchPexels
        : currentSource === 'unsplash' ? searchUnsplash
        : searchPixabay;

      const response = await searchFn(currentQuery, currentPage);
      setResults(prev => [...prev, ...response.results]);
      setHasMore(response.hasMore);
      setCurrentPage(response.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'search_failed');
    } finally {
      setIsLoading(false);
    }
  }, [currentQuery, currentSource, currentPage, isLoading, hasMore]);

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
