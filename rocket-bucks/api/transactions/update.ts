import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../../lib/supabase';

/**
 * Update transaction category, notes, tags, or other user-editable fields
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PATCH' && req.method !== 'PUT') {
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

    res.json({ transaction: data });
  } catch (error: any) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: error.message || 'Failed to update transaction' });
  }
}

