/**
 * Quasi-Monte Carlo Simulation Web Worker
 * 
 * Supports both:
 * - Standard Monte Carlo (pseudo-random numbers via Box-Muller)
 * - Quasi-Monte Carlo (Sobol sequences via inverse CDF)
 * 
 * Based on Joy, Boyle & Tan (1996) "Quasi-Monte Carlo Methods in Numerical Finance"
 * 
 * Key insight: QMC provides O(N^-1 * log(N)^s) convergence vs O(N^-1/2) for standard MC
 */

// ============================================================================
// SOBOL SEQUENCE IMPLEMENTATION (embedded for Web Worker)
// ============================================================================

const SOBOL_DIRECTION_NUMBERS = [
  { s: 1, a: 0, m: [1] },
  { s: 2, a: 1, m: [1, 1] },
  { s: 3, a: 1, m: [1, 3, 1] },
  { s: 3, a: 2, m: [1, 1, 1] },
  { s: 4, a: 1, m: [1, 1, 3, 3] },
  { s: 4, a: 4, m: [1, 3, 5, 13] },
  { s: 5, a: 2, m: [1, 1, 5, 5, 17] },
  { s: 5, a: 4, m: [1, 1, 5, 5, 5] },
  { s: 5, a: 7, m: [1, 1, 7, 11, 19] },
  { s: 5, a: 11, m: [1, 1, 5, 1, 1] },
  { s: 5, a: 13, m: [1, 1, 1, 3, 11] },
  { s: 5, a: 14, m: [1, 3, 5, 5, 31] },
  { s: 6, a: 1, m: [1, 3, 3, 9, 7, 49] },
  { s: 6, a: 13, m: [1, 1, 1, 15, 21, 21] },
  { s: 6, a: 16, m: [1, 3, 1, 13, 27, 49] },
  { s: 6, a: 19, m: [1, 1, 1, 15, 7, 5] },
  { s: 6, a: 22, m: [1, 3, 1, 3, 29, 31] },
  { s: 6, a: 25, m: [1, 1, 5, 5, 21, 11] },
  { s: 7, a: 1, m: [1, 3, 5, 15, 17, 63, 13] },
  { s: 7, a: 4, m: [1, 1, 5, 5, 1, 27, 33] },
  { s: 7, a: 7, m: [1, 3, 3, 3, 25, 17, 115] },
];

class SobolSequence {
  constructor(dimensions, skip = 0) {
    this.dimensions = Math.min(dimensions, 21);
    this.maxBits = 30;
    this.scale = Math.pow(2, this.maxBits);
    this.directionNumbers = this._initDirectionNumbers();
    this.lastPoint = new Uint32Array(this.dimensions);
    this.count = 0;
    
    for (let i = 0; i < skip; i++) {
      this.next();
    }
  }
  
  _initDirectionNumbers() {
    const V = [];
    
    for (let j = 0; j < this.dimensions; j++) {
      V[j] = new Uint32Array(this.maxBits + 1);
      
      if (j === 0) {
        for (let k = 1; k <= this.maxBits; k++) {
          V[j][k] = 1 << (this.maxBits - k);
        }
      } else {
        const params = SOBOL_DIRECTION_NUMBERS[j];
        const s = params.s;
        const a = params.a;
        const m = params.m;
        
        for (let k = 1; k <= s; k++) {
          V[j][k] = m[k - 1] << (this.maxBits - k);
        }
        
        for (let k = s + 1; k <= this.maxBits; k++) {
          V[j][k] = V[j][k - s] ^ (V[j][k - s] >> s);
          for (let i = 1; i < s; i++) {
            if ((a >> (s - 1 - i)) & 1) {
              V[j][k] ^= V[j][k - i];
            }
          }
        }
      }
    }
    
    return V;
  }
  
  next() {
    const point = new Float64Array(this.dimensions);
    
    if (this.count === 0) {
      for (let j = 0; j < this.dimensions; j++) {
        point[j] = 0.5 / this.scale;
        this.lastPoint[j] = 0;
      }
    } else {
      let c = this.count - 1;
      let rightmostZero = 1;
      while ((c & 1) === 1) {
        c >>= 1;
        rightmostZero++;
      }
      
      for (let j = 0; j < this.dimensions; j++) {
        this.lastPoint[j] ^= this.directionNumbers[j][rightmostZero];
        point[j] = this.lastPoint[j] / this.scale;
      }
    }
    
    this.count++;
    return point;
  }
}

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

// Box-Muller transform (for standard MC and chi-squared generation)
const boxMuller = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

