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

// Helper function to calculate next due date based on frequency
function calculateNextDueDate(lastDate, frequency) {
  if (!lastDate) return null;
  
  const last = new Date(lastDate);
  const now = new Date();
  
  // If last date is in the future, return it
  if (last > now) return lastDate;
  
  // Calculate next occurrence based on frequency
  switch (frequency.toUpperCase()) {
    case 'WEEKLY':
      last.setDate(last.getDate() + 7);
      while (last < now) {
        last.setDate(last.getDate() + 7);
      }
      return last.toISOString().split('T')[0];
      
    case 'BIWEEKLY':
      last.setDate(last.getDate() + 14);
      while (last < now) {
        last.setDate(last.getDate() + 14);
      }
      return last.toISOString().split('T')[0];
      
    case 'MONTHLY':
    case 'APPROXIMATELY_MONTHLY':
      last.setMonth(last.getMonth() + 1);
      while (last < now) {
        last.setMonth(last.getMonth() + 1);
      }
      return last.toISOString().split('T')[0];
      
    case 'ANNUALLY':
    case 'YEARLY':
      last.setFullYear(last.getFullYear() + 1);
      return last.toISOString().split('T')[0];
      
    default:
      // For irregular or unknown frequencies, estimate 30 days
      last.setDate(last.getDate() + 30);
      return last.toISOString().split('T')[0];
  }
}

