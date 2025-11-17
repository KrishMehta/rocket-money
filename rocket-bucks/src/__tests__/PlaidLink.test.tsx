import { screen, waitFor } from '@testing-library/react';
import PlaidLink from '../components/PlaidLink';
import { api } from '../utils/api';
import { renderWithRouter, userEvent } from '../test/utils';
import { usePlaidLink } from 'react-plaid-link';

vi.mock('../utils/api', () => ({
  api: {
    createLinkToken: vi.fn(),
  },
}));

vi.mock('react-plaid-link', () => ({
  usePlaidLink: vi.fn(),
}));

describe('PlaidLink component', () => {
  const openMock = vi.fn();

  beforeEach(() => {
    vi.mocked(usePlaidLink).mockReturnValue({
      open: openMock,
      ready: true,
    });
  });

  afterEach(() => {
    openMock.mockReset();
  });

  it('requests a link token and opens Plaid when clicked', async () => {
    vi.mocked(api.createLinkToken).mockResolvedValue({ link_token: 'test-link' });
    const onSuccess = vi.fn();

    renderWithRouter(<PlaidLink onSuccess={onSuccess} />);

    await waitFor(() =>
      expect(api.createLinkToken).toHaveBeenCalledTimes(1),
    );

    await waitFor(() =>
      expect(usePlaidLink).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'test-link' }),
      ),
    );

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: /connect bank account/i }),
    );

    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it('alerts the user when the link token creation fails', async () => {
    vi.mocked(api.createLinkToken).mockRejectedValue(
      new Error('Network error: Cannot connect to server'),
    );

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize Plaid'),
      );
    });
  });
});
