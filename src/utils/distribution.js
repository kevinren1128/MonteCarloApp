/**
 * Distribution Utilities
 * 
 * @module utils/distribution
 * @description Statistical distribution functions for Monte Carlo simulation.
 * Includes normal, Student-t, and skewed distributions.
 */

/**
 * Normal CDF (cumulative distribution function)
 * Uses Abramowitz and Stegun approximation
 * @param {number} x - Value to evaluate
 * @returns {number} Probability P(X <= x) for standard normal
 */
export const normalCDF = (x) => {
  // Clamp extreme values to avoid numerical issues
  if (x < -8) return 0.00001;
  if (x > 8) return 0.99999;
  
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  const result = 0.5 * (1.0 + sign * y);
  
  return Math.max(0.00001, Math.min(0.99999, result));
};

/**
 * Normal inverse CDF (quantile function)
 * Uses rational approximation
 * @param {number} p - Probability (0 to 1)
 * @returns {number} x such that P(X <= x) = p for standard normal
 */
export const normalInvCDF = (p) => {
  // Clamp to avoid infinity
  p = Math.max(0.00001, Math.min(0.99999, p));
  
  const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 
             1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 
             6.680131188771972e+01, -1.328068155288572e+01];
  const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, 
             -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 
             2.445134137142996e+00, 3.754408661907416e+00];
  
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r, result;
  
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    result = (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / 
             ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    result = (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q / 
             (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    result = -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / 
              ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
  }
  
  return Math.max(-6, Math.min(6, result));
};

/**
 * Student-t inverse CDF approximation
 * Uses Cornish-Fisher expansion
 * @param {number} p - Probability (0 to 1)
 * @param {number} df - Degrees of freedom
 * @returns {number} t-value such that P(T <= t) = p
 */
export const studentTInvCDF = (p, df) => {
  p = Math.max(0.00001, Math.min(0.99999, p));
  df = Math.max(3, df);
  
  // For high df, use normal approximation
  if (df >= 30) return normalInvCDF(p);
  
  const x = normalInvCDF(p);
  const g1 = (x * x * x + x) / 4;
  const g2 = (5 * x * x * x * x * x + 16 * x * x * x + 3 * x) / 96;
  const result = x + g1 / df + g2 / (df * df);
  
  return Math.max(-8, Math.min(8, result));
};

/**
 * Box-Muller transform for generating standard normal random variables
 * @returns {number} Standard normal random variable
 */
export const boxMuller = () => {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

/**
 * Box-Muller pair for chi-squared generation
 * @returns {[number, number]} Two independent standard normal random variables
 */
export const boxMullerPair = () => {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  const r = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
};

/**
 * Generate chi-squared random variable
 * Used for multivariate Student-t sampling
 * @param {number} df - Degrees of freedom
 * @returns {number} Chi-squared random variable
 */
export const generateChiSquared = (df) => {
  // For large df, use normal approximation
  if (df > 100) {
    const z = boxMuller();
    return Math.max(0.01, df + Math.sqrt(2 * df) * z);
  }
  
  // Sum of squared normals
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

/**
 * Generate Student-t random variable
 * @param {number} df - Degrees of freedom
 * @returns {number} Student-t random variable
 */
export const generateStudentT = (df) => {
  if (df >= 30) return boxMuller();
  const z = boxMuller();
  const chi2 = generateChiSquared(df);
  return z / Math.sqrt(chi2 / df);
};

/**
 * Generate skewed Student-t random variable
 * Uses Azzalini's skewed-t distribution
 * @param {number} mu - Location (mean-like)
 * @param {number} sigma - Scale (std-like)
 * @param {number} skew - Skewness parameter
 * @param {number} df - Degrees of freedom
 * @returns {number} Skewed Student-t random variable
 */
export const generateSkewedT = (mu, sigma, skew, df) => {
  const t = generateStudentT(df);
  
  // Apply skewness transformation
  if (Math.abs(skew) > 0.01) {
    const delta = skew / Math.sqrt(1 + skew * skew);
    const u = boxMuller();
    const skewedT = delta * Math.abs(u) + Math.sqrt(1 - delta * delta) * t;
    return mu + sigma * skewedT;
  }
  
  return mu + sigma * t;
};

/**
 * Calculate percentiles from distribution parameters
 * @param {number} mu - Expected return
 * @param {number} sigma - Volatility
 * @param {number} skew - Skewness
 * @param {number} tailDf - Degrees of freedom for fat tails
 * @returns {{p5: number, p25: number, p50: number, p75: number, p95: number}}
 */
export const getPercentilesFromParams = (mu, sigma, skew, tailDf) => {
  // Z-scores for each percentile
  const zScores = {
    p5: studentTInvCDF(0.05, tailDf),
    p25: studentTInvCDF(0.25, tailDf),
    p50: studentTInvCDF(0.50, tailDf),
    p75: studentTInvCDF(0.75, tailDf),
    p95: studentTInvCDF(0.95, tailDf),
  };
  
  // Adjust for skew (approximate)
  const skewAdj = skew * sigma * 0.2;
  
  return {
    p5: mu + sigma * zScores.p5 - skewAdj,
    p25: mu + sigma * zScores.p25 - skewAdj * 0.5,
    p50: mu + skewAdj * 0.3,
    p75: mu + sigma * zScores.p75 + skewAdj * 0.5,
    p95: mu + sigma * zScores.p95 + skewAdj,
  };
};

/**
 * Back-calculate distribution parameters from percentiles
 * @param {number} p5 - 5th percentile
 * @param {number} p25 - 25th percentile
 * @param {number} p50 - 50th percentile (median)
 * @param {number} p75 - 75th percentile
 * @param {number} p95 - 95th percentile
 * @returns {{mu: number, sigma: number, skew: number, tailDf: number}}
 */
export const getParamsFromPercentiles = (p5, p25, p50, p75, p95) => {
  // Estimate mu from median
  const mu = p50;
  
  // Estimate sigma from IQR
  const iqr = p75 - p25;
  const sigma = Math.max(0.01, iqr / 1.35); // 1.35 is normal IQR / sigma
  
  // Estimate skew from asymmetry
  const upperTail = p95 - p50;
  const lowerTail = p50 - p5;
  const skew = (lowerTail + upperTail) > 0 
    ? (upperTail - lowerTail) / (lowerTail + upperTail) * 2 
    : 0;
  
  // Estimate tail heaviness
  const normalP95 = 1.645 * sigma;
  const tailRatio = upperTail / Math.max(normalP95, 0.01);
  const tailDf = tailRatio > 1.5 ? 5 : tailRatio > 1.2 ? 10 : 30;
  
  return { mu, sigma, skew: Math.max(-2, Math.min(2, skew)), tailDf };
};

/**
 * Bootstrap annual returns from daily returns
 * @param {number[]} dailyReturns - Array of daily returns
 * @param {number} numSamples - Number of annual samples to generate
 * @returns {number[]} Array of simulated annual returns
 */
export const bootstrapAnnualReturns = (dailyReturns, numSamples = 1000) => {
  if (!dailyReturns || dailyReturns.length < 20) return null;
  
  const annualReturns = [];
  const tradingDays = 252;
  
  for (let i = 0; i < numSamples; i++) {
    let cumulativeReturn = 1;
    for (let d = 0; d < tradingDays; d++) {
      const idx = Math.floor(Math.random() * dailyReturns.length);
      cumulativeReturn *= (1 + dailyReturns[idx]);
    }
    annualReturns.push(cumulativeReturn - 1);
  }
  
  return annualReturns.sort((a, b) => a - b);
};

/**
 * Calculate percentiles from a sorted array of values
 * @param {number[]} sortedValues - Sorted array of values
 * @param {number} percentile - Percentile (0-100)
 * @returns {number} Value at the given percentile
 */
export const getPercentile = (sortedValues, percentile) => {
  if (!sortedValues || sortedValues.length === 0) return 0;
  const idx = Math.floor((percentile / 100) * (sortedValues.length - 1));
  return sortedValues[Math.max(0, Math.min(idx, sortedValues.length - 1))];
};

export default {
  normalCDF,
  normalInvCDF,
  studentTInvCDF,
  boxMuller,
  boxMullerPair,
  generateChiSquared,
  generateStudentT,
  generateSkewedT,
  getPercentilesFromParams,
  getParamsFromPercentiles,
  bootstrapAnnualReturns,
  getPercentile,
};
