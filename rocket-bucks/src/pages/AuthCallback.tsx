import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCallback = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Extract parameters from URL - check both query params and hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashString = window.location.hash.substring(1); // Remove the #
        const hashParams = new URLSearchParams(hashString);
        
        // Supabase OAuth can send either:
        // 1. A code that needs to be exchanged (PKCE flow)
        // 2. Direct access_token and refresh_token (implicit flow)
        const code = urlParams.get('code') || hashParams.get('code');
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const errorParam = urlParams.get('error') || hashParams.get('error');
        const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');

        console.log('🔔 Frontend callback received:', {
          fullUrl: window.location.href,
          search: window.location.search,
          hash: window.location.hash,
          code: code ? 'present' : 'missing',
          accessToken: accessToken ? 'present' : 'missing',
          refreshToken: refreshToken ? 'present' : 'missing',
          error: errorParam,
          errorDescription,
        });

        // Check for OAuth errors
        if (errorParam) {
          setError(errorDescription || errorParam || 'Authentication failed');
          setStatus('error');
          return;
        }

        // If we have direct tokens (implicit flow), use them
        if (accessToken) {
          console.log('✅ Direct tokens received (implicit flow)');
          localStorage.setItem('access_token', accessToken);
          if (refreshToken) {
            localStorage.setItem('refresh_token', refreshToken);
          }
          
          // Trigger auth context update
          window.dispatchEvent(new Event('auth-state-changed'));
          
          // Redirect to dashboard
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 100);
          return;
        }

        // Otherwise, we need a code to exchange
        if (!code) {
          console.error('❌ No code or tokens received');
          console.error('   Full URL:', window.location.href);
          console.error('   Search:', window.location.search);
          console.error('   Hash:', window.location.hash);
          console.error('   Hash params:', Array.from(hashParams.entries()));
          
          // Show detailed error with URL info
          const errorDetails = `
No authorization code or tokens received.

URL: ${window.location.href}
Search: ${window.location.search || '(empty)'}
Hash: ${window.location.hash || '(empty)'}

This usually means:
1. The redirect URL in Supabase doesn't match what we're sending
2. Or Supabase is redirecting to a different URL

Please check:
- Supabase Dashboard → Authentication → URL Configuration
- Make sure "http://localhost:5173/auth/callback" is in the redirect URLs list
          `.trim();
          
          setError(errorDetails);
          setStatus('error');
          return;
        }

        // Exchange code for session via backend
        console.log('🔄 Exchanging code for session...');
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        console.log('🌐 Calling:', `${apiUrl}/auth/exchange-code`);
        
        const response = await fetch(`${apiUrl}/auth/exchange-code`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          let errorMessage = 'Failed to exchange code';
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error('❌ Exchange error:', errorData);
          } catch (e) {
            const text = await response.text();
            errorMessage = text || errorMessage;
            console.error('❌ Exchange error (text):', text);
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        
        // Store tokens
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }

        console.log('✅ Authentication successful, user:', data.user);
        
        // Trigger a custom event to notify auth context
        window.dispatchEvent(new Event('auth-state-changed'));
        
        // Small delay to ensure auth context updates, then redirect
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 100);
      } catch (err: any) {
        console.error('❌ Callback error:', err);
        setError(err.message || 'Authentication failed');
        setStatus('error');
      }
    };

    handleCallback();
  }, [navigate]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Signing you in...</h1>
          <p className="text-gray-600">Please wait while we complete your sign in.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // This should not be reached if redirect works, but just in case
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="text-center">
        <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Success!</h1>
        <p className="text-gray-600 mb-4">Redirecting to dashboard...</p>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default AuthCallback;

