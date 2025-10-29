import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const NetWorth = () => {
  const [activeTab, setActiveTab] = useState<'summary' | 'assets' | 'debt'>('summary');
  const netWorthData = [
    { month: 'Apr', value: 0 },
    { month: 'May', value: 5000 },
    { month: 'Jun', value: 8000 },
    { month: 'Jul', value: 12000 },
    { month: 'Aug', value: 16000 },
    { month: 'Sep', value: 19936 },
  ];

  const assets = [
    { name: 'Assets with Loans', percent: 0, amount: 0 },
    { name: 'Investments', percent: 0, amount: 0 },
    { name: 'Savings', percent: 97, amount: 20000 },
    { name: 'Cash', percent: 3, amount: 545 },
    { name: 'Other Assets', percent: 0, amount: 0 },
  ];

  const debts = [
    { name: 'Asset Backed Loans', percent: 0, amount: 0 },
    { name: 'Credit Cards', percent: 100, amount: 610 },
    { name: 'Long Term Debts', percent: 0, amount: 0 },
    { name: 'Other Debts', percent: 0, amount: 0 },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Net Worth</h1>
        <div className="flex gap-3">
          <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
            Preferences
          </button>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800">
            Add Account
          </button>
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
                <h2 className="text-4xl font-bold text-gray-900 mb-3">$19,936</h2>
                <div className="flex items-center gap-2">
                  <span className="text-green-600">↑</span>
                  <p className="text-sm text-gray-600">Up $19,936 over the last 6 months</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex gap-2 justify-end">
                  {['1M', '3M', '6M', '1Y', 'ALL'].map((period) => (
                    <button
                      key={period}
                      className={`px-3 py-1 text-xs font-medium rounded ${
                        period === '6M'
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
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Assets */}
          {(activeTab === 'summary' || activeTab === 'assets') && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Assets</h3>
                <p className="text-sm text-gray-600">Your assets have remained about the same this month</p>
              </div>

            <div className="space-y-3">
              {assets.map((asset, index) => (
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
                      ${asset.amount.toLocaleString()}
                    </span>
                    {asset.percent > 0 && <span className="text-gray-400">›</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                View all assets
              </button>
              <h4 className="text-2xl font-bold text-gray-900">$20,546</h4>
            </div>
            </div>
          )}

          {/* Debts */}
          {(activeTab === 'summary' || activeTab === 'debt') && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Debt</h3>
                <p className="text-sm text-gray-600">Your debts have remained about the same this month</p>
              </div>

            <div className="space-y-3">
              {debts.map((debt, index) => (
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
                      ${debt.amount.toLocaleString()}
                    </span>
                    {debt.percent > 0 && <span className="text-gray-400">›</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
              <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                View all debts
              </button>
              <h4 className="text-2xl font-bold text-gray-900">$610</h4>
            </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Complete accounts card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-900">Complete accounts</h4>
              <button className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
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
              <button className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800">
                Add more accounts
              </button>
            </div>
          </div>

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
                    <p className="text-lg font-bold text-gray-900">$20,546</p>
                  </div>
                  <p className="text-xs text-gray-600">2 accounts</p>
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
                    <p className="text-lg font-bold text-gray-900">$610</p>
                  </div>
                  <p className="text-xs text-gray-600">4 accounts</p>
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
                    <p className="text-lg font-bold text-gray-900">$19,936</p>
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

