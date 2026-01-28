/**
 * Quasi-Monte Carlo Methods for Financial Simulation
 * 
 * Based on:
 * - Joy, Boyle & Tan (1996) "Quasi-Monte Carlo Methods in Numerical Finance"
 * - Bratley & Fox (1988) "Implementing Sobol's Quasi Random Sequence Generator"
 * - Joe & Kuo (2008) "Constructing Sobol Sequences with Better Two-Dimensional Projections"
 * 
 * Key insight from Joy et al.: Using low-discrepancy sequences instead of pseudo-random
 * numbers improves convergence from O(N^-1/2) to O(N^-1 * (log N)^s) and provides
 * deterministic error bounds.
 * 
 * CRITICAL: Must use inverse normal CDF (not Box-Muller) to preserve low discrepancy.
 */

// ============================================================================
// SOBOL SEQUENCE GENERATOR
// ============================================================================

/**
 * Direction numbers for Sobol sequence generation
 * These are the primitive polynomials and initial direction numbers from Joe & Kuo (2008)
 * Supports up to 21 dimensions (sufficient for most portfolio simulations)
 * 
 * Format: [degree, polynomial coefficients a, initial direction numbers m]
 */
const SOBOL_DIRECTION_NUMBERS = [
  // Dimension 1: special case (just powers of 2)
  { s: 1, a: 0, m: [1] },
  // Dimension 2
  { s: 2, a: 1, m: [1, 1] },
  // Dimension 3
  { s: 3, a: 1, m: [1, 3, 1] },
  // Dimension 4
  { s: 3, a: 2, m: [1, 1, 1] },
  // Dimension 5
  { s: 4, a: 1, m: [1, 1, 3, 3] },
  // Dimension 6
  { s: 4, a: 4, m: [1, 3, 5, 13] },
  // Dimension 7
  { s: 5, a: 2, m: [1, 1, 5, 5, 17] },
  // Dimension 8
  { s: 5, a: 4, m: [1, 1, 5, 5, 5] },
  // Dimension 9
  { s: 5, a: 7, m: [1, 1, 7, 11, 19] },
  // Dimension 10
  { s: 5, a: 11, m: [1, 1, 5, 1, 1] },
  // Dimension 11
  { s: 5, a: 13, m: [1, 1, 1, 3, 11] },
  // Dimension 12
  { s: 5, a: 14, m: [1, 3, 5, 5, 31] },
  // Dimension 13
  { s: 6, a: 1, m: [1, 3, 3, 9, 7, 49] },
  // Dimension 14
  { s: 6, a: 13, m: [1, 1, 1, 15, 21, 21] },
  // Dimension 15
  { s: 6, a: 16, m: [1, 3, 1, 13, 27, 49] },
  // Dimension 16
  { s: 6, a: 19, m: [1, 1, 1, 15, 7, 5] },
  // Dimension 17
  { s: 6, a: 22, m: [1, 3, 1, 3, 29, 31] },
  // Dimension 18
  { s: 6, a: 25, m: [1, 1, 5, 5, 21, 11] },
  // Dimension 19
  { s: 7, a: 1, m: [1, 3, 5, 15, 17, 63, 13] },
  // Dimension 20
  { s: 7, a: 4, m: [1, 1, 5, 5, 1, 27, 33] },
  // Dimension 21
  { s: 7, a: 7, m: [1, 3, 3, 3, 25, 17, 115] },
];

/**
 * Sobol sequence generator class
 * 
 * Generates low-discrepancy quasi-random points in [0,1]^s
 * where s is the number of dimensions.
 * 
 * Usage:
 *   const sobol = new SobolSequence(5);  // 5-dimensional
 *   const point1 = sobol.next();  // Returns array of 5 numbers in [0,1)
 *   const point2 = sobol.next();
 *   // Or generate many at once:
 *   const points = sobol.generate(1000);  // 1000 points, each 5-dimensional
 */
