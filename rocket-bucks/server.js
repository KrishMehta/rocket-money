import express from 'express';
import cors from 'cors';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Use sandbox for testing
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || 'your_client_id',
      'PLAID-SECRET': process.env.PLAID_SECRET || 'your_sandbox_secret',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Create Link Token endpoint
app.post('/api/create_link_token', async (req, res) => {
  try {
    const request = {
      user: {
        client_user_id: 'user-' + Date.now(),
      },
      client_name: 'Rocket Bucks',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// Exchange public token for access token
app.post('/api/exchange_public_token', async (req, res) => {
  try {
    const { public_token } = req.body;
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get accounts
    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    res.json({
      access_token: accessToken,
      item_id: itemId,
      accounts: accountsResponse.data.accounts,
    });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// Get transactions
app.post('/api/transactions', async (req, res) => {
  try {
    const { access_token } = req.body;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const response = await plaidClient.transactionsGet({
      access_token,
      start_date: thirtyDaysAgo.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    });

    res.json({ transactions: response.data.transactions });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Rocket Bucks API server running on port ${PORT}`);
  console.log(`📡 Make sure to set PLAID_CLIENT_ID and PLAID_SECRET in .env file`);
});

