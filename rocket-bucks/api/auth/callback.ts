import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Google OAuth callback - Supabase sends code and state as query params
    const { code, error: oauthError, error_description } = req.query;

    console.log('🔔 Callback received:', {
      code: code ? 'present' : 'missing',
      error: oauthError,
      error_description,
      query: req.query,
    });

    // Check for OAuth errors first
    if (oauthError) {
      console.error('❌ OAuth error from provider:', oauthError, error_description);
      return res.status(400).send(`
        <html>
          <body>
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Authentication Error</h1>
              <p>${error_description || oauthError || 'Authentication failed'}</p>
              <a href="/login" style="color: #ef4444;">Go to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    if (!code) {
      console.error('❌ No code parameter in callback');
      return res.status(400).send(`
        <html>
          <body>
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Invalid Request</h1>
              <p>The authentication request is invalid or expired.</p>
              <p style="font-size: 12px; color: #666;">No authorization code received. Please try logging in again.</p>
              <a href="/login" style="color: #ef4444;">Go to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    // Create a client for this request
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code as string);

    if (error || !data.session || !data.user) {
      console.error('Verification error:', error);
      return res.status(400).send(`
        <html>
          <body>
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Verification Failed</h1>
              <p>${error?.message || 'The verification link is invalid or expired.'}</p>
              <a href="/login" style="color: #ef4444;">Go to Login</a>
            </div>
          </body>
        </html>
      `);
    }

    // Get user profile (should be created by trigger, but check if it exists)
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile doesn't exist (shouldn't happen due to trigger, but just in case)
    if (!profile) {
      const fullName = data.user.user_metadata?.full_name || 
                       data.user.user_metadata?.name ||
                       '';
      await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email || '',
          full_name: fullName,
        });
    }

    // Determine frontend URL - in production use same origin, in dev use localhost:5173
    const isProduction = process.env.VERCEL || !req.headers.host?.includes('localhost');
    const frontendUrl = isProduction 
      ? '/' 
      : 'http://localhost:5173/';

    // Create a redirect page that sets the token in localStorage and redirects
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Signing in...</title>
        </head>
        <body>
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Signing you in...</h1>
            <p>Please wait while we complete your sign in.</p>
          </div>
          <script>
            // Store tokens in localStorage
            localStorage.setItem('access_token', '${data.session.access_token}');
            if ('${data.session.refresh_token}') {
              localStorage.setItem('refresh_token', '${data.session.refresh_token}');
            }
            
            // Redirect to frontend dashboard
            window.location.href = '${frontendUrl}';
          </script>
        </body>
      </html>
    `;

    res.send(html);
  } catch (error: any) {
    console.error('Callback error:', error);
    res.status(500).send(`
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Error</h1>
            <p>An error occurred during verification.</p>
            <a href="/login" style="color: #ef4444;">Go to Login</a>
          </div>
        </body>
      </html>
    `);
  }
}

