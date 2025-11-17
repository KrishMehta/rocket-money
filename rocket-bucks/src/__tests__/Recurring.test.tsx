import { screen, waitFor } from '@testing-library/react';
import Recurring from '../pages/Recurring';
import { api } from '../utils/api';
import { renderWithRouter, userEvent } from '../test/utils';

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
  },
];

describe('Recurring page', () => {
  beforeEach(() => {
    vi.mocked(api.getRecurring).mockResolvedValue({ recurring: recurringSample });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders upcoming recurring charges and subscription summaries', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    expect(await screen.findByText(/Recurring/i)).toBeInTheDocument();
    expect(await screen.findByText(/Spotify Premium/i)).toBeInTheDocument();

    const viewAllTab = await screen.findByRole('button', { name: /view all/i });

    const user = userEvent.setup();
    await user.click(viewAllTab);

    expect(await screen.findByText(/Subscription/i)).toBeInTheDocument();
    expect(screen.getByText(/Spotify Premium/i)).toBeInTheDocument();
  });

  it('filters subscriptions and bills with the search input', async () => {
    renderWithRouter(<Recurring />, { route: '/recurring' });

    const user = userEvent.setup();
    const viewAllTab = await screen.findByRole('button', { name: /view all/i });
    await user.click(viewAllTab);

    const searchBox = await screen.findByPlaceholderText(
      /Search bills and subscriptions/i,
    );

    await user.type(searchBox, 'mort');

    await waitFor(() =>
      expect(screen.queryByText(/Spotify Premium/i)).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/Mortgage Payment/i)).toBeInTheDocument();
  });
});