export class SobolSequence {
  /**
   * Initialize Sobol sequence generator
   * @param {number} dimensions - Number of dimensions (1-21)
   * @param {number} [skip=0] - Number of initial points to skip (recommended: 2^k - 1)
   */
  constructor(dimensions, skip = 0) {
    if (dimensions < 1 || dimensions > 21) {
      throw new Error(`Sobol sequence supports 1-21 dimensions, got ${dimensions}`);
    }
    
    this.dimensions = dimensions;
    this.maxBits = 30; // Use 30 bits for precision
    this.scale = Math.pow(2, this.maxBits);
    
    // Initialize direction numbers for each dimension
    this.directionNumbers = this._initDirectionNumbers();
    
    // Current state: the last point generated (as integers)
    this.lastPoint = new Uint32Array(dimensions);
    this.count = 0;
    
    // Skip initial points if requested (Fox 1986 recommends starting at r^4 for Faure)
    // For Sobol, skipping 2^k - 1 points can improve uniformity
    for (let i = 0; i < skip; i++) {
      this.next();
    }
  }
  
  /**
   * Initialize direction numbers V[j][k] for each dimension
   * V[j][k] = m[k] * 2^(maxBits - k) for dimension j
   */
  _initDirectionNumbers() {
    const V = [];
    
    for (let j = 0; j < this.dimensions; j++) {
      V[j] = new Uint32Array(this.maxBits + 1);
      
      if (j === 0) {
        // First dimension: V[0][k] = 2^(maxBits - k)
        for (let k = 1; k <= this.maxBits; k++) {
          V[j][k] = 1 << (this.maxBits - k);
        }
      } else {
        const params = SOBOL_DIRECTION_NUMBERS[j];
        const s = params.s;
        const a = params.a;
        const m = params.m;
        
        // Initialize first s direction numbers from the table
        for (let k = 1; k <= s; k++) {
          V[j][k] = m[k - 1] << (this.maxBits - k);
        }
        
        // Generate remaining direction numbers using recurrence relation
        for (let k = s + 1; k <= this.maxBits; k++) {
          V[j][k] = V[j][k - s] ^ (V[j][k - s] >> s);
          
          // XOR with appropriate previous V values based on polynomial
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
  
  /**
   * Generate the next point in the Sobol sequence
   * Uses Gray code optimization for O(1) generation per point
   * @returns {Float64Array} Point in [0,1)^dimensions
   */
  next() {
    const point = new Float64Array(this.dimensions);
    
    if (this.count === 0) {
      // First point is the origin (or close to it)
      // We return a small offset to avoid exactly 0
      for (let j = 0; j < this.dimensions; j++) {
        point[j] = 0.5 / this.scale;
        this.lastPoint[j] = 0;
      }
    } else {
      // Find the rightmost zero bit of count-1 (Gray code trick)
      let c = this.count - 1;
      let rightmostZero = 1;
      while ((c & 1) === 1) {
        c >>= 1;
        rightmostZero++;
      }
      
      // Update each dimension
      for (let j = 0; j < this.dimensions; j++) {
        this.lastPoint[j] ^= this.directionNumbers[j][rightmostZero];
        point[j] = this.lastPoint[j] / this.scale;
      }
    }
    
    this.count++;
    return point;
  }
  
  /**
   * Generate multiple points at once
   * @param {number} n - Number of points to generate
   * @returns {Float64Array[]} Array of n points
   */
  generate(n) {
    const points = [];
    for (let i = 0; i < n; i++) {
      points.push(this.next());
    }
    return points;
  }
  
  /**
   * Reset the sequence to the beginning
   */
  reset() {
    this.lastPoint.fill(0);
    this.count = 0;
  }
  
  /**
   * Skip to a specific index in the sequence
   * @param {number} index - Index to skip to
   */
  skipTo(index) {
    this.reset();
    // Reconstruct state at given index using Gray code
    let gray = index ^ (index >> 1);
    for (let k = 1; k <= this.maxBits && gray > 0; k++) {
      if (gray & 1) {
        for (let j = 0; j < this.dimensions; j++) {
          this.lastPoint[j] ^= this.directionNumbers[j][k];
        }
      }
      gray >>= 1;
    }
    this.count = index;
  }
}

// ============================================================================
// HALTON SEQUENCE (Alternative low-discrepancy sequence)
// ============================================================================

/**
 * First 21 prime numbers for Halton sequence bases
 */
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73];

/**
 * Generate a single Halton sequence value
 * Uses radical inverse function (van der Corput sequence generalized)
 * @param {number} index - Index in sequence (>= 0)
 * @param {number} base - Prime base
 * @returns {number} Value in [0, 1)
 */
export const haltonValue = (index, base) => {
  let result = 0;
  let f = 1 / base;
  let i = index;
  
  while (i > 0) {
    result += f * (i % base);
    i = Math.floor(i / base);
    f /= base;
  }
  
  return result;
};

/**
 * Halton sequence generator class
 * Simpler than Sobol but can have correlation issues at high dimensions
 * 
 * @param {number} dimensions - Number of dimensions
 */
export class HaltonSequence {
  constructor(dimensions, skip = 0) {
    if (dimensions < 1 || dimensions > 21) {
      throw new Error(`Halton sequence supports 1-21 dimensions, got ${dimensions}`);
    }
    
    this.dimensions = dimensions;
    this.bases = PRIMES.slice(0, dimensions);
    this.index = skip;
  }
  
  next() {
    const point = new Float64Array(this.dimensions);
    for (let j = 0; j < this.dimensions; j++) {
      point[j] = haltonValue(this.index, this.bases[j]);
    }
    this.index++;
    return point;
  }
  
  generate(n) {
    const points = [];
    for (let i = 0; i < n; i++) {
      points.push(this.next());
    }
    return points;
  }
  
  reset() {
    this.index = 0;
  }
}

// ============================================================================
// NORMAL VARIATE TRANSFORMATION
// ============================================================================

/**
 * Inverse normal CDF (quantile function) - Acklam's algorithm
 * This is the CORRECT way to transform QMC points to normals.
 * DO NOT use Box-Muller as it destroys the low-discrepancy structure!
 * (See Joy, Boyle & Tan 1996, End Note 6)
 * 
 * @param {number} p - Probability in (0, 1)
 * @returns {number} Standard normal quantile
 */
export const inverseNormalCDF = (p) => {
  // Handle edge cases
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  
  // Coefficients for rational approximation
  const a = [
    -3.969683028665376e+01,  2.209460984245205e+02,
    -2.759285104469687e+02,  1.383577518672690e+02,
    -3.066479806614716e+01,  2.506628277459239e+00
  ];
  const b = [
    -5.447609879822406e+01,  1.615858368580409e+02,
    -1.556989798598866e+02,  6.680131188771972e+01,
    -1.328068155288572e+01
  ];
  const c = [
    -7.784894002430293e-03, -3.223964580411365e-01,
    -2.400758277161838e+00, -2.549732539343734e+00,
     4.374664141464968e+00,  2.938163982698783e+00
  ];
  const d = [
     7.784695709041462e-03,  3.224671290700398e-01,
     2.445134137142996e+00,  3.754408661907416e+00
  ];
  
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  
  let q, r;
  
  if (p < pLow) {
    // Left tail
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
           ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  } else if (p <= pHigh) {
    // Central region
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) * q /
           (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1);
  } else {
    // Right tail
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q + c[1])*q + c[2])*q + c[3])*q + c[4])*q + c[5]) /
            ((((d[0]*q + d[1])*q + d[2])*q + d[3])*q + 1);
  }
};

