# Google OAuth Setup Instructions

## Supabase Configuration

1. **Enable Google Provider in Supabase:**
   - Go to your Supabase Dashboard
   - Navigate to **Authentication** → **Providers**
   - Find **Google** and click **Enable**
   - You'll need to provide:
     - **Client ID** (from Google Cloud Console)
     - **Client Secret** (from Google Cloud Console)

2. **Configure Redirect URLs in Supabase:**
   - Go to **Authentication** → **URL Configuration**
   - Add these redirect URLs:
     - For local development: `http://localhost:5173/api/auth/callback`
     - For production: `https://your-vercel-domain.vercel.app/api/auth/callback`
     - Also add: `http://localhost:3001/api/auth/callback` (for Express server)

## Google Cloud Console Setup

1. **Create OAuth 2.0 Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Navigate to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth client ID**
   - Choose **Web application**
   - Add authorized redirect URIs:
     - `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback`
     - (Supabase will handle the OAuth flow)

2. **Copy Credentials:**
   - Copy the **Client ID** and **Client Secret**
   - Paste them into Supabase Dashboard → Authentication → Providers → Google

## Environment Variables

Make sure your `.env` file has:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Testing

1. Start your Express server:
   ```bash
   npm run server
   ```

2. Start your Vite dev server:
   ```bash
   npm run dev
   ```

3. Navigate to `http://localhost:5173/login`
4. Click "Continue with Google"
5. You'll be redirected to Google's sign-in page
6. After signing in, you'll be redirected back and logged in

## Troubleshooting

- **"Redirect URI mismatch" error**: Make sure the redirect URL in Supabase matches exactly what you're using
- **"Invalid client" error**: Double-check your Google Client ID and Secret in Supabase
- **Callback not working**: Ensure the callback URL is whitelisted in both Supabase and Google Cloud Console

