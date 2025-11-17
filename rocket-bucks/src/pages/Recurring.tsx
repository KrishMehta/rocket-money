import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../utils/api';

const Recurring = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'viewAll' | 'calendar'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    loadRecurringData();
  }, []);

  const loadRecurringData = async () => {
    try {
      setLoading(true);
      // Don't filter by active_only to see all recurring charges
      const { recurring } = await api.getRecurring({});
      
      // Filter out interest payments
      const filteredRecurring = (recurring || []).filter((r: any) => {
        const name = (r.name || '').toLowerCase();
        return !name.includes('interest') && !name.includes('interest payment');
      });
      
      setRecurringTransactions(filteredRecurring);
      
      // Calculate monthly breakdown
      calculateMonthlyBreakdown(filteredRecurring);
    } catch (error) {
      console.error('Error loading recurring data:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncRecurringFromPlaid = async () => {
    try {
      setSyncing(true);
      setSyncMessage(null);
      console.log('🔄 Syncing recurring transactions from Plaid...');
      
      const result = await api.syncRecurringTransactions();
      
      console.log('✅ Recurring transactions synced:', result.message);
      setSyncMessage(`✅ ${result.message}`);
      
      // Reload recurring data
      loadRecurringData();
    } catch (error: any) {
      console.error('❌ Error syncing recurring transactions:', error);
      setSyncMessage(`❌ ${error.message || 'Failed to sync recurring transactions'}`);
    } finally {
      setSyncing(false);
    }
  };

  const calculateMonthlyBreakdown = (recurring: any[]) => {
    // Create last 6 months of data
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const chartData = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = months[date.getMonth()];
      
      // Calculate subscriptions and bills for this month
      const subscriptions = recurring
        .filter(r => r.is_subscription)
        .reduce((sum, r) => sum + (r.expected_amount || 0), 0);
      
      const bills = recurring
        .filter(r => !r.is_subscription)
        .reduce((sum, r) => sum + (r.expected_amount || 0), 0);
      
      chartData.push({
        month: monthName,
        subscriptions,
        bills,
      });
    }
    
    setMonthlyData(chartData);
  };

  const groupByType = () => {
    // Common subscription merchant names/keywords for fallback classification
    const subscriptionKeywords = [
      'cursor', 'openai', 'apple', 'squarespace', 'workspace', 'worksp', 'spotify', 'netflix',
      'disney', 'hulu', 'amazon prime', 'youtube premium', 'adobe', 'microsoft',
      'google', 'dropbox', 'slack', 'zoom', 'notion', 'figma', 'canva', 'github',
      'gitlab', 'atlassian', 'jira', 'confluence', 'salesforce', 'hubspot', 'zendesk',
      'intercom', 'mailchimp', 'sendgrid', 'twilio', 'stripe', 'paypal', 'shopify',
      'wix', 'wordpress', 'webflow', 'framer', 'linear', 'vercel', 'netlify',
      'cloudflare', 'aws', 'azure', 'gcp', 'digitalocean', 'heroku', 'mongodb',
      'redis', 'elastic', 'datadog', 'sentry', 'new relic', 'loggly', 'papertrail'
    ];
    
    // Helper function to check if a transaction is a subscription
    const isSubscription = (r: any) => {
      // First check the is_subscription flag
      if (r.is_subscription) return true;
      
      // Fallback: check merchant name for subscription keywords
      const merchantName = (r.name || r.merchant_name || '').toLowerCase();
      return subscriptionKeywords.some(keyword => merchantName.includes(keyword));
    };
    
    const subscriptions = recurringTransactions.filter(r => isSubscription(r));
    const bills = recurringTransactions.filter(r => !isSubscription(r) && r.transaction_type === 'expense');
    const creditCards = recurringTransactions.filter(r => r.name?.toLowerCase().includes('credit card'));
    
    return { subscriptions, bills, creditCards };
  };

  const getUpcomingCharges = () => {
    const upcoming = recurringTransactions.filter(r => 
      r.days_until_due !== undefined && r.days_until_due >= 0
    );
    
    const next7Days = upcoming.filter(r => r.days_until_due <= 7);
    const comingLater = upcoming.filter(r => r.days_until_due > 7 && r.days_until_due <= 30);
    
    return { next7Days, comingLater };
  };

  const { subscriptions, bills, creditCards } = groupByType();
  const { next7Days, comingLater } = getUpcomingCharges();

  // Calendar data - map recurring to calendar events
  const getCalendarEvents = () => {
    return recurringTransactions
      .filter(r => {
        // Exclude interest payments
        const name = (r.name || '').toLowerCase();
        return r.next_due_date && !name.includes('interest') && !name.includes('interest payment');
      })
      .map(r => {
        const date = new Date(r.next_due_date);
        return {
          date: date.getDate(),
          month: date.getMonth(),
          year: date.getFullYear(),
          name: r.name,
          amount: r.expected_amount || 0,
        };
      });
  };

  const calendarEvents = getCalendarEvents();

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

  if (loading) {
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
        <h1 className="text-3xl font-bold text-gray-900">Recurring</h1>
        <button 
          onClick={syncRecurringFromPlaid}
          disabled={syncing}
          className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          title="Sync recurring charges from Plaid"
        >
          <span className={syncing ? 'animate-spin' : ''}>🔄</span>
          {syncing ? 'Syncing...' : 'Sync Recurring'}
        </button>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className={`mb-6 rounded-lg p-4 ${
          syncMessage.startsWith('✅') 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center justify-between">
            <p className="text-sm">{syncMessage}</p>
            <button 
              onClick={() => setSyncMessage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
                    <p className="text-sm text-gray-600">
                      {next7Days.length} charge{next7Days.length !== 1 ? 's' : ''} for ${next7Days.reduce((sum, r) => sum + (r.expected_amount || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  {next7Days.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-8">No charges in the next 7 days</p>
                  ) : (
                    <div className="space-y-3">
                      {next7Days.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                              {item.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-600">{item.due_in}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.accounts && (
                              <div className="text-right">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  ••••{item.accounts.mask}
                                </div>
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900">${(item.expected_amount || 0).toFixed(2)}</span>
                            <button className="text-gray-400 hover:text-gray-600">⋮</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coming Later */}
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Coming Later</h3>
                    <p className="text-sm text-gray-600">
                      {comingLater.length} charge{comingLater.length !== 1 ? 's' : ''} for ${comingLater.reduce((sum, r) => sum + (r.expected_amount || 0), 0).toFixed(2)}
                    </p>
                  </div>
                  {comingLater.length === 0 ? (
                    <p className="text-sm text-gray-600 text-center py-8">No upcoming charges</p>
                  ) : (
                    <div className="space-y-3">
                      {comingLater.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${!item.is_subscription ? 'bg-blue-600' : 'bg-gray-700'} rounded-full flex items-center justify-center text-white font-bold text-xs relative`}>
                              {item.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{item.name}</p>
                              <p className="text-xs text-gray-600">{item.due_in}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {item.accounts && (
                              <div className="text-right">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                  ••••{item.accounts.mask}
                                </div>
                              </div>
                            )}
                            <span className="text-sm font-medium text-gray-900">${(item.expected_amount || 0).toFixed(2)}</span>
                            <button className="text-gray-400 hover:text-gray-600">⋮</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
              <h3 className="text-lg font-bold text-gray-900">{subscriptions.length} Subscription{subscriptions.length !== 1 ? 's' : ''}</h3>
              <p className="text-sm text-gray-600">
                You spend ${(subscriptions.reduce((sum, s) => sum + (s.expected_amount || 0), 0) * 12).toFixed(2)}/yearly
              </p>
            </div>

            {subscriptions.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">No subscriptions found</p>
            ) : (
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
                              {sub.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{sub.name}</p>
                              <p className="text-xs text-gray-600">{sub.frequency || 'Monthly'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">
                              {sub.accounts ? `••••${sub.accounts.mask}` : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900">{sub.due_in || 'N/A'}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm font-medium text-gray-900">${(sub.expected_amount || 0).toFixed(2)}</span>
                            <button className="text-gray-400 hover:text-gray-600">⋮</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Bills & Utilities */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{bills.length} Bill{bills.length !== 1 ? 's' : ''} / Utilit{bills.length !== 1 ? 'ies' : 'y'}</h3>
              <p className="text-sm text-gray-600">
                You spend ${(bills.reduce((sum, b) => sum + (b.expected_amount || 0), 0) * 12).toFixed(2)}/yearly
              </p>
            </div>

            {bills.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">No bills found</p>
            ) : (
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
                                {bill.name.substring(0, 2).toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{bill.name}</p>
                              <p className="text-xs text-gray-600">{bill.frequency || 'Monthly'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-600">
                            {bill.accounts ? `••••${bill.accounts.mask}` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900">{bill.due_in || 'N/A'}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm font-medium text-gray-900">${(bill.expected_amount || 0).toFixed(2)}</span>
                            <button className="text-gray-400 hover:text-gray-600">⋮</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Credit Card Payments */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{creditCards.length} Credit Card Payment{creditCards.length !== 1 ? 's' : ''}</h3>
              <p className="text-sm text-gray-600">
                You spend ${(creditCards.reduce((sum, c) => sum + (c.expected_amount || 0), 0) * 12).toFixed(2)}/yearly
              </p>
            </div>

            {creditCards.length === 0 ? (
              <p className="text-sm text-gray-600 text-center py-8">No credit card payments found</p>
            ) : (
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
                              {card.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{card.name}</p>
                              <p className="text-xs text-gray-600">{card.frequency || 'Monthly'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm text-gray-600">
                            {card.accounts ? `••••${card.accounts.mask}` : 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-900">{card.due_in || 'N/A'}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-sm font-medium text-gray-900">${(card.expected_amount || 0).toLocaleString()}</span>
                            <button className="text-gray-400 hover:text-gray-600">⋮</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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

