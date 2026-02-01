/**
 * Hooks Index
 * 
 * @module hooks
 * @description Custom React hooks for state management and business logic.
 * 
 * Usage:
 * ```javascript
 * import { useLocalStorage, useCache } from '../hooks';
 * ```
 */

// Storage hooks
export { default as useLocalStorage, isLocalStorageAvailable, getStorageUsage } from './useLocalStorage';

// Autosave hook
export { default as useAutosave, AutosaveStatus } from './useAutosave';

// Undo/Redo hook
export { default as useUndoRedo } from './useUndoRedo';

// Chart interaction hook
export { default as useChartInteraction } from './useChartInteraction';

// Business logic hooks (Phase 2.3)
export { useMarketData } from './useMarketData';
export { useCorrelation } from './useCorrelation';
export { useFactorAnalysis } from './useFactorAnalysis';
export { useSimulation } from './useSimulation';
export { useOptimization } from './useOptimization';

// Portfolio sync hook (server persistence)
export { usePortfolioSync } from './usePortfolioSync';

// Staleness tracking hook
export {
  useStaleness,
  initialInputVersions,
  initialTabComputedVersions,
  DEPENDENCIES,
} from './useStaleness';

// Document title hook
export { useDocumentTitle } from './useDocumentTitle';

/**
 * HOOK EXTRACTION GUIDE
 * =====================
 * 
 * The following hooks should be extracted from App.jsx for better organization:
 * 
 * 1. usePortfolio - Portfolio state management
 *    - positions, setPositions
 *    - addPosition, updatePosition, removePosition
 *    - cashBalance, setCashBalance
 *    - positionMetadata
 * 
 * 2. useMarketData - Data fetching and caching
 *    - marketData, setMarketData
 *    - factorData
 *    - isLoading, progress
 *    - loadAllData, loadTicker
 *    - Cache management
 * 
 * 3. useCorrelation - Correlation matrix
 *    - correlationMatrix, editedCorrelation
 *    - correlationMethod
 *    - computeCorrelation
 *    - updateCell, makeValidPSD
 * 
 * 4. useSimulation - Monte Carlo simulation
 *    - simulationResults
 *    - isRunning, progress
 *    - runSimulation, cancelSimulation
 *    - Worker management
 * 
 * 5. useFactorAnalysis - Factor decomposition
 *    - factorAnalysis
 *    - runAnalysis
 *    - getFactorExposure
 * 
 * 6. useOptimization - Portfolio optimization
 *    - optimizationResults
 *    - runOptimization
 *    - targetReturn, constraints
 */
