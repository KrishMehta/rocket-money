import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

const Transactions = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeMessage, setCategorizeMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 15;

  // Manually sync transactions from Plaid
  const syncTransactionsFromPlaid = async () => {
    try {
      setSyncing(true);
      setSyncError(null);
      console.log('🔄 Manually syncing transactions from Plaid...');
      
      // Call the manual sync endpoint
      const result = await api.syncTransactions();
      
      setLastSyncTime(new Date());
      console.log('✅ Transactions synced successfully:', result.message);
      
      // Reload transactions after sync
      loadTransactionsFromDB();
    } catch (error: any) {
      console.error('❌ Error syncing transactions:', error);
      setSyncError(error.message || 'Failed to sync transactions');
    } finally {
      setSyncing(false);
    }
  };

  // Auto-categorize uncategorized transactions
  const autoCategorizeTransactions = async () => {
    try {
      setCategorizing(true);
      setCategorizeMessage(null);
      console.log('🏷️  Auto-categorizing transactions...');
      
      const result = await api.autoCategorizeTransactions();
      
      console.log('✅ Transactions categorized:', result.message);
      setCategorizeMessage(result.message);
      
      // Reload transactions after categorization
      loadTransactionsFromDB();
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setCategorizeMessage(null);
      }, 5000);
    } catch (error: any) {
      console.error('❌ Error categorizing transactions:', error);
      setCategorizeMessage(error.message || 'Failed to categorize transactions');
    } finally {
      setCategorizing(false);
    }
  };

  // Export transactions to CSV
  const exportTransactionsToCSV = async () => {
    try {
      setExporting(true);
      console.log('📥 Exporting transactions to CSV...');
      
      // Build filters (same as loadTransactionsFromDB but without pagination)
      const filters: any = {
        limit: 10000, // Large limit to get all transactions
        offset: 0,
      };
      
      if (searchTerm) filters.search = searchTerm;
      if (selectedCategory) filters.user_category_name = selectedCategory;
      if (selectedAccount) filters.account_id = selectedAccount;
      
      if (dateFilter !== 'all') {
        const now = new Date();
        if (dateFilter === 'thisMonth') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          filters.start_date = firstDay.toISOString().split('T')[0];
          filters.end_date = now.toISOString().split('T')[0];
        } else if (dateFilter === 'lastMonth') {
          const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          filters.start_date = firstDayLastMonth.toISOString().split('T')[0];
          filters.end_date = lastDayLastMonth.toISOString().split('T')[0];
        } else if (dateFilter === 'last3Months') {
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          filters.start_date = threeMonthsAgo.toISOString().split('T')[0];
          filters.end_date = now.toISOString().split('T')[0];
        }
      }
      
      // Add sorting
      filters.sort_by = sortBy;
      filters.sort_order = sortOrder;
      
      // Fetch all transactions
      const result = await api.searchTransactions(filters);
      const allTransactions = result.transactions || [];
      
      if (allTransactions.length === 0) {
        alert('No transactions to export');
        return;
      }
      
      // Convert to CSV
      const headers = ['Date', 'Name', 'Category', 'Amount', 'Account', 'Pending', 'Transaction Type'];
      const csvRows = [
        headers.join(','),
        ...allTransactions.map((tx: any) => {
          const date = new Date(tx.date).toLocaleDateString('en-US');
          const name = `"${(tx.name || '').replace(/"/g, '""')}"`;
          const category = getCategoryName(tx);
          const amount = tx.transaction_type === 'income' ? `+${Math.abs(tx.amount || 0).toFixed(2)}` : Math.abs(tx.amount || 0).toFixed(2);
          const account = tx.accounts ? `"${tx.accounts.name || ''} ••••${tx.accounts.mask || ''}"` : '';
          const pending = tx.pending ? 'Yes' : 'No';
          const type = tx.transaction_type || 'expense';
          
          return [date, name, category, amount, account, pending, type].join(',');
        }),
      ];
      
      const csvContent = csvRows.join('\n');
      
      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log(`✅ Exported ${allTransactions.length} transactions to CSV`);
    } catch (error: any) {
      console.error('❌ Error exporting transactions:', error);
      alert('Failed to export transactions: ' + (error.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  // Load transactions from database (no Plaid API call)
  const loadTransactionsFromDB = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = {
        limit: itemsPerPage,
        offset: currentPage * itemsPerPage,
      };
      
      if (searchTerm) filters.search = searchTerm;
      if (selectedCategory) filters.user_category_name = selectedCategory;
      if (selectedAccount) filters.account_id = selectedAccount;
      
      if (dateFilter !== 'all') {
        const now = new Date();
        if (dateFilter === 'thisMonth') {
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          filters.start_date = firstDay.toISOString().split('T')[0];
          filters.end_date = now.toISOString().split('T')[0];
        } else if (dateFilter === 'lastMonth') {
          const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          filters.start_date = firstDayLastMonth.toISOString().split('T')[0];
          filters.end_date = lastDayLastMonth.toISOString().split('T')[0];
        } else if (dateFilter === 'last3Months') {
          const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          filters.start_date = threeMonthsAgo.toISOString().split('T')[0];
          filters.end_date = now.toISOString().split('T')[0];
        }
      }
      
      // Add sorting
      filters.sort_by = sortBy;
      filters.sort_order = sortOrder;
      
      const result = await api.searchTransactions(filters);
      setTransactions(result.transactions || []);
      setTotalCount(result.count || 0);
    } catch (error: any) {
      console.error('❌ Error loading transactions:', error);
      setSyncError(error.message || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedCategory, selectedAccount, dateFilter, sortBy, sortOrder, currentPage, itemsPerPage]);

  // Load accounts and categories for filters (only once)
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [accountsData, categoriesData] = await Promise.all([
          api.getAccounts(),
          api.getCategories(),
        ]);

        setAccounts(accountsData.accounts || []);
        
        // Deduplicate categories by name (keep first occurrence)
        const uniqueCategories = categoriesData.categories?.reduce((acc: any[], cat: any) => {
          if (!acc.find(c => c.name === cat.name)) {
            acc.push(cat);
          }
          return acc;
        }, []) || [];
        
        setCategories(uniqueCategories);
      } catch (error) {
        console.error('Error loading filter data:', error);
      }
    };

    loadFilterData();
  }, []);

  // Load transactions when filters change (reads from database only, no Plaid sync)
  useEffect(() => {
    loadTransactionsFromDB();
  }, [loadTransactionsFromDB]);

  const getCategoryIcon = (transaction: any) => {
    if (transaction.transaction_categories?.icon) {
      return transaction.transaction_categories.icon;
    }
    if (transaction.user_category_name) {
      const category = categories.find(c => c.name === transaction.user_category_name);
      return category?.icon || '❓';
    }
    if (transaction.plaid_primary_category) {
      // Map Plaid categories to icons
      const categoryMap: { [key: string]: string } = {
        'Food and Drink': '🍽️',
        'Shops': '🛍️',
        'Transportation': '🚗',
        'Travel': '✈️',
        'Recreation': '🎮',
        'Service': '🔧',
      };
      return categoryMap[transaction.plaid_primary_category] || '❓';
    }
    return '❓';
  };

  const getCategoryName = (transaction: any) => {
    return transaction.user_category_name || 
           transaction.transaction_categories?.name || 
           transaction.plaid_primary_category || 
           'Uncategorized';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  };

  // Update transaction category
  const updateTransactionCategory = async (transactionId: string, categoryName: string) => {
    try {
      await api.updateTransaction(transactionId, {
        user_category_name: categoryName || undefined,
      });
      console.log(`✅ Updated transaction ${transactionId} category to ${categoryName}`);
      setEditingTransaction(null);
      // Reload transactions to show updated category
      loadTransactionsFromDB();
    } catch (error: any) {
      console.error('❌ Error updating transaction category:', error);
      alert('Failed to update category: ' + (error.message || 'Unknown error'));
    }
  };

  // Delete transaction
  const deleteTransaction = async (transactionId: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
      return;
    }

    try {
      setDeletingTransaction(transactionId);
      await api.deleteTransaction(transactionId);
      console.log(`✅ Deleted transaction ${transactionId}`);
      // Reload transactions to remove deleted one
      loadTransactionsFromDB();
    } catch (error: any) {
      console.error('❌ Error deleting transaction:', error);
      alert('Failed to delete transaction: ' + (error.message || 'Unknown error'));
    } finally {
      setDeletingTransaction(null);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
          {lastSyncTime && (
            <p className="text-sm text-gray-500 mt-1">
              Last synced: {lastSyncTime.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <button 
            onClick={syncTransactionsFromPlaid}
            disabled={syncing}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Manually sync transactions from Plaid"
          >
            <span className={syncing ? 'animate-spin' : ''}>🔄</span>
            {syncing ? 'Syncing...' : 'Sync from Plaid'}
          </button>
          <button 
            onClick={autoCategorizeTransactions}
            disabled={categorizing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Automatically categorize uncategorized transactions"
          >
            <span>🏷️</span>
            {categorizing ? 'Categorizing...' : 'Auto-Categorize'}
          </button>
          <button 
            onClick={exportTransactionsToCSV}
            disabled={exporting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Export transactions to CSV"
          >
            <span className={exporting ? 'animate-spin' : ''}>📥</span>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              setSortBy(newSortBy);
              setSortOrder(newSortOrder);
              setCurrentPage(0);
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="amount-desc">Amount (High to Low)</option>
            <option value="amount-asc">Amount (Low to High)</option>
            <option value="name-asc">Name (A to Z)</option>
            <option value="name-desc">Name (Z to A)</option>
          </select>
        </div>
      </div>

      {/* Sync Error Message */}
      {syncError && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <span className="text-red-500 text-xl">⚠️</span>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Sync Error</h3>
            <p className="text-sm text-red-600 mt-1">{syncError}</p>
          </div>
          <button 
            onClick={() => setSyncError(null)}
            className="text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Categorize Success/Error Message */}
      {categorizeMessage && (
        <div className={`mb-6 rounded-lg p-4 flex items-start gap-3 ${
          categorizeMessage.includes('Failed') || categorizeMessage.includes('Error')
            ? 'bg-red-50 border border-red-200'
            : 'bg-green-50 border border-green-200'
        }`}>
          <span className={`text-xl ${
            categorizeMessage.includes('Failed') || categorizeMessage.includes('Error')
              ? 'text-red-500'
              : 'text-green-500'
          }`}>
            {categorizeMessage.includes('Failed') || categorizeMessage.includes('Error') ? '⚠️' : '✅'}
          </span>
          <div className="flex-1">
            <h3 className={`text-sm font-medium ${
              categorizeMessage.includes('Failed') || categorizeMessage.includes('Error')
                ? 'text-red-800'
                : 'text-green-800'
            }`}>
              Auto-Categorization
            </h3>
            <p className={`text-sm mt-1 ${
              categorizeMessage.includes('Failed') || categorizeMessage.includes('Error')
                ? 'text-red-600'
                : 'text-green-600'
            }`}>
              {categorizeMessage}
            </p>
          </div>
          <button 
            onClick={() => setCategorizeMessage(null)}
            className={
              categorizeMessage.includes('Failed') || categorizeMessage.includes('Error')
                ? 'text-red-400 hover:text-red-600'
                : 'text-green-400 hover:text-green-600'
            }
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search your transactions..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(0);
              }}
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
          </div>
          
          <select 
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setCurrentPage(0);
            }}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700"
          >
            <option value="all">All dates</option>
            <option value="thisMonth">This month</option>
            <option value="lastMonth">Last month</option>
            <option value="last3Months">Last 3 months</option>
          </select>

          <select 
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(0);
            }}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>

          <select 
            value={selectedAccount}
            onChange={(e) => {
              setSelectedAccount(e.target.value);
              setCurrentPage(0);
            }}
            className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700"
          >
            <option value="">All accounts</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ••••{acc.mask}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Name</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Category</th>
                <th className="text-center py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                <th className="text-right py-4 px-6 text-sm font-medium text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    {loading || syncing ? (
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm text-gray-600">
                          {syncing ? 'Syncing transactions from Plaid...' : 'Loading transactions...'}
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="mb-2">No transactions found.</p>
                        <Link to="/connect-accounts" className="text-blue-600 hover:underline">
                          Connect an account to get started
                        </Link>
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6 text-sm text-gray-900">
                      {formatDate(transaction.date)}
                    </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {transaction.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{transaction.name}</p>
                          {transaction.pending && (
                            <span className="text-xs text-gray-500">| Pending</span>
                          )}
                          {transaction.accounts && (
                            <span className="text-xs text-gray-500">
                              {transaction.accounts.institution_name} ••••{transaction.accounts.mask}
                            </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    {editingTransaction === transaction.id ? (
                      <select
                        defaultValue={getCategoryName(transaction)}
                        onChange={(e) => {
                          updateTransactionCategory(transaction.id, e.target.value);
                        }}
                        onBlur={() => setEditingTransaction(null)}
                        autoFocus
                        className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getCategoryIcon(transaction)}</span>
                        <span className="text-sm text-gray-900">{getCategoryName(transaction)}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingTransaction(transaction.id);
                          }}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit transaction"
                          disabled={editingTransaction === transaction.id}
                        >
                        ✏️
                      </button>
                      <button 
                        onClick={() => {
                          deleteTransaction(transaction.id);
                        }}
                        disabled={deletingTransaction === transaction.id}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete transaction"
                      >
                        {deletingTransaction === transaction.id ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          '🗑️'
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className={`text-sm font-medium ${
                        transaction.transaction_type === 'income' ? 'text-green-600' : 'text-gray-900'
                    }`}>
                        {transaction.transaction_type === 'income' ? '+' : ''}${Math.abs(transaction.amount || 0).toFixed(2)}
                    </span>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600">
            Showing {transactions.length > 0 ? currentPage * itemsPerPage + 1 : 0}-{Math.min((currentPage + 1) * itemsPerPage, totalCount)} of {totalCount} transactions
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
              disabled={currentPage === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button 
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={(currentPage + 1) * itemsPerPage >= totalCount}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-gray-600">
        <p>© 2025 Rocket Bucks. All rights reserved.</p>
        <div className="flex justify-center gap-6 mt-2">
          <a href="#" className="hover:text-gray-900">Terms of Service</a>
          <a href="#" className="hover:text-gray-900">Privacy Policy</a>
          <a href="#" className="hover:text-gray-900">Notice at Collection</a>
        </div>
      </div>
    </div>
  );
};

export default Transactions;

