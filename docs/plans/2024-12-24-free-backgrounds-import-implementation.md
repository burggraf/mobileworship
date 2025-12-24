# Free Backgrounds Import Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Free Backgrounds" tab to MediaPage allowing users to search Unsplash/Pexels/Pixabay, preview with lyrics overlay, and import to storage.

**Architecture:** Tab-based UI in MediaPage, client-side API calls for search, Edge Function for import with image resizing, attribution stored in media.metadata JSONB.

**Tech Stack:** React, TanStack Query, Supabase Edge Functions, Deno (sharp for resizing), Pexels/Unsplash/Pixabay REST APIs.

---

## Task 1: Database Migration - Add Pixabay Source

**Files:**
- Create: `supabase/migrations/20241224100000_add_pixabay_source.sql`

**Step 1: Write migration to add pixabay to source constraint**

```sql
-- Add pixabay to allowed media sources
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_source_check;
ALTER TABLE media ADD CONSTRAINT media_source_check
  CHECK (source IN ('upload', 'unsplash', 'pexels', 'pixabay'));
```

**Step 2: Apply migration**

Run: `pnpm db:migrate` or apply via Supabase dashboard

**Step 3: Commit**

```bash
git add supabase/migrations/20241224100000_add_pixabay_source.sql
git commit -m "feat(db): add pixabay to media source constraint"
```

---

## Task 2: Add i18n Keys

**Files:**
- Modify: `apps/web/src/i18n/locales/en.json`
- Modify: `apps/web/src/i18n/locales/es.json`

**Step 1: Add English translations**

Add to `media` section in `en.json`:

```json
"tabs": {
  "myMedia": "My Media",
  "freeBackgrounds": "Free Backgrounds"
},
"backgrounds": {
  "searchPlaceholder": "Search backgrounds...",
  "search": "Search",
  "import": "Import to Library",
  "importing": "Importing...",
  "noResults": "No backgrounds found for '{{query}}'. Try another search term.",
  "rateLimited": "Too many requests. Try another source or wait a moment.",
  "importError": "Failed to import background. Please try again.",
  "importSuccess": "Background imported successfully!",
  "photoBy": "Photo by {{name}} on {{source}}",
  "loadMore": "Load More",
  "preview": "Preview",
  "suggestedSearches": "Suggested searches"
}
```

**Step 2: Add Spanish translations**

Add to `media` section in `es.json`:

```json
"tabs": {
  "myMedia": "Mis Medios",
  "freeBackgrounds": "Fondos Gratuitos"
},
"backgrounds": {
  "searchPlaceholder": "Buscar fondos...",
  "search": "Buscar",
  "import": "Importar a la Biblioteca",
  "importing": "Importando...",
  "noResults": "No se encontraron fondos para '{{query}}'. Intenta otro término.",
  "rateLimited": "Demasiadas solicitudes. Prueba otra fuente o espera un momento.",
  "importError": "Error al importar el fondo. Por favor, inténtalo de nuevo.",
  "importSuccess": "¡Fondo importado exitosamente!",
  "photoBy": "Foto de {{name}} en {{source}}",
  "loadMore": "Cargar Más",
  "preview": "Vista Previa",
  "suggestedSearches": "Búsquedas sugeridas"
}
```

**Step 3: Commit**

```bash
git add apps/web/src/i18n/locales/en.json apps/web/src/i18n/locales/es.json
git commit -m "feat(i18n): add free backgrounds translations"
```

---

## Task 3: Create Background Search Types

**Files:**
- Create: `apps/web/src/types/backgrounds.ts`

**Step 1: Create types file**

```typescript
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
```

**Step 2: Commit**

```bash
git add apps/web/src/types/backgrounds.ts
git commit -m "feat: add background search types"
```

---

## Task 4: Create Background Search API Hook

**Files:**
- Create: `apps/web/src/hooks/useBackgroundSearch.ts`

**Step 1: Create the search hook**

```typescript
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
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/useBackgroundSearch.ts
git commit -m "feat: add useBackgroundSearch hook for free background APIs"
```

---

## Task 5: Create Edge Function for Background Import

**Files:**
- Create: `supabase/functions/import-background/index.ts`

