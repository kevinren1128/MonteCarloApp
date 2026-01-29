import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

/**
 * @typedef {Object} SimulationResults
 * @property {number[][]} paths - Simulated portfolio value paths
 * @property {Object} statistics - Statistical summary of results
 * @property {number[]} percentiles - Percentile values
 * @property {number} var - Value at Risk
 * @property {number} cvar - Conditional Value at Risk
 */

/**
 * @typedef {Object} FactorAnalysis
 * @property {Object.<string, number>} contributions - Factor contributions to portfolio risk
 * @property {Object.<string, number>} exposures - Factor exposures
 * @property {number[][]} decomposition - Risk decomposition data
 */

/**
 * @typedef {Object} SimulationState
 * @property {number} numPaths - Number of simulation paths
 * @property {string} fatTailMethod - Fat tail adjustment method
 * @property {number[][]} correlationMatrix - Correlation matrix for assets
 * @property {SimulationResults|null} simulationResults - Latest simulation results
 * @property {FactorAnalysis|null} factorAnalysis - Factor analysis results
 * @property {boolean} isRunning - Whether simulation is currently running
 */

/**
 * @typedef {Object} SimulationContextValue
 * @property {SimulationState} state - Simulation state
 * @property {Function} setNumPaths - Set number of simulation paths
 * @property {Function} setFatTailMethod - Set fat tail method
 * @property {Function} setCorrelationMatrix - Set correlation matrix
 * @property {Function} setSimulationResults - Set simulation results
 * @property {Function} setFactorAnalysis - Set factor analysis
 * @property {Function} setIsRunning - Set simulation running state
 * @property {Function} clearResults - Clear all results
 */

const SimulationContext = createContext(null);

/**
 * SimulationContext Provider component
 * Manages Monte Carlo simulation parameters and results
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function SimulationProvider({ children }) {
  const [numPaths, setNumPaths] = useState(1000);
  const [fatTailMethod, setFatTailMethod] = useState('none');
  const [correlationMatrix, setCorrelationMatrix] = useState([]);
  const [simulationResults, setSimulationResults] = useState(null);
  const [factorAnalysis, setFactorAnalysis] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const clearResults = useCallback(() => {
    setSimulationResults(null);
    setFactorAnalysis(null);
  }, []);

  const value = useMemo(() => ({
    state: {
      numPaths,
      fatTailMethod,
      correlationMatrix,
      simulationResults,
      factorAnalysis,
      isRunning,
    },
    setNumPaths,
    setFatTailMethod,
    setCorrelationMatrix,
    setSimulationResults,
    setFactorAnalysis,
    setIsRunning,
    clearResults,
  }), [
    numPaths,
    fatTailMethod,
    correlationMatrix,
    simulationResults,
    factorAnalysis,
    isRunning,
    clearResults,
  ]);

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

/**
 * Hook to access Simulation context
 * @returns {SimulationContextValue}
 * @throws {Error} If used outside SimulationProvider
 */
export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
}
