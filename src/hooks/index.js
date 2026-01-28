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

// TODO: Extract from App.jsx and add:
// export { default as usePortfolio } from './usePortfolio';
// export { default as useMarketData } from './useMarketData';
// export { default as useCorrelation } from './useCorrelation';
// export { default as useSimulation } from './useSimulation';
// export { default as useFactorAnalysis } from './useFactorAnalysis';
// export { default as useOptimization } from './useOptimization';

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
