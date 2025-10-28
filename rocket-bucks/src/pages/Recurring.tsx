import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Recurring = () => {
  const monthlyData = [
    { month: 'Apr', subscriptions: 500, bills: 300 },
    { month: 'May', subscriptions: 480, bills: 320 },
    { month: 'Jun', subscriptions: 520, bills: 340 },
    { month: 'Jul', subscriptions: 510, bills: 310 },
    { month: 'Aug', subscriptions: 530, bills: 330 },
    { month: 'Sep', subscriptions: 550, bills: 350 },
    { month: 'Oct', subscriptions: 1100, bills: 0 },
  ];

  const subscriptions = [
    { name: 'Apple - App Store Subscriptions', frequency: 'Monthly', account: '••4221', due: 'in 13 days', amount: 2.99 },
    { name: 'Credit Card Membership Fee', frequency: 'Irregular', account: '••1008', due: '', amount: 895.00 },
    { name: 'CURSOR, AI POWERED IDE', frequency: 'Monthly', account: '••4221', due: 'in 18 days', amount: 20.00 },
    { name: 'OpenAI', frequency: 'Monthly', account: '••4221', due: 'in 10 days', amount: 20.00 },
    { name: 'Paramount+', frequency: 'Monthly', account: '••1008', due: 'in 4 days', amount: 12.99 },
  ];

  const bills = [
    { name: 'AT&T', frequency: 'Monthly', account: '••4221', due: 'in 29 days', amount: 164.44 },
  ];

  const creditCards = [
    { name: 'American Express Card Payment', frequency: 'Monthly', account: '••0125', due: 'in 1 month', amount: 1755 },
    { name: 'Chase Credit Card', frequency: 'Monthly', account: '••0125', due: 'in 1 month', amount: 340.88 },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Recurring</h1>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button className="px-4 py-3 text-sm font-medium text-gray-900 border-b-2 border-red-600">
          Upcoming
        </button>
        <button className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
          View All
        </button>
        <button className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
          Calendar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Search and filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search bills and subscriptions..."
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
            </div>
            <button className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              Sort by type ▼
            </button>
          </div>

          {/* Subscriptions */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">5 Subscriptions</h3>
              <p className="text-sm text-gray-600">You spend $1,567/yearly</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name/Frequency</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Account</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Due</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {sub.name.substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{sub.name}</p>
                            <p className="text-xs text-gray-600">{sub.frequency}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{sub.account}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">{sub.due}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm font-medium text-gray-900">${sub.amount}</span>
                          <button className="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bills & Utilities */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">1 Bill / Utility</h3>
              <p className="text-sm text-gray-600">You spend $1,973/yearly</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name/Frequency</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Account</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Due</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                              AT
                            </div>
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                              1
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{bill.name}</p>
                            <p className="text-xs text-gray-600">{bill.frequency}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{bill.account}</span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">{bill.due}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm font-medium text-gray-900">${bill.amount}</span>
                          <button className="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit Card Payments */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">2 Credit Card Payments</h3>
              <p className="text-sm text-gray-600">You spend $25,156/yearly</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Name/Frequency</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Account</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">Due</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {creditCards.map((card, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {card.name.substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{card.name}</p>
                            <p className="text-xs text-gray-600">{card.frequency}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm text-gray-600">{card.account}</span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-900">{card.due}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-sm font-medium text-gray-900">${card.amount.toLocaleString()}</span>
                          <button className="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button className="w-full py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300">
            Show 5 Inactive
          </button>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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

          {/* My requests */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                1
              </span>
              <h3 className="text-lg font-bold text-gray-900">My requests</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Below are your active bill negotiations and cancellations that our concierge team is working on for you.
            </p>
            <div className="bg-blue-50 rounded-lg p-4 flex gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                AT
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 mb-1">Bill Negotiation</p>
                <p className="text-xs text-gray-600">
                  We are currently working on your AT&T bill negotiation. You'll receive an update once it's complete.
                </p>
              </div>
            </div>
          </div>

          {/* Monthly Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Breakdown</h3>
            <p className="text-sm text-gray-600 mb-4">
              See how your recurring charges have changed over the past 6 months.
            </p>

            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#888" fontSize={12} />
                <YAxis stroke="#888" fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="subscriptions" fill="#3b82f6" name="Subscriptions" />
                <Bar dataKey="bills" fill="#ef4444" name="Bills & Utilities" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Recurring;

