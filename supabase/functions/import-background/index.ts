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

    // Use service role key to validate the user token
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("Auth result:", { user: user?.id, error: userError?.message });
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: userError?.message }), {
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
