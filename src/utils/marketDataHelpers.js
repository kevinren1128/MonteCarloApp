/**
 * Market Data Helper Utilities
 * Functions for processing, computing, and managing market data
 */

// ============================================
// SECTOR/INDUSTRY INFERENCE
// ============================================

/**
 * Infer sector/industry from ETF name or known stock/ETF mappings
 * @param {string} symbol - Ticker symbol
 * @param {string} name - Company/ETF name
 * @returns {{sector: string, industry: string, theme?: string, subIndustry?: string}|null}
 */
export const inferETFSector = (symbol, name) => {
  const sym = symbol.toUpperCase();
  const n = (name || '').toLowerCase();
  
  // Known ETF mappings
  const etfMappings = {
    // Semiconductors ETFs
    'SOXL': { sector: 'Technology', industry: 'Semiconductors', theme: 'Semiconductors 3x' },
    'SOXX': { sector: 'Technology', industry: 'Semiconductors', theme: 'Semiconductors' },
    'SMH': { sector: 'Technology', industry: 'Semiconductors', theme: 'Semiconductors' },
    'XSD': { sector: 'Technology', industry: 'Semiconductors', theme: 'Semiconductors' },
    'KDEF': { sector: 'Technology', industry: 'Semiconductors', theme: 'Korea Semiconductors' },
    'PSI': { sector: 'Technology', industry: 'Semiconductors', theme: 'Semiconductors Dynamic' },
    // Gold
    'GLD': { sector: 'Commodities', industry: 'Gold', theme: 'Gold' },
    'IAU': { sector: 'Commodities', industry: 'Gold', theme: 'Gold' },
    'GDXU': { sector: 'Materials', industry: 'Gold Mining', theme: 'Gold Miners 3x' },
    'GDX': { sector: 'Materials', industry: 'Gold Mining', theme: 'Gold Miners' },
    'GDXJ': { sector: 'Materials', industry: 'Gold Mining', theme: 'Junior Gold Miners' },
    // Tech/Software
    'QQQ': { sector: 'Technology', industry: 'Large Cap Tech', theme: 'Nasdaq 100' },
    'TQQQ': { sector: 'Technology', industry: 'Large Cap Tech', theme: 'Nasdaq 100 3x' },
    'IGV': { sector: 'Technology', industry: 'Software', theme: 'Software' },
    'WCLD': { sector: 'Technology', industry: 'Software', theme: 'Cloud Software' },
    'SKYY': { sector: 'Technology', industry: 'Software', theme: 'Cloud Computing' },
    'CLOU': { sector: 'Technology', industry: 'Software', theme: 'Cloud Computing' },
    // Broad Market
    'SPY': { sector: 'Broad Market', industry: 'Large Cap', theme: 'S&P 500' },
    'IWM': { sector: 'Broad Market', industry: 'Small Cap', theme: 'Russell 2000' },
    'VTI': { sector: 'Broad Market', industry: 'Total Market', theme: 'Total US Market' },
    // Financials
    'KRE': { sector: 'Financials', industry: 'Regional Banks', theme: 'Regional Banks' },
    'XLF': { sector: 'Financials', industry: 'Financial Services', theme: 'Financials' },
    // Small Cap
    'PSCC': { sector: 'Consumer', industry: 'Small Cap Consumer', theme: 'Small Cap Consumer Staples' },
    // Country/Region
    'EWY': { sector: 'Regional', industry: 'South Korea', theme: 'South Korea' },
    'EWJ': { sector: 'Regional', industry: 'Japan', theme: 'Japan' },
    'EEM': { sector: 'Regional', industry: 'Emerging Markets', theme: 'Emerging Markets' },
    'FXI': { sector: 'Regional', industry: 'China', theme: 'China Large Cap' },
    'EWT': { sector: 'Regional', industry: 'Taiwan', theme: 'Taiwan' },
  };
  
  // Known semiconductor stocks (often miscategorized by Yahoo)
  const semicapStocks = {
    // Semicap equipment
    'ASML': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'AMAT': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'LRCX': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'KLAC': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'CAMT': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'ACLS': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'ONTO': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'FORM': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'UCTT': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'KLIC': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'COHU': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    // European semicap
    'BESI.AS': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    'ASM.AS': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' },
    // Japanese semicap
    '6857.T': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' }, // Advantest
    '8035.T': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' }, // Tokyo Electron
    '6146.T': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' }, // Disco
    '6525.T': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' }, // Kokusai Electric
    '7735.T': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Semicap Equipment' }, // Screen Holdings
    // Chip makers
    'TSM': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Foundry' },
    'NVDA': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Fabless' },
    'AMD': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Fabless' },
    'INTC': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'IDM' },
    'AVGO': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Fabless' },
    'QCOM': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Fabless' },
    'MU': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Memory' },
    'MRVL': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Fabless' },
    // Korean semis
    '005930.KS': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'IDM' }, // Samsung
    '000660.KS': { sector: 'Technology', industry: 'Semiconductors', subIndustry: 'Memory' }, // SK Hynix
  };
  
  // Known tech/software stocks
  const softwareStocks = {
    'META': { sector: 'Technology', industry: 'Software', subIndustry: 'Social Media' },
    'GOOGL': { sector: 'Technology', industry: 'Software', subIndustry: 'Internet' },
    'GOOG': { sector: 'Technology', industry: 'Software', subIndustry: 'Internet' },
    'MSFT': { sector: 'Technology', industry: 'Software', subIndustry: 'Enterprise Software' },
    'CRM': { sector: 'Technology', industry: 'Software', subIndustry: 'Enterprise Software' },
    'NOW': { sector: 'Technology', industry: 'Software', subIndustry: 'Enterprise Software' },
    'ADBE': { sector: 'Technology', industry: 'Software', subIndustry: 'Creative Software' },
    'ORCL': { sector: 'Technology', industry: 'Software', subIndustry: 'Enterprise Software' },
    'SNOW': { sector: 'Technology', industry: 'Software', subIndustry: 'Cloud Data' },
    'PLTR': { sector: 'Technology', industry: 'Software', subIndustry: 'Data Analytics' },
    'DDOG': { sector: 'Technology', industry: 'Software', subIndustry: 'Cloud Software' },
    'NET': { sector: 'Technology', industry: 'Software', subIndustry: 'Cloud Infrastructure' },
    'CRWD': { sector: 'Technology', industry: 'Software', subIndustry: 'Cybersecurity' },
    'ZS': { sector: 'Technology', industry: 'Software', subIndustry: 'Cybersecurity' },
    'PANW': { sector: 'Technology', industry: 'Software', subIndustry: 'Cybersecurity' },
  };
  
  // Fintech/payments
  const fintechStocks = {
    'DAVE': { sector: 'Financials', industry: 'Fintech', subIndustry: 'Neobank' },
    'SOFI': { sector: 'Financials', industry: 'Fintech', subIndustry: 'Neobank' },
    'AFRM': { sector: 'Financials', industry: 'Fintech', subIndustry: 'BNPL' },
    'SQ': { sector: 'Financials', industry: 'Fintech', subIndustry: 'Payments' },
    'PYPL': { sector: 'Financials', industry: 'Fintech', subIndustry: 'Payments' },
    'V': { sector: 'Financials', industry: 'Fintech', subIndustry: 'Payments' },
    'MA': { sector: 'Financials', industry: 'Fintech', subIndustry: 'Payments' },
  };
  
  // Pharma/biotech
  const pharmaStocks = {
    'RPRX': { sector: 'Healthcare', industry: 'Pharma Royalties', subIndustry: 'Royalties' },
  };
  
  // Check ETF mappings first
  if (etfMappings[sym]) {
    return etfMappings[sym];
  }
  
  // Check known stock mappings
  if (semicapStocks[sym]) {
    return semicapStocks[sym];
  }
  if (softwareStocks[sym]) {
    return softwareStocks[sym];
  }
  if (fintechStocks[sym]) {
    return fintechStocks[sym];
  }
  if (pharmaStocks[sym]) {
    return pharmaStocks[sym];
  }
  
  // Try to infer from name
  if (n.includes('semiconductor') || n.includes('chip') || n.includes('semicap')) {
    return { sector: 'Technology', industry: 'Semiconductors', theme: 'Semiconductors' };
  }
  if (n.includes('gold') || n.includes('mining') || n.includes('miner')) {
    return { sector: 'Materials', industry: 'Gold Mining', theme: 'Gold/Mining' };
  }
  if (n.includes('software') || n.includes('cloud')) {
    return { sector: 'Technology', industry: 'Software', theme: 'Software/Cloud' };
  }
  if (n.includes('bank') || n.includes('financial')) {
    return { sector: 'Financials', industry: 'Banks', theme: 'Financials' };
  }
  if (n.includes('tech')) {
    return { sector: 'Technology', industry: 'Technology', theme: 'Technology' };
  }
  
  return null;
};