/**
 * Transform a uniform [0,1] point to standard normal using inverse CDF
 * Includes small epsilon offset to avoid exact 0 or 1
 * @param {number} u - Uniform value in [0, 1]
 * @returns {number} Standard normal value
 */
export const uniformToNormal = (u) => {
  // Clamp to avoid numerical issues at boundaries
  const eps = 1e-10;
  const clampedU = Math.max(eps, Math.min(1 - eps, u));
  return inverseNormalCDF(clampedU);
};

/**
 * Transform an array of uniform [0,1] values to standard normals
 * @param {Float64Array|number[]} uniforms - Array of uniform values
 * @returns {Float64Array} Array of standard normal values
 */
export const uniformsToNormals = (uniforms) => {
  const normals = new Float64Array(uniforms.length);
  for (let i = 0; i < uniforms.length; i++) {
    normals[i] = uniformToNormal(uniforms[i]);
  }
  return normals;
};

// ============================================================================
// QUASI-MONTE CARLO CORRELATED RETURNS GENERATION
// ============================================================================

/**
 * QMC-enhanced correlated normal generator
 * 
 * This class combines:
 * 1. Sobol low-discrepancy sequence for uniform [0,1] points
 * 2. Inverse normal CDF transformation (NOT Box-Muller!)
 * 3. Cholesky decomposition for correlation structure
 * 
 * The result is correlated normal variates with much better space-filling
 * properties than pseudo-random Monte Carlo.
 */
