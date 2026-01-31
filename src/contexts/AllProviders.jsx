import React from 'react';
import { AppStateProvider } from './AppStateContext';

/**
 * AllProviders - Composes all context providers for the app
 *
 * AppStateProvider is the comprehensive provider that holds ALL application state.
 * Note: ToastProvider is handled by App.jsx internally.
 */
export function AllProviders({ children }) {
  return (
    <AppStateProvider>
      {children}
    </AppStateProvider>
  );
}

export default AllProviders;
