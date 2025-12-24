export type BackgroundSource = 'unsplash' | 'pexels' | 'pixabay';

export interface BackgroundSearchResult {
  id: string;
  source: BackgroundSource;
  thumbnailUrl: string;
  previewUrl: string;
  fullUrl: string;
  width: number;
  height: number;
  photographer: string;
  photographerUrl: string;
  sourcePageUrl: string;
}

export interface BackgroundSearchResponse {
  results: BackgroundSearchResult[];
  totalResults: number;
  hasMore: boolean;
  nextPage: number;
}

export interface ImportBackgroundRequest {
  sourceUrl: string;
  source: BackgroundSource;
  photographer: string;
  photographerUrl: string;
  sourcePageUrl: string;
}

export interface ImportBackgroundResponse {
  mediaId: string;
  storagePath: string;
}