// Inverse Normal CDF - Acklam's algorithm
// MUST use this for QMC (not Box-Muller) to preserve low discrepancy!
const inverseNormalCDF = (p) => {
  if (p <= 0) return -8;
  if (p >= 1) return 8;
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
    return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
           ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
           (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
            ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }
};

// Normal CDF approximation
const normalCDF = (x) => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
};

// Student-t inverse CDF
const studentTInvCDF = (p, df) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  if (df > 30) return inverseNormalCDF(p);
  
  const x = inverseNormalCDF(p);
  const g1 = (x * x * x + x) / 4;
  const g2 = ((5 * x * x * x * x * x + 16 * x * x * x + 3 * x) / 96);
  return x + g1 / df + g2 / (df * df);
};

/**
 * Inverse Chi-Squared CDF using Wilson-Hilferty approximation
 * 
 * For X ~ χ²(df), the cube root (X/df)^(1/3) is approximately normal:
 *   (X/df)^(1/3) ≈ N(1 - 2/(9*df), 2/(9*df))
 * 
 * Inverting: X = df * (1 - 2/(9*df) + sqrt(2/(9*df)) * Φ^(-1)(u))³
 * 
 * This approximation is accurate for df ≥ 2 and avoids the need for
 * expensive numerical root-finding or incomplete gamma functions.
 * 
 * @param {number} u - Uniform random value in (0, 1)
 * @param {number} df - Degrees of freedom
 * @returns {number} Chi-squared quantile
 */
const inverseChiSquaredCDF = (u, df) => {
  if (u <= 0) return 0;
  if (u >= 1) return Infinity;
  
  // Wilson-Hilferty approximation parameters
  const h = 2 / (9 * df);
  const z = inverseNormalCDF(u);
  
  // Compute the cube root approximation
  const cubeRoot = 1 - h + Math.sqrt(h) * z;
  
  // Handle edge case where cubeRoot could be negative for extreme left tail
  if (cubeRoot <= 0) {
    // Fall back to a simple approximation for extreme left tail
    return Math.max(0.001, df * Math.pow(u, 2 / df));
  }
  
  // X = df * cubeRoot³
  const result = df * Math.pow(cubeRoot, 3);
  
  // Ensure positive and bounded
  return Math.max(0.001, result);
};

// ============================================================================
// SIMULATION BATCH RUNNERS
// ============================================================================

/**
 * Run standard Monte Carlo simulation (pseudo-random)
 */
const runStandardMCBatch = (params) => {
  const {
    startPath,
    numPaths,
    n,
    L,
    annualMu,
    annualSigma,
    skews,
    tailDfs,
    adjustedWeights,
    effectiveCashWeight,
    cashRate,
    annualVol,
  } = params;
  
  const terminalReturns = new Float64Array(numPaths);
  const maxDrawdowns = new Float64Array(numPaths);
  const z = new Float64Array(n);
  const correlatedZ = new Float64Array(n);
  
  for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
    // Generate independent standard normals using Box-Muller
    for (let i = 0; i < n; i++) {
      z[i] = boxMuller();
    }
    
    // Apply Cholesky
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += L[i * n + j] * z[j];
      }
      correlatedZ[i] = Math.max(-6, Math.min(6, sum || 0));
    }
    
    // Transform and compute returns
    let positionsReturn = 0;
    for (let i = 0; i < n; i++) {
      let transformed = correlatedZ[i];
      
      const df = tailDfs[i] || 30;
      if (df < 30) {
        const u = normalCDF(transformed);
        transformed = studentTInvCDF(u, df);
        if (df > 2) transformed *= Math.sqrt((df - 2) / df);
      }
      
      if (!isFinite(transformed)) transformed = correlatedZ[i];
      transformed = Math.max(-6, Math.min(6, transformed));
      
      const skew = skews[i] || 0;
      if (Math.abs(skew) > 0.01) {
        const delta = skew / Math.sqrt(1 + skew * skew);
        const raw = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed);
        const meanShift = delta * Math.sqrt(2 / Math.PI);
        transformed = raw - meanShift;
      }
      
      if (!isFinite(transformed)) transformed = 0;
      transformed = Math.max(-6, Math.min(6, transformed));
      
      const mu = annualMu[i] || 0;
      const sigma = annualSigma[i] || 0.2;
      const assetReturn = Math.max(-1, Math.min(10, mu + transformed * sigma));
      
      positionsReturn += (adjustedWeights[i] || 0) * assetReturn;
    }
    
    const cashReturn = (effectiveCashWeight || 0) * (cashRate || 0);
    terminalReturns[pathIdx] = Math.max(-1, Math.min(10, positionsReturn + cashReturn));
    
    const ddRandom = Math.abs(boxMuller());
    maxDrawdowns[pathIdx] = Math.max(0, Math.min(1, annualVol * ddRandom * 0.8));
  }
  
  return { terminalReturns: Array.from(terminalReturns), maxDrawdowns: Array.from(maxDrawdowns) };
};

