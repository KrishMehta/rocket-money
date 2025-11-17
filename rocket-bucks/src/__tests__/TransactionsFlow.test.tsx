import { screen, waitFor } from '@testing-library/react';
import Transactions from '../pages/Transactions';
import { api } from '../utils/api';
import { renderWithRouter, userEvent } from '../test/utils';

vi.mock('../utils/api', () => ({
  api: {
    searchTransactions: vi.fn(),
    getAccounts: vi.fn(),
    getCategories: vi.fn(),
    syncTransactions: vi.fn(),
    autoCategorizeTransactions: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
  },
}));

const baseTransactions = [
  {
    id: 'tx-1',
    date: '2024-01-02',
    name: 'Netflix',
    user_category_name: 'Subscriptions',
    plaid_primary_category: 'Shops',
    transaction_type: 'expense',
    amount: -15.99,
    pending: false,
    accounts: { institution_name: 'Chase', mask: '1234' },
  },
  {
    id: 'tx-2',
    date: '2024-01-03',
    name: 'Paycheck',
    user_category_name: 'Income',
    transaction_type: 'income',
    amount: 2500,
    pending: false,
    accounts: { institution_name: 'Chase', mask: '1234' },
  },
];

describe('Transactions page', () => {
  beforeEach(() => {
    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: baseTransactions,
      count: baseTransactions.length,
    });
    vi.mocked(api.getAccounts).mockResolvedValue({
      accounts: [{ id: 'acc-1', name: 'Chase Checking', mask: '1234' }],
    });
    vi.mocked(api.getCategories).mockResolvedValue({
      categories: [{ id: 'cat-1', name: 'Subscriptions' }],
    });
    vi.mocked(api.syncTransactions).mockResolvedValue({ message: 'Synced' } as any);
    vi.mocked(api.autoCategorizeTransactions).mockResolvedValue({
      message: 'Categorized transactions successfully',
    } as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads transactions, filters them, and renders the ledger', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => expect(api.searchTransactions).toHaveBeenCalled());

    expect(await screen.findByText(/Netflix/i)).toBeInTheDocument();
    expect(screen.getByText(/\+\$2500\.00/)).toBeInTheDocument();

    expect(api.searchTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 15,
        offset: 0,
        sort_by: 'date',
        sort_order: 'desc',
      }),
    );

    const searchInput = screen.getByPlaceholderText(/search your transactions/i);
    const user = userEvent.setup();
    await user.clear(searchInput);
    await user.type(searchInput, 'net');

    await waitFor(() =>
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'net' }),
      ),
    );
  });

  it('allows the user to sync from Plaid and auto-categorize results', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => expect(api.searchTransactions).toHaveBeenCalled());

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /sync from plaid/i }));
    await waitFor(() => expect(api.syncTransactions).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /auto-categorize/i }));

    await waitFor(() =>
      expect(api.autoCategorizeTransactions).toHaveBeenCalledTimes(1),
    );

    expect(
      await screen.findByText(/Auto-Categorization/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Categorized transactions successfully/i),
    ).toBeInTheDocument();
  });
});
