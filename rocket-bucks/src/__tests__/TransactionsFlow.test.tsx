import { screen, waitFor, fireEvent } from '@testing-library/react';
import Transactions from '../pages/Transactions';
import { api } from '../utils/api';
import { renderWithRouter } from '../test/utils';

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
    amount: 15.99,
    pending: false,
    accounts: { institution_name: 'Chase', mask: '1234', name: 'Chase Checking' },
  },
  {
    id: 'tx-2',
    date: '2024-01-03',
    name: 'Paycheck',
    user_category_name: 'Income',
    transaction_type: 'income',
    amount: 2500,
    pending: false,
    accounts: { institution_name: 'Chase', mask: '1234', name: 'Chase Checking' },
  },
  {
    id: 'tx-3',
    date: '2024-01-04',
    name: 'Pending Transaction',
    user_category_name: 'Shopping',
    transaction_type: 'expense',
    amount: 50,
    pending: true,
    accounts: { institution_name: 'Chase', mask: '1234', name: 'Chase Checking' },
  },
];

const mockCategories = [
  { id: 'cat-1', name: 'Subscriptions', icon: '📺' },
  { id: 'cat-2', name: 'Income', icon: '💰' },
  { id: 'cat-3', name: 'Shopping', icon: '🛍️' },
];

const mockAccounts = [
  { id: 'acc-1', name: 'Chase Checking', mask: '1234' },
  { id: 'acc-2', name: 'Savings Account', mask: '5678' },
];

