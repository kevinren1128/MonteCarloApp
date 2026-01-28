/**
 * Utilities Index
 * 
 * @module utils
 * @description Central export point for all utility functions.
 * Import from this file for convenience: `import { computeCorrelation, formatPercent } from '../utils'`
 */

// ====================
// Distribution utilities
// ====================
export * from './distribution';

// ====================
// Matrix operations
// ====================
export * from './matrix';

// ====================
// Correlation utilities
// ====================
export * from './correlation';

// ====================
// Formatting utilities
// ====================
export * from './formatting';

// ====================
// Portfolio Optimization
// ====================
export {
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
} from './portfolioOptimization';
export { default as portfolioOptimization } from './portfolioOptimization';

// ====================
// Statistics (legacy - comprehensive stats module)
// ====================
export {
  boxMuller,
  choleskyDecomposition,
  percentile,
  percentileIdx,
  estimateTailDf,
  deriveDistributionParams,
  skewedTTransform,
  generateCorrelatedReturns,
  ledoitWolfShrinkage,
  shrinkToConstantCorrelation,
  generateMultivariateTReturns,
  generateGaussianCopulaReturns,
  generateChiSquared,
  computeImportanceSamplingParams,
  generateImportanceSampledReturns,
  gaussianCopulaCorrelationAttenuation,
  correlationInflationFactor,
  normalCDF,
  normalInvCDF,
  studentTInvCDF,
} from './statistics';

// ====================
// Quasi-Monte Carlo
// ====================
export {
  SobolSequence,
  HaltonSequence,
  QMCCorrelatedNormalGenerator,
  inverseNormalCDF,
  uniformToNormal,
  uniformsToNormals,
  generateQMCReturns,
  generateQMCMultivariateTReturns,
  createQMCGenerator,
  runQMCSimulation,
  estimateStarDiscrepancy,
  haltonValue,
} from './quasiMonteCarlo';

// ====================
// Re-export default objects for convenience
// ====================
export { default as distributionUtils } from './distribution';
export { default as matrixUtils } from './matrix';
export { default as correlationUtils } from './correlation';
export { default as formattingUtils } from './formatting';

// ====================
// Chart utilities
// ====================
export {
  generateHistogramData,
  generateReturnHistogramData,
  generateDollarHistogramData,
  formatDollars,
  formatCurrency,
  formatPercent,
  getValueColor,
  getPercentile,
} from './chartUtils';
export { default as chartUtils } from './chartUtils';

// ====================
// Fuzzy search (for command palette)
// ====================
export {
  createFuzzySearch,
  highlightMatches,
  simpleFuzzySearch,
} from './fuzzySearch';
export { default as fuzzySearch } from './fuzzySearch';

// ====================
// Crash recovery
// ====================
export {
  OperationType,
  markOperationStart,
  markOperationComplete,
  clearRecoveryState,
  checkRecoveryNeeded,
  getOperationDescription,
  createPositionsSnapshot,
  restorePositionsFromSnapshot,
} from './crashRecovery';
export { default as crashRecovery } from './crashRecovery';
