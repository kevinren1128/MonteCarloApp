/**
 * Default Values and Configuration
 * 
 * @module constants/defaults
 * @description Default values for portfolio, simulation, and UI settings.
 * These values are used when no user preference is set.
 */

/**
 * Default position values for new positions
 */
export const DEFAULT_POSITION = {
  ticker: '',
  shares: 0,
  price: 0,
  distribution: {
    mu: 0.08,      // 8% expected return
    sigma: 0.20,   // 20% volatility
    skew: 0,       // No skew
    tailDf: 30,    // Near-normal tails
  },
};

/**
 * Default simulation settings
 */
export const DEFAULT_SIMULATION = {
  /** Number of Monte Carlo paths */
  numPaths: 10000,
  
  /** Simulation time horizon in months */
  timeHorizon: 12,
  
  /** Use Quasi-Monte Carlo (Sobol sequences) */
  useQmc: true,
  
  /** Use EWMA recency-weighted correlations */
  useEwma: true,
  
  /** EWMA half-life in days */
  ewmaHalfLife: 30,
  
  /** Correlation estimation method: 'sample' | 'ewma' | 'shrinkage' */
  correlationMethod: 'shrinkage',
  
  /** Fat tail method: 'bootstrap' | 'student-t' */
  fatTailMethod: 'bootstrap',
  
  /** Treat GLD as cash-like (lower correlation) */
  gldAsCash: true,
  
  /** Drawdown threshold for VaR calculation (e.g., 0.1 = 10%) */
  drawdownThreshold: 0.10,
};

/**
 * Default cash settings
 */
export const DEFAULT_CASH = {
  /** Cash balance */
  balance: 0,
  
  /** Risk-free rate (annual) */
  riskFreeRate: 0.05, // 5%
};

/**
 * Default correlation matrix settings
 */
export const DEFAULT_CORRELATION = {
  /** History timeline for correlation computation */
  historyTimeline: '1y',
  
  /** Minimum correlation floor for intra-sector */
  sectorCorrelationFloor: 0.55,
  
  /** Shrinkage intensity for Ledoit-Wolf (0 = sample, 1 = target) */
  shrinkageIntensity: 0.3,
};

/**
 * Default factor analysis settings
 */
export const DEFAULT_FACTOR_ANALYSIS = {
  /** Minimum R² to consider a thematic match */
  thematicRSquaredThreshold: 0.10, // 10%
  
  /** Minimum overlap days for correlation calculation */
  minOverlapDays: 30,
  
  /** Use EWMA for factor correlations */
  useEwma: true,
};

/**
 * Default optimization settings
 */
export const DEFAULT_OPTIMIZATION = {
  /** Target return for mean-variance optimization */
  targetReturn: 0.10, // 10%
  
  /** Risk aversion parameter (higher = more conservative) */
  riskAversion: 2.0,
  
  /** Maximum position weight */
  maxWeight: 0.30, // 30%
  
  /** Minimum position weight */
  minWeight: 0.02, // 2%
};

/**
 * Default UI settings
 */
export const DEFAULT_UI = {
  /** Default active tab */
  activeTab: 'positions',
  
  /** Show advanced options */
  showAdvanced: false,
  
  /** Number format locale */
  locale: 'en-US',
  
  /** Currency symbol */
  currencySymbol: '$',
};

/**
 * Distribution percentile display points
 */
export const PERCENTILE_POINTS = [5, 25, 50, 75, 95];

/**
 * Color palette for charts and UI
 */
export const COLORS = {
  // Percentile colors (red to green gradient)
  p5: '#ef4444',     // Red
  p25: '#f97316',    // Orange
  p50: '#eab308',    // Yellow
  p75: '#84cc16',    // Lime
  p95: '#22c55e',    // Green
  
  // UI colors
  primary: '#4a90d9',
  secondary: '#6c757d',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  info: '#17a2b8',
  
  // Chart colors
  chartBlue: '#3b82f6',
  chartGreen: '#10b981',
  chartRed: '#ef4444',
  chartPurple: '#8b5cf6',
  chartOrange: '#f59e0b',
  
  // Background colors
  bgLight: '#f8f9fa',
  bgDark: '#1f2937',
};

export default {
  DEFAULT_POSITION,
  DEFAULT_SIMULATION,
  DEFAULT_CASH,
  DEFAULT_CORRELATION,
  DEFAULT_FACTOR_ANALYSIS,
  DEFAULT_OPTIMIZATION,
  DEFAULT_UI,
  PERCENTILE_POINTS,
  COLORS,
};
