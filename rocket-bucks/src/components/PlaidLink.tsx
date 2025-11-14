import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { api } from '../utils/api';

interface PlaidLinkProps {
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit?: () => void;
  children?: React.ReactNode;
}

const PlaidLink = ({ onSuccess, onExit, children }: PlaidLinkProps) => {
  const [linkToken, setLinkToken] = useState<string | null>(null);

  useEffect(() => {
    const createLinkToken = async () => {
      try {
        console.log('🔗 Creating Plaid link token...');
        const data = await api.createLinkToken();
        console.log('✅ Link token created');
        setLinkToken(data.link_token);
      } catch (error: any) {
        console.error('❌ Error creating link token:', error);
        const errorMsg = error.message || 'Unknown error';
        
        // More helpful error message
        let userMessage = `Failed to initialize Plaid: ${errorMsg}`;
        
        if (errorMsg.includes('Network error') || errorMsg.includes('Cannot connect')) {
          userMessage += '\n\n💡 Troubleshooting:\n';
          userMessage += '1. Make sure the Express server is running (npm run server)\n';
          userMessage += '2. Check that the server is on port 3001\n';
          userMessage += '3. Verify VITE_API_URL in your .env file';
        } else if (errorMsg.includes('Unauthorized') || errorMsg.includes('Invalid token')) {
          userMessage += '\n\n💡 Please log out and log back in.';
        } else {
          userMessage += '\n\n💡 Make sure you\'re logged in and Plaid credentials are configured.';
        }
        
        alert(userMessage);
      }
    };

    createLinkToken();
  }, []);

  const config = {
    token: linkToken,
    onSuccess: (public_token: string, metadata: any) => {
      console.log('✅ Plaid Link success, public_token received');
      onSuccess(public_token, metadata);
    },
    onExit: (err: any, metadata: any) => {
      if (err) {
        console.error('❌ Plaid Link exit with error:', err);
      } else {
        console.log('ℹ️ Plaid Link exited:', metadata);
      }
      onExit?.();
    },
  };

  const { open, ready } = usePlaidLink(config);

  return (
    <>
      {children ? (
        <div onClick={() => ready && open()}>
          {children}
        </div>
      ) : (
        <button
          onClick={() => open()}
          disabled={!ready}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {ready ? 'Connect Bank Account' : 'Loading...'}
        </button>
      )}
    </>
  );
};

export default PlaidLink;

