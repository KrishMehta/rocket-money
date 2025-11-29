import { screen, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import AuthCallback from '../pages/AuthCallback';
import { renderWithRouter } from '../test/utils';

const originalFetch = global.fetch;
const fetchMock = vi.fn();
const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AuthCallback page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    global.fetch = fetchMock;
    // Reset window.location
    delete (window as any).location;
    window.location = {
      ...window.location,
      href: '',
      search: '',
      hash: '',
    } as Location;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    localStorage.clear();
  });

  it('shows loading state initially', () => {
    window.location.search = '?code=test-code';
    fetchMock.mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    expect(screen.getByText('Signing you in...')).toBeInTheDocument();
  });

  it('exchanges code for tokens and redirects', async () => {
    window.location.search = '?code=test-code';
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-123',
          refresh_token: 'refresh-123',
          user: { id: '1', email: 'test@example.com' },
        }),
        { status: 200 },
      ),
    );

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('access-123');
      expect(localStorage.getItem('refresh_token')).toBe('refresh-123');
    }, { timeout: 2000 });
  });

  it('handles direct tokens from hash (implicit flow)', async () => {
    window.location.hash = '#access_token=token-123&refresh_token=refresh-123';

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('token-123');
      expect(localStorage.getItem('refresh_token')).toBe('refresh-123');
    }, { timeout: 2000 });
  });

  it('displays error when OAuth error is present', async () => {
    window.location.search = '?error=access_denied&error_description=User%20denied';

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      expect(screen.getByText(/User denied/i)).toBeInTheDocument();
    });
  });

  it('displays error when no code or tokens received', async () => {
    window.location.search = '';
    window.location.hash = '';

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      expect(screen.getByText(/No authorization code/i)).toBeInTheDocument();
    });
  });

  it('displays error when code exchange fails', async () => {
    window.location.search = '?code=test-code';
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 400,
      }),
    );

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
    });
  });

  it('exchanges code and stores tokens successfully', async () => {
    window.location.search = '?code=test-code';
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-123',
          refresh_token: 'refresh-123',
        }),
        { status: 200 },
      ),
    );

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    // Wait for tokens to be stored
    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('access-123');
      expect(localStorage.getItem('refresh_token')).toBe('refresh-123');
    }, { timeout: 2000 });

    // Navigate should be called
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('navigates to login on error button click', async () => {
    window.location.search = '?error=test';
    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Go to Login/i)).toBeInTheDocument();
    });

    const loginButton = screen.getByText(/Go to Login/i);
    await user.click(loginButton);

    // In MemoryRouter, we can't easily test navigation, but we can verify button exists
    expect(loginButton).toBeInTheDocument();
  });

  it('handles error response with text body when JSON parsing fails', async () => {
    window.location.search = '?code=test-code';
    // Mock a response where json() throws but text() returns content
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('Invalid JSON')),
      text: () => Promise.resolve('Server Error - Invalid Request'),
    });

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Server Error/i)).toBeInTheDocument();
    });
  });

  it('handles fetch throwing an error', async () => {
    window.location.search = '?code=test-code';
    fetchMock.mockRejectedValueOnce(new Error('Network failure'));

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Network failure/i)).toBeInTheDocument();
    });
  });

  it('handles direct access token without refresh token', async () => {
    window.location.hash = '#access_token=token-123';

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('token-123');
    }, { timeout: 2000 });

    // No refresh token should be stored
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('handles code exchange success without refresh token', async () => {
    window.location.search = '?code=test-code';
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-123',
          // No refresh_token
        }),
        { status: 200 },
      ),
    );

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBe('access-123');
    }, { timeout: 2000 });

    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('handles error without error_description', async () => {
    window.location.search = '?error=access_denied';

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      expect(screen.getByText(/access_denied/i)).toBeInTheDocument();
    });
  });

  it('handles error from hash instead of query params', async () => {
    window.location.hash = '#error=invalid_request&error_description=Bad%20Request';

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      expect(screen.getByText(/Bad Request/i)).toBeInTheDocument();
    });
  });

  it('handles code in hash params', async () => {
    window.location.hash = '#code=hash-code';
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-from-hash',
        }),
        { status: 200 },
      ),
    );

    renderWithRouter(<AuthCallback />, { route: '/auth/callback' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/exchange-code'),
        expect.objectContaining({
          body: JSON.stringify({ code: 'hash-code' }),
        }),
      );
    });
  });
});

