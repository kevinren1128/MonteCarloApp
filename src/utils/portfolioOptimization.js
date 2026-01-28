/**
 * Portfolio Optimization Utilities
 * 
 * Pure mathematical functions for portfolio analysis and optimization.
 * No React dependencies - can be used anywhere.
 * 
 * Key concepts:
 * - Covariance Matrix: σᵢⱼ = ρᵢⱼ × σᵢ × σⱼ
 * - Portfolio Variance: σ²ₚ = Σᵢ Σⱼ wᵢwⱼσᵢⱼ
 * - MCTR (Marginal Contribution to Risk): ∂σₚ/∂wᵢ
 * - Risk Contribution: wᵢ × MCTRᵢ
 * - Sharpe Ratio: (E[R] - Rₓ) / σ
 */

// ============================================
// CORE MATRIX OPERATIONS
// ============================================

/**
 * Build covariance matrix from correlation matrix and volatilities
 * @param {number[][]} correlationMatrix - NxN correlation matrix
 * @param {number[]} sigmaArray - Array of annualized volatilities
 * @returns {number[][]} Covariance matrix
 */
export const buildCovarianceMatrix = (correlationMatrix, sigmaArray) => {
  const n = sigmaArray.length;
  const cov = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const rho = correlationMatrix?.[i]?.[j] ?? (i === j ? 1 : 0);
      cov[i][j] = rho * sigmaArray[i] * sigmaArray[j];
    }
  }
  return cov;
};

// ============================================
// PORTFOLIO METRICS
// ============================================

/**
 * Compute portfolio volatility from weights and covariance matrix
 * @param {number[]} weights - Portfolio weights (can sum to != 1 for leveraged portfolios)
 * @param {number[][]} covMatrix - Covariance matrix
 * @returns {number} Annualized portfolio volatility
 */
export const computePortfolioVolatility = (weights, covMatrix) => {
  let variance = 0;
  const n = weights.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * (covMatrix[i]?.[j] || 0);
    }
  }
  return Math.sqrt(Math.max(0, variance));
};

/**
 * Compute portfolio expected return from weights and expected returns
 * @param {number[]} weights - Portfolio weights
 * @param {number[]} muArray - Array of expected returns (annualized)
 * @returns {number} Portfolio expected return
 */
export const computePortfolioReturn = (weights, muArray) => {
  let ret = 0;
  for (let i = 0; i < weights.length; i++) {
    ret += weights[i] * (muArray[i] || 0);
  }
  return ret;
};

/**
 * Compute Sharpe ratio
 * @param {number} expectedReturn - Portfolio expected return
 * @param {number} volatility - Portfolio volatility
 * @param {number} riskFreeRate - Risk-free rate
 * @returns {number} Sharpe ratio
 */
export const computeSharpeRatio = (expectedReturn, volatility, riskFreeRate) => {
  if (volatility <= 0) return 0;
  return (expectedReturn - riskFreeRate) / volatility;
};

// ============================================
// RISK DECOMPOSITION
// ============================================

/**
 * Compute Marginal Contribution to Risk (MCTR) for each asset
 * MCTR_i = (Σw)_i / σ_p = derivative of portfolio vol w.r.t. weight_i
 * 
 * @param {number[]} weights - Portfolio weights
 * @param {number[][]} covMatrix - Covariance matrix
 * @param {number} portfolioVol - Pre-computed portfolio volatility
 * @returns {number[]} MCTR for each asset
 */
export const computeMCTR = (weights, covMatrix, portfolioVol) => {
  if (portfolioVol <= 0) return weights.map(() => 0);
  const n = weights.length;
  const mctr = [];
  for (let i = 0; i < n; i++) {
    let sumCov = 0;
    for (let j = 0; j < n; j++) {
      sumCov += (covMatrix[i]?.[j] || 0) * weights[j];
    }
    mctr.push(sumCov / portfolioVol);
  }
  return mctr;
};

/**
 * Compute risk contribution percentage for each asset
 * RC_i = w_i × MCTR_i / σ_p (sums to 1.0 for a fully-invested portfolio)
 * 
 * @param {number[]} weights - Portfolio weights
 * @param {number[]} mctr - Pre-computed MCTR array
 * @param {number} portfolioVol - Portfolio volatility
 * @returns {number[]} Risk contribution as percentage of total risk
 */
export const computeRiskContribution = (weights, mctr, portfolioVol) => {
  if (portfolioVol <= 0) return weights.map(() => 0);
  return weights.map((wi, i) => (wi * mctr[i]) / portfolioVol);
};

/**
 * Compute incremental Sharpe ratio for each asset
 * iSharpe_i = S_i - ρ_{i,p} × S_p
 * 
 * Measures how much adding more of asset i would improve/hurt portfolio Sharpe
 * Positive = should increase weight, Negative = should decrease weight
 * 
 * @param {number[]} weights - Portfolio weights
 * @param {number[]} muArray - Expected returns
 * @param {number[]} sigmaArray - Volatilities
 * @param {number[][]} covMatrix - Covariance matrix
 * @param {number} riskFreeRate - Risk-free rate
 * @param {number} cashContribution - Return contribution from cash (effectiveCashWeight × cashRate)
 * @returns {number[]} Incremental Sharpe for each asset
 */
