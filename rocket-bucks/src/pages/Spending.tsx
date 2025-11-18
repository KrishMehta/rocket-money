import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../utils/api';

const Spending = () => {
  const [activeTab, setActiveTab] = useState<'lastMonth' | 'thisMonth' | 'custom'>('thisMonth');
  const [customPeriod, setCustomPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly' | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthlySpending, setMonthlySpending] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [frequentMerchants, setFrequentMerchants] = useState<any[]>([]);
  const [largestPurchases, setLargestPurchases] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState({
    income: 0,
    bills: 0,
    spending: 0,
    incomeCount: 0,
    billsChange: 0,
    spendingChange: 0,
  });

  useEffect(() => {
    // Reset custom period when switching away from custom tab
    if (activeTab !== 'custom') {
      setCustomPeriod(null);
    }
    // Only load data if custom tab has a period selected, or if it's not custom tab
    if (activeTab !== 'custom' || customPeriod) {
      loadSpendingData();
    }
  }, [activeTab, customPeriod]);

  const loadSpendingData = async () => {
    try {
      setLoading(true);
      
      // Determine date range based on active tab
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (activeTab === 'lastMonth') {
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (activeTab === 'custom' && customPeriod) {
        // Custom period based on selection
        switch (customPeriod) {
          case 'weekly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            endDate = now;
            break;
          case 'monthly':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
            break;
          case 'quarterly':
            const currentQuarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), currentQuarter * 3, 1);
            endDate = now;
            break;
          case 'yearly':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = now;
            break;
          default:
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = now;
        }
      } else {
        // This month - use today's date (inclusive) to ensure all transactions are included
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = now; // Use current date/time to include all of today
      }

      // Fetch transactions for the selected period
      const { transactions: txData } = await api.searchTransactions({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        limit: 10000,
      });


      // Calculate spending first to get the correct value for the selected period
      const periodSpending = (txData || [])
        .filter((tx: any) => {
          const categoryName = getCategoryName(tx);
          return tx.transaction_type === 'expense' && 
                 tx.amount > 0 && 
                 categoryName !== 'Income' && 
                 categoryName !== 'Transfer';
        })
        .reduce((sum: number, tx: any) => sum + tx.amount, 0);

      // Determine which month to override in the bar chart based on active tab
      let targetMonthKey: string | null = null;
      if (activeTab === 'lastMonth') {
        // For "Last Month", override the previous month
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        targetMonthKey = lastMonth.toLocaleDateString('en-US', { month: 'short' });
      } else if (activeTab === 'thisMonth') {
        // For "This Month", override the current month
        targetMonthKey = now.toLocaleDateString('en-US', { month: 'short' });
      }
      // For custom periods, targetMonthKey stays null and we'll use period-specific logic

      // Calculate all metrics using the same spending value for consistency
      const roundedSpending = Math.round(periodSpending * 100) / 100;
      calculateMonthlyTrends(txData || [], roundedSpending, targetMonthKey, activeTab, customPeriod, endDate);
      calculateCategoryBreakdown(txData || [], roundedSpending);
      calculateTopMerchants(txData || []);
      calculateLargestPurchases(txData || []);
      calculateSummary(txData || [], startDate, endDate);

    } catch (error) {
      console.error('Error loading spending data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMonthlyTrends = (
    currentTxData: any[], 
    periodSpendingValue: number, 
    targetMonthKey: string | null,
    activeTab: string,
    customPeriod: string | null,
    endDate: Date
  ) => {
    try {
      const now = new Date();
      let chartData: { month: string; amount: number }[] = [];

      // Filter transactions (exclude Income and Transfer)
      const filteredTx = currentTxData.filter((tx: any) => {
        const categoryName = getCategoryName(tx);
        return tx.transaction_type === 'expense' && 
               tx.amount > 0 && 
               categoryName !== 'Income' && 
               categoryName !== 'Transfer';
      });

      if (activeTab === 'custom' && customPeriod) {
        // Custom period - show data for that specific period
        if (customPeriod === 'weekly') {
          // Group by day for the last 7 days
          const dailyData: { [key: string]: number } = {};
          filteredTx.forEach((tx: any) => {
            const date = new Date(tx.date);
            const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dailyData[dayKey] = (dailyData[dayKey] || 0) + tx.amount;
          });

          // Generate last 7 days
          for (let i = 6; i >= 0; i--) {
            const date = new Date(endDate);
            date.setDate(date.getDate() - i);
            const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            chartData.push({
              month: dayKey,
              amount: dailyData[dayKey] || 0,
            });
          }
        } else if (customPeriod === 'quarterly') {
          // Group by month for the current quarter
          const monthlyData: { [key: string]: number } = {};
          filteredTx.forEach((tx: any) => {
            const date = new Date(tx.date);
            const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + tx.amount;
          });

          // Generate current quarter months
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          for (let i = 0; i < 3; i++) {
            const monthIndex = currentQuarter * 3 + i;
            const monthName = months[monthIndex];
            chartData.push({
              month: monthName,
              amount: monthlyData[monthName] || 0,
            });
          }
        } else if (customPeriod === 'yearly') {
          // Group by month for the current year
          const monthlyData: { [key: string]: number } = {};
          filteredTx.forEach((tx: any) => {
            const date = new Date(tx.date);
            const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + tx.amount;
          });

          // Generate all months of current year
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          for (let i = 0; i < 12; i++) {
            chartData.push({
              month: months[i],
              amount: monthlyData[months[i]] || 0,
            });
          }
        } else {
          // Monthly - show daily breakdown for the current month
          const dailyData: { [key: string]: number } = {};
          filteredTx.forEach((tx: any) => {
            const date = new Date(tx.date);
            const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            dailyData[dayKey] = (dailyData[dayKey] || 0) + tx.amount;
          });

          // Generate all days of the current month
          const currentDay = now.getDate();
          
          // Show days from start of month to today
          for (let day = 1; day <= currentDay; day++) {
            const date = new Date(now.getFullYear(), now.getMonth(), day);
            const dayKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            chartData.push({
              month: dayKey,
              amount: dailyData[dayKey] || 0,
            });
          }
        }
      } else {
        // For "Last Month" and "This Month" tabs, show last 6 months with override
        const monthlyData: { [key: string]: number } = {};
        filteredTx.forEach((tx: any) => {
          const date = new Date(tx.date);
          const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + tx.amount;
        });

        // Fetch last 6 months for historical context
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        api.searchTransactions({
          start_date: sixMonthsAgo.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
          limit: 10000,
        }).then(({ transactions: allTx }) => {
          // Group by month from all historical data
          const historicalMonthlyData: { [key: string]: number } = {};
          allTx?.forEach((tx: any) => {
            const categoryName = getCategoryName(tx);
            if (tx.transaction_type === 'expense' && 
                tx.amount > 0 && 
                categoryName !== 'Income' && 
                categoryName !== 'Transfer') {
              const date = new Date(tx.date);
              const monthKey = date.toLocaleDateString('en-US', { month: 'short' });
              historicalMonthlyData[monthKey] = (historicalMonthlyData[monthKey] || 0) + tx.amount;
            }
          });

          // Override the target month with the calculated spending value
          if (targetMonthKey) {
            historicalMonthlyData[targetMonthKey] = periodSpendingValue;
          }

          // Convert to chart data (last 6 months)
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const chartData = [];
          
          for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = months[date.getMonth()];
            chartData.push({
              month: monthName,
              amount: historicalMonthlyData[monthName] || 0,
            });
          }

          setMonthlySpending(chartData);
        }).catch((error) => {
          console.error('Error fetching historical data for monthly trends:', error);
          // Fallback: use only current filtered data
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const chartData = [];
          
          for (let i = 5; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = months[date.getMonth()];
            chartData.push({
              month: monthName,
              amount: monthlyData[monthName] || 0,
            });
          }
          setMonthlySpending(chartData);
        });
        return; // Early return for async case
      }

      // For custom periods, set data directly
      setMonthlySpending(chartData);
    } catch (error) {
      console.error('Error calculating trends:', error);
    }
  };

  const calculateCategoryBreakdown = (txData: any[], totalSpendingValue: number) => {
    const categoryTotals: { [key: string]: { amount: number; count: number } } = {};
    
    // Group by category - use same filter as spending calculation (exclude Income and Transfer)
    txData.forEach((tx: any) => {
      const categoryName = getCategoryName(tx);
      if (tx.transaction_type === 'expense' && 
          tx.amount > 0 && 
          categoryName !== 'Income' && 
          categoryName !== 'Transfer') {
        const category = categoryName;
        if (!categoryTotals[category]) {
          categoryTotals[category] = { amount: 0, count: 0 };
        }
        categoryTotals[category].amount += tx.amount;
        categoryTotals[category].count += 1;
      }
    });

    // Use the total spending value passed in to ensure consistency
    const totalSpending = totalSpendingValue;
    
    const colors = ['#f97316', '#3b82f6', '#06b6d4', '#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#6b7280'];
    const categoryArray = Object.entries(categoryTotals)
      .map(([name, data], index) => ({
        name,
        spend: data.amount,
        count: data.count,
        percent: totalSpending > 0 ? Math.round((data.amount / totalSpending) * 100) : 0,
        color: colors[index % colors.length],
      }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 8); // Top 8 categories for display

    setCategoryData(categoryArray);
  };

  const calculateTopMerchants = (txData: any[]) => {
    const merchantTotals: { [key: string]: { amount: number; count: number; amounts: number[] } } = {};
    
    txData.forEach((tx: any) => {
      const categoryName = getCategoryName(tx);
      // Exclude Income and Transfer categories, same as spending calculation
      if (tx.transaction_type === 'expense' && 
          tx.amount > 0 && 
          categoryName !== 'Income' && 
          categoryName !== 'Transfer') {
        const merchant = tx.merchant_name || tx.name;
        if (!merchantTotals[merchant]) {
          merchantTotals[merchant] = { amount: 0, count: 0, amounts: [] };
        }
        merchantTotals[merchant].amount += tx.amount;
        merchantTotals[merchant].count += 1;
        merchantTotals[merchant].amounts.push(tx.amount);
      }
    });

    // Get top 3 merchants
    const topMerchants = Object.entries(merchantTotals)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        average: data.amount / data.count,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    setFrequentMerchants(topMerchants);
  };

  const calculateLargestPurchases = (txData: any[]) => {
    const largest = txData
      .filter((tx: any) => {
        const categoryName = getCategoryName(tx);
        // Exclude Income and Transfer categories, same as spending calculation
        return tx.transaction_type === 'expense' && 
               tx.amount > 0 && 
               categoryName !== 'Income' && 
               categoryName !== 'Transfer';
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
      .map((tx: any) => ({
        name: tx.merchant_name || tx.name,
        date: new Date(tx.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
        amount: tx.amount,
      }));

    setLargestPurchases(largest);
  };

  const getCategoryName = (transaction: any) => {
    return transaction.user_category_name || 
           transaction.transaction_categories?.name || 
           transaction.plaid_primary_category || 
           'Uncategorized';
  };

  const calculateSummary = async (txData: any[], startDate: Date, endDate: Date) => {
    // Current period
    // Income should be calculated based on transactions categorized as "Income"
    // not just transaction_type, since users can categorize transactions differently
    const incomeRaw = txData
      .filter((tx: any) => {
        const categoryName = getCategoryName(tx);
        return categoryName === 'Income';
      })
      .reduce((sum, tx) => {
        // Income transactions are stored as negative amounts (Plaid convention)
        // So we need to take absolute value
        return sum + Math.abs(tx.amount || 0);
      }, 0);
    // Round final result to 2 decimal places to avoid floating point precision issues
    const income = Math.round(incomeRaw * 100) / 100;
    
    // Bills should include transactions categorized as "Bills & Utilities" 
    // or transactions marked as recurring (to catch bills that Plaid identified as recurring)
    const billsRaw = txData
      .filter((tx: any) => {
        const categoryName = getCategoryName(tx);
        return tx.transaction_type === 'expense' && 
               tx.amount > 0 &&
               (tx.is_recurring || 
                categoryName === 'Bills & Utilities' || 
                categoryName === 'Bills and Utilities');
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    // Round to avoid floating point precision issues
    const bills = Math.round(billsRaw * 100) / 100;
    
    // Spending: all expenses (excluding income and transfers)
    const spendingRaw = txData
      .filter((tx: any) => {
        // Exclude transactions categorized as Income or Transfer
        const categoryName = getCategoryName(tx);
        return tx.transaction_type === 'expense' && 
               tx.amount > 0 && 
               categoryName !== 'Income' && 
               categoryName !== 'Transfer';
      })
      .reduce((sum, tx) => sum + tx.amount, 0);
    // Round to avoid floating point precision issues
    const spending = Math.round(spendingRaw * 100) / 100;

    const incomeCount = txData.filter((tx: any) => {
      const categoryName = getCategoryName(tx);
      return categoryName === 'Income';
    }).length;

    // Previous period for comparison
    const periodLength = endDate.getTime() - startDate.getTime();
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - periodLength);

    try {
      const { transactions: prevTx } = await api.searchTransactions({
        start_date: prevStartDate.toISOString().split('T')[0],
        end_date: prevEndDate.toISOString().split('T')[0],
        limit: 10000,
      });

      const prevBillsRaw = prevTx
        .filter((tx: any) => {
          const categoryName = getCategoryName(tx);
          return tx.transaction_type === 'expense' && 
                 tx.amount > 0 &&
                 (tx.is_recurring || 
                  categoryName === 'Bills & Utilities' || 
                  categoryName === 'Bills and Utilities');
        })
        .reduce((sum: number, tx: any) => sum + tx.amount, 0);
      const prevBills = Math.round(prevBillsRaw * 100) / 100;
      
      // Previous period spending should use the same filter as current period
      // (exclude Income and Transfer categories)
      const prevSpendingRaw = prevTx
        .filter((tx: any) => {
          const categoryName = getCategoryName(tx);
          return tx.transaction_type === 'expense' && 
                 tx.amount > 0 && 
                 categoryName !== 'Income' && 
                 categoryName !== 'Transfer';
        })
        .reduce((sum: number, tx: any) => sum + tx.amount, 0);
      const prevSpending = Math.round(prevSpendingRaw * 100) / 100;

      setSummaryData({
        income,
        bills,
        spending,
        incomeCount,
        billsChange: bills - prevBills,
        spendingChange: spending - prevSpending,
      });
    } catch (error) {
      console.error('Error calculating summary:', error);
      setSummaryData({
        income,
        bills,
        spending,
        incomeCount,
        billsChange: 0,
        spendingChange: 0,
      });
    }
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

  // Use the spending value from summaryData to ensure consistency across all displays
  const totalSpend = summaryData.spending || categoryData.reduce((sum, cat) => sum + cat.spend, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Spending</h1>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('lastMonth')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'lastMonth' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Last Month
        </button>
        <button 
          onClick={() => setActiveTab('thisMonth')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'thisMonth' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          This Month
        </button>
        <button 
          onClick={() => {
            setActiveTab('custom');
            // Auto-select monthly when switching to custom tab if no period is selected
            if (!customPeriod) {
              setCustomPeriod('monthly');
            }
          }}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'custom' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Custom
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Custom Date Range Picker */}
          {activeTab === 'custom' ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Select Time Period</h3>
                <div className="space-y-3">
                  <button 
                    onClick={() => setCustomPeriod('weekly')}
                    className={`w-full text-left px-4 py-3 border rounded-lg flex items-center justify-between transition-colors ${
                      customPeriod === 'weekly'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      customPeriod === 'weekly' ? 'text-red-900' : 'text-gray-900'
                    }`}>Weekly</span>
                    <span className="text-gray-400">›</span>
                  </button>
                  <button 
                    onClick={() => setCustomPeriod('monthly')}
                    className={`w-full text-left px-4 py-3 border rounded-lg flex items-center justify-between transition-colors ${
                      customPeriod === 'monthly'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      customPeriod === 'monthly' ? 'text-red-900' : 'text-gray-900'
                    }`}>Monthly</span>
                    <span className="text-gray-400">›</span>
                  </button>
                  <button 
                    onClick={() => setCustomPeriod('quarterly')}
                    className={`w-full text-left px-4 py-3 border rounded-lg flex items-center justify-between transition-colors ${
                      customPeriod === 'quarterly'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      customPeriod === 'quarterly' ? 'text-red-900' : 'text-gray-900'
                    }`}>Quarterly</span>
                    <span className="text-gray-400">›</span>
                  </button>
                  <button 
                    onClick={() => setCustomPeriod('yearly')}
                    className={`w-full text-left px-4 py-3 border rounded-lg flex items-center justify-between transition-colors ${
                      customPeriod === 'yearly'
                        ? 'border-red-600 bg-red-50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      customPeriod === 'yearly' ? 'text-red-900' : 'text-gray-900'
                    }`}>Yearly</span>
                    <span className="text-gray-400">›</span>
                  </button>
                </div>
              </div>
              
              {/* Show charts and breakdown when a period is selected */}
              {customPeriod && (
                <>
                  {/* Spending Chart */}
                  {monthlySpending.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm p-6">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">
                        {activeTab === 'custom' && customPeriod === 'weekly' 
                          ? 'Daily Spending' 
                          : activeTab === 'custom' && customPeriod === 'monthly'
                          ? 'Daily Spending'
                          : activeTab === 'custom' && customPeriod === 'quarterly'
                          ? 'Quarterly Spending'
                          : activeTab === 'custom' && customPeriod === 'yearly'
                          ? 'Yearly Spending'
                          : 'Monthly Spending'}
                      </h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={monthlySpending}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="month" stroke="#888" />
                          <YAxis stroke="#888" />
                          <Tooltip 
                            formatter={(value: number) => `$${value.toFixed(2)}`}
                            labelFormatter={(label: string) => `${label} amount`}
                          />
                          <Bar dataKey="amount" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Spending Breakdown */}
                  <div className="bg-white rounded-2xl shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-gray-900">Spending Breakdown</h3>
                    </div>

                    {categoryData.length === 0 ? (
                      <p className="text-center py-12 text-gray-500">No spending data available for this period</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        {/* Pie Chart */}
                        <div className="flex justify-center">
                          <div className="relative">
                            <ResponsiveContainer width={300} height={300}>
                              <PieChart>
                                <Pie
                                  data={categoryData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={80}
                                  outerRadius={120}
                                  paddingAngle={2}
                                  dataKey="spend"
                                >
                                  {categoryData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                              <div className="text-3xl font-bold text-gray-900">${totalSpend.toLocaleString()}</div>
                              <div className="text-sm text-gray-600">Total Spend</div>
                            </div>
                          </div>
                        </div>

                        {/* Category List */}
                        <div className="space-y-3">
                          {categoryData.map((category, index) => (
                            <div key={index} className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: category.color }}>
                                  <span className="text-white text-xs">📊</span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-gray-900">{category.name}</p>
                                    <p className="text-xs text-gray-600 ml-2">{category.percent}% of spend</p>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-4">
                                <p className="text-sm font-medium text-gray-900">${category.spend.toLocaleString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
          {/* Spending Chart */}
          {monthlySpending.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Spending</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={monthlySpending}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip 
                    formatter={(value: number) => `$${value.toFixed(2)}`}
                    labelFormatter={(label: string) => `${label} amount`}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Spending Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Spending Breakdown</h3>
            </div>

            {categoryData.length === 0 ? (
              <p className="text-center py-12 text-gray-500">No spending data available for this period</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                {/* Pie Chart */}
                <div className="flex justify-center">
                  <div className="relative">
                    <ResponsiveContainer width={300} height={300}>
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="spend"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                      <div className="text-3xl font-bold text-gray-900">${totalSpend.toLocaleString()}</div>
                      <div className="text-sm text-gray-600">Total Spend</div>
                    </div>
                  </div>
                </div>

                {/* Category List */}
                <div className="space-y-3">
                  {categoryData.map((category, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: category.color }}>
                          <span className="text-white text-xs">📊</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-900">{category.name}</p>
                            <p className="text-xs text-gray-600 ml-2">{category.percent}% of spend</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <p className="text-sm font-medium text-gray-900">${category.spend.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">
              {activeTab === 'lastMonth' 
                ? 'Last Month' 
                : activeTab === 'thisMonth' 
                ? 'This Month' 
                : customPeriod 
                ? customPeriod.charAt(0).toUpperCase() + customPeriod.slice(1)
                : 'Custom Period'}
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Income</p>
                <p className="text-xl font-bold text-gray-900">${summaryData.income.toLocaleString()}</p>
                <p className="text-xs text-gray-600">{summaryData.incomeCount} income event{summaryData.incomeCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-600 mb-1">Bills</p>
                <p className="text-xl font-bold text-gray-900">${summaryData.bills.toLocaleString()}</p>
                <p className="text-xs text-gray-600">
                  {summaryData.billsChange > 0 ? '+' : ''}${Math.abs(summaryData.billsChange).toLocaleString()} {summaryData.billsChange > 0 ? 'more' : 'less'} than last period
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-600 mb-1">Spending</p>
                <p className="text-xl font-bold text-gray-900">${summaryData.spending.toLocaleString()}</p>
                <p className="text-xs text-gray-600">
                  {summaryData.spendingChange > 0 ? '+' : ''}${Math.abs(summaryData.spendingChange).toLocaleString()} {summaryData.spendingChange > 0 ? 'more' : 'less'} than last period
                </p>
              </div>
            </div>
          </div>

          {/* Frequent Spend */}
          {frequentMerchants.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Frequent Spend</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your top {frequentMerchants.length} merchant{frequentMerchants.length !== 1 ? 's' : ''} this period.
              </p>
              <div className="space-y-4">
                {frequentMerchants.map((merchant, index) => (
                  <div key={index}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {merchant.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{merchant.name}</p>
                        <p className="text-xs text-gray-600">Average ${merchant.average.toFixed(2)}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">${merchant.amount.toFixed(2)}</p>
                    </div>
                    {index < frequentMerchants.length - 1 && <div className="border-t border-gray-100 mt-4" />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Largest Purchases */}
          {largestPurchases.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Largest Purchases</h3>
              <p className="text-sm text-gray-600 mb-4">
                Your top {largestPurchases.length} expense{largestPurchases.length !== 1 ? 's' : ''} this period.
              </p>
              <div className="space-y-3">
                {largestPurchases.map((purchase, index) => (
                  <div key={index}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {purchase.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{purchase.name}</p>
                        <p className="text-xs text-gray-600">{purchase.date}</p>
                      </div>
                      <p className="text-sm font-medium text-gray-900">${purchase.amount.toLocaleString()}</p>
                    </div>
                    {index < largestPurchases.length - 1 && <div className="border-t border-gray-100 mt-3 pt-3" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Spending;
