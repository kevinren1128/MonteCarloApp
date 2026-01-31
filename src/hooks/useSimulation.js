import { useCallback, useState, useRef } from 'react';

// Utils
import { choleskyDecomposition } from '../utils/matrix';

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
 * Manages simulation state and provides the runSimulation function.
 * The runSimulation function receives all needed data as parameters,
 * allowing the hook to be called early in the component.
 *
 * @param {Object} params - Initial state parameters
 * @param {Object} params.initialState - Optional initial state from localStorage
 * @param {Function} params.showToast - Toast notification function
 */
export function useSimulation({
  initialState = {},
  showToast,
} = {}) {
  // Simulation parameters (initialized from savedData if available)
  const [numPaths, setNumPaths] = useState(initialState.numPaths || 10000);
  const [useQmc, setUseQmc] = useState(initialState.useQmc || false);
  const [fatTailMethod, setFatTailMethod] = useState(initialState.fatTailMethod || 'multivariateTStudent');
  const [drawdownThreshold, setDrawdownThreshold] = useState(initialState.drawdownThreshold || 20);
  const [gldAsCash, setGldAsCash] = useState(initialState.gldAsCash || false);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResults, setSimulationResults] = useState(initialState.simulationResults || null);
  const [previousSimulationResults, setPreviousSimulationResults] = useState(null);

  // Ref for abort capability
  const abortRef = useRef(false);

  /**
   * Run Monte Carlo simulation
   * All portfolio data is passed as parameters when called, not at hook init.
   *
   * @param {Object} params - Simulation parameters
   * @param {Array|null} params.correlationMatrix - Correlation matrix to use
   * @param {Array} params.positions - Portfolio positions
   * @param {Array} params.weights - Position weights
   * @param {number} params.portfolioValue - Total portfolio value
   * @param {number} params.grossPositionsValue - Gross positions value
   * @param {number} params.cashBalance - Cash balance
   * @param {number} params.cashRate - Cash interest rate
   * @param {Function} params.getDistributionParams - Function to get distribution params
   */
  const runSimulation = useCallback(async ({
    correlationMatrix = null,
    positions,
    weights,
    portfolioValue,
    grossPositionsValue,
    cashBalance,
    cashRate,
    getDistributionParams,
  }) => {
    const corrMatrix = correlationMatrix;
    const isValidMatrix = Array.isArray(corrMatrix) && corrMatrix.length > 0 && Array.isArray(corrMatrix[0]);

    console.log('🎲 runSimulation called, corrMatrix:', isValidMatrix ? `${corrMatrix.length}x${corrMatrix[0].length}` : 'invalid', 'positions:', positions.length);

    // Mark operation start for crash recovery
    markOperationStart(OperationType.SIMULATION, createPositionsSnapshot(positions), {
      positionCount: positions.length,
    });

    if (!isValidMatrix || positions.length === 0) {
      console.log('🎲 runSimulation early return: isValidMatrix=', isValidMatrix, 'positions=', positions.length);
      setSimulationResults({
        error: !isValidMatrix
          ? 'No correlation matrix available. Please load market data first (click "Load All" or compute correlations).'
          : 'No positions in portfolio.',
        terminalReturns: [],
        maxDrawdowns: [],
      });
      return;
    }

    // Ensure matrix size matches positions
    if (corrMatrix.length !== positions.length) {
      console.log('🎲 Matrix size mismatch: matrix=', corrMatrix.length, 'positions=', positions.length);
      setSimulationResults({
        error: `Correlation matrix size (${corrMatrix.length}) doesn't match number of positions (${positions.length}). Please reload market data.`,
        terminalReturns: [],
        maxDrawdowns: [],
      });
      return;
    }

    // Save previous results for comparison overlay
    if (simulationResults && !simulationResults.error) {
      setPreviousSimulationResults(simulationResults);
    }

    setIsSimulating(true);
    abortRef.current = false;
    console.log('🎲 Starting simulation...');

    try {
      // Performance timing
      const startTime = performance.now();

      // Use setTimeout to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 50));

      const n = positions.length;
      const paths = numPaths;

      // Derive distribution parameters from percentiles for each position
      const derivedParams = positions.map(p => getDistributionParams(p));
      const annualMu = derivedParams.map(d => d.mu);
      const annualSigma = derivedParams.map(d => d.sigma);
      const skews = derivedParams.map(d => d.skew);
      const tailDfs = derivedParams.map(d => d.tailDf);

      // For GLD as cash: set its vol to near-zero
      if (gldAsCash) {
        const tickers = positions.map(p => p.ticker.toUpperCase());
        const gldIdx = tickers.indexOf('GLD');
        if (gldIdx >= 0) {
          annualSigma[gldIdx] = 0.001;
          annualMu[gldIdx] = 0;
        }
      }

      // Calculate weights including cash adjustment
      const totalValue = portfolioValue;

      // Safeguard against zero/negative portfolio value
      if (totalValue <= 0 || !isFinite(totalValue)) {
        setSimulationResults({
          error: 'Portfolio value is zero or negative. Check your positions and margin.',
          terminalReturns: [],
          maxDrawdowns: [],
        });
        setIsSimulating(false);
        return;
      }

      // For portfolios with shorts, weights already include sign from grossPositionsValue
      const leverageRatio = isFinite(grossPositionsValue / totalValue) ? grossPositionsValue / totalValue : 1;
      const adjustedWeights = weights.map(w => {
        const adjusted = (w || 0) * leverageRatio;
        return isFinite(adjusted) ? adjusted : 0;
      });

      // Cash weight is relative to NAV (can be negative for margin)
      const effectiveCashWeight = isFinite(cashBalance / totalValue) ? cashBalance / totalValue : 0;

      // Cholesky decomposition of correlation matrix
      console.log('🎲 Computing Cholesky decomposition...');

      // Extra safeguard
      if (!Array.isArray(corrMatrix) || corrMatrix.length === 0) {
        console.error('🎲 CRITICAL: corrMatrix is invalid at Cholesky step');
        setSimulationResults({
          error: 'Internal error: correlation matrix became invalid. Please reload market data.',
          terminalReturns: [],
          maxDrawdowns: [],
        });
        setIsSimulating(false);
        return;
      }

      console.log('🎲 corrMatrix size:', corrMatrix.length, 'x', corrMatrix[0]?.length);
      const L = choleskyDecomposition(corrMatrix);
      console.log('🎲 Cholesky done, L[0][0]=', L?.[0]?.[0]);

      // Calculate expected portfolio return (including cash)
      let positionsExpectedReturn = 0;
      for (let i = 0; i < adjustedWeights.length; i++) {
        positionsExpectedReturn += (adjustedWeights[i] || 0) * (annualMu[i] || 0);
      }
      const cashExpectedReturn = effectiveCashWeight * (cashRate || 0);
      const expectedPortfolioReturn = positionsExpectedReturn + cashExpectedReturn;

      // Calculate portfolio variance
      let portfolioVariance = 0;
      for (let i = 0; i < adjustedWeights.length; i++) {
        for (let j = 0; j < adjustedWeights.length; j++) {
          const wi = adjustedWeights[i] || 0;
          const wj = adjustedWeights[j] || 0;
          const corr = corrMatrix?.[i]?.[j] || (i === j ? 1 : 0);
          const sigmaI = annualSigma[i] || 0.2;
          const sigmaJ = annualSigma[j] || 0.2;
          portfolioVariance += wi * wj * corr * sigmaI * sigmaJ;
        }
      }
      const expectedPortfolioVol = Math.sqrt(Math.max(0, portfolioVariance));

      // Pre-compute portfolio volatility (constant across all paths)
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

      // Pre-flatten Cholesky matrix for faster access (row-major order)
      const flatL = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          flatL[i * n + j] = L[i][j] || 0;
        }
      }

      // Convert params to TypedArrays for faster access
      const muArray = new Float64Array(annualMu);
      const sigmaArray = new Float64Array(annualSigma);
      const skewArray = new Float64Array(skews);
      const dfArray = new Float64Array(tailDfs);
      const weightsArray = new Float64Array(adjustedWeights);

      // ==================== WEB WORKER PARALLEL SIMULATION ====================
      const numWorkers = Math.min(8, navigator.hardwareConcurrency || 4);
      const pathsPerWorker = Math.ceil(paths / numWorkers);

      console.log(`🚀 Starting parallel simulation: ${paths.toLocaleString()} paths across ${numWorkers} workers${useQmc ? ' (QMC enabled)' : ''}`);

      // Create worker params
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

      // Run simulation in parallel using Web Workers
      let terminalReturnsArray = [];
      let maxDrawdownsArray = [];

      // Check if Web Workers are supported
      if (typeof Worker !== 'undefined') {
        try {
          // Create inline worker from the worker code
          const workerCode = `
            // Box-Muller transform
            const boxMuller = () => {
              let u = 0, v = 0;
              while (u === 0) u = Math.random();
              while (v === 0) v = Math.random();
              return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
            };

            // ============ HALTON SEQUENCE FOR QMC ============
            const halton = (index, base) => {
              let f = 1;
              let r = 0;
              let i = index;
              while (i > 0) {
                f = f / base;
                r = r + f * (i % base);
                i = Math.floor(i / base);
              }
              return r;
            };

            const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73];

            const haltonPoint = (index, dimensions) => {
              const point = new Float64Array(dimensions);
              for (let d = 0; d < dimensions; d++) {
                const scrambledIndex = index + 1 + d * 100;
                point[d] = halton(scrambledIndex, PRIMES[d % PRIMES.length]);
              }
              return point;
            };

            // Normal CDF
            const normalCDF = (x) => {
              const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
              const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
              const sign = x < 0 ? -1 : 1;
              x = Math.abs(x) / Math.sqrt(2);
              const t = 1.0 / (1.0 + p * x);
              const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
              return 0.5 * (1.0 + sign * y);
            };

            // Normal inverse CDF (Beasley-Springer-Moro algorithm)
            const normalCDFInv = (p) => {
              if (p <= 0) return -Infinity;
              if (p >= 1) return Infinity;
              if (p === 0.5) return 0;
              const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
              const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
              const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
              const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
              const pLow = 0.02425, pHigh = 1 - pLow;
              let q, r;
              if (p < pLow) {
                q = Math.sqrt(-2 * Math.log(p));
                return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
              } else if (p <= pHigh) {
                q = p - 0.5; r = q * q;
                return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
              } else {
                q = Math.sqrt(-2 * Math.log(1 - p));
                return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
              }
            };

            // Student-t inverse CDF
            const studentTInvCDF = (p, df) => {
              if (p <= 0) return -Infinity;
              if (p >= 1) return Infinity;
              if (p === 0.5) return 0;
              if (df > 30) return normalCDFInv(p);
              const x = normalCDFInv(p);
              const g1 = (x*x*x + x) / 4;
              const g2 = ((5*x*x*x*x*x + 16*x*x*x + 3*x) / 96);
              return x + g1/df + g2/(df*df);
            };

            // Box-Muller pair for chi-squared generation
            const boxMullerPair = () => {
              let u = 0, v = 0;
              while (u === 0) u = Math.random();
              while (v === 0) v = Math.random();
              const r = Math.sqrt(-2.0 * Math.log(u));
              const theta = 2.0 * Math.PI * v;
              return [r * Math.cos(theta), r * Math.sin(theta)];
            };

            // Generate chi-squared for multivariate t
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

            // Chi-squared inverse CDF approximation (for QMC)
            const chiSquaredInvCDF = (p, df) => {
              if (p <= 0) return 0;
              if (p >= 1) return df * 10;
              const z = normalCDFInv(p);
              const h = 2 / (9 * df);
              const x = df * Math.pow(1 - h + z * Math.sqrt(h), 3);
              return Math.max(0.01, x);
            };

            self.onmessage = (e) => {
              const { numPaths, n, L, annualMu, annualSigma, skews, tailDfs, adjustedWeights, effectiveCashWeight, cashRate, annualVol, fatTailMethod, useQmc, qmcStartIndex } = e.data;

              const terminalReturns = new Float64Array(numPaths);
              const maxDrawdowns = new Float64Array(numPaths);
              const z = new Float64Array(n);
              const correlatedZ = new Float64Array(n);

              const avgDf = Math.min(...tailDfs.filter(d => d > 0 && d < 100)) || 10;
              const useMultivariateT = fatTailMethod === 'multivariateTStudent';

              const qmcDims = n + 1;
              const baseIndex = qmcStartIndex || 0;

              for (let path = 0; path < numPaths; path++) {
                // Generate correlated normals
                if (useQmc) {
                  const u = haltonPoint(baseIndex + path, qmcDims);
                  for (let i = 0; i < n; i++) {
                    const ui = Math.max(0.0001, Math.min(0.9999, u[i]));
                    z[i] = normalCDFInv(ui);
                  }
                } else {
                  for (let i = 0; i < n; i++) z[i] = boxMuller();
                }

                // Apply Cholesky correlation
                for (let i = 0; i < n; i++) {
                  let sum = 0;
                  for (let j = 0; j <= i; j++) sum += L[i * n + j] * z[j];
                  correlatedZ[i] = sum || 0;
                }

                // Transform and compute portfolio return
                let positionsReturn = 0;

                if (useMultivariateT && avgDf < 30) {
                  let chiSquared;
                  if (useQmc) {
                    const u = haltonPoint(baseIndex + path, qmcDims);
                    const uChi = Math.max(0.0001, Math.min(0.9999, u[n]));
                    chiSquared = chiSquaredInvCDF(uChi, avgDf);
                  } else {
                    chiSquared = generateChiSquared(avgDf);
                  }
                  const scaleFactor = Math.sqrt(avgDf / chiSquared);
                  const varianceCorrection = avgDf > 2 ? Math.sqrt((avgDf - 2) / avgDf) : 1;

                  for (let i = 0; i < n; i++) {
                    let transformed = correlatedZ[i] * scaleFactor * varianceCorrection;

                    const skew = skews[i] || 0;
                    if (Math.abs(skew) > 0.01) {
                      const delta = skew / Math.sqrt(1 + skew * skew);
                      transformed = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed) - delta * Math.sqrt(2 / Math.PI);
                    }
                    if (!isFinite(transformed)) transformed = 0;
                    transformed = Math.max(-8, Math.min(8, transformed));

                    const assetReturn = (annualMu[i] || 0) + transformed * (annualSigma[i] || 0.2);
                    positionsReturn += (adjustedWeights[i] || 0) * Math.max(-1, Math.min(10, assetReturn));
                  }
                } else {
                  for (let i = 0; i < n; i++) {
                    let transformed = Math.max(-6, Math.min(6, correlatedZ[i]));
                    const df = tailDfs[i] || 30;

                    if (df < 30) {
                      transformed = studentTInvCDF(normalCDF(transformed), df);
                      if (df > 2) transformed *= Math.sqrt((df - 2) / df);
                    }
                    if (!isFinite(transformed)) transformed = correlatedZ[i];
                    transformed = Math.max(-6, Math.min(6, transformed));

                    const skew = skews[i] || 0;
                    if (Math.abs(skew) > 0.01) {
                      const delta = skew / Math.sqrt(1 + skew * skew);
                      transformed = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed) - delta * Math.sqrt(2 / Math.PI);
                    }
                    if (!isFinite(transformed)) transformed = 0;
                    transformed = Math.max(-6, Math.min(6, transformed));

                    const assetReturn = (annualMu[i] || 0) + transformed * (annualSigma[i] || 0.2);
                    positionsReturn += (adjustedWeights[i] || 0) * Math.max(-1, Math.min(10, assetReturn));
                  }
                }

                const portfolioReturn = Math.max(-1, Math.min(10, positionsReturn + (effectiveCashWeight || 0) * (cashRate || 0)));
                terminalReturns[path] = isFinite(portfolioReturn) ? portfolioReturn : 0;

                const ddRandom = Math.abs(boxMuller());
                maxDrawdowns[path] = Math.max(0, Math.min(1, annualVol * ddRandom * 0.8));
              }

              self.postMessage({ terminalReturns: Array.from(terminalReturns), maxDrawdowns: Array.from(maxDrawdowns) });
            };
          `;

          const blob = new Blob([workerCode], { type: 'application/javascript' });
          const workerUrl = URL.createObjectURL(blob);

          // Create worker promises
          console.log('🎲 Creating worker promises...');
          const workerPromises = [];
          for (let w = 0; w < numWorkers; w++) {
            const startPath = w * pathsPerWorker;
            const endPath = Math.min(startPath + pathsPerWorker, paths);
            const batchSize = endPath - startPath;

            if (batchSize <= 0) continue;

            const promise = new Promise((resolve, reject) => {
              const worker = new Worker(workerUrl);

              const timeout = setTimeout(() => {
                console.warn(`🎲 Worker ${w} timed out after 30s`);
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
                console.error(`🎲 Worker ${w} error:`, err);
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

          // Wait for all workers to complete
          console.log(`🎲 Waiting for ${workerPromises.length} workers to complete...`);
          const results = await Promise.all(workerPromises);
          console.log('🎲 All workers completed');

          // Combine results
          for (const result of results) {
            terminalReturnsArray.push(...result.terminalReturns);
            maxDrawdownsArray.push(...result.maxDrawdowns);
          }

          // Clean up blob URL
          URL.revokeObjectURL(workerUrl);

          console.log(`✅ Parallel simulation complete: ${numWorkers} workers finished`);

        } catch (workerError) {
          console.warn('Web Worker failed, falling back to single-threaded:', workerError);
          terminalReturnsArray = [];
          maxDrawdownsArray = [];
        }
      }

      // Fallback: single-threaded simulation if workers failed or unavailable
      if (terminalReturnsArray.length === 0) {
        console.log('Running single-threaded simulation fallback...');

        // Box-Muller transform
        const boxMuller = () => {
          let u = 0, v = 0;
          while (u === 0) u = Math.random();
          while (v === 0) v = Math.random();
          return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
        };

        const terminalReturns = new Float64Array(paths);
        const maxDrawdowns = new Float64Array(paths);
        const z = new Float64Array(n);
        const correlatedZ = new Float64Array(n);

        for (let path = 0; path < paths; path++) {
          for (let i = 0; i < n; i++) z[i] = boxMuller();

          for (let i = 0; i < n; i++) {
            let sum = 0;
            for (let j = 0; j <= i; j++) sum += flatL[i * n + j] * z[j];
            correlatedZ[i] = sum || 0;
          }

          let positionsReturn = 0;
          for (let i = 0; i < n; i++) {
            const transformed = Math.max(-6, Math.min(6, correlatedZ[i]));
            const assetReturn = muArray[i] + transformed * sigmaArray[i];
            positionsReturn += weightsArray[i] * Math.max(-1, Math.min(10, assetReturn));
          }

          const portfolioReturn = Math.max(-1, Math.min(10, positionsReturn + effectiveCashWeight * (cashRate || 0)));
          terminalReturns[path] = isFinite(portfolioReturn) ? portfolioReturn : 0;

          const ddRandom = Math.abs(boxMuller());
          maxDrawdowns[path] = Math.max(0, Math.min(1, precomputedAnnualVol * ddRandom * 0.8));
        }

        terminalReturnsArray = Array.from(terminalReturns);
        maxDrawdownsArray = Array.from(maxDrawdowns);
      }

      // Filter out any NaN or Infinity values
      const validReturns = terminalReturnsArray.filter(v => isFinite(v));
      const validDrawdowns = maxDrawdownsArray.filter(v => isFinite(v));

      if (validReturns.length < numPaths * 0.9) {
        setSimulationResults({
          error: `Simulation produced too many invalid results (${terminalReturnsArray.length - validReturns.length} NaN values). Check your inputs.`,
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

      const percentileIdx = (arr, p) => {
        return Math.min(Math.floor(arr.length * p), arr.length - 1);
      };

      // Compute contributions analytically using conditional expectation
      const assetBetas = [];
      for (let i = 0; i < positions.length; i++) {
        let covWithPortfolio = 0;
        for (let j = 0; j < positions.length; j++) {
          const wj = adjustedWeights[j] || 0;
          const corr_ij = corrMatrix?.[i]?.[j] || (i === j ? 1 : 0);
          const sigma_i = annualSigma[i] || 0.2;
          const sigma_j = annualSigma[j] || 0.2;
          covWithPortfolio += wj * corr_ij * sigma_i * sigma_j;
        }
        const beta = expectedPortfolioVol > 0 ? covWithPortfolio / (expectedPortfolioVol * expectedPortfolioVol) : 0;
        assetBetas.push(beta);
      }

      const getContributionsAtPercentile = (p) => {
        const portfolioReturnAtP = percentile(sortedReturns, p);
        const contributions = [];

        for (let i = 0; i < positions.length; i++) {
          const mu_i = annualMu[i] || 0;
          const beta_i = assetBetas[i] || 0;
          const conditionalReturn = mu_i + beta_i * (portfolioReturnAtP - expectedPortfolioReturn);
          const w_i = adjustedWeights[i] || 0;
          const contribution = w_i * conditionalReturn;
          contributions.push(contribution);
        }

        const cashContrib = (effectiveCashWeight || 0) * (cashRate || 0);
        contributions.push(cashContrib);

        return contributions;
      };

      // Build contribution analysis
      const tickers = positions.map(p => p.ticker || 'Unknown');
      tickers.push(cashBalance >= 0 ? 'Cash' : 'Margin');

      const contributionAnalysis = {
        tickers,
        p5: getContributionsAtPercentile(0.05),
        p25: getContributionsAtPercentile(0.25),
        p50: getContributionsAtPercentile(0.50),
        p75: getContributionsAtPercentile(0.75),
        p95: getContributionsAtPercentile(0.95),
        mean: positions.map((_, i) => {
          const w_i = adjustedWeights[i] || 0;
          const mu_i = annualMu[i] || 0;
          return w_i * mu_i;
        }).concat([(effectiveCashWeight || 0) * (cashRate || 0)]),
      };

      // Calculate statistics
      const meanReturn = validReturns.length > 0
        ? validReturns.reduce((a, b) => a + b, 0) / validReturns.length
        : 0;

      // Calculate terminal dollar values
      const startingValue = portfolioValue;
      const terminalDollars = sortedReturns.map(r => startingValue * (1 + r));
      const meanDollars = startingValue * (1 + meanReturn);

      const simResults = {
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
          p5: terminalDollars[percentileIdx(terminalDollars, 0.05)],
          p10: terminalDollars[percentileIdx(terminalDollars, 0.10)],
          p25: terminalDollars[percentileIdx(terminalDollars, 0.25)],
          p50: terminalDollars[percentileIdx(terminalDollars, 0.50)],
          p75: terminalDollars[percentileIdx(terminalDollars, 0.75)],
          p90: terminalDollars[percentileIdx(terminalDollars, 0.90)],
          p95: terminalDollars[percentileIdx(terminalDollars, 0.95)],
          mean: meanDollars,
          distribution: terminalDollars,
          startingValue: startingValue,
        },
        drawdown: {
          p50: percentile(sortedDrawdowns, 0.50),
          p75: percentile(sortedDrawdowns, 0.75),
          p90: percentile(sortedDrawdowns, 0.90),
          p95: percentile(sortedDrawdowns, 0.95),
          p99: percentile(sortedDrawdowns, 0.99),
          distribution: sortedDrawdowns,
        },
        probLoss: (() => {
          const n = sortedReturns.length;
          const probBreakeven = sortedReturns.filter(v => v < 0).length / n;

          let breakevenPercentile = probBreakeven * 100;
          const negCount = sortedReturns.filter(v => v < 0).length;
          if (negCount > 0 && negCount < n) {
            const lastNegIdx = negCount - 1;
            const firstPosIdx = negCount;
            const lastNeg = sortedReturns[lastNegIdx];
            const firstPos = sortedReturns[firstPosIdx];

            if (firstPos !== lastNeg) {
              const fraction = -lastNeg / (firstPos - lastNeg);
              breakevenPercentile = ((lastNegIdx + fraction) / (n - 1)) * 100;
            }
          } else if (negCount === 0) {
            breakevenPercentile = 0;
          } else if (negCount === n) {
            breakevenPercentile = 100;
          }

          return {
            prob10: sortedReturns.filter(v => v < -0.10).length / n,
            prob20: sortedReturns.filter(v => v < -0.20).length / n,
            prob30: sortedReturns.filter(v => v < -0.30).length / n,
            probCustom: sortedReturns.filter(v => v < -drawdownThreshold / 100).length / n,
            probBreakeven: probBreakeven,
            breakevenPercentile: breakevenPercentile,
          };
        })(),
        expectedReturn: expectedPortfolioReturn,
        expectedVol: expectedPortfolioVol,
        portfolioValue: portfolioValue,
        contributions: contributionAnalysis,
        savedAt: null,
        simulationTime: performance.now() - startTime,
      };

      // Log performance
      const simTime = (performance.now() - startTime) / 1000;
      const pathsPerSec = Math.round(paths / (performance.now() - startTime) * 1000);
      console.log(`✅ Simulation complete: ${paths.toLocaleString()} paths in ${(performance.now() - startTime).toFixed(0)}ms (${pathsPerSec.toLocaleString()} paths/sec)`);

      setSimulationResults(simResults);
      setIsSimulating(false);

      // Mark operation complete for crash recovery
      markOperationComplete();

      // Show success toast
      if (showToast) {
        showToast({
          type: 'success',
          title: 'Simulation Complete',
          message: `${paths.toLocaleString()} paths in ${simTime.toFixed(1)}s (${pathsPerSec.toLocaleString()}/sec)`,
          duration: 4000,
        });
      }

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
  }, [numPaths, drawdownThreshold, gldAsCash, fatTailMethod, useQmc, showToast, simulationResults]);

  return {
    // Simulation parameters
    numPaths,
    setNumPaths,
    useQmc,
    setUseQmc,
    fatTailMethod,
    setFatTailMethod,
    drawdownThreshold,
    setDrawdownThreshold,
    gldAsCash,
    setGldAsCash,

    // Simulation state
    isSimulating,
    simulationResults,
    setSimulationResults,
    previousSimulationResults,

    // Actions
    runSimulation,
  };
}

export default useSimulation;
