// Re-export all hooks for easy access
export { useMarketData } from './useMarketData';
export { useCorrelation } from './useCorrelation';
export { useSimulation } from './useSimulation';
export { useFactorAnalysis } from './useFactorAnalysis';
export { useOptimization } from './useOptimization';

// Keep existing hooks
export { useAutosave } from './useAutosave';
export { useUndoRedo } from './useUndoRedo';
export { useChartInteraction } from './useChartInteraction';
export { useLocalStorage } from './useLocalStorage';

// Backward compatibility
export { AppContextProvider, useAppContext } from '../contexts/AppContext';
