import { useCallback, useMemo } from 'react';
import { usePortfolioContext } from '../contexts/PortfolioContext';
import { useSimulationContext } from '../contexts/SimulationContext';
import { optimizePortfolio } from '../services/optimizationService';

export const useOptimization = () => {
  const portfolio = usePortfolioContext();
  const simulation = useSimulationContext();

  const generateSwapCandidates = useCallback((constraints) => {
    if (!portfolio.positions || portfolio.positions.length === 0) return [];

    const candidates = [];
    const positions = portfolio.positions;
    const totalValue = portfolio.totalValue;

    // Generate swap candidates based on constraints
    positions.forEach((position, index) => {
      const swap = {
        from: {
          symbol: position.symbol,
          shares: -position.shares,
          price: position.currentPrice,
          value: -position.shares * position.currentPrice
        },
        timestamp: new Date().toISOString(),
        constraints: constraints,
        metadata: {
          originalWeight: portfolio.weights[position.symbol],
          positionValue: position.shares * position.currentPrice
        }
      };
      candidates.push(swap);
    });

    return candidates;
  }, [portfolio]);

  const optimizeForTargetReturn = useCallback(async (targetReturn, constraints) => {
    const candidates = generateSwapCandidates(constraints);
    
    const optimization = await optimizePortfolio({
      currentPositions: portfolio.positions,
      targetReturn,
      cashBalance: portfolio.cashBalance,
      candidates,
      constraints: {
        maxPositions: constraints.maxPositions || 50,
        minAllocation: constraints.minAllocation || 0.01,
        maxAllocation: constraints.maxAllocation || 0.25,
        ...constraints
      }
    });

    return optimization;
  }, [portfolio, generateSwapCandidates]);

  const optimizeForMaxSharpe = useCallback(async (constraints) => {
    // Simplified Sharpe optimization
    const optimization = await optimizePortfolio({
      currentPositions: portfolio.positions,
      objective: 'maximize_sharpe_ratio',
      cashBalance: portfolio.cashBalance,
      constraints: {
        maxPositions: constraints.maxPositions || 50,
        minAllocation: constraints.minAllocation || 0.01,
        maxAllocation: constraints.maxAllocation || 0.25,
        ...constraints
      }
    });

    return optimization;
  }, [portfolio]);

  const optimizeForMinRisk = useCallback(async (minReturn, constraints) => {
    const optimization = await optimizePortfolio({
      currentPositions: portfolio.positions,
      objective: 'minimize_risk',
      minReturn,
      cashBalance: portfolio.cashBalance,
      constraints: {
        maxPositions: constraints.maxPositions || 50,
        minAllocation: constraints.minAllocation || 0.01,
        maxAllocation: constraints.maxAllocation || 0.25,
        ...constraints
      }
    });

    return optimization;
  }, [portfolio]);

  const validateOptimizationSwap = useCallback((swap) => {
    if (!swap || !portfolio.positions) return null;

    const validation = {
      swap: swap,
      isValid: true,
      constraints: {
        positionLimit: portfolio.positions.length > 1,
        allocationLimit: true,
        liquidityCheck: true
      },
      impact: {
        expectedReturn: 0,
        expectedRisk: 0,
        cost: 0
      }
    };

    return validation;
  }, [portfolio]);

  // Implementation notes for the service functions
  const serviceHooks = useMemo(() => ({
    optimizePortfolio,
    validateOptimizationSwap,
    generateSwapCandidates
  }), []);

  return {
    // State (from contexts)
    positions: portfolio.positions,
    totalValue: portfolio.totalValue,
    weights: portfolio.weights,
    currentOptimization: simulation.optimizationResults,

    // Optimization functions
    optimizeForTargetReturn,
    optimizeForMaxSharpe,
    optimizeForMinRisk,
    generateSwapCandidates,
    validateOptimizationSwap,

    // Convenience
    isLoading: simulation.loading?.optimization || false,
    hasOptimization: simulation.hasOptimization(),
    currentOptimizationResults: simulation.optimizationResults
  };
};