export class QMCCorrelatedNormalGenerator {
  /**
   * @param {number[][]} correlationMatrix - Correlation matrix (n x n)
   * @param {Object} options - Configuration options
   * @param {string} options.sequence - 'sobol' or 'halton' (default: 'sobol')
   * @param {number} options.skip - Number of initial points to skip
   * @param {boolean} options.includeChiSquaredDim - Add extra dimension for chi-squared (for multivariate-t)
   */
  constructor(correlationMatrix, options = {}) {
    const { sequence = 'sobol', skip = 0, includeChiSquaredDim = false } = options;
    
    this.n = correlationMatrix.length;
    this.includeChiSquaredDim = includeChiSquaredDim;
    this.choleskyL = this._choleskyDecomposition(correlationMatrix);
    
    // Use n+1 dimensions if chi-squared dimension is needed for multivariate-t
    const numDimensions = includeChiSquaredDim ? this.n + 1 : this.n;
    
    // Initialize low-discrepancy sequence generator
    if (sequence === 'halton') {
      this.sequenceGenerator = new HaltonSequence(numDimensions, skip);
    } else {
      this.sequenceGenerator = new SobolSequence(numDimensions, skip);
    }
    
    this.sequenceType = sequence;
  }
  
  /**
   * Cholesky decomposition of correlation matrix
   * @param {number[][]} matrix - Positive definite matrix
   * @returns {number[][]} Lower triangular Cholesky factor L where matrix = L * L'
   */
  _choleskyDecomposition(matrix) {
    const n = matrix.length;
    const L = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) {
          sum += L[i][k] * L[j][k];
        }
        
        if (i === j) {
          const diag = matrix[i][i] - sum;
          L[i][j] = diag > 0 ? Math.sqrt(diag) : 0;
        } else {
          L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
        }
      }
    }
    
    return L;
  }
  
  /**
   * Generate correlated standard normal vector using QMC
   * @returns {Float64Array} n-dimensional correlated normal vector
   */
  next() {
    // Step 1: Get low-discrepancy uniform point
    const uniforms = this.sequenceGenerator.next();
    
    // Step 2: Transform first n dimensions to independent standard normals
    const independentNormals = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      independentNormals[i] = uniformToNormal(uniforms[i]);
    }
    
    // Step 3: Apply Cholesky to introduce correlations
    const correlatedNormals = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += this.choleskyL[i][j] * independentNormals[j];
      }
      correlatedNormals[i] = sum;
    }
    
    return correlatedNormals;
  }
  
  /**
   * Generate correlated normal vector with chi-squared uniform for multivariate-t
   * 
   * This method returns both the correlated normals AND a uniform value that
   * can be transformed to chi-squared via inverseChiSquaredCDF. This maintains
   * full QMC consistency for multivariate-t simulation.
   * 
   * @returns {Object} { normals: Float64Array, chiSquaredUniform: number }
   */
  nextWithChiSquared() {
    if (!this.includeChiSquaredDim) {
      throw new Error('Generator not configured for chi-squared dimension. Set includeChiSquaredDim: true in options.');
    }
    
    // Step 1: Get low-discrepancy uniform point (n+1 dimensions)
    const uniforms = this.sequenceGenerator.next();
    
    // Step 2: Transform first n dimensions to independent standard normals
    const independentNormals = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      independentNormals[i] = uniformToNormal(uniforms[i]);
    }
    
    // Step 3: Apply Cholesky to introduce correlations
    const correlatedNormals = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        sum += this.choleskyL[i][j] * independentNormals[j];
      }
      correlatedNormals[i] = sum;
    }
    
    // Step 4: Return normals plus the (n+1)th uniform for chi-squared
    const chiSquaredUniform = Math.max(1e-10, Math.min(1 - 1e-10, uniforms[this.n]));
    
    return {
      normals: correlatedNormals,
      chiSquaredUniform: chiSquaredUniform
    };
  }
  
  /**
   * Generate multiple correlated normal vectors
   * @param {number} count - Number of vectors to generate
   * @returns {Float64Array[]} Array of correlated normal vectors
   */
  generate(count) {
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(this.next());
    }
    return results;
  }
  
  /**
   * Reset the sequence to the beginning
   */
  reset() {
    this.sequenceGenerator.reset();
  }
}

