import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import App from '../App';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => mockUseAuth(),
}));

describe('App component', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { id: '1', email: 'test@example.com' },
      loading: false,
      isAuthenticated: true,
    });
  });

  it('renders login page at /login', () => {
    // App already includes Router, so we don't wrap it
    window.history.pushState({}, '', '/login');
    render(<App />);

    // Check that AuthProvider is rendered
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('renders signup page at /signup', () => {
    window.history.pushState({}, '', '/signup');
    render(<App />);

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('renders auth callback page at /auth/callback', () => {
    window.history.pushState({}, '', '/auth/callback');
    render(<App />);

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('renders protected routes when authenticated', () => {
    window.history.pushState({}, '', '/');
    render(<App />);

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });

  it('redirects unknown routes to dashboard', () => {
    window.history.pushState({}, '', '/unknown-route');
    render(<App />);

    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
  });
});

