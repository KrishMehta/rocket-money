import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../lib/supabase.js';
import { decrypt, isEncrypted } from '../lib/encryption.js';
import { autoCategorizeTransaction } from '../lib/categorization.js';

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.production,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Helper function to calculate next due date based on frequency
function calculateNextDueDate(lastDate: string | null, frequency: string): string | null {
  if (!lastDate) return null;
  
  const date = new Date(lastDate);
  const freqLower = frequency.toLowerCase();
  
  if (freqLower.includes('week')) {
    date.setDate(date.getDate() + 7);
  } else if (freqLower.includes('month')) {
    date.setMonth(date.getMonth() + 1);
  } else if (freqLower.includes('year')) {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    // Default to monthly
    date.setMonth(date.getMonth() + 1);
  }
  
  return date.toISOString().split('T')[0];
}

// Helper to get single value (handle arrays from Vercel)
function getParam(params: any, key: string, defaultValue: any = undefined) {
  const value = params[key];
  if (value === undefined || value === null) return defaultValue;
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Get action from query parameter to route to different handlers
  const action = getParam(req.query, 'action');
  
  // Route based on action
  if (action === 'sync') {
    return handleSync(req, res);
  } else if (action === 'search') {
    return handleSearch(req, res);
  } else if (action === 'auto-categorize') {
    return handleAutoCategorize(req, res);
  } else if (req.method === 'PATCH' || req.method === 'PUT') {
    return handleUpdate(req, res);
  } else if (req.method === 'GET') {
    return handleList(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle sync operation
async function handleSync(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);

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

    // Fetch transactions from Plaid for all items
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    console.log(`🔄 Manual sync: Syncing transactions for user ${user.id} from ${startDate} to ${endDate}`);

    let totalSynced = 0;
    const encryptionKey = process.env.ENCRYPTION_KEY || '';

    for (const item of plaidItems) {
      try {
        // Decrypt access token if it's encrypted
        let accessToken = item.access_token;
        if (encryptionKey && isEncrypted(accessToken)) {
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
          const transactionsToInsert = response.data.transactions.map((tx: any) => {
            const dbAccountId = accountMap.get(tx.account_id);
            
            // Auto-categorize if Plaid didn't provide a category
            const plaidCategory = tx.category?.[0] || null;
            let userCategory = null;
            
            if (!plaidCategory) {
              // Use our auto-categorization as fallback
              const autoCategory = autoCategorizeTransaction(tx.name, tx.merchant_name);
              if (autoCategory && autoCategory !== 'Uncategorized') {
                userCategory = autoCategory;
              }
            }
            
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
              plaid_primary_category: plaidCategory,
              plaid_detailed_category: tx.category ? tx.category.join(' > ') : null,
              // User categorization (fallback when Plaid doesn't provide)
              user_category_name: userCategory,
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
          }).filter((tx: any) => tx.account_id);

          if (transactionsToInsert.length > 0) {
            const { error: upsertError } = await supabase
              .from('transactions')
              .upsert(transactionsToInsert, {
                onConflict: 'account_id,transaction_id',
              });
            
            if (upsertError) {
              console.error(`❌ Error storing transactions for item ${item.id}:`, upsertError);
              throw new Error(`Failed to store transactions: ${upsertError.message}`);
            }
            
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
          const recurringToInsert: any[] = [];
          
          // Process outflow streams
          for (const stream of recurringResponse.data.outflow_streams) {
            const dbAccountId = accountMap.get(stream.account_id);
            if (!dbAccountId) continue;

            // Check if it's a subscription based on category or merchant name
            const merchantName = (stream.merchant_name || stream.description || '').toLowerCase();
            const categoryMatch = stream.category?.some((cat: string) => 
              cat.toLowerCase().includes('subscription') || 
              cat.toLowerCase().includes('software') ||
              cat.toLowerCase().includes('streaming')
            );
            
            // Common subscription merchant names/keywords
            const subscriptionKeywords = [
              'cursor', 'openai', 'apple', 'squarespace', 'workspace', 'worksp', 'spotify', 'netflix',
              'disney', 'hulu', 'amazon prime', 'youtube premium', 'adobe', 'microsoft',
              'google', 'dropbox', 'slack', 'zoom', 'notion', 'figma', 'canva', 'github',
              'gitlab', 'atlassian', 'jira', 'confluence', 'salesforce', 'hubspot', 'zendesk',
              'intercom', 'mailchimp', 'sendgrid', 'twilio', 'stripe', 'paypal', 'shopify',
              'wix', 'wordpress', 'webflow', 'framer', 'linear', 'vercel', 'netlify',
              'cloudflare', 'aws', 'azure', 'gcp', 'digitalocean', 'heroku', 'mongodb',
              'redis', 'elastic', 'datadog', 'sentry', 'new relic', 'loggly', 'papertrail'
            ];
            
            const merchantMatch = subscriptionKeywords.some(keyword => 
              merchantName.includes(keyword)
            );
            
            const isSubscription = categoryMatch || merchantMatch;

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
              is_active: stream.status === 'MATURE',
              total_occurrences: stream.transaction_ids ? stream.transaction_ids.length : 0,
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
              is_active: stream.status === 'MATURE',
              total_occurrences: stream.transaction_ids ? stream.transaction_ids.length : 0,
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
        } catch (recurringError: any) {
          console.error(`⚠️  Warning: Failed to fetch recurring streams for ${item.institution_name}:`, recurringError);
          // Continue even if recurring fails
        }

      } catch (error: any) {
        console.error(`Error fetching transactions for item ${item.id}:`, error);
        // Continue with other items even if one fails
      }
    }

    console.log(`✅ Manual sync complete: ${totalSynced} transactions synced`);
    res.json({ 
      success: true,
      message: `Successfully synced ${totalSynced} transaction${totalSynced !== 1 ? 's' : ''} and recurring charges`,
      synced_count: totalSynced,
      synced_at: now.toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error syncing transactions:', error);
    res.status(500).json({ 
      error: 'Failed to sync transactions',
      details: error.message 
    });
  }
}

// Handle search operation
async function handleSearch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check Supabase configuration
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('❌ Supabase not configured - missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error',
        details: 'Supabase credentials not configured. Please check environment variables.'
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get query parameters
    const params = req.method === 'GET' ? req.query : req.body;
    
    const search = getParam(params, 'search');
    const category_id = getParam(params, 'category_id');
    const user_category_name = getParam(params, 'user_category_name');
    const merchant_name = getParam(params, 'merchant_name');
    const account_id = getParam(params, 'account_id');
    const start_date = getParam(params, 'start_date');
    const end_date = getParam(params, 'end_date');
    const transaction_type = getParam(params, 'transaction_type');
    const pending = getParam(params, 'pending');
    const tags = getParam(params, 'tags');
    const min_amount = getParam(params, 'min_amount');
    const max_amount = getParam(params, 'max_amount');
    const limit = Number(getParam(params, 'limit', 100));
    const offset = Number(getParam(params, 'offset', 0));
    const sort_by = getParam(params, 'sort_by', 'date');
    const sort_order = getParam(params, 'sort_order', 'desc');

    // Start building query
    let query = supabase
      .from('transactions')
      .select(`
        *,
        accounts!account_id (
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
      try {
        query = query.textSearch('name', String(search), { type: 'websearch' });
      } catch (textSearchError) {
        console.warn('textSearch not available, using ilike fallback:', textSearchError);
        query = query.ilike('name', `%${String(search)}%`);
      }
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
      query = query.eq('pending', pending === 'true' || pending === true);
    }

    if (tags) {
      let tagsArray: string[];
      if (Array.isArray(tags)) {
        tagsArray = tags;
      } else if (typeof tags === 'string') {
        try {
          tagsArray = JSON.parse(tags);
        } catch {
          tagsArray = [tags];
        }
      } else {
        tagsArray = [String(tags)];
      }
      if (tagsArray.length > 0) {
        query = query.contains('tags', tagsArray);
      }
    }

    if (min_amount !== undefined) {
      query = query.gte('amount', min_amount);
    }

    if (max_amount !== undefined) {
      query = query.lte('amount', max_amount);
    }

    // Order and paginate
    const ascending = sort_order === 'asc' || sort_order === 'ascending';
    const orderBy = sort_by || 'date';
    
    query = query
      .order(orderBy, { ascending })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    const { data: transactions, error, count } = await query;

    if (error) {
      console.error('Error searching transactions:', error);
      return res.status(500).json({ 
        error: 'Failed to search transactions',
        details: error.message || 'Unknown database error'
      });
    }

    res.json({
      transactions: transactions || [],
      count: count || 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error('Error searching transactions:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to search transactions',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Handle auto-categorize operation
async function handleAutoCategorize(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get all uncategorized transactions
    const { data: transactions, error: fetchError } = await supabase
      .from('transactions')
      .select('id, name, merchant_name, plaid_primary_category, user_category_name')
      .eq('user_id', user.id)
      .is('user_category_name', null);

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }

    if (!transactions || transactions.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No transactions to categorize',
        categorized_count: 0 
      });
    }

    console.log(`🏷️  Auto-categorizing ${transactions.length} transactions for user ${user.id}`);

    // Categorize each transaction
    const updates: any[] = [];
    let categorizedCount = 0;

    for (const tx of transactions) {
      // Skip if already has a Plaid category or user category
      if (tx.plaid_primary_category || tx.user_category_name) {
        continue;
      }

      // Get auto-generated category
      const category = autoCategorizeTransaction(tx.name, tx.merchant_name);
      
      // Only update if we got a non-Uncategorized category
      if (category && category !== 'Uncategorized') {
        updates.push({
          id: tx.id,
          user_category_name: category,
        });
        categorizedCount++;
      }
    }

    // Update transactions in batches
    if (updates.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < updates.length; i += batchSize) {
        const batch = updates.slice(i, i + batchSize);
        const { error: updateError } = await supabase
          .from('transactions')
          .upsert(batch, { onConflict: 'id' });

        if (updateError) {
          console.error('Error updating transactions batch:', updateError);
        }
      }

      console.log(`✅ Successfully categorized ${categorizedCount} transactions`);
    }

    res.json({
      success: true,
      message: `Successfully categorized ${categorizedCount} transaction${categorizedCount !== 1 ? 's' : ''}`,
      total_checked: transactions.length,
      categorized_count: categorizedCount,
      uncategorized_count: transactions.length - categorizedCount,
    });
  } catch (error: any) {
    console.error('❌ Error auto-categorizing transactions:', error);
    res.status(500).json({ 
      error: 'Failed to auto-categorize transactions',
      details: error.message 
    });
  }
}

// Handle update operation
async function handleUpdate(req: VercelRequest, res: VercelResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { transaction_id } = req.query;
    const { category_id, user_category_name, notes, tags, excluded_from_budget, is_recurring } = req.body;

    if (!transaction_id) {
      return res.status(400).json({ error: 'transaction_id is required' });
    }

    // Build update object with only provided fields
    const updates: any = {};
    if (category_id !== undefined) updates.category_id = category_id;
    if (user_category_name !== undefined) updates.user_category_name = user_category_name;
    if (notes !== undefined) updates.notes = notes;
    if (tags !== undefined) updates.tags = tags;
    if (excluded_from_budget !== undefined) updates.excluded_from_budget = excluded_from_budget;
    if (is_recurring !== undefined) updates.is_recurring = is_recurring;

    // Update transaction
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', transaction_id)
      .eq('user_id', user.id) // Ensure user owns this transaction
      .select()
      .single();

    if (error) {
      console.error('Error updating transaction:', error);
      return res.status(500).json({ error: 'Failed to update transaction' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.json({ transaction: data });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
}

// Handle list operation (default GET)
async function handleList(req: VercelRequest, res: VercelResponse) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createSupabaseClient(token);

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
      return res.json({ transactions: [] });
    }

    // Fetch transactions from Plaid for all items
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    // Get encryption key for decrypting access tokens
    const encryptionKey = process.env.ENCRYPTION_KEY || '';

    for (const item of plaidItems) {
      try {
        // Decrypt access token if it's encrypted
        let accessToken = item.access_token;
        if (encryptionKey && isEncrypted(accessToken)) {
          try {
            accessToken = decrypt(accessToken, encryptionKey);
          } catch (decryptError) {
            console.error(`Error decrypting access token for item ${item.id}:`, decryptError);
            continue; // Skip this item if decryption fails
          }
        }

        const response = await plaidClient.transactionsGet({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
        });

        // Get account mappings
        const { data: accounts } = await supabase
          .from('accounts')
          .select('id, account_id')
          .eq('plaid_item_id', item.id);

        const accountMap = new Map(accounts?.map(a => [a.account_id, a.id]) || []);

        // Store transactions in database
        if (response.data.transactions.length > 0) {
          const transactionsToInsert = response.data.transactions.map((tx: any) => {
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
          }).filter((tx: any) => tx.account_id);

          if (transactionsToInsert.length > 0) {
            await supabase
              .from('transactions')
              .upsert(transactionsToInsert, {
                onConflict: 'account_id,transaction_id',
              });
          }
        }
      } catch (error: any) {
        console.error(`Error fetching transactions for item ${item.id}:`, error);
      }
    }

    // Return transactions from database (more reliable)
    const { data: dbTransactions } = await supabase
      .from('transactions')
      .select(`
        *,
        accounts!account_id (
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

    res.json({ transactions: dbTransactions || [] });
  } catch (error: any) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions'
    });
  }
}
