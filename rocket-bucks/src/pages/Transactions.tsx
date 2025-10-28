const Transactions = () => {
  const transactions = [
    { date: '10/26', name: 'Lyft', status: 'Pending', category: 'Auto & Transport', amount: 11.93 },
    { date: '10/26', name: 'City Of Charlottesvil', status: 'Pending', category: 'Bills & Utilities', amount: 1.50 },
    { date: '10/26', name: 'AT&T', status: '', category: 'Bills & Utilities', amount: 164.44 },
    { date: '10/23', name: 'Zelle Payment To Yellow Cab 2 Jpm99brx9azs', status: '', category: 'Uncategorized', amount: 5.00 },
    { date: '10/22', name: 'Sqsp* Worksp#206132292', status: '', category: 'Uncategorized', amount: 8.40 },
    { date: '10/22', name: 'Uber Eats', status: 'Pending', category: 'Dining & Drinks', amount: 20.00 },
    { date: '10/22', name: 'Uber One', status: 'Pending', category: 'Bills & Utilities', amount: 9.99 },
    { date: '10/22', name: 'Zelle Payment To Yellow Cab Jpm99brtfjpt', status: '', category: 'Auto & Transport', amount: 5.00 },
    { date: '10/21', name: 'Payment Thank You-mobile', status: '', category: 'Credit Card Payment', amount: -340.88 },
    { date: '10/21', name: 'Uber Eats', status: '', category: 'Dining & Drinks', amount: 12.79 },
    { date: '10/21', name: 'Uber Eats', status: 'Pending', category: 'Dining & Drinks', amount: 20.00 },
    { date: '10/21', name: '7-Eleven', status: 'Pending', category: 'Shopping', amount: 16.79 },
    { date: '10/21', name: 'Delta Airlines', status: 'Pending', category: 'Travel & Vacation', amount: 377.63 },
    { date: '10/21', name: 'Venmo', status: '', category: 'Uncategorized', amount: 60.00 },
    { date: '10/21', name: 'Chase Credit Card', status: '', category: 'Credit Card Payment', amount: -340.88 },
  ];

  const categoryIcons: { [key: string]: string } = {
    'Auto & Transport': '🚗',
    'Bills & Utilities': '📋',
    'Dining & Drinks': '🍽️',
    'Shopping': '🛍️',
    'Travel & Vacation': '✈️',
    'Uncategorized': '❓',
    'Credit Card Payment': '💳',
  };

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
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
          </div>
          
          <select className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700">
            <option>All dates</option>
            <option>This month</option>
            <option>Last month</option>
            <option>Last 3 months</option>
          </select>

          <select className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700">
            <option>All categories</option>
            <option>Auto & Transport</option>
            <option>Bills & Utilities</option>
            <option>Dining & Drinks</option>
            <option>Shopping</option>
          </select>

          <select className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-700">
            <option>All accounts</option>
            <option>Checking ••4221</option>
            <option>Credit Card ••1008</option>
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
              {transactions.map((transaction, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <input type="checkbox" className="rounded" />
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-900">{transaction.date}</td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                        {transaction.name.substring(0, 2)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{transaction.name}</p>
                        {transaction.status && (
                          <span className="text-xs text-gray-500">| {transaction.status}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{categoryIcons[transaction.category]}</span>
                      <span className="text-sm text-gray-900">{transaction.category}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-center gap-2">
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        ✏️
                      </button>
                      <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
                        🔄
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <span className={`text-sm font-medium ${
                      transaction.amount < 0 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      {transaction.amount < 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                    </span>
                    <button className="ml-2 text-gray-400 hover:text-gray-600">›</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-600">Showing 1-15 of 110 transactions</p>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white disabled:opacity-50" disabled>
              Previous
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-white">
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