// ============================================
// RETURNS CALCULATION
// ============================================

/**
 * Calculate calendar year returns from price data
 * @param {Array<{date: Date, close: number}>} prices - Price history
 * @returns {Object.<string, number>} Year-to-return mapping
 */
export const getCalendarYearReturns = (prices) => {
  if (!prices || prices.length === 0) return {};
  
  // Group prices by year
  const pricesByYear = {};
  prices.forEach(p => {
    if (p.date && p.close != null) {
      const year = p.date.getFullYear();
      if (!pricesByYear[year]) {
        pricesByYear[year] = [];
      }
      pricesByYear[year].push({ date: p.date, close: p.close });
    }
  });
  
  // Calculate return for each year
  const yearlyReturns = {};
  Object.keys(pricesByYear).forEach(year => {
    const yearPrices = pricesByYear[year].sort((a, b) => a.date - b.date);
    if (yearPrices.length >= 2) {
      const firstPrice = yearPrices[0].close;
      const lastPrice = yearPrices[yearPrices.length - 1].close;
      yearlyReturns[year] = (lastPrice - firstPrice) / firstPrice;
    }
  });
  
  return yearlyReturns;
};

/**
 * Compute daily returns from price history
 * @param {Array<{close: number}>} prices - Array of price objects with close prices
 * @returns {number[]} Array of daily returns
 */
