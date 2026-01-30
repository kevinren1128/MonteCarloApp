import React from 'react';
import { AllProviders } from './contexts';
import AppRouter from './components/AppRouter';

// Clean root component
const AppContainer = () => {
  return (
    <AllProviders>
      <AppRouter />
    </AllProviders>
  );
};

export default AppContainer;
