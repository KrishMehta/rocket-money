import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const spendingData = [
    { month: 'May', amount: 42000 },
    { month: 'Jun', amount: 31300 },
    { month: 'Jul', amount: 20600 },
    { month: 'Aug', amount: 9860 },
    { month: 'Sep', amount: 8761 },
  ];

  const recentTransactions = [
    { date: '10/26', name: 'Lyft', status: 'Pending', amount: 11.93 },
    { date: '10/26', name: 'City Of Charlottesvil', status: 'Pending', amount: 1.50 },
    { date: '10/26', name: 'AT&T', status: '', amount: 164.44 },
    { date: '10/23', name: 'Zelle Payment To Yellow Cab', status: '', amount: 5.00 },
    { date: '10/22', name: 'Sqsp* Worksp#206132292', status: '', amount: 8.40 },
    { date: '10/22', name: 'Uber Eats', status: 'Pending', amount: 20.00 },
    { date: '10/22', name: 'Uber One', status: 'Pending', amount: 9.99 },
    { date: '10/22', name: 'Zelle Payment To Yellow Cab', status: '', amount: 5.00 },
    { date: '10/21', name: 'Payment Thank You-mobile', status: '', amount: -340.88 },
    { date: '10/21', name: 'Uber Eats', status: '', amount: 12.79 },
  ];

  const accounts = [
    { name: 'Checking', amount: 545, icon: '🏦' },
    { name: 'Credit Cards', amount: 610, icon: '💳', isDebt: true },
    { name: 'Net Cash', amount: -64, icon: '💵', isNegative: true },
    { name: 'Savings', amount: 20000, icon: '💰' },
    { name: 'Investments', amount: null, icon: '📈', isAdd: true },
  ];

  const upcomingCharges = [
    { name: 'Paramount+', days: 4, amount: 12.99 },
    { name: 'OpenAI', days: 10, amount: 20.00 },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Good evening, Krish</h1>

      {/* Connect Accounts Banner */}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current spend card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-2">Current spend this month</p>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">$8,761</h2>
            
            <div className="flex items-center gap-2 mb-4">
              <span className="text-green-600">✓</span>
              <p className="text-sm text-gray-600">
                You've spent <span className="font-semibold">$33,033 less</span> than last month
              </p>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={spendingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: '#ef4444' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Recent Transactions</h3>
                <p className="text-sm text-gray-600">You've had 110 transactions so far this month</p>
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
                  {recentTransactions.map((transaction, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-gray-900">{transaction.date}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">
                        {transaction.name}
                        {transaction.status && (
                          <span className="ml-2 text-gray-500">| {transaction.status}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-medium">
                        {transaction.amount > 0 ? (
                          <span className="text-gray-900">${transaction.amount.toFixed(2)}</span>
                        ) : (
                          <span className="text-green-600">+${Math.abs(transaction.amount).toFixed(2)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="mt-4 w-full py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300">
              See more transactions
            </button>
          </div>

          {/* Lower your bills card */}
          <div className="bg-gradient-to-r from-purple-900 to-purple-800 rounded-2xl shadow-sm p-6 text-white">
            <h3 className="text-xl font-bold mb-2">Lower your bills</h3>
            <p className="text-sm text-purple-200 mb-6">
              We can help you optimize your bills, from cable & internet to auto insurance and student loans.
            </p>
            <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  P+
                </div>
                <div>
                  <p className="font-semibold">Paramount+</p>
                  <p className="text-sm text-purple-200">We can help you save up to 25% on this bill</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-white text-purple-900 rounded-lg font-medium hover:bg-gray-100">
                Lower this bill
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Accounts */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Accounts</h3>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>🕐 22 hours ago</span>
                <span>|</span>
                <button className="text-blue-600 hover:underline">Sync now</button>
              </div>
            </div>

            <div className="space-y-3">
              {accounts.map((account, index) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{account.icon}</span>
                    <span className="text-sm font-medium text-gray-900">{account.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {account.isAdd ? (
                      <span className="text-sm text-blue-600 font-medium">Add</span>
                    ) : (
                      <span className={`text-sm font-medium ${
                        account.isNegative ? 'text-red-600' : account.isDebt ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {account.amount !== null && `$${account.amount.toLocaleString()}`}
                      </span>
                    )}
                    <span className="text-gray-400">›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coming Up */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Coming Up</h3>
            <p className="text-sm text-gray-600 mb-4">
              You have 2 recurring charges due within the next 11 days for $32.99.
            </p>

            {/* Mini calendar */}
            <div className="grid grid-cols-7 gap-1 mb-4 text-center text-xs">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="text-gray-600 font-medium py-1">{day}</div>
              ))}
              {[26, 27, 28, 29, 30, 31, 1].map((date) => (
                <div key={date} className={`py-2 rounded ${date === 28 ? 'bg-blue-600 text-white font-bold' : 'text-gray-900'}`}>
                  {date}
                </div>
              ))}
              {[2, 3, 4, 5, 6, 7, 8].map((date) => (
                <div key={date} className="py-2 text-gray-900">{date}</div>
              ))}
            </div>

            <div className="space-y-3">
              {upcomingCharges.map((charge, index) => (
                <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {charge.name.substring(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{charge.name}</p>
                      <p className="text-xs text-gray-600">in {charge.days} days</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-900">${charge.amount}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel subscription card */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-sm p-6 text-white">
            <h4 className="font-bold mb-2">Looking to cancel a subscription?</h4>
            <p className="text-sm text-gray-300 mb-4">
              Our concierge team can cancel your unwanted subscriptions for you.
            </p>
            <button className="w-full py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100">
              Start a cancellation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

