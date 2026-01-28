/**
 * Monte Carlo Simulation Web Worker
 * Runs simulation paths in parallel across CPU cores
 */

// Box-Muller transform for standard normal random numbers
const boxMuller = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

// Normal CDF approximation (Abramowitz and Stegun)
const normalCDF = (x) => {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  
  return 0.5 * (1.0 + sign * y);
};

// Student-t inverse CDF approximation
const studentTInvCDF = (p, df) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  
  // Use normal approximation for high df
  if (df > 30) {
    const a = 1 / (df - 0.5);
    const b = 48 / (a * a);
    let c = ((20700 * a / b - 98) * a - 16) * a + 96.36;
    const d = ((94.5 / (b + c) - 3) / b + 1) * Math.sqrt(a * Math.PI / 2) * df;
    let x = d * p;
    let y = Math.pow(x, 2 / df);
    if (y > 0.05 + a) {
      x = normalCDFInv(p);
      y = x * x;
      if (df < 5) c = c + 0.3 * (df - 4.5) * (x + 0.6);
      c = (((0.05 * d * x - 5) * x - 7) * x - 2) * x + b + c;
      y = (((((0.4 * y + 6.3) * y + 36) * y + 94.5) / c - y - 3) / b + 1) * x;
      y = a * y * y;
      y = y > 0.002 ? Math.exp(y) - 1 : 0.5 * y * y + y;
    } else {
      y = ((1 / (((df + 6) / (df * y) - 0.089 * d - 0.822) * (df + 2) * 3) + 0.5 / (df + 4)) * y - 1) * (df + 1) / (df + 2) + 1 / y;
    }
    return (p > 0.5 ? 1 : -1) * Math.sqrt(df * y);
  }
  
  // For low df, use approximation based on normal
  const x = normalCDFInv(p);
  const g1 = (x * x * x + x) / 4;
  const g2 = ((5 * x * x * x * x * x + 16 * x * x * x + 3 * x) / 96);
  return x + g1 / df + g2 / (df * df);
};

// Normal inverse CDF (approximation)
const normalCDFInv = (p) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  
  const a = [
    -3.969683028665376e+01, 2.209460984245205e+02,
    -2.759285104469687e+02, 1.383577518672690e+02,
    -3.066479806614716e+01, 2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01, 1.615858368580409e+02,
    -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
    4.374664141464968e+00, 2.938163982698783e+00
  ];
  const d = [
    7.784695709041462e-03, 3.224671290700398e-01,
    2.445134137142996e+00, 3.754408661907416e+00
  ];
  
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q, r;
  
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
};

/**
 * Run Monte Carlo simulation for a batch of paths
 */
const runSimulationBatch = (params) => {
  const {
    startPath,
    numPaths,
    n,
    L,                    // Cholesky matrix (flattened)
    annualMu,
    annualSigma,
    skews,
    tailDfs,
    adjustedWeights,
    effectiveCashWeight,
    cashRate,
    annualVol,           // Pre-computed portfolio volatility
  } = params;
  
  // Pre-allocate result arrays using TypedArrays for better performance
  const terminalReturns = new Float64Array(numPaths);
  const maxDrawdowns = new Float64Array(numPaths);
  
  // Temp arrays - reuse across iterations to avoid GC
  const z = new Float64Array(n);
  const correlatedZ = new Float64Array(n);
  const assetReturns = new Float64Array(n);
  
  for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
    // Generate independent standard normals
    for (let i = 0; i < n; i++) {
      z[i] = boxMuller();
    }
    
    // Apply Cholesky to get correlated standard normals
    // L is stored as flattened lower triangular: L[i][j] = L[i * n + j] for j <= i
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += L[i * n + j] * z[j];
      }
      // Clamp to reasonable range
      correlatedZ[i] = Math.max(-6, Math.min(6, sum || 0));
    }
    
    // Transform each asset and compute returns
    let positionsReturn = 0;
    
    for (let i = 0; i < n; i++) {
      let transformed = correlatedZ[i];
      
      // Apply fat tails via Student-t transform
      const df = tailDfs[i] || 30;
      if (df < 30) {
        const u = normalCDF(transformed);
        transformed = studentTInvCDF(u, df);
        if (df > 2) {
          transformed *= Math.sqrt((df - 2) / df);
        }
      }
      
      // Safeguard
      if (!isFinite(transformed)) transformed = correlatedZ[i];
      transformed = Math.max(-6, Math.min(6, transformed));
      
      // Apply skew
      const skew = skews[i] || 0;
      if (Math.abs(skew) > 0.01) {
        const delta = skew / Math.sqrt(1 + skew * skew);
        const raw = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed);
        const meanShift = delta * Math.sqrt(2 / Math.PI);
        transformed = raw - meanShift;
      }
      
      // Final safeguard
      if (!isFinite(transformed)) transformed = 0;
      transformed = Math.max(-6, Math.min(6, transformed));
      
      // Compute asset return
      const mu = annualMu[i] || 0;
      const sigma = annualSigma[i] || 0.2;
      const assetReturn = mu + transformed * sigma;
      assetReturns[i] = Math.max(-1, Math.min(10, assetReturn));
      
      // Add to portfolio return
      const w = adjustedWeights[i] || 0;
      positionsReturn += w * assetReturns[i];
    }
    
    // Add cash return
    const cashReturn = (effectiveCashWeight || 0) * (cashRate || 0);
    const portfolioReturn = Math.max(-1, Math.min(10, positionsReturn + cashReturn));
    
    terminalReturns[pathIdx] = isFinite(portfolioReturn) ? portfolioReturn : 0;
    
    // Estimate max drawdown (using pre-computed annualVol)
    const ddRandom = Math.abs(boxMuller());
    const estimatedMaxDD = annualVol * ddRandom * 0.8;
    maxDrawdowns[pathIdx] = Math.max(0, Math.min(1, estimatedMaxDD));
  }
  
  return {
    terminalReturns: Array.from(terminalReturns),
    maxDrawdowns: Array.from(maxDrawdowns),
  };
};

// Handle messages from main thread
self.onmessage = (e) => {
  const { type, params, id } = e.data;
  
  if (type === 'runBatch') {
    const startTime = performance.now();
    const result = runSimulationBatch(params);
    const elapsed = performance.now() - startTime;
    
    self.postMessage({
      type: 'batchComplete',
      id,
      result,
      elapsed,
    });
  }
};
