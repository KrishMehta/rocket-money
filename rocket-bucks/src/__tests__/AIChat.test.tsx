import { screen, waitFor, fireEvent } from '@testing-library/react';
import AIChat from '../pages/AIChat';
import { api } from '../utils/api';
import { renderWithRouter, userEvent } from '../test/utils';

vi.mock('../utils/api', () => ({
  api: {
    askFinancialAdvisor: vi.fn(),
  },
}));

describe('AIChat page', () => {
  beforeEach(() => {
    vi.mocked(api.askFinancialAdvisor).mockReset();
  });

  it('sends a user question and renders the AI reply with snapshot data', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Your spending is on track. Try saving $200 more each month.',
      context: {
        netWorth: 50000,
        monthlySpending: 2200,
        monthlyIncome: 4800,
        recurringTotal: 620,
      },
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    const user = userEvent.setup();
    await user.type(input, 'How am I doing this month?');
    await user.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(api.askFinancialAdvisor).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'How am I doing this month?',
          conversation: expect.arrayContaining([
            expect.objectContaining({ role: 'assistant' }),
          ]),
        }),
      ),
    );

    expect(
      await screen.findByText(/Your spending is on track/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Analyze my spending/i),
    ).not.toBeInTheDocument();
  });

  it('shows an error bubble when the advisor endpoint fails', async () => {
    vi.mocked(api.askFinancialAdvisor).mockRejectedValue(
      new Error('Service is unavailable'),
    );

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const user = userEvent.setup();
    await user.type(
      screen.getByPlaceholderText(/ask me anything/i),
      'Give me tips',
    );
    await user.click(screen.getByRole('button', { name: /send/i }));

    expect(
      await screen.findByText(/Service is unavailable/i),
    ).toBeInTheDocument();
  });

  it('shows quick actions initially and allows clicking them', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Here is your spending analysis.',
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    // Quick actions should be visible initially - use getAllByText since there may be duplicates
    const analyzeButtons = screen.getAllByText(/Analyze my spending/i);
    expect(analyzeButtons.length).toBeGreaterThan(0);

    // Click a quick action
    fireEvent.click(analyzeButtons[0]);

    await waitFor(() => {
      expect(api.askFinancialAdvisor).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Tell me about my spending patterns',
        }),
      );
    });
  });

  it('handles Enter key to send message', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Response to your query.',
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(api.askFinancialAdvisor).toHaveBeenCalled();
    });
  });

  it('does not send on Shift+Enter', async () => {
    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter', charCode: 13, shiftKey: true });

    expect(api.askFinancialAdvisor).not.toHaveBeenCalled();
  });

  it('shows typing indicator while waiting for response', async () => {
    let resolveResponse: (value: any) => void;
    vi.mocked(api.askFinancialAdvisor).mockImplementation(
      () => new Promise((resolve) => { resolveResponse = resolve; })
    );

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    // Input should be disabled while typing
    await waitFor(() => {
      expect(input).toBeDisabled();
    });

    // Resolve the response
    resolveResponse!({ message: 'Done typing now' });

    await waitFor(() => {
      expect(screen.getByText(/Done typing now/i)).toBeInTheDocument();
    });
  });

  it('displays spending change with positive value in red', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Analysis complete.',
      context: {
        netWorth: 10000,
        monthlySpending: 3000,
        spendingChange: 500,
        generatedAt: '2024-01-15T12:00:00Z',
      },
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Check spending' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/\+\$500/i)).toBeInTheDocument();
    });
  });

  it('displays spending change with negative value in green', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Analysis complete.',
      context: {
        netWorth: 10000,
        monthlySpending: 2000,
        spendingChange: -300,
      },
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Check spending' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/-\$300/i)).toBeInTheDocument();
    });
  });

  it('displays tracking message when spending change is not available', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Analysis complete.',
      context: {
        netWorth: 10000,
        monthlySpending: 2000,
      },
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Check spending' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Tracking activity/i)).toBeInTheDocument();
    });
  });

  it('renders ordered list from AI response', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Here are some tips:\n1. Save money\n2. Track expenses\n3. Budget wisely',
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Give tips' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Save money/i)).toBeInTheDocument();
      expect(screen.getByText(/Track expenses/i)).toBeInTheDocument();
    });
  });

  it('renders unordered list from AI response', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Key points:\n- First point\n- Second point\n- Third point',
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'List points' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/First point/i)).toBeInTheDocument();
    });
  });

  it('renders heading from AI response', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: '# Financial Summary\n\nYour finances look good.',
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Summary' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Financial Summary/i)).toBeInTheDocument();
    });
  });

  it('shows fallback message when response message is empty', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: '',
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Query' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/reviewing your finances/i)).toBeInTheDocument();
    });
  });

  it('shows fallback message when error has no message', async () => {
    vi.mocked(api.askFinancialAdvisor).mockRejectedValue({});

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/having trouble reaching/i)).toBeInTheDocument();
    });
  });

  it('does not send empty message', async () => {
    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();

    fireEvent.click(sendButton);
    expect(api.askFinancialAdvisor).not.toHaveBeenCalled();
  });

  it('does not allow actions while typing', async () => {
    let resolveResponse: (value: any) => void;
    vi.mocked(api.askFinancialAdvisor).mockImplementation(
      () => new Promise((resolve) => { resolveResponse = resolve; })
    );

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'First message' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    // While typing, input should be disabled
    await waitFor(() => {
      expect(input).toBeDisabled();
    });

    resolveResponse!({ message: 'Done' });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });

  it('displays data refreshed timestamp', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Here is your data.',
      context: {
        netWorth: 25000,
        generatedAt: '2024-01-15T10:30:00Z',
      },
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Show data' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText(/Data refreshed/i)).toBeInTheDocument();
    });
  });

  it('formats currency with proper decimal places', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'Your summary.',
      context: {
        netWorth: 500, // Small value should show decimals
        monthlySpending: 123.45,
      },
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Show' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('$500.00')).toBeInTheDocument();
    });
  });

  it('handles spending change of zero', async () => {
    vi.mocked(api.askFinancialAdvisor).mockResolvedValue({
      message: 'No change.',
      context: {
        netWorth: 10000,
        monthlySpending: 1000,
        spendingChange: 0,
      },
    });

    renderWithRouter(<AIChat />, { route: '/ai-chat' });

    const input = screen.getByPlaceholderText(/ask me anything/i);
    fireEvent.change(input, { target: { value: 'Check' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });

    // The zero spending change should show $0.00
    expect(screen.getByText('$0.00 vs last month')).toBeInTheDocument();
  });
});
