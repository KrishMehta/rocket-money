import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Recurring from './pages/Recurring';
import Spending from './pages/Spending';
import NetWorth from './pages/NetWorth';
import Transactions from './pages/Transactions';
import AIChat from './pages/AIChat';
import ConnectAccounts from './pages/ConnectAccounts';
import DeleteAccount from './pages/DeleteAccount';
import Performance from './pages/Performance';

function App() {
  return (
    <AuthProvider>
    <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/net-worth" element={<NetWorth />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/connect-accounts" element={<ConnectAccounts />} />
          <Route path="/deleteaccount" element={<DeleteAccount />} />
          <Route path="/performance" element={<Performance />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
