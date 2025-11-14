# How to Restart the Express Server

The server needs to be restarted to load the new `/api/auth/google` endpoint.

## Steps:

1. **Find the terminal running the Express server**
   - Look for a terminal window showing: `🚀 Rocket Bucks API server running on port 3001`
   - Or look for output like: `npm run server`

2. **Stop the server:**
   - Press `Ctrl+C` (or `Cmd+C` on Mac) in that terminal

3. **Restart the server:**
   ```bash
   npm run server
   ```

4. **Verify it's running:**
   - You should see: `🚀 Rocket Bucks API server running on port 3001`
   - You should see: `📡 Make sure to set SUPABASE_URL and SUPABASE_ANON_KEY in .env file`

5. **Test the endpoint:**
   ```bash
   curl -X POST http://localhost:3001/api/auth/google -H "Content-Type: application/json"
   ```
   - This should return JSON with a `url` field (not an HTML error page)

## Alternative: Kill and Restart

If you can't find the terminal, you can kill the process:

```bash
# Kill the server process
lsof -ti:3001 | xargs kill -9

# Then restart
npm run server
```

## After Restarting:

1. Refresh your browser at `http://localhost:5173/login`
2. Open browser console (F12)
3. Click "Continue with Google"
4. Check console logs - you should see the API call succeed

