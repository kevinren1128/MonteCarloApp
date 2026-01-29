/**
 * Distribution Parameter Utilities
 * Functions for converting between distribution parameters and percentiles
 */

/**
 * Calculate percentiles from distribution parameters (mu, sigma, skew, tailDf)
 * Converts parametric distribution to key percentile values
 * 
 * @param {number} mu - Mean/expected return
 * @param {number} sigma - Standard deviation/volatility
 * @param {number} skew - Skewness parameter (-1 to 1)
 * @param {number} tailDf - Degrees of freedom for t-distribution (lower = fatter tails)
 * @returns {{p5: number, p25: number, p50: number, p75: number, p95: number}} Percentile values
 */
export const getPercentilesFromParams = (mu, sigma, skew, tailDf) => {
  // Approximate percentile z-scores (adjusted for skew)
  const z5 = -1.645;
  const z25 = -0.675;
  const z50 = 0;
  const z75 = 0.675;
  const z95 = 1.645;
  
  // Adjust for skew (approximate)
  const skewAdj = skew * 0.3;
  
  // Adjust for fat tails (Student-t has wider tails)
  const tailAdj = tailDf < 30 ? 1 + (30 - tailDf) / 50 : 1;
  
  return {
    p5: mu + sigma * (z5 * tailAdj + skewAdj * z5),
    p25: mu + sigma * (z25 + skewAdj * z25 * 0.5),
    p50: mu + sigma * skewAdj * 0.2, // Median shifts with skew
    p75: mu + sigma * (z75 + skewAdj * z75 * 0.5),
    p95: mu + sigma * (z95 * tailAdj + skewAdj * z95),
  };
};

/**
 * Back-calculate distribution parameters from percentiles
 * Estimates parametric distribution from observed percentile values
 * 
 * @param {number} p5 - 5th percentile
 * @param {number} p25 - 25th percentile
 * @param {number} p50 - 50th percentile (median)
 * @param {number} p75 - 75th percentile
 * @param {number} p95 - 95th percentile
 * @returns {{mu: number, sigma: number, skew: number, tailDf: number}} Distribution parameters
 */
export const getParamsFromPercentiles = (p5, p25, p50, p75, p95) => {
  // Estimate mu from median
  const mu = p50;
  
  // Estimate sigma from IQR (interquartile range)
  const iqr = p75 - p25;
  const sigma = Math.max(0.01, iqr / 1.35); // 1.35 is normal IQR/sigma ratio
  
  // Estimate skew from asymmetry
  // Positive skew = right tail longer = (p95-p50) > (p50-p5)
  const rightTail = p95 - p50;
  const leftTail = p50 - p5;
  const skewRaw = (rightTail - leftTail) / (rightTail + leftTail + 0.001);
  const skew = Math.max(-1, Math.min(1, skewRaw * 2));
  
  // Estimate tail heaviness from how extreme the tails are
  const expectedP5Normal = mu - 1.645 * sigma;
  const expectedP95Normal = mu + 1.645 * sigma;
  const tailSpread = ((p95 - p5) / (expectedP95Normal - expectedP5Normal + 0.001));
  const tailDf = Math.max(3, Math.min(30, Math.round(30 / Math.max(1, tailSpread))));
  
  return { mu, sigma, skew, tailDf };
};
