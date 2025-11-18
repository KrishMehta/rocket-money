import { useState, useEffect } from 'react';
import PlaidLink from '../components/PlaidLink';
import { api } from '../utils/api';

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string;
  mask: string;
  balance_current: number;
  institution_name?: string;
}

const ConnectAccounts = () => {
  const [connectedAccounts, setConnectedAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load existing accounts from database
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await api.getAccounts();
        setConnectedAccounts(data.accounts || []);
      } catch (error) {
        console.error('Error loading accounts:', error);
      }
    };

    loadAccounts();
  }, []);

  const handlePlaidSuccess = async (publicToken: string, metadata: any) => {
    setIsLoading(true);
    try {
      console.log('🔄 Exchanging Plaid public token...');
      console.log('📋 Metadata:', metadata);
      
      // Exchange public token for access token
      // This automatically saves the account AND syncs transactions (no rate limit for new accounts)
      const result = await api.exchangePublicToken(publicToken);
      console.log('✅ Account connected:', result.institution_name);
      
      // Reload accounts from database
      const data = await api.getAccounts();
      setConnectedAccounts(data.accounts || []);
      
      // Show success message
      const txCount = result.transactions_synced ? 'Transactions have been synced automatically!' : '';
      alert(`✅ Successfully connected ${result.institution_name || 'your bank account'}!\n\n${txCount}\n\nYou can now view your real transaction data in all tabs.`);
    } catch (error: any) {
      console.error('❌ Error connecting account:', error);
      alert(`Failed to connect account: ${error.message || 'Unknown error'}\n\nPlease try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const getAccountIcon = (type: string, subtype: string) => {
    if (type === 'depository') {
      if (subtype === 'checking') return '🏦';
      if (subtype === 'savings') return '💰';
    }
    if (type === 'credit') return '💳';
    if (type === 'investment') return '📈';
    if (type === 'loan') return '🏠';
    return '💵';
  };

  const getAccountTypeLabel = (type: string, subtype: string) => {
    return `${type.charAt(0).toUpperCase() + type.slice(1)} - ${
      subtype.charAt(0).toUpperCase() + subtype.slice(1)
    }`;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Connect Your Accounts</h1>
        <p className="text-gray-600">
          Securely connect your bank accounts to automatically track your finances
        </p>
      </div>

      {/* Plaid Info Card */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 mb-8 border border-blue-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-2xl">🔒</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Bank-Level Security with Plaid
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              We use Plaid, the same secure technology trusted by Venmo, Robinhood, and thousands of
              other financial apps. Your credentials are encrypted and never stored on our servers.
            </p>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>✓ 256-bit encryption</li>
              <li>✓ Read-only access to your accounts</li>
              <li>✓ Trusted by over 11,000 financial institutions</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Connected Accounts */}
      {connectedAccounts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Connected Accounts</h2>
          <div className="space-y-3">
            {connectedAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-red-300 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-2xl">
                    {getAccountIcon(account.type, account.subtype)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {account.institution_name || 'Bank'} {account.name}
                    </p>
                    <p className="text-sm text-gray-600">
                      {getAccountTypeLabel(account.type, account.subtype)} ••••{account.mask}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">
                    ${(account.balance_current || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-green-600">✓ Connected</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connect New Account */}
      <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        {isLoading ? (
          <div className="py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-600">Connecting your account...</p>
          </div>
        ) : (
          <>
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🏦</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {connectedAccounts.length > 0 ? 'Add Another Account' : 'Connect Your First Account'}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Link your bank account to automatically import transactions and track your spending in
              real-time.
            </p>
            <PlaidLink onSuccess={handlePlaidSuccess}>
              <button className="px-8 py-4 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors shadow-lg hover:shadow-xl">
                Connect Bank Account with Plaid
              </button>
            </PlaidLink>
            <p className="text-xs text-gray-500 mt-4">
              By connecting your account, you agree to Plaid's{' '}
              <a href="https://plaid.com/legal/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>
            </p>
          </>
        )}
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🔄</span>
          </div>
          <h4 className="font-bold text-gray-900 mb-2">Auto-Sync</h4>
          <p className="text-sm text-gray-600">
            Your transactions sync automatically every day
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">📊</span>
          </div>
          <h4 className="font-bold text-gray-900 mb-2">Smart Insights</h4>
          <p className="text-sm text-gray-600">
            AI-powered analysis of your spending patterns
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">🎯</span>
          </div>
          <h4 className="font-bold text-gray-900 mb-2">Budget Tracking</h4>
          <p className="text-sm text-gray-600">
            Track spending against your goals automatically
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConnectAccounts;

