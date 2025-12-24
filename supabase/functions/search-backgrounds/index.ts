import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type BackgroundSource = "pexels" | "unsplash" | "pixabay";

interface SearchRequest {
  source: BackgroundSource;
  query: string;
  page: number;
}

interface BackgroundResult {
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

interface SearchResponse {
  results: BackgroundResult[];
  totalResults: number;
  hasMore: boolean;
  nextPage: number;
}

const PER_PAGE = 20;

async function searchPexels(query: string, page: number, apiKey: string): Promise<SearchResponse> {
  const response = await fetch(
    `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${PER_PAGE}&page=${page}`,
    { headers: { Authorization: apiKey } }
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error("rate_limited");
    throw new Error("search_failed");
  }

  const data = await response.json();

  return {
    results: data.photos.map((photo: any) => ({
      id: `pexels-${photo.id}`,
      source: "pexels" as BackgroundSource,
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

async function searchUnsplash(query: string, page: number, accessKey: string): Promise<SearchResponse> {
  const response = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=${PER_PAGE}&page=${page}`,
    { headers: { Authorization: `Client-ID ${accessKey}` } }
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error("rate_limited");
    throw new Error("search_failed");
  }

  const data = await response.json();

  return {
    results: data.results.map((photo: any) => ({
      id: `unsplash-${photo.id}`,
      source: "unsplash" as BackgroundSource,
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

async function searchPixabay(query: string, page: number, apiKey: string): Promise<SearchResponse> {
  const response = await fetch(
    `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&orientation=horizontal&per_page=${PER_PAGE}&page=${page}&safesearch=true&image_type=photo`
  );

  if (!response.ok) {
    if (response.status === 429) throw new Error("rate_limited");
    throw new Error("search_failed");
  }

  const data = await response.json();

  return {
    results: data.hits.map((photo: any) => ({
      id: `pixabay-${photo.id}`,
      source: "pixabay" as BackgroundSource,
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source, query, page = 1 }: SearchRequest = await req.json();

    if (!source || !query) {
      return new Response(JSON.stringify({ error: "source and query are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let response: SearchResponse;

    switch (source) {
      case "pexels": {
        const apiKey = Deno.env.get("PEXELS_API_KEY");
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "PEXELS_API_KEY not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        response = await searchPexels(query, page, apiKey);
        break;
      }
      case "unsplash": {
        const accessKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
        if (!accessKey) {
          return new Response(JSON.stringify({ error: "UNSPLASH_ACCESS_KEY not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        response = await searchUnsplash(query, page, accessKey);
        break;
      }
      case "pixabay": {
        const apiKey = Deno.env.get("PIXABAY_API_KEY");
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "PIXABAY_API_KEY not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        response = await searchPixabay(query, page, apiKey);
        break;
      }
      default:
        return new Response(JSON.stringify({ error: "Invalid source" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Search error:", error);
    const message = error instanceof Error ? error.message : "search_failed";
    const status = message === "rate_limited" ? 429 : 500;
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
