# 🚀 Rocket Bucks - Plaid Integration Guide

Rocket Bucks now includes **Plaid integration** to securely connect your real bank accounts and automatically import transactions!

## 📋 Quick Start

### 1. Get Plaid API Credentials

1. Visit [https://dashboard.plaid.com/signup](https://dashboard.plaid.com/signup)
2. Create a free Plaid account
3. Create a new application
4. Copy your **Client ID** and **Sandbox Secret**

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# Create .env file
touch .env

# Add your Plaid credentials
echo "PLAID_CLIENT_ID=your_client_id_here" >> .env
echo "PLAID_SECRET=your_sandbox_secret_here" >> .env
echo "PORT=3001" >> .env
```

**Replace** `your_client_id_here` and `your_sandbox_secret_here` with your actual credentials.

### 3. Start the Application

Open **two terminal windows**:

**Terminal 1 - Backend Server:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

### 4. Connect Your First Account

1. Navigate to [http://localhost:5173](http://localhost:5173)
2. Click the blue **"Connect Now"** banner on the dashboard
3. Click **"Connect Bank Account with Plaid"**
4. Use Plaid's test credentials:
   - **Username:** `user_good`
   - **Password:** `pass_good`
   - **PIN/Code:** `1234`
5. Select any test bank and accounts
6. Your accounts will appear in Rocket Bucks!

## 🔐 Security Features

- ✅ **Bank-level encryption** (256-bit SSL)
- ✅ **Read-only access** to your accounts
- ✅ **Credentials never stored** on our servers
- ✅ **Trusted by 11,000+ financial institutions**
- ✅ **Same technology** used by Venmo, Robinhood, and Betterment

## 🎯 What Can You Do?

Once connected, you can:

- 📊 **Auto-import transactions** from all connected accounts
- 💰 **Track balances** in real-time
- 📈 **View net worth** across all accounts
- 🤖 **Get AI insights** based on real data
- 💳 **Categorize spending** automatically
- 📉 **Analyze trends** over time

## 🧪 Testing with Plaid Sandbox

Plaid provides test credentials for development:

### Test Bank Accounts

| Username | Password | Description |
|----------|----------|-------------|
| `user_good` | `pass_good` | Successfully connects with test data |
| `user_custom` | `pass_good` | Allows custom configuration |

### Test Institution

Choose **"First Platypus Bank"** or any other test institution in the Plaid Link flow.

## 🚀 Production Deployment

To use Plaid in production:

1. **Apply for Production Access** in the Plaid dashboard
2. **Update environment** in `server.js`:
   ```javascript
   basePath: PlaidEnvironments.production
   ```
3. **Use production secret** in `.env`:
   ```
   PLAID_SECRET=your_production_secret
   ```
4. **Implement proper security**:
   - Store access tokens in encrypted database
   - Use HTTPS for all requests
   - Implement user authentication
   - Add rate limiting

## 📁 Project Structure

```
rocket-bucks/
├── server.js                      # Express backend for Plaid API
├── src/
│   ├── components/
│   │   └── PlaidLink.tsx         # Plaid Link React component
│   ├── pages/
│   │   └── ConnectAccounts.tsx   # Account connection UI
│   └── ...
├── .env                           # API credentials (create this!)
└── PLAID_SETUP.md                # Detailed setup guide
```

## 🔧 API Endpoints

The backend provides three endpoints:

- `POST /api/create_link_token` - Generate Link token for Plaid Link
- `POST /api/exchange_public_token` - Exchange public token for access token
- `POST /api/transactions` - Fetch transactions for connected accounts

## 🐛 Troubleshooting

### "Failed to create link token"

- ✅ Make sure backend server is running on port 3001
- ✅ Check that `.env` file has correct credentials
- ✅ Verify PLAID_CLIENT_ID and PLAID_SECRET are set

### "Connection refused"

- ✅ Ensure both frontend (5173) and backend (3001) are running
- ✅ Check no other service is using port 3001

### "Invalid credentials"

- ✅ Use test credentials: `user_good` / `pass_good`
- ✅ Try refreshing the Plaid Link window

## 💡 Tips

- 🔄 Connected accounts are stored in localStorage for demo purposes
- 📦 In production, store access tokens securely in a database
- 🎨 Customize the Plaid Link theme in `PlaidLink.tsx`
- 📱 Plaid Link works on mobile devices too!

## 📚 Resources

- [Plaid Documentation](https://plaid.com/docs/)
- [Plaid React Documentation](https://plaid.com/docs/link/react/)
- [Plaid API Reference](https://plaid.com/docs/api/)
- [Plaid Dashboard](https://dashboard.plaid.com/)

## 🎉 You're All Set!

Start connecting accounts and experience real-time financial tracking with Rocket Bucks! 🚀

