import { screen, waitFor, fireEvent } from '@testing-library/react';
import Recurring from '../pages/Recurring';
import { api } from '../utils/api';
import { renderWithRouter } from '../test/utils';

vi.mock('../utils/api', () => ({
  api: {
    getRecurring: vi.fn(),
    syncRecurringTransactions: vi.fn(),
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
    Legend: NullComponent,
  };
});

const recurringSample = [
  {
    id: 'rec-1',
    name: 'Spotify Premium',
    expected_amount: 12.99,
    frequency: 'monthly',
    days_until_due: 3,
    due_in: 'In 3 days',
    transaction_type: 'expense',
    is_subscription: true,
    accounts: { mask: '1111' },
    last_transaction_date: new Date().toISOString(),
  },
  {
    id: 'rec-2',
    name: 'Mortgage Payment',
    expected_amount: 1800,
    frequency: 'monthly',
    days_until_due: 15,
    due_in: 'In 15 days',
    transaction_type: 'expense',
    is_subscription: false,
    accounts: { mask: '2222' },
    last_transaction_date: new Date().toISOString(),
  },
  {
    id: 'rec-3',
    name: 'Weekly Newsletter',
    expected_amount: 5,
    frequency: 'weekly',
    days_until_due: 5,
    due_in: 'In 5 days',
    transaction_type: 'expense',
    is_subscription: true,
    last_transaction_date: new Date().toISOString(),
  },
  {
    id: 'rec-4',
    name: 'Quarterly Insurance',
    expected_amount: 500,
    frequency: 'quarterly',
    days_until_due: 20,
    due_in: 'In 20 days',
    transaction_type: 'expense',
    is_subscription: false,
    last_transaction_date: new Date().toISOString(),
  },
  {
    id: 'rec-5',
    name: 'Annual Subscription',
    expected_amount: 100,
    frequency: 'annually',
    days_until_due: 25,
    due_in: 'In 25 days',
    transaction_type: 'expense',
    is_subscription: true,
    last_transaction_date: new Date().toISOString(),
  },
];

describe('Recurring page', () => {
  beforeEach(() => {
    vi.mocked(api.getRecurring).mockResolvedValue({ recurring: recurringSample });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state initially', () => {
    vi.mocked(api.getRecurring).mockImplementation(() => new Promise(() => {}));
    renderWithRouter(<Recurring />, { route: '/recurring' });
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('renders upcoming recurring charges', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/Spotify Premium/i)).toBeInTheDocument();
    expect(screen.getByText(/Next 7 Days/i)).toBeInTheDocument();
    expect(screen.getByText(/Coming Later/i)).toBeInTheDocument();
  });

  it('switches to View All tab', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      // View All tab shows search input and monthly breakdown
      expect(screen.getByPlaceholderText(/Search bills and subscriptions/i)).toBeInTheDocument();
    });
  });

  it('switches to Calendar tab', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sun/i)).toBeInTheDocument();
      expect(screen.getByText(/Mon/i)).toBeInTheDocument();
    });
  });

  it('filters subscriptions with search', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Search bills and subscriptions/i)).toBeInTheDocument();
    });

    const searchBox = screen.getByPlaceholderText(/Search bills and subscriptions/i);
    fireEvent.change(searchBox, { target: { value: 'mort' } });

    await waitFor(() => {
      expect(screen.queryByText(/Spotify Premium/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/Mortgage Payment/i)).toBeInTheDocument();
  });

  it('toggles sort dropdown', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by/i)).toBeInTheDocument();
    });

    // Click sort dropdown
    const sortButton = screen.getByText(/Sort by/i);
    fireEvent.click(sortButton);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Name$/i })).toBeInTheDocument();
    });
  });

  it('sorts by name', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Sort by/i));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Name$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Name$/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by name/i)).toBeInTheDocument();
    });
  });

  it('sorts by amount', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Sort by/i));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Amount$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Amount$/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by amount/i)).toBeInTheDocument();
    });
  });

  it('sorts by due date', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Sort by/i));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Due Date$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Due Date$/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by due/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no charges in next 7 days', async () => {
    vi.mocked(api.getRecurring).mockResolvedValue({
      recurring: [
        {
          id: 'rec-1',
          name: 'Far Future',
          expected_amount: 100,
          frequency: 'monthly',
          days_until_due: 25,
          due_in: 'In 25 days',
          transaction_type: 'expense',
          is_subscription: true,
        },
      ],
    });

    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByText(/No charges in the next 7 days/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no recurring transactions', async () => {
    vi.mocked(api.getRecurring).mockResolvedValue({ recurring: [] });

    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/No subscriptions found/i)).toBeInTheDocument();
      expect(screen.getByText(/No bills found/i)).toBeInTheDocument();
    });
  });

  it('handles API error gracefully', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.getRecurring).mockRejectedValue(new Error('API Error'));

    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalled();
    });

    consoleError.mockRestore();
  });

  it('displays monthly breakdown chart', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Monthly Breakdown/i)).toBeInTheDocument();
    });
  });

  it('displays yearly total in view all tab', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getAllByText(/\/yearly/i).length).toBeGreaterThan(0);
    });
  });

  it('closes sort dropdown when clicking outside', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by/i)).toBeInTheDocument();
    });

    // Open dropdown
    fireEvent.click(screen.getByText(/Sort by/i));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Name$/i })).toBeInTheDocument();
    });

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Name$/i })).not.toBeInTheDocument();
    });
  });

  it('sorts by type', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View All/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by/i)).toBeInTheDocument();
    });

    // First change to a different sort, then change to type
    fireEvent.click(screen.getByText(/Sort by/i));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Name$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Name$/i }));
    
    // Now switch to type
    await waitFor(() => {
      expect(screen.getByText(/Sort by name/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Sort by name/i));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Type$/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Type$/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sort by type/i)).toBeInTheDocument();
    });
  });

  it('displays events on calendar for current month', async () => {
    // Create a recurring transaction that's due today
    const today = new Date();
    const recurringWithToday = [
      {
        id: 'rec-today',
        name: 'Today Payment',
        expected_amount: 50,
        frequency: 'monthly',
        days_until_due: 0,
        due_in: 'Today',
        transaction_type: 'expense',
        is_subscription: true,
        accounts: { mask: '1234' },
        last_transaction_date: today.toISOString(),
      },
    ];

    vi.mocked(api.getRecurring).mockResolvedValue({ recurring: recurringWithToday });

    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sun/i)).toBeInTheDocument();
    });

    // The calendar should show multiple date cells
    const dateCells = screen.getAllByText(today.getDate().toString());
    expect(dateCells.length).toBeGreaterThan(0);
  });

  it('filters interest payments from recurring list', async () => {
    const recurringWithInterest = [
      ...recurringSample,
      {
        id: 'rec-interest',
        name: 'Interest Payment',
        expected_amount: 25,
        frequency: 'monthly',
        days_until_due: 10,
        due_in: 'In 10 days',
        transaction_type: 'expense',
        is_subscription: false,
      },
    ];

    vi.mocked(api.getRecurring).mockResolvedValue({ recurring: recurringWithInterest });

    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    // Interest payment should be filtered out
    expect(screen.queryByText(/Interest Payment/i)).not.toBeInTheDocument();
  });

  it('shows multiple transactions on same calendar day', async () => {
    // Create multiple recurring transactions due in the next few days
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    
    const recurringMultiple = [
      {
        id: 'rec-1',
        name: 'Netflix',
        expected_amount: 15,
        frequency: 'monthly',
        days_until_due: 5,
        due_in: 'In 5 days',
        transaction_type: 'expense',
        is_subscription: true,
        last_transaction_date: futureDate.toISOString(),
      },
      {
        id: 'rec-2',
        name: 'Spotify',
        expected_amount: 10,
        frequency: 'monthly',
        days_until_due: 5,
        due_in: 'In 5 days',
        transaction_type: 'expense',
        is_subscription: true,
        last_transaction_date: futureDate.toISOString(),
      },
    ];

    vi.mocked(api.getRecurring).mockResolvedValue({ recurring: recurringMultiple });

    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sun/i)).toBeInTheDocument();
    });
  });

  it('navigates calendar months', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Recurring/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Calendar/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/Sun/i)).toBeInTheDocument();
    });

    // Find navigation buttons (using the actual characters ‹ and ›)
    const prevButton = screen.getByRole('button', { name: '‹' });
    const nextButton = screen.getByRole('button', { name: '›' });
    
    expect(prevButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();

    // Click next month
    fireEvent.click(nextButton);

    // Click previous month
    fireEvent.click(prevButton);
  });
});
