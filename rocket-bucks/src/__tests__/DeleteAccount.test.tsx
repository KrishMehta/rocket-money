import { screen, waitFor, fireEvent } from '@testing-library/react';
import DeleteAccount from '../pages/DeleteAccount';
import { api } from '../utils/api';
import { renderWithRouter } from '../test/utils';

vi.mock('../utils/api', () => ({
  api: {
    getAccounts: vi.fn(),
    getApiUrl: vi.fn(() => 'http://localhost:3001/api'),
    getAuthHeaders: vi.fn(() => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test-token' })),
  },
}));

// Mock AuthContext
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
};

vi.mock('../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../contexts/AuthContext');
  return {
    ...actual,
    useAuth: () => ({
      user: mockUser,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    }),
  };
});

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'Checking Account',
    type: 'depository',
    subtype: 'checking',
    balance_current: 5000,
    institution_name: 'Test Bank',
    plaid_item_id: 'item-1',
    mask: '1234',
  },
  {
    id: 'acc-2',
    name: 'Savings Account',
    type: 'depository',
    subtype: 'savings',
    balance_current: 10000,
    institution_name: 'Test Bank',
    plaid_item_id: 'item-1',
    mask: '5678',
  },
];

describe('DeleteAccount page', () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    alertSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it('shows loading state initially', async () => {
    vi.mocked(api.getAccounts).mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('loads and displays account data', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Connected accounts count
  });

  it('handles error when loading accounts', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.getAccounts).mockRejectedValue(new Error('Failed to load'));

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('navigates back to dashboard when back button is clicked', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: [] });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const backButton = screen.getByText(/Back to Dashboard/i);
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('navigates to connect accounts when alternative button is clicked', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: [] });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const connectButton = screen.getByText(/Go to Connect Accounts/i);
    fireEvent.click(connectButton);

    expect(mockNavigate).toHaveBeenCalledWith('/connect-accounts');
  });

  it('button is disabled when confirmation text does not match', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(input, { target: { value: 'wrong text' } });

    const deleteButton = screen.getByText(/Permanently Delete My Account/i);
    // Button should be disabled when text doesn't match
    expect(deleteButton).toBeDisabled();
  });

  it('shows mismatch message when typing incorrect confirmation', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(input, { target: { value: 'wrong' } });

    expect(screen.getByText(/Text doesn't match/i)).toBeInTheDocument();
  });

  it('enables delete button only when confirmation text matches', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const deleteButton = screen.getByText(/Permanently Delete My Account/i);
    expect(deleteButton).toBeDisabled();

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(input, { target: { value: 'DELETE MY ACCOUNT' } });

    expect(deleteButton).not.toBeDisabled();
  });

  it('cancels delete when user declines final confirmation', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });
    confirmSpy.mockReturnValue(false);

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(input, { target: { value: 'DELETE MY ACCOUNT' } });

    const deleteButton = screen.getByText(/Permanently Delete My Account/i);
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('/login');
  });

  it('successfully deletes account and redirects to login', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });
    confirmSpy.mockReturnValue(true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        deleted_plaid_items: 1,
        deleted_accounts: 2,
        deleted_transactions: 50,
        message: 'Account deleted successfully',
      }),
    });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(input, { target: { value: 'DELETE MY ACCOUNT' } });

    const deleteButton = screen.getByText(/Permanently Delete My Account/i);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login');
    expect(localStorage.getItem('supabase.auth.token')).toBeNull();
  });

  it('handles delete API error', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });
    confirmSpy.mockReturnValue(true);

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(input, { target: { value: 'DELETE MY ACCOUNT' } });

    const deleteButton = screen.getByText(/Permanently Delete My Account/i);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete account'));
    });
  });

  it('shows deleting state during deletion', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });
    confirmSpy.mockReturnValue(true);

    let resolveDelete: (value: any) => void;
    global.fetch = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveDelete = resolve;
    }));

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('DELETE MY ACCOUNT');
    fireEvent.change(input, { target: { value: 'DELETE MY ACCOUNT' } });

    const deleteButton = screen.getByText(/Permanently Delete My Account/i);
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/Deleting Account/i)).toBeInTheDocument();
    });

    // Resolve the pending request
    resolveDelete!({
      ok: true,
      json: () => Promise.resolve({
        deleted_plaid_items: 1,
        deleted_accounts: 2,
        deleted_transactions: 50,
        message: 'Account deleted successfully',
      }),
    });
  });

  it('displays all delete warning items', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<DeleteAccount />, { route: '/delete-account' });

    await waitFor(() => {
      expect(screen.getByText(/Delete Account/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Your user account and login credentials/i)).toBeInTheDocument();
    expect(screen.getByText(/All 2 connected bank account/i)).toBeInTheDocument();
    expect(screen.getByText(/All transaction history/i)).toBeInTheDocument();
    expect(screen.getByText(/All recurring transaction data/i)).toBeInTheDocument();
    expect(screen.getByText(/All spending insights and analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/All net worth tracking data/i)).toBeInTheDocument();
  });
});

