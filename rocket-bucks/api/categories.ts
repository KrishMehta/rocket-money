import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../lib/supabase.js';

/**
 * Get all categories (system + user-defined)
 * Create/update user-defined categories
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
    // Get all categories (system + user's custom categories)
    const { data: categories, error } = await supabase
      .from('transaction_categories')
      .select('*')
      .or(`user_id.eq.${user.id},is_system.eq.true`)
      .order('is_system', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }

    res.json({ categories: categories || [] });
  } else if (req.method === 'POST') {
    // Create a new user category
    const { name, icon, color, parent_category_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const { data: category, error } = await supabase
      .from('transaction_categories')
      .insert({
        user_id: user.id,
        name,
        icon: icon || '📁',
        color: color || '#6b7280',
        parent_category_id: parent_category_id || null,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return res.status(500).json({ error: 'Failed to create category' });
    }

    res.json({ category });
  } else if (req.method === 'PATCH' || req.method === 'PUT') {
    // Update a user category
    const { category_id, name, icon, color, parent_category_id } = req.body;

    if (!category_id) {
      return res.status(400).json({ error: 'category_id is required' });
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (parent_category_id !== undefined) updates.parent_category_id = parent_category_id;

    const { data: category, error } = await supabase
      .from('transaction_categories')
      .update(updates)
      .eq('id', category_id)
      .eq('user_id', user.id) // Only allow updating own categories
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      return res.status(500).json({ error: 'Failed to update category' });
    }

    if (!category) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.json({ category });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

