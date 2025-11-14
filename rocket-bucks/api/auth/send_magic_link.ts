import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Get the base URL for redirects
const getBaseUrl = (req: VercelRequest) => {
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  return `${protocol}://${host}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, full_name, type = 'signup' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Create a client for this request
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const baseUrl = getBaseUrl(req);
    const redirectTo = `${baseUrl}/auth/callback`;

    // Send magic link
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        data: {
          full_name: full_name || '',
          type: type, // 'signup' or 'login'
        },
      },
    });

    if (error) {
      console.error('Magic link error:', error);
      return res.status(400).json({ error: error.message || 'Failed to send magic link' });
    }

    res.json({
      message: 'Magic link sent! Please check your email.',
      email: email,
    });
  } catch (error: any) {
    console.error('Send magic link error:', error);
    res.status(500).json({ error: error.message || 'Failed to send magic link' });
  }
}

