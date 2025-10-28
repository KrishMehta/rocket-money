import { useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';

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
        const response = await fetch('http://localhost:3001/api/create_link_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (error) {
        console.error('Error creating link token:', error);
      }
    };

    createLinkToken();
  }, []);

  const config = {
    token: linkToken,
    onSuccess: (public_token: string, metadata: any) => {
      onSuccess(public_token, metadata);
    },
    onExit: () => {
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

