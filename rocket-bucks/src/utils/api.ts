/**
 * API utility for making requests to the backend
 * Automatically handles localhost vs production URLs and authentication
 */

const getApiUrl = () => {
  // In development, use localhost server if running
  // In production on Vercel, use relative URLs (same origin)
  if (import.meta.env.DEV) {
    // Check if we're running the local Express server
    return import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
  }
  // In production, use relative URLs (Vercel serves API from same domain)
  return '/api';
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const api = {
  /**
   * Google OAuth login
   */
  googleLogin: async (): Promise<{ url: string }> => {
    const apiUrl = `${getApiUrl()}/auth/callback`;
    console.log('🌐 Calling Google login API:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Response status:', response.status, response.statusText);

      // Clone the response before reading it to avoid "body is disturbed" error
      const responseClone = response.clone();
      
      if (!response.ok) {
        let errorMessage = 'Failed to initiate Google login';
        try {
          const errorData = await responseClone.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          try {
            const text = await responseClone.text();
            errorMessage = text || errorMessage;
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        console.error('❌ API Error:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Got OAuth URL:', data.url ? 'URL received' : 'No URL');
      return data;
    } catch (error: any) {
      // If it's already our error, re-throw it
      if (error.message && error.message.includes('Failed to initiate')) {
        throw error;
      }
      // Otherwise, wrap it
      console.error('❌ Fetch error:', error);
      throw new Error(error.message || 'Network error: Failed to connect to server');
    }
  },

  /**
   * Get current user
   */
  getCurrentUser: async (): Promise<{
    user: { id: string; email: string; full_name?: string };
  }> => {
    const response = await fetch(`${getApiUrl()}/auth/me`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user');
    }

    return response.json();
  },

  /**
   * Create a Plaid link token
   */
  createLinkToken: async (): Promise<{ link_token: string }> => {
    const apiUrl = `${getApiUrl()}/create_link_token`;
    console.log('🌐 Calling create link token API:', apiUrl);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        let errorMessage = 'Failed to create link token';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
          console.error('❌ API Error:', errorData);
        } catch (e) {
          try {
            const text = await response.text();
            errorMessage = text || errorMessage;
            console.error('❌ API Error (text):', text);
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('✅ Link token received');
      return data;
    } catch (error: any) {
      // If it's already our error, re-throw it
      if (error.message && error.message.includes('Failed to create')) {
        throw error;
      }
      // Network errors (server not running, CORS, etc.)
      if (error.name === 'TypeError' || error.message?.includes('fetch')) {
        console.error('❌ Network error:', error);
        throw new Error(`Network error: Cannot connect to server. Make sure the server is running on ${getApiUrl()}`);
      }
      // Otherwise, wrap it
      console.error('❌ Fetch error:', error);
      throw new Error(error.message || 'Failed to create link token');
    }
  },

  /**
   * Exchange a public token for an access token
   */
  exchangePublicToken: async (publicToken: string): Promise<{
    access_token: string;
    item_id: string;
    accounts: any[];
    institution_name?: string;
    transactions_synced?: boolean;
  }> => {
    const response = await fetch(`${getApiUrl()}/exchange_public_token`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ public_token: publicToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to exchange token');
    }

    return response.json();
  },

  /**
   * Get user's accounts from database
   */
  getAccounts: async (): Promise<{ accounts: any[] }> => {
    const response = await fetch(`${getApiUrl()}/accounts`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch accounts');
    }

    return response.json();
  },

  /**
   * Get transactions for the authenticated user (from database, no syncing)
   */
  getTransactions: async (): Promise<{ transactions: any[]; last_synced: string | null }> => {
    const response = await fetch(`${getApiUrl()}/transactions`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch transactions');
    }

    return response.json();
  },

  /**
   * Manually sync transactions from Plaid (rate limited to once per 24 hours)
   */
  syncTransactions: async (): Promise<{ 
    success: boolean; 
    message: string; 
    synced_count: number;
    synced_at: string;
  }> => {
    const response = await fetch(`${getApiUrl()}/transactions?action=sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      // Pass through the full error object for rate limit handling
      const errorObj = new Error(error.message || error.error || 'Failed to sync transactions');
      (errorObj as any).status = response.status;
      (errorObj as any).data = error;
      throw errorObj;
    }

    return response.json();
  },

  /**
   * Get API URL for custom requests
   */
  getApiUrl: () => getApiUrl(),

  /**
   * Get auth headers for custom requests
   */
  getAuthHeaders: () => getAuthHeaders(),

  /**
   * Search transactions with filters
   */
  searchTransactions: async (filters?: {
    search?: string;
    category_id?: string;
    user_category_name?: string;
    merchant_name?: string;
    account_id?: string;
    start_date?: string;
    end_date?: string;
    transaction_type?: string;
    pending?: boolean;
    tags?: string[];
    min_amount?: number;
    max_amount?: number;
    limit?: number;
    offset?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<{ transactions: any[]; count: number }> => {
    const queryParams = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            queryParams.append(key, JSON.stringify(value));
          } else {
            queryParams.append(key, String(value));
          }
        }
      });
    }

    queryParams.append('action', 'search');
    const response = await fetch(`${getApiUrl()}/transactions?${queryParams.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search transactions');
    }

    return response.json();
  },

  /**
   * Update a transaction
   */
  updateTransaction: async (transactionId: string, updates: {
    category_id?: string;
    user_category_name?: string;
    notes?: string;
    tags?: string[];
    excluded_from_budget?: boolean;
    is_recurring?: boolean;
  }): Promise<{ transaction: any }> => {
    const response = await fetch(`${getApiUrl()}/transactions?transaction_id=${transactionId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update transaction');
    }

    return response.json();
  },

  /**
   * Delete a transaction
   */
  deleteTransaction: async (transactionId: string): Promise<{ success: boolean }> => {
    const response = await fetch(`${getApiUrl()}/transactions/delete?transaction_id=${transactionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete transaction');
    }

    return response.json();
  },

  /**
   * Get recurring transactions
   */
  getRecurring: async (options?: {
    active_only?: boolean;
    upcoming_only?: boolean;
  }): Promise<{ recurring: any[] }> => {
    const queryParams = new URLSearchParams();
    if (options?.active_only) queryParams.append('active_only', 'true');
    if (options?.upcoming_only) queryParams.append('upcoming_only', 'true');

    const response = await fetch(`${getApiUrl()}/recurring?${queryParams.toString()}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch recurring transactions');
    }

    return response.json();
  },

  /**
   * Get categories
   */
  getCategories: async (): Promise<{ categories: any[] }> => {
    const response = await fetch(`${getApiUrl()}/categories`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch categories');
    }

    return response.json();
  },

  /**
   * Clean up duplicate accounts
   */
  cleanupDuplicateAccounts: async (): Promise<{ 
    success: boolean; 
    message: string; 
    removed: number 
  }> => {
    const response = await fetch(`${getApiUrl()}/accounts/cleanup-duplicates`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to cleanup duplicates');
    }

    return response.json();
  },

  /**
   * Sync recurring transactions from Plaid
   */
  syncRecurringTransactions: async (): Promise<{
    success: boolean;
    message: string;
    recurring_count: number;
    synced_at: string;
  }> => {
    const response = await fetch(`${getApiUrl()}/recurring/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync recurring transactions');
    }

    return response.json();
  },

  askFinancialAdvisor: async (payload: {
    message: string;
    conversation?: { role: 'user' | 'assistant'; content: string }[];
  }): Promise<{
    message: string;
    model?: string;
    context?: {
      netWorth?: number;
      totalAssets?: number;
      totalLiabilities?: number;
      monthlySpending?: number;
      monthlyIncome?: number;
      spendingChange?: number;
      recurringTotal?: number;
      generatedAt?: string;
    };
    context_summary?: string;
  }> => {
    const response = await fetch(`${getApiUrl()}/ai/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to generate AI advice';
      try {
        const error = await response.json();
        errorMessage = error.error || errorMessage;
      } catch (err) {
        // ignore body parsing issues
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  /**
   * Auto-categorize uncategorized transactions
   */
  autoCategorizeTransactions: async (): Promise<{
    success: boolean;
    message: string;
    total_checked: number;
    categorized_count: number;
    uncategorized_count: number;
  }> => {
    const response = await fetch(`${getApiUrl()}/transactions?action=auto-categorize`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to auto-categorize transactions');
    }

    return response.json();
  },
};

