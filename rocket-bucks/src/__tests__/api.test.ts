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
});
