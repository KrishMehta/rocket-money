import { screen } from '@testing-library/react';
import Layout from '../components/Layout';
import { renderWithRouter } from '../test/utils';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

describe('Layout component', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      logout: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders navigation items', () => {
    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { route: '/' },
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Recurring')).toBeInTheDocument();
    expect(screen.getByText('Spending')).toBeInTheDocument();
    expect(screen.getByText('Net Worth')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('AI Chatbot')).toBeInTheDocument();
  });

  it('displays user email', () => {
    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { route: '/' },
    );

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('highlights active route', () => {
    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { route: '/recurring' },
    );

    const recurringLink = screen.getByText('Recurring').closest('a');
    expect(recurringLink).toHaveClass('bg-red-50', 'text-red-600');
  });

  it('calls logout when sign out button is clicked', async () => {
    const mockLogout = vi.fn();
    mockUseAuth.mockReturnValue({
      user: { email: 'test@example.com' },
      logout: mockLogout,
    });

    const userEvent = (await import('@testing-library/user-event')).userEvent;
    const user = userEvent.setup();

    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { route: '/' },
    );

    const signOutButton = screen.getByText('Sign Out');
    await user.click(signOutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('renders children content', () => {
    renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { route: '/' },
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies overflow-hidden class for AI chat route', () => {
    const { container } = renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { route: '/ai-chat' },
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-hidden');
  });

  it('applies overflow-auto class for non-AI chat routes', () => {
    const { container } = renderWithRouter(
      <Layout>
        <div>Test Content</div>
      </Layout>,
      { route: '/' },
    );

    const main = container.querySelector('main');
    expect(main).toHaveClass('overflow-auto');
  });
});

