/**
 * Mathematical utility functions for Monte Carlo simulation
 * 
 * Enhanced with:
 * - Ledoit-Wolf covariance shrinkage (2003)
 * - Multivariate Student-t distribution (preserves correlation)
 * - VaR importance sampling (Glasserman et al. 2000)
 * - Quasi-Monte Carlo integration via Sobol sequences (Joy, Boyle & Tan 1996)
 *   See ./quasiMonteCarlo.js for QMC implementation
 * 
 * COVARIANCE MATRIX WORKFLOW:
 * 1. Estimate covariance from returns using ledoitWolfShrinkage() or shrinkToConstantCorrelation()
 * 2. Extract correlation matrix
 * 3. Compute Cholesky decomposition via choleskyDecomposition()
 * 4. Generate correlated returns using either:
 *    - generateCorrelatedReturns() / generateMultivariateTReturns() for standard MC
 *    - QMCCorrelatedNormalGenerator from ./quasiMonteCarlo.js for quasi-MC
 * 
 * QMC NOTE (from Joy, Boyle & Tan 1996):
 * When using Quasi-Monte Carlo, you MUST use the inverse normal CDF (normalInvCDF)
 * to transform uniform [0,1] points to normals. DO NOT use Box-Muller as it
 * destroys the low-discrepancy structure that makes QMC effective.
 */

// ============================================================================
// BASIC STATISTICAL FUNCTIONS
// ============================================================================

/**
 * Box-Muller transform for generating standard normal random numbers
 * @returns {number} Standard normal random variable
 */
export const boxMuller = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
};

/**
 * Generate two independent standard normals (full Box-Muller)
 * @returns {number[]} Two independent standard normal random variables
 */
export const boxMullerPair = () => {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const r = Math.sqrt(-2.0 * Math.log(u));
  const theta = 2.0 * Math.PI * v;
  return [r * Math.cos(theta), r * Math.sin(theta)];
};

/**
 * Normal CDF using Abramowitz and Stegun approximation
 * @param {number} x - Input value
 * @returns {number} Cumulative probability
 */
export const normalCDF = (x) => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
};

/**
 * Normal inverse CDF (quantile function)
 * Uses Acklam's algorithm for high precision
 * @param {number} p - Probability (0 to 1)
 * @returns {number} Quantile value
 */
export const normalInvCDF = (p) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, 
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 
             3.754408661907416e+00];
  
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / 
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / 
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / 
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
};

/**
 * Student-t inverse CDF using Cornish-Fisher expansion
 * More accurate than simple normal approximation for moderate df
 * @param {number} p - Probability (0 to 1)
 * @param {number} df - Degrees of freedom
 * @returns {number} Quantile value
 */
export const studentTInvCDF = (p, df) => {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  if (df > 100) return normalInvCDF(p);
  
  const x = normalInvCDF(p);
  const x2 = x * x;
  const x3 = x2 * x;
  const x5 = x3 * x2;
  
  // Cornish-Fisher expansion terms
  const g1 = (x3 + x) / 4;
  const g2 = (5*x5 + 16*x3 + 3*x) / 96;
  const g3 = (3*x5*x2 + 19*x5 + 17*x3 - 15*x) / 384;
  
  return x + g1/df + g2/(df*df) + g3/(df*df*df);
};

// ============================================================================
// CHOLESKY DECOMPOSITION
// ============================================================================

/**
 * Cholesky decomposition of a positive definite matrix
 * Used to generate correlated random variables
 * @param {number[][]} matrix - Correlation/covariance matrix (must be positive definite)
 * @returns {number[][]} Lower triangular Cholesky factor L where matrix = L * L'
 */
export const choleskyDecomposition = (matrix) => {
  const n = matrix.length;
  const L = Array(n).fill(0).map(() => Array(n).fill(0));
  
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
};

// ============================================================================
// LEDOIT-WOLF SHRINKAGE ESTIMATOR
// Based on "Honey, I Shrunk the Sample Covariance Matrix" (2003)
// ============================================================================

/**
 * Compute Ledoit-Wolf shrinkage estimator for covariance matrix
 * Shrinks toward constant correlation model (not identity!)
 * 
 * @param {number[][]} returns - T x N matrix of returns (T observations, N assets)
 * @returns {Object} { covariance, correlation, shrinkageIntensity, averageCorrelation }
 */
