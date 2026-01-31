import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  isAuthAvailable,
  getSession,
  onAuthStateChange,
  signInWithGoogle,
  signOut,
  getUserDisplayInfo,
} from '../services/authService';

/**
 * @typedef {Object} User
 * @property {string} id - User ID
 * @property {string} email - User email
 * @property {Object} user_metadata - User metadata from OAuth provider
 */

/**
 * @typedef {Object} AuthState
 * @property {User|null} user - Current authenticated user
 * @property {boolean} isLoading - Whether auth state is being determined
 * @property {boolean} isAuthenticated - Whether user is logged in
 * @property {boolean} isAvailable - Whether auth is configured
 * @property {{name: string, email: string, avatar: string|null}} displayInfo - User display info
 */

/**
 * @typedef {Object} AuthContextValue
 * @property {AuthState} state - Auth state
 * @property {Function} login - Sign in with Google
 * @property {Function} logout - Sign out
 */

const AuthContext = createContext(null);

/**
 * AuthContext Provider component
 * Manages user authentication state and provides login/logout methods
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const isAvailable = isAuthAvailable();

  // Initialize auth state on mount
  useEffect(() => {
    if (!isAvailable) {
      setIsLoading(false);
      return;
    }

    // Get initial session
    const initAuth = async () => {
      try {
        const { data, error } = await getSession();
        if (error) {
          console.warn('Error getting session:', error);
        }
        setUser(data?.session?.user || null);
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = onAuthStateChange((event, session) => {
      setUser(session?.user || null);

      if (event === 'SIGNED_IN') {
        console.log('User signed in');
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('Token refreshed');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [isAvailable]);

  // Login handler
  const login = useCallback(async () => {
    if (!isAvailable) {
      setError('Authentication not configured');
      return { error: new Error('Authentication not configured') };
    }

    setError(null);
    const result = await signInWithGoogle();

    if (result.error) {
      setError(result.error.message);
    }

    return result;
  }, [isAvailable]);

  // Logout handler
  const logout = useCallback(async () => {
    setError(null);
    const result = await signOut();

    if (result.error) {
      setError(result.error.message);
    }

    return result;
  }, []);

  // Memoized context value
  const value = useMemo(() => ({
    state: {
      user,
      isLoading,
      isAuthenticated: !!user,
      isAvailable,
      displayInfo: getUserDisplayInfo(user),
      error,
    },
    login,
    logout,
  }), [user, isLoading, isAvailable, error, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context
 * @returns {AuthContextValue}
 * @throws {Error} If used outside AuthProvider
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
