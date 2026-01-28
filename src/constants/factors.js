/**
 * Factor ETF Definitions for Fama-French Style Analysis
 * 
 * @module constants/factors
 * @description Defines the ETFs used to construct factor portfolios for
 * risk decomposition and factor analysis. Based on Fama-French three-factor
 * model extended with momentum and quality factors.
 */

/**
 * Standard Fama-French style factors using ETF proxies
 * MKT (Market) is the baseline; other factors are computed as long-short spreads
 */
export const STANDARD_FACTOR_ETFS = {
  MKT: { 
    ticker: 'SPY', 
    name: 'Market', 
    description: 'Broad market exposure (S&P 500)' 
  },
  // Size, Value, Momentum, Quality, Low Vol computed as spreads below
};

/**
 * Factor spread definitions (long - short or excess over SPY)
 * Each factor is computed as the return difference between two ETFs
 */
export const FACTOR_SPREAD_DEFINITIONS = {
  SMB: { 
    long: 'IWM', 
    short: 'SPY', 
    name: 'Size (Small-Big)', 
    description: 'Small cap vs large cap premium' 
  },
  HML: { 
    long: 'IWD', 
    short: 'IWF', 
    name: 'Value (High-Low)', 
    description: 'Value vs growth premium' 
  },
  MOM: { 
    long: 'MTUM', 
    short: 'SPY', 
    name: 'Momentum', 
    description: 'Momentum factor excess return' 
  },
  QUAL: { 
    long: 'QUAL', 
    short: 'SPY', 
    name: 'Quality', 
    description: 'Quality factor excess return' 
  },
  LVOL: { 
    long: 'SPLV', 
    short: 'SPY', 
    name: 'Low Volatility', 
    description: 'Low volatility excess return' 
  },
};

/**
 * All unique ETF tickers needed to compute factors
 * Used when fetching market data
 */
export const FACTOR_ETF_TICKERS = [
  'SPY',   // Market proxy
  'IWM',   // Small cap (Russell 2000)
  'IWD',   // Value (Russell 1000 Value)
  'IWF',   // Growth (Russell 1000 Growth)
  'MTUM',  // Momentum (MSCI USA Momentum)
  'QUAL',  // Quality (MSCI USA Quality)
  'SPLV',  // Low Volatility (S&P 500 Low Vol)
];

/**
 * Display order for factors in UI
 */
export const FACTOR_DISPLAY_ORDER = ['MKT', 'SMB', 'HML', 'MOM', 'QUAL', 'LVOL'];

/**
 * Factor colors for visualization
 */
export const FACTOR_COLORS = {
  MKT: '#4a90d9',   // Blue
  SMB: '#50c878',   // Green
  HML: '#e74c3c',   // Red
  MOM: '#f39c12',   // Orange
  QUAL: '#9b59b6',  // Purple
  LVOL: '#1abc9c',  // Teal
};

export default {
  STANDARD_FACTOR_ETFS,
  FACTOR_SPREAD_DEFINITIONS,
  FACTOR_ETF_TICKERS,
  FACTOR_DISPLAY_ORDER,
  FACTOR_COLORS,
};