export const ledoitWolfShrinkage = (returns) => {
  const T = returns.length;
  const N = returns[0]?.length || 0;
  
  if (T < 2 || N < 2) {
    console.warn('Ledoit-Wolf: insufficient data, returning identity');
    return {
      covariance: Array(N).fill(null).map((_, i) => 
        Array(N).fill(0).map((_, j) => i === j ? 0.04 : 0)
      ),
      correlation: Array(N).fill(null).map((_, i) => 
        Array(N).fill(0).map((_, j) => i === j ? 1 : 0)
      ),
      shrinkageIntensity: 1.0,
      averageCorrelation: 0
    };
  }
  
  // Calculate sample means
  const means = new Array(N).fill(0);
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) {
      means[i] += returns[t][i] / T;
    }
  }
  
  // Calculate sample covariance matrix S (with Bessel correction)
  const S = Array(N).fill(null).map(() => Array(N).fill(0));
  for (let t = 0; t < T; t++) {
    for (let i = 0; i < N; i++) {
      for (let j = i; j < N; j++) {
        const prod = (returns[t][i] - means[i]) * (returns[t][j] - means[j]);
        S[i][j] += prod;
        if (i !== j) S[j][i] += prod;
      }
    }
  }
  // Apply Bessel correction
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      S[i][j] /= (T - 1);
    }
  }
  
  // Calculate sample standard deviations and correlations
  const stds = S.map((row, i) => Math.sqrt(Math.max(0, S[i][i])));
  const sampleCorr = Array(N).fill(null).map(() => Array(N).fill(0));
  
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (stds[i] > 0 && stds[j] > 0) {
        sampleCorr[i][j] = S[i][j] / (stds[i] * stds[j]);
      } else {
        sampleCorr[i][j] = i === j ? 1 : 0;
      }
    }
  }
  
  // Calculate average off-diagonal correlation (r-bar)
  let sumCorr = 0;
  let countCorr = 0;
  for (let i = 0; i < N - 1; i++) {
    for (let j = i + 1; j < N; j++) {
      sumCorr += sampleCorr[i][j];
      countCorr++;
    }
  }
  const rBar = countCorr > 0 ? sumCorr / countCorr : 0;
  
  // Construct shrinkage target F (constant correlation model)
  // f_ii = s_ii (preserve variances)
  // f_ij = r_bar * sqrt(s_ii * s_jj) (constant correlation)
  const F = Array(N).fill(null).map(() => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        F[i][j] = S[i][i];  // Preserve variances exactly
      } else {
        F[i][j] = rBar * stds[i] * stds[j];  // Constant correlation
      }
    }
  }
  
  // ========== Calculate optimal shrinkage intensity ==========
  // Based on Ledoit & Wolf (2003) Appendix B
  
  // π̂ = sum of asymptotic variances of sample covariance entries
  let piHat = 0;
  const piMatrix = Array(N).fill(null).map(() => Array(N).fill(0));
  
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      let piIJ = 0;
      for (let t = 0; t < T; t++) {
        const term = (returns[t][i] - means[i]) * (returns[t][j] - means[j]) - S[i][j] * (T-1)/T;
        piIJ += term * term;
      }
      piMatrix[i][j] = piIJ / T;
      piHat += piMatrix[i][j];
    }
  }
  
  // γ̂ = misspecification (squared Frobenius norm of F - S)
  let gammaHat = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      gammaHat += (F[i][j] - S[i][j]) ** 2;
    }
  }
  
  // ρ̂ = sum of asymptotic covariances between F and S entries
  // This is the complex part - simplified version focusing on diagonal terms
  let rhoHat = 0;
  
  // Diagonal terms: AsyVar(sqrt(T) * s_ii)
  for (let i = 0; i < N; i++) {
    rhoHat += piMatrix[i][i];
  }
  
  // Off-diagonal terms (simplified estimation)
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i !== j) {
        // Estimate contribution from off-diagonal covariance with target
        let thetaIIij = 0;
        let thetaJJij = 0;
        
        for (let t = 0; t < T; t++) {
          const yi = returns[t][i] - means[i];
          const yj = returns[t][j] - means[j];
          
          thetaIIij += (yi * yi - S[i][i] * (T-1)/T) * (yi * yj - S[i][j] * (T-1)/T);
          thetaJJij += (yj * yj - S[j][j] * (T-1)/T) * (yi * yj - S[i][j] * (T-1)/T);
        }
        thetaIIij /= T;
        thetaJJij /= T;
        
        // Contribution to rho from f_ij = rBar * sqrt(s_ii * s_jj)
        if (stds[i] > 0 && stds[j] > 0) {
          rhoHat += rBar / 2 * (
            Math.sqrt(S[j][j] / S[i][i]) * thetaIIij +
            Math.sqrt(S[i][i] / S[j][j]) * thetaJJij
          );
        }
      }
    }
  }
  
  // κ̂ = (π̂ - ρ̂) / γ̂
  const kappaHat = gammaHat > 0 ? (piHat - rhoHat) / gammaHat : 0;
  
  // Optimal shrinkage intensity (clipped to [0, 1])
  const deltaStar = Math.max(0, Math.min(kappaHat / T, 1));
  
  // Construct shrunk covariance matrix
  const shrunkCov = Array(N).fill(null).map(() => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      shrunkCov[i][j] = deltaStar * F[i][j] + (1 - deltaStar) * S[i][j];
    }
  }
  
  // Convert to correlation matrix
  const shrunkStds = shrunkCov.map((row, i) => Math.sqrt(Math.max(0, shrunkCov[i][i])));
  const shrunkCorr = Array(N).fill(null).map(() => Array(N).fill(0));
  
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (shrunkStds[i] > 0 && shrunkStds[j] > 0) {
        shrunkCorr[i][j] = shrunkCov[i][j] / (shrunkStds[i] * shrunkStds[j]);
        // Ensure valid correlation bounds
        shrunkCorr[i][j] = Math.max(-1, Math.min(1, shrunkCorr[i][j]));
      } else {
        shrunkCorr[i][j] = i === j ? 1 : 0;
      }
    }
  }
  
  console.log(`Ledoit-Wolf shrinkage: δ* = ${(deltaStar * 100).toFixed(1)}%, r̄ = ${rBar.toFixed(3)}`);
  
  return {
    covariance: shrunkCov,
    correlation: shrunkCorr,
    shrinkageIntensity: deltaStar,
    averageCorrelation: rBar
  };
};

