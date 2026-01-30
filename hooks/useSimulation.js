import { useCallback } from 'react';
import { useSimulationContext } from '../contexts/SimulationContext';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { runMonteCarloSimulation } from '../services/simulationService';

export const useSimulation = () => {
  const simulation = useSimulationContext();
  const portfolio = usePortfolioContext();

  const runSimulation = useCallback(async (config) => {
    try {
      simulation.setLoading('simulation', true);
      simulation.setSelectedSwap(null);
      simulation.updateProgress('initialization', 0, 100);

      // Validate portfolio
      if (!portfolio.positions || portfolio.positions.length === 0) {
        throw new Error('No positions to simulate');
      }

      // Start simulation worker
      simulation.startSimulation();
      
      const results = await runMonteCarloSimulation({
        positions: portfolio.positions,
        cashBalance: portfolio.cashBalance,
        numPaths: config.numPaths || 1000,
        years: config.years || 30,
        correlationMethod: config.correlationMethod || 'sample',
        useQmc: config.useQmc || false,
        progressCallback: (step, current, total) => {
          simulation.updateProgress(step, current, total);
        }
      });

      simulation.setSimulationResults(results);
      simulation.setPreviousResults(simulation.simulationResults);
      
      return results;
    } catch (error) {
      simulation.addFetchError({
        type: 'simulation',
        error: error.message
      });
      throw error;
    } finally {
      simulation.setLoading('simulation', false);
    }
  }, [simulation, portfolio]);

  const runOptimization = useCallback(async (config) => {
    try {
      simulation.setLoading('optimization', true);
      simulation.updateProgress('optimization', 0, 100);

      const optimizationConfig = {
        positions: portfolio.positions,
        targetReturn: config.targetReturn,
        maxPositions: config.maxPositions,
        minAllocation: config.minAllocation,
        maxAllocation: config.maxAllocation
      };

      const results = await runPortfolioOptimization(optimizationConfig);
      simulation.setOptimizationResults(results);

      return results;
    } catch (error) {
      simulation.addFetchError({
        type: 'optimization',
        error: error.message
      });
      throw error;
    } finally {
      simulation.setLoading('optimization', false);
    }
  }, [simulation, portfolio]);

  const runThematicAnalysis = useCallback(async (themeConfig) => {
    try {
      simulation.setLoading('thematicAnalysis', true);
      simulation.updateProgress('thematic setup', 0, 100);

      const thematicResults = await runThematicAnalysis({
        positions: portfolio.positions,
        theme: themeConfig.theme,
        parameters: themeConfig.parameters
      });

      simulation.setThematicResults(thematicResults);
      return thematicResults;
    } catch (error) {
      simulation.addFetchError({
        type: 'thematic',
        error: error.message
      });
      throw error;
    } finally {
      simulation.setLoading('thematicAnalysis', false);
    }
  }, [simulation, portfolio]);

  const validateSwap = useCallback(async (swap) => {
    if (!swap || !simulation.simulationResults) return null;

    try {
      simulation.setLoading('simulation', true);
      
      const validation = await validatePortfolioSwap({
        originalResults: simulation.simulationResults,
        swap,
        positions: portfolio.positions,
        cashBalance: portfolio.cashBalance
      });

      simulation.setSwapValidationResults(validation);
      simulation.setSelectedSwap(swap);

      return validation;
    } catch (error) {
      simulation.addFetchError({
        type: 'validation',
        error: error.message
      });
      throw error;
    } finally {
      simulation.setLoading('simulation', false);
    }
  }, [simulation, portfolio]);

  return {
    // State
    simulationResults: simulation.simulationResults,
    previousResults: simulation.previousSimulationResults,
    optimizationResults: simulation.optimizationResults,
    selectedSwap: simulation.selectedSwap,
    swapValidation: simulation.swapValidationResults,
    thematicResults: simulation.thematicSwapResults,
    progress: simulation.thematicSwapProgress,

    // Status
    isLoading: {
      simulation: simulation.loading?.simulation || false,
      optimization: simulation.loading?.optimization || false,
      thematic: simulation.loading?.thematicAnalysis || false
    },
    hasResults: simulation.hasSimulation(),
    hasOptimization: simulation.hasOptimization(),

    // Actions
    runSimulation,
    runOptimization,
    runThematicAnalysis,
    validateSwap,
    resetSimulation: simulation.resetSimulation,
    setSimulationResults: simulation.setSimulationResults
  };
};
