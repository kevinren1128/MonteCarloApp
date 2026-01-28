/**
 * App Context
 * 
 * @module contexts/AppContext
 * @description Shared state management for the Monte Carlo Simulator.
 * Provides state and actions to all tab components.
 */

import React, { createContext, useContext } from 'react';

// Create the context
const AppContext = createContext(null);

/**
 * Hook to access app context
 * @returns {Object} App state and actions
 */
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppContextProvider');
  }
  return context;
};

/**
 * App Context Provider
 * Wraps the app and provides state to all components
 */
export const AppContextProvider = ({ children, value }) => {
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export default AppContext;
