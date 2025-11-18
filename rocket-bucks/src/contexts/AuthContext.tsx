import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../utils/api';

interface User {
  id: string;
  email: string;
  full_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount and when auth state changes
  const checkAuth = async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        const userData = await api.getCurrentUser();
        setUser(userData.user);
        console.log('✅ Auth context updated, user:', userData.user);
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
      }
    } else {
      setUser(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    checkAuth();
    
    // Listen for storage events (cross-tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'access_token') {
        checkAuth();
      }
    };

    // Listen for custom auth state change event (same-tab)
    const handleAuthStateChange = () => {
      checkAuth();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth-state-changed', handleAuthStateChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthStateChange);
    };
  }, []);

  const login = async () => {
    // Redirect to Google OAuth
    console.log('🔐 AuthContext: Starting Google login...');
    try {
      const data = await api.googleLogin();
      console.log('🔐 AuthContext: Got OAuth URL, redirecting...');
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No OAuth URL received from server');
      }
    } catch (error) {
      console.error('❌ AuthContext: Login failed:', error);
      throw error; // Re-throw so the component can handle it
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
