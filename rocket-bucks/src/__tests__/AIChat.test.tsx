import { screen, waitFor } from '@testing-library/react';
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
});