export const computeIncrementalSharpe = (weights, muArray, sigmaArray, covMatrix, riskFreeRate, cashContribution = 0) => {
  const n = weights.length;
  const portfolioVol = computePortfolioVolatility(weights, covMatrix);
  const positionsReturn = computePortfolioReturn(weights, muArray);
  const portfolioReturn = positionsReturn + cashContribution;
  const portfolioSharpe = computeSharpeRatio(portfolioReturn, portfolioVol, riskFreeRate);
  
  // Compute correlation of each asset with portfolio
  const iSharpe = [];
  for (let i = 0; i < n; i++) {
    const assetSharpe = sigmaArray[i] > 0 ? (muArray[i] - riskFreeRate) / sigmaArray[i] : 0;
    // Correlation between asset i and portfolio
    let covWithPortfolio = 0;
    for (let j = 0; j < n; j++) {
      covWithPortfolio += (covMatrix[i]?.[j] || 0) * weights[j];
    }
    const corrWithPortfolio = (sigmaArray[i] > 0 && portfolioVol > 0) 
      ? covWithPortfolio / (sigmaArray[i] * portfolioVol) 
      : 0;
    iSharpe.push(assetSharpe - corrWithPortfolio * portfolioSharpe);
  }
  return iSharpe;
};

/**
 * Compute risk budget optimality ratio
 * Optimality_i = (E[R_i] - R_f) / MCTR_i
 * 
 * In an optimal portfolio, all assets should have the same optimality ratio.
 * 
 * @param {number[]} muArray - Expected returns
 * @param {number[]} mctr - Pre-computed MCTR
 * @param {number} riskFreeRate - Risk-free rate
 * @returns {number[]} Optimality ratio for each asset
 */
export const computeOptimalityRatio = (muArray, mctr, riskFreeRate) => {
  return muArray.map((mu, i) => {
    if (Math.abs(mctr[i]) < 0.0001) return 0;
    return (mu - riskFreeRate) / mctr[i];
  });
};

// ============================================
// OPTIMIZATION ALGORITHMS
// ============================================

/**
 * Compute risk parity target weights (equal risk contribution)
 * Iteratively adjusts weights until each asset contributes equally to portfolio risk.
 * 
 * @param {number[]} sigmaArray - Asset volatilities
 * @param {number[][]} covMatrix - Covariance matrix
 * @param {number} maxIterations - Maximum iterations (default 100)
 * @returns {number[]} Risk parity weights (sum to 1.0)
 */
export const computeRiskParityWeights = (sigmaArray, covMatrix, maxIterations = 100) => {
  const n = sigmaArray.length;
  
  // Start with inverse volatility weights (good initial guess)
  let w = sigmaArray.map(s => s > 0 ? 1 / s : 1);
  const sumW = w.reduce((a, b) => a + b, 0);
  w = w.map(wi => wi / sumW);
  
  // Iteratively adjust to equalize risk contribution
  for (let iter = 0; iter < maxIterations; iter++) {
    const portfolioVol = computePortfolioVolatility(w, covMatrix);
    if (portfolioVol <= 0) break;
    
    const mctr = computeMCTR(w, covMatrix, portfolioVol);
    const rc = w.map((wi, i) => wi * mctr[i]);
    const targetRC = portfolioVol / n;
    
    // Adjust weights based on risk contribution vs target
    let newW = w.map((wi, i) => {
      if (mctr[i] <= 0) return wi;
      return targetRC / mctr[i];
    });
    
    // Normalize to sum to 1
    const newSum = newW.reduce((a, b) => a + b, 0);
    if (newSum <= 0) break;
    newW = newW.map(wi => Math.max(0, wi / newSum));
    
    // Check convergence
    const maxDiff = Math.max(...w.map((wi, i) => Math.abs(wi - newW[i])));
    w = newW;
    if (maxDiff < 0.0001) break;
  }
  
  return w;
};

// ============================================
// SWAP ANALYSIS
// ============================================

/**
 * Compute swap impact matrix - shows ΔSharpe for swapping between any two positions
 * 
 * @param {number[]} weights - Current portfolio weights (adjusted for leverage)
 * @param {number[]} muArray - Expected returns
 * @param {number[]} sigmaArray - Volatilities
 * @param {number[][]} covMatrix - Covariance matrix
 * @param {number} riskFreeRate - Risk-free rate
 * @param {number} leverageRatio - Gross exposure / portfolio value
 * @param {number} cashContribution - Cash return contribution
 * @param {number} swapAmount - Size of swap as fraction of gross (default 0.01 = 1%)
 * @returns {Object} { deltaSharpe: number[][], deltaVol: number[][], deltaReturn: number[][] }
 */
