# Fixing the Callback URL Issue

The error "Invalid Request" with no code parameter suggests the redirect URL configuration is incorrect.

## The Problem

When you see `localhost:3001/api/auth/callback#...` with a hash fragment, it means:
1. The redirect URL might not be properly configured in Supabase
2. Or Supabase is redirecting incorrectly

## Solution: Verify Supabase Redirect URL Configuration

1. **Go to Supabase Dashboard:**
   - Navigate to **Authentication** → **URL Configuration**

2. **Check/Add these Redirect URLs:**
   - `http://localhost:3001/api/auth/callback` (for Express server)
   - `http://localhost:5173/api/auth/callback` (for Vite dev server)
   - `https://your-vercel-domain.vercel.app/api/auth/callback` (for production)

3. **Important:** The redirect URL must match EXACTLY what you're sending in the OAuth request.

## Check What URL We're Sending

The server logs should show:
```
📍 Redirect URL: http://localhost:3001/api/auth/callback
```

Make sure this EXACT URL is in your Supabase redirect URL list.

## Alternative: Use Frontend URL

If you want to handle the callback on the frontend instead, you can:

1. Change the redirect URL to: `http://localhost:5173/auth/callback`
2. Create a frontend route to handle it
3. Extract the code from the URL and send it to your backend

But the current setup (backend callback) should work if the URL is configured correctly.

## Debug Steps

1. **Check server logs** when you click "Continue with Google":
   - Look for: `📍 Redirect URL: ...`
   - Make sure it matches what's in Supabase

2. **Check the callback logs**:
   - After Google redirects, check the Express server terminal
   - You should see: `🔔 Callback received: ...`
   - This will show what parameters are being received

3. **Verify Supabase configuration**:
   - Go to Authentication → Providers → Google
   - Make sure Google OAuth is enabled
   - Check that Client ID and Secret are set

## Common Issues

- **URL mismatch**: The redirect URL in code doesn't match Supabase whitelist
- **Missing protocol**: Make sure URLs include `http://` or `https://`
- **Trailing slashes**: Some systems are sensitive to trailing slashes
- **Port mismatch**: Make sure the port (3001) matches your server

