// Main context exports
export { PortfolioProvider, usePortfolioContext } from './PortfolioContext';
export { MarketDataProvider, useMarketDataContext } from './MarketDataContext';
export { SimulationProvider, useSimulationContext } from './SimulationContext';
export { UIProvider, useUIContext } from './UIContext';

// Convenience wrapper for all providers
export const AllProviders = ({ children }) => (
  <UIProvider>
    <MarketDataProvider>
      <PortfolioProvider>
        <SimulationProvider>
          {children}
        </SimulationProvider>
      </PortfolioProvider>
    </MarketDataProvider>
  </UIProvider>
);

// Deprecated: Original AppContext for backward compatibility
export { AppContextProvider, useAppContext } from './AppContext';
