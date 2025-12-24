// Config loaded from environment variables at compile time
// Create a .env file based on .env.example with your actual credentials

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase configuration. Create a .env file with SUPABASE_URL and SUPABASE_ANON_KEY'
  );
}

export const Config = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_FUNCTIONS_URL: `${SUPABASE_URL}/functions/v1`,
};