export const computeDailyReturns = (prices) => {
  if (!prices || prices.length < 2) return [];
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i].close > 0 && prices[i-1].close > 0) {
      returns.push((prices[i].close - prices[i-1].close) / prices[i-1].close);
    }
  }
  return returns;
};

/**
 * Compute beta and correlation vs market (SPY) with proper date alignment
 * For international stocks, tests multiple lags to find best alignment
 * 
 * @param {number[]} returns - Position daily returns
 * @param {number[]} spyReturns - SPY daily returns
 * @param {number[]|null} timestamps - Position timestamps for date alignment
 * @param {number[]|null} spyTimestamps - SPY timestamps for date alignment
 * @param {boolean} isInternational - Whether position is international (enables lag testing)
 * @returns {{beta: number|null, correlation: number|null, lag: number}}
 */
export const computeBetaAndCorrelation = (returns, spyReturns, timestamps = null, spyTimestamps = null, isInternational = false) => {
  if (!returns || !spyReturns || returns.length < 30 || spyReturns.length < 30) {
    return { beta: null, correlation: null, lag: 0 };
  }
  
  // Helper to compute beta/correlation from aligned arrays
  const computeFromAligned = (alignedPos, alignedSpy) => {
    const n = alignedPos.length;
    if (n < 30) return { beta: null, correlation: null };
    
    const posMean = alignedPos.reduce((a, b) => a + b, 0) / n;
    const spyMean = alignedSpy.reduce((a, b) => a + b, 0) / n;
    
    const posVar = alignedPos.reduce((sum, r) => sum + (r - posMean) ** 2, 0) / n;
    const spyVar = alignedSpy.reduce((sum, r) => sum + (r - spyMean) ** 2, 0) / n;
    
    let covariance = 0;
    for (let i = 0; i < n; i++) {
      covariance += (alignedPos[i] - posMean) * (alignedSpy[i] - spyMean);
    }
    covariance /= n;
    
    const beta = spyVar > 0 ? covariance / spyVar : 0;
    const posStd = Math.sqrt(posVar);
    const spyStd = Math.sqrt(spyVar);
    const correlation = posStd > 0 && spyStd > 0 ? covariance / (posStd * spyStd) : 0;
    
    return {
      beta: Math.round(beta * 100) / 100,
      correlation: Math.round(correlation * 100) / 100,
    };
  };
  
  // Helper to align returns by date with optional lag
  const alignByDate = (posReturns, posTs, spyReturns, spyTs, lag = 0) => {
    if (!posTs?.length || !spyTs?.length) {
      return { posAligned: [], spyAligned: [] };
    }
    
    // Build date map for SPY (date string -> return)
    const spyByDate = new Map();
    for (let i = 0; i < spyReturns.length && i < spyTs.length; i++) {
      const ts = spyTs[i];
      const dateKey = ts instanceof Date 
        ? ts.toISOString().slice(0, 10)
        : new Date(ts).toISOString().slice(0, 10);
      spyByDate.set(dateKey, spyReturns[i]);
    }
    
    const posAligned = [];
    const spyAligned = [];
    
    for (let i = 0; i < posReturns.length && i < posTs.length; i++) {
      const ts = posTs[i];
      const posDate = ts instanceof Date ? ts : new Date(ts);
      let targetDate = new Date(posDate);
      
      if (lag === -1) {
        // Position reacts to PRIOR day's SPY return (Asia/Europe see US close from day before)
        targetDate.setDate(targetDate.getDate() - 1);
      } else if (lag === 1) {
        // Position leads SPY by 1 day
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      const targetKey = targetDate.toISOString().slice(0, 10);
      const spyReturn = spyByDate.get(targetKey);
      
      if (spyReturn !== undefined) {
        posAligned.push(posReturns[i]);
        spyAligned.push(spyReturn);
      }
    }
    
    return { posAligned, spyAligned };
  };
  
  // If we have timestamps and it's an international stock, use date alignment with lag testing
  if (timestamps && spyTimestamps && isInternational) {
    const lags = [-1, 0, 1];
    let bestResult = { beta: null, correlation: null, lag: 0, matchedDates: 0 };
    let bestAbsCorr = -1;
    
    for (const lag of lags) {
      const { posAligned, spyAligned } = alignByDate(returns, timestamps, spyReturns, spyTimestamps, lag);
      
      if (posAligned.length >= 30) {
        const result = computeFromAligned(posAligned, spyAligned);
        const absCorr = Math.abs(result.correlation || 0);
        
        // Pick the lag with highest absolute correlation (strongest signal)
        if (absCorr > bestAbsCorr) {
          bestAbsCorr = absCorr;
          bestResult = { ...result, lag, matchedDates: posAligned.length };
        }
      }
    }
    
    if (bestResult.beta !== null) {
      return bestResult;
    }
  }
  
  // For US stocks or if date alignment fails, use simple index alignment
  const minLen = Math.min(returns.length, spyReturns.length);
  const alignedPos = returns.slice(-minLen);
  const alignedSpy = spyReturns.slice(-minLen);
  
  return { ...computeFromAligned(alignedPos, alignedSpy), lag: 0 };
};

/**
 * Compute YTD and 1Y returns from prices
 * @param {Array<{date: Date, close: number}>} prices - Price history
 * @returns {{ytdReturn: number|null, oneYearReturn: number|null}}
 */
export const computeReturns = (prices) => {
  if (!prices || prices.length < 2) return { ytdReturn: null, oneYearReturn: null };
  
  const now = new Date();
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  
  // Find prices for YTD
  const ytdPrices = prices.filter(p => p.date >= ytdStart);
  const ytdReturn = ytdPrices.length >= 2
    ? (ytdPrices[ytdPrices.length - 1].close - ytdPrices[0].close) / ytdPrices[0].close
    : null;
  
  // Find prices for 1Y
  const oneYearPrices = prices.filter(p => p.date >= oneYearAgo);
  const oneYearReturn = oneYearPrices.length >= 200
    ? (oneYearPrices[oneYearPrices.length - 1].close - oneYearPrices[0].close) / oneYearPrices[0].close
    : null;
  
  return { ytdReturn, oneYearReturn };
};

/**
 * Compute annualized volatility from daily returns
 * @param {number[]} returns - Array of daily returns
 * @returns {number|null} Annualized volatility as percentage
 */
export const computeVolatility = (returns) => {
  if (!returns || returns.length < 20) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance * 252) * 100; // Annualized, as percentage
};

