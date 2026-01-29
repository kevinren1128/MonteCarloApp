import { useCallback, useContext, useState } from 'react';
import { PortfolioContext } from '../contexts/PortfolioContext';
import { SimulationContext } from '../contexts/SimulationContext';
import { toast } from '../components/common';

// Utils
import {
  buildCovarianceMatrix,
  computePortfolioVolatility,
  computePortfolioReturn,
  computeSharpeRatio,
  computeMCTR,
  computeRiskContribution,
  computeIncrementalSharpe,
  computeOptimalityRatio,
  computeRiskParityWeights,
} from '../utils/portfolioOptimization';
import { boxMuller, generateChiSquared } from '../utils/statistics';
import { choleskyDecomposition } from '../utils/matrix';

/**
 * useOptimization - Custom hook for portfolio optimization
 * 
 * Extracts optimization logic from App.jsx including:
 * - Analytical swap matrix computation
 * - Monte Carlo validation of swaps
 * - Risk decomposition
 * - Risk parity computation
 */
export function useOptimization() {
  const { positions, weights, portfolioValue, grossPositionsValue, cashBalance, cashRate } = useContext(PortfolioContext);
  const {
    editedCorrelation,
    getDistributionParams,
    riskFreeRate,
    swapSize,
    optimizationPaths,
    useQmc,
    optimizationResults,
    setOptimizationResults,
  } = useContext(SimulationContext);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });

  /**
   * Run portfolio optimization analysis
   */
  const runOptimization = useCallback(async (correlationMatrixParam = null) => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    const correlationToUse = correlationMatrixParam || editedCorrelation;
    
    if (tickers.length < 2 || !correlationToUse || correlationToUse.length < 2) {
      toast.warning('Need at least 2 positions with correlation matrix.', {
        duration: 5000,
      });
      return;
    }
    
    setIsOptimizing(true);
    setProgress({ current: 0, total: 100, phase: 'Computing risk decomposition...' });
    
    const startTime = performance.now();
    const n = positions.length;
    const rf = riskFreeRate;
    
    // Get distribution parameters
    const derivedParams = positions.map(p => getDistributionParams(p));
    const muArray = derivedParams.map(d => d.mu);
    const sigmaArray = derivedParams.map(d => d.sigma);
    
    // Calculate adjusted weights
    const totalValue = portfolioValue || 1;
    const leverageRatio = grossPositionsValue > 0 ? grossPositionsValue / totalValue : 1;
    const adjustedWeights = weights.map(w => (w || 0) * leverageRatio);
    const effectiveCashWeight = cashBalance / totalValue;
    const cashContribution = effectiveCashWeight * (cashRate || 0);
    
    console.log('📊 Optimization using:', {
      leverageRatio: leverageRatio.toFixed(3),
      effectiveCashWeight: (effectiveCashWeight * 100).toFixed(1) + '%',
    });
    
    // Build covariance matrix
    const covMatrix = buildCovarianceMatrix(correlationToUse, sigmaArray);
    
    // Current portfolio metrics
    const currentPortfolioVol = computePortfolioVolatility(adjustedWeights, covMatrix);
    const positionsReturn = computePortfolioReturn(adjustedWeights, muArray);
    const currentPortfolioReturn = positionsReturn + cashContribution;
    const currentSharpe = computeSharpeRatio(currentPortfolioReturn, currentPortfolioVol, rf);
    
    console.log('📊 Current portfolio:', {
      return: (currentPortfolioReturn * 100).toFixed(2) + '%',
      volatility: (currentPortfolioVol * 100).toFixed(2) + '%',
      sharpe: currentSharpe.toFixed(3),
    });
    
    // Risk decomposition
    const mctr = computeMCTR(adjustedWeights, covMatrix, currentPortfolioVol);
    const riskContribution = computeRiskContribution(adjustedWeights, mctr, currentPortfolioVol);
    const iSharpe = computeIncrementalSharpe(adjustedWeights, muArray, sigmaArray, covMatrix, rf, cashContribution);
    const optimalityRatio = computeOptimalityRatio(muArray, mctr, rf);
    
    // Risk parity target
    const riskParityWeights = computeRiskParityWeights(sigmaArray, covMatrix);
    const adjustedRiskParityWeights = riskParityWeights.map(w => w * leverageRatio);
    const riskParityVol = computePortfolioVolatility(adjustedRiskParityWeights, covMatrix);
    const riskParityPositionsReturn = computePortfolioReturn(adjustedRiskParityWeights, muArray);
    const riskParityReturn = riskParityPositionsReturn + cashContribution;
    const riskParitySharpe = computeSharpeRatio(riskParityReturn, riskParityVol, rf);
    
    setProgress({ current: 10, total: 100, phase: 'Computing swap matrix...' });
    await new Promise(r => setTimeout(r, 10));
    
    // Compute swap matrix
    const swapDeltaSharpe = Array(n).fill(null).map(() => Array(n).fill(0));
    const swapDeltaVol = Array(n).fill(null).map(() => Array(n).fill(0));
    const swapDeltaReturn = Array(n).fill(null).map(() => Array(n).fill(0));
    const swapAmount = swapSize;
    
    for (let sell = 0; sell < n; sell++) {
      for (let buy = 0; buy < n; buy++) {
        if (buy === sell) continue;
        
        const newAdjustedWeights = adjustedWeights.map((w, i) => {
          if (i === sell) return w - swapAmount * leverageRatio;
          if (i === buy) return w + swapAmount * leverageRatio;
          return w;
        });
        
        const newVol = computePortfolioVolatility(newAdjustedWeights, covMatrix);
        const newPositionsReturn = computePortfolioReturn(newAdjustedWeights, muArray);
        const newReturn = newPositionsReturn + cashContribution;
        const newSharpe = computeSharpeRatio(newReturn, newVol, rf);
        
        swapDeltaSharpe[sell][buy] = newSharpe - currentSharpe;
        swapDeltaVol[sell][buy] = newVol - currentPortfolioVol;
        swapDeltaReturn[sell][buy] = newReturn - currentPortfolioReturn;
      }
    }
    
    // Find top swaps
    const allSwaps = [];
    for (let sell = 0; sell < n; sell++) {
      for (let buy = 0; buy < n; buy++) {
        if (buy === sell) continue;
        allSwaps.push({
          sellIdx: sell,
          buyIdx: buy,
          sellTicker: tickers[sell],
          buyTicker: tickers[buy],
          deltaSharpe: swapDeltaSharpe[sell][buy],
          deltaVol: swapDeltaVol[sell][buy],
          deltaReturn: swapDeltaReturn[sell][buy],
        });
      }
    }
    allSwaps.sort((a, b) => b.deltaSharpe - a.deltaSharpe);
    const topSwaps = allSwaps.slice(0, 15);
    
    setProgress({ current: 20, total: 100, phase: 'Running Monte Carlo validation...' });
    await new Promise(r => setTimeout(r, 10));
    
    // Monte Carlo validation for baseline
    const pathsPerSwap = optimizationPaths;
    
    const runMiniMonteCarlo = async (testAdjustedWeights, label) => {
      const paths = pathsPerSwap;
      const constantCashReturn = effectiveCashWeight * (cashRate || 0);
      
      // Cholesky decomposition
      const L = choleskyDecomposition(editedCorrelation);
      const flatL = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          flatL[i * n + j] = L[i]?.[j] || 0;
        }
      }
      
      const terminalReturns = new Float64Array(paths);
      const muArr = new Float64Array(muArray);
      const sigmaArr = new Float64Array(sigmaArray);
      const weightsArr = new Float64Array(testAdjustedWeights);
      
      const z = new Float64Array(n);
      const correlatedZ = new Float64Array(n);
      
      for (let path = 0; path < paths; path++) {
        // Generate uncorrelated normals
        for (let i = 0; i < n; i++) z[i] = boxMuller();
        
        // Apply Cholesky correlation
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let j = 0; j <= i; j++) sum += flatL[i * n + j] * z[j];
          correlatedZ[i] = sum || 0;
        }
        
        // Transform
        let positionsReturn = 0;
        for (let i = 0; i < n; i++) {
          const transformed = Math.max(-6, Math.min(6, correlatedZ[i]));
          const assetReturn = muArr[i] + transformed * sigmaArr[i];
          positionsReturn += weightsArr[i] * Math.max(-1, Math.min(10, assetReturn));
        }
        
        const portfolioReturn = Math.max(-1, Math.min(10, positionsReturn + constantCashReturn));
        terminalReturns[path] = isFinite(portfolioReturn) ? portfolioReturn : 0;
      }
      
      // Statistics
      const validReturns = Array.from(terminalReturns).filter(v => isFinite(v));
      const sorted = [...validReturns].sort((a, b) => a - b);
      const mean = validReturns.reduce((a, b) => a + b, 0) / validReturns.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const stdDev = Math.sqrt(validReturns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / validReturns.length);
      const sharpe = stdDev > 0 ? (mean - rf) / stdDev : 0;
      const pLoss = validReturns.filter(v => v < 0).length / validReturns.length;
      
      return { mean, median, stdDev, sharpe, pLoss, label };
    };
    
    // Run baseline
    setProgress({ current: 25, total: 100, phase: `Baseline Monte Carlo (${pathsPerSwap} paths)...` });
    await new Promise(r => setTimeout(r, 10));
    const baselineMC = await runMiniMonteCarlo(adjustedWeights, 'Baseline');
    
    // Run for top swaps
    const swapMCResults = [];
    for (let i = 0; i < topSwaps.length; i++) {
      const swap = topSwaps[i];
      const progress = 30 + Math.round((i / topSwaps.length) * 65);
      setProgress({ 
        current: progress, 
        total: 100, 
        phase: `MC: Swap ${i + 1}/${topSwaps.length} (${swap.sellTicker}→${swap.buyTicker})...` 
      });
      await new Promise(r => setTimeout(r, 10));
      
      const swapAdjustedWeights = adjustedWeights.map((w, idx) => {
        if (idx === swap.sellIdx) return w - swapAmount * leverageRatio;
        if (idx === swap.buyIdx) return w + swapAmount * leverageRatio;
        return w;
      });
      
      const mcResult = await runMiniMonteCarlo(swapAdjustedWeights, `${swap.sellTicker}→${swap.buyTicker}`);
      swapMCResults.push({
        ...swap,
        mc: mcResult,
        deltaMetrics: {
          deltaMean: mcResult.mean - baselineMC.mean,
          deltaMedian: mcResult.median - baselineMC.median,
          deltaPLoss: mcResult.pLoss - baselineMC.pLoss,
          deltaMCSharpe: mcResult.sharpe - baselineMC.sharpe,
        }
      });
    }
    
    swapMCResults.sort((a, b) => b.deltaMetrics.deltaMCSharpe - a.deltaMetrics.deltaMCSharpe);
    
    setProgress({ current: 95, total: 100, phase: 'Finalizing...' });
    await new Promise(r => setTimeout(r, 10));
    
    // Compile results
    const results = {
      timestamp: Date.now(),
      computeTime: performance.now() - startTime,
      pathsPerScenario: pathsPerSwap,
      useQmc: useQmc || false,
      leverageRatio,
      effectiveCashWeight,
      
      current: {
        portfolioReturn: currentPortfolioReturn,
        portfolioVol: currentPortfolioVol,
        sharpe: currentSharpe,
        mcResults: baselineMC,
      },
      
      positions: tickers.map((ticker, i) => ({
        ticker,
        weight: weights[i],
        adjustedWeight: adjustedWeights[i],
        mu: muArray[i],
        sigma: sigmaArray[i],
        mctr: mctr[i],
        riskContribution: riskContribution[i],
        iSharpe: iSharpe[i],
        optimalityRatio: optimalityRatio[i],
        assetSharpe: sigmaArray[i] > 0 ? (muArray[i] - rf) / sigmaArray[i] : 0,
      })),
      
      swapMatrix: {
        tickers,
        deltaSharpe: swapDeltaSharpe,
        deltaVol: swapDeltaVol,
        deltaReturn: swapDeltaReturn,
      },
      
      topSwaps: swapMCResults,
      baselineMC,
      
      riskParity: {
        weights: riskParityWeights,
        portfolioReturn: riskParityReturn,
        portfolioVol: riskParityVol,
        sharpe: riskParitySharpe,
        deltaSharpe: riskParitySharpe - currentSharpe,
      },
    };
    
    const optTime = (results.computeTime / 1000).toFixed(1);
    console.log(`✅ Optimization complete in ${optTime}s`);
    
    setOptimizationResults(results);
    setProgress({ current: 100, total: 100, phase: 'Complete!' });
    setIsOptimizing(false);
    
    toast.success(`Optimization complete in ${optTime}s`, {
      duration: 4000,
    });
  }, [positions, weights, editedCorrelation, riskFreeRate, swapSize, optimizationPaths,
      getDistributionParams, grossPositionsValue, portfolioValue, cashBalance, cashRate, useQmc, setOptimizationResults]);

  /**
   * Analyze a specific swap scenario
   */
  const analyzeSwap = useCallback((sellIdx, buyIdx) => {
    if (!optimizationResults?.swapMatrix) return null;
    
    const matrix = optimizationResults.swapMatrix;
    return {
      deltaSharpe: matrix.deltaSharpe[sellIdx][buyIdx],
      deltaVol: matrix.deltaVol[sellIdx][buyIdx],
      deltaReturn: matrix.deltaReturn[sellIdx][buyIdx],
    };
  }, [optimizationResults]);

  return {
    // Data
    optimizationResults,
    
    // State
    isOptimizing,
    progress,
    
    // Actions
    runOptimization,
    analyzeSwap,
  };
}
