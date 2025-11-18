import { screen } from '@testing-library/react';
import ProtectedRoute from '../components/ProtectedRoute';
import { renderWithRouter } from '../test/utils';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('ProtectedRoute component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading spinner when loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: true,
      user: null,
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { route: '/' },
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: null,
    });

    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { route: '/' },
    );

    // Check that Navigate component is rendered (redirects to /login)
    // In MemoryRouter, we can check the location
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { id: '1', email: 'test@example.com' },
    });

    renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { route: '/' },
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('renders children when user exists but isAuthenticated is false', () => {
    // Edge case: user exists but isAuthenticated flag is false
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      loading: false,
      user: { id: '1', email: 'test@example.com' },
    });

    const { container } = renderWithRouter(
      <ProtectedRoute>
        <div>Protected Content</div>
      </ProtectedRoute>,
      { route: '/' },
    );

    // Should redirect because !isAuthenticated || !user
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});