/**
 * Simple shrinkage toward constant correlation (for use without return history)
 * Uses the average correlation from the sample correlation matrix
 * 
 * @param {number[][]} sampleCorr - Sample correlation matrix
 * @param {number} intensity - Shrinkage intensity (0 to 1), or null for auto
 * @returns {Object} { correlation, shrinkageIntensity, averageCorrelation }
 */
export const shrinkToConstantCorrelation = (sampleCorr, intensity = null) => {
  const N = sampleCorr.length;
  
  // Calculate average off-diagonal correlation
  let sumCorr = 0;
  let countCorr = 0;
  for (let i = 0; i < N - 1; i++) {
    for (let j = i + 1; j < N; j++) {
      sumCorr += sampleCorr[i][j];
      countCorr++;
    }
  }
  const rBar = countCorr > 0 ? sumCorr / countCorr : 0;
  
  // If intensity not specified, use rule-of-thumb based on matrix size
  // More shrinkage for larger matrices (more estimation error)
  const autoIntensity = Math.min(0.5, 0.1 + N / 100);
  const delta = intensity !== null ? intensity : autoIntensity;
  
  // Construct shrunk correlation matrix
  const shrunkCorr = Array(N).fill(null).map(() => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        shrunkCorr[i][j] = 1;
      } else {
        // Shrink toward constant correlation rBar
        shrunkCorr[i][j] = (1 - delta) * sampleCorr[i][j] + delta * rBar;
        shrunkCorr[i][j] = Math.max(-0.99, Math.min(0.99, shrunkCorr[i][j]));
      }
    }
  }
  
  return {
    correlation: shrunkCorr,
    shrinkageIntensity: delta,
    averageCorrelation: rBar
  };
};

// ============================================================================
// MULTIVARIATE STUDENT-T DISTRIBUTION
// Preserves correlation structure exactly while producing fat tails
// ============================================================================

/**
 * Generate chi-squared random variable using sum of squared normals
 * @param {number} df - Degrees of freedom
 * @returns {number} Chi-squared random variable
 */
