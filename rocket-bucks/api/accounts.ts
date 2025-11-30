import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSupabaseClient } from '../lib/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'DELETE') {
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

    // Handle DELETE - Delete entire user account and all data
    if (req.method === 'DELETE') {
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

      // 5. Delete the user's auth account from Supabase
      const { error: deleteUserError } = await supabase.auth.admin.deleteUser(user.id);

      if (deleteUserError) {
        console.error('Error deleting user from auth:', deleteUserError);
        await supabase.auth.signOut();
        return res.json({
          success: true,
          message: 'Account data deleted successfully. Please contact support to fully remove your account.',
          deleted_accounts: accountsCount || 0,
          deleted_transactions: transactionsCount || 0,
          deleted_plaid_items: plaidItemsCount || 0,
        });
      }

      console.log(`✅ Successfully deleted user account: ${user.email}`);

      return res.json({
        success: true,
        message: 'Account permanently deleted',
        deleted_accounts: accountsCount || 0,
        deleted_transactions: transactionsCount || 0,
        deleted_plaid_items: plaidItemsCount || 0,
      });
    }

    // Handle GET - List accounts
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return res.status(500).json({ error: 'Failed to fetch accounts' });
    }

    res.json({ accounts: accounts || [] });
  } catch (error: any) {
    console.error('Error with accounts:', error);
    res.status(500).json({ error: error.message || 'Failed to process request' });
  }
}

