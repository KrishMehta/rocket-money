import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Link } from 'react-router-dom';
import { api } from '../utils/api';

const NetWorth = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'assets' | 'debt'>('summary');
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [netWorthData, setNetWorthData] = useState<any[]>([]);
  const [totalAssets, setTotalAssets] = useState(0);
  const [totalDebts, setTotalDebts] = useState(0);
  const [netWorth, setNetWorth] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'1M' | '3M' | '6M' | '1Y' | 'ALL'>('6M');

  useEffect(() => {
    loadNetWorthData();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      calculateHistoricalNetWorth(accounts, selectedPeriod).catch(console.error);
    }
  }, [selectedPeriod, accounts]);

  const loadNetWorthData = async () => {
    try {
      setLoading(true);
      const { accounts: accountsData } = await api.getAccounts();
      setAccounts(accountsData || []);

      // Calculate totals
      calculateTotals(accountsData || []);
      
      // Calculate historical net worth based on selected period
      await calculateHistoricalNetWorth(accountsData || [], selectedPeriod);

    } catch (error) {
      console.error('Error loading net worth data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = (accountsData: any[]) => {
    let assets = 0;
    let debts = 0;

    accountsData.forEach((account: any) => {
      const balance = account.balance_current || 0;
      
      // Assets: depository (checking, savings), investment
      if (account.type === 'depository' || account.type === 'investment') {
        assets += Math.abs(balance);
      }
      // Debts: credit cards, loans
      else if (account.type === 'credit' || account.type === 'loan') {
        debts += Math.abs(balance);
      }
    });

    setTotalAssets(assets);
    setTotalDebts(debts);
    setNetWorth(assets - debts);
  };

  const calculateHistoricalNetWorth = async (accountsData: any[], _period: '1M' | '3M' | '6M' | '1Y' | 'ALL' = '6M') => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const chartData = [];
    
    // Get current net worth
    const currentAssets = accountsData
      .filter(a => a.type === 'depository' || a.type === 'investment')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);
    
    const currentDebts = accountsData
      .filter(a => a.type === 'credit' || a.type === 'loan')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);
    
    const currentNetWorth = currentAssets - currentDebts;

    // Only show data we actually have - just the current month
    // In the future, if we have historical balance snapshots, we can add those here
    if (accountsData.length > 0 && currentNetWorth !== 0) {
      const monthName = months[now.getMonth()];
      chartData.push({
        month: monthName,
        value: currentNetWorth, // Keep as decimal for accurate display
      });
    }

    setNetWorthData(chartData);
  };

  const getAssetsByType = () => {
    const assetAccounts = accounts.filter(a => 
      a.type === 'depository' || a.type === 'investment'
    );

    const checkingTotal = assetAccounts
      .filter(a => a.subtype === 'checking')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);
    
    const savingsTotal = assetAccounts
      .filter(a => a.subtype === 'savings')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);
    
    const investmentTotal = assetAccounts
      .filter(a => a.type === 'investment')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);

    const cashTotal = checkingTotal;

    const total = checkingTotal + savingsTotal + investmentTotal;

    return [
      { name: 'Assets with Loans', percent: 0, amount: 0 },
      investmentTotal > 0 && { 
        name: 'Investments', 
        percent: total > 0 ? Math.round((investmentTotal / total) * 100) : 0, 
        amount: investmentTotal 
      },
      savingsTotal > 0 && { 
        name: 'Savings', 
        percent: total > 0 ? Math.round((savingsTotal / total) * 100) : 0, 
        amount: savingsTotal 
      },
      cashTotal > 0 && { 
        name: 'Cash', 
        percent: total > 0 ? Math.round((cashTotal / total) * 100) : 0, 
        amount: cashTotal 
      },
      { name: 'Other Assets', percent: 0, amount: 0 },
    ].filter(Boolean);
  };

  const getDebtsByType = () => {
    const debtAccounts = accounts.filter(a => 
      a.type === 'credit' || a.type === 'loan'
    );

    const creditCardTotal = debtAccounts
      .filter(a => a.type === 'credit')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);
    
    const loanTotal = debtAccounts
      .filter(a => a.type === 'loan')
      .reduce((sum, a) => sum + Math.abs(a.balance_current || 0), 0);

    const total = creditCardTotal + loanTotal;

    return [
      loanTotal > 0 && { 
        name: 'Asset Backed Loans', 
        percent: total > 0 ? Math.round((loanTotal / total) * 100) : 0, 
        amount: loanTotal 
      },
      creditCardTotal > 0 && { 
        name: 'Credit Cards', 
        percent: total > 0 ? Math.round((creditCardTotal / total) * 100) : 0, 
        amount: creditCardTotal 
      },
      { name: 'Long Term Debts', percent: 0, amount: 0 },
      { name: 'Other Debts', percent: 0, amount: 0 },
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

  const assets = getAssetsByType();
  const debts = getDebtsByType();

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Net Worth</h1>
        <div className="flex gap-3">
          <Link to="/connect-accounts">
            <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
              Add Account
            </button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'summary' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Summary
        </button>
        <button 
          onClick={() => setActiveTab('assets')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'assets' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Assets
        </button>
        <button 
          onClick={() => setActiveTab('debt')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'debt' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Debt
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Net Worth Chart - Only show on Summary tab */}
          {activeTab === 'summary' && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-2">Total net worth</p>
                <h2 className="text-4xl font-bold text-gray-900 mb-3">
                  ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                {netWorthData.length >= 2 && (
                  <div className="flex items-center gap-2">
                    {netWorthData[netWorthData.length - 1].value > netWorthData[0].value ? (
                      <>
                        <span className="text-green-600">↑</span>
                        <p className="text-sm text-gray-600">
                          Up ${(netWorthData[netWorthData.length - 1].value - netWorthData[0].value).toLocaleString()} over the last 6 months
                        </p>
                      </>
                    ) : (
                      <>
                        <span className="text-red-600">↓</span>
                        <p className="text-sm text-gray-600">
                          Down ${Math.abs(netWorthData[netWorthData.length - 1].value - netWorthData[0].value).toLocaleString()} over the last 6 months
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {netWorthData.length > 0 && (
                <>
                  <div className="mb-4">
                    <div className="flex gap-2 justify-end">
                      {(['1M', '3M', '6M', '1Y', 'ALL'] as const).map((period) => (
                        <button
                          key={period}
                          onClick={() => setSelectedPeriod(period)}
                          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                            period === selectedPeriod
                              ? 'bg-gray-900 text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {period}
                        </button>
                      ))}
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={netWorthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip 
                        formatter={(value: number) => `$${value.toFixed(2)}`}
                      />
                      {/* If there's only one data point, draw a horizontal line */}
                      {netWorthData.length === 1 && (
                        <ReferenceLine 
                          y={netWorthData[0].value} 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          strokeDasharray="0"
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
          )}

          {/* Assets */}
          {(activeTab === 'summary' || activeTab === 'assets') && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Assets</h3>
                {accounts.filter(a => a.type === 'depository' || a.type === 'investment').length > 0 && (
                  <p className="text-sm text-gray-600">
                    {accounts.filter(a => a.type === 'depository' || a.type === 'investment').length} account{accounts.filter(a => a.type === 'depository' || a.type === 'investment').length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

            {assets.length === 0 || totalAssets === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-3">No assets connected yet</p>
                <Link to="/connect-accounts">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                    Connect Accounts
                  </button>
                </Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {assets.map((asset: any, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        asset.percent > 0 ? 'hover:bg-gray-50 cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 text-xl">
                            {asset.name.includes('Savings') ? '💰' : asset.name.includes('Cash') ? '💵' : '📊'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{asset.name}</p>
                          <p className="text-xs text-gray-600">{asset.percent}% of assets</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          ${asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {asset.percent > 0 && <span className="text-gray-400">›</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <Link to="/connect-accounts">
                    <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                      View all assets
                    </button>
                  </Link>
                  <h4 className="text-2xl font-bold text-gray-900">
                    ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h4>
                </div>
              </>
            )}
            </div>
          )}

          {/* Debts */}
          {(activeTab === 'summary' || activeTab === 'debt') && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Debt</h3>
                {accounts.filter(a => a.type === 'credit' || a.type === 'loan').length > 0 && (
                  <p className="text-sm text-gray-600">
                    {accounts.filter(a => a.type === 'credit' || a.type === 'loan').length} account{accounts.filter(a => a.type === 'credit' || a.type === 'loan').length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>

            {debts.length === 0 || totalDebts === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No debts found - great job! 🎉</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {debts.map((debt: any, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-4 rounded-lg ${
                        debt.percent > 0 ? 'hover:bg-gray-50 cursor-pointer' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                          <span className="text-red-600 text-xl">💳</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{debt.name}</p>
                          <p className="text-xs text-gray-600">{debt.percent}% of debts</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          ${debt.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {debt.percent > 0 && <span className="text-gray-400">›</span>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                  <Link to="/connect-accounts">
                    <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                      View all debts
                    </button>
                  </Link>
                  <h4 className="text-2xl font-bold text-gray-900">
                    ${totalDebts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </h4>
                </div>
              </>
            )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Complete accounts card */}
          {accounts.length === 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">Complete your financial picture</h3>
                <p className="text-sm text-gray-600">
                  To get a complete sense of your net worth, add all the accounts that make up your full financial picture.
                </p>
                <div className="flex gap-2 mb-4">
                  {['🏦', '💳', '💰', '📈', '🏠'].map((icon, i) => (
                    <div key={i} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">{icon}</span>
                    </div>
                  ))}
                </div>
                <Link to="/connect-accounts">
                  <button className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800">
                    Add more accounts
                  </button>
                </Link>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Summary</h3>
            <p className="text-sm text-gray-600 mb-6">
              This is how your net worth is calculated. Make sure all of your accounts are connected for an accurate summary.
            </p>

            <div className="space-y-4">
              {/* Assets */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-2xl">📈</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">Assets</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">
                    {accounts.filter(a => a.type === 'depository' || a.type === 'investment').length} account{accounts.filter(a => a.type === 'depository' || a.type === 'investment').length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Debts */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 text-2xl">📉</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">Debts</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${totalDebts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">
                    {accounts.filter(a => a.type === 'credit' || a.type === 'loan').length} account{accounts.filter(a => a.type === 'credit' || a.type === 'loan').length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Net Worth */}
              <div className="flex items-center gap-4 pt-4 border-t border-gray-200">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 text-2xl">💎</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900">Net Worth</p>
                    <p className="text-lg font-bold text-gray-900">
                      ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">Assets - Debts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetWorth;
