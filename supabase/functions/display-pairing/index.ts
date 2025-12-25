import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  action: 'generate';
  deviceInfo: {
    platform: string;
    version: string;
    resolution: { width: number; height: number };
  };
}

interface ClaimRequest {
  action: 'claim';
  code: string;
  name: string;
  location?: string;
}

interface VerifyRequest {
  action: 'verify';
  displayId: string;
}

interface RegenerateRequest {
  action: 'regenerate';
  displayId: string;
  deviceInfo: {
    platform: string;
    version: string;
    resolution: { width: number; height: number };
  };
}

type RequestBody = GenerateRequest | ClaimRequest | VerifyRequest | RegenerateRequest;

function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: RequestBody = await req.json();

    if (body.action === 'generate') {
      // Generate a new pairing code for an unpaired display
      const pairingCode = generatePairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

      const { data, error } = await supabase
        .from('displays')
        .insert({
          pairing_code: pairingCode,
          pairing_code_expires_at: expiresAt,
          device_info: body.deviceInfo,
          name: 'Unnamed Display',
        })
        .select('id, pairing_code')
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          displayId: data.id,
          pairingCode: data.pairing_code,
          expiresAt,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'claim') {
      // Get authenticated user
      const authHeader = req.headers.get('Authorization');
      console.log('Auth header present:', !!authHeader);
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required - no header' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      // Get the authenticated user's ID from the JWT
      const { data: { user: authUser }, error: authError } = await userClient.auth.getUser();
      console.log('Auth user:', authUser?.id, 'Error:', authError?.message);
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: `Authentication failed: ${authError?.message || 'no user'}` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: userData, error: userError } = await userClient
        .from('users')
        .select('church_id')
        .eq('id', authUser.id)
        .single();

      console.log('User data:', userData, 'Error:', userError?.message);
      if (userError || !userData) {
        return new Response(
          JSON.stringify({ error: `User not found: ${userError?.message || 'no data'}` }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find display with matching code that hasn't expired
      const { data: display, error: findError } = await supabase
        .from('displays')
        .select('id')
        .eq('pairing_code', body.code)
        .gt('pairing_code_expires_at', new Date().toISOString())
        .is('paired_at', null)
        .single();

      if (findError || !display) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired pairing code' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Claim the display
      const { data: claimed, error: claimError } = await supabase
        .from('displays')
        .update({
          church_id: userData.church_id,
          name: body.name,
          location: body.location || null,
          pairing_code: null,
          pairing_code_expires_at: null,
          paired_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', display.id)
        .select('id, name, church_id')
        .single();

      if (claimError) throw claimError;

      return new Response(
        JSON.stringify({
          displayId: claimed.id,
          name: claimed.name,
          churchId: claimed.church_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'regenerate') {
      // Regenerate pairing code for an existing unpaired display
      const pairingCode = generatePairingCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('displays')
        .update({
          pairing_code: pairingCode,
          pairing_code_expires_at: expiresAt,
          device_info: body.deviceInfo,
        })
        .eq('id', body.displayId)
        .select('id, pairing_code')
        .single();

      if (error) throw error;

      return new Response(
        JSON.stringify({
          displayId: data.id,
          pairingCode: data.pairing_code,
          expiresAt,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.action === 'verify') {
      // Verify a display exists and check its pairing status
      const { data, error } = await supabase
        .from('displays')
        .select('id, name, church_id, paired_at, settings')
        .eq('id', body.displayId)
        .single();

      if (error || !data) {
        // Display doesn't exist at all
        return new Response(
          JSON.stringify({ valid: false, exists: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Display exists but isn't paired
      if (!data.paired_at) {
        return new Response(
          JSON.stringify({ valid: false, exists: true, displayId: data.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update last_seen_at for paired displays
      await supabase
        .from('displays')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', body.displayId);

      return new Response(
        JSON.stringify({
          valid: true,
          exists: true,
          displayId: data.id,
          name: data.name,
          churchId: data.church_id,
          settings: data.settings,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