/**
 * Run Quasi-Monte Carlo simulation (Sobol sequence)
 * 
 * Key differences from standard MC:
 * 1. Uses Sobol sequence instead of Math.random()
 * 2. Uses inverse CDF instead of Box-Muller (critical!)
 * 3. Provides deterministic, reproducible results
 */
const runQMCBatch = (params) => {
  const {
    startPath,
    numPaths,
    n,
    L,
    annualMu,
    annualSigma,
    skews,
    tailDfs,
    adjustedWeights,
    effectiveCashWeight,
    cashRate,
    annualVol,
    qmcSkip = 1023, // Default: skip 2^10 - 1 points (Fox 1986 recommendation)
  } = params;
  
  const terminalReturns = new Float64Array(numPaths);
  const maxDrawdowns = new Float64Array(numPaths);
  
  // Initialize Sobol sequence generator
  // Skip initial points + offset by startPath for parallel batch processing
  const sobol = new SobolSequence(n, qmcSkip + startPath);
  
  const correlatedZ = new Float64Array(n);
  
  for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
    // Get low-discrepancy point from Sobol sequence
    const uniformPoint = sobol.next();
    
    // Transform to standard normals using INVERSE CDF (not Box-Muller!)
    // This preserves the low-discrepancy structure
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      // Clamp to avoid numerical issues at boundaries
      const u = Math.max(1e-10, Math.min(1 - 1e-10, uniformPoint[i]));
      z[i] = inverseNormalCDF(u);
    }
    
    // Apply Cholesky to introduce correlations
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += L[i * n + j] * z[j];
      }
      correlatedZ[i] = Math.max(-6, Math.min(6, sum || 0));
    }
    
    // Transform and compute returns (same as standard MC from here)
    let positionsReturn = 0;
    for (let i = 0; i < n; i++) {
      let transformed = correlatedZ[i];
      
      const df = tailDfs[i] || 30;
      if (df < 30) {
        const u = normalCDF(transformed);
        transformed = studentTInvCDF(u, df);
        if (df > 2) transformed *= Math.sqrt((df - 2) / df);
      }
      
      if (!isFinite(transformed)) transformed = correlatedZ[i];
      transformed = Math.max(-6, Math.min(6, transformed));
      
      const skew = skews[i] || 0;
      if (Math.abs(skew) > 0.01) {
        const delta = skew / Math.sqrt(1 + skew * skew);
        const raw = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed);
        const meanShift = delta * Math.sqrt(2 / Math.PI);
        transformed = raw - meanShift;
      }
      
      if (!isFinite(transformed)) transformed = 0;
      transformed = Math.max(-6, Math.min(6, transformed));
      
      const mu = annualMu[i] || 0;
      const sigma = annualSigma[i] || 0.2;
      const assetReturn = Math.max(-1, Math.min(10, mu + transformed * sigma));
      
      positionsReturn += (adjustedWeights[i] || 0) * assetReturn;
    }
    
    const cashReturn = (effectiveCashWeight || 0) * (cashRate || 0);
    terminalReturns[pathIdx] = Math.max(-1, Math.min(10, positionsReturn + cashReturn));
    
    // For max drawdown estimation, we can use QMC for this too if desired
    // For now, using a simple estimate
    const ddRandom = Math.abs(boxMuller()); // Could also use QMC here
    maxDrawdowns[pathIdx] = Math.max(0, Math.min(1, annualVol * ddRandom * 0.8));
  }
  
  return { terminalReturns: Array.from(terminalReturns), maxDrawdowns: Array.from(maxDrawdowns) };
};

/**
 * Run Quasi-Monte Carlo with Multivariate-t distribution
 * 
 * Combines QMC low-discrepancy sequences with true multivariate t-distribution
 * for fat tails that preserve correlations exactly.
 * 
 * FIXED: Now uses an extra Sobol dimension for chi-squared generation via
 * inverse CDF, maintaining full QMC consistency instead of mixing with
 * pseudo-random Box-Muller. This preserves the low-discrepancy properties
 * throughout the entire simulation.
 */
