import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/recurring', label: 'Recurring', icon: '🔄' },
    { path: '/spending', label: 'Spending', icon: '💳' },
    { path: '/net-worth', label: 'Net Worth', icon: '💰' },
    { path: '/transactions', label: 'Transactions', icon: '📝' },
    { path: '/ai-chat', label: 'AI Chatbot', icon: '🤖' },
  ];

  const isAIChatRoute = location.pathname === '/ai-chat';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6">
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-bold text-red-600">🚀 Rocket Bucks</span>
          </Link>
        </div>

        <nav className="flex-1 px-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-red-50 text-red-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span className="mr-3 text-xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <div className="px-4 py-2 text-sm text-gray-600">
            <p className="font-medium">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="mr-3 text-xl">🚪</span>
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 ${isAIChatRoute ? 'overflow-hidden' : 'overflow-auto'}`}>
        {children}
      </main>
    </div>
  );
};

export default Layout;

