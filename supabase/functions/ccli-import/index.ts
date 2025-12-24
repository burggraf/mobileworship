import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CCLISearchRequest {
  query: string;
  churchId: string;
}

interface CCLISong {
  ccliSongId: string;
  title: string;
  author: string;
  lyrics?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Verify user and get church
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query, churchId }: CCLISearchRequest = await req.json();

    // Get church's CCLI license
    const { data: church } = await supabase
      .from("churches")
      .select("ccli_license_number")
      .eq("id", churchId)
      .single();

    if (!church?.ccli_license_number) {
      return new Response(JSON.stringify({ error: "No CCLI license configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Implement actual CCLI SongSelect API integration
    // This requires partnership with CCLI to get API access
    // For now, return a placeholder response

    const ccliApiKey = Deno.env.get("CCLI_API_KEY");
    if (!ccliApiKey) {
      return new Response(
        JSON.stringify({
          error: "CCLI API not configured",
          message:
            "CCLI SongSelect API integration requires partnership with CCLI. Contact CCLI for API access.",
        }),
        {
          status: 501,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // When API is available, implement search like:
    // const response = await fetch(`https://api.ccli.com/songs/search?q=${encodeURIComponent(query)}`, {
    //   headers: { 'Authorization': `Bearer ${ccliApiKey}`, 'X-License': church.ccli_license_number }
    // });

    return new Response(
      JSON.stringify({
        songs: [],
        message: "CCLI API integration pending",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error searching CCLI:", error);
    return new Response(JSON.stringify({ error: "Failed to search CCLI" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