const runQMCMultivariateTBatch = (params) => {
  const {
    startPath,
    numPaths,
    n,
    L,
    annualMu,
    annualSigma,
    skews,
    sharedDf = 10, // Shared df for multivariate t
    adjustedWeights,
    effectiveCashWeight,
    cashRate,
    annualVol,
    qmcSkip = 1023,
  } = params;
  
  const terminalReturns = new Float64Array(numPaths);
  const maxDrawdowns = new Float64Array(numPaths);
  
  // Use n+1 dimensions: n for correlated normals + 1 for chi-squared
  // This maintains full QMC consistency
  const sobol = new SobolSequence(n + 1, qmcSkip + startPath);
  const correlatedZ = new Float64Array(n);
  
  for (let pathIdx = 0; pathIdx < numPaths; pathIdx++) {
    // Get QMC uniform point (n+1 dimensions)
    const uniformPoint = sobol.next();
    
    // Transform first n dimensions to standard normals for assets
    const z = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const u = Math.max(1e-10, Math.min(1 - 1e-10, uniformPoint[i]));
      z[i] = inverseNormalCDF(u);
    }
    
    // Apply Cholesky to create correlated normals
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += L[i * n + j] * z[j];
      }
      correlatedZ[i] = sum;
    }
    
    // Generate SHARED chi-squared using the (n+1)th Sobol dimension
    // This is the key fix: using inverse chi-squared CDF instead of Box-Muller
    const uChi = Math.max(1e-10, Math.min(1 - 1e-10, uniformPoint[n]));
    const chiSquared = inverseChiSquaredCDF(uChi, sharedDf);
    
    // Scale factor for multivariate t: sqrt(df / chi-squared)
    const scaleFactor = Math.sqrt(sharedDf / chiSquared);
    // Variance correction so marginals have unit variance
    const varianceCorrection = sharedDf > 2 ? Math.sqrt((sharedDf - 2) / sharedDf) : 1;
    
    // Compute returns - all assets scaled by the SAME factor (preserves correlation)
    let positionsReturn = 0;
    for (let i = 0; i < n; i++) {
      let transformed = correlatedZ[i] * scaleFactor * varianceCorrection;
      
      // Apply skewness if specified
      const skew = skews[i] || 0;
      if (Math.abs(skew) > 0.01) {
        const delta = skew / Math.sqrt(1 + skew * skew);
        transformed = transformed * Math.sqrt(1 - delta * delta) + 
                     delta * Math.abs(transformed) - 
                     delta * Math.sqrt(2 / Math.PI);
      }
      
      transformed = Math.max(-8, Math.min(8, transformed));
      
      const mu = annualMu[i] || 0;
      const sigma = annualSigma[i] || 0.2;
      const assetReturn = Math.max(-1, Math.min(10, mu + transformed * sigma));
      
      positionsReturn += (adjustedWeights[i] || 0) * assetReturn;
    }
    
    const cashReturn = (effectiveCashWeight || 0) * (cashRate || 0);
    terminalReturns[pathIdx] = Math.max(-1, Math.min(10, positionsReturn + cashReturn));
    
    // Max drawdown estimation (uses simple heuristic)
    // Could also use QMC here but drawdown is secondary output
    const ddEstimate = annualVol * Math.abs(correlatedZ[0] || 0) * 0.5;
    maxDrawdowns[pathIdx] = Math.max(0, Math.min(1, ddEstimate));
  }
  
  return { terminalReturns: Array.from(terminalReturns), maxDrawdowns: Array.from(maxDrawdowns) };
};

// ============================================================================
// WORKER MESSAGE HANDLER
// ============================================================================

self.onmessage = (e) => {
  const { type, params, id } = e.data;
  
  if (type === 'runBatch') {
    const startTime = performance.now();
    
    // Select simulation method based on params
    let result;
    const method = params.simulationMethod || 'standard';
    
    switch (method) {
      case 'qmc':
      case 'quasi-monte-carlo':
      case 'sobol':
        result = runQMCBatch(params);
        break;
      
      case 'qmc-multivariate-t':
      case 'qmc-mvt':
        result = runQMCMultivariateTBatch(params);
        break;
      
      case 'standard':
      case 'monte-carlo':
      default:
        result = runStandardMCBatch(params);
        break;
    }
    
    const elapsed = performance.now() - startTime;
    
    self.postMessage({
      type: 'batchComplete',
      id,
      result,
      elapsed,
      method,
    });
  }
};
