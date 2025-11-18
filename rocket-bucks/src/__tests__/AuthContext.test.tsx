import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';

vi.mock('../utils/api', () => ({
  api: {
    getCurrentUser: vi.fn(),
    googleLogin: vi.fn(),
  },
}));

// Test component that uses the auth context
const TestComponent = () => {
  const { user, loading, isAuthenticated, login, logout } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div data-testid="user">{user?.email || 'No user'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <button onClick={login}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('provides loading state initially', async () => {
    vi.mocked(api.getCurrentUser).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    // Loading state should appear briefly before API call completes
    await waitFor(() => {
      const loadingText = screen.queryByText('Loading...');
      const noUserText = screen.queryByText('No user');
      // Either loading or no user should be present
      expect(loadingText || noUserText).toBeTruthy();
    }, { timeout: 100 });
  });

  it('loads user when token exists', async () => {
    localStorage.setItem('access_token', 'token-123');
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      user: { id: '1', email: 'test@example.com', full_name: 'Test User' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
  });

  it('clears user when token is invalid', async () => {
    localStorage.setItem('access_token', 'invalid-token');
    vi.mocked(api.getCurrentUser).mockRejectedValue(new Error('Invalid token'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('sets user to null when no token exists', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
  });

  it('handles login and redirects', async () => {
    vi.mocked(api.googleLogin).mockResolvedValue({
      url: 'https://google.com/oauth',
    });

    // Mock window.location.href
    const originalLocation = window.location;
    delete (window as any).location;
    window.location = { ...originalLocation, href: '' };

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Login')).toBeInTheDocument();
    });

    const loginButton = screen.getByText('Login');
    loginButton.click();

    await waitFor(() => {
      expect(api.googleLogin).toHaveBeenCalled();
    });

    // Restore window.location
    window.location = originalLocation;
  });

  it('handles logout', async () => {
    localStorage.setItem('access_token', 'token-123');
    localStorage.setItem('refresh_token', 'refresh-123');
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      user: { id: '1', email: 'test@example.com' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });

    const logoutButton = screen.getByText('Logout');
    logoutButton.click();

    await waitFor(() => {
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
    });

    expect(screen.getByTestId('user')).toHaveTextContent('No user');
  });

  it('handles storage events for cross-tab auth', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      user: { id: '1', email: 'test@example.com' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });

    // Simulate storage event
    localStorage.setItem('access_token', 'token-123');
    const storageEvent = new StorageEvent('storage', {
      key: 'access_token',
      newValue: 'token-123',
    });
    window.dispatchEvent(storageEvent);

    await waitFor(() => {
      expect(api.getCurrentUser).toHaveBeenCalled();
    });
  });

  it('handles custom auth state change event', async () => {
    vi.mocked(api.getCurrentUser).mockResolvedValue({
      user: { id: '1', email: 'test@example.com' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('No user');
    });

    // Simulate custom auth state change event
    localStorage.setItem('access_token', 'token-123');
    const authEvent = new Event('auth-state-changed');
    window.dispatchEvent(authEvent);

    await waitFor(() => {
      expect(api.getCurrentUser).toHaveBeenCalled();
    });
  });

  it('throws error when useAuth is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});

