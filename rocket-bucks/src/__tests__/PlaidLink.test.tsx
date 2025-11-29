import { screen, waitFor, fireEvent } from '@testing-library/react';
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
  let capturedConfig: any = null;

  beforeEach(() => {
    vi.mocked(usePlaidLink).mockImplementation((config) => {
      capturedConfig = config;
      return {
        open: openMock,
        ready: true,
      };
    });
  });

  afterEach(() => {
    openMock.mockReset();
    capturedConfig = null;
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

  it('shows loading state when not ready', async () => {
    vi.mocked(usePlaidLink).mockReturnValue({
      open: openMock,
      ready: false,
    });
    vi.mocked(api.createLinkToken).mockResolvedValue({ link_token: 'test-link' });

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} />);

    expect(screen.getByRole('button')).toHaveTextContent('Loading...');
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onSuccess callback when Plaid succeeds', async () => {
    vi.mocked(api.createLinkToken).mockResolvedValue({ link_token: 'test-link' });
    const onSuccess = vi.fn();

    renderWithRouter(<PlaidLink onSuccess={onSuccess} />);

    await waitFor(() => expect(capturedConfig).not.toBeNull());

    // Call the onSuccess from the captured config
    capturedConfig.onSuccess('public-token-123', { institution: 'Test Bank' });

    expect(onSuccess).toHaveBeenCalledWith('public-token-123', { institution: 'Test Bank' });
  });

  it('calls onExit callback when Plaid exits without error', async () => {
    vi.mocked(api.createLinkToken).mockResolvedValue({ link_token: 'test-link' });
    const onExit = vi.fn();

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} onExit={onExit} />);

    await waitFor(() => expect(capturedConfig).not.toBeNull());

    // Call the onExit from the captured config (no error)
    capturedConfig.onExit(null, { status: 'exited' });

    expect(onExit).toHaveBeenCalled();
  });

  it('calls onExit callback when Plaid exits with error', async () => {
    vi.mocked(api.createLinkToken).mockResolvedValue({ link_token: 'test-link' });
    const onExit = vi.fn();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} onExit={onExit} />);

    await waitFor(() => expect(capturedConfig).not.toBeNull());

    // Call the onExit from the captured config with error
    capturedConfig.onExit({ error_code: 'SOME_ERROR' }, { status: 'failed' });

    expect(onExit).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('renders children and opens Plaid on click when children are provided', async () => {
    vi.mocked(api.createLinkToken).mockResolvedValue({ link_token: 'test-link' });

    renderWithRouter(
      <PlaidLink onSuccess={vi.fn()}>
        <span>Custom Link</span>
      </PlaidLink>
    );

    await waitFor(() => expect(capturedConfig).not.toBeNull());

    const customLink = screen.getByText('Custom Link');
    expect(customLink).toBeInTheDocument();

    fireEvent.click(customLink);

    expect(openMock).toHaveBeenCalled();
  });

  it('does not open when children clicked but not ready', async () => {
    vi.mocked(usePlaidLink).mockImplementation((config) => {
      capturedConfig = config;
      return {
        open: openMock,
        ready: false,
      };
    });
    vi.mocked(api.createLinkToken).mockResolvedValue({ link_token: 'test-link' });

    renderWithRouter(
      <PlaidLink onSuccess={vi.fn()}>
        <span>Custom Link</span>
      </PlaidLink>
    );

    const customLink = screen.getByText('Custom Link');
    fireEvent.click(customLink);

    expect(openMock).not.toHaveBeenCalled();
  });

  it('shows Unauthorized error message', async () => {
    vi.mocked(api.createLinkToken).mockRejectedValue(
      new Error('Unauthorized access'),
    );

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Please log out and log back in'),
      );
    });
  });

  it('shows Invalid token error message', async () => {
    vi.mocked(api.createLinkToken).mockRejectedValue(
      new Error('Invalid token'),
    );

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Please log out and log back in'),
      );
    });
  });

  it('shows generic error message for other errors', async () => {
    vi.mocked(api.createLinkToken).mockRejectedValue(
      new Error('Unknown error'),
    );

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Make sure you\'re logged in'),
      );
    });
  });

  it('handles error with no message', async () => {
    vi.mocked(api.createLinkToken).mockRejectedValue({});

    renderWithRouter(<PlaidLink onSuccess={vi.fn()} />);

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining('Unknown error'),
      );
    });
  });
});
