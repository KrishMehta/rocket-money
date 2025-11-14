# Debugging Google OAuth Authentication

## Step 1: Test Supabase Connection

Visit this URL in your browser:
```
http://localhost:3001/api/test-supabase
```

This will tell you:
- ✅ If Supabase URL is set
- ✅ If Supabase API key is set
- ✅ If database connection works
- ✅ If auth is configured

## Step 2: Check Server Logs

When you click "Continue with Google", check your Express server terminal. You should see:

```
🔐 Initiating Google OAuth login
📍 Redirect URL: http://localhost:5173/auth/callback
🔑 Supabase URL: ✅ Set
🔑 Supabase Key: ✅ Set
✅ Google OAuth URL generated
```

If you see ❌ instead of ✅, your API keys are not configured correctly.

## Step 3: Verify Supabase Configuration

1. **Go to Supabase Dashboard:**
   - https://app.supabase.com
   - Select your project
   - Go to **Settings** → **API**

2. **Copy these values:**
   - **Project URL** → This is your `SUPABASE_URL`
   - **anon public** key → This is your `SUPABASE_ANON_KEY`

3. **Add to `.env` file:**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

4. **Restart your Express server** after updating `.env`

## Step 4: Verify Google OAuth in Supabase

1. Go to **Authentication** → **Providers**
2. Find **Google** and make sure it's **Enabled**
3. Check that **Client ID** and **Client Secret** are set

## Step 5: Verify Redirect URLs

1. Go to **Authentication** → **URL Configuration**
2. Make sure these URLs are in the **Redirect URLs** list:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:3001/api/auth/callback` (as backup)

## Common Issues

### "Supabase credentials not configured"
- Check your `.env` file exists
- Make sure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
- Restart the Express server after changing `.env`

### "Failed to generate OAuth URL"
- Google OAuth might not be enabled in Supabase
- Check that Client ID and Secret are set in Supabase
- Verify the redirect URL matches what's in Supabase config

### "Invalid Request" error page
- The redirect URL in Supabase doesn't match what we're sending
- Make sure `http://localhost:5173/auth/callback` is in Supabase redirect URLs

