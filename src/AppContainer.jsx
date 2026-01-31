import React from 'react';
import { AllProviders } from './contexts';
import AppContent from './components/AppContent';

/**
 * AppContainer - Root component that provides context and renders the app
 *
 * This is the new modular entry point that wraps the application with
 * all context providers (AllProviders) before rendering the main content.
 */
const AppContainer = () => {
  return (
    <AllProviders>
      <AppContent />
    </AllProviders>
  );
};

export default AppContainer;
