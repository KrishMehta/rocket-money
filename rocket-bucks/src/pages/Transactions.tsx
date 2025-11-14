import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

const Transactions = () => {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 15;

  // Load accounts and categories for filters (only once)
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        const [accountsData, categoriesData] = await Promise.all([
          api.getAccounts(),
          api.getCategories(),
        ]);

        setAccounts(accountsData.accounts || []);
        setCategories(categoriesData.categories || []);
      } catch (error) {
        console.error('Error loading filter data:', error);
      }
    };

    loadFilterData();
  }, []);

  // Load transactions with filters
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const filters: any = {
          limit: itemsPerPage,
          offset: currentPage * itemsPerPage,
        };

        if (searchTerm) {
          filters.search = searchTerm;
        }

        if (selectedCategory) {
          filters.user_category_name = selectedCategory;
        }

        if (selectedAccount) {
          filters.account_id = selectedAccount;
        }

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

        const result = await api.searchTransactions(filters);
        setTransactions(result.transactions || []);
        setTotalCount(result.count || 0);
      } catch (error) {
        console.error('Error loading transactions:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [searchTerm, selectedCategory, selectedAccount, dateFilter, currentPage]);

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
        <h1 className="text-3xl font-bold text-gray-900">Transactions</h1>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2">
            <span>📥</span>
            Export
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Sort by date ▼
          </button>
        </div>
      </div>

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
                <th className="w-12 px-6 py-4">
                  <input type="checkbox" className="rounded" />
                </th>
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
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
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
                  <td className="px-6 py-4">
                    <input type="checkbox" className="rounded" />
                  </td>
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
                    <div className="flex items-center gap-2">
                        <span className="text-lg">{getCategoryIcon(transaction)}</span>
                        <span className="text-sm text-gray-900">{getCategoryName(transaction)}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => {
                            // TODO: Implement edit functionality
                            console.log('Edit transaction', transaction.id);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="Edit transaction"
                        >
                        ✏️
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

