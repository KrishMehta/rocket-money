import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Recurring from './pages/Recurring';
import Spending from './pages/Spending';
import NetWorth from './pages/NetWorth';
import Transactions from './pages/Transactions';
import AIChat from './pages/AIChat';
import ConnectAccounts from './pages/ConnectAccounts';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/recurring" element={<Recurring />} />
          <Route path="/spending" element={<Spending />} />
          <Route path="/net-worth" element={<NetWorth />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/ai-chat" element={<AIChat />} />
          <Route path="/connect-accounts" element={<ConnectAccounts />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
