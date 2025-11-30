import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
  balance_current: number;
  institution_name: string;
  plaid_item_id: string;
}

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await api.getAccounts();
      setAccounts(data.accounts || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      alert('Please type "DELETE MY ACCOUNT" to confirm');
      return;
    }

    const finalConfirm = window.confirm(
      `🚨 FINAL WARNING 🚨\n\n` +
      `This will PERMANENTLY delete your entire Rocket Bucks account:\n\n` +
      `• Your user account (${user?.email})\n` +
      `• ${accounts.length} connected account(s)\n` +
      `• All transaction history\n` +
      `• All recurring transaction data\n` +
      `• All financial data\n\n` +
      `YOU WILL BE LOGGED OUT AND CANNOT RECOVER THIS DATA.\n\n` +
      `Are you absolutely sure?`
    );

    if (!finalConfirm) return;

    try {
      setDeleting(true);
      
      // Call the delete API (no plaid_item_id = delete entire user account)
      const response = await fetch(`${api.getApiUrl()}/accounts`, {
        method: 'DELETE',
        headers: api.getAuthHeaders(),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      const result = await response.json();
      
      // Show success message
      alert(
        `✅ Account Data Deleted\n\n` +
        `Deleted:\n` +
        `• ${result.deleted_plaid_items} Plaid connection(s)\n` +
        `• ${result.deleted_accounts} account(s)\n` +
        `• ${result.deleted_transactions} transaction(s)\n\n` +
        `${result.message}\n\n` +
        `You will now be signed out.`
      );
      
      // Sign out and redirect to login
      localStorage.removeItem('supabase.auth.token');
      navigate('/login');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      alert(`❌ Failed to delete account: ${error.message}`);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-red-600">⚠️ Delete Account</h1>
        <p className="text-gray-600 mt-2">
          Permanently delete your entire Rocket Bucks account and all associated data.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="text-4xl">🚨</div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-red-900 mb-2">Danger Zone</h2>
            <p className="text-red-800 mb-4">
              This action will <strong>permanently delete</strong> your entire account. This cannot be undone.
            </p>
          </div>
        </div>

        {/* Account Summary */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">Your Account Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Email Address</span>
              <span className="font-medium text-gray-900">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">Connected Accounts</span>
              <span className="font-medium text-gray-900">{accounts.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">User ID</span>
              <span className="font-mono text-xs text-gray-600">{user?.id}</span>
            </div>
          </div>
        </div>

        {/* What will be deleted */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <h3 className="font-bold text-gray-900 mb-4">What will be deleted:</h3>
          <ul className="space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span className="text-gray-700">Your user account and login credentials</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span className="text-gray-700">All {accounts.length} connected bank account(s)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span className="text-gray-700">All transaction history</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span className="text-gray-700">All recurring transaction data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span className="text-gray-700">All spending insights and analytics</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span className="text-gray-700">All net worth tracking data</span>
            </li>
          </ul>
        </div>

        {/* Confirmation */}
        <div className="bg-white rounded-xl p-6 mb-6">
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-900 mb-2 block">
              Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">DELETE MY ACCOUNT</span> to confirm:
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
              disabled={deleting}
            />
          </label>
        </div>

        {/* Delete Button */}
        <button
          onClick={handleDeleteAccount}
          disabled={deleting || confirmText !== 'DELETE MY ACCOUNT'}
          className="w-full py-4 bg-red-600 text-white rounded-lg font-bold text-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {deleting ? (
            <>
              <span className="animate-spin text-2xl">⏳</span>
              Deleting Account...
            </>
          ) : (
            <>
              <span className="text-2xl">🗑️</span>
              Permanently Delete My Account
            </>
          )}
        </button>

        {confirmText !== 'DELETE MY ACCOUNT' && confirmText.length > 0 && (
          <p className="text-sm text-red-600 mt-2 text-center">
            Text doesn't match. Please type exactly: DELETE MY ACCOUNT
          </p>
        )}
      </div>

      {/* Alternative Actions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-bold text-blue-900 mb-2">Need something else?</h3>
        <p className="text-sm text-blue-800 mb-4">
          If you just want to remove connected accounts or reset your data, you can do that from the Connect Accounts
          page without deleting your entire account.
        </p>
        <button
          onClick={() => navigate('/connect-accounts')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
        >
          Go to Connect Accounts
        </button>
      </div>
    </div>
  );
};

export default DeleteAccount;