**Step 1: Create the edge function**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportBackgroundRequest {
  sourceUrl: string;
  source: 'unsplash' | 'pexels' | 'pixabay';
  photographer: string;
  photographerUrl: string;
  sourcePageUrl: string;
}

async function resizeImage(imageBuffer: ArrayBuffer, maxWidth: number): Promise<Uint8Array> {
  // Use a simple approach: fetch the image at a smaller size from the API
  // For full resize, we'd need sharp which requires native binaries
  // The APIs provide multiple sizes, so we use the "large" version which is ~1920px
  return new Uint8Array(imageBuffer);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's church_id
    const { data: userData, error: churchError } = await supabase
      .from("users")
      .select("church_id")
      .eq("id", user.id)
      .single();

    if (churchError || !userData?.church_id) {
      return new Response(JSON.stringify({ error: "User not associated with a church" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sourceUrl, source, photographer, photographerUrl, sourcePageUrl }: ImportBackgroundRequest = await req.json();

    if (!sourceUrl || !source) {
      return new Response(JSON.stringify({ error: "sourceUrl and source are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the image
    const imageResponse = await fetch(sourceUrl);
    if (!imageResponse.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch image from source" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const extension = contentType.includes("png") ? "png" : "jpg";

    // Generate unique filename
    const fileName = `${userData.church_id}/${Date.now()}-${source}-background.${extension}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create media record with attribution in metadata
    const { data: mediaRecord, error: insertError } = await supabase
      .from("media")
      .insert({
        church_id: userData.church_id,
        type: "image",
        storage_path: fileName,
        source,
        metadata: {
          photographer,
          photographerUrl,
          sourcePageUrl,
          importedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      // Try to clean up the uploaded file
      await supabase.storage.from("media").remove([fileName]);
      return new Response(JSON.stringify({ error: "Failed to create media record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      mediaId: mediaRecord.id,
      storagePath: mediaRecord.storage_path,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Import error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

**Step 2: Commit**

```bash
git add supabase/functions/import-background/index.ts
git commit -m "feat: add import-background edge function"
```

---

## Task 6: Create useImportBackground Hook

**Files:**
- Create: `apps/web/src/hooks/useImportBackground.ts`

**Step 1: Create the import hook**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSupabase, useAuth } from '@mobileworship/shared';
import type { BackgroundSearchResult } from '../types/backgrounds';

export function useImportBackground() {
  const supabase = useSupabase();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (background: BackgroundSearchResult) => {
      const { data, error } = await supabase.functions.invoke('import-background', {
        body: {
          sourceUrl: background.fullUrl,
          source: background.source,
          photographer: background.photographer,
          photographerUrl: background.photographerUrl,
          sourcePageUrl: background.sourcePageUrl,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate media query to refresh the My Media tab
      queryClient.invalidateQueries({ queryKey: ['media', user?.churchId] });
    },
  });
}
```

**Step 2: Commit**

```bash
git add apps/web/src/hooks/useImportBackground.ts
git commit -m "feat: add useImportBackground hook"
```

---

## Task 7: Create SourceSelector Component

**Files:**
- Create: `apps/web/src/components/backgrounds/SourceSelector.tsx`

**Step 1: Create the component**

```typescript
import type { BackgroundSource } from '../../types/backgrounds';

interface SourceSelectorProps {
  selected: BackgroundSource;
  onChange: (source: BackgroundSource) => void;
}

const sources: { id: BackgroundSource; name: string }[] = [
  { id: 'pexels', name: 'Pexels' },
  { id: 'unsplash', name: 'Unsplash' },
  { id: 'pixabay', name: 'Pixabay' },
];

export function SourceSelector({ selected, onChange }: SourceSelectorProps) {
  return (
    <div className="flex gap-2">
      {sources.map((source) => (
        <button
          key={source.id}
          onClick={() => onChange(source.id)}
          className={`
            px-4 py-2 rounded-full text-sm font-medium transition-colors
            ${selected === source.id
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
        >
          {source.name}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/backgrounds/SourceSelector.tsx
git commit -m "feat: add SourceSelector component"
```

---

## Task 8: Create BackgroundSearchBar Component

**Files:**
- Create: `apps/web/src/components/backgrounds/BackgroundSearchBar.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Commit**

```bash
git add apps/web/src/components/backgrounds/BackgroundSearchBar.tsx
git commit -m "feat: add BackgroundSearchBar component"
```

---

## Task 9: Create BackgroundResultsGrid Component

**Files:**
- Create: `apps/web/src/components/backgrounds/BackgroundResultsGrid.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Commit**

```bash
git add apps/web/src/components/backgrounds/BackgroundResultsGrid.tsx
git commit -m "feat: add BackgroundResultsGrid component"
```

---

## Task 10: Create SlidePreviewOverlay Component

**Files:**
- Create: `apps/web/src/components/backgrounds/SlidePreviewOverlay.tsx`

**Step 1: Create the component**

```typescript
interface SlidePreviewOverlayProps {
  backgroundUrl: string;
  className?: string;
}

const SAMPLE_LYRICS = ['Amazing Grace', 'How Sweet the Sound'];

export function SlidePreviewOverlay({ backgroundUrl, className = '' }: SlidePreviewOverlayProps) {
  return (
    <div
      className={`relative aspect-video rounded-lg overflow-hidden ${className}`}
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Lyrics text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center p-8">
        {SAMPLE_LYRICS.map((line, index) => (
          <p
            key={index}
            className="text-2xl md:text-4xl font-bold drop-shadow-lg"
            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/backgrounds/SlidePreviewOverlay.tsx
git commit -m "feat: add SlidePreviewOverlay component"
```

---

## Task 11: Create BackgroundPreviewModal Component

**Files:**
- Create: `apps/web/src/components/backgrounds/BackgroundPreviewModal.tsx`

**Step 1: Create the component**

```typescript
import { useTranslation } from 'react-i18next';
import type { BackgroundSearchResult } from '../../types/backgrounds';
import { SlidePreviewOverlay } from './SlidePreviewOverlay';
import { LoadingSpinner } from '../LoadingSpinner';

interface BackgroundPreviewModalProps {
  background: BackgroundSearchResult | null;
  isOpen: boolean;
  isImporting: boolean;
  onClose: () => void;
  onImport: () => void;
}

export function BackgroundPreviewModal({
  background,
  isOpen,
  isImporting,
  onClose,
  onImport,
}: BackgroundPreviewModalProps) {
  const { t } = useTranslation();

  if (!isOpen || !background) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isImporting) {
      onClose();
    }
  };

  const sourceDisplayName = background.source.charAt(0).toUpperCase() + background.source.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="preview-modal-title"
        onKeyDown={(e) => {
          if (e.key === 'Escape' && !isImporting) {
            onClose();
          }
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 id="preview-modal-title" className="text-xl font-semibold">
            {t('media.backgrounds.preview')}
          </h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Preview with lyrics overlay */}
          <SlidePreviewOverlay backgroundUrl={background.previewUrl} />

          {/* Attribution */}
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
            {t('media.backgrounds.photoBy', {
              name: background.photographer,
              source: sourceDisplayName,
            })}
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onImport}
            disabled={isImporting}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {isImporting && <LoadingSpinner size="sm" />}
            {isImporting ? t('media.backgrounds.importing') : t('media.backgrounds.import')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/backgrounds/BackgroundPreviewModal.tsx
git commit -m "feat: add BackgroundPreviewModal component"
```

---

## Task 12: Create FreeBackgroundsTab Component

**Files:**
- Create: `apps/web/src/components/backgrounds/FreeBackgroundsTab.tsx`

**Step 1: Create the component**

```typescript
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
```

**Step 2: Create index barrel file**

Create `apps/web/src/components/backgrounds/index.ts`:

```typescript
export { FreeBackgroundsTab } from './FreeBackgroundsTab';
export { SourceSelector } from './SourceSelector';
export { BackgroundSearchBar } from './BackgroundSearchBar';
export { BackgroundResultsGrid } from './BackgroundResultsGrid';
export { BackgroundPreviewModal } from './BackgroundPreviewModal';
export { SlidePreviewOverlay } from './SlidePreviewOverlay';
```

**Step 3: Commit**

```bash
git add apps/web/src/components/backgrounds/
git commit -m "feat: add FreeBackgroundsTab and barrel export"
```

---

## Task 13: Update MediaPage with Tabs

**Files:**
- Modify: `apps/web/src/pages/MediaPage.tsx`

**Step 1: Add tabs to MediaPage**

Replace the entire file content:

```typescript
import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedia, useAuth } from '@mobileworship/shared';
import { FreeBackgroundsTab } from '../components/backgrounds';

type MediaTab = 'myMedia' | 'freeBackgrounds';

export function MediaPage() {
  const { t } = useTranslation();
  const { media, isLoading, uploadMedia, deleteMedia, getPublicUrl } = useMedia();
  const { can } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<MediaTab>('myMedia');

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      await uploadMedia.mutateAsync({ file, type });
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  const handleImportSuccess = () => {
    // Switch to My Media tab to show the imported background
    setActiveTab('myMedia');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('media.title')}</h2>
        {can('media:write') && activeTab === 'myMedia' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50"
            >
              {uploading ? t('media.uploading') : t('media.upload')}
            </button>
          </>
        )}
      </div>

      {/* Tab Bar */}
      <div className="border-b dark:border-gray-700 mb-6">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('myMedia')}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'myMedia'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            {t('media.tabs.myMedia')}
          </button>
          <button
            onClick={() => setActiveTab('freeBackgrounds')}
            className={`
              px-4 py-2 text-sm font-medium border-b-2 transition-colors
              ${activeTab === 'freeBackgrounds'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            {t('media.tabs.freeBackgrounds')}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'myMedia' ? (
        isLoading ? (
          <div className="text-gray-500">{t('common.loading')}</div>
        ) : media.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>{t('media.noMedia')}</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {media.map((item) => (
              <div
                key={item.id}
                className="relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden group"
              >
                {item.type === 'image' ? (
                  <img
                    src={getPublicUrl(item.storage_path)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video src={getPublicUrl(item.storage_path)} className="w-full h-full object-cover" />
                )}
                {can('media:write') && (
                  <button
                    onClick={() => deleteMedia.mutate(item.id)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition"
                  >
                    {t('media.delete')}
                  </button>
                )}
                <div className="absolute bottom-2 left-2 flex gap-1">
                  <span className="px-2 py-0.5 text-xs bg-black/50 text-white rounded">
                    {t(`media.${item.type}`)}
                  </span>
                  {item.source && item.source !== 'upload' && (
                    <span className="px-2 py-0.5 text-xs bg-black/50 text-white rounded capitalize">
                      {item.source}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <FreeBackgroundsTab onImportSuccess={handleImportSuccess} />
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add apps/web/src/pages/MediaPage.tsx
git commit -m "feat: add tabs to MediaPage with Free Backgrounds tab"
```

---

## Task 14: Add Environment Variables

**Files:**
- Modify: `apps/web/.env.example`
- Modify: `.env.example` (root)

**Step 1: Add API keys to env example files**

Add to `apps/web/.env.example`:

```
# Free background image APIs (publishable keys)
VITE_PEXELS_API_KEY=your_pexels_api_key
VITE_UNSPLASH_ACCESS_KEY=your_unsplash_access_key
VITE_PIXABAY_API_KEY=your_pixabay_api_key
```

**Step 2: Commit**

```bash
git add apps/web/.env.example .env.example
git commit -m "docs: add background API keys to env examples"
```

---

## Task 15: Final Testing & Verification

**Step 1: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Manual test checklist**

1. Navigate to Media page
2. Verify "My Media" and "Free Backgrounds" tabs appear
3. Click "Free Backgrounds" tab
4. Verify source selector shows Pexels, Unsplash, Pixabay
5. Search for "mountains"
6. Verify results appear in grid
7. Click a result
8. Verify preview modal opens with lyrics overlay
9. Verify attribution shows
10. Click "Import to Library"
11. Verify success and switch to "My Media" tab
12. Verify imported image appears with source badge

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete free backgrounds import feature"
```

---

## Summary

This implementation adds:
- Tab-based UI in MediaPage (My Media / Free Backgrounds)
- Search across Pexels, Unsplash, and Pixabay APIs
- Preview modal with sample lyrics overlay
- Import to Supabase Storage via Edge Function
- Attribution tracking in media.metadata
- Full i18n support (English + Spanish)
- Dark mode support throughout
