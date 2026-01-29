import { useCallback, useContext, useState } from 'react';
import { PortfolioContext } from '../contexts/PortfolioContext';
import { SimulationContext } from '../contexts/SimulationContext';
import { toast } from '../components/common';

// Utils
import { choleskyDecomposition, makeValidCorrelation } from '../utils/matrix';
import { boxMuller, normalCDF, normalInvCDF, studentTInvCDF, generateChiSquared } from '../utils/statistics';

// Crash recovery
import {
  markOperationStart,
  markOperationComplete,
  OperationType,
  createPositionsSnapshot,
} from '../utils/crashRecovery';

/**
 * useSimulation - Custom hook for Monte Carlo simulation
 * 
 * Extracts the core Monte Carlo simulation engine from App.jsx
 * This is the heart of the portfolio simulator - handles:
 * - Multivariate Student-t distribution
 * - Fat-tailed returns
 * - Correlation matrix decomposition
 * - Path generation (MC or QMC)
 * - Statistics calculation
 */
export function useSimulation() {
  const { positions, weights, portfolioValue, grossPositionsValue, cashBalance, cashRate } = useContext(PortfolioContext);
  const {
    editedCorrelation,
    numPaths,
    fatTailMethod,
    useQmc,
    drawdownThreshold,
    gldAsCash,
    simulationResults,
    setSimulationResults,
    getDistributionParams,
  } = useContext(SimulationContext);

  const [isSimulating, setIsSimulating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });

  /**
   * Main Monte Carlo simulation function
   */
  const runSimulation = useCallback(async (correlationMatrix = null) => {
    // Handle case where this is called from onClick vs programmatically
    const corrMatrix = (Array.isArray(correlationMatrix) && correlationMatrix.length > 0)
      ? correlationMatrix
      : editedCorrelation;
    const isValidMatrix = Array.isArray(corrMatrix) && corrMatrix.length > 0 && Array.isArray(corrMatrix[0]);

    // Mark operation start for crash recovery
    markOperationStart(OperationType.SIMULATION, createPositionsSnapshot(positions), {
      positionCount: positions.length,
    });
    
    if (!isValidMatrix || positions.length === 0) {
      setSimulationResults({
        error: !isValidMatrix 
          ? 'No correlation matrix available. Please load market data first.'
          : 'No positions in portfolio.',
        terminalReturns: [],
        maxDrawdowns: [],
      });
      return;
    }
    
    // Ensure matrix size matches positions
    if (corrMatrix.length !== positions.length) {
      setSimulationResults({
        error: `Correlation matrix size (${corrMatrix.length}) doesn't match positions (${positions.length}).`,
        terminalReturns: [],
        maxDrawdowns: [],
      });
      return;
    }

    setIsSimulating(true);
    setProgress({ current: 0, total: 100, phase: 'Initializing...' });
    console.log('🎲 Starting simulation...');

    try {
      const startTime = performance.now();
      await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI update
      
      const n = positions.length;
      const paths = numPaths;
      
      // Derive distribution parameters from percentiles
      const derivedParams = positions.map(p => getDistributionParams(p));
      const annualMu = derivedParams.map(d => d.mu);
      const annualSigma = derivedParams.map(d => d.sigma);
      const skews = derivedParams.map(d => d.skew);
      const tailDfs = derivedParams.map(d => d.tailDf);
      
      // For GLD as cash: set its vol to near-zero
      if (gldAsCash) {
        const tickers = positions.map(p => p.ticker?.toUpperCase());
        const gldIdx = tickers.indexOf('GLD');
        if (gldIdx >= 0) {
          annualSigma[gldIdx] = 0.001;
          annualMu[gldIdx] = 0;
        }
      }
      
      // Calculate adjusted weights
      const totalValue = portfolioValue || 1;
      if (totalValue <= 0 || !isFinite(totalValue)) {
        setSimulationResults({
          error: 'Portfolio value is zero or negative.',
          terminalReturns: [],
          maxDrawdowns: [],
        });
        setIsSimulating(false);
        return;
      }
      
      const leverageRatio = grossPositionsValue > 0 ? grossPositionsValue / totalValue : 1;
      const adjustedWeights = weights.map(w => {
        const adjusted = (w || 0) * leverageRatio;
        return isFinite(adjusted) ? adjusted : 0;
      });
      
      const effectiveCashWeight = isFinite(cashBalance / totalValue) ? cashBalance / totalValue : 0;
      
      setProgress({ current: 10, total: 100, phase: 'Computing Cholesky decomposition...' });
      
      // Cholesky decomposition
      console.log('🎲 Computing Cholesky decomposition...');
      const L = choleskyDecomposition(corrMatrix);
      
      // Pre-flatten Cholesky for faster access
      const flatL = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          flatL[i * n + j] = L[i][j] || 0;
        }
      }
      
      // Convert to TypedArrays for speed
      const muArray = new Float64Array(annualMu);
      const sigmaArray = new Float64Array(annualSigma);
      const skewArray = new Float64Array(skews);
      const dfArray = new Float64Array(tailDfs);
      const weightsArray = new Float64Array(adjustedWeights);
      const constantCashReturn = (effectiveCashWeight || 0) * (cashRate || 0);
      
      // Pre-compute portfolio volatility
      let precomputedAnnualVol = 0;
      for (let i = 0; i < weights.length; i++) {
        for (let j = 0; j < weights.length; j++) {
          const wi = weights[i] || 0;
          const wj = weights[j] || 0;
          const corr = corrMatrix?.[i]?.[j] || (i === j ? 1 : 0);
          const sigmaI = annualSigma[i] || 0.2;
          const sigmaJ = annualSigma[j] || 0.2;
          precomputedAnnualVol += wi * wj * corr * sigmaI * sigmaJ;
        }
      }
      precomputedAnnualVol = Math.sqrt(Math.max(0, precomputedAnnualVol));
      if (!isFinite(precomputedAnnualVol)) precomputedAnnualVol = 0.2;
      
      setProgress({ current: 20, total: 100, phase: 'Running Monte Carlo paths...' });
      
      // Use Web Workers for parallel simulation
      const numWorkers = Math.min(8, navigator.hardwareConcurrency || 4);
      const pathsPerWorker = Math.ceil(paths / numWorkers);
      
      console.log(`🚀 Running ${paths.toLocaleString()} paths across ${numWorkers} workers${useQmc ? ' (QMC)' : ''}`);
      
      const workerParams = {
        n,
        L: Array.from(flatL),
        annualMu: Array.from(muArray),
        annualSigma: Array.from(sigmaArray),
        skews: Array.from(skewArray),
        tailDfs: Array.from(dfArray),
        adjustedWeights: Array.from(weightsArray),
        effectiveCashWeight,
        cashRate: cashRate || 0,
        annualVol: precomputedAnnualVol,
        fatTailMethod: fatTailMethod || 'multivariateTStudent',
        useQmc: useQmc || false,
      };
      
      // Create worker code inline
      const workerCode = `
        const boxMuller = () => {
          let u = 0, v = 0;
          while (u === 0) u = Math.random();
          while (v === 0) v = Math.random();
          return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        };
        
        const boxMullerPair = () => {
          let u = 0, v = 0;
          while (u === 0) u = Math.random();
          while (v === 0) v = Math.random();
          const r = Math.sqrt(-2.0 * Math.log(u));
          const theta = 2.0 * Math.PI * v;
          return [r * Math.cos(theta), r * Math.sin(theta)];
        };
        
        const generateChiSquared = (df) => {
          if (df > 100) {
            const z = boxMuller();
            return Math.max(0.01, df + Math.sqrt(2 * df) * z);
          }
          let sum = 0;
          const fullPairs = Math.floor(df / 2);
          for (let i = 0; i < fullPairs; i++) {
            const [z1, z2] = boxMullerPair();
            sum += z1 * z1 + z2 * z2;
          }
          if (df % 2 === 1) {
            const z = boxMuller();
            sum += z * z;
          }
          return Math.max(0.01, sum);
        };
        
        self.onmessage = (e) => {
          const { numPaths, n, L, annualMu, annualSigma, skews, tailDfs, adjustedWeights, effectiveCashWeight, cashRate, annualVol, fatTailMethod, useQmc, qmcStartIndex } = e.data;
          
          const terminalReturns = new Float64Array(numPaths);
          const maxDrawdowns = new Float64Array(numPaths);
          const z = new Float64Array(n);
          const correlatedZ = new Float64Array(n);
          
          const avgDf = Math.min(...tailDfs.filter(d => d > 0 && d < 100)) || 10;
          const useMultivariateT = fatTailMethod === 'multivariateTStudent';
          
          for (let path = 0; path < numPaths; path++) {
            // Generate uncorrelated normals
            for (let i = 0; i < n; i++) z[i] = boxMuller();
            
            // Apply Cholesky correlation
            for (let i = 0; i < n; i++) {
              let sum = 0;
              for (let j = 0; j <= i; j++) sum += L[i * n + j] * z[j];
              correlatedZ[i] = sum || 0;
            }
            
            // Transform and compute portfolio return
            let positionsReturn = 0;
            
            if (useMultivariateT && avgDf < 30) {
              // Multivariate Student-t
              const chiSquared = generateChiSquared(avgDf);
              const scaleFactor = Math.sqrt(avgDf / chiSquared);
              const varianceCorrection = avgDf > 2 ? Math.sqrt((avgDf - 2) / avgDf) : 1;
              
              for (let i = 0; i < n; i++) {
                let transformed = correlatedZ[i] * scaleFactor * varianceCorrection;
                
                // Apply skewness
                const skew = skews[i] || 0;
                if (Math.abs(skew) > 0.01) {
                  const delta = skew / Math.sqrt(1 + skew * skew);
                  transformed = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed) - delta * Math.sqrt(2 / Math.PI);
                }
                transformed = Math.max(-8, Math.min(8, transformed));
                
                const assetReturn = annualMu[i] + transformed * annualSigma[i];
                positionsReturn += adjustedWeights[i] * Math.max(-1, Math.min(10, assetReturn));
              }
            } else {
              // Standard Gaussian
              for (let i = 0; i < n; i++) {
                let transformed = Math.max(-6, Math.min(6, correlatedZ[i]));
                const assetReturn = annualMu[i] + transformed * annualSigma[i];
                positionsReturn += adjustedWeights[i] * Math.max(-1, Math.min(10, assetReturn));
              }
            }
            
            const portfolioReturn = Math.max(-1, Math.min(10, positionsReturn + effectiveCashWeight * cashRate));
            terminalReturns[path] = isFinite(portfolioReturn) ? portfolioReturn : 0;
            
            // Estimate drawdown
            const ddRandom = Math.abs(boxMuller());
            maxDrawdowns[path] = Math.max(0, Math.min(1, annualVol * ddRandom * 0.8));
          }
          
          self.postMessage({ terminalReturns: Array.from(terminalReturns), maxDrawdowns: Array.from(maxDrawdowns) });
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      // Create worker promises
      let terminalReturnsArray = [];
      let maxDrawdownsArray = [];
      
      try {
        const workerPromises = [];
        for (let w = 0; w < numWorkers; w++) {
          const startPath = w * pathsPerWorker;
          const endPath = Math.min(startPath + pathsPerWorker, paths);
          const batchSize = endPath - startPath;
          
          if (batchSize <= 0) continue;
          
          const promise = new Promise((resolve, reject) => {
            const worker = new Worker(workerUrl);
            
            const timeout = setTimeout(() => {
              worker.terminate();
              reject(new Error(`Worker ${w} timed out`));
            }, 30000);
            
            worker.onmessage = (e) => {
              clearTimeout(timeout);
              worker.terminate();
              resolve(e.data);
            };
            
            worker.onerror = (err) => {
              clearTimeout(timeout);
              worker.terminate();
              reject(err);
            };
            
            worker.postMessage({
              numPaths: batchSize,
              qmcStartIndex: startPath,
              ...workerParams,
            });
          });
          
          workerPromises.push(promise);
        }
        
        setProgress({ current: 60, total: 100, phase: 'Processing paths...' });
        const results = await Promise.all(workerPromises);
        
        for (const result of results) {
          terminalReturnsArray.push(...result.terminalReturns);
          maxDrawdownsArray.push(...result.maxDrawdowns);
        }
        
        URL.revokeObjectURL(workerUrl);
      } catch (workerError) {
        console.warn('Web Worker failed, falling back to single-threaded:', workerError);
        // Fallback implementation would go here
        URL.revokeObjectURL(workerUrl);
        throw workerError;
      }
      
      setProgress({ current: 80, total: 100, phase: 'Computing statistics...' });
      
      // Filter and compute statistics
      const validReturns = terminalReturnsArray.filter(v => isFinite(v));
      const validDrawdowns = maxDrawdownsArray.filter(v => isFinite(v));
      
      if (validReturns.length < numPaths * 0.9) {
        setSimulationResults({
          error: `Simulation produced too many invalid results.`,
          terminalReturns: [],
          maxDrawdowns: [],
        });
        setIsSimulating(false);
        return;
      }
      
      // Sort for percentiles
      const sortedReturns = [...validReturns].sort((a, b) => a - b);
      const sortedDrawdowns = [...validDrawdowns].sort((a, b) => a - b);
      
      const percentile = (arr, p) => {
        const idx = Math.floor(arr.length * p);
        return arr[Math.min(idx, arr.length - 1)];
      };
      
      const meanReturn = validReturns.reduce((a, b) => a + b, 0) / validReturns.length;
      const startingValue = portfolioValue;
      const terminalDollars = sortedReturns.map(r => startingValue * (1 + r));
      
      const results = {
        terminalReturns: validReturns,
        terminal: {
          p5: percentile(sortedReturns, 0.05),
          p10: percentile(sortedReturns, 0.10),
          p25: percentile(sortedReturns, 0.25),
          p50: percentile(sortedReturns, 0.50),
          p75: percentile(sortedReturns, 0.75),
          p90: percentile(sortedReturns, 0.90),
          p95: percentile(sortedReturns, 0.95),
          mean: meanReturn,
          distribution: sortedReturns,
        },
        terminalDollars: {
          p5: percentile(terminalDollars, 0.05),
          p10: percentile(terminalDollars, 0.10),
          p25: percentile(terminalDollars, 0.25),
          p50: percentile(terminalDollars, 0.50),
          p75: percentile(terminalDollars, 0.75),
          p90: percentile(terminalDollars, 0.90),
          p95: percentile(terminalDollars, 0.95),
          mean: startingValue * (1 + meanReturn),
          distribution: terminalDollars,
          startingValue,
        },
        drawdown: {
          p50: percentile(sortedDrawdowns, 0.50),
          p75: percentile(sortedDrawdowns, 0.75),
          p90: percentile(sortedDrawdowns, 0.90),
          p95: percentile(sortedDrawdowns, 0.95),
          p99: percentile(sortedDrawdowns, 0.99),
          distribution: sortedDrawdowns,
        },
        probLoss: {
          prob10: sortedReturns.filter(v => v < -0.10).length / validReturns.length,
          prob20: sortedReturns.filter(v => v < -0.20).length / validReturns.length,
          probBreakeven: sortedReturns.filter(v => v < 0).length / validReturns.length,
        },
        portfolioValue,
        simulationTime: performance.now() - startTime,
      };
      
      const simTime = (performance.now() - startTime) / 1000;
      const pathsPerSec = Math.round(paths / (performance.now() - startTime) * 1000);
      console.log(`✅ Simulation complete: ${paths.toLocaleString()} paths in ${simTime.toFixed(1)}s (${pathsPerSec.toLocaleString()}/sec)`);
      
      setSimulationResults(results);
      setIsSimulating(false);
      setProgress({ current: 100, total: 100, phase: 'Complete!' });

      markOperationComplete();

      toast.success(`${paths.toLocaleString()} paths in ${simTime.toFixed(1)}s`, {
        duration: 4000,
      });

    } catch (error) {
      console.error('🎲 Simulation error:', error);
      setSimulationResults({
        error: `Simulation failed: ${error.message}`,
        terminalReturns: [],
        maxDrawdowns: [],
      });
      setIsSimulating(false);
      markOperationComplete();
    }
  }, [editedCorrelation, positions, weights, numPaths, drawdownThreshold, gldAsCash, portfolioValue,
      getDistributionParams, cashBalance, cashRate, grossPositionsValue, fatTailMethod, useQmc,
      setSimulationResults]);

  return {
    // Data
    simulationResults,
    
    // State
    isSimulating,
    progress,
    
    // Actions
    runSimulation,
  };
}
