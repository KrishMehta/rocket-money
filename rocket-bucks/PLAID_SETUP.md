# Plaid Integration Setup - Production

## 1. Get Plaid API Credentials

1. Go to https://dashboard.plaid.com/ and sign into your account
2. Ensure your application has been approved for production access
3. Get your `client_id` and `production` secret key from the dashboard
   - Navigate to Team Settings > Keys
   - Copy your Client ID
   - Copy your Production secret (NOT the sandbox secret)

## 2. Create .env file

Create a `.env` file in the root directory with:

```
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_production_secret
PORT=3001
```

**Important**: Replace `your_plaid_client_id` and `your_plaid_production_secret` with your actual production credentials from the Plaid dashboard.

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

## 5. Connect Real Bank Accounts

The app now uses Plaid's **production environment**, which means:
- Users can connect to their real financial institutions
- All data will be real transaction data from actual bank accounts
- No test credentials needed - users will use their actual bank login credentials
- Supported institutions include: Chase, Bank of America, Wells Fargo, and 11,000+ others

## Notes

- ✅ The integration now uses Plaid's **Production environment**
- 🔐 Make sure to add `.env` to `.gitignore` to keep credentials secure
- 🛡️ Never commit or share your production secret key
- 📊 Real transactions may take a few moments to sync after initial connection
- 🔄 Consider implementing webhooks for real-time transaction updates