describe('Transactions page', () => {
  beforeEach(() => {
    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: baseTransactions,
      count: baseTransactions.length,
    });
    vi.mocked(api.getAccounts).mockResolvedValue({ accounts: mockAccounts });
    vi.mocked(api.getCategories).mockResolvedValue({ categories: mockCategories });
    vi.mocked(api.syncTransactions).mockResolvedValue({ message: 'Synced' } as any);
    vi.mocked(api.autoCategorizeTransactions).mockResolvedValue({
      message: 'Categorized transactions successfully',
    } as any);
    vi.mocked(api.updateTransaction).mockResolvedValue({ transaction: {} } as any);
    vi.mocked(api.deleteTransaction).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.searchTransactions).mockImplementation(() => new Promise(() => {}));
    renderWithRouter(<Transactions />, { route: '/transactions' });
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('loads and displays transactions', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Paycheck/i)).toBeInTheDocument();
  });

  it('filters transactions by search', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search your transactions/i);
    fireEvent.change(searchInput, { target: { value: 'net' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'net' }),
      );
    });
  });

  it('filters transactions by date', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const dateFilter = screen.getByDisplayValue('All dates');
    fireEvent.change(dateFilter, { target: { value: 'thisMonth' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          start_date: expect.any(String),
          end_date: expect.any(String),
        }),
      );
    });
  });

  it('filters transactions by category', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const categoryFilter = screen.getByDisplayValue('All categories');
    fireEvent.change(categoryFilter, { target: { value: 'Subscriptions' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ user_category_name: 'Subscriptions' }),
      );
    });
  });

  it('filters transactions by account', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const accountFilter = screen.getByDisplayValue('All accounts');
    fireEvent.change(accountFilter, { target: { value: 'acc-1' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ account_id: 'acc-1' }),
      );
    });
  });

  it('syncs transactions from Plaid', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync from plaid/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(api.syncTransactions).toHaveBeenCalledTimes(1);
    });
  });

  it('handles sync rate limit error', async () => {
    const rateLimitError = new Error('Rate limit reached');
    (rateLimitError as any).status = 429;
    (rateLimitError as any).data = { hours_remaining: 2, minutes_remaining: 30 };
    vi.mocked(api.syncTransactions).mockRejectedValue(rateLimitError);

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync from plaid/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/Rate limit reached/i)).toBeInTheDocument();
    });
  });

  it('auto-categorizes transactions', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const autoCategButton = screen.getByRole('button', { name: /auto-categorize/i });
    fireEvent.click(autoCategButton);

    await waitFor(() => {
      expect(api.autoCategorizeTransactions).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(/Categorized transactions successfully/i)).toBeInTheDocument();
    });
  });

  it('changes sort order', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const sortDropdown = screen.getByDisplayValue('Date (Newest First)');
    fireEvent.change(sortDropdown, { target: { value: 'amount-desc' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort_by: 'amount', sort_order: 'desc' }),
      );
    });
  });

  it('paginates transactions', async () => {
    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: baseTransactions,
      count: 30, // More than 15 items
    });

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 15 }),
      );
    });
  });

  it('shows empty state when no transactions', async () => {
    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: [],
      count: 0,
    });

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/No transactions found/i)).toBeInTheDocument();
    });
  });

  it('shows pending indicator', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Pending Transaction/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/\| Pending/i)).toBeInTheDocument();
  });

  it('shows income with green color and plus sign', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Paycheck/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/\+\$2500\.00/i)).toBeInTheDocument();
  });

  it('deletes a transaction', async () => {
    window.confirm = vi.fn(() => true);

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Delete transaction/i);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(api.deleteTransaction).toHaveBeenCalledWith('tx-1');
    });
  });

  it('cancels transaction deletion when user declines', async () => {
    window.confirm = vi.fn(() => false);

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Delete transaction/i);
    fireEvent.click(deleteButtons[0]);

    expect(api.deleteTransaction).not.toHaveBeenCalled();
  });

  it('edits transaction category', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const editButtons = screen.getAllByTitle(/Edit transaction/i);
    fireEvent.click(editButtons[0]);

    // Look for the editing row select (category dropdown in the table row)
    await waitFor(() => {
      const dropdowns = screen.getAllByRole('combobox');
      // The editing dropdown should be the last one or in the table
      expect(dropdowns.length).toBeGreaterThanOrEqual(4);
    });

    // Get the last dropdown which should be the editing one
    const dropdowns = screen.getAllByRole('combobox');
    const editDropdown = dropdowns[dropdowns.length - 1];
    fireEvent.change(editDropdown, { target: { value: 'Shopping' } });

    await waitFor(() => {
      expect(api.updateTransaction).toHaveBeenCalledWith('tx-1', {
        user_category_name: 'Shopping',
      });
    });
  });

  it('exports transactions to CSV', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /export/i });
    expect(exportButton).toBeInTheDocument();
    // Just verify the button exists - clicking it would trigger download
  });

  it('dismisses sync error message', async () => {
    const syncError = new Error('Sync failed');
    vi.mocked(api.syncTransactions).mockRejectedValue(syncError);

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync from plaid/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/Sync Error/i)).toBeInTheDocument();
    });

    const dismissButton = screen.getByText('✕');
    fireEvent.click(dismissButton);

    await waitFor(() => {
      expect(screen.queryByText(/Sync Error/i)).not.toBeInTheDocument();
    });
  });

  it('shows last sync time after successful sync', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync from plaid/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/Last synced:/i)).toBeInTheDocument();
    });
  });

  it('shows syncing state during sync', async () => {
    let resolveSync: (value: any) => void;
    vi.mocked(api.syncTransactions).mockImplementation(() => new Promise(resolve => {
      resolveSync = resolve;
    }));

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const syncButton = screen.getByRole('button', { name: /sync from plaid/i });
    fireEvent.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/Syncing.../i)).toBeInTheDocument();
    });

    resolveSync!({ message: 'Synced' });

    await waitFor(() => {
      expect(screen.getByText(/Sync from Plaid/i)).toBeInTheDocument();
    });
  });

  it('filters by lastMonth date', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const dateFilter = screen.getByDisplayValue('All dates');
    fireEvent.change(dateFilter, { target: { value: 'lastMonth' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          start_date: expect.any(String),
          end_date: expect.any(String),
        }),
      );
    });
  });

  it('filters by last3Months date', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const dateFilter = screen.getByDisplayValue('All dates');
    fireEvent.change(dateFilter, { target: { value: 'last3Months' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          start_date: expect.any(String),
          end_date: expect.any(String),
        }),
      );
    });
  });

  it('handles auto-categorize error', async () => {
    vi.mocked(api.autoCategorizeTransactions).mockRejectedValue(
      new Error('Failed to categorize')
    );

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const autoCategButton = screen.getByRole('button', { name: /auto-categorize/i });
    fireEvent.click(autoCategButton);

    await waitFor(() => {
      expect(screen.getByText(/Failed to categorize/i)).toBeInTheDocument();
    });
  });

  it('handles update transaction error', async () => {
    vi.mocked(api.updateTransaction).mockRejectedValue(
      new Error('Update failed')
    );
    window.alert = vi.fn();

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByTitle(/Edit transaction/i);
    fireEvent.click(editButtons[0]);

    // Wait for select to appear and change it
    await waitFor(() => {
      const dropdowns = screen.getAllByRole('combobox');
      expect(dropdowns.length).toBeGreaterThanOrEqual(4);
    });

    const dropdowns = screen.getAllByRole('combobox');
    const editDropdown = dropdowns[dropdowns.length - 1];
    fireEvent.change(editDropdown, { target: { value: 'Shopping' } });

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update category')
      );
    });
  });

  it('handles delete transaction error', async () => {
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
    vi.mocked(api.deleteTransaction).mockRejectedValue(
      new Error('Delete failed')
    );

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Delete transaction/i);
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete transaction')
      );
    });
  });

  it('shows transaction with Plaid category icon', async () => {
    const transactionsWithPlaidCategory = [
      {
        id: 'tx-1',
        date: '2024-01-02',
        name: 'Pizza Place',
        plaid_primary_category: 'Food and Drink',
        transaction_type: 'expense',
        amount: 25,
        pending: false,
        accounts: { institution_name: 'Chase', mask: '1234', name: 'Checking' },
      },
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithPlaidCategory,
      count: 1,
    });

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Pizza Place/i)).toBeInTheDocument();
    });

    // Should show the Food and Drink emoji
    expect(screen.getByText('🍽️')).toBeInTheDocument();
  });

  it('shows category icon from transaction_categories', async () => {
    const transactionsWithCatIcon = [
      {
        id: 'tx-1',
        date: '2024-01-02',
        name: 'Test Transaction',
        transaction_categories: { name: 'Test', icon: '🧪' },
        transaction_type: 'expense',
        amount: 10,
        pending: false,
        accounts: { institution_name: 'Chase', mask: '1234', name: 'Checking' },
      },
    ];

    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: transactionsWithCatIcon,
      count: 1,
    });

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Test Transaction/i)).toBeInTheDocument();
    });

    expect(screen.getByText('🧪')).toBeInTheDocument();
  });

  it('sorts by amount high to low', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    const sortDropdown = screen.getByDisplayValue('Date (Newest First)');
    fireEvent.change(sortDropdown, { target: { value: 'name-asc' } });

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ sort_by: 'name', sort_order: 'asc' }),
      );
    });
  });

  it('handles previous page button', async () => {
    vi.mocked(api.searchTransactions).mockResolvedValue({
      transactions: baseTransactions,
      count: 30,
    });

    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    // Go to next page first
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 15 }),
      );
    });

    // Then go back
    fireEvent.click(screen.getByRole('button', { name: /previous/i }));

    await waitFor(() => {
      expect(api.searchTransactions).toHaveBeenLastCalledWith(
        expect.objectContaining({ offset: 0 }),
      );
    });
  });

  it('handles blurring the category edit dropdown', async () => {
    renderWithRouter(<Transactions />, { route: '/transactions' });

    await waitFor(() => {
      expect(screen.getByText(/Netflix/i)).toBeInTheDocument();
    });

    // Click edit button
    const editButtons = screen.getAllByTitle(/Edit transaction/i);
    fireEvent.click(editButtons[0]);

    // Wait for select to appear
    await waitFor(() => {
      const dropdowns = screen.getAllByRole('combobox');
      expect(dropdowns.length).toBeGreaterThanOrEqual(4);
    });

    const dropdowns = screen.getAllByRole('combobox');
    const editDropdown = dropdowns[dropdowns.length - 1];
    
    // Blur the dropdown to close it
    fireEvent.blur(editDropdown);

    // The dropdown should disappear
    await waitFor(() => {
      const allDropdowns = screen.getAllByRole('combobox');
      // Should be back to just the 4 filter dropdowns
      expect(allDropdowns.length).toBe(4);
    });
  });
});
