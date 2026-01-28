/**
 * Constants Index
 * 
 * @module constants
 * @description Central export point for all application constants.
 * Import from this file for convenience: `import { THEMATIC_ETFS, COLORS } from '../constants'`
 */

// ====================
// Design System Tokens
// ====================
export * from './designTokens';

// ====================
// Factor definitions (Fama-French style)
// ====================
export * from './factors';

// ====================
// Thematic/Sector ETF mappings
// ====================
export * from './thematic';

// ====================
// LocalStorage configuration
// ====================
export * from './storage';

// ====================
// Default values
// ====================
export * from './defaults';

// ====================
// Command palette commands
// ====================
export * from './commands';

// ====================
// Legacy exports (for backwards compatibility)
// ====================

import { STORAGE_KEYS, CACHE_CONFIG } from './storage';
import { COLORS, DEFAULT_POSITION, DEFAULT_SIMULATION } from './defaults';
import { FACTOR_ETF_TICKERS } from './factors';
import { THEMATIC_ETF_TICKERS } from './thematic';

// Application version
export const APP_VERSION = '6.0.0';

// Legacy storage key alias
export const STORAGE_KEY = STORAGE_KEYS.PORTFOLIO;

// Percentile color mapping (for backwards compatibility)
export const PERCENTILE_COLORS = {
  p5: COLORS.p5,
  p25: COLORS.p25,
  p50: COLORS.p50,
  p75: COLORS.p75,
  p95: COLORS.p95,
};

// Chart colors (for multi-series charts)
export const CHART_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#84cc16', // Lime
  '#14b8a6', // Teal
];

// All factor ETF tickers needed for analysis (combined unique list)
export const ALL_FACTOR_ETFS = [
  ...new Set([...FACTOR_ETF_TICKERS, ...THEMATIC_ETF_TICKERS])
];

// Yahoo Finance API endpoint builders
export const YAHOO_API = {
  chart: (ticker) => `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`,
  chartWithRange: (ticker, range, interval = '1d') => 
    `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${interval}&range=${range}`,
  quote: (ticker) => `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${ticker}`,
};

// CORS proxy URLs (tried in parallel, fastest wins)
export const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
];

// Simulation limits
export const SIMULATION_LIMITS = {
  minPaths: 100,
  maxPaths: 1000000,
  defaultPaths: 10000,
  maxPositions: 50,
  maxStorageDistributionSize: 1000,
};

// Distribution parameter bounds
export const DISTRIBUTION_BOUNDS = {
  mu: { min: -1, max: 5 },
  sigma: { min: 0.01, max: 2 },
  skew: { min: -2, max: 2 },
  tailDf: { min: 3, max: 30 },
};

// Slider ranges for percentile inputs
export const SLIDER_RANGES = {
  p5: { min: -80, max: 20 },
  p25: { min: -50, max: 40 },
  p50: { min: -20, max: 60 },
  p75: { min: 0, max: 100 },
  p95: { min: 20, max: 200 },
};

// Tab configuration
export const TABS = [
  { id: 'positions', label: '📊 Positions' },
  { id: 'correlation', label: '🔗 Correlation' },
  { id: 'factors', label: '📈 Factors' },
  { id: 'simulation', label: '🎲 Simulation' },
  { id: 'optimization', label: '⚡ Optimization' },
];

// Sector correlation defaults
export const SECTOR_CORRELATIONS = {
  'Technology': 0.75,
  'Healthcare': 0.60,
  'Financial': 0.70,
  'Consumer': 0.65,
  'Industrial': 0.65,
  'Energy': 0.70,
  'Materials': 0.65,
  'Utilities': 0.50,
  'Real Estate': 0.55,
  'Communication': 0.65,
  'default': 0.50,
};

// Exchange rate defaults (fallback when API unavailable)
export const DEFAULT_EXCHANGE_RATES = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.27,
  JPY: 0.0067,
  CHF: 1.12,
  CAD: 0.74,
  AUD: 0.65,
  CNY: 0.14,
  HKD: 0.13,
  SGD: 0.75,
};

// PDF export colors (RGB arrays for jsPDF)
export const PDF_COLORS = {
  background: [10, 10, 21],
  cardBg: [26, 26, 46],
  primary: [0, 212, 255],
  secondary: [123, 47, 247],
  green: [46, 204, 113],
  red: [231, 76, 60],
  orange: [255, 159, 67],
  text: [224, 224, 224],
  muted: [136, 136, 136],
};
