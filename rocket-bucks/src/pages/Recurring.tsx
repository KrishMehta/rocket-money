import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { api } from '../utils/api';

const Recurring = () => {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'viewAll' | 'calendar'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [recurringTransactions, setRecurringTransactions] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'type' | 'name' | 'amount' | 'due'>('type');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  useEffect(() => {
    loadRecurringData();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showSortDropdown && !target.closest('.sort-dropdown-container')) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSortDropdown]);

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

  
  // Helper function to calculate yearly amount based on frequency
  const calculateYearlyAmount = (amount: number, frequency: string): number => {
    if (!amount || !frequency) return 0;
    
    const freqLower = frequency.toLowerCase();
    
    if (freqLower.includes('daily')) {
      return amount * 365;
    } else if (freqLower.includes('weekly')) {
      return amount * 52;
    } else if (freqLower.includes('biweekly') || freqLower.includes('bi-weekly')) {
      return amount * 26;
    } else if (freqLower.includes('monthly') || freqLower.includes('approximately_monthly')) {
      return amount * 12;
    } else if (freqLower.includes('bimonthly') || freqLower.includes('bi-monthly')) {
      return amount * 6;
    } else if (freqLower.includes('quarterly')) {
      return amount * 4;
    } else if (freqLower.includes('annually') || freqLower.includes('yearly')) {
      return amount;
    } else {
      // Default to monthly if frequency is unknown
      return amount * 12;
    }
  };

  const calculateMonthlyBreakdown = (recurring: any[]) => {
    // Common subscription merchant names/keywords for classification
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
    
    // Helper function to check if a transaction is a subscription (same as groupByType)
    const isSubscription = (r: any) => {
      if (r.is_subscription) return true;
      const merchantName = (r.name || r.merchant_name || '').toLowerCase();
      return subscriptionKeywords.some(keyword => merchantName.includes(keyword));
    };
    
    // Helper function to check if a recurring transaction occurs in a specific month
    const occursInMonth = (r: any, monthStart: Date, monthEnd: Date): boolean => {
      const freqLower = (r.frequency || 'monthly').toLowerCase();
      const startDate = r.start_date ? new Date(r.start_date) : null;
      const lastDate = r.last_transaction_date ? new Date(r.last_transaction_date) : null;
      const nextDueDate = r.next_due_date ? new Date(r.next_due_date) : null;
      
      // Use last_transaction_date or start_date as the base date
      const baseDate = lastDate || startDate;
      if (!baseDate) return false;
      
      // Check if transaction is active during this month
      if (r.end_date) {
        const endDate = new Date(r.end_date);
        if (endDate < monthStart) return false;
      }
      if (startDate && startDate > monthEnd) return false;
      
      // For monthly, include every month after start date
      if (freqLower.includes('monthly') || freqLower.includes('approximately_monthly')) {
        return baseDate <= monthEnd;
      }
      
      // For annual/yearly, only include in the month it's actually billed
      if (freqLower.includes('annually') || freqLower.includes('yearly')) {
        // Check if last transaction was in this month
        if (lastDate && lastDate >= monthStart && lastDate <= monthEnd) {
          return true;
        }
        
        // Check if next due date falls in this month (for future projections)
        if (nextDueDate && nextDueDate >= monthStart && nextDueDate <= monthEnd) {
          return true;
        }
        
        return false;
      }
      
      // For quarterly, only include in the month it's actually billed
      if (freqLower.includes('quarterly')) {
        // Check if last transaction was in this month
        if (lastDate && lastDate >= monthStart && lastDate <= monthEnd) {
          return true;
        }
        
        // Check if next due date falls in this month (for future projections)
        if (nextDueDate && nextDueDate >= monthStart && nextDueDate <= monthEnd) {
          return true;
        }
        
        return false;
      }
      
      // For bimonthly, only include in the month it's actually billed
      if (freqLower.includes('bimonthly') || freqLower.includes('bi-monthly')) {
        // Check if last transaction was in this month
        if (lastDate && lastDate >= monthStart && lastDate <= monthEnd) {
          return true;
        }
        
        // Check if next due date falls in this month (for future projections)
        if (nextDueDate && nextDueDate >= monthStart && nextDueDate <= monthEnd) {
          return true;
        }
        
        return false;
      }
      
      // For weekly, calculate how many times it occurs in this month
      if (freqLower.includes('weekly')) {
        if (baseDate > monthEnd) return false;
        // Count weeks from base date to month start
        const weeksFromStart = Math.floor((monthStart.getTime() - baseDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
        // Check if any week falls within this month
        const firstWeekInMonth = new Date(baseDate);
        firstWeekInMonth.setDate(firstWeekInMonth.getDate() + (weeksFromStart * 7));
        return firstWeekInMonth <= monthEnd && baseDate <= monthEnd;
      }
      
      // For biweekly, similar logic
      if (freqLower.includes('biweekly') || freqLower.includes('bi-weekly')) {
        if (baseDate > monthEnd) return false;
        const biweeksFromStart = Math.floor((monthStart.getTime() - baseDate.getTime()) / (14 * 24 * 60 * 60 * 1000));
        const firstBiweekInMonth = new Date(baseDate);
        firstBiweekInMonth.setDate(firstBiweekInMonth.getDate() + (biweeksFromStart * 14));
        return firstBiweekInMonth <= monthEnd && baseDate <= monthEnd;
      }
      
      // Default: include if active
      return baseDate <= monthEnd;
    };
    
    // Helper function to get the amount for a recurring transaction in a specific month
    const getAmountForMonth = (r: any, monthStart: Date, monthEnd: Date): number => {
      if (!occursInMonth(r, monthStart, monthEnd)) return 0;
      
      const freqLower = (r.frequency || 'monthly').toLowerCase();
      const amount = r.expected_amount || 0;
      
      // For annual/yearly, return full amount
      if (freqLower.includes('annually') || freqLower.includes('yearly')) {
        return amount;
      }
      
      // For quarterly, return full amount
      if (freqLower.includes('quarterly')) {
        return amount;
      }
      
      // For bimonthly, return full amount
      if (freqLower.includes('bimonthly') || freqLower.includes('bi-monthly')) {
        return amount;
      }
      
      // For weekly, calculate occurrences in this month
      if (freqLower.includes('weekly')) {
        const startDate = r.start_date ? new Date(r.start_date) : r.last_transaction_date ? new Date(r.last_transaction_date) : monthStart;
        const firstWeekInMonth = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
        // Count weeks in this month
        let weeks = 0;
        let currentWeek = new Date(firstWeekInMonth);
        while (currentWeek <= monthEnd) {
          weeks++;
          currentWeek.setDate(currentWeek.getDate() + 7);
        }
        return amount * weeks;
      }
      
      // For biweekly, calculate occurrences in this month
      if (freqLower.includes('biweekly') || freqLower.includes('bi-weekly')) {
        const startDate = r.start_date ? new Date(r.start_date) : r.last_transaction_date ? new Date(r.last_transaction_date) : monthStart;
        const firstBiweekInMonth = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
        let biweeks = 0;
        let currentBiweek = new Date(firstBiweekInMonth);
        while (currentBiweek <= monthEnd) {
          biweeks++;
          currentBiweek.setDate(currentBiweek.getDate() + 14);
        }
        return amount * biweeks;
      }
      
      // For monthly, return the amount
      return amount;
    };
    
    // Find the earliest date from recurring transactions (prefer last_transaction_date over start_date)
    const now = new Date();
    let earliestDate: Date | null = null;
    
    recurring.forEach((r: any) => {
      // Prefer last_transaction_date as it indicates actual activity
      const dateToUse = r.last_transaction_date ? new Date(r.last_transaction_date) : 
                        r.start_date ? new Date(r.start_date) : null;
      
      if (dateToUse) {
        if (!earliestDate || dateToUse < earliestDate) {
          earliestDate = dateToUse;
        }
      }
    });
    
    // If no dates found, default to last 3 months
    if (!earliestDate) {
      earliestDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    }
    
    // Calculate the number of months to show (from earliest date to now)
    const monthsDiff = (now.getFullYear() - earliestDate.getFullYear()) * 12 + 
                       (now.getMonth() - earliestDate.getMonth());
    const numMonths = Math.min(Math.max(monthsDiff + 1, 1), 12); // Show at least 1 month, max 12
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = [];
    
    // Generate chart data from earliest month to current month
    for (let i = numMonths - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = months[date.getMonth()];
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      // Calculate subscriptions and bills for this month using the same classification logic
      const subscriptions = recurring
        .filter(r => isSubscription(r))
        .reduce((sum, r) => sum + getAmountForMonth(r, monthStart, monthEnd), 0);
      
      const bills = recurring
        .filter(r => !isSubscription(r) && r.transaction_type === 'expense')
        .reduce((sum, r) => sum + getAmountForMonth(r, monthStart, monthEnd), 0);
      
      // Only add months that have actual spending data
      if (subscriptions > 0 || bills > 0) {
        chartData.push({
          month: monthName,
          subscriptions,
          bills,
        });
      }
    }
    
    // If no data, show at least the current month
    if (chartData.length === 0) {
      const currentMonthName = months[now.getMonth()];
      chartData.push({
        month: currentMonthName,
        subscriptions: 0,
        bills: 0,
      });
    }
    
    setMonthlyData(chartData);
  };

  // Helper function to filter items by search term
  const filterBySearch = (items: any[]) => {
    if (!searchTerm.trim()) return items;
    
    const searchLower = searchTerm.toLowerCase();
    return items.filter(item => {
      const name = (item.name || '').toLowerCase();
      const merchantName = (item.merchant_name || '').toLowerCase();
      const frequency = (item.frequency || '').toLowerCase();
      return name.includes(searchLower) || 
             merchantName.includes(searchLower) || 
             frequency.includes(searchLower);
    });
  };

  // Helper function to sort items
  const sortItems = (items: any[]) => {
    const sorted = [...items];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
      case 'amount':
        sorted.sort((a, b) => {
          const amountA = a.expected_amount || 0;
          const amountB = b.expected_amount || 0;
          return amountB - amountA; // Descending order
        });
        break;
      case 'due':
        sorted.sort((a, b) => {
          const daysA = a.days_until_due ?? Infinity;
          const daysB = b.days_until_due ?? Infinity;
          return daysA - daysB; // Ascending order (sooner due dates first)
        });
        break;
      case 'type':
      default:
        // Keep original order (already grouped by type)
        break;
    }
    
    return sorted;
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
    
    let subscriptions = recurringTransactions.filter(r => isSubscription(r));
    let bills = recurringTransactions.filter(r => !isSubscription(r) && r.transaction_type === 'expense');
    
    // Apply search filter
    subscriptions = filterBySearch(subscriptions);
    bills = filterBySearch(bills);
    
    // Apply sorting
    subscriptions = sortItems(subscriptions);
    bills = sortItems(bills);
    return { subscriptions, bills };
  };

  const getUpcomingCharges = () => {
    const upcoming = recurringTransactions.filter(r => 
      r.days_until_due !== undefined && r.days_until_due >= 0
    );
    
    const next7Days = upcoming.filter(r => r.days_until_due <= 7);
    const comingLater = upcoming.filter(r => r.days_until_due > 7 && r.days_until_due <= 30);
    
    return { next7Days, comingLater };
  };

  const { subscriptions, bills } = groupByType();
  const { next7Days, comingLater } = getUpcomingCharges();

  // Calendar data - map recurring to calendar events
  // Use the exact same transactions that appear in the "Upcoming" list
  // Calculate date from days_until_due to ensure it matches the "in x days" display
  const getCalendarEvents = () => {
    // Combine next7Days and comingLater to get all upcoming charges
    const allUpcoming = [...next7Days, ...comingLater];
    
    // Get today's date normalized to midnight
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    return allUpcoming
      .filter(r => r.days_until_due !== undefined && r.days_until_due >= 0) // Ensure days_until_due exists
      .map(r => {
        // Calculate the due date by adding days_until_due to today
        // This ensures the calendar date matches exactly what's shown in "in x days"
        const dueDate = new Date(todayMidnight);
        dueDate.setDate(todayMidnight.getDate() + r.days_until_due);
        
        return {
          date: dueDate.getDate(),
          month: dueDate.getMonth(),
          year: dueDate.getFullYear(),
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // Current month (0-indexed)
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    
    const days = [];
    const prevMonthDays = firstDay === 0 ? 6 : firstDay - 1; // Adjust for Monday start
    
    // Previous month days
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);
    
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      const date = daysInPrevMonth - i;
      days.push({ 
        date, 
        currentMonth: false,
        month: prevMonth,
        year: prevYear
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ 
        date: i, 
        currentMonth: true,
        month: month,
        year: year
      });
    }
    
    // Next month days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows * 7 days
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    
    for (let i = 1; i <= remainingDays; i++) {
      days.push({ 
        date: i, 
        currentMonth: false,
        month: nextMonth,
        year: nextYear
      });
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
                    <h3 className="text-lg font-bold text-gray-900">
                      {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </h3>
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
                      const now = new Date();
                      const isToday = day.currentMonth && 
                                       day.date === now.getDate() && 
                                       day.month === now.getMonth() && 
                                       day.year === now.getFullYear();
                      
                      // Match events by date, month, and year
                      const events = calendarEvents.filter(e => 
                        e.date === day.date && 
                        e.month === day.month && 
                        e.year === day.year
                      );
                      
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
                  <h2 className="text-xl font-bold text-gray-900">
                    {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h2>
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
                  // Match events by date, month, and year
                  const events = calendarEvents.filter(e => 
                    e.date === day.date && 
                    e.month === day.month && 
                    e.year === day.year
                  );
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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="absolute left-3 top-3.5 text-gray-400">🔍</span>
                </div>
                <div className="relative sort-dropdown-container">
                  <button 
                    onClick={() => setShowSortDropdown(!showSortDropdown)}
                    className="px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    Sort by {sortBy === 'type' ? 'type' : sortBy === 'name' ? 'name' : sortBy === 'amount' ? 'amount' : 'due'} ▼
                  </button>
                  {showSortDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10 sort-dropdown-container">
                      <button
                        onClick={() => {
                          setSortBy('type');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          sortBy === 'type' ? 'bg-gray-50 font-medium' : ''
                        }`}
                      >
                        Type
                      </button>
                      <button
                        onClick={() => {
                          setSortBy('name');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          sortBy === 'name' ? 'bg-gray-50 font-medium' : ''
                        }`}
                      >
                        Name
                      </button>
                      <button
                        onClick={() => {
                          setSortBy('amount');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          sortBy === 'amount' ? 'bg-gray-50 font-medium' : ''
                        }`}
                      >
                        Amount
                      </button>
                      <button
                        onClick={() => {
                          setSortBy('due');
                          setShowSortDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                          sortBy === 'due' ? 'bg-gray-50 font-medium' : ''
                        }`}
                      >
                        Due Date
                      </button>
                    </div>
                  )}
                </div>
              </div>

          {/* Subscriptions */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{subscriptions.length} Subscription{subscriptions.length !== 1 ? 's' : ''}</h3>
              <p className="text-sm text-gray-600">
                You spend ${subscriptions.reduce((sum, s) => sum + calculateYearlyAmount(s.expected_amount || 0, s.frequency || 'monthly'), 0).toFixed(2)}/yearly
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
                You spend ${bills.reduce((sum, b) => sum + calculateYearlyAmount(b.expected_amount || 0, b.frequency || 'monthly'), 0).toFixed(2)}/yearly
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
                <Tooltip 
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                />
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



