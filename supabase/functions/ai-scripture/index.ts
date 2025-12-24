import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScriptureRequest {
  reference: string;
  translation?: string;
  maxLinesPerSlide?: number;
}

interface ScriptureSlide {
  text: string;
  reference: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reference, translation = "NIV", maxLinesPerSlide = 4 }: ScriptureRequest =
      await req.json();

    if (!reference) {
      return new Response(JSON.stringify({ error: "reference is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch from Bible API (using API.Bible as example)
    const bibleApiKey = Deno.env.get("BIBLE_API_KEY");

    // For MVP, we'll use a free API like bible-api.com
    const response = await fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation.toLowerCase()}`
    );

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "Failed to fetch scripture" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    if (!data.text) {
      return new Response(JSON.stringify({ error: "Scripture not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Split text into slides
    const fullText = data.text.trim();
    const sentences = fullText.split(/(?<=[.!?])\s+/);
    const slides: ScriptureSlide[] = [];

    let currentSlide: string[] = [];
    let wordCount = 0;
    const maxWordsPerSlide = 30; // Approximate words that fit nicely

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/).length;

      if (wordCount + sentenceWords > maxWordsPerSlide && currentSlide.length > 0) {
        // Start new slide
        slides.push({
          text: currentSlide.join(" "),
          reference: data.reference,
        });
        currentSlide = [sentence];
        wordCount = sentenceWords;
      } else {
        currentSlide.push(sentence);
        wordCount += sentenceWords;
      }
    }

    // Add remaining text
    if (currentSlide.length > 0) {
      slides.push({
        text: currentSlide.join(" "),
        reference: data.reference,
      });
    }

    return new Response(
      JSON.stringify({
        reference: data.reference,
        translation: data.translation_name || translation,
        slides,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching scripture:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch scripture" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