// ============================================================================
// QMC RETURN GENERATOR (Full integration with your existing system)
// ============================================================================

/**
 * Generate QMC-based correlated asset returns
 * 
 * This function is designed to be a drop-in replacement for your existing
 * generateCorrelatedReturns and generateMultivariateTReturns functions,
 * but using quasi-random sequences for better convergence.
 * 
 * @param {QMCCorrelatedNormalGenerator} qmcGenerator - Pre-initialized QMC generator
 * @param {number[]} mus - Expected returns for each asset
 * @param {number[]} sigmas - Volatilities for each asset
 * @param {number[]} [skews] - Skewness parameters (optional)
 * @param {number[]} [dfs] - Degrees of freedom for t-distribution (optional)
 * @returns {number[]} Array of correlated asset returns
 */
export const generateQMCReturns = (qmcGenerator, mus, sigmas, skews = null, dfs = null) => {
  const n = mus.length;
  
  // Get correlated standard normals from QMC generator
  const correlatedNormals = qmcGenerator.next();
  
  // Transform to returns
  const returns = new Array(n);
  
  for (let i = 0; i < n; i++) {
    let z = correlatedNormals[i];
    
    // Optional: Apply fat tails via Student-t transformation
    // (Using probability integral transform to preserve correlation approximately)
    if (dfs && dfs[i] && dfs[i] < 30) {
      const df = dfs[i];
      // Transform: normal -> uniform -> Student-t
      const u = normalCDF(z);
      z = studentTInvCDF(u, df);
      // Variance correction for t-distribution
      if (df > 2) {
        z *= Math.sqrt((df - 2) / df);
      }
    }
    
    // Optional: Apply skewness
    if (skews && Math.abs(skews[i] || 0) > 0.01) {
      const skew = skews[i];
      const delta = skew / Math.sqrt(1 + skew * skew);
      z = z * Math.sqrt(1 - delta * delta) + delta * Math.abs(z) - delta * Math.sqrt(2 / Math.PI);
    }
    
    // Bound and convert to return
    z = Math.max(-6, Math.min(6, z));
    const ret = (mus[i] || 0) + z * (sigmas[i] || 0.2);
    returns[i] = Math.max(-1, Math.min(10, ret));
  }
  
  return returns;
};

/**
 * Generate QMC-based multivariate Student-t returns
 * 
 * Uses a shared chi-squared scaling (true multivariate t) combined with QMC.
 * This preserves the correlation structure exactly while providing fat tails
 * AND better space-filling properties from QMC.
 * 
 * IMPORTANT: The qmcGenerator must be initialized with includeChiSquaredDim: true
 * to maintain full QMC consistency. This ensures the chi-squared scaling factor
 * is also derived from the Sobol sequence rather than pseudo-random numbers.
 * 
 * @param {QMCCorrelatedNormalGenerator} qmcGenerator - Pre-initialized QMC generator (with includeChiSquaredDim: true)
 * @param {number[]} mus - Expected returns
 * @param {number[]} sigmas - Volatilities
 * @param {number} df - Shared degrees of freedom (multivariate t parameter)
 * @param {number[]} [skews] - Optional skewness parameters
 * @returns {number[]} Correlated fat-tailed returns
 */