/**
 * Bootstrap annual return distribution from daily returns
 * @param {number[]} dailyReturns - Array of daily log returns
 * @param {number} numSamples - Number of bootstrap samples (default 1000)
 * @returns {{p5: number, p25: number, p50: number, p75: number, p95: number}|null}
 */
export const bootstrapAnnualReturns = (dailyReturns, numSamples = 1000) => {
  if (!dailyReturns || dailyReturns.length < 50) return null;
  
  const tradingDaysPerYear = 252;
  const annualReturns = [];
  
  for (let i = 0; i < numSamples; i++) {
    let cumReturn = 0;
    for (let d = 0; d < tradingDaysPerYear; d++) {
      const randomIdx = Math.floor(Math.random() * dailyReturns.length);
      cumReturn += dailyReturns[randomIdx];
    }
    annualReturns.push(Math.exp(cumReturn) - 1);
  }
  
  annualReturns.sort((a, b) => a - b);
  
  const getPercentile = (arr, p) => {
    const idx = Math.floor(p * arr.length);
    return arr[Math.min(idx, arr.length - 1)];
  };
  
  return {
    p5: Math.max(-1, getPercentile(annualReturns, 0.05)),
    p25: Math.max(-1, getPercentile(annualReturns, 0.25)),
    p50: Math.max(-1, getPercentile(annualReturns, 0.50)),
    p75: Math.max(-1, getPercentile(annualReturns, 0.75)),
    p95: Math.max(-1, getPercentile(annualReturns, 0.95)),
  };
};