// Helper function to detect recurring patterns from transaction history
function detectRecurringPatterns(transactions, accountMap) {
  const merchantGroups = new Map();
  
  // Group transactions by normalized merchant name
  transactions.forEach(tx => {
    if (tx.transaction_type !== 'expense' || tx.amount <= 0) return;
    
    // Normalize merchant name
    const merchant = (tx.merchant_name || tx.name).toLowerCase().trim();
    const key = merchant.replace(/[^a-z0-9]/g, '');
    
    if (!merchantGroups.has(key)) {
      merchantGroups.set(key, []);
    }
    merchantGroups.get(key).push(tx);
  });
  
  const recurring = [];
  
  // Find patterns (2+ occurrences with similar amounts)
  merchantGroups.forEach((txs, key) => {
    if (txs.length < 2) return; // Need at least 2 occurrences
    
    // Sort by date
    txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Calculate average amount and frequency
    const amounts = txs.map(t => t.amount);
    const avgAmount = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
    const lastAmount = txs[txs.length - 1].amount;
    
    // Calculate days between occurrences
    const daysBetween = [];
    for (let i = 1; i < txs.length; i++) {
      const days = (new Date(txs[i].date).getTime() - new Date(txs[i-1].date).getTime()) / (1000 * 60 * 60 * 24);
      daysBetween.push(days);
    }
    const avgDays = daysBetween.reduce((sum, d) => sum + d, 0) / daysBetween.length;
    
    // Determine frequency
    let frequency = 'monthly';
    if (avgDays < 10) frequency = 'weekly';
    else if (avgDays < 20) frequency = 'biweekly';
    else if (avgDays < 45) frequency = 'monthly';
    else if (avgDays < 100) frequency = 'quarterly';
    else frequency = 'yearly';
    
    // Determine if subscription
    const name = txs[0].merchant_name || txs[0].name;
    const isSubscription = name.toLowerCase().includes('subscription') ||
                          name.toLowerCase().includes('chatgpt') ||
                          name.toLowerCase().includes('cursor') ||
                          name.toLowerCase().includes('netflix') ||
                          name.toLowerCase().includes('spotify') ||
                          name.toLowerCase().includes('apple') ||
                          name.toLowerCase().includes('openai') ||
                          avgAmount < 100; // Small amounts are often subscriptions
    
    recurring.push({
      user_id: txs[0].user_id,
      account_id: txs[0].account_id,
      name: name,
      merchant_name: txs[0].merchant_name || null,
      expected_amount: lastAmount,
      average_amount: avgAmount,
      frequency: frequency,
      start_date: txs[0].date,
      last_transaction_date: txs[txs.length - 1].date,
      next_due_date: calculateNextDueDate(txs[txs.length - 1].date, frequency),
      transaction_type: 'expense',
      is_subscription: isSubscription,
      is_active: true,
      total_occurrences: txs.length,
      notes: `Auto-detected from ${txs.length} transactions`,
    });
  });
  
  return recurring;
}

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

      // Check for existing accounts with the same mask/type (same physical account)
      // This happens when re-linking the same institution - prevents duplicates
      const { data: existingAccounts } = await supabase
        .from('accounts')
        .select('id, account_id, plaid_item_id, mask, type, subtype')
        .eq('user_id', user.id);

      if (existingAccounts && existingAccounts.length > 0) {
        const accountsToDelete = [];
        
        // For each new account, check if an older version exists with same mask+type
        accountsToInsert.forEach(newAccount => {
          const duplicates = existingAccounts.filter(
            existing => 
              existing.mask === newAccount.mask &&
              existing.type === newAccount.type &&
              existing.subtype === newAccount.subtype &&
              existing.plaid_item_id !== plaidItem.id // Different item
          );
          
          accountsToDelete.push(...duplicates.map(d => d.id));
        });
        
        if (accountsToDelete.length > 0) {
          console.log(`🗑️  Removing ${accountsToDelete.length} duplicate accounts from previous link...`);
          
          await supabase
            .from('accounts')
            .delete()
            .in('id', accountsToDelete);
        }
      }

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

    // Automatically sync transactions for newly linked account (no rate limit)
    console.log('🔄 Auto-syncing transactions for newly linked account...');
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const startDate = thirtyDaysAgo.toISOString().split('T')[0];
      const endDate = now.toISOString().split('T')[0];

      // Wait 10 seconds for Plaid to prepare transaction data
      console.log('⏳ Waiting for Plaid to prepare transaction data (this may take a moment)...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      const transactionsResponse = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
      });

      console.log(`✅ Fetched ${transactionsResponse.data.transactions.length} transactions from ${institutionName}`);

      // Get account mappings
      const { data: dbAccounts } = await supabase
        .from('accounts')
        .select('id, account_id')
        .eq('plaid_item_id', plaidItem.id);

      const accountMap = new Map(dbAccounts?.map(a => [a.account_id, a.id]) || []);

      let transactionsSynced = false;

      // Store transactions in database
      if (transactionsResponse.data.transactions.length > 0) {
        const transactionsToInsert = transactionsResponse.data.transactions.map((tx) => {
          const dbAccountId = accountMap.get(tx.account_id);
          return {
            user_id: user.id,
            account_id: dbAccountId,
            transaction_id: tx.transaction_id,
            amount: tx.amount,
            date: tx.date,
            authorized_date: tx.authorized_date || null,
            posted_date: tx.date,
            name: tx.name,
            // Plaid categorization
            plaid_category: tx.category || [],
            plaid_primary_category: tx.category?.[0] || null,
            plaid_detailed_category: tx.category ? tx.category.join(' > ') : null,
            // Merchant and location
            merchant_name: tx.merchant_name || null,
            location_city: tx.location?.city || null,
            location_state: tx.location?.region || null,
            location_country: tx.location?.country || null,
            location_address: tx.location?.address || null,
            location_lat: tx.location?.lat || null,
            location_lon: tx.location?.lon || null,
            // Transaction metadata
            transaction_type: tx.amount > 0 ? 'expense' : 'income',
            payment_channel: tx.payment_channel || null,
            check_number: tx.check_number || null,
            // Flags
            pending: tx.pending || false,
            is_transfer: tx.amount === 0 || false,
          };
        }).filter((tx) => tx.account_id);

        if (transactionsToInsert.length > 0) {
          await supabase
            .from('transactions')
            .upsert(transactionsToInsert, {
              onConflict: 'account_id,transaction_id',
            });
          console.log(`💾 Stored ${transactionsToInsert.length} transactions in database`);
          transactionsSynced = true;
        }
      } else {
        console.log('ℹ️  No transactions returned from Plaid (may be empty account or still processing)');
      }

      // Only update the timestamp if transactions were actually synced
      // This prevents rate-limiting when transactions aren't ready yet
      if (transactionsSynced) {
        await supabase
          .from('plaid_items')
          .update({ updated_at: now.toISOString() })
          .eq('id', plaidItem.id);
        console.log('✅ Updated sync timestamp');
      } else {
        console.log('ℹ️  Not updating timestamp - no transactions synced yet');
      }

      // Fetch recurring transactions streams from Plaid
      console.log('🔄 Fetching recurring transaction streams from Plaid...');
      try {
        const recurringResponse = await plaidClient.transactionsRecurringGet({
          access_token: accessToken,
          account_ids: dbAccounts?.map(a => a.account_id) || [],
        });

        console.log(`✅ Found ${recurringResponse.data.inflow_streams.length} recurring inflows and ${recurringResponse.data.outflow_streams.length} recurring outflows`);

        // Store recurring outflows (expenses/subscriptions)
        const recurringToInsert = [];
        
        // Process outflow streams (subscriptions, bills)
        for (const stream of recurringResponse.data.outflow_streams) {
          const dbAccountId = accountMap.get(stream.account_id);
          if (!dbAccountId) continue;

          // Determine if it's a subscription based on category
          const isSubscription = stream.category?.includes('Subscription') || 
                                 stream.category?.includes('Software') ||
                                 stream.category?.includes('Streaming');

          recurringToInsert.push({
            user_id: user.id,
            account_id: dbAccountId,
            name: stream.merchant_name || stream.description || 'Unknown',
            merchant_name: stream.merchant_name || null,
            expected_amount: stream.last_amount?.amount || stream.average_amount?.amount || 0,
            average_amount: stream.average_amount?.amount || 0,
            frequency: stream.frequency.toLowerCase(),
            start_date: stream.first_date || new Date().toISOString().split('T')[0],
            last_transaction_date: stream.last_date || null,
            next_due_date: calculateNextDueDate(stream.last_date, stream.frequency),
            transaction_type: 'expense',
            is_subscription: isSubscription,
            is_active: stream.status === 'ACTIVE',
            total_occurrences: stream.transaction_count || 0,
            notes: stream.category?.join(', ') || null,
          });
        }

        // Process inflow streams (income, refunds)
        for (const stream of recurringResponse.data.inflow_streams) {
          const dbAccountId = accountMap.get(stream.account_id);
          if (!dbAccountId) continue;

          recurringToInsert.push({
            user_id: user.id,
            account_id: dbAccountId,
            name: stream.merchant_name || stream.description || 'Unknown',
            merchant_name: stream.merchant_name || null,
            expected_amount: Math.abs(stream.last_amount?.amount || stream.average_amount?.amount || 0),
            average_amount: Math.abs(stream.average_amount?.amount || 0),
            frequency: stream.frequency.toLowerCase(),
            start_date: stream.first_date || new Date().toISOString().split('T')[0],
            last_transaction_date: stream.last_date || null,
            next_due_date: calculateNextDueDate(stream.last_date, stream.frequency),
            transaction_type: 'income',
            is_subscription: false,
            is_active: stream.status === 'ACTIVE',
            total_occurrences: stream.transaction_count || 0,
            notes: stream.category?.join(', ') || null,
          });
        }

        if (recurringToInsert.length > 0) {
          await supabase
            .from('recurring_transactions')
            .upsert(recurringToInsert, {
              onConflict: 'user_id,name,account_id',
            });
          console.log(`💾 Stored ${recurringToInsert.length} recurring transactions`);
        }

      } catch (recurringError) {
        console.error('⚠️  Warning: Failed to fetch recurring streams:', recurringError);
        // Don't fail the whole request if recurring fetch fails
      }

    } catch (syncError) {
      // Handle PRODUCT_NOT_READY error (common in sandbox/new accounts)
      if (syncError.response && syncError.response.data && syncError.response.data.error_code === 'PRODUCT_NOT_READY') {
        console.log('⚠️  Transactions not ready yet from Plaid. This is normal for newly linked accounts.');
        console.log('💡 User can manually sync transactions in 1-2 minutes by clicking "Sync from Plaid"');
      } else {
        console.error('⚠️  Warning: Failed to auto-sync transactions:', syncError.message || syncError);
      }
      // Don't fail the whole request if sync fails
    }

    res.json({
      access_token: accessToken,
      item_id: itemId,
      accounts: accountsResponse.data.accounts,
      institution_name: institutionName,
      transactions_synced: true,
    });
  } catch (error) {
    console.error('❌ Error exchanging public token:', error);
    res.status(500).json({ error: 'Failed to exchange token', details: error.message });
  }
});

