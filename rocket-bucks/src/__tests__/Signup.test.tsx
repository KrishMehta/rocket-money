import { screen, waitFor } from '@testing-library/react';
import Signup from '../pages/Signup';
import { renderWithRouter } from '../test/utils';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Signup page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders signup form', () => {
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
    });

    renderWithRouter(<Signup />, { route: '/signup' });

    expect(screen.getByText('Rocket Bucks')).toBeInTheDocument();
    expect(screen.getByText('Create your account')).toBeInTheDocument();
    expect(screen.getByText(/Sign up with Google/i)).toBeInTheDocument();
  });

  it('has link to login page', () => {
    mockUseAuth.mockReturnValue({
      login: vi.fn(),
    });

    renderWithRouter(<Signup />, { route: '/signup' });

    const loginLink = screen.getByText('Sign in');
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');
  });

  it('calls login when Google button is clicked', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      login: mockLogin,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(<Signup />, { route: '/signup' });

    const signupButton = screen.getByText(/Sign up with Google/i);
    await user.click(signupButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state when signup is in progress', async () => {
    const mockLogin = vi.fn(
      () => new Promise(() => {}), // Never resolves
    );
    mockUseAuth.mockReturnValue({
      login: mockLogin,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(<Signup />, { route: '/signup' });

    const signupButton = screen.getByText(/Sign up with Google/i);
    await user.click(signupButton);

    await waitFor(() => {
      // Check for spinner
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
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

    renderWithRouter(<Signup />, { route: '/signup' });

    const signupButton = screen.getByText(/Sign up with Google/i).closest('button');
    expect(signupButton).toBeInTheDocument();
    await user.click(signupButton!);

    await waitFor(() => {
      expect(signupButton).toBeDisabled();
    });
  });
});

