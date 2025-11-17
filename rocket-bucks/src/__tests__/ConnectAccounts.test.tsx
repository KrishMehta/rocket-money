import { screen, waitFor } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../test/utils';
import ConnectAccounts from '../pages/ConnectAccounts';
import { api } from '../utils/api';

vi.mock('../utils/api', () => ({
  api: {
    getAccounts: vi.fn(),
    exchangePublicToken: vi.fn(),
  },
}));

vi.mock('../components/PlaidLink', async () => {
  const React = await import('react');
  return {
    default: ({ onSuccess, children }: any) => {
      if (React.isValidElement(children)) {
        return React.cloneElement(children, {
          onClick: () => onSuccess('mock-public-token', {
            institution: { name: 'Mock Institution' },
          }),
        });
      }

      return (
        <button type="button" onClick={() => onSuccess('mock-public-token', {})}>
          Trigger Plaid
        </button>
      );
    },
  };
});

describe('ConnectAccounts page', () => {
  beforeEach(() => {
    vi.mocked(api.getAccounts).mockReset();
    vi.mocked(api.exchangePublicToken).mockReset();
  });

  it('shows connected accounts from the API', async () => {
    vi.mocked(api.getAccounts).mockResolvedValue({
      accounts: [
        {
          id: 'acc-1',
          name: 'Everyday Checking',
          type: 'depository',
          subtype: 'checking',
          mask: '1234',
          balance_current: 2500,
          institution_name: 'First Bank',
        },
      ],
    });

    renderWithRouter(<ConnectAccounts />, { route: '/connect-accounts' });

    await waitFor(() => expect(api.getAccounts).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Everyday Checking/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Connected Accounts/i)).toBeInTheDocument();
  });

  it('exchanges the Plaid token and refreshes the account list', async () => {
    vi.mocked(api.getAccounts)
      .mockResolvedValueOnce({
        accounts: [
          {
            id: 'acc-1',
            name: 'Everyday Checking',
            type: 'depository',
            subtype: 'checking',
            mask: '1234',
            balance_current: 2500,
            institution_name: 'First Bank',
          },
        ],
      })
      .mockResolvedValueOnce({
        accounts: [
          {
            id: 'acc-1',
            name: 'Everyday Checking',
            type: 'depository',
            subtype: 'checking',
            mask: '1234',
            balance_current: 2500,
            institution_name: 'First Bank',
          },
          {
            id: 'acc-2',
            name: 'Travel Card',
            type: 'credit',
            subtype: 'credit card',
            mask: '4321',
            balance_current: 1500,
            institution_name: 'Mock State',
          },
        ],
      });

    vi.mocked(api.exchangePublicToken).mockResolvedValue({
      access_token: 'access',
      item_id: 'item',
      accounts: [],
      institution_name: 'Mock State',
      transactions_synced: true,
    } as any);

    renderWithRouter(<ConnectAccounts />, { route: '/connect-accounts' });

    await waitFor(() => expect(api.getAccounts).toHaveBeenCalled());

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: /connect bank account with plaid/i }),
    );

    await waitFor(() =>
      expect(api.exchangePublicToken).toHaveBeenCalledWith(
        'mock-public-token',
      ),
    );
    await waitFor(() => expect(api.getAccounts).toHaveBeenCalledTimes(2));

    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Mock State'),
    );
    expect(
      await screen.findByText(/Travel Card/i),
    ).toBeInTheDocument();
  });
});
