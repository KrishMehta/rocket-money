import { screen, fireEvent, act } from '@testing-library/react';
import Performance from '../pages/Performance';
import { latencyTracker } from '../utils/latencyTracker';
import { renderWithRouter } from '../test/utils';

vi.mock('../utils/latencyTracker', () => ({
  latencyTracker: {
    getStats: vi.fn(),
    getBreakdownStats: vi.fn(),
    clear: vi.fn(),
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
    AreaChart: Passthrough,
    Area: NullComponent,
    XAxis: NullComponent,
    YAxis: NullComponent,
    CartesianGrid: NullComponent,
    Tooltip: NullComponent,
    ReferenceLine: NullComponent,
  };
});

const mockMeasurements = [
  {
    timestamp: Date.now() - 3600000,
    totalLatency: 150,
    accountsLatency: 40,
    transactionsLatency: 50,
    recurringLatency: 30,
    spendingTrendsLatency: 30,
  },
  {
    timestamp: Date.now() - 1800000,
    totalLatency: 200,
    accountsLatency: 50,
    transactionsLatency: 60,
    recurringLatency: 40,
    spendingTrendsLatency: 50,
  },
  {
    timestamp: Date.now(),
    totalLatency: 180,
    accountsLatency: 45,
    transactionsLatency: 55,
    recurringLatency: 35,
    spendingTrendsLatency: 45,
  },
];

const mockStats = {
  count: 3,
  average: 176.67,
  min: 150,
  max: 200,
  p50: 180,
  p95: 200,
  p99: 200,
  recentMeasurements: mockMeasurements,
};

const mockBreakdownStats = {
  accounts: { average: 45, min: 40, max: 50 },
  transactions: { average: 55, min: 50, max: 60 },
  recurring: { average: 35, min: 30, max: 40 },
  spendingTrends: { average: 41.67, min: 30, max: 50 },
};

describe('Performance page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(latencyTracker.getStats).mockReturnValue(mockStats);
    vi.mocked(latencyTracker.getBreakdownStats).mockReturnValue(mockBreakdownStats);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders performance metrics page', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText(/Performance Metrics/i)).toBeInTheDocument();
    expect(screen.getByText(/Dashboard Load Latency/i)).toBeInTheDocument();
  });

  it('displays average latency', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText('177ms')).toBeInTheDocument();
    expect(screen.getByText(/Based on 3 measurements/i)).toBeInTheDocument();
  });

  it('displays min, max, and p95 values', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText('Min: 150ms')).toBeInTheDocument();
    expect(screen.getByText('Max: 200ms')).toBeInTheDocument();
    expect(screen.getByText('P95: 200ms')).toBeInTheDocument();
  });

  it('displays statistics grid', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText('Minimum')).toBeInTheDocument();
    expect(screen.getByText('P50 (Median)')).toBeInTheDocument();
    expect(screen.getAllByText('P95').length).toBeGreaterThan(0);
    expect(screen.getByText('P99')).toBeInTheDocument();
  });

  it('displays breakdown by API call', () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText(/Breakdown by API Call/i)).toBeInTheDocument();
    expect(screen.getByText(/Accounts API/i)).toBeInTheDocument();
    expect(screen.getByText(/Transactions API/i)).toBeInTheDocument();
    expect(screen.getByText(/Recurring API/i)).toBeInTheDocument();
    // The component has multiple instances of "Spending Trends"
    expect(screen.getAllByText(/Spending Trends/i).length).toBeGreaterThan(0);
  });

  it('displays recent measurements table', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText(/Recent Measurements/i)).toBeInTheDocument();
    expect(screen.getByText(/Last 20 dashboard loads/i)).toBeInTheDocument();
  });

  it('shows empty state when no measurements exist', async () => {
    vi.mocked(latencyTracker.getStats).mockReturnValue({
      count: 0,
      average: 0,
      min: Infinity,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      recentMeasurements: [],
    });

    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText(/No latency measurements yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Navigate to the Dashboard to start collecting/i)).toBeInTheDocument();
  });

  it('clears data when clear button is clicked and confirmed', () => {
    window.confirm = vi.fn(() => true);
    
    renderWithRouter(<Performance />, { route: '/performance' });

    const clearButton = screen.getByRole('button', { name: /Clear Data/i });
    fireEvent.click(clearButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(latencyTracker.clear).toHaveBeenCalled();
    expect(latencyTracker.getStats).toHaveBeenCalled();
    expect(latencyTracker.getBreakdownStats).toHaveBeenCalled();
  });

  it('does not clear data when clear is cancelled', () => {
    window.confirm = vi.fn(() => false);
    
    renderWithRouter(<Performance />, { route: '/performance' });

    const clearButton = screen.getByRole('button', { name: /Clear Data/i });
    fireEvent.click(clearButton);

    expect(window.confirm).toHaveBeenCalled();
    expect(latencyTracker.clear).not.toHaveBeenCalled();
  });

  it('changes time window when dropdown is changed', () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    const dropdown = screen.getByRole('combobox');

    // Select "Last 24 Hours"
    fireEvent.change(dropdown, { target: { value: String(24 * 60 * 60 * 1000) } });

    expect(dropdown).toHaveValue(String(24 * 60 * 60 * 1000));
  });

  it('updates stats periodically', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    // Initial call
    expect(latencyTracker.getStats).toHaveBeenCalledTimes(1);

    // Advance time by 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Should have been called again
    expect(latencyTracker.getStats).toHaveBeenCalledTimes(2);
  });

  it('displays latency trend chart when measurements exist', () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText(/Latency Trend/i)).toBeInTheDocument();
    expect(screen.getByText(/Last 20 Measurements/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('chart-placeholder').length).toBeGreaterThan(0);
  });

  it('shows computation explanation', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText(/How We Compute Average Latency/i)).toBeInTheDocument();
    expect(screen.getByText(/Measurement:/i)).toBeInTheDocument();
    expect(screen.getByText(/Storage:/i)).toBeInTheDocument();
    expect(screen.getByText(/Computation:/i)).toBeInTheDocument();
    expect(screen.getByText(/Percentiles:/i)).toBeInTheDocument();
  });

  it('displays breakdown min/max for each API', () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    // Check for breakdown stats display - each API shows its min/max
    const minMaxTexts = screen.getAllByText(/Min:.*\| Max:/i);
    expect(minMaxTexts.length).toBeGreaterThan(0);
  });

  it('updates stats with time window filter', () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    const dropdown = screen.getByRole('combobox');

    // Select a time window
    fireEvent.change(dropdown, { target: { value: String(7 * 24 * 60 * 60 * 1000) } });

    // Advance to trigger update
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // getStats should be called with the time window
    expect(latencyTracker.getStats).toHaveBeenCalledWith(7 * 24 * 60 * 60 * 1000);
  });

  it('can switch back to all time', () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    const dropdown = screen.getByRole('combobox');

    // Select a time window first
    fireEvent.change(dropdown, { target: { value: String(24 * 60 * 60 * 1000) } });

    // Then switch back to "All Time"
    fireEvent.change(dropdown, { target: { value: 'all' } });

    // Advance to trigger update
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // getStats should be called without arguments (all time)
    expect(latencyTracker.getStats).toHaveBeenCalledWith();
  });

  it('displays timestamp in measurements table', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    // The table should contain timestamp column
    expect(screen.getByText('Timestamp')).toBeInTheDocument();
  });

  it('displays measurement breakdown columns', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Recurring')).toBeInTheDocument();
    expect(screen.getAllByText('Spending Trends').length).toBeGreaterThan(0);
  });

  it('displays singular measurement text correctly', async () => {
    vi.mocked(latencyTracker.getStats).mockReturnValue({
      ...mockStats,
      count: 1,
    });

    renderWithRouter(<Performance />, { route: '/performance' });

    expect(screen.getByText(/Based on 1 measurement$/i)).toBeInTheDocument();
  });

  it('shows formula for average calculation', async () => {
    renderWithRouter(<Performance />, { route: '/performance' });

    // Should show the formula with actual values
    expect(screen.getByText(/Average = /i)).toBeInTheDocument();
  });
});