export const generateChiSquared = (df) => {
  // Use sum of df squared standard normals
  // For efficiency, use gamma distribution approximation for large df
  if (df > 100) {
    // Normal approximation for large df
    const z = boxMuller();
    return Math.max(0.01, df + Math.sqrt(2 * df) * z);
  }
  
  let sum = 0;
  const fullPairs = Math.floor(df / 2);
  
  // Generate pairs of normals efficiently
  for (let i = 0; i < fullPairs; i++) {
    const [z1, z2] = boxMullerPair();
    sum += z1 * z1 + z2 * z2;
  }
  
  // Handle odd df
  if (df % 2 === 1) {
    const z = boxMuller();
    sum += z * z;
  }
  
  return Math.max(0.01, sum); // Prevent division by zero
};

/**
 * Generate multivariate Student-t distributed returns
 * 
 * This is the CORRECT approach for fat-tailed returns with exact correlation preservation.
 * Unlike Gaussian copula, this generates a TRUE multivariate t-distribution.
 * 
 * Key insight: All assets share the SAME chi-squared scaling factor,
 * which preserves the correlation structure while fattening all tails together.
 * This also creates "crisis correlation" behavior where correlations
 * effectively increase during tail events.
 * 
 * @param {number[][]} choleskyL - Cholesky factor of correlation matrix
 * @param {number[]} mus - Array of expected returns
 * @param {number[]} sigmas - Array of volatilities
 * @param {number} df - Degrees of freedom (shared across all assets)
 * @param {number[]} skews - Optional array of skewness parameters
 * @returns {number[]} Array of correlated fat-tailed returns
 */
export const generateMultivariateTReturns = (choleskyL, mus, sigmas, df, skews = null) => {
  const n = choleskyL.length;
  
  // Step 1: Generate independent standard normals
  const z = Array(n).fill(0).map(() => boxMuller());
  
  // Step 2: Apply Cholesky to create correlated normals
  const correlatedZ = choleskyL.map((row, i) => {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += row[j] * z[j];
    }
    return sum;
  });
  
  // Step 3: Generate SINGLE chi-squared for ALL assets (key difference from Gaussian copula!)
  const chiSquared = generateChiSquared(df);
  
  // Step 4: Scale ALL correlated normals by the SAME factor
  // This is what makes it a TRUE multivariate t-distribution
  // The variance of a t-distribution is df/(df-2), so we scale to get unit variance
  const scaleFactor = Math.sqrt(df / chiSquared);
  const varianceCorrection = df > 2 ? Math.sqrt((df - 2) / df) : 1;
  
  // Step 5: Transform to returns
  return correlatedZ.map((c, i) => {
    let transformed = c * scaleFactor * varianceCorrection;
    
    // Optional: Apply skewness (after t-transformation)
    if (skews && Math.abs(skews[i] || 0) > 0.01) {
      const skew = skews[i];
      const delta = skew / Math.sqrt(1 + skew * skew);
      transformed = transformed * Math.sqrt(1 - delta * delta) + 
                   delta * Math.abs(transformed) - 
                   delta * Math.sqrt(2 / Math.PI);
    }
    
    // Bound the transformed value
    transformed = Math.max(-8, Math.min(8, transformed));
    
    // Convert to return
    const ret = (mus[i] || 0) + transformed * (sigmas[i] || 0.2);
    return Math.max(-1, Math.min(10, ret)); // Floor at -100%, cap at 1000%
  });
};

/**
 * Generate Gaussian copula returns (current method - for comparison)
 * 
 * This applies fat tails INDEPENDENTLY to each marginal after correlation.
 * Result: Pearson correlation is attenuated by ~15% at df=5.
 * 
 * @param {number[][]} choleskyL - Cholesky factor of correlation matrix
 * @param {number[]} mus - Array of expected returns
 * @param {number[]} sigmas - Array of volatilities  
 * @param {number[]} dfs - Array of degrees of freedom (per-asset)
 * @param {number[]} skews - Array of skewness parameters
 * @returns {number[]} Array of correlated returns
 */
