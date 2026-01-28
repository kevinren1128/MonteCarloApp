/**
 * Thematic and Sector ETF Definitions
 * 
 * @module constants/thematic
 * @description Defines ETFs used for correlation-based thematic detection.
 * When a stock shows high correlation with a thematic ETF, it suggests
 * exposure to that theme/sector.
 */

/**
 * Thematic/Sector ETFs for correlation-based detection
 * Categories: sector, thematic, international
 */
export const THEMATIC_ETFS = {
  // GICS Sectors (SPDR Select Sector ETFs)
  XLK: { name: 'Technology', category: 'sector', description: 'Information Technology sector' },
  XLF: { name: 'Financials', category: 'sector', description: 'Financial services sector' },
  XLE: { name: 'Energy', category: 'sector', description: 'Energy sector' },
  XLV: { name: 'Healthcare', category: 'sector', description: 'Healthcare sector' },
  XLI: { name: 'Industrials', category: 'sector', description: 'Industrial sector' },
  XLY: { name: 'Consumer Discretionary', category: 'sector', description: 'Consumer discretionary sector' },
  XLP: { name: 'Consumer Staples', category: 'sector', description: 'Consumer staples sector' },
  XLU: { name: 'Utilities', category: 'sector', description: 'Utilities sector' },
  XLRE: { name: 'Real Estate', category: 'sector', description: 'Real estate sector' },
  XLC: { name: 'Communication Services', category: 'sector', description: 'Communication services sector' },
  XLB: { name: 'Materials', category: 'sector', description: 'Materials sector' },
  
  // Thematic ETFs
  SOXX: { name: 'Semiconductors', category: 'thematic', description: 'iShares Semiconductor ETF' },
  SMH: { name: 'Semiconductors (VanEck)', category: 'thematic', description: 'VanEck Semiconductor ETF' },
  ITA: { name: 'Aerospace & Defense', category: 'thematic', description: 'iShares Aerospace & Defense' },
  XBI: { name: 'Biotech', category: 'thematic', description: 'SPDR Biotech ETF' },
  IBB: { name: 'Biotech (Broad)', category: 'thematic', description: 'iShares Biotech ETF' },
  IGV: { name: 'Software', category: 'thematic', description: 'iShares Software ETF' },
  TAN: { name: 'Solar', category: 'thematic', description: 'Invesco Solar ETF' },
  KWEB: { name: 'China Internet', category: 'thematic', description: 'KraneShares China Internet' },
  ARKK: { name: 'Innovation/Disruptive', category: 'thematic', description: 'ARK Innovation ETF' },
  GDX: { name: 'Gold Miners', category: 'thematic', description: 'VanEck Gold Miners ETF' },
  XHB: { name: 'Homebuilders', category: 'thematic', description: 'SPDR Homebuilders ETF' },
  KRE: { name: 'Regional Banks', category: 'thematic', description: 'SPDR Regional Banking ETF' },
  
  // International/Regional
  EEM: { name: 'Emerging Markets', category: 'international', description: 'iShares Emerging Markets' },
  EFA: { name: 'Developed Intl', category: 'international', description: 'iShares EAFE' },
  FXI: { name: 'China Large Cap', category: 'international', description: 'iShares China Large-Cap' },
  EWJ: { name: 'Japan', category: 'international', description: 'iShares Japan' },
  EWZ: { name: 'Brazil', category: 'international', description: 'iShares Brazil' },
};

/**
 * Get all thematic ETF tickers
 */
export const THEMATIC_ETF_TICKERS = Object.keys(THEMATIC_ETFS);

/**
 * Get ETFs by category
 * @param {string} category - 'sector', 'thematic', or 'international'
 */
export const getETFsByCategory = (category) => {
  return Object.entries(THEMATIC_ETFS)
    .filter(([_, info]) => info.category === category)
    .map(([ticker, info]) => ({ ticker, ...info }));
};

/**
 * Sector ETF tickers only
 */
export const SECTOR_ETF_TICKERS = Object.entries(THEMATIC_ETFS)
  .filter(([_, info]) => info.category === 'sector')
  .map(([ticker]) => ticker);

/**
 * Known stock-to-sector mappings for stocks that Yahoo may miscategorize
 */
