import { api } from '../utils/api';

const originalFetch = globalThis.fetch;
const fetchMock = vi.fn();

describe('api utility', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    // @ts-expect-error override fetch for tests
    globalThis.fetch = fetchMock;
    localStorage.clear();
    localStorage.setItem('access_token', 'token-123');
    vi.stubEnv('DEV', 'true');
    vi.stubEnv('VITE_API_URL', 'http://localhost:3001/api');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it('creates a Plaid link token via the API endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ link_token: 'link-xyz' }), {
        status: 200,
      }),
    );

    const result = await api.createLinkToken();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/create_link_token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result.link_token).toBe('link-xyz');
  });

  it('throws a helpful error when the link token call fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Plaid unavailable' }), {
        status: 500,
      }),
    );

    await expect(api.createLinkToken()).rejects.toThrow(/Plaid unavailable/);
  });

  it('searches transactions with the provided filters', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ transactions: [], count: 0 }), {
        status: 200,
      }),
    );

    await api.searchTransactions({ search: 'coffee', limit: 5, offset: 15 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain('/transactions/search');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('search')).toBe('coffee');
    expect(parsed.searchParams.get('limit')).toBe('5');
    expect(parsed.searchParams.get('offset')).toBe('15');
    expect(options?.method).toBe('GET');
    expect(options?.headers).toMatchObject({
      Authorization: 'Bearer token-123',
    });
  });

  it('sends chat prompts to the AI advisor endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: 'Here is advice',
        }),
        { status: 200 },
      ),
    );

    const payload = {
      message: 'How am I doing?',
      conversation: [{ role: 'user', content: 'Hello' as const }],
    };

    const response = await api.askFinancialAdvisor(payload);

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/ai/chat',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
    expect(response.message).toBe('Here is advice');
  });

  it('handles Google login', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ url: 'https://google.com/oauth' }), {
        status: 200,
      }),
    );

    const result = await api.googleLogin();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/google',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result.url).toBe('https://google.com/oauth');
  });

  it('handles Google login error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'OAuth failed' }), {
        status: 500,
      }),
    );

    await expect(api.googleLogin()).rejects.toThrow(/OAuth failed/);
  });

  it('gets current user', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ user: { id: '1', email: 'test@example.com' } }),
        { status: 200 },
      ),
    );

    const result = await api.getCurrentUser();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      }),
    );
    expect(result.user.email).toBe('test@example.com');
  });

  it('exchanges public token', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-123',
          item_id: 'item-456',
          accounts: [],
        }),
        { status: 200 },
      ),
    );

    const result = await api.exchangePublicToken('public-token-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/exchange_public_token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ public_token: 'public-token-123' }),
      }),
    );
    expect(result.access_token).toBe('access-123');
  });

  it('gets accounts', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ accounts: [{ id: '1' }] }), {
        status: 200,
      }),
    );

    const result = await api.getAccounts();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/accounts',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.accounts).toHaveLength(1);
  });

  it('gets transactions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ transactions: [], last_synced: null }),
        { status: 200 },
      ),
    );

    const result = await api.getTransactions();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/transactions',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.transactions).toEqual([]);
  });

  it('syncs transactions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Synced',
          synced_count: 10,
          synced_at: '2024-01-01',
        }),
        { status: 200 },
      ),
    );

    const result = await api.syncTransactions();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/transactions/sync',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.success).toBe(true);
  });

  it('updates transaction', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ transaction: { id: '1', category_id: 'cat-1' } }),
        { status: 200 },
      ),
    );

    const result = await api.updateTransaction('tx-1', {
      category_id: 'cat-1',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/transactions/update'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ category_id: 'cat-1' }),
      }),
    );
    expect(result.transaction.id).toBe('1');
  });

  it('deletes transaction', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );

    const result = await api.deleteTransaction('tx-1');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/transactions/delete'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(result.success).toBe(true);
  });

  it('gets recurring transactions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ recurring: [] }), { status: 200 }),
    );

    const result = await api.getRecurring({ upcoming_only: true });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/recurring'),
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.recurring).toEqual([]);
  });

  it('gets categories', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ categories: [] }), { status: 200 }),
    );

    const result = await api.getCategories();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/categories',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.categories).toEqual([]);
  });

  it('auto-categorizes transactions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Categorized',
          total_checked: 10,
          categorized_count: 5,
          uncategorized_count: 5,
        }),
        { status: 200 },
      ),
    );

    const result = await api.autoCategorizeTransactions();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/transactions/auto-categorize',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.success).toBe(true);
  });

  it('handles search transactions with array filters', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ transactions: [], count: 0 }), {
        status: 200,
      }),
    );

    await api.searchTransactions({ tags: ['tag1', 'tag2'] });

    const [url] = fetchMock.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.searchParams.get('tags')).toBe(JSON.stringify(['tag1', 'tag2']));
  });

  it('returns API URL', () => {
    const url = api.getApiUrl();
    expect(url).toBe('http://localhost:3001/api');
  });

  it('returns auth headers', () => {
    const headers = api.getAuthHeaders();
    expect(headers).toHaveProperty('Authorization', 'Bearer token-123');
    expect(headers).toHaveProperty('Content-Type', 'application/json');
  });

  it('handles missing auth token', () => {
    localStorage.removeItem('access_token');
    const headers = api.getAuthHeaders();
    expect(headers).not.toHaveProperty('Authorization');
    expect(headers).toHaveProperty('Content-Type', 'application/json');
  });

  // Error handling tests
  it('handles getCurrentUser error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      }),
    );
    await expect(api.getCurrentUser()).rejects.toThrow(/Unauthorized/);
  });

  it('handles exchangePublicToken error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 400,
      }),
    );
    await expect(api.exchangePublicToken('bad-token')).rejects.toThrow(/Invalid token/);
  });

  it('handles getAccounts error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
      }),
    );
    await expect(api.getAccounts()).rejects.toThrow(/Not found/);
  });

  it('handles getTransactions error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
      }),
    );
    await expect(api.getTransactions()).rejects.toThrow(/Server error/);
  });

  it('handles syncTransactions error with status and data', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ message: 'Rate limit exceeded', hours_remaining: 2 }),
        { status: 429 },
      ),
    );
    try {
      await api.syncTransactions();
      expect.fail('Should have thrown');
    } catch (error: any) {
      expect(error.message).toContain('Rate limit exceeded');
      expect(error.status).toBe(429);
      expect(error.data.hours_remaining).toBe(2);
    }
  });

  it('handles searchTransactions error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Search failed' }), {
        status: 500,
      }),
    );
    await expect(api.searchTransactions()).rejects.toThrow(/Search failed/);
  });

  it('handles updateTransaction error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Update failed' }), {
        status: 500,
      }),
    );
    await expect(api.updateTransaction('tx-1', {})).rejects.toThrow(/Update failed/);
  });

  it('handles deleteTransaction error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Delete failed' }), {
        status: 500,
      }),
    );
    await expect(api.deleteTransaction('tx-1')).rejects.toThrow(/Delete failed/);
  });

  it('handles getRecurring with active_only option', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ recurring: [] }), { status: 200 }),
    );

    await api.getRecurring({ active_only: true });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('active_only=true');
  });

  it('handles getRecurring error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
      }),
    );
    await expect(api.getRecurring()).rejects.toThrow(/Not found/);
  });

  it('handles getCategories error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Server error' }), {
        status: 500,
      }),
    );
    await expect(api.getCategories()).rejects.toThrow(/Server error/);
  });

  it('handles cleanupDuplicateAccounts', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ success: true, message: 'Cleaned', removed: 3 }),
        { status: 200 },
      ),
    );

    const result = await api.cleanupDuplicateAccounts();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/accounts/cleanup-duplicates',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.removed).toBe(3);
  });

  it('handles cleanupDuplicateAccounts error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Cleanup failed' }), {
        status: 500,
      }),
    );
    await expect(api.cleanupDuplicateAccounts()).rejects.toThrow(/Cleanup failed/);
  });

  it('syncs recurring transactions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          message: 'Synced recurring',
          recurring_count: 5,
          synced_at: '2024-01-01',
        }),
        { status: 200 },
      ),
    );

    const result = await api.syncRecurringTransactions();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/recurring/sync',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.recurring_count).toBe(5);
  });

  it('handles syncRecurringTransactions error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Sync failed' }), {
        status: 500,
      }),
    );
    await expect(api.syncRecurringTransactions()).rejects.toThrow(/Sync failed/);
  });

  it('handles askFinancialAdvisor error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'AI unavailable' }), {
        status: 500,
      }),
    );
    await expect(
      api.askFinancialAdvisor({ message: 'Hello' }),
    ).rejects.toThrow(/AI unavailable/);
  });

  it('handles askFinancialAdvisor error when body parsing fails', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Invalid JSON', { status: 500 }),
    );
    await expect(
      api.askFinancialAdvisor({ message: 'Hello' }),
    ).rejects.toThrow(/Failed to generate AI advice/);
  });

  it('handles autoCategorizeTransactions error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Categorization failed' }), {
        status: 500,
      }),
    );
    await expect(api.autoCategorizeTransactions()).rejects.toThrow(/Categorization failed/);
  });

  it('handles Google login with text error response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );
    await expect(api.googleLogin()).rejects.toThrow(/Internal Server Error/);
  });

  it('handles Google login network error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));
    await expect(api.googleLogin()).rejects.toThrow(/Network error/);
  });

  it('handles createLinkToken with text error response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('Service Unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );
    await expect(api.createLinkToken()).rejects.toThrow(/Service Unavailable/);
  });

  it('handles createLinkToken network error', async () => {
    const networkError = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValueOnce(networkError);
    await expect(api.createLinkToken()).rejects.toThrow(/Network error/);
  });

  it('handles createLinkToken other fetch errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Unknown error'));
    await expect(api.createLinkToken()).rejects.toThrow(/Unknown error/);
  });

  it('handles search with no filters', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ transactions: [], count: 0 }), {
        status: 200,
      }),
    );

    await api.searchTransactions();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/transactions/search');
  });
});
