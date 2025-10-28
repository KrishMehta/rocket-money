import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Spending = () => {
  const monthlySpending = [
    { month: 'May', amount: 0 },
    { month: 'Jun', amount: 2000 },
    { month: 'Jul', amount: 1500 },
    { month: 'Aug', amount: 3500 },
    { month: 'Sep', amount: 2000 },
    { month: 'Oct', amount: 8761 },
  ];

  const categoryData = [
    { name: 'Education', spend: 3399, percent: 48, color: '#f97316' },
    { name: 'Dining & Drinks', spend: 1640, percent: 17, color: '#3b82f6' },
    { name: 'Bills & Utilities', spend: 1070, percent: 12, color: '#06b6d4' },
    { name: 'Health & Wellness', spend: 734, percent: 8, color: '#8b5cf6' },
    { name: 'Shopping', spend: 644, percent: 8, color: '#ef4444' },
    { name: 'Auto & Transport', spend: 471, percent: 5, color: '#10b981' },
    { name: 'Software & Tech', spend: 251, percent: 3, color: '#f59e0b' },
    { name: 'Uncategorized', spend: 83, percent: 1, color: '#6b7280' },
  ];

  const frequentMerchants = [
    { name: 'Lyft', average: 325.38, amount: 325.82 },
    { name: 'Pan Iron Qiaji', average: 79.51, amount: 99.42 },
    { name: 'Uber Eats', average: 118.66, amount: 137.64 },
  ];

  const totalSpend = categoryData.reduce((sum, cat) => sum + cat.spend, 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Spending</h1>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
          Last Month
        </button>
        <button className="px-4 py-3 text-sm font-medium text-gray-900 border-b-2 border-red-600">
          This Month
        </button>
        <button className="px-4 py-3 text-sm font-medium text-gray-600 hover:text-gray-900">
          Custom
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Spending Chart */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Monthly Spending</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip />
                <Bar dataKey="amount" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Spending Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-gray-900">Spending Breakdown</h3>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" className="rounded" defaultChecked />
                Include Bills
              </label>
            </div>

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
                    <div className="text-3xl font-bold text-gray-900">${totalSpend.toLocaleString()}.49</div>
                    <div className="text-sm text-green-600">↑ 79% from last</div>
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
                      <span className="text-green-600 text-xs">↑ {category.percent}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Oct 1 - Oct 28</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Income</p>
                <p className="text-xl font-bold text-gray-900">$0</p>
                <p className="text-xs text-gray-600">0 income events</p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-600 mb-1">Bills</p>
                <p className="text-xl font-bold text-gray-900">$1,070.93</p>
                <p className="text-xs text-gray-600">$607 more than Sept</p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-600 mb-1">Spending</p>
                <p className="text-xl font-bold text-gray-900">$7,690.56</p>
                <p className="text-xs text-gray-600">$179 less than Sept</p>
              </div>
            </div>
          </div>

          {/* Frequent Spend */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Frequent Spend</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your top 3 expenses accounted for 55% of your spend this month, vs. 0 times last month.
            </p>
            <div className="space-y-4">
              {frequentMerchants.map((merchant, index) => (
                <div key={index}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {merchant.name.substring(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{merchant.name}</p>
                      <p className="text-xs text-gray-600">Average ${merchant.average}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">${merchant.amount}</p>
                  </div>
                  {index < frequentMerchants.length - 1 && <div className="border-t border-gray-100 mt-4" />}
                </div>
              ))}
            </div>
            <button className="mt-4 w-full py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300">
              See more
            </button>
          </div>

          {/* Largest Purchases */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Largest Purchases</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your top 3 expenses accounted for 55% of your spend this month.
            </p>
            <div className="space-y-3">
              {[
                { name: 'UVA Student Financial Ser', date: 'October 2', amount: 2388.00 },
                { name: 'Oura Ring', date: 'October 5', amount: 396.41 },
                { name: '13\" Mba GOODGOO4', date: 'October 8', amount: 266.84 },
              ].map((purchase, index) => (
                <div key={index}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {purchase.name.substring(0, 2)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{purchase.name}</p>
                      <p className="text-xs text-gray-600">{purchase.date}</p>
                    </div>
                    <p className="text-sm font-medium text-gray-900">${purchase.amount.toLocaleString()}</p>
                  </div>
                  {index < 2 && <div className="border-t border-gray-100 mt-3 pt-3" />}
                </div>
              ))}
            </div>
            <button className="mt-4 w-full py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors border border-gray-300">
              See more
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Spending;

