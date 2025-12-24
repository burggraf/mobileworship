import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FormatLyricsRequest {
  rawText: string;
  hints?: {
    title?: string;
    author?: string;
  };
}

interface SongSection {
  type: "verse" | "chorus" | "bridge" | "pre-chorus" | "tag" | "intro" | "outro";
  label: string;
  lines: string[];
}

interface SongContent {
  sections: SongSection[];
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawText, hints }: FormatLyricsRequest = await req.json();

    if (!rawText) {
      return new Response(JSON.stringify({ error: "rawText is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });

    const prompt = `Parse the following song lyrics into structured sections. Return valid JSON only.

${hints?.title ? `Song title: ${hints.title}` : ""}
${hints?.author ? `Author: ${hints.author}` : ""}

Lyrics:
${rawText}

Return a JSON object with this exact structure:
{
  "sections": [
    {
      "type": "verse" | "chorus" | "bridge" | "pre-chorus" | "tag" | "intro" | "outro",
      "label": "Verse 1" | "Chorus" | etc.,
      "lines": ["line 1", "line 2", ...]
    }
  ]
}

Rules:
- Detect section types from markers like [Verse 1], (Chorus), BRIDGE, etc.
- If no markers, infer sections from repeated phrases (chorus) and verse patterns
- Split long sections into separate verses if they have clear stanza breaks
- Each section's lines should contain the actual lyrics, one line per array element
- Label choruses as "Chorus", verses as "Verse 1", "Verse 2", etc.
- Return ONLY the JSON object, no markdown or explanation`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Extract JSON from response (handle potential markdown wrapping)
    let jsonText = text;
    if (text.includes("```json")) {
      jsonText = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      jsonText = text.split("```")[1].split("```")[0].trim();
    }

    const content: SongContent = JSON.parse(jsonText);

    return new Response(JSON.stringify(content), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error formatting lyrics:", error);
    return new Response(JSON.stringify({ error: "Failed to format lyrics" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