// Get transactions from database (read-only, no syncing)
app.get('/api/transactions', async (req, res) => {
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

    // Get last sync time from plaid_items
    const { data: plaidItems } = await supabase
      .from('plaid_items')
      .select('updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1);

    const lastSynced = plaidItems?.[0]?.updated_at || null;

    // Just return transactions from database (no syncing)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Use explicit relationship name to avoid ambiguity with transfer_to_account_id
    const { data: dbTransactions } = await supabase
      .from('transactions')
      .select(`
        *,
        accounts!transactions_account_id_fkey (
          name,
          mask,
          institution_name,
          type,
          subtype
        ),
        transaction_categories (
          name,
          icon,
          color
        )
      `)
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .limit(500);

    res.json({ 
      transactions: dbTransactions || [],
      last_synced: lastSynced
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      details: error.message 
    });
  }
});

// Manual sync endpoint with 24-hour rate limit
// Note: This rate limit only applies to manual syncs via the "Sync from Plaid" button
// Initial syncs when linking a new account (in exchange_public_token) are NOT rate limited
app.post('/api/transactions/sync', async (req, res) => {
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

    // Get user's Plaid items
    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id);

    if (itemsError || !plaidItems || plaidItems.length === 0) {
      return res.status(400).json({ error: 'No accounts connected. Please connect an account first.' });
    }

    // Check if any item has been synced in the last 24 hours
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let mostRecentSync = null;
    for (const item of plaidItems) {
      const itemUpdatedAt = new Date(item.updated_at);
      if (!mostRecentSync || itemUpdatedAt > mostRecentSync) {
        mostRecentSync = itemUpdatedAt;
      }
    }

    // Rate limiting: Prevent sync if done in last 24 hours
    if (mostRecentSync && mostRecentSync > twentyFourHoursAgo) {
      const hoursUntilNextSync = 24 - ((now.getTime() - mostRecentSync.getTime()) / (1000 * 60 * 60));
      const minutesUntilNextSync = Math.ceil(hoursUntilNextSync * 60);
      
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: `You can sync again in ${Math.floor(hoursUntilNextSync)} hours and ${minutesUntilNextSync % 60} minutes`,
        next_sync_available: new Date(mostRecentSync.getTime() + 24 * 60 * 60 * 1000).toISOString(),
        last_synced: mostRecentSync.toISOString(),
        hours_remaining: Math.floor(hoursUntilNextSync),
        minutes_remaining: minutesUntilNextSync % 60
      });
    }

    // Fetch transactions from Plaid for all items
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    console.log(`🔄 Manual sync: Syncing transactions for user ${user.id} from ${startDate} to ${endDate}`);

    let totalSynced = 0;

    for (const item of plaidItems) {
      try {
        // Decrypt access token if it's encrypted
        let accessToken = item.access_token;
        if (encryptionKey && accessToken.includes(':')) {
          try {
            accessToken = decrypt(accessToken, encryptionKey);
          } catch (decryptError) {
            console.error(`Error decrypting access token for item ${item.id}:`, decryptError);
            continue;
          }
        }

        const response = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
        });

        console.log(`✅ Fetched ${response.data.transactions.length} transactions from ${item.institution_name}`);

        // Get account mappings
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, account_id')
          .eq('plaid_item_id', item.id);

        const accountMap = new Map(accounts?.map(a => [a.account_id, a.id]) || []);

        // Store transactions in database
        if (response.data.transactions.length > 0) {
          const transactionsToInsert = response.data.transactions.map((tx) => {
            const dbAccountId = accountMap.get(tx.account_id);
            return {
              user_id: user.id,
              account_id: dbAccountId,
              transaction_id: tx.transaction_id,
              amount: tx.amount,
              date: tx.date,
              authorized_date: tx.authorized_date || null,
              posted_date: tx.date,
              name: tx.name,
              // Plaid categorization
              plaid_category: tx.category || [],
              plaid_primary_category: tx.category?.[0] || null,
              plaid_detailed_category: tx.category ? tx.category.join(' > ') : null,
              // Merchant and location
              merchant_name: tx.merchant_name || null,
              location_city: tx.location?.city || null,
              location_state: tx.location?.region || null,
              location_country: tx.location?.country || null,
              location_address: tx.location?.address || null,
              location_lat: tx.location?.lat || null,
              location_lon: tx.location?.lon || null,
              // Transaction metadata
              // Plaid: positive = debit (expense), negative = credit (income)
              transaction_type: tx.amount > 0 ? 'expense' : 'income',
              payment_channel: tx.payment_channel || null,
              check_number: tx.check_number || null,
              // Flags
              pending: tx.pending || false,
              is_transfer: tx.amount === 0 || false,
            };
          }).filter((tx) => tx.account_id);

          if (transactionsToInsert.length > 0) {
            await supabase
              .from('transactions')
              .upsert(transactionsToInsert, {
                onConflict: 'account_id,transaction_id',
              });
            console.log(`💾 Stored ${transactionsToInsert.length} transactions in database`);
            totalSynced += transactionsToInsert.length;
          }
        }

        // Update the plaid_item's updated_at timestamp to track last sync
        await supabase
          .from('plaid_items')
          .update({ updated_at: now.toISOString() })
          .eq('id', item.id);

        // Also fetch recurring transaction streams
        try {
          const recurringResponse = await plaidClient.transactionsRecurringGet({
            access_token: accessToken,
            account_ids: accounts?.map(a => a.account_id) || [],
          });

          console.log(`✅ Found ${recurringResponse.data.inflow_streams.length} recurring inflows and ${recurringResponse.data.outflow_streams.length} recurring outflows for ${item.institution_name}`);

          // Store recurring streams
          const recurringToInsert = [];
          
          // Process outflow streams
          for (const stream of recurringResponse.data.outflow_streams) {
            const dbAccountId = accountMap.get(stream.account_id);
            if (!dbAccountId) continue;

            const isSubscription = stream.category?.includes('Subscription') || 
                                   stream.category?.includes('Software') ||
                                   stream.category?.includes('Streaming');

            recurringToInsert.push({
              user_id: user.id,
              account_id: dbAccountId,
              name: stream.merchant_name || stream.description || 'Unknown',
              merchant_name: stream.merchant_name || null,
              expected_amount: stream.last_amount?.amount || stream.average_amount?.amount || 0,
              average_amount: stream.average_amount?.amount || 0,
              frequency: stream.frequency.toLowerCase(),
              start_date: stream.first_date || new Date().toISOString().split('T')[0],
              last_transaction_date: stream.last_date || null,
              next_due_date: calculateNextDueDate(stream.last_date, stream.frequency),
              transaction_type: 'expense',
              is_subscription: isSubscription,
              is_active: stream.status === 'ACTIVE',
              total_occurrences: stream.transaction_count || 0,
              notes: stream.category?.join(', ') || null,
            });
          }

          // Process inflow streams
          for (const stream of recurringResponse.data.inflow_streams) {
            const dbAccountId = accountMap.get(stream.account_id);
            if (!dbAccountId) continue;

            recurringToInsert.push({
              user_id: user.id,
              account_id: dbAccountId,
              name: stream.merchant_name || stream.description || 'Unknown',
              merchant_name: stream.merchant_name || null,
              expected_amount: Math.abs(stream.last_amount?.amount || stream.average_amount?.amount || 0),
              average_amount: Math.abs(stream.average_amount?.amount || 0),
              frequency: stream.frequency.toLowerCase(),
              start_date: stream.first_date || new Date().toISOString().split('T')[0],
              last_transaction_date: stream.last_date || null,
              next_due_date: calculateNextDueDate(stream.last_date, stream.frequency),
              transaction_type: 'income',
              is_subscription: false,
              is_active: stream.status === 'ACTIVE',
              total_occurrences: stream.transaction_count || 0,
              notes: stream.category?.join(', ') || null,
            });
          }

          if (recurringToInsert.length > 0) {
            await supabase
              .from('recurring_transactions')
              .upsert(recurringToInsert, {
                onConflict: 'user_id,name,account_id',
              });
            console.log(`💾 Stored ${recurringToInsert.length} recurring transactions for ${item.institution_name}`);
          }
        } catch (recurringError) {
          console.error(`⚠️  Warning: Failed to fetch recurring streams for ${item.institution_name}:`, recurringError);
        }

      } catch (error) {
        console.error(`Error fetching transactions for item ${item.id}:`, error);
      }
    }

    console.log(`✅ Manual sync complete: ${totalSynced} transactions synced`);
    res.json({ 
      success: true,
      message: `Successfully synced ${totalSynced} transaction${totalSynced !== 1 ? 's' : ''} and recurring charges`,
      synced_count: totalSynced,
      synced_at: now.toISOString()
    });
  } catch (error) {
    console.error('❌ Error syncing transactions:', error);
    res.status(500).json({ 
      error: 'Failed to sync transactions',
      details: error.message 
    });
  }
});

