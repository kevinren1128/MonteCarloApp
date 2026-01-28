/**
 * Correlation Utilities
 * 
 * @module utils/correlation
 * @description Functions for computing and manipulating correlation matrices.
 * Includes sample correlation, EWMA, and Ledoit-Wolf shrinkage.
 */

import { identityMatrix, shrinkMatrix, makeValidCorrelation } from './matrix';

/**
 * Compute mean of an array
 * @param {number[]} arr - Array of numbers
 * @returns {number} Mean value
 */
export const computeMean = (arr) => {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, x) => sum + x, 0) / arr.length;
};

/**
 * Compute standard deviation
 * @param {number[]} arr - Array of numbers
 * @param {number} [mean] - Pre-computed mean (optional)
 * @returns {number} Standard deviation
 */
export const computeStd = (arr, mean = null) => {
  if (!arr || arr.length < 2) return 0;
  const m = mean !== null ? mean : computeMean(arr);
  const variance = arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
};

/**
 * Compute Pearson correlation between two arrays
 * @param {number[]} x - First array
 * @param {number[]} y - Second array
 * @returns {number} Correlation coefficient (-1 to 1)
 */
export const computeCorrelation = (x, y) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  
  const meanX = computeMean(x.slice(0, n));
  const meanY = computeMean(y.slice(0, n));
  
  let cov = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }
  
  if (varX === 0 || varY === 0) return 0;
  return cov / Math.sqrt(varX * varY);
};

/**
 * Compute EWMA (Exponentially Weighted Moving Average) correlation
 * @param {number[]} x - First return series
 * @param {number[]} y - Second return series
 * @param {number} lambda - Decay factor (0.94 typical for daily data)
 * @returns {number} EWMA correlation
 */
export const computeEWMACorrelation = (x, y, lambda = 0.94) => {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  
  const meanX = computeMean(x.slice(0, n));
  const meanY = computeMean(y.slice(0, n));
  
  let weightSum = 0;
  let covSum = 0;
  let varXSum = 0;
  let varYSum = 0;
  
  // Apply EWMA weights (most recent gets highest weight)
  for (let i = n - 1; i >= 0; i--) {
    const weight = Math.pow(lambda, n - 1 - i);
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    
    weightSum += weight;
    covSum += weight * dx * dy;
    varXSum += weight * dx * dx;
    varYSum += weight * dy * dy;
  }
  
  if (varXSum === 0 || varYSum === 0) return 0;
  return covSum / Math.sqrt(varXSum * varYSum);
};

/**
 * Compute pairwise correlation matrix from returns
 * @param {number[][]} returnsMatrix - Array of return series (one per asset)
 * @param {Object} options - Options
 * @param {boolean} options.useEwma - Use EWMA weighting
 * @param {number} options.lambda - EWMA decay factor
 * @returns {number[][]} Correlation matrix
 */
export const computeCorrelationMatrix = (returnsMatrix, options = {}) => {
  const { useEwma = false, lambda = 0.94 } = options;
  const n = returnsMatrix.length;
  const corr = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    corr[i][i] = 1.0;
    for (let j = i + 1; j < n; j++) {
      const c = useEwma 
        ? computeEWMACorrelation(returnsMatrix[i], returnsMatrix[j], lambda)
        : computeCorrelation(returnsMatrix[i], returnsMatrix[j]);
      
      const clamped = Math.max(-0.999, Math.min(0.999, c));
      corr[i][j] = clamped;
      corr[j][i] = clamped;
    }
  }
  
  return corr;
};

/**
 * Ledoit-Wolf shrinkage estimator
 * Shrinks sample correlation toward constant correlation target
 * @param {number[][]} sampleCorr - Sample correlation matrix
 * @param {number} [targetCorr=0.3] - Target off-diagonal correlation
 * @returns {{corr: number[][], shrinkage: number}} Shrunk correlation and intensity
 */
