import React from 'react';
import MonteCarloSimulator from '../App.jsx';
import LandingPage from './landing/LandingPage';
import { useAuth } from '../contexts/AuthContext';

/**
 * AppContent - Main application content component
 *
 * This component serves as the bridge between the new modular context architecture
 * and the existing App.jsx functionality. It conditionally renders either:
 * - LandingPage for unauthenticated users
 * - MonteCarloSimulator (App.jsx) for authenticated users
 *
 * Current architecture:
 * - AllProviders (contexts) wraps AppContent
 * - AppContent checks auth state and renders appropriate view
 * - App.jsx manages its own state (legacy pattern)
 *
 * Target architecture:
 * - AllProviders provides all state via contexts
 * - AppContent uses useAppState() for state
 * - Tab components use context hooks directly
 */
function AppContent() {
  const { state } = useAuth();
  const { isAuthenticated, isLoading } = state;

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #0a0f1c 0%, #0f172a 100%)',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(0, 212, 255, 0.2)',
            borderTop: '3px solid #00d4ff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{
            color: '#94a3b8',
            fontSize: '14px',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          }}>Loading...</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  // Show main app for authenticated users
  return <MonteCarloSimulator />;
}

export default AppContent;