export const generateGaussianCopulaReturns = (choleskyL, mus, sigmas, dfs, skews) => {
  const n = choleskyL.length;
  
  // Generate independent standard normals
  const z = Array(n).fill(0).map(() => boxMuller());
  
  // Apply Cholesky to correlate
  const correlatedZ = choleskyL.map((row, i) => {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += row[j] * z[j];
    }
    return Math.max(-6, Math.min(6, sum));
  });
  
  // Transform each marginal INDEPENDENTLY (this is what causes correlation attenuation)
  return correlatedZ.map((c, i) => {
    let transformed = c;
    const df = dfs[i] || 30;
    
    // Apply Student-t transformation via probability integral transform
    if (df < 30) {
      const u = normalCDF(c);
      transformed = studentTInvCDF(u, df);
      // Variance correction
      if (df > 2) transformed *= Math.sqrt((df - 2) / df);
    }
    
    if (!isFinite(transformed)) transformed = c;
    transformed = Math.max(-6, Math.min(6, transformed));
    
    // Apply skewness
    const skew = skews[i] || 0;
    if (Math.abs(skew) > 0.01) {
      const delta = skew / Math.sqrt(1 + skew * skew);
      transformed = transformed * Math.sqrt(1 - delta * delta) + 
                   delta * Math.abs(transformed) - 
                   delta * Math.sqrt(2 / Math.PI);
    }
    
    if (!isFinite(transformed)) transformed = 0;
    transformed = Math.max(-6, Math.min(6, transformed));
    
    const ret = (mus[i] || 0) + transformed * (sigmas[i] || 0.2);
    return Math.max(-1, Math.min(10, ret));
  });
};

// ============================================================================
// VAR IMPORTANCE SAMPLING
// Based on Glasserman, Heidelberger & Shahabuddin (2000)
// ============================================================================

/**
 * Compute optimal importance sampling parameters for VaR estimation
 * 
 * The key insight is to shift the mean of the sampling distribution
 * toward the loss threshold to make tail events more likely.
 * 
 * @param {number[]} weights - Portfolio weights
 * @param {number[]} sigmas - Asset volatilities
 * @param {number[][]} choleskyL - Cholesky factor of correlation matrix
 * @param {number} lossThreshold - VaR threshold (as a positive loss)
 * @returns {Object} { meanShift, likelihoodRatioFn }
 */
export const computeImportanceSamplingParams = (weights, sigmas, choleskyL, lossThreshold) => {
  const n = weights.length;
  
  // Compute portfolio volatility for the shift direction
  // The optimal shift is in the direction of the portfolio loss gradient
  let portfolioVar = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let covIJ = 0;
      for (let k = 0; k < n; k++) {
        covIJ += choleskyL[i][k] * choleskyL[j][k];
      }
      portfolioVar += weights[i] * weights[j] * sigmas[i] * sigmas[j] * covIJ;
    }
  }
  const portfolioSigma = Math.sqrt(Math.max(0.0001, portfolioVar));
  
  // Optimal mean shift: move sampling distribution toward loss threshold
  // theta* = x / sigma^2 where x is the target loss level
  const theta = lossThreshold / (portfolioSigma * portfolioSigma);
  
  // Mean shift vector in original space
  // Shift each asset's normal by theta * w_i * sigma_i * rho_contribution
  const meanShift = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    // Compute correlation contribution
    let corrContrib = 0;
    for (let j = 0; j < n; j++) {
      let rhoIJ = 0;
      for (let k = 0; k <= Math.min(i, j); k++) {
        rhoIJ += choleskyL[i][k] * choleskyL[j][k];
      }
      corrContrib += weights[j] * sigmas[j] * rhoIJ;
    }
    meanShift[i] = theta * corrContrib;
  }
  
  // Likelihood ratio function for importance sampling correction
  // L(Z) = exp(-theta * S + theta^2 * sigma^2 / 2)
  // where S is the portfolio loss
  const likelihoodRatio = (portfolioLoss) => {
    const exponent = -theta * portfolioLoss + 0.5 * theta * theta * portfolioVar;
    return Math.exp(Math.max(-50, Math.min(50, exponent))); // Prevent overflow
  };
  
  return {
    meanShift,
    likelihoodRatio,
    optimalTheta: theta,
    portfolioSigma
  };
};

/**
 * Generate importance-sampled returns for efficient VaR estimation
 * 
 * @param {number[][]} choleskyL - Cholesky factor of correlation matrix
 * @param {number[]} mus - Expected returns
 * @param {number[]} sigmas - Volatilities
 * @param {number[]} meanShift - IS mean shift vector
 * @returns {Object} { returns, likelihoodWeight }
 */
