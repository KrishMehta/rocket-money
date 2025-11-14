/**
 * Supabase client for server-side operations
 * Used in Vercel serverless functions
 * 
 * SECURITY: Uses anon key with RLS policies instead of service role key
 * to ensure proper access control. Service role key should only be used
 * for admin operations that explicitly need to bypass RLS.
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Database features will not work.');
}

// Use anon key for normal operations (respects RLS)
// This ensures Row Level Security policies are enforced
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Service role client - ONLY use for admin operations that need to bypass RLS
// Examples: Creating user profiles on signup, system maintenance
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// Client for user operations (uses user's JWT token with anon key)
// This respects RLS policies - user can only access their own data
export const createSupabaseClient = (accessToken: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

