import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../../lib/supabase.js';

/**
 * Search and filter transactions with advanced querying
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
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
      sort_by = 'date',
      sort_order = 'desc',
    } = req.method === 'GET' ? req.query : req.body;

    // Start building query
    let query = supabase
      .from('transactions')
      .select(`
        *,
        accounts (
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
      // Full-text search on transaction name
      query = query.textSearch('name', search, { type: 'websearch' });
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

    if (tags && Array.isArray(tags)) {
      query = query.contains('tags', tags);
    } else if (tags) {
      query = query.contains('tags', [tags]);
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
      return res.status(500).json({ error: 'Failed to search transactions' });
    }

    res.json({
      transactions: transactions || [],
      count: count || 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error('Error searching transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to search transactions' });
  }
}

