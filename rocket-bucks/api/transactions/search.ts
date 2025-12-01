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
    // On Vercel, query params can be strings or arrays, so we need to normalize them
    const params = req.method === 'GET' ? req.query : req.body;
    
    // Helper to get single value (handle arrays from Vercel)
    const getParam = (key: string, defaultValue: any = undefined) => {
      const value = params[key];
      if (value === undefined || value === null) return defaultValue;
      if (Array.isArray(value)) return value[0];
      return value;
    };
    
    const search = getParam('search');
    const category_id = getParam('category_id');
    const user_category_name = getParam('user_category_name');
    const merchant_name = getParam('merchant_name');
    const account_id = getParam('account_id');
    const start_date = getParam('start_date');
    const end_date = getParam('end_date');
    const transaction_type = getParam('transaction_type');
    const pending = getParam('pending');
    const tags = getParam('tags');
    const min_amount = getParam('min_amount');
    const max_amount = getParam('max_amount');
    const limit = Number(getParam('limit', 100));
    const offset = Number(getParam('offset', 0));
    const sort_by = getParam('sort_by', 'date');
    const sort_order = getParam('sort_order', 'desc');

    // Start building query
    // Note: Must specify foreign key explicitly because transactions has two relationships to accounts
    // (account_id and transfer_to_account_id), so we use accounts!account_id to be explicit
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
      // Full-text search on transaction name
      // Fallback to ilike if textSearch fails (in case index isn't set up)
      try {
        query = query.textSearch('name', String(search), { type: 'websearch' });
      } catch (textSearchError) {
        // Fallback to case-insensitive search if textSearch isn't available
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
        // Handle JSON string from URL params
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
      console.error('Error details:', JSON.stringify(error, null, 2));
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
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to search transactions',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

