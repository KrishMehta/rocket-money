import { screen, waitFor, fireEvent } from '@testing-library/react';
import NetWorth from '../pages/NetWorth';
import { api } from '../utils/api';
import { renderWithRouter } from '../test/utils';

vi.mock('../utils/api', () => ({
  api: {
    getAccounts: vi.fn(),
  },
}));

vi.mock('recharts', async () => {
  const React = await import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart-placeholder">{children}</div>
  );

  const NullComponent = () => null;

  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    Line: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
    CartesianGrid: NullComponent,
    Tooltip: NullComponent,
    ReferenceLine: NullComponent,
  };
});

const mockAccounts = [
  {
    id: 'acc-1',
    name: 'Checking Account',
    type: 'depository',
    subtype: 'checking',
    balance_current: 5000,
  },
  {
    id: 'acc-2',
    name: 'Savings Account',
    type: 'depository',
    subtype: 'savings',
    balance_current: 10000,
  },
  {
    id: 'acc-3',
    name: 'Investment Account',
    type: 'investment',
    subtype: 'brokerage',
    balance_current: 25000,
  },
  {
    id: 'acc-4',
    name: 'Credit Card',
    type: 'credit',
    subtype: 'credit card',
    balance_current: 2500,
  },
  {
    id: 'acc-5',
    name: 'Car Loan',
    type: 'loan',
    subtype: 'auto',
    balance_current: 15000,
  },
];

describe('NetWorth page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getAccounts).mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('loads and displays net worth data', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Net Worth/i })).toBeInTheDocument();
    });
  });

  it('handles error when loading accounts', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.getAccounts).mockRejectedValue(new Error('Failed to load'));

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Net Worth/i })).toBeInTheDocument();
    });

    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('displays assets section', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getAllByText(/Assets/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('displays debts section', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getAllByText(/Debt/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('displays summary section', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getAllByText(/Summary/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('shows empty state when no accounts are connected', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: [] });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getByText(/No assets connected yet/i)).toBeInTheDocument();
    });
  });

  it('shows tab buttons', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('has clickable tab buttons', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Net Worth/i })).toBeInTheDocument();
    }, { timeout: 2000 });

    // Verify tab buttons exist
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows period selector buttons', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '3M' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '6M' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '1Y' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'ALL' })).toBeInTheDocument();
    });
  });

  it('changes time period when period buttons are clicked', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1M' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '1M' }));
    expect(screen.getByRole('button', { name: '1M' })).toHaveClass('bg-gray-900');
  });

  it('displays no debts message when no debt accounts exist', async () => {
    const assetsOnly = mockAccounts.filter(a => a.type !== 'credit' && a.type !== 'loan');
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: assetsOnly });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      expect(screen.getByText(/No debts found - great job!/i)).toBeInTheDocument();
    });
  });

  it('navigates to connect accounts', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });

    renderWithRouter(<NetWorth />, { route: '/net-worth' });

    await waitFor(() => {
      const addButton = screen.getByRole('button', { name: /Add Account/i });
      expect(addButton.closest('a')).toHaveAttribute('href', '/connect-accounts');
    });
  });
});