// ============================================
// DATA PROCESSING
// ============================================

/**
 * Process raw Yahoo history into unified data format
 * Computes all metrics but prepares slim version for storage
 * 
 * @param {string} ticker - Ticker symbol
 * @param {Array<{date: Date, close: number}>} history - Price history
 * @param {Object} profile - Company profile (sector, industry, etc.)
 * @param {Object|number[]} spyData - SPY returns data (either array or {returns, timestamps})
 * @param {string} currency - Currency code (default 'USD')
 * @param {number} exchangeRate - Exchange rate to USD (default 1)
 * @returns {Object} Processed ticker data
 */
export const processTickerData = (ticker, history, profile, spyData, currency = 'USD', exchangeRate = 1) => {
  if (!history || history.length < 10) {
    return { ticker, error: 'Insufficient data' };
  }
  
  const closePrices = history.map(h => h.close);
  const timestamps = history.map(h => h.date?.getTime?.() || h.date);
  const dailyReturns = computeDailyReturns(history);
  
  // Detect if international: non-USD currency OR ticker has numbers (Japanese style) OR known international exchanges
  const isInternational = currency !== 'USD' || 
    /^\d+$/.test(ticker) ||  // Pure numeric tickers (Japan: 6525, 7203)
    /^\d+\.(T|HK|SS|SZ|TW)$/.test(ticker) ||  // Exchange suffixes
    /\.(AS|PA|DE|L|MI|MC|SW|AX|TO|V)$/.test(ticker);  // European/other exchanges
  
  // Get SPY returns and timestamps (handle both old format and new format)
  const spyReturns = Array.isArray(spyData) ? spyData : (spyData?.returns || []);
  const spyTimestamps = Array.isArray(spyData) ? null : (spyData?.timestamps || null);
  
  const { beta, correlation, lag } = ticker === 'SPY' 
    ? { beta: 1.0, correlation: 1.0, lag: 0 }
    : computeBetaAndCorrelation(dailyReturns, spyReturns, timestamps, spyTimestamps, isInternational);
  
  // Log international stock beta calculation details
  if (isInternational && beta !== null) {
    console.log(`📊 ${ticker} (${currency}): Beta=${beta?.toFixed(2)}, Corr=${correlation?.toFixed(2)}, Lag=${lag}`);
  }
  
  const { ytdReturn, oneYearReturn } = computeReturns(history);
  const calendarYearReturns = getCalendarYearReturns(history);
  const volatility = computeVolatility(dailyReturns);
  
  // Get domestic (local currency) price
  const domesticPrice = closePrices[closePrices.length - 1];
  // Convert to USD
  const usdPrice = domesticPrice * exchangeRate;
  
  return {
    ticker,
    // Minimal storage - these are what we persist
    closePrices,      // Just close prices, not full OHLCV (in local currency)
    timestamps,       // For date-based calculations
    dailyReturns,     // Needed for correlations
    
    // Current price info
    currentPrice: usdPrice,      // USD price for portfolio value
    domesticPrice: domesticPrice, // Local currency price
    currency,                     // Currency code (USD, EUR, JPY, etc.)
    exchangeRate,                 // Exchange rate used (currency to USD)
    sparkline: closePrices.slice(-30),
    
    // Pre-computed returns (small, keep them)
    ytdReturn,
    oneYearReturn,
    calendarYearReturns,
    
    // Risk metrics (small, keep them)
    beta,
    correlation,
    volatility,
    betaLag: isInternational ? lag : undefined, // Track lag used for international stocks
    
    // Profile info
    name: profile?.longName || profile?.shortName || ticker,
    sector: profile?.sector || null,
    industry: profile?.industry || null,
    type: profile?.quoteType === 'ETF' ? 'ETF' : 'Equity',
    isInternational,
    
    // Metadata
    fetchedAt: Date.now(),
  };
};

