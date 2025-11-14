import express from 'express';
import cors from 'cors';
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { encrypt, decrypt } from './lib/encryption.js';

dotenv.config();

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Encryption key for sensitive data (Plaid access tokens)
// Generate a secure key: openssl rand -base64 32
const encryptionKey = process.env.ENCRYPTION_KEY || '';

// Validate Supabase configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERROR: Supabase credentials not configured!');
  console.error('   Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
  console.error('   Get these from: https://app.supabase.com/project/_/settings/api');
}

// Warn if encryption key is missing (critical for production)
if (!encryptionKey) {
  console.warn('⚠️  WARNING: ENCRYPTION_KEY not set! Plaid access tokens will be stored in plaintext.');
  console.warn('   Generate a key: openssl rand -base64 32');
  console.warn('   Add to .env: ENCRYPTION_KEY=your_generated_key');
}

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || 'your_client_id',
      'PLAID-SECRET': process.env.PLAID_SECRET || 'your_production_secret',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Create Link Token endpoint
app.post('/api/create_link_token', async (req, res) => {
  try {
    // Get authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    console.log('🔗 Creating Plaid link token for user:', user.id);

    const request = {
      user: {
        client_user_id: user.id, // Use actual user ID
      },
      client_name: 'Rocket Bucks',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    console.log('✅ Link token created');
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('❌ Error creating link token:', error);
    res.status(500).json({ error: 'Failed to create link token', details: error.message });
  }
});

// Exchange public token for access token
app.post('/api/exchange_public_token', async (req, res) => {
  try {
    // Get authenticated user
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    console.log('🔄 Exchanging Plaid public token for user:', user.id);

    // Exchange public token for access token
    const response = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // Get item info and accounts
    const itemResponse = await plaidClient.itemGet({
      access_token: accessToken,
    });

    const accountsResponse = await plaidClient.accountsGet({
      access_token: accessToken,
    });

    const institutionId = itemResponse.data.item.institution_id;
    let institutionName = 'Unknown Bank';

    // Get institution name
    if (institutionId) {
      try {
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: [CountryCode.Us],
        });
        institutionName = institutionResponse.data.institution.name;
      } catch (err) {
        console.error('Error fetching institution:', err);
      }
    }

    console.log('💾 Saving Plaid item to database...');

    // Encrypt access token before storing
    const encryptedAccessToken = encryptionKey
      ? encrypt(accessToken, encryptionKey)
      : accessToken; // Fallback to plaintext if key not set (development only)

    // Save Plaid item to database
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .insert({
        user_id: user.id,
        item_id: itemId,
        access_token: encryptedAccessToken, // Encrypted for security
        institution_id: institutionId,
        institution_name: institutionName,
      })
      .select()
      .single();

    if (itemError) {
      console.error('❌ Error saving plaid item:', itemError);
      // Continue anyway, but log the error
    }

    // Save accounts to database
    if (plaidItem && accountsResponse.data.accounts.length > 0) {
      const accountsToInsert = accountsResponse.data.accounts.map((account) => ({
        user_id: user.id,
        plaid_item_id: plaidItem.id,
        account_id: account.account_id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        balance_current: account.balances.current || 0,
        balance_available: account.balances.available,
        currency_code: account.balances.iso_currency_code || 'USD',
        institution_name: institutionName,
      }));

      // Use the correct unique constraint from schema: (plaid_item_id, account_id)
      const { error: accountsError } = await supabase
        .from('accounts')
        .upsert(accountsToInsert, {
          onConflict: 'plaid_item_id,account_id',
        });

      if (accountsError) {
        console.error('❌ Error saving accounts:', accountsError);
      } else {
        console.log('✅ Saved', accountsToInsert.length, 'accounts to database');
      }
    }

    res.json({
      access_token: accessToken,
      item_id: itemId,
      accounts: accountsResponse.data.accounts,
      institution_name: institutionName,
    });
  } catch (error) {
    console.error('❌ Error exchanging public token:', error);
    res.status(500).json({ error: 'Failed to exchange token', details: error.message });
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

// Auth endpoints - Google OAuth
// Google login endpoint
app.post('/api/auth/google', async (req, res) => {
  try {
    // Validate Supabase config
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase not configured');
      return res.status(500).json({ 
        error: 'Server configuration error: Supabase credentials not set. Please check your .env file.' 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    // Use frontend callback URL so we can handle hash fragments
    const redirectTo = `http://localhost:5173/auth/callback`;

    console.log('🔐 Initiating Google OAuth login');
    console.log('📍 Redirect URL:', redirectTo);
    console.log('🔑 Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.log('🔑 Supabase Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing');

    // Generate Google OAuth URL
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });

    if (error) {
      console.error('❌ Google OAuth error:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return res.status(400).json({ 
        error: error.message || 'Failed to initiate Google login',
        details: 'Check that Google OAuth is enabled in Supabase and redirect URL is configured'
      });
    }

    if (!data || !data.url) {
      console.error('❌ No OAuth URL returned from Supabase');
      return res.status(500).json({ 
        error: 'Failed to generate OAuth URL. Check Supabase configuration.' 
      });
    }

    console.log('✅ Google OAuth URL generated');
    res.json({ url: data.url });
  } catch (error) {
    console.error('❌ Google auth error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate Google login' });
  }
});

// Register endpoint - also uses Google OAuth (same as login)
app.post('/api/auth/register', async (req, res) => {
  // Registration uses the same Google OAuth flow as login
  // Just call the login endpoint logic
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ 
        error: 'Server configuration error: Supabase credentials not set.' 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const redirectTo = `http://localhost:5173/auth/callback`;

    console.log('📝 Initiating Google OAuth signup');
    console.log('📍 Redirect URL:', redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo,
      },
    });

    if (error) {
      console.error('❌ Google OAuth error:', error);
      return res.status(400).json({ error: error.message || 'Failed to initiate Google signup' });
    }

    if (!data || !data.url) {
      return res.status(500).json({ error: 'Failed to generate OAuth URL.' });
    }

    console.log('✅ Google OAuth URL generated');
    res.json({ url: data.url });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate Google signup' });
  }
});