export const ledoitWolfShrinkage = (sampleCorr, targetCorr = 0.3) => {
  const n = sampleCorr.length;
  
  // Build target matrix (constant correlation)
  const target = Array(n).fill(null).map((_, i) =>
    Array(n).fill(targetCorr).map((c, j) => i === j ? 1 : c)
  );
  
  // Compute optimal shrinkage intensity
  // Simplified version - in practice would estimate from data
  let sumSqDiff = 0;
  let sumSqTarget = 0;
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        sumSqDiff += (sampleCorr[i][j] - target[i][j]) ** 2;
        sumSqTarget += target[i][j] ** 2;
      }
    }
  }
  
  // Shrinkage intensity (heuristic based on matrix size)
  const shrinkage = Math.min(0.5, Math.max(0.1, 2 / n));
  
  const shrunkCorr = shrinkMatrix(sampleCorr, target, shrinkage);
  
  return {
    corr: makeValidCorrelation(shrunkCorr),
    shrinkage,
  };
};

/**
 * Compute EWMA lambda from half-life
 * @param {number} halfLife - Half-life in periods (e.g., days)
 * @returns {number} Lambda decay factor
 */
export const halfLifeToLambda = (halfLife) => {
  return Math.pow(0.5, 1 / halfLife);
};

/**
 * Compute half-life from lambda
 * @param {number} lambda - Decay factor
 * @returns {number} Half-life in periods
 */
export const lambdaToHalfLife = (lambda) => {
  return Math.log(0.5) / Math.log(lambda);
};

/**
 * Align two return series by date for correlation calculation
 * Useful for international stocks with different trading days
 * @param {number[]} returns1 - First return series
 * @param {number[]} timestamps1 - Timestamps for first series
 * @param {number[]} returns2 - Second return series
 * @param {number[]} timestamps2 - Timestamps for second series
 * @param {number} lag - Day lag adjustment (-1, 0, or 1)
 * @returns {{aligned1: number[], aligned2: number[], matchedDates: number}}
 */
export const alignReturnsByDate = (returns1, timestamps1, returns2, timestamps2, lag = 0) => {
  // Build date map for second series
  const dateMap = new Map();
  for (let i = 0; i < returns2.length && i < timestamps2.length; i++) {
    const dateKey = new Date(timestamps2[i]).toISOString().slice(0, 10);
    dateMap.set(dateKey, returns2[i]);
  }
  
  const aligned1 = [];
  const aligned2 = [];
  
  for (let i = 0; i < returns1.length && i < timestamps1.length; i++) {
    const date = new Date(timestamps1[i]);
    let targetDate = new Date(date);
    
    // Apply lag
    if (lag === -1) targetDate.setDate(targetDate.getDate() - 1);
    else if (lag === 1) targetDate.setDate(targetDate.getDate() + 1);
    
    const targetKey = targetDate.toISOString().slice(0, 10);
    const matchedReturn = dateMap.get(targetKey);
    
    if (matchedReturn !== undefined) {
      aligned1.push(returns1[i]);
      aligned2.push(matchedReturn);
    }
  }
  
  return {
    aligned1,
    aligned2,
    matchedDates: aligned1.length,
  };
};

/**
 * Compute beta and R² from regression
 * @param {number[]} y - Dependent variable (stock returns)
 * @param {number[]} x - Independent variable (market returns)
 * @param {number[]} [weights] - Optional EWMA weights
 * @returns {{beta: number, rSquared: number, alpha: number}}
 */
export const computeRegression = (y, x, weights = null) => {
  const n = Math.min(y.length, x.length);
  if (n < 2) return { beta: 1, rSquared: 0, alpha: 0 };
  
  let sumW = 0, sumX = 0, sumY = 0;
  
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    sumW += w;
    sumX += w * x[i];
    sumY += w * y[i];
  }
  
  const meanX = sumX / sumW;
  const meanY = sumY / sumW;
  
  let cov = 0, varX = 0, varY = 0;
  
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += w * dx * dy;
    varX += w * dx * dx;
    varY += w * dy * dy;
  }
  
  const beta = varX > 0 ? cov / varX : 1;
  const alpha = meanY - beta * meanX;
  
  // Compute R²
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const w = weights ? weights[i] : 1;
    const predicted = alpha + beta * x[i];
    ssRes += w * (y[i] - predicted) ** 2;
  }
  
  const rSquared = varY > 0 ? Math.max(0, Math.min(1, 1 - ssRes / varY)) : 0;
  
  return { beta, rSquared, alpha };
};

export default {
  computeMean,
  computeStd,
  computeCorrelation,
  computeEWMACorrelation,
  computeCorrelationMatrix,
  ledoitWolfShrinkage,
  halfLifeToLambda,
  lambdaToHalfLife,
  alignReturnsByDate,
  computeRegression,
};
