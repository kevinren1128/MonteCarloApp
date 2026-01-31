import React from 'react';
import MonteCarloSimulator from '../App.jsx';

/**
 * AppContent - Main application content component
 *
 * This component serves as the bridge between the new modular context architecture
 * and the existing App.jsx functionality. It renders the MonteCarloSimulator
 * which contains all the business logic and UI.
 *
 * As the refactoring progresses, business logic will be migrated from App.jsx
 * to use the context hooks (useAppState, etc.) and this component will evolve
 * to orchestrate those hooks.
 *
 * Current architecture:
 * - AllProviders (contexts) wraps AppContent
 * - AppContent renders MonteCarloSimulator (App.jsx)
 * - App.jsx manages its own state (legacy pattern)
 *
 * Target architecture:
 * - AllProviders provides all state via contexts
 * - AppContent uses useAppState() for state
 * - Tab components use context hooks directly
 */
function AppContent() {
  return <MonteCarloSimulator />;
}

export default AppContent;
