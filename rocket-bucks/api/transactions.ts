import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../lib/supabase.js';
import { decrypt, isEncrypted } from '../lib/encryption.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') {
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

    // Handle PATCH/PUT - Update a transaction
    if (req.method === 'PATCH' || req.method === 'PUT') {
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
    // Note: Must specify foreign key explicitly because transactions has two relationships to accounts
    // (account_id and transfer_to_account_id), so we use accounts!account_id to be explicit
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
    // Don't expose internal error details to client
    res.status(500).json({ 
      error: 'Failed to fetch transactions'
    });
  }
}