// Search transactions endpoint
app.get('/api/transactions/search', async (req, res) => {
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

    // Get query parameters
    const {
      search,
      category_id,
      user_category_name,
      merchant_name,
      account_id,
      start_date,
      end_date,
      transaction_type,
      pending,
      tags,
      min_amount,
      max_amount,
      limit = 100,
      offset = 0,
    } = req.query;

    // Start building query
    // Use explicit relationship name to avoid ambiguity with transfer_to_account_id
    let query = supabase
      .from('transactions')
      .select(`
        *,
        accounts!transactions_account_id_fkey (
          name,
          mask,
          institution_name,
          type,
          subtype
        ),
        transaction_categories (
          name,
          icon,
          color
        )
      `, { count: 'exact' })
      .eq('user_id', user.id);

    // Apply filters
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    if (user_category_name) {
      query = query.eq('user_category_name', user_category_name);
    }

    if (merchant_name) {
      query = query.ilike('merchant_name', `%${merchant_name}%`);
    }

    if (account_id) {
      query = query.eq('account_id', account_id);
    }

    if (start_date) {
      query = query.gte('date', start_date);
    }

    if (end_date) {
      query = query.lte('date', end_date);
    }

    if (transaction_type) {
      query = query.eq('transaction_type', transaction_type);
    }

    if (pending !== undefined) {
      query = query.eq('pending', pending === 'true');
    }

    if (tags) {
      const tagsArray = Array.isArray(tags) ? tags : [tags];
      query = query.contains('tags', tagsArray);
    }

    if (min_amount !== undefined) {
      query = query.gte('amount', min_amount);
    }

    if (max_amount !== undefined) {
      query = query.lte('amount', max_amount);
    }

    // Order and paginate
    query = query
      .order('date', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Error searching transactions:', error);
      return res.status(500).json({ error: 'Failed to search transactions' });
    }

    res.json({
      transactions: transactions || [],
      count: count || 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Error searching transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to search transactions' });
  }
});

// Get categories endpoint
app.get('/api/categories', async (req, res) => {
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

    // Get categories (system categories + user's custom categories)
    const { data: categories, error: categoriesError } = await supabase
      .from('transaction_categories')
      .select('*')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .order('name', { ascending: true });

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }

    res.json({ categories: categories || [] });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch categories' });
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

// Sync recurring transactions from Plaid
app.post('/api/recurring/sync', async (req, res) => {
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

    console.log('🔄 Syncing recurring transactions from Plaid for user:', user.id);

    // Get user's Plaid items
    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', user.id);

    if (itemsError || !plaidItems || plaidItems.length === 0) {
      return res.status(400).json({ error: 'No accounts connected' });
    }

    let totalRecurring = 0;

    for (const item of plaidItems) {
      try {
        // Decrypt access token
        let accessToken = item.access_token;
        if (encryptionKey && accessToken.includes(':')) {
          try {
            accessToken = decrypt(accessToken, encryptionKey);
          } catch (decryptError) {
            console.error(`Error decrypting access token for item ${item.id}:`, decryptError);
            continue;
          }
        }

        // Get account mappings
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, account_id')
          .eq('plaid_item_id', item.id);

        const accountMap = new Map(accounts?.map(a => [a.account_id, a.id]) || []);

        // Fetch recurring streams from Plaid
        const recurringResponse = await plaidClient.transactionsRecurringGet({
          access_token: accessToken,
          account_ids: accounts?.map(a => a.account_id) || [],
        });

        console.log(`✅ Found ${recurringResponse.data.inflow_streams.length} inflows and ${recurringResponse.data.outflow_streams.length} outflows for ${item.institution_name}`);
        
        // Log first few streams for debugging
        if (recurringResponse.data.outflow_streams.length > 0) {
          console.log('  Sample outflow streams:');
          recurringResponse.data.outflow_streams.slice(0, 3).forEach(stream => {
            console.log(`    - ${stream.merchant_name || stream.description}: $${stream.last_amount?.amount || 0} (${stream.frequency})`);
          });
        }

        const recurringToInsert = [];
        
        // Process outflow streams (expenses)
        for (const stream of recurringResponse.data.outflow_streams) {
          const dbAccountId = accountMap.get(stream.account_id);
          if (!dbAccountId) continue;

          const isSubscription = stream.category?.includes('Subscription') || 
                                 stream.category?.includes('Software') ||
                                 stream.category?.includes('Streaming');

          recurringToInsert.push({
            user_id: user.id,
            account_id: dbAccountId,
            name: stream.merchant_name || stream.description || 'Unknown',
            merchant_name: stream.merchant_name || null,
            expected_amount: stream.last_amount?.amount || stream.average_amount?.amount || 0,
            average_amount: stream.average_amount?.amount || 0,
            frequency: stream.frequency.toLowerCase(),
            start_date: stream.first_date || new Date().toISOString().split('T')[0],
            last_transaction_date: stream.last_date || null,
            next_due_date: calculateNextDueDate(stream.last_date, stream.frequency),
            transaction_type: 'expense',
            is_subscription: isSubscription,
            is_active: stream.status === 'ACTIVE',
            total_occurrences: stream.transaction_count || 0,
            notes: stream.category?.join(', ') || null,
          });
        }

        // Process inflow streams (income)
        for (const stream of recurringResponse.data.inflow_streams) {
          const dbAccountId = accountMap.get(stream.account_id);
          if (!dbAccountId) continue;

          recurringToInsert.push({
            user_id: user.id,
            account_id: dbAccountId,
            name: stream.merchant_name || stream.description || 'Unknown',
            merchant_name: stream.merchant_name || null,
            expected_amount: Math.abs(stream.last_amount?.amount || stream.average_amount?.amount || 0),
            average_amount: Math.abs(stream.average_amount?.amount || 0),
            frequency: stream.frequency.toLowerCase(),
            start_date: stream.first_date || new Date().toISOString().split('T')[0],
            last_transaction_date: stream.last_date || null,
            next_due_date: calculateNextDueDate(stream.last_date, stream.frequency),
            transaction_type: 'income',
            is_subscription: false,
            is_active: stream.status === 'ACTIVE',
            total_occurrences: stream.transaction_count || 0,
            notes: stream.category?.join(', ') || null,
          });
        }

        if (recurringToInsert.length > 0) {
          await supabase
            .from('recurring_transactions')
            .upsert(recurringToInsert, {
              onConflict: 'user_id,name,account_id',
            });
          totalRecurring += recurringToInsert.length;
          console.log(`💾 Stored ${recurringToInsert.length} recurring transactions for ${item.institution_name}`);
        } else {
          // Fallback: Use pattern detection if Plaid didn't return any recurring streams
          console.log('  No recurring streams from Plaid API - using pattern detection...');
          
          const { data: existingTransactions } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .in('account_id', accounts?.map(a => a.id) || [])
            .order('date', { ascending: false })
            .limit(500);

          if (existingTransactions && existingTransactions.length > 0) {
            const detected = detectRecurringPatterns(existingTransactions, accountMap);
            
            if (detected.length > 0) {
              await supabase
                .from('recurring_transactions')
                .upsert(detected, {
                  onConflict: 'user_id,name,account_id',
                });
              totalRecurring += detected.length;
              console.log(`💾 Detected and stored ${detected.length} recurring patterns for ${item.institution_name}`);
            }
          }
        }

      } catch (error) {
        console.error(`❌ Error syncing recurring for item ${item.id}:`, error);
      }
    }

    res.json({
      success: true,
      message: `Successfully synced ${totalRecurring} recurring charge${totalRecurring !== 1 ? 's' : ''}`,
      recurring_count: totalRecurring,
      synced_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Error syncing recurring transactions:', error);
    res.status(500).json({ 
      error: 'Failed to sync recurring transactions',
      details: error.message 
    });
  }
});

// Get recurring transactions endpoint
app.get('/api/recurring', async (req, res) => {
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

    const { active_only, upcoming_only } = req.query;

    let query = supabase
      .from('recurring_transactions')
      .select(`
        *,
        accounts (
          name,
          mask,
          institution_name
        ),
        transaction_categories (
          name,
          icon,
          color
        )
      `)
      .eq('user_id', user.id)
      .order('next_due_date', { ascending: true, nullsLast: true });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    if (upcoming_only === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query = query
        .gte('next_due_date', today)
        .order('next_due_date', { ascending: true });
    }

    const { data: recurring, error } = await query;

    if (error) {
      console.error('❌ Error fetching recurring transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch recurring transactions' });
    }

    // Calculate days until due for each
    const recurringWithDue = (recurring || []).map((rt) => {
      if (!rt.next_due_date) return rt;
      const today = new Date();
      const dueDate = new Date(rt.next_due_date);
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
        ...rt,
        days_until_due: diffDays,
        due_in: diffDays < 0 
          ? `${Math.abs(diffDays)} days ago` 
          : diffDays === 0 
          ? 'Today' 
          : diffDays === 1 
          ? 'Tomorrow' 
          : `in ${diffDays} days`,
      };
    });

    res.json({ recurring: recurringWithDue });
  } catch (error) {
    console.error('❌ Get recurring error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch recurring transactions' });
  }
});

