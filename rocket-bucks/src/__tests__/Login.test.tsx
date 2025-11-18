import { screen, waitFor } from '@testing-library/react';
import Login from '../pages/Login';
import { renderWithRouter } from '../test/utils';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.alert
    global.alert = vi.fn();
  });

  it('renders login form', () => {
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
    });

    renderWithRouter(<Login />, { route: '/login' });

    expect(screen.getByText('Rocket Bucks')).toBeInTheDocument();
    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByText(/Continue with Google/i)).toBeInTheDocument();
  });

  it('calls login when Google button is clicked', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      login: mockLogin,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(<Login />, { route: '/login' });

    const loginButton = screen.getByText(/Continue with Google/i);
    await user.click(loginButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state when login is in progress', async () => {
    const mockLogin = vi.fn(
      () => new Promise(() => {}), // Never resolves
    );
    mockUseAuth.mockReturnValue({
      login: mockLogin,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(<Login />, { route: '/login' });

    const loginButton = screen.getByText(/Continue with Google/i);
    await user.click(loginButton);

    await waitFor(() => {
      // Check for spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  it('displays error alert when login fails', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Login failed'));
    mockUseAuth.mockReturnValue({
      login: mockLogin,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(<Login />, { route: '/login' });

    const loginButton = screen.getByText(/Continue with Google/i);
    await user.click(loginButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith(
        expect.stringContaining('Login failed'),
      );
    });
  });

  it('disables button when loading', async () => {
    const mockLogin = vi.fn(
      () => new Promise(() => {}), // Never resolves
    );
    mockUseAuth.mockReturnValue({
      login: mockLogin,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(<Login />, { route: '/login' });

    const loginButton = screen.getByText(/Continue with Google/i).closest('button');
    expect(loginButton).toBeInTheDocument();
    await user.click(loginButton!);

    await waitFor(() => {
      expect(loginButton).toBeDisabled();
    });
  });
});

