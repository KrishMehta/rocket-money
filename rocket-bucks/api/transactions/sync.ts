import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../../lib/supabase.js';
import { decrypt, isEncrypted } from '../../lib/encryption.js';
import { autoCategorizeTransaction } from '../../lib/categorization.js';

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

/**
 * Manual sync endpoint with 24-hour rate limit
 * Note: This rate limit only applies to manual syncs via the "Sync from Plaid" button
 * Initial syncs when linking a new account (in exchange_public_token) are NOT rate limited
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    // Check if any item has been synced in the last 24 hours
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let mostRecentSync: Date | null = null;
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