// Clean up duplicate accounts endpoint
app.post('/api/accounts/cleanup-duplicates', async (req, res) => {
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

    console.log('🧹 Cleaning up duplicate accounts for user:', user.id);

    // Get all accounts for this user
    const { data: allAccounts } = await supabase
      .from('accounts')
      .select('id, account_id, plaid_item_id, created_at, name, mask')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }); // Newest first

    if (!allAccounts || allAccounts.length === 0) {
      return res.json({ message: 'No accounts found', removed: 0 });
    }

    // Group by mask + type + subtype (identifies the same physical account across different plaid_items)
    const accountGroups = new Map();
    allAccounts.forEach(account => {
      // Use mask + type + subtype as the key (same physical account)
      const key = `${account.mask}_${account.type}_${account.subtype || 'none'}`;
      if (!accountGroups.has(key)) {
        accountGroups.set(key, []);
      }
      accountGroups.get(key).push(account);
    });

    // Find duplicates (more than one account with same mask + type)
    const duplicatesToRemove = [];
    accountGroups.forEach((accounts, key) => {
      if (accounts.length > 1) {
        // Keep the newest one, remove the rest
        const [keep, ...remove] = accounts;
        console.log(`  Found ${accounts.length} duplicates for account ${keep.name} (${keep.mask})`);
        console.log(`  Keeping: ${keep.id} (created: ${keep.created_at})`);
        remove.forEach(acc => {
          console.log(`  Removing: ${acc.id} (created: ${acc.created_at})`);
          duplicatesToRemove.push(acc.id);
        });
      }
    });

    if (duplicatesToRemove.length > 0) {
      console.log(`🗑️  Removing ${duplicatesToRemove.length} duplicate accounts...`);
      await supabase
        .from('accounts')
        .delete()
        .in('id', duplicatesToRemove);
      
      console.log('✅ Duplicates removed');
    }

    res.json({
      success: true,
      message: `Cleaned up ${duplicatesToRemove.length} duplicate account${duplicatesToRemove.length !== 1 ? 's' : ''}`,
      removed: duplicatesToRemove.length,
      total_accounts_before: allAccounts.length,
      total_accounts_after: allAccounts.length - duplicatesToRemove.length,
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ error: error.message || 'Failed to cleanup duplicates' });
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
// Delete entire user account endpoint
app.delete('/api/accounts/delete', async (req, res) => {
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

    console.log(`🗑️  DELETING ENTIRE USER ACCOUNT: ${user.email} (${user.id})`);

    // Get counts for reporting
    const { count: accountsCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: transactionsCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: plaidItemsCount } = await supabase
      .from('plaid_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Delete in order (due to foreign key constraints):
    // 1. Delete transactions
    const { error: txError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id);

    if (txError) {
      console.error('Error deleting transactions:', txError);
    } else {
      console.log(`✅ Deleted ${transactionsCount || 0} transactions`);
    }

    // 2. Delete recurring transactions
    const { error: recurringError } = await supabase
      .from('recurring_transactions')
      .delete()
      .eq('user_id', user.id);

    if (recurringError) {
      console.error('Error deleting recurring transactions:', recurringError);
    } else {
      console.log(`✅ Deleted recurring transactions`);
    }

    // 3. Delete accounts
    const { error: accountsError } = await supabase
      .from('accounts')
      .delete()
      .eq('user_id', user.id);

    if (accountsError) {
      console.error('Error deleting accounts:', accountsError);
    } else {
      console.log(`✅ Deleted ${accountsCount || 0} accounts`);
    }

    // 4. Delete Plaid items
    const { error: itemsError } = await supabase
      .from('plaid_items')
      .delete()
      .eq('user_id', user.id);

    if (itemsError) {
      console.error('Error deleting plaid items:', itemsError);
    } else {
      console.log(`✅ Deleted ${plaidItemsCount || 0} Plaid items`);
    }

    // Note: We cannot delete the user from Supabase auth using the anon key
    // The user will need to be deleted from the Supabase dashboard or using the service role key
    console.log(`⚠️  User account data deleted, but user still exists in Supabase Auth`);
    console.log(`   To fully delete the user, remove them from Supabase dashboard > Authentication > Users`);

    res.json({
      success: true,
      message: 'Account data deleted successfully. Please sign out and contact support to fully remove your account from the authentication system.',
      deleted_accounts: accountsCount || 0,
      deleted_transactions: transactionsCount || 0,
      deleted_plaid_items: plaidItemsCount || 0,
    });
  } catch (error) {
    console.error('❌ Error deleting user account:', error);
    res.status(500).json({
      error: 'Failed to delete account',
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Rocket Bucks API server running on port ${PORT}`);
  console.log(`📡 Make sure to set SUPABASE_URL and SUPABASE_ANON_KEY in .env file`);
  console.log(`📡 Make sure to set PLAID_CLIENT_ID and PLAID_SECRET in .env file`);
});

