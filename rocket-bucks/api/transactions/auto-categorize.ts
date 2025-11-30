import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../../lib/supabase.js';
import { autoCategorizeTransaction } from '../../lib/categorization.js';

/**
 * Auto-categorize all transactions that are currently uncategorized
 * This fills in categories for transactions where Plaid didn't provide them
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

    // Get all uncategorized transactions (where plaid_primary_category is null and user_category_name is null)
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
          // Continue with other batches even if one fails
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