export const generateQMCMultivariateTReturns = (qmcGenerator, mus, sigmas, df, skews = null) => {
  const n = mus.length;
  
  // Get correlated normals and chi-squared uniform from QMC
  let correlatedNormals, chiSquared;
  
  if (qmcGenerator.includeChiSquaredDim) {
    // Full QMC consistency: use the extra dimension for chi-squared
    const result = qmcGenerator.nextWithChiSquared();
    correlatedNormals = result.normals;
    // Transform uniform to chi-squared via inverse CDF
    chiSquared = inverseChiSquaredCDF(result.chiSquaredUniform, df);
  } else {
    // Fallback: use separate random for chi-squared (breaks QMC consistency)
    correlatedNormals = qmcGenerator.next();
    chiSquared = generateChiSquaredQMC(df);
    console.warn('QMC generator not configured with includeChiSquaredDim. Chi-squared uses fallback random.');
  }
  
  // Scale factor for multivariate t: sqrt(df / chi-squared)
  const scaleFactor = Math.sqrt(df / chiSquared);
  // Variance correction so marginals have unit variance
  const varianceCorrection = df > 2 ? Math.sqrt((df - 2) / df) : 1;
  
  const returns = new Array(n);
  
  for (let i = 0; i < n; i++) {
    let z = correlatedNormals[i] * scaleFactor * varianceCorrection;
    
    // Optional skewness
    if (skews && Math.abs(skews[i] || 0) > 0.01) {
      const skew = skews[i];
      const delta = skew / Math.sqrt(1 + skew * skew);
      z = z * Math.sqrt(1 - delta * delta) + delta * Math.abs(z) - delta * Math.sqrt(2 / Math.PI);
    }
    
    z = Math.max(-8, Math.min(8, z));
    const ret = (mus[i] || 0) + z * (sigmas[i] || 0.2);
    returns[i] = Math.max(-1, Math.min(10, ret));
  }
  
  return returns;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normal CDF approximation (Abramowitz and Stegun)
 */
const normalCDF = (x) => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * y);
};

/**
 * Student-t inverse CDF using Cornish-Fisher expansion
 */
const studentTInvCDF = (p, df) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  if (df > 100) return inverseNormalCDF(p);
  
  const x = inverseNormalCDF(p);
  const x2 = x * x;
  const x3 = x2 * x;
  const x5 = x3 * x2;
  
  const g1 = (x3 + x) / 4;
  const g2 = (5*x5 + 16*x3 + 3*x) / 96;
  const g3 = (3*x5*x2 + 19*x5 + 17*x3 - 15*x) / 384;
  
  return x + g1/df + g2/(df*df) + g3/(df*df*df);
};

/**
 * Inverse Chi-Squared CDF using Wilson-Hilferty approximation
 * 
 * For X ~ χ²(df), the cube root (X/df)^(1/3) is approximately normal:
 *   (X/df)^(1/3) ≈ N(1 - 2/(9*df), 2/(9*df))
 * 
 * Inverting: X = df * (1 - 2/(9*df) + sqrt(2/(9*df)) * Φ^(-1)(u))³
 * 
 * This approximation is accurate for df ≥ 2 and avoids expensive
 * numerical root-finding or incomplete gamma functions.
 * 
 * @param {number} u - Uniform random value in (0, 1)
 * @param {number} df - Degrees of freedom
 * @returns {number} Chi-squared quantile
 */
