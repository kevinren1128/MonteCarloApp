/**
 * Factor Definitions for Portfolio Analysis
 * Contains ETF mappings for factor analysis and correlation-based detection
 */

/**
 * Standard Fama-French style factors using ETF proxies
 * @type {Object.<string, {ticker: string, name: string, description: string}>}
 */
export const STANDARD_FACTOR_ETFS = {
  MKT: { ticker: 'SPY', name: 'Market', description: 'Broad market exposure' },
  // Size, Value, Momentum, Quality, Low Vol computed as spreads or excess returns
};

/**
 * Factor spread definitions (long - short or excess over SPY)
 * Used for computing factor exposures via correlation analysis
 * @type {Object.<string, {long: string, short: string, name: string, description: string}>}
 */
export const FACTOR_SPREAD_DEFINITIONS = {
  SMB: { long: 'IWM', short: 'SPY', name: 'Size (Small-Big)', description: 'Small cap vs large cap' },
  HML: { long: 'IWD', short: 'IWF', name: 'Value (High-Low)', description: 'Value vs growth' },
  MOM: { long: 'MTUM', short: 'SPY', name: 'Momentum', description: 'Momentum excess return' },
  QUAL: { long: 'QUAL', short: 'SPY', name: 'Quality', description: 'Quality excess return' },
  LVOL: { long: 'SPLV', short: 'SPY', name: 'Low Volatility', description: 'Low vol excess return' },
};

/**
 * Thematic/Sector ETFs for correlation-based detection
 * Categorized by sector, thematic, and international classifications
 * @type {Object.<string, {name: string, category: string}>}
 */
export const THEMATIC_ETFS = {
  // Sectors (SPDR Select Sector)
  XLK: { name: 'Technology', category: 'sector' },
  XLF: { name: 'Financials', category: 'sector' },
  XLE: { name: 'Energy', category: 'sector' },
  XLV: { name: 'Healthcare', category: 'sector' },
  XLI: { name: 'Industrials', category: 'sector' },
  XLY: { name: 'Consumer Discretionary', category: 'sector' },
  XLP: { name: 'Consumer Staples', category: 'sector' },
  XLU: { name: 'Utilities', category: 'sector' },
  XLRE: { name: 'Real Estate', category: 'sector' },
  XLC: { name: 'Communication Services', category: 'sector' },
  XLB: { name: 'Materials', category: 'sector' },
  
  // Thematic
  SOXX: { name: 'Semiconductors', category: 'thematic' },
  ITA: { name: 'Aerospace & Defense', category: 'thematic' },
  XBI: { name: 'Biotech', category: 'thematic' },
  IGV: { name: 'Software', category: 'thematic' },
  TAN: { name: 'Solar', category: 'thematic' },
  KWEB: { name: 'China Internet', category: 'thematic' },
  ARKK: { name: 'Innovation/Disruptive', category: 'thematic' },
  GDX: { name: 'Gold Miners', category: 'thematic' },
  XHB: { name: 'Homebuilders', category: 'thematic' },
  KRE: { name: 'Regional Banks', category: 'thematic' },
  IBB: { name: 'Biotech (Broad)', category: 'thematic' },
  SMH: { name: 'Semiconductors (VanEck)', category: 'thematic' },
  
  // International
  EEM: { name: 'Emerging Markets', category: 'international' },
  EFA: { name: 'Developed Intl', category: 'international' },
  FXI: { name: 'China Large Cap', category: 'international' },
  EWJ: { name: 'Japan', category: 'international' },
  EWZ: { name: 'Brazil', category: 'international' },
};

/**
 * All factor ETFs needed to fetch for factor analysis
 * Combines standard factors and thematic ETFs
 * @type {string[]}
 */
export const ALL_FACTOR_ETFS = [
  'SPY', 'IWM', 'IWD', 'IWF', 'MTUM', 'QUAL', 'SPLV',
  ...Object.keys(THEMATIC_ETFS)
];
