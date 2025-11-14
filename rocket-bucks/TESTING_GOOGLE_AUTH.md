# Testing Google OAuth on Localhost

## Quick Test Steps

1. **Make sure both servers are running:**
   ```bash
   # Terminal 1: Express server
   npm run server
   
   # Terminal 2: Vite dev server
   npm run dev
   ```

2. **Open browser console** (F12 or Cmd+Option+I) to see debug logs

3. **Navigate to:** `http://localhost:5173/login`

4. **Click "Continue with Google"**

5. **Check the console logs:**
   - You should see: `🔐 Initiating Google login...`
   - Then: `🌐 Calling Google login API: http://localhost:3001/api/auth/google`
   - Then: `📡 Response status: 200 OK`
   - Then: `✅ Got OAuth URL: URL received`
   - Finally: `🔐 AuthContext: Got OAuth URL, redirecting...`

6. **Check Express server terminal:**
   - You should see: `🔐 Initiating Google OAuth login`
   - And: `📍 Redirect URL: http://localhost:3001/api/auth/callback`

## Troubleshooting

### If button doesn't do anything:
- Check browser console for errors
- Make sure Express server is running on port 3001
- Check that the API URL is correct: `http://localhost:3001/api`

### If you get "Cannot POST /api/auth/google":
- **Restart the Express server** - it may not have the latest code
- Stop the server (Ctrl+C) and run `npm run server` again

### If you get CORS errors:
- Make sure `cors()` middleware is enabled in server.js
- Check that the API URL matches the server port

### If redirect doesn't work:
- Check Supabase Dashboard → Authentication → URL Configuration
- Make sure `http://localhost:3001/api/auth/callback` is added
- Also add `http://localhost:5173/api/auth/callback` (for Vercel deployment testing)

### Manual API Test:
```bash
curl -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -v
```

This should return a JSON response with a `url` field containing the Google OAuth URL.

