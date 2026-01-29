/**
 * Context exports for Monte Carlo App
 * 
 * This file re-exports all contexts and their providers/hooks for convenient importing.
 * 
 * @example
 * import { UIProvider, useUI, PortfolioProvider, usePortfolio } from './contexts';
 */

export { UIProvider, useUI } from './UIContext';
export { PortfolioProvider, usePortfolio } from './PortfolioContext';
export { MarketDataProvider, useMarketData } from './MarketDataContext';
export { SimulationProvider, useSimulation } from './SimulationContext';
