import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { latencyTracker } from '../utils/latencyTracker';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [upcomingCharges, setUpcomingCharges] = useState<any[]>([]);
  const [spendingData, setSpendingData] = useState<any[]>([]);
  const [monthlySpend, setMonthlySpend] = useState(0);
  const { user } = useAuth();
  const firstName =
    user?.full_name?.trim()?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'there';
  const [totalTransactions, setTotalTransactions] = useState(0);
  
  // Ref to prevent duplicate measurements (React StrictMode double-invocation)
  const isMeasuringRef = useRef(false);

  // Helper function to get category name (same as Spending page)
  const getCategoryName = (transaction: any) => {
    return transaction.user_category_name ||
           transaction.transaction_categories?.name ||
           transaction.plaid_primary_category ||
           'Uncategorized';
  };

  useEffect(() => {
    // Prevent duplicate measurements (React StrictMode double-invocation)
    if (isMeasuringRef.current) {
      return;
    }
    
    isMeasuringRef.current = true;
    loadDashboardData();
    
    // Cleanup function to reset the flag when component unmounts
    return () => {
      // Only reset if we're still measuring (component unmounted during load)
      // Otherwise, let the finally block handle it
      if (isMeasuringRef.current) {
        // Small delay to ensure measurement completes
        setTimeout(() => {
          isMeasuringRef.current = false;
        }, 100);
      }
    };
  }, []);

  const loadDashboardData = async () => {
    // Start measuring total workflow latency
    const workflowStartTime = performance.now();
    
    try {
      setLoading(true);
      
      // Calculate date range for this month (same logic as Transactions page)
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Measure individual API call latencies (wrapped to track each promise)
      const accountsStartTime = performance.now();
      const accountsPromise = api.getAccounts().then((res) => {
        return { res, latency: performance.now() - accountsStartTime };
      });
      
      const transactionsStartTime = performance.now();
      const transactionsPromise = api.searchTransactions({ 
        limit: 10,
        start_date: firstDayOfMonth.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
      }).then((res) => {
        return { res, latency: performance.now() - transactionsStartTime };
      });
      
      const recurringStartTime = performance.now();
      const recurringPromise = api.getRecurring({ upcoming_only: true }).then((res) => {
        return { res, latency: performance.now() - recurringStartTime };
      });
      
      // Wait for all parallel API calls to complete
      const [accountsResult, transactionsResult, recurringResult] = await Promise.all([
        accountsPromise,
        transactionsPromise,
        recurringPromise,
      ]);
      
      // Extract results and latencies
      const accountsRes = accountsResult.res;
      const accountsLatency = accountsResult.latency;
      const transactionsRes = transactionsResult.res;
      const transactionsLatency = transactionsResult.latency;
      const recurringRes = recurringResult.res;
      const recurringLatency = recurringResult.latency;

      // Set accounts
      setAccounts(accountsRes.accounts || []);

      // Set recent transactions
      setRecentTransactions(transactionsRes.transactions || []);
      setTotalTransactions(transactionsRes.count || 0);

      // Set upcoming charges (next 30 days)
      // Filter out interest payments (same as Recurring page)
      const next30Days = recurringRes.recurring?.filter((r: any) => {
        const name = (r.name || '').toLowerCase();
        return r.days_until_due >= 0 && 
               r.days_until_due <= 30 &&
               !name.includes('interest') && 
               !name.includes('interest payment');
      }) || [];
      setUpcomingCharges(next30Days);

      // Measure spending trends calculation latency
      const spendingTrendsStartTime = performance.now();
      // Calculate monthly spending trends (last 6 months)
      // This also calculates and sets the current month spending for consistency
      await calculateSpendingTrends();
      const spendingTrendsLatency = performance.now() - spendingTrendsStartTime;

      // Calculate total workflow latency
      const totalLatency = performance.now() - workflowStartTime;
      
      // Record latency metrics
      latencyTracker.record({
        totalLatency,
        accountsLatency,
        transactionsLatency,
        recurringLatency,
        spendingTrendsLatency,
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      
      // Still record latency even on error (for monitoring error scenarios)
      const totalLatency = performance.now() - workflowStartTime;
      latencyTracker.record({
        totalLatency,
        accountsLatency: 0,
        transactionsLatency: 0,
        recurringLatency: 0,
        spendingTrendsLatency: 0,
      });
    } finally {
      setLoading(false);
      // Reset measuring flag after measurement completes
      isMeasuringRef.current = false;
    }
  };

  const calculateSpendingTrends = async () => {
    try {
      const now = new Date();
      
      // Fetch last 6 months of transactions (same date range logic as Spending page)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      // Use exact same date range calculation as Spending page for "This Month"
      const endDate = now; // Same as Spending page: endDate = now
      
      const { transactions } = await api.searchTransactions({
        start_date: sixMonthsAgo.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0], // Same as Spending page
        limit: 10000,
      });

      // Calculate spending for each month using exact month boundaries (same as Spending page)
      const monthlyData: { [key: string]: number } = {};
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Calculate spending for each of the last 5 months
      for (let i = 4; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = months[monthDate.getMonth()];
        const monthYear = monthDate.getFullYear();
        const monthNum = monthDate.getMonth();
        
        // Calculate exact month boundaries (same as Spending page "Last Month" logic)
        let monthStart: Date;
        let monthEnd: Date;
        
        if (i === 0) {
          // Current month: from first day to today
          monthStart = new Date(monthYear, monthNum, 1);
          monthEnd = now;
        } else {
          // Past months: full month (first day to last day)
          monthStart = new Date(monthYear, monthNum, 1);
          monthEnd = new Date(monthYear, monthNum + 1, 0); // Last day of the month
        }
        
        const monthStartStr = monthStart.toISOString().split('T')[0];
        const monthEndStr = monthEnd.toISOString().split('T')[0];
        
        // Filter transactions for this specific month
        const monthSpendingRaw = transactions
          .filter((tx: any) => {
            const txDateStr = tx.date.split('T')[0]; // Get date part only
            const categoryName = getCategoryName(tx);
            return tx.transaction_type === 'expense' &&
                   tx.amount > 0 &&
                   categoryName !== 'Income' &&
                   categoryName !== 'Transfer' &&
                   txDateStr >= monthStartStr &&
                   txDateStr <= monthEndStr;
          })
          .reduce((sum: number, tx: any) => sum + tx.amount, 0);
        
        // Round to 2 decimal places
        monthlyData[monthName] = Math.round(monthSpendingRaw * 100) / 100;
      }

      // Convert to chart data (last 5 months)
      const chartData = [];
      
      for (let i = 4; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthName = months[date.getMonth()];
        // Round to 2 decimal places to avoid floating point precision issues
        const amount = monthlyData[monthName] || 0;
        chartData.push({
          month: monthName,
          amount: Math.round(amount * 100) / 100,
        });
      }

      setSpendingData(chartData);
      
      // Set current month spending from chart data
      const currentMonthName = now.toLocaleDateString('en-US', { month: 'short' });
      const currentMonthSpending = monthlyData[currentMonthName] || 0;
      setMonthlySpend(currentMonthSpending);
    } catch (error) {
      console.error('Error calculating spending trends:', error);
    }
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  };


  const groupAccountsByType = () => {
    const checking = accounts
      .filter(a => a.type === 'depository' && a.subtype === 'checking')
      .reduce((sum, a) => sum + (a.balance_current || 0), 0);
    
    const savings = accounts
      .filter(a => a.type === 'depository' && a.subtype === 'savings')
      .reduce((sum, a) => sum + (a.balance_current || 0), 0);
    
    const creditCards = accounts
      .filter(a => a.type === 'credit')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);
    
    const investments = accounts
      .filter(a => a.type === 'investment')
      .reduce((sum, a) => sum + (a.balance_current || 0), 0);

    const netCash = checking - creditCards;

    return [
      checking > 0 && { name: 'Checking', amount: checking, icon: '🏦' },
      creditCards > 0 && { name: 'Credit Cards', amount: creditCards, icon: '💳', isDebt: true },
      { name: 'Net Cash', amount: netCash, icon: '💵', isNegative: netCash < 0 },
      savings > 0 && { name: 'Savings', amount: savings, icon: '💰' },
      investments > 0 && { name: 'Investments', amount: investments, icon: '📈' },
    ].filter(Boolean);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const groupedAccounts = groupAccountsByType();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Good evening, {firstName}</h1>

      {/* Connect Accounts Banner - Show only if no accounts */}
      {accounts.length === 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-8 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🏦</span>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-1">Connect Your Bank Accounts</h3>
                <p className="text-blue-100 text-sm">
                  Securely link your accounts with Plaid to automatically track transactions and get personalized insights
                </p>
              </div>
            </div>
            <Link
              to="/connect-accounts"
              className="px-6 py-3 bg-white text-blue-600 rounded-xl font-medium hover:bg-blue-50 transition-colors shadow-lg whitespace-nowrap ml-4"
            >
              Connect Now
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current spend card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-2">Current spend this month</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              ${monthlySpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
            
            {spendingData.length >= 2 && (
              <div className="flex items-center gap-2 mb-4">
                {spendingData[spendingData.length - 1]?.amount < spendingData[spendingData.length - 2]?.amount ? (
                  <>
                    <span className="text-green-600">✓</span>
                    <p className="text-sm text-gray-600">
                      You've spent <span className="font-semibold">
                        ${(spendingData[spendingData.length - 2].amount - spendingData[spendingData.length - 1].amount).toLocaleString()}
                      </span> less than last month
                    </p>
                  </>
                ) : (
                  <>
                    <span className="text-red-600">↑</span>
                    <p className="text-sm text-gray-600">
                      You've spent <span className="font-semibold">
                        ${(spendingData[spendingData.length - 1].amount - spendingData[spendingData.length - 2].amount).toLocaleString()}
                      </span> more than last month
                    </p>
                  </>
                )}
              </div>
            )}

            {spendingData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={spendingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
                <p className="text-sm text-gray-600">
                  You've had {totalTransactions} transaction{totalTransactions !== 1 ? 's' : ''} so far this month
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-gray-500">
                        <p className="mb-2">No transactions found.</p>
                        <Link to="/connect-accounts" className="text-blue-600 hover:underline">
                          Connect an account to get started
                        </Link>
                      </td>
                    </tr>
                  ) : (
                    recentTransactions.map((transaction, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">{formatDate(transaction.date)}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {transaction.name}
                          {transaction.pending && (
                            <span className="ml-2 text-gray-500">| Pending</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-right font-medium">
                          {transaction.transaction_type === 'income' ? (
                            <span className="text-green-600">+${Math.abs(transaction.amount).toFixed(2)}</span>
                          ) : (
                            <span className="text-gray-900">${Math.abs(transaction.amount).toFixed(2)}</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Link to="/transactions">
              <button className="mt-4 w-full py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300">
                See more transactions
              </button>
            </Link>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Accounts */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Accounts</h3>
              <Link to="/connect-accounts" className="text-sm text-blue-600 hover:underline">
                Manage
              </Link>
            </div>

            {groupedAccounts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600 mb-3">No accounts connected yet</p>
                <Link 
                  to="/connect-accounts"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                >
                  Connect Account
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {groupedAccounts.map((account: any, index) => (
                  <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{account.icon}</span>
                      <span className="text-sm font-medium text-gray-900">{account.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${
                        account.isNegative ? 'text-red-600' : account.isDebt ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        ${Math.abs(account.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-gray-400">›</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coming Up */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Coming Up</h3>
            {upcomingCharges.length > 0 ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  You have {upcomingCharges.length} recurring charge{upcomingCharges.length !== 1 ? 's' : ''} due within the next 30 days for ${upcomingCharges.reduce((sum, c) => sum + (c.expected_amount || 0), 0).toFixed(2)}.
                </p>

                <div className="space-y-3">
                  {upcomingCharges.slice(0, 5).map((charge, index) => (
                    <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                          {charge.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{charge.name}</p>
                          <p className="text-xs text-gray-600">{charge.due_in}</p>
                        </div>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        ${(charge.expected_amount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {upcomingCharges.length > 5 && (
                  <Link to="/recurring">
                    <button className="mt-4 w-full py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300">
                      See all recurring charges
                    </button>
                  </Link>
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-gray-600 mb-3">No upcoming charges</p>
                <Link to="/recurring" className="text-sm text-blue-600 hover:underline">
                  Manage recurring charges
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