export const inverseChiSquaredCDF = (u, df) => {
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

/**
 * Generate chi-squared using QMC-consistent inverse CDF method
 * 
 * DEPRECATED: For full QMC consistency, use inverseChiSquaredCDF directly
 * with a Sobol dimension. This function is kept for backward compatibility
 * but falls back to Box-Muller which breaks QMC low-discrepancy.
 * 
 * @param {number} df - Degrees of freedom  
 * @returns {number} Chi-squared sample
 */
const generateChiSquaredQMC = (df) => {
  // Use a random uniform and apply inverse CDF
  const u = Math.random();
  return inverseChiSquaredCDF(u, df);
};

// ============================================================================
// CONVENIENCE FACTORY FUNCTIONS
// ============================================================================

/**
 * Create a QMC generator for portfolio simulation
 * 
 * @param {number[][]} correlationMatrix - Correlation matrix
 * @param {Object} options - Options
 * @param {boolean} options.multivariateTMode - Enable extra dimension for chi-squared (for multivariate-t)
 * @returns {QMCCorrelatedNormalGenerator}
 */
export const createQMCGenerator = (correlationMatrix, options = {}) => {
  // Default: skip first 2^10 - 1 = 1023 points (per Fox 1986 recommendation)
  const defaultOptions = {
    sequence: 'sobol',
    skip: options.skip ?? 1023,
    includeChiSquaredDim: options.multivariateTMode ?? false
  };
  
  return new QMCCorrelatedNormalGenerator(correlationMatrix, { ...defaultOptions, ...options });
};

/**
 * Run a complete QMC simulation batch
 * 
 * @param {Object} params - Simulation parameters
 * @param {number[][]} params.correlationMatrix - Correlation matrix
 * @param {number[]} params.mus - Expected returns
 * @param {number[]} params.sigmas - Volatilities
 * @param {number} params.numPaths - Number of simulation paths
 * @param {number} [params.df] - Degrees of freedom for multivariate t (optional)
 * @param {number[]} [params.skews] - Skewness parameters (optional)
 * @returns {Object} Simulation results
 */
export const runQMCSimulation = (params) => {
  const { correlationMatrix, mus, sigmas, numPaths, df = null, skews = null } = params;
  
  // If using multivariate-t (df < 30), enable chi-squared dimension for full QMC consistency
  const useMultivariateT = df && df < 30;
  const qmcGen = createQMCGenerator(correlationMatrix, { multivariateTMode: useMultivariateT });
  const returns = [];
  
  for (let i = 0; i < numPaths; i++) {
    if (useMultivariateT) {
      returns.push(generateQMCMultivariateTReturns(qmcGen, mus, sigmas, df, skews));
    } else {
      returns.push(generateQMCReturns(qmcGen, mus, sigmas, skews));
    }
  }
  
  return {
    returns,
    method: 'quasi-monte-carlo',
    sequence: 'sobol',
    numPaths,
    dimensions: mus.length,
    multivariateTMode: useMultivariateT,
    df: useMultivariateT ? df : null
  };
};

// ============================================================================
// DISCREPANCY MEASUREMENT (for validation)
// ============================================================================

/**
 * Compute star discrepancy estimate for a set of points
 * (Simplified version - full computation is NP-hard)
 * 
 * @param {number[][]} points - Array of points in [0,1]^d
 * @returns {number} Estimated star discrepancy
 */
export const estimateStarDiscrepancy = (points) => {
  const n = points.length;
  const d = points[0].length;
  
  let maxDiscrep = 0;
  
  // Sample corners of the unit hypercube
  const numSamples = Math.min(1000, Math.pow(2, d));
  
  for (let sample = 0; sample < numSamples; sample++) {
    // Generate a random corner
    const corner = new Array(d);
    for (let j = 0; j < d; j++) {
      corner[j] = Math.random();
    }
    
    // Count points in [0, corner)
    let count = 0;
    for (let i = 0; i < n; i++) {
      let inside = true;
      for (let j = 0; j < d; j++) {
        if (points[i][j] >= corner[j]) {
          inside = false;
          break;
        }
      }
      if (inside) count++;
    }
    
    // Compute discrepancy for this corner
    let volume = 1;
    for (let j = 0; j < d; j++) {
      volume *= corner[j];
    }
    
    const discrep = Math.abs(count / n - volume);
    maxDiscrep = Math.max(maxDiscrep, discrep);
  }
  
  return maxDiscrep;
};

export default {
  SobolSequence,
  HaltonSequence,
  QMCCorrelatedNormalGenerator,
  inverseNormalCDF,
  inverseChiSquaredCDF,
  uniformToNormal,
  uniformsToNormals,
  generateQMCReturns,
  generateQMCMultivariateTReturns,
  createQMCGenerator,
  runQMCSimulation,
  estimateStarDiscrepancy,
  haltonValue
};
