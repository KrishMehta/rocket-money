# Critical: Fix Supabase Redirect URL Configuration

## The Problem

You're seeing "No authorization code received" because Supabase is not sending the code to the callback URL. This is **always** a redirect URL configuration issue in Supabase.

## The Fix (Do This Now)

1. **Go to Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project
   - Go to **Authentication** → **URL Configuration**

2. **In the "Redirect URLs" section, add this EXACT URL:**
   ```
   http://localhost:5173/auth/callback
   ```

3. **Important:**
   - The URL must match EXACTLY (including `http://`, no trailing slash)
   - Case-sensitive
   - Must include the port number `:5173`

4. **Click "Save"**

5. **Also verify in "Site URL":**
   - Should be: `http://localhost:5173` (or your production URL)

## Why This Happens

When you call `supabase.auth.signInWithOAuth()`, Supabase checks if the `redirectTo` URL is in the whitelist. If it's not, Supabase either:
- Rejects the request
- Redirects to a default URL
- Doesn't include the code in the redirect

## Verify It's Working

After adding the URL:

1. **Restart your Express server** (to clear any cached config)
2. **Try logging in again**
3. **Check browser console** - you should see:
   ```
   🔔 Frontend callback received: { code: 'present', ... }
   ```

## Still Not Working?

If you still get "No authorization code received" after adding the URL:

1. **Check the browser console** - it will show the full URL that was received
2. **Compare it to what's in Supabase** - they must match exactly
3. **Check for typos** - common mistakes:
   - `http://` vs `https://`
   - `localhost` vs `127.0.0.1`
   - Missing port number
   - Trailing slash
   - Wrong path (`/auth/callback` vs `/api/auth/callback`)

## Current Configuration

Our code is sending:
```
redirectTo: http://localhost:5173/auth/callback
```

Make sure this EXACT string is in your Supabase redirect URLs list.

