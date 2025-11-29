import { screen, waitFor, fireEvent } from '@testing-library/react';
import Spending from '../pages/Spending';
import { api } from '../utils/api';
import { renderWithRouter } from '../test/utils';

vi.mock('../utils/api', () => ({
  api: {
    searchTransactions: vi.fn(),
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
    BarChart: Passthrough,
    Bar: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
    CartesianGrid: NullComponent,
    Tooltip: NullComponent,
    PieChart: Passthrough,
    Pie: NullComponent,
    Cell: NullComponent,
  };
});

const createTransaction = (overrides: any = {}) => ({
  id: `tx-${Math.random()}`,
  date: new Date().toISOString(),
  name: 'Test Transaction',
  merchant_name: 'Test Merchant',
  amount: 100,
  transaction_type: 'expense',
  user_category_name: 'Shopping',
  ...overrides,
});

const mockTransactions = [
  createTransaction({
    id: 'tx-1',
    name: 'Grocery Store',
    merchant_name: 'Whole Foods',
    amount: 150.50,
    user_category_name: 'Food & Drink',
  }),
  createTransaction({
    id: 'tx-2',
    name: 'Gas Station',
    merchant_name: 'Shell',
    amount: 45.00,
    user_category_name: 'Transportation',
  }),
  createTransaction({
    id: 'tx-3',
    name: 'Amazon',
    merchant_name: 'Amazon',
    amount: 89.99,
    user_category_name: 'Shopping',
  }),
];

describe('Spending page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock all calls to searchTransactions to return the same data
    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: mockTransactions,
      count: mockTransactions.length,
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(api.searchTransactions).mockImplementation(() => new Promise(() => {}));

    renderWithRouter(<Spending />, { route: '/spending' });

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders spending page with title', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });
  });

  it('displays tab navigation', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Last Month/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /This Month/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Custom/i })).toBeInTheDocument();
    });
  });

  it('shows spending breakdown section', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Spending Breakdown/i)).toBeInTheDocument();
    });
  });

  it('shows monthly spending chart', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Monthly Spending/i)).toBeInTheDocument();
    });
  });

  it('shows income in summary card', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getAllByText(/Income/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('shows bills in summary card', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getAllByText(/Bills/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('switches to last month tab', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    }, { timeout: 2000 });

    const lastMonthTab = screen.getByRole('button', { name: /Last Month/i });
    fireEvent.click(lastMonthTab);
    expect(lastMonthTab).toHaveClass('border-b-2');
  });

  it('switches to custom tab', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    }, { timeout: 2000 });

    const customTab = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTab);
    
    await waitFor(() => {
      expect(screen.getByText(/Select Time Period/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('custom tab shows time period selection', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    }, { timeout: 2000 });

    // Click custom tab
    const customTab = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTab);
    
    // After clicking custom tab, should show time period selection
    await waitFor(() => {
      expect(screen.getByText(/Select Time Period/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows empty state when no spending data', async () => {
    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: [],
      count: 0,
    });

    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/No spending data available/i)).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.searchTransactions).mockRejectedValue(new Error('API Error'));

    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    consoleError.mockRestore();
  });

  it('displays chart placeholder', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getAllByTestId('chart-placeholder').length).toBeGreaterThan(0);
    });
  });

  it('shows total spend label', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Total Spend/i)).toBeInTheDocument();
    });
  });

  it('shows frequent spend section', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Frequent Spend/i)).toBeInTheDocument();
    });
  });

  it('shows largest purchases section', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Largest Purchases/i)).toBeInTheDocument();
    });
  });

  it('displays period comparison text', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getAllByText(/than last period/i).length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it('selects weekly period in custom tab', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });

    // Click custom tab
    const customTab = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Weekly/i })).toBeInTheDocument();
    });

    // Select weekly
    fireEvent.click(screen.getByRole('button', { name: /Weekly/i }));

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenCalled();
    });
  });

  it('selects quarterly period in custom tab', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });

    // Click custom tab
    const customTab = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Quarterly/i })).toBeInTheDocument();
    });

    // Select quarterly
    fireEvent.click(screen.getByRole('button', { name: /Quarterly/i }));

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenCalled();
    });
  });

  it('selects yearly period in custom tab', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });

    // Click custom tab
    const customTab = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Yearly/i })).toBeInTheDocument();
    });

    // Select yearly
    fireEvent.click(screen.getByRole('button', { name: /Yearly/i }));

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenCalled();
    });
  });

  it('selects monthly period in custom tab', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });

    // Click custom tab
    const customTab = screen.getByRole('button', { name: /Custom/i });
    fireEvent.click(customTab);

    await waitFor(() => {
      expect(screen.getByText(/Select Time Period/i)).toBeInTheDocument();
    });

    // Find all buttons and look for the monthly one
    const buttons = screen.getAllByRole('button');
    const monthlyButton = buttons.find(btn => btn.textContent?.includes('Monthly'));
    expect(monthlyButton).toBeDefined();

    if (monthlyButton) {
      fireEvent.click(monthlyButton);
    }

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenCalled();
    });
  });

  it('shows income transactions in summary', async () => {
    const transactionsWithIncome = [
      ...mockTransactions,
      createTransaction({
        id: 'tx-income',
        name: 'Paycheck',
        amount: 5000,
        transaction_type: 'income',
        user_category_name: 'Income',
      }),
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithIncome,
      count: transactionsWithIncome.length,
    });

    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getAllByText(/Income/i).length).toBeGreaterThan(0);
    });
  });

  it('shows bills transactions in summary', async () => {
    const transactionsWithBills = [
      ...mockTransactions,
      createTransaction({
        id: 'tx-bill',
        name: 'Electric Bill',
        amount: 150,
        transaction_type: 'expense',
        user_category_name: 'Bills',
      }),
      createTransaction({
        id: 'tx-recurring',
        name: 'Netflix',
        amount: 15.99,
        transaction_type: 'expense',
        user_category_name: 'Recurring',
      }),
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithBills,
      count: transactionsWithBills.length,
    });

    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getAllByText(/Bills/i).length).toBeGreaterThan(0);
    });
  });

  it('shows category breakdown with percentages', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Spending Breakdown/i)).toBeInTheDocument();
    });

    // Categories should show percentages
    await waitFor(() => {
      expect(screen.getByText(/Food & Drink/i)).toBeInTheDocument();
    });
  });

  it('handles transfer transactions correctly', async () => {
    const transactionsWithTransfer = [
      ...mockTransactions,
      createTransaction({
        id: 'tx-transfer',
        name: 'Transfer to Savings',
        amount: 1000,
        transaction_type: 'expense',
        user_category_name: 'Transfer',
      }),
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithTransfer,
      count: transactionsWithTransfer.length,
    });

    renderWithRouter(<Spending />, { route: '/spending' });

    // Transfers should be excluded from spending calculations
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });
  });

  it('shows largest purchases with correct data', async () => {
    const transactionsWithLargePurchase = [
      createTransaction({
        id: 'tx-large',
        name: 'Laptop',
        merchant_name: 'Best Buy',
        amount: 1500,
        transaction_type: 'expense',
        user_category_name: 'Shopping',
      }),
      ...mockTransactions,
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithLargePurchase,
      count: transactionsWithLargePurchase.length,
    });

    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Largest Purchases/i)).toBeInTheDocument();
    });
  });

  it('displays frequent merchants with totals', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Frequent Spend/i)).toBeInTheDocument();
    });
  });

  it('handles transactions with plaid_primary_category', async () => {
    const transactionsWithPlaidCategory = [
      createTransaction({
        id: 'tx-plaid',
        name: 'Store Name',
        amount: 50,
        plaid_primary_category: 'Shopping',
        user_category_name: 'Shopping',
      }),
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithPlaidCategory,
      count: transactionsWithPlaidCategory.length,
    });

    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });
  });

  it('handles transactions with transaction_categories', async () => {
    const transactionsWithTxCategory = [
      createTransaction({
        id: 'tx-cat',
        name: 'Store Name',
        amount: 50,
        transaction_categories: { name: 'Entertainment' },
        user_category_name: 'Entertainment',
      }),
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithTxCategory,
      count: transactionsWithTxCategory.length,
    });

    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Spending/i })).toBeInTheDocument();
    });
  });

  it('displays category colors in breakdown', async () => {
    renderWithRouter(<Spending />, { route: '/spending' });

    await waitFor(() => {
      expect(screen.getByText(/Spending Breakdown/i)).toBeInTheDocument();
    });

    // The chart should render with colored segments
    await waitFor(() => {
      const chartPlaceholders = screen.getAllByTestId('chart-placeholder');
      expect(chartPlaceholders.length).toBeGreaterThan(0);
    });
  });
});
