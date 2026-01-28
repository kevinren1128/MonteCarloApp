/**
 * Contexts Index
 * 
 * @module contexts
 * @description React Context providers for global state management.
 * 
 * Usage:
 * ```javascript
 * import { PortfolioProvider, usePortfolioContext } from '../contexts';
 * 
 * // Wrap app
 * <PortfolioProvider>
 *   <App />
 * </PortfolioProvider>
 * 
 * // Use in components
 * const { positions, addPosition } = usePortfolioContext();
 * ```
 */

// TODO: Extract from App.jsx and add:
// export { PortfolioProvider, usePortfolioContext } from './PortfolioContext';
// export { MarketDataProvider, useMarketDataContext } from './MarketDataContext';

/**
 * CONTEXT ARCHITECTURE
 * ====================
 * 
 * Current app uses props drilling. Future refactor could use Context for:
 * 
 * 1. PortfolioContext
 *    - positions, setPositions
 *    - cashBalance
 *    - settings
 * 
 * 2. MarketDataContext  
 *    - marketData (cached)
 *    - factorData
 *    - loading state
 * 
 * 3. SimulationContext
 *    - results
 *    - running state
 *    - worker refs
 * 
 * This allows deep components to access data without prop drilling.
 * 
 * WHEN TO USE CONTEXT:
 * - Data needed by many components at different nesting levels
 * - Data that changes infrequently
 * 
 * WHEN NOT TO USE CONTEXT:
 * - Data only needed by a few components
 * - Data that changes frequently (use local state + callbacks)
 */

// Placeholder exports to prevent import errors
export const PortfolioProvider = ({ children }) => children;
export const usePortfolioContext = () => {
  throw new Error('PortfolioContext not yet implemented. Use App.jsx state for now.');
};

// App Context for extracted tab components
export { AppContextProvider, useAppContext } from './AppContext';