export const computeSwapMatrix = (
  weights, 
  muArray, 
  sigmaArray,
  covMatrix, 
  riskFreeRate, 
  leverageRatio = 1,
  cashContribution = 0,
  swapAmount = 0.01
) => {
  const n = weights.length;
  
  // Current portfolio metrics
  const currentVol = computePortfolioVolatility(weights, covMatrix);
  const currentPositionsReturn = computePortfolioReturn(weights, muArray);
  const currentReturn = currentPositionsReturn + cashContribution;
  const currentSharpe = computeSharpeRatio(currentReturn, currentVol, riskFreeRate);
  
  // Initialize matrices
  const deltaSharpe = Array(n).fill(null).map(() => Array(n).fill(0));
  const deltaVol = Array(n).fill(null).map(() => Array(n).fill(0));
  const deltaReturn = Array(n).fill(null).map(() => Array(n).fill(0));
  
  // Compute each swap
  for (let sell = 0; sell < n; sell++) {
    for (let buy = 0; buy < n; buy++) {
      if (buy === sell) continue;
      
      // New weights after swap
      const newWeights = weights.map((w, i) => {
        if (i === sell) return w - swapAmount * leverageRatio;
        if (i === buy) return w + swapAmount * leverageRatio;
        return w;
      });
      
      const newVol = computePortfolioVolatility(newWeights, covMatrix);
      const newPositionsReturn = computePortfolioReturn(newWeights, muArray);
      const newReturn = newPositionsReturn + cashContribution;
      const newSharpe = computeSharpeRatio(newReturn, newVol, riskFreeRate);
      
      deltaSharpe[sell][buy] = newSharpe - currentSharpe;
      deltaVol[sell][buy] = newVol - currentVol;
      deltaReturn[sell][buy] = newReturn - currentReturn;
    }
  }
  
  return {
    deltaSharpe,
    deltaVol,
    deltaReturn,
    currentSharpe,
    currentVol,
    currentReturn,
  };
};

/**
 * Find top N swap opportunities from a swap matrix
 * 
 * @param {string[]} tickers - Ticker symbols
 * @param {number[][]} deltaSharpe - Swap delta Sharpe matrix
 * @param {number[][]} deltaVol - Swap delta volatility matrix
 * @param {number[][]} deltaReturn - Swap delta return matrix
 * @param {number} topN - Number of top swaps to return (default 15)
 * @returns {Object[]} Array of swap objects sorted by deltaSharpe descending
 */
export const findTopSwaps = (tickers, deltaSharpe, deltaVol, deltaReturn, topN = 15) => {
  const n = tickers.length;
  const allSwaps = [];
  
  for (let sell = 0; sell < n; sell++) {
    for (let buy = 0; buy < n; buy++) {
      if (buy === sell) continue;
      allSwaps.push({
        sellIdx: sell,
        buyIdx: buy,
        sellTicker: tickers[sell],
        buyTicker: tickers[buy],
        deltaSharpe: deltaSharpe[sell][buy],
        deltaVol: deltaVol[sell][buy],
        deltaReturn: deltaReturn[sell][buy],
      });
    }
  }
  
  // Sort by delta Sharpe descending
  allSwaps.sort((a, b) => b.deltaSharpe - a.deltaSharpe);
  
  return allSwaps.slice(0, topN);
};

// ============================================
// CONVENIENCE / COMPOSITE FUNCTIONS
// ============================================

/**
 * Compute full risk decomposition for a portfolio
 * Returns all key metrics in one call for efficiency
 * 
 * @param {number[]} weights - Portfolio weights
 * @param {number[]} muArray - Expected returns
 * @param {number[]} sigmaArray - Volatilities
 * @param {number[][]} correlationMatrix - Correlation matrix
 * @param {number} riskFreeRate - Risk-free rate
 * @param {number} cashContribution - Cash return contribution
 * @returns {Object} Complete risk decomposition
 */
export const computeFullRiskDecomposition = (
  weights,
  muArray,
  sigmaArray,
  correlationMatrix,
  riskFreeRate,
  cashContribution = 0
) => {
  const covMatrix = buildCovarianceMatrix(correlationMatrix, sigmaArray);
  const portfolioVol = computePortfolioVolatility(weights, covMatrix);
  const positionsReturn = computePortfolioReturn(weights, muArray);
  const portfolioReturn = positionsReturn + cashContribution;
  const sharpe = computeSharpeRatio(portfolioReturn, portfolioVol, riskFreeRate);
  const mctr = computeMCTR(weights, covMatrix, portfolioVol);
  const riskContribution = computeRiskContribution(weights, mctr, portfolioVol);
  const iSharpe = computeIncrementalSharpe(weights, muArray, sigmaArray, covMatrix, riskFreeRate, cashContribution);
  const optimalityRatio = computeOptimalityRatio(muArray, mctr, riskFreeRate);
  
  return {
    covMatrix,
    portfolioVol,
    portfolioReturn,
    sharpe,
    mctr,
    riskContribution,
    iSharpe,
    optimalityRatio,
  };
};

// Default export for convenience
export default {
  buildCovarianceMatrix,
  computePortfolioVolatility,
  computePortfolioReturn,
  computeSharpeRatio,
  computeMCTR,
  computeRiskContribution,
  computeIncrementalSharpe,
  computeOptimalityRatio,
  computeRiskParityWeights,
  computeSwapMatrix,
  findTopSwaps,
  computeFullRiskDecomposition,
};
