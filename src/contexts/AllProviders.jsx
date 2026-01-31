import React from 'react';
import { AppStateProvider } from './AppStateContext';
import { AuthProvider } from './AuthContext';

/**
 * AllProviders - Composes all context providers for the app
 *
 * AuthProvider is outermost so all components can access auth state.
 * AppStateProvider is the comprehensive provider that holds ALL application state.
 * Note: ToastProvider is handled by App.jsx internally.
 */
export function AllProviders({ children }) {
  return (
    <AuthProvider>
      <AppStateProvider>
        {children}
      </AppStateProvider>
    </AuthProvider>
  );
}

export default AllProviders;