export const generateImportanceSampledReturns = (choleskyL, mus, sigmas, meanShift) => {
  const n = choleskyL.length;
  
  // Generate shifted normals
  const z = Array(n).fill(0).map((_, i) => boxMuller() + (meanShift[i] || 0));
  
  // Apply Cholesky
  const correlatedZ = choleskyL.map((row, i) => {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += row[j] * z[j];
    }
    return Math.max(-8, Math.min(8, sum));
  });
  
  // Compute likelihood weight (for IS correction)
  let logWeight = 0;
  for (let i = 0; i < n; i++) {
    logWeight -= meanShift[i] * z[i] - 0.5 * meanShift[i] * meanShift[i];
  }
  const likelihoodWeight = Math.exp(Math.max(-50, Math.min(50, logWeight)));
  
  // Convert to returns
  const returns = correlatedZ.map((c, i) => {
    const ret = (mus[i] || 0) + c * (sigmas[i] || 0.2);
    return Math.max(-1, Math.min(10, ret));
  });
  
  return { returns, likelihoodWeight };
};

// ============================================================================
// PERCENTILE AND DISTRIBUTION UTILITIES
// ============================================================================

/**
 * Calculate percentile from sorted array
 * @param {number[]} sortedArr - Sorted array of values
 * @param {number} p - Percentile (0 to 1)
 * @returns {number} Value at percentile
 */
export const percentile = (sortedArr, p) => {
  if (!sortedArr || sortedArr.length === 0) return 0;
  const idx = Math.floor(sortedArr.length * p);
  return sortedArr[Math.min(idx, sortedArr.length - 1)];
};

/**
 * Calculate index for percentile in sorted array
 * @param {number[]} sortedArr - Sorted array of values
 * @param {number} p - Percentile (0 to 1)
 * @returns {number} Index at percentile
 */
export const percentileIdx = (sortedArr, p) => {
  return Math.min(Math.floor(sortedArr.length * p), sortedArr.length - 1);
};

/**
 * Estimate tail degrees of freedom from percentiles
 * Lower df = fatter tails
 * @param {number} p5 - 5th percentile return
 * @param {number} p95 - 95th percentile return
 * @param {number} mu - Mean return
 * @param {number} sigma - Standard deviation
 * @returns {number} Degrees of freedom (3-30)
 */
export const estimateTailDf = (p5, p95, mu, sigma) => {
  if (sigma <= 0) return 30;
  
  // Normal distribution: P5 ≈ μ - 1.645σ, P95 ≈ μ + 1.645σ
  // Range = P95 - P5 ≈ 3.29σ for normal
  // Fat tails have wider range
  const range = p95 - p5;
  const normalRange = 3.29 * sigma;
  
  if (range <= normalRange * 1.1) return 30; // Nearly normal
  
  // Map excess range to df (lower df = fatter tails)
  const excessRatio = range / normalRange;
  // excessRatio of 1.5 → df ≈ 5, excessRatio of 2.0 → df ≈ 3
  const df = Math.max(3, Math.min(30, 30 / excessRatio));
  
  return Math.round(df);
};

/**
 * Derive distribution parameters from percentile inputs
 * @param {Object} position - Position with p5, p25, p50, p75, p95
 * @returns {Object} { mu, sigma, skew, tailDf }
 */
export const deriveDistributionParams = (position) => {
  const { p5 = -0.25, p25 = -0.02, p50 = 0.08, p75 = 0.18, p95 = 0.40 } = position;
  
  // Estimate mean from median with skew adjustment
  const skewAdjustment = (p95 + p5 - 2 * p50);
  const mu = p50 + 0.1 * skewAdjustment;
  
  // Estimate sigma from interquartile range
  // For normal: IQR ≈ 1.35σ
  const iqr = p75 - p25;
  const sigma = Math.max(0.01, iqr / 1.35);
  
  // Estimate skewness from asymmetry
  const totalRange = p95 - p5;
  const skew = totalRange > 0 ? skewAdjustment / totalRange : 0;
  
  // Estimate tail heaviness
  const tailDf = estimateTailDf(p5, p95, mu, sigma);
  
  return {
    mu: isFinite(mu) ? mu : 0.08,
    sigma: isFinite(sigma) ? sigma : 0.20,
    skew: isFinite(skew) ? Math.max(-2, Math.min(2, skew)) : 0,
    tailDf: isFinite(tailDf) ? tailDf : 10,
    p5, p25, p50, p75, p95
  };
};

