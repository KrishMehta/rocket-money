# Plaid Integration Setup

## 1. Get Plaid API Credentials

1. Go to https://dashboard.plaid.com/ and sign up for a free account
2. Create a new application in the Plaid dashboard
3. Get your `client_id` and `sandbox` secret key

## 2. Create .env file

Create a `.env` file in the root directory with:

```
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_sandbox_secret
PORT=3001
```

Replace `your_plaid_client_id` and `your_plaid_sandbox_secret` with your actual credentials.

## 3. Update package.json

Add this script to package.json:

```json
"scripts": {
  "dev": "vite",
  "server": "node server.js",
  "dev:all": "concurrently \"npm run dev\" \"npm run server\""
}
```

## 4. Start the servers

```bash
# Terminal 1: Start the backend
npm run server

# Terminal 2: Start the frontend
npm run dev
```

Or use concurrently (if installed):
```bash
npm run dev:all
```

## 5. Test Plaid Integration

Use Plaid's sandbox test credentials:
- Username: `user_good`
- Password: `pass_good`
- PIN/Code: `1234`

## Notes

- The integration uses Plaid's **Sandbox environment** for testing
- To use in production, change `PlaidEnvironments.sandbox` to `PlaidEnvironments.production` in `server.js`
- Make sure to add `.env` to `.gitignore` to keep credentials secure

