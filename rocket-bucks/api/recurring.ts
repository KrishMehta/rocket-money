import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../lib/supabase.js';

/**
 * Get, create, update, or delete recurring transactions
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  if (req.method === 'GET') {
    // Get recurring transactions
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
      .order('next_due_date', { ascending: true, nullsFirst: false });

    if (active_only === 'true') {
      query = query.eq('is_active', true);
    }

    if (upcoming_only === 'true') {
      const today = new Date().toISOString().split('T')[0];
      query = query
        .eq('is_active', true)
        .gte('next_due_date', today)
        .order('next_due_date', { ascending: true });
    }

    const { data: recurring, error } = await query;

    if (error) {
      console.error('Error fetching recurring transactions:', error);
      return res.status(500).json({ error: 'Failed to fetch recurring transactions' });
    }

    // Calculate days until due for each
    const recurringWithDue = (recurring || []).map((rt: any) => {
      if (!rt.next_due_date) return rt;
      
      // Normalize dates to midnight for accurate day calculations
      const today = new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const dueDate = new Date(rt.next_due_date);
      const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      
      const diffTime = dueDateMidnight.getTime() - todayMidnight.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
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
  } else if (req.method === 'POST') {
    // Create new recurring transaction
    const {
      name,
      account_id,
      category_id,
      expected_amount,
      frequency,
      day_of_month,
      day_of_week,
      week_of_month,
      start_date,
      next_due_date,
      transaction_type,
      is_subscription,
      merchant_name,
      notes,
    } = req.body;

    if (!name || !frequency) {
      return res.status(400).json({ error: 'Name and frequency are required' });
    }

    const { data: recurring, error } = await supabase
      .from('recurring_transactions')
      .insert({
        user_id: user.id,
        name,
        account_id: account_id || null,
        category_id: category_id || null,
        expected_amount: expected_amount || null,
        frequency,
        day_of_month: day_of_month || null,
        day_of_week: day_of_week || null,
        week_of_month: week_of_month || null,
        start_date: start_date || new Date().toISOString().split('T')[0],
        next_due_date: next_due_date || null,
        transaction_type: transaction_type || 'expense',
        is_subscription: is_subscription || false,
        merchant_name: merchant_name || null,
        notes: notes || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating recurring transaction:', error);
      return res.status(500).json({ error: 'Failed to create recurring transaction' });
    }

    res.json({ recurring });
  } else if (req.method === 'PATCH' || req.method === 'PUT') {
    // Update recurring transaction
    const { recurring_id } = req.query;
    const updates = req.body;

    if (!recurring_id) {
      return res.status(400).json({ error: 'recurring_id is required' });
    }

    const { data: recurring, error } = await supabase
      .from('recurring_transactions')
      .update(updates)
      .eq('id', recurring_id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating recurring transaction:', error);
      return res.status(500).json({ error: 'Failed to update recurring transaction' });
    }

    if (!recurring) {
      return res.status(404).json({ error: 'Recurring transaction not found' });
    }

    res.json({ recurring });
  } else if (req.method === 'DELETE') {
    // Delete recurring transaction (or mark as inactive)
    const { recurring_id } = req.query;

    if (!recurring_id) {
      return res.status(400).json({ error: 'recurring_id is required' });
    }

    const { error } = await supabase
      .from('recurring_transactions')
      .update({ is_active: false, end_date: new Date().toISOString().split('T')[0] })
      .eq('id', recurring_id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting recurring transaction:', error);
      return res.status(500).json({ error: 'Failed to delete recurring transaction' });
    }

    res.json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

