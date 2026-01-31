import React from 'react'
import ReactDOM from 'react-dom/client'
import AppContainer from './AppContainer'

/**
 * Application entry point
 *
 * Renders the app using the new modular architecture:
 * AppContainer -> AllProviders (contexts) -> AppContent -> MonteCarloSimulator
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppContainer />
  </React.StrictMode>,
)