// Exchange code for session endpoint (called from frontend)
app.post('/api/auth/exchange-code', async (req, res) => {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({ 
        error: 'Server configuration error: Supabase credentials not set.' 
      });
    }

    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    console.log('🔄 Exchanging code for session...');
    console.log('🔑 Code received:', code.substring(0, 20) + '...');

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session || !data.user) {
      console.error('❌ Exchange error:', error);
      return res.status(400).json({ 
        error: error?.message || 'Failed to exchange code for session' 
      });
    }

    // Get user profile (should be created by trigger, but check if it exists)
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();

    // If profile doesn't exist (shouldn't happen due to trigger, but just in case)
    if (!profile) {
      const fullName = data.user.user_metadata?.full_name || 
                       data.user.user_metadata?.name ||
                       '';
      await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: data.user.email || '',
          full_name: fullName,
        });
    }

    console.log('✅ User authenticated via Google:', data.user.email);

    res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: profile?.full_name || '',
      },
    });
  } catch (error) {
    console.error('❌ Exchange code error:', error);
    res.status(500).json({ error: error.message || 'Failed to exchange code' });
  }
});

// Google OAuth callback endpoint (redirects to frontend to handle hash fragments)
// Supabase may redirect here if the redirect URL in Supabase config points to backend
app.get('/api/auth/callback', async (req, res) => {
  try {
    // Extract query params and hash fragment from the URL
    // Note: Express can't read hash fragments, but we can preserve them in the redirect
    const queryString = req.url.includes('?') ? req.url.split('?')[1].split('#')[0] : '';
    const hashFragment = req.url.includes('#') ? req.url.split('#')[1] : '';

    console.log('🔔 Backend callback received, redirecting to frontend:', {
      url: req.url,
      hasQuery: !!queryString,
      hasHash: !!hashFragment,
    });

    // Build frontend URL preserving both query params and hash fragment
    let frontendUrl = 'http://localhost:5173/auth/callback';
    if (queryString) {
      frontendUrl += '?' + queryString;
    }
    if (hashFragment) {
      frontendUrl += '#' + hashFragment;
    }
    
    console.log('🔄 Redirecting to frontend:', frontendUrl);
    
    // Redirect to frontend callback page which can handle hash fragments
    return res.redirect(302, frontendUrl);
  } catch (error) {
    console.error('❌ Callback redirect error:', error);
    // If redirect fails, show error page
    return res.status(500).send(`
      <html>
        <body>
          <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>Error</h1>
            <p>An error occurred during redirect.</p>
            <a href="http://localhost:5173/login" style="color: #ef4444;">Go to Login</a>
          </div>
        </body>
      </html>
    `);
  }
});

// Get current user endpoint
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user profile from database
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || '',
      },
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

// Get user's accounts endpoint
app.get('/api/accounts', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user's accounts from database
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (accountsError) {
      console.error('❌ Error fetching accounts:', accountsError);
      return res.status(500).json({ error: 'Failed to fetch accounts' });
    }

    res.json({ accounts: accounts || [] });
  } catch (error) {
    console.error('❌ Get accounts error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch accounts' });
  }
});

// Test Supabase configuration endpoint
app.get('/api/test-supabase', async (req, res) => {
  try {
    const config = {
      supabaseUrl: supabaseUrl ? '✅ Set' : '❌ Missing',
      supabaseKey: supabaseAnonKey ? '✅ Set' : '❌ Missing',
      urlLength: supabaseUrl.length,
      keyLength: supabaseAnonKey.length,
    };

    if (!supabaseUrl || !supabaseAnonKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase credentials not configured',
        config,
        instructions: 'Set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Test database connection
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.error('❌ Database connection error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Database connection failed',
        details: error.message,
        config
      });
    }

    // Test auth (check if we can create a client)
    const { data: authTest } = await supabase.auth.getSession();

    console.log('✅ Supabase connection successful');
    res.json({ 
      success: true, 
      message: 'Supabase connection successful',
      config,
      database: 'Connected',
      auth: 'Configured'
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
    res.status(500).json({ 
      success: false,
      error: 'Test failed',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Rocket Bucks API server running on port ${PORT}`);
  console.log(`📡 Make sure to set SUPABASE_URL and SUPABASE_ANON_KEY in .env file`);
  console.log(`📡 Make sure to set PLAID_CLIENT_ID and PLAID_SECRET in .env file`);
});