/**
 * Rehydrate ticker data after loading from cache (compute derived fields)
 * @param {Object} data - Cached ticker data
 * @param {Object} spyData - SPY data for beta computation
 * @returns {Object} Rehydrated ticker data
 */
export const rehydrateTickerData = (data, spyData) => {
  if (!data || data.error || !data.closePrices) return data;
  
  // If already has dailyReturns, just compute missing fields
  if (!data.dailyReturns && data.closePrices?.length > 1) {
    data.dailyReturns = [];
    for (let i = 1; i < data.closePrices.length; i++) {
      if (data.closePrices[i] > 0 && data.closePrices[i-1] > 0) {
        data.dailyReturns.push((data.closePrices[i] - data.closePrices[i-1]) / data.closePrices[i-1]);
      }
    }
  }
  
  // Compute logReturns on demand (for distribution bootstrap)
  if (!data.logReturns && data.closePrices?.length > 1) {
    data.logReturns = [];
    for (let i = 1; i < data.closePrices.length; i++) {
      if (data.closePrices[i] > 0 && data.closePrices[i-1] > 0) {
        data.logReturns.push(Math.log(data.closePrices[i] / data.closePrices[i-1]));
      }
    }
  }
  
  // Compute distribution on demand (expensive, only if needed)
  if (!data.distribution && data.logReturns?.length > 50) {
    data.distribution = bootstrapAnnualReturns(data.logReturns);
  }
  
  // Recompute beta if missing and we have SPY data (with date alignment for international stocks)
  if (data.beta == null && spyData?.dailyReturns && data.dailyReturns) {
    // Detect if international based on cached currency or ticker format
    const isInternational = (data.currency && data.currency !== 'USD') || 
      /^\d+$/.test(data.ticker) ||
      /^\d+\.(T|HK|SS|SZ|TW)$/.test(data.ticker) ||
      /\.(AS|PA|DE|L|MI|MC|SW|AX|TO|V)$/.test(data.ticker) ||
      data.isInternational;
    
    // Get timestamps for alignment
    const posTimestamps = data.timestamps?.slice(1) || null; // slice(1) to align with dailyReturns
    const spyTimestamps = spyData?.timestamps || null;
    
    const result = data.ticker === 'SPY' 
      ? { beta: 1.0, correlation: 1.0, lag: 0 }
      : computeBetaAndCorrelation(data.dailyReturns, spyData.dailyReturns, posTimestamps, spyTimestamps, isInternational);
    
    data.beta = result.beta;
    data.correlation = result.correlation;
    if (isInternational) {
      data.betaLag = result.lag;
    }
  }
  
  // Ensure sparkline exists
  if (!data.sparkline && data.closePrices) {
    data.sparkline = data.closePrices.slice(-30);
  }
  
  // Ensure currentPrice exists
  if (!data.currentPrice && data.closePrices?.length > 0) {
    data.currentPrice = data.closePrices[data.closePrices.length - 1];
  }
  
  return data;
};

/**
 * Prepare ticker data for storage (strip large recomputable fields)
 * @param {Object} data - Full ticker data
 * @returns {Object} Slimmed data for storage
 */
export const prepareForStorage = (data) => {
  if (!data || data.error) return data;

  // Return only essential fields for storage
  return {
    ticker: data.ticker,
    closePrices: data.closePrices,
    timestamps: data.timestamps,
    dailyReturns: data.dailyReturns, // Keep for correlation computation
    currentPrice: data.currentPrice,
    sparkline: data.sparkline,
    ytdReturn: data.ytdReturn,
    oneYearReturn: data.oneYearReturn,
    calendarYearReturns: data.calendarYearReturns,
    beta: data.beta,
    correlation: data.correlation,
    volatility: data.volatility,
    name: data.name,
    sector: data.sector,
    industry: data.industry,
    type: data.type,
    fetchedAt: data.fetchedAt,
    // Currency info - needed for international stocks
    currency: data.currency,
    exchangeRate: data.exchangeRate,
    domesticPrice: data.domesticPrice,
    isInternational: data.isInternational,
    betaLag: data.betaLag,
    // Explicitly NOT storing: history, prices, logReturns, distribution
  };
};