/**
 * Transform standard normal to skewed t-distribution
 * @param {number} z - Standard normal random variable
 * @param {number} skew - Skewness parameter (-2 to 2)
 * @param {number} df - Degrees of freedom (3-30)
 * @returns {number} Transformed random variable
 */
export const skewedTTransform = (z, skew, df) => {
  // Apply skew via sinh-arcsinh transform (approximation)
  const skewed = z + skew * (z * z - 1) / 3;
  
  // Apply fat tails via t-distribution scaling
  if (df < 30 && Math.abs(skewed) > 1.5) {
    const tailMultiplier = 1 + (30 - df) / 30 * 0.5;
    return skewed * tailMultiplier;
  }
  
  return skewed;
};

/**
 * Generate correlated random returns for multiple assets
 * @param {number[][]} choleskyL - Cholesky factor of correlation matrix
 * @param {number[]} mus - Array of expected returns
 * @param {number[]} sigmas - Array of volatilities
 * @param {number[]} skews - Array of skewness parameters
 * @param {number[]} dfs - Array of degrees of freedom
 * @returns {number[]} Array of correlated returns
 */
export const generateCorrelatedReturns = (choleskyL, mus, sigmas, skews, dfs) => {
  const n = choleskyL.length;
  
  // Generate independent standard normals
  const z = Array(n).fill(0).map(() => boxMuller());
  
  // Apply Cholesky to correlate
  const correlated = choleskyL.map((row, i) => {
    let sum = 0;
    for (let j = 0; j <= i; j++) {
      sum += row[j] * z[j];
    }
    return sum;
  });
  
  // Transform to skewed t and scale
  return correlated.map((c, i) => {
    const transformed = skewedTTransform(c, skews[i] || 0, dfs[i] || 10);
    const bounded = Math.max(-6, Math.min(6, transformed));
    const ret = (mus[i] || 0) + bounded * (sigmas[i] || 0.2);
    return Math.max(-1, Math.min(10, ret)); // Floor at -100%, cap at 1000%
  });
};

// ============================================================================
// CORRELATION ATTENUATION UTILITIES
// ============================================================================

/**
 * Approximate gamma function for positive arguments
 * Uses Stirling's approximation for large values, Lanczos for small
 */
function gammaFn(z) {
  if (z < 0.5) {
    return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
  }
  z -= 1;
  const g = 7;
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
             771.32342877765313, -176.61502916214059, 12.507343278686905,
             -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/**
 * Calculate theoretical correlation attenuation factor for Gaussian copula with t-marginals
 * 
 * When using Gaussian copula with Student-t marginals, the Pearson correlation
 * is attenuated by approximately this factor.
 * 
 * @param {number} df - Degrees of freedom
 * @returns {number} Attenuation factor (multiply specified correlation by this)
 */
export const gaussianCopulaCorrelationAttenuation = (df) => {
  if (df >= 30) return 1.0;
  if (df <= 2) return 0.5; // Approximate lower bound
  
  // Approximate formula based on copula theory
  // For t_df marginals with Gaussian copula:
  // rho_observed ≈ rho_specified * 6/π * arcsin(rho_specified/2) * correction(df)
  // Simplified approximation:
  const correction = (df - 2) / df * Math.pow(gammaFn((df - 1) / 2) / gammaFn(df / 2), 2) * Math.sqrt(Math.PI);
  return Math.min(1.0, Math.max(0.5, correction));
};

/**
 * Calculate inflation factor to compensate for Gaussian copula attenuation
 * Use this to pre-inflate correlations so that realized correlations match targets
 * 
 * @param {number} df - Degrees of freedom
 * @returns {number} Inflation factor (multiply input correlations by this before Cholesky)
 */
export const correlationInflationFactor = (df) => {
  const attenuation = gaussianCopulaCorrelationAttenuation(df);
  return 1.0 / attenuation;
};

// ============================================================================
// INVERSE CHI-SQUARED CDF
// ============================================================================

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
 * Used for QMC-consistent multivariate-t simulation where the chi-squared
 * scaling factor must come from the low-discrepancy sequence.
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
  const z = normalInvCDF(u);
  
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