export const KNOWN_SECTOR_OVERRIDES = {
  // Semiconductors (often categorized as "Technology" generically)
  NVDA: { sector: 'Semiconductors', industry: 'Semiconductors' },
  AMD: { sector: 'Semiconductors', industry: 'Semiconductors' },
  INTC: { sector: 'Semiconductors', industry: 'Semiconductors' },
  TSM: { sector: 'Semiconductors', industry: 'Semiconductors' },
  ASML: { sector: 'Semiconductors', industry: 'Semiconductor Equipment' },
  KLAC: { sector: 'Semiconductors', industry: 'Semiconductor Equipment' },
  LRCX: { sector: 'Semiconductors', industry: 'Semiconductor Equipment' },
  AMAT: { sector: 'Semiconductors', industry: 'Semiconductor Equipment' },
  MU: { sector: 'Semiconductors', industry: 'Semiconductors' },
  AVGO: { sector: 'Semiconductors', industry: 'Semiconductors' },
  QCOM: { sector: 'Semiconductors', industry: 'Semiconductors' },
  TXN: { sector: 'Semiconductors', industry: 'Semiconductors' },
  ADI: { sector: 'Semiconductors', industry: 'Semiconductors' },
  MRVL: { sector: 'Semiconductors', industry: 'Semiconductors' },
  ON: { sector: 'Semiconductors', industry: 'Semiconductors' },
  NXPI: { sector: 'Semiconductors', industry: 'Semiconductors' },
  'BESI.AS': { sector: 'Semiconductors', industry: 'Semiconductor Equipment' },
  '6525.T': { sector: 'Semiconductors', industry: 'Semiconductor Equipment' },
  SMCI: { sector: 'Technology', industry: 'Computer Hardware' },
  DELL: { sector: 'Technology', industry: 'Computer Hardware' },
  
  // Software
  MSFT: { sector: 'Technology', industry: 'Software' },
  CRM: { sector: 'Technology', industry: 'Software' },
  ADBE: { sector: 'Technology', industry: 'Software' },
  NOW: { sector: 'Technology', industry: 'Software' },
  ORCL: { sector: 'Technology', industry: 'Software' },
  
  // Fintech/Payments
  SQ: { sector: 'Fintech', industry: 'Payment Services' },
  PYPL: { sector: 'Fintech', industry: 'Payment Services' },
  V: { sector: 'Fintech', industry: 'Payment Services' },
  MA: { sector: 'Fintech', industry: 'Payment Services' },
  
  // Pharma/Biotech
  LLY: { sector: 'Healthcare', industry: 'Pharmaceuticals' },
  JNJ: { sector: 'Healthcare', industry: 'Pharmaceuticals' },
  MRNA: { sector: 'Healthcare', industry: 'Biotechnology' },
};

/**
 * Known ETF category mappings
 */
export const KNOWN_ETF_CATEGORIES = {
  QQQ: { sector: 'Technology', industry: 'Tech ETF', name: 'Nasdaq 100' },
  VOO: { sector: 'Broad Market', industry: 'Index ETF', name: 'S&P 500' },
  VTI: { sector: 'Broad Market', industry: 'Index ETF', name: 'Total Stock Market' },
  IWM: { sector: 'Small Cap', industry: 'Index ETF', name: 'Russell 2000' },
  DIA: { sector: 'Large Cap', industry: 'Index ETF', name: 'Dow Jones' },
  GLD: { sector: 'Commodities', industry: 'Precious Metals', name: 'Gold' },
  SLV: { sector: 'Commodities', industry: 'Precious Metals', name: 'Silver' },
  TLT: { sector: 'Fixed Income', industry: 'Treasuries', name: 'Long-Term Treasuries' },
  BND: { sector: 'Fixed Income', industry: 'Bonds', name: 'Total Bond Market' },
  VNQ: { sector: 'Real Estate', industry: 'REITs', name: 'Real Estate' },
  ...Object.fromEntries(
    Object.entries(THEMATIC_ETFS).map(([ticker, info]) => [
      ticker, 
      { sector: info.name, industry: `${info.category} ETF`, name: info.name }
    ])
  ),
};

export default {
  THEMATIC_ETFS,
  THEMATIC_ETF_TICKERS,
  getETFsByCategory,
  SECTOR_ETF_TICKERS,
  KNOWN_SECTOR_OVERRIDES,
  KNOWN_ETF_CATEGORIES,
};
