import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Recurring = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'viewAll' | 'calendar'>('upcoming');
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

  // All items combined for Upcoming view
  const allItems = [
    { name: 'Paramount+', frequency: 'Monthly', account: '••1008', dueInDays: 3, amount: 12.99, type: 'subscription' },
    { name: 'OpenAI', frequency: 'Monthly', account: '••4221', dueInDays: 9, amount: 20.00, type: 'subscription' },
    { name: 'CURSOR, AI POWERED IDE', frequency: 'Monthly', account: '••4221', dueInDays: 17, amount: 20.00, type: 'subscription' },
    { name: 'AT&T', frequency: 'Monthly', account: '••4221', dueInDays: 28, amount: 164.44, type: 'bill' },
  ];

  const next7Days = allItems.filter(item => item.dueInDays <= 7);
  const comingLater = allItems.filter(item => item.dueInDays > 7);

  // Calendar data for October 2025
  const calendarEvents = [
    { date: 1, name: 'Paramount+', amount: 12.99 },
    { date: 2, name: 'CURSOR, AI POWERED IDE', amount: 464.96 },
    { date: 7, name: 'OpenAI', amount: 20.00 },
    { date: 15, name: 'CURSOR, AI POWERED IDE', amount: 20.00 },
    { date: 17, name: 'Credit Card Membership Fee', amount: 895.00 },
    { date: 20, name: 'American Express Card Payment', amount: 3326.34 },
    { date: 21, name: 'Chase Credit Card', amount: 340.88 },
    { date: 26, name: 'AT&T', amount: 164.44 },
  ];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const year = 2025;
    const month = 9; // October (0-indexed)
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    const prevMonthDays = firstDay === 0 ? 6 : firstDay - 1; // Adjust for Monday start
    
    // Previous month days
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const prevMonthDate = new Date(year, month, -i);
      days.push({ date: prevMonthDate.getDate(), currentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: i, currentMonth: true });
    }
    
    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ date: i, currentMonth: false });
    }
    
    return days;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Recurring</h1>

      {/* Tabs */}
      <div className="flex gap-6 mb-6 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'upcoming' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Upcoming
        </button>
        <button 
          onClick={() => setActiveTab('viewAll')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'viewAll' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          View All
        </button>
        <button 
          onClick={() => setActiveTab('calendar')}
          className={`px-4 py-3 text-sm font-medium ${
            activeTab === 'calendar' 
              ? 'text-gray-900 border-b-2 border-red-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Calendar
        </button>
      </div>

      {/* Upcoming View - Full Width */}
      {activeTab === 'upcoming' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left side - List */}
              <div className="space-y-6">
                {/* Next 7 Days */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Next 7 Days</h3>
                    <p className="text-sm text-gray-600">1 charge for $12.99</p>
                  </div>
                  <div className="space-y-3">
                    {next7Days.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {item.name.substring(0, 2)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-600">in {item.dueInDays} days</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              {item.account}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">${item.amount}</span>
                          <button className="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Coming Later */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Coming Later</h3>
                    <p className="text-sm text-gray-600">3 charges for $204.44</p>
                  </div>
                  <div className="space-y-3">
                    {comingLater.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 ${item.type === 'bill' ? 'bg-blue-600' : 'bg-gray-700'} rounded-full flex items-center justify-center text-white font-bold text-xs relative`}>
                            {item.name.substring(0, 2)}
                            {item.type === 'bill' && (
                              <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                                1
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.name}</p>
                            <p className="text-xs text-gray-600">in {item.dueInDays} days</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              {item.account}
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-900">${item.amount}</span>
                          <button className="text-gray-400 hover:text-gray-600">⋮</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right side - Mini Calendar + Bill Lowering */}
              <div className="space-y-6">
                {/* Mini Calendar */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-gray-900">October 2025</h3>
                  </div>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className="text-center text-xs font-medium text-gray-600 py-1">
                        {day.substring(0, 3)}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {renderCalendar().slice(0, 35).map((day, index) => {
                      const events = calendarEvents.filter(e => e.date === day.date && day.currentMonth);
                      const isToday = day.date === 29 && day.currentMonth;
                      
                      return (
                        <div
                          key={index}
                          className={`aspect-square flex items-center justify-center text-sm rounded-lg ${
                            day.currentMonth 
                              ? events.length > 0 
                                ? 'bg-blue-500 text-white font-bold' 
                                : isToday
                                ? 'bg-blue-600 text-white font-bold'
                                : 'text-gray-900'
                              : 'text-gray-400'
                          }`}
                        >
                          {day.date}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
      )}

      {/* Calendar View - Full Width */}
      {activeTab === 'calendar' && (
        <div className="bg-white rounded-2xl shadow-sm p-6 max-w-7xl">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <button className="text-gray-400 hover:text-gray-600">‹</button>
                  <h2 className="text-xl font-bold text-gray-900">October 2025</h2>
                  <button className="text-gray-400 hover:text-gray-600">›</button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-sm font-medium text-gray-600 py-2">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {renderCalendar().map((day, index) => {
                  const events = calendarEvents.filter(e => e.date === day.date && day.currentMonth);
                  const totalAmount = events.reduce((sum, e) => sum + e.amount, 0);
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-[100px] p-2 rounded-lg border ${
                        day.currentMonth 
                          ? 'bg-white border-gray-200' 
                          : 'bg-gray-50 border-gray-100'
                      } ${events.length > 0 ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${
                        day.currentMonth ? 'text-gray-900' : 'text-gray-400'
                      }`}>
                        {day.date}
                      </div>
                      {events.length > 0 && day.currentMonth && (
                        <div className="space-y-1">
                          {events.slice(0, 2).map((event, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs">{event.name.substring(0, 1)}</span>
                              </div>
                            </div>
                          ))}
                          {totalAmount > 0 && (
                            <div className="text-xs font-medium text-gray-900 mt-1">
                              ${totalAmount.toLocaleString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
      )}

      {/* View All View - With Sidebar */}
      {activeTab === 'viewAll' && (
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
      )}
    </div>
  );
};

export default Recurring;

