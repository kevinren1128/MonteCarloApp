/**
 * Financial Modeling Prep (FMP) Service
 *
 * @module services/fmpService
 * @description API integration for fetching analyst estimates and financial data
 * Uses the stable API endpoint with header-based authentication.
 */

const BASE_URL = 'https://financialmodelingprep.com/stable';
const STORAGE_KEY = 'monte-carlo-fmp-api-key';

// Hard-coded API key for personal use
const HARDCODED_API_KEY = 'Cbi6bOmaPoRO90xUCTRTR5k2WNffrfdK';

// Cache for ETF list to avoid repeated API calls
let etfListCache = null;
let etfListCacheTime = 0;
const ETF_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get API key - uses hardcoded key, environment variable, or localStorage
 */
export const getApiKey = () => {
  // Use hardcoded key first
  if (HARDCODED_API_KEY) return HARDCODED_API_KEY;

  // Check environment variable (Vite format)
  const envKey = import.meta.env?.VITE_FMP_API_KEY;
  if (envKey) return envKey;

  // Fall back to localStorage
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

/**
 * Save API key to localStorage
 */
export const saveApiKey = (key) => {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch (err) {
    console.warn('Failed to save FMP API key:', err);
  }
};

/**
 * Clear API key from localStorage
 */
export const clearApiKey = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear FMP API key:', err);
  }
};

/**
 * Make authenticated API request to FMP stable API
 * Tries direct request first (with header auth), falls back to query param
 */
const fetchFMP = async (endpoint, apiKey, timeout = 15000) => {
  const url = `${BASE_URL}${endpoint}`;
  const urlWithKey = `${url}${endpoint.includes('?') ? '&' : '?'}apikey=${apiKey}`;

  console.log('[FMP] Fetching:', endpoint);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Try direct request with API key in query string
    const response = await fetch(urlWithKey, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data) {
        // Check for FMP error responses
        if (data['Error Message']) {
          throw new Error(data['Error Message']);
        }
        console.log('[FMP] Response for', endpoint, ':', Array.isArray(data) ? `${data.length} items` : 'object');
        return data;
      }
    }

    // Log error details
    const errorText = await response.text().catch(() => 'No error body');
    console.error('[FMP] Request failed:', response.status, errorText);
    throw new Error(`FMP API error: ${response.status}`);
  } catch (e) {
    clearTimeout(timeoutId);
    console.error('[FMP] Fetch error for', endpoint, ':', e.message);
    throw e;
  }
};

/**
 * Extract fiscal year from date string (e.g., "2025-12-31" -> 2025)
 */
const extractFiscalYear = (dateStr) => {
  if (!dateStr) return null;
  const year = parseInt(dateStr.substring(0, 4), 10);
  return isNaN(year) ? null : year;
};

// Cache for exchange rates (refreshed once per session)
const exchangeRateCache = {};

/**
 * Fetch exchange rate from a currency to USD
 * @param {string} fromCurrency - Source currency code (e.g., 'EUR', 'GBP')
 * @param {string} apiKey - FMP API key
 * @returns {Promise<number>} Exchange rate to USD (multiply by this to get USD)
 */
const fetchExchangeRate = async (fromCurrency, apiKey) => {
  if (!fromCurrency || fromCurrency === 'USD') return 1;

  const cacheKey = `${fromCurrency}_USD`;
  if (exchangeRateCache[cacheKey]) {
    return exchangeRateCache[cacheKey];
  }

  try {
    // FMP forex endpoint: /fx/{pair}
    const pair = `${fromCurrency}USD`;
    const data = await fetchFMP(`/fx/${pair}`, apiKey);

    if (data && data[0]?.price) {
      const rate = data[0].price;
      exchangeRateCache[cacheKey] = rate;
      console.log(`[FMP] Exchange rate ${fromCurrency} -> USD:`, rate);
      return rate;
    }

    // Fallback: try quote endpoint for forex pair
    const quoteData = await fetchFMP(`/quote/${pair}`, apiKey);
    if (quoteData && quoteData[0]?.price) {
      const rate = quoteData[0].price;
      exchangeRateCache[cacheKey] = rate;
      console.log(`[FMP] Exchange rate (quote) ${fromCurrency} -> USD:`, rate);
      return rate;
    }

    // Fallback 2: try v3 forex endpoint
    const v3Url = `https://financialmodelingprep.com/api/v3/fx/${pair}?apikey=${apiKey}`;
    const v3Response = await fetch(v3Url);
    if (v3Response.ok) {
      const v3Data = await v3Response.json();
      if (v3Data && v3Data[0]?.bid) {
        const rate = v3Data[0].bid;
        exchangeRateCache[cacheKey] = rate;
        console.log(`[FMP] Exchange rate (v3) ${fromCurrency} -> USD:`, rate);
        return rate;
      }
    }

    console.warn(`[FMP] Could not fetch exchange rate for ${fromCurrency}, using fallback`);
    // Use hardcoded fallback rates for common currencies
    const fallbackRates = {
      'TWD': 0.031,  // Taiwan Dollar
      'EUR': 1.08,   // Euro
      'GBP': 1.27,   // British Pound
      'JPY': 0.0067, // Japanese Yen
      'KRW': 0.00074, // Korean Won
      'CNY': 0.14,   // Chinese Yuan
      'HKD': 0.128,  // Hong Kong Dollar
      'CHF': 1.13,   // Swiss Franc
      'AUD': 0.65,   // Australian Dollar
      'CAD': 0.74,   // Canadian Dollar
      'SEK': 0.095,  // Swedish Krona
      'DKK': 0.145,  // Danish Krone
      'NOK': 0.091,  // Norwegian Krone
      'INR': 0.012,  // Indian Rupee
      'BRL': 0.17,   // Brazilian Real
    };

    if (fallbackRates[fromCurrency]) {
      const rate = fallbackRates[fromCurrency];
      exchangeRateCache[cacheKey] = rate;
      console.log(`[FMP] Using fallback exchange rate for ${fromCurrency}:`, rate);
      return rate;
    }

    return 1; // Default to 1 if we can't get the rate
  } catch (err) {
    console.warn(`[FMP] Exchange rate fetch failed for ${fromCurrency}:`, err);
    return 1;
  }
};

/**
 * Convert a value from source currency to USD
 */
const convertToUSD = (value, exchangeRate) => {
  if (value === null || value === undefined || isNaN(value)) return value;
  if (!exchangeRate || exchangeRate === 1) return value;
  return value * exchangeRate;
};

/**
 * Fetch analyst estimates for a ticker
 * Returns forward revenue, EPS, EBIT, net income estimates
 * Note: FMP returns estimates for future fiscal years. Dates represent fiscal year end.
 */
export const fetchAnalystEstimates = async (ticker, apiKey) => {
  try {
    // Fetch more periods to get comprehensive forward estimates
    const data = await fetchFMP(`/analyst-estimates?symbol=${ticker}&period=annual&limit=5`, apiKey);

    if (!data || data.length === 0) {
      console.warn('[FMP] No analyst estimates data for', ticker);
      return null;
    }

    // Log all fields to understand data structure
    if (data[0]) {
      console.log('[FMP] Analyst estimates fields for', ticker, ':', Object.keys(data[0]));
    }

    // Get current date - but include estimates from the past 6 months
    // (to capture current FY that just ended but estimates are still relevant)
    // This ensures we catch FY25 even if it just ended (e.g., Dec 2025 fiscal year end)
    const today = new Date();
    const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
    const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];

    // Helper functions for field name variations
    const getRevenue = (obj) =>
      obj.estimatedRevenueAvg || obj.revenueAvg || obj.revenue ||
      obj.estimatedRevenueLow || obj.estimatedRevenueHigh || 0;

    const getEps = (obj) =>
      obj.estimatedEpsAvg || obj.epsAvg || obj.eps ||
      obj.estimatedEpsLow || obj.estimatedEpsHigh || 0;

    const getNetIncome = (obj) =>
      obj.estimatedNetIncomeAvg || obj.netIncomeAvg || obj.netIncome ||
      obj.estimatedNetIncomeLow || obj.estimatedNetIncomeHigh || 0;

    const getEbitda = (obj) =>
      obj.estimatedEbitdaAvg || obj.ebitdaAvg || obj.ebitda ||
      obj.estimatedEbitdaLow || obj.estimatedEbitdaHigh || 0;

    const getEbit = (obj) =>
      obj.estimatedEbitAvg || obj.ebitAvg || obj.ebit ||
      obj.estimatedEbitLow || obj.estimatedEbitHigh || 0;

    const getGrossProfit = (obj) =>
      obj.estimatedGrossProfitAvg || obj.grossProfitAvg || obj.grossProfit ||
      obj.estimatedGrossProfitLow || obj.estimatedGrossProfitHigh || null;

    // Filter to include estimates from recent past and future
    // (FY that just ended still has relevant forward estimates)
    const relevantEstimates = data.filter(d => d.date && d.date > cutoffDate);

    // If no relevant estimates, fall back to most recent data
    const estimatesToUse = relevantEstimates.length > 0 ? relevantEstimates : data;

    // Sort by date ASCENDING to get nearest future first
    const sortedData = [...estimatesToUse].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateA.localeCompare(dateB);
    });

    // Build FY data helper
    const buildFyData = (obj) => {
      const revenue = getRevenue(obj);
      const ebit = getEbit(obj);
      const ebitda = getEbitda(obj);
      const netIncome = getNetIncome(obj);
      const grossProfit = getGrossProfit(obj);

      return {
        date: obj.date,
        fiscalYear: extractFiscalYear(obj.date),
        revenue,
        grossProfit,
        ebit,
        ebitda,
        netIncome,
        eps: getEps(obj),
        // Calculated margins
        grossMargin: revenue && grossProfit ? grossProfit / revenue : null,
        ebitMargin: revenue ? ebit / revenue : null,
        ebitdaMargin: revenue ? ebitda / revenue : null,
        netMargin: revenue ? netIncome / revenue : null,
      };
    };

    // FY1 = nearest future fiscal year (first item after sorting ascending)
    // FY2 = next fiscal year after that (second item)
    const fy1Data = sortedData[0] || {};
    const fy2Data = sortedData[1] || sortedData[0] || {};
    const fy3Data = sortedData[2] || null;

    console.log('[FMP] Selected for', ticker, '- FY1:', fy1Data.date, '- FY2:', fy2Data.date);

    // Build complete forward estimates time series
    const forwardEstimates = sortedData.map(buildFyData);

    return {
      fy1: buildFyData(fy1Data),
      fy2: buildFyData(fy2Data),
      fy3: fy3Data ? buildFyData(fy3Data) : null,
      // Complete time series of all forward estimates
      forwardEstimates,
    };
  } catch (err) {
    console.warn(`Failed to fetch analyst estimates for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch the list of all ETFs (cached for 24 hours)
 * Used to pre-filter ETFs before making expensive API calls
 */
export const fetchEtfList = async (apiKey) => {
  // Return cached list if still valid
  if (etfListCache && Date.now() - etfListCacheTime < ETF_CACHE_DURATION) {
    return etfListCache;
  }

  try {
    const data = await fetchFMP('/etf-list', apiKey);

    if (data && Array.isArray(data)) {
      // Create a Set of ETF symbols for O(1) lookup
      etfListCache = new Set(data.map(etf => etf.symbol?.toUpperCase()));
      etfListCacheTime = Date.now();
      console.log(`[FMP] Cached ${etfListCache.size} ETF symbols`);
      return etfListCache;
    }
    return new Set();
  } catch (err) {
    console.warn('Failed to fetch ETF list:', err);
    return new Set();
  }
};

/**
 * Check if a ticker is an ETF
 */
export const isEtf = async (ticker, apiKey) => {
  const etfSet = await fetchEtfList(apiKey);
  return etfSet.has(ticker.toUpperCase());
};

/**
 * Fetch current quote data (price, market cap)
 */
export const fetchQuote = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/quote?symbol=${ticker}`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const quote = data[0];
    // Log all fields to understand what's available
    console.log('[FMP] Quote fields for', ticker, ':', Object.keys(quote));

    return {
      price: quote.price,
      marketCap: quote.marketCap,
      name: quote.name,
      exchange: quote.exchange,
      exchangeShortName: quote.exchangeShortName,
      changesPercentage: quote.changesPercentage,
      // Currency info if available
      currency: quote.currency,
      // Type info if available
      type: quote.type,
    };
  } catch (err) {
    console.warn(`Failed to fetch quote for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch enterprise value data
 */
export const fetchEnterpriseValue = async (ticker, apiKey) => {
  try {
    // Use query parameter format for stable API
    const data = await fetchFMP(`/enterprise-values?symbol=${ticker}&limit=1`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const ev = data[0];
    console.log('[FMP] Enterprise value raw data for', ticker, ':', ev);

    // FMP stable API field names (log shows actual structure)
    // Common field names: enterpriseValue, marketCapitalization, addTotalDebt, minusCashAndCashEquivalents
    // Also check for alternate naming conventions
    return {
      enterpriseValue: ev.enterpriseValue ?? ev.enterpriseVal ?? ev['Enterprise Value'] ?? null,
      marketCap: ev.marketCapitalization ?? ev.marketCap ?? ev['Market Cap'] ?? null,
      // FMP uses "addTotalDebt" (positive) and "minusCashAndCashEquivalents" (negative in EV calc)
      totalDebt: ev.addTotalDebt ?? ev.totalDebt ?? ev['Total Debt'] ?? null,
      cashAndEquivalents: ev.minusCashAndCashEquivalents ?? ev.cashAndCashEquivalents ?? ev['Cash'] ?? null,
      // Number of shares for per-share calculations
      numberOfShares: ev.numberOfShares ?? ev.sharesOutstanding ?? null,
    };
  } catch (err) {
    console.warn(`Failed to fetch enterprise value for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch key metrics (ratios, margins)
 * Uses v3 API for TTM metrics
 */
export const fetchKeyMetrics = async (ticker, apiKey) => {
  try {
    // Try v3 API for TTM key metrics
    const url = `https://financialmodelingprep.com/api/v3/key-metrics-ttm/${ticker}?apikey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      // Fallback to stable API
      const data = await fetchFMP(`/key-metrics?symbol=${ticker}&period=ttm`, apiKey);
      if (!data || data.length === 0) return null;
      const metrics = data[0];
      return {
        peRatio: metrics.peRatioTTM || metrics.peRatio,
        pbRatio: metrics.pbRatioTTM || metrics.pbRatio,
        evToEbitda: metrics.enterpriseValueOverEBITDATTM || metrics.enterpriseValueOverEBITDA,
        debtToEquity: metrics.debtToEquityTTM || metrics.debtToEquity,
        currentRatio: metrics.currentRatioTTM || metrics.currentRatio,
        quickRatio: metrics.quickRatioTTM || metrics.quickRatio,
        roe: metrics.roeTTM || metrics.roe,
        roa: metrics.roaTTM || metrics.roa,
        roic: metrics.roicTTM || metrics.roic,
      };
    }

    const data = await response.json();
    if (!data || data.length === 0) return null;

    const metrics = data[0];
    console.log('[FMP] Key metrics TTM fields for', ticker, ':', Object.keys(metrics));

    return {
      peRatio: metrics.peRatioTTM,
      pbRatio: metrics.priceToBookRatioTTM || metrics.pbRatioTTM,
      evToEbitda: metrics.enterpriseValueOverEBITDATTM,
      evToSales: metrics.evToSalesTTM,
      evToRevenue: metrics.evToSalesTTM,
      grossProfitMargin: metrics.grossProfitMarginTTM,
      operatingProfitMargin: metrics.operatingProfitMarginTTM,
      netProfitMargin: metrics.netProfitMarginTTM,
      revenuePerShare: metrics.revenuePerShareTTM,
      roe: metrics.roeTTM,
      roa: metrics.roaTTM,
      roic: metrics.roicTTM,
      debtToEquity: metrics.debtToEquityTTM,
      currentRatio: metrics.currentRatioTTM,
      quickRatio: metrics.quickRatioTTM,
      freeCashFlowYield: metrics.freeCashFlowYieldTTM,
      dividendYield: metrics.dividendYieldTTM || metrics.dividendYieldPercentageTTM,
      payoutRatio: metrics.payoutRatioTTM,
    };
  } catch (err) {
    console.warn(`Failed to fetch key metrics for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch financial ratios (profitability, liquidity, solvency)
 * Fetches both TTM and annual data for comprehensive coverage
 */
export const fetchFinancialRatios = async (ticker, apiKey) => {
  try {
    // Fetch both TTM and annual ratios for comprehensive data
    // TTM endpoint: /ratios-ttm?symbol=X (per FMP docs)
    // Annual endpoint: /ratios?symbol=X&period=annual
    const [ttmData, annualData] = await Promise.all([
      fetchFMP(`/ratios-ttm?symbol=${ticker}`, apiKey).catch((err) => {
        console.warn(`[FMP] TTM ratios failed for ${ticker}:`, err.message);
        return null;
      }),
      fetchFMP(`/ratios?symbol=${ticker}&period=annual&limit=3`, apiKey).catch(() => null),
    ]);

    const ttm = ttmData?.[0] || {};
    const annual = annualData || [];
    const latest = annual[0] || {};

    // Log all available ratio fields
    console.log('[FMP] TTM Ratios for', ticker, ':', Object.keys(ttm));
    console.log('[FMP] Annual Ratios for', ticker, ':', Object.keys(latest));

    // Calculate 3Y averages for key ratios
    const avg = (field) => {
      const values = annual.map(d => d[field]).filter(v => v != null && !isNaN(v));
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    return {
      // TTM values (preferred for current valuation)
      grossProfitMargin: ttm.grossProfitMarginTTM ?? latest.grossProfitMargin,
      operatingProfitMargin: ttm.operatingProfitMarginTTM ?? latest.operatingProfitMargin,
      netProfitMargin: ttm.netProfitMarginTTM ?? latest.netProfitMargin,
      returnOnEquity: ttm.returnOnEquityTTM ?? latest.returnOnEquity,
      returnOnAssets: ttm.returnOnAssetsTTM ?? latest.returnOnAssets,
      returnOnCapitalEmployed: ttm.returnOnCapitalEmployedTTM ?? latest.returnOnCapitalEmployed,
      debtRatio: ttm.debtRatioTTM ?? latest.debtRatio,
      // Valuation ratios - prioritize TTM for current market valuations
      priceToBookRatio: ttm.priceToBookRatioTTM ?? latest.priceToBookRatio ?? latest.priceBookValueRatio,
      priceEarningsRatio: ttm.priceEarningsRatioTTM ?? latest.priceEarningsRatio,
      priceToSalesRatio: ttm.priceToSalesRatioTTM ?? latest.priceToSalesRatio,
      priceToFreeCashFlowsRatio: ttm.priceToFreeCashFlowsRatioTTM ?? latest.priceToFreeCashFlowsRatio,
      priceToOperatingCashFlowsRatio: ttm.priceToOperatingCashFlowsRatioTTM ?? latest.priceToOperatingCashFlowsRatio,
      // Cash flow per share
      freeCashFlowPerShare: ttm.freeCashFlowPerShareTTM ?? latest.freeCashFlowPerShare,
      operatingCashFlowPerShare: ttm.operatingCashFlowPerShareTTM ?? latest.operatingCashFlowPerShare,
      // FCF Yield (inverse of P/FCF)
      freeCashFlowYield: ttm.priceToFreeCashFlowsRatioTTM
        ? 1 / ttm.priceToFreeCashFlowsRatioTTM
        : (latest.priceToFreeCashFlowsRatio ? 1 / latest.priceToFreeCashFlowsRatio : null),
      dividendYield: ttm.dividendYieldTTM ?? latest.dividendYield,
      debtEquityRatio: ttm.debtEquityRatioTTM ?? latest.debtEquityRatio,
      interestCoverage: ttm.interestCoverageTTM ?? latest.interestCoverage,
      currentRatio: ttm.currentRatioTTM ?? latest.currentRatio,
      quickRatio: ttm.quickRatioTTM ?? latest.quickRatio,
      cashRatio: ttm.cashRatioTTM ?? latest.cashRatio,
      assetTurnover: ttm.assetTurnoverTTM ?? latest.assetTurnover,
      inventoryTurnover: ttm.inventoryTurnoverTTM ?? latest.inventoryTurnover,
      receivablesTurnover: ttm.receivablesTurnoverTTM ?? latest.receivablesTurnover,
      payablesTurnover: ttm.payablesTurnoverTTM ?? latest.payablesTurnover,
      // EV/Sales from TTM
      enterpriseValueMultiple: ttm.enterpriseValueMultipleTTM ?? null,
      evToSales: ttm.evToSalesTTM ?? null,
      evToFreeCashFlow: ttm.evToFreeCashFlowTTM ?? null,
      // 3Y averages
      avgROE: avg('returnOnEquity'),
      avgROA: avg('returnOnAssets'),
      avgGrossMargin: avg('grossProfitMargin'),
      avgOperatingMargin: avg('operatingProfitMargin'),
      avgNetMargin: avg('netProfitMargin'),
    };
  } catch (err) {
    console.warn(`Failed to fetch financial ratios for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch financial scores (Altman Z-Score, Piotroski Score)
 * Uses v4 API as documented at financialmodelingprep.com
 */
export const fetchFinancialScores = async (ticker, apiKey) => {
  try {
    // Use v4 API for scores (per FMP documentation)
    const url = `https://financialmodelingprep.com/api/v4/score?symbol=${ticker}&apikey=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[FMP] Score endpoint returned ${response.status} for ${ticker}`);
      return null;
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      console.log('[FMP] No score data for', ticker);
      return null;
    }

    const score = data[0];
    console.log('[FMP] Score fields for', ticker, ':', Object.keys(score));

    return {
      altmanZScore: score.altmanZScore,
      piotroskiScore: score.piotroskiScore,
      workingCapital: score.workingCapital,
      totalAssets: score.totalAssets,
      retainedEarnings: score.retainedEarnings,
      ebit: score.ebit,
      marketCap: score.marketCap,
      totalLiabilities: score.totalLiabilities,
      revenue: score.revenue,
    };
  } catch (err) {
    console.warn(`Failed to fetch financial scores for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch income statement (latest + historical for time series)
 * Returns up to 5 years of annual data
 */
export const fetchIncomeStatement = async (ticker, apiKey) => {
  try {
    // Fetch 6 years of annual data for historical time series
    // (extra year to ensure we catch the most recently completed FY)
    const data = await fetchFMP(`/income-statement?symbol=${ticker}&period=annual&limit=6`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    // Log fields for debugging
    if (data[0]) {
      console.log('[FMP] Income statement fields for', ticker, ':', Object.keys(data[0]));
    }

    // Sort by date descending (most recent first)
    const sortedData = [...data].sort((a, b) => {
      const dateA = a.date || a.calendarYear || '';
      const dateB = b.date || b.calendarYear || '';
      return dateB.localeCompare(dateA);
    });

    // Latest (most recent fiscal year)
    const latest = sortedData[0];

    // Build historical time series array
    const historical = sortedData.map(d => {
      const year = d.calendarYear || (d.date ? parseInt(d.date.substring(0, 4)) : null);
      return {
        year,
        date: d.date,
        period: d.period || 'FY',
        revenue: d.revenue,
        grossProfit: d.grossProfit,
        grossMargin: d.grossProfitRatio || (d.revenue ? d.grossProfit / d.revenue : null),
        operatingIncome: d.operatingIncome,
        operatingMargin: d.operatingIncomeRatio || (d.revenue ? d.operatingIncome / d.revenue : null),
        ebitda: d.ebitda || (d.operatingIncome && d.depreciationAndAmortization
          ? d.operatingIncome + d.depreciationAndAmortization : null),
        netIncome: d.netIncome,
        netMargin: d.netIncomeRatio || (d.revenue ? d.netIncome / d.revenue : null),
        eps: d.eps || d.epsdiluted,
        weightedAvgShares: d.weightedAverageShsOutDil || d.weightedAverageShsOut,
      };
    });

    return {
      // Latest year data (for backwards compatibility)
      revenue: latest.revenue,
      grossProfit: latest.grossProfit,
      grossProfitRatio: latest.grossProfitRatio,
      operatingIncome: latest.operatingIncome,
      operatingIncomeRatio: latest.operatingIncomeRatio,
      netIncome: latest.netIncome,
      netIncomeRatio: latest.netIncomeRatio,
      // IMPORTANT: Capture reporting currency from financial statements
      // This is the actual currency the company reports in (e.g., TWD for TSM)
      reportedCurrency: latest.reportedCurrency ?? latest.currency ?? null,
      // Historical time series (up to 5 years)
      historical,
    };
  } catch (err) {
    console.warn(`Failed to fetch income statement for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch analyst price targets
 */
export const fetchPriceTargets = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/price-target-consensus?symbol=${ticker}`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const target = data[0];
    return {
      targetHigh: target.targetHigh,
      targetLow: target.targetLow,
      targetConsensus: target.targetConsensus,
      targetMedian: target.targetMedian,
    };
  } catch (err) {
    console.warn(`Failed to fetch price targets for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch analyst ratings consensus (buy/hold/sell)
 */
export const fetchAnalystRatings = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/grades-consensus?symbol=${ticker}`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const ratings = data[0];
    return {
      strongBuy: ratings.strongBuy || 0,
      buy: ratings.buy || 0,
      hold: ratings.hold || 0,
      sell: ratings.sell || 0,
      strongSell: ratings.strongSell || 0,
      consensus: ratings.consensus || null,
    };
  } catch (err) {
    console.warn(`Failed to fetch analyst ratings for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch historical financial growth rates
 */
export const fetchFinancialGrowth = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/financial-growth?symbol=${ticker}&limit=3`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    // Calculate average growth over available periods
    const avgGrowth = (field) => {
      const values = data.map(d => d[field]).filter(v => v != null && !isNaN(v));
      if (values.length === 0) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    return {
      revenueGrowth: avgGrowth('revenueGrowth'),
      netIncomeGrowth: avgGrowth('netIncomeGrowth'),
      epsgrowth: avgGrowth('epsgrowth'),
      ebitgrowth: avgGrowth('ebitgrowth'),
      operatingIncomeGrowth: avgGrowth('operatingIncomeGrowth'),
      grossProfitGrowth: avgGrowth('grossProfitGrowth'),
      periods: data.length,
    };
  } catch (err) {
    console.warn(`Failed to fetch financial growth for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch upcoming earnings date and recent surprises
 * Uses stable/earnings endpoint for both historical and upcoming earnings data
 * This is more reliable than the legacy v3 endpoints
 */
export const fetchEarningsCalendar = async (ticker, apiKey) => {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Use stable API - returns both historical and upcoming earnings for a specific symbol
    // Fields: symbol, date, epsActual, epsEstimated, revenueActual, revenueEstimated, lastUpdated
    const earningsData = await fetchFMP(`/earnings?symbol=${ticker}&limit=20`, apiKey);

    if (!earningsData || earningsData.length === 0) {
      console.log('[FMP] No earnings data for', ticker);
      return null;
    }

    // Log fields for debugging
    console.log('[FMP] Earnings fields for', ticker, ':', Object.keys(earningsData[0]));

    // Sort by date descending (most recent first)
    const sortedEarnings = [...earningsData].sort((a, b) =>
      (b.date || '').localeCompare(a.date || '')
    );

    // Find historical earnings (where epsActual is not null) for surprise calculation
    const historicalEarnings = sortedEarnings.filter(e =>
      e.epsActual != null && e.epsEstimated != null
    );

    // Calculate surprise percentages from last 4 quarters with actual results
    const recentWithActuals = historicalEarnings.slice(0, 4);
    const surprises = recentWithActuals
      .map(e => {
        const actual = e.epsActual;
        const estimated = e.epsEstimated;
        if (actual != null && estimated != null && estimated !== 0) {
          return (actual - estimated) / Math.abs(estimated);
        }
        return null;
      })
      .filter(s => s != null);

    const avgSurprise = surprises.length > 0
      ? surprises.reduce((a, b) => a + b, 0) / surprises.length
      : null;

    // Find next upcoming earnings (where epsActual is null and date >= today)
    const upcomingEarnings = sortedEarnings
      .filter(e => e.date && e.date >= todayStr && e.epsActual == null)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const nextEarnings = upcomingEarnings[0] || null;

    // Also check for very recent earnings (within last 7 days) if no future ones found
    // This catches earnings that just happened
    if (!nextEarnings) {
      const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const recentEarnings = sortedEarnings
        .filter(e => e.date && e.date >= sevenDaysAgo && e.date <= todayStr)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (recentEarnings.length > 0) {
        console.log('[FMP] Found recent earnings for', ticker, ':', recentEarnings[0].date);
      }
    }

    console.log(`[FMP] Earnings for ${ticker}: historical=${historicalEarnings.length}, surprises=${surprises.length}, avgSurprise=${avgSurprise?.toFixed(2) || 'none'}, next=${nextEarnings?.date || 'none'}`);

    return {
      nextEarningsDate: nextEarnings?.date || null,
      nextEpsEstimate: nextEarnings?.epsEstimated ?? null,
      nextRevenueEstimate: nextEarnings?.revenueEstimated ?? null,
      lastEps: recentWithActuals[0]?.epsActual ?? null,
      lastEpsEstimate: recentWithActuals[0]?.epsEstimated ?? null,
      lastSurprise: surprises[0] ?? null,
      avgSurprise,
      beatCount: surprises.filter(s => s > 0).length,
      missCount: surprises.filter(s => s < 0).length,
    };
  } catch (err) {
    console.warn(`Failed to fetch earnings for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch analyst estimate revisions (how estimates have changed over time)
 * @param {string} ticker - Ticker symbol
 * @param {string} apiKey - FMP API key
 * @returns {Promise<Object>} Revision data including trends
 */
export const fetchEstimateRevisions = async (ticker, apiKey) => {
  try {
    // Fetch analyst estimates history to see revisions
    const url = `https://financialmodelingprep.com/api/v3/analyst-estimates/${ticker}?period=annual&limit=8&apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data || data.length < 2) return null;

    // Sort by date descending (most recent first)
    const sorted = [...data].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Calculate revision trends (compare current estimate to previous)
    // For revenue and EPS, look at how estimates for the same fiscal year have changed
    const today = new Date().toISOString().split('T')[0];
    const futureEstimates = sorted.filter(d => d.date && d.date > today);

    if (futureEstimates.length < 1) return null;

    // Get the nearest fiscal year estimates
    const currentFY = futureEstimates[0];

    // Try to find historical estimates for the same fiscal year (revision tracking)
    // Note: FMP may not provide historical revision data, so we approximate
    const getRevenue = (obj) => obj.estimatedRevenueAvg || obj.revenueAvg || obj.revenue || 0;
    const getEps = (obj) => obj.estimatedEpsAvg || obj.epsAvg || obj.eps || 0;

    // Compare FY1 to FY2 to show expected trajectory
    const nextFY = futureEstimates[1];

    return {
      currentFYDate: currentFY.date,
      currentRevenue: getRevenue(currentFY),
      currentEps: getEps(currentFY),
      nextRevenue: nextFY ? getRevenue(nextFY) : null,
      nextEps: nextFY ? getEps(nextFY) : null,
      // Revision direction (positive = upward revision)
      // This is approximate - true revisions would need historical API calls
      revenueGrowth: nextFY ? (getRevenue(nextFY) - getRevenue(currentFY)) / getRevenue(currentFY) : null,
      epsGrowth: nextFY ? (getEps(nextFY) - getEps(currentFY)) / Math.abs(getEps(currentFY)) : null,
    };
  } catch (err) {
    console.warn(`Failed to fetch estimate revisions for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch cash flow statement for FCF data
 * @param {string} ticker - Ticker symbol
 * @param {string} apiKey - FMP API key
 * @returns {Promise<Object>} Cash flow data including FCF
 */
export const fetchCashFlowStatement = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/cash-flow-statement?symbol=${ticker}&period=annual&limit=5`, apiKey);

    if (!data || data.length === 0) return null;

    // Log fields for debugging
    if (data[0]) {
      console.log('[FMP] Cash flow fields for', ticker, ':', Object.keys(data[0]));
    }

    // Sort by date descending
    const sorted = [...data].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latest = sorted[0];

    // Build historical time series
    const historical = sorted.map(d => {
      const year = d.calendarYear || (d.date ? parseInt(d.date.substring(0, 4)) : null);
      const operatingCF = d.operatingCashFlow || 0;
      const capex = Math.abs(d.capitalExpenditure || 0);
      const fcf = d.freeCashFlow || (operatingCF - capex);
      const netIncome = d.netIncome || 0;

      return {
        year,
        date: d.date,
        operatingCashFlow: operatingCF,
        capitalExpenditure: d.capitalExpenditure,
        freeCashFlow: fcf,
        netIncome,
        // FCF conversion = FCF / Net Income (how much of earnings converts to cash)
        fcfConversion: netIncome !== 0 ? fcf / netIncome : null,
        // FCF margin = FCF / Revenue (need to get from income statement)
        dividendsPaid: d.dividendsPaid,
        stockRepurchases: d.commonStockRepurchased,
      };
    });

    return {
      freeCashFlow: latest.freeCashFlow,
      operatingCashFlow: latest.operatingCashFlow,
      capitalExpenditure: latest.capitalExpenditure,
      historical,
    };
  } catch (err) {
    console.warn(`Failed to fetch cash flow statement for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch balance sheet statement for debt and cash data
 * This provides more reliable capital structure data than enterprise-values endpoint
 * @param {string} ticker - Ticker symbol
 * @param {string} apiKey - FMP API key
 * @returns {Promise<Object>} Balance sheet data
 */
export const fetchBalanceSheet = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/balance-sheet-statement?symbol=${ticker}&period=annual&limit=1`, apiKey);

    if (!data || data.length === 0) return null;

    const bs = data[0];
    console.log('[FMP] Balance sheet fields for', ticker, ':', Object.keys(bs));

    // Calculate total debt (short-term + long-term)
    const shortTermDebt = bs.shortTermDebt || bs.shortTermBorrowings || 0;
    const longTermDebt = bs.longTermDebt || 0;
    const totalDebt = bs.totalDebt || (shortTermDebt + longTermDebt);

    // Cash and equivalents
    const cash = bs.cashAndCashEquivalents || bs.cashAndShortTermInvestments || 0;

    // Net debt = Total Debt - Cash
    const netDebt = totalDebt - cash;

    return {
      totalDebt,
      shortTermDebt,
      longTermDebt,
      cashAndCashEquivalents: cash,
      netDebt,
      totalAssets: bs.totalAssets || 0,
      totalLiabilities: bs.totalLiabilities || 0,
      totalEquity: bs.totalStockholdersEquity || bs.totalEquity || 0,
      reportedCurrency: bs.reportedCurrency || null,
      date: bs.date,
    };
  } catch (err) {
    console.warn(`Failed to fetch balance sheet for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch all consensus data for a single ticker (enhanced with 13 API calls)
 */
export const fetchConsensusData = async (ticker, apiKey) => {
  // Fetch all data in parallel (13 API calls per ticker)
  const [estimates, quote, ev, metrics, income, priceTargets, ratings, growth, earnings, ratios, scores, cashFlowStmt, balanceSheet] = await Promise.all([
    fetchAnalystEstimates(ticker, apiKey),
    fetchQuote(ticker, apiKey),
    fetchEnterpriseValue(ticker, apiKey),
    fetchKeyMetrics(ticker, apiKey),
    fetchIncomeStatement(ticker, apiKey),
    fetchPriceTargets(ticker, apiKey),
    fetchAnalystRatings(ticker, apiKey),
    fetchFinancialGrowth(ticker, apiKey),
    fetchEarningsCalendar(ticker, apiKey),
    fetchFinancialRatios(ticker, apiKey),
    fetchFinancialScores(ticker, apiKey),
    fetchCashFlowStatement(ticker, apiKey),
    fetchBalanceSheet(ticker, apiKey),
  ]);

  if (!estimates && !quote) {
    return null;
  }

  // Detect reporting currency from income statement (more reliable than quote for ADRs)
  // For ADRs like TSM: quote.currency = USD (trading currency) but income.reportedCurrency = TWD (reporting currency)
  // The analyst estimates are in the REPORTING currency, not the trading currency
  const reportingCurrency = income?.reportedCurrency || quote?.currency || 'USD';
  const tradingCurrency = quote?.currency || 'USD';

  // Get exchange rate for converting reporting currency values to USD
  const exchangeRate = reportingCurrency !== 'USD'
    ? await fetchExchangeRate(reportingCurrency, apiKey)
    : 1;

  // Helper to convert monetary values from reporting currency to USD
  const toUSD = (val) => convertToUSD(val, exchangeRate);

  if (reportingCurrency !== 'USD') {
    console.log(`[FMP] ${ticker}: Trading in ${tradingCurrency}, Reporting in ${reportingCurrency}, FX rate: ${exchangeRate}`);
  }

  // IMPORTANT: For ADRs, quote data (price, marketCap) is in TRADING currency (usually USD)
  // But financial statements (income, balance sheet) are in REPORTING currency (e.g., TWD for TSM)
  // So we should NOT convert quote data, only financial statement data

  // Quote data - already in trading currency (USD for ADRs)
  const price = quote?.price || 0;
  const marketCap = quote?.marketCap || 0;

  // Get debt and cash from balance sheet (in REPORTING currency, need to convert to USD)
  const totalDebt = toUSD(balanceSheet?.totalDebt) || toUSD(ev?.totalDebt) || 0;
  const cash = toUSD(balanceSheet?.cashAndCashEquivalents) || toUSD(ev?.cashAndEquivalents) || 0;

  console.log(`[FMP] ${ticker}: Quote currency=${tradingCurrency}, Reporting currency=${reportingCurrency}, FX=${exchangeRate}`);
  console.log(`[FMP] ${ticker}: Raw balanceSheet debt=${balanceSheet?.totalDebt}, cash=${balanceSheet?.cashAndCashEquivalents}`);

  // Calculate net debt directly from balance sheet: Total Debt - Cash
  // This is more reliable than EV - Market Cap which has currency mixing issues
  const netDebt = totalDebt - cash;

  // Calculate EV: Market Cap + Total Debt - Cash (all converted to USD)
  // Note: marketCap from quote is already in trading currency (usually USD for ADRs)
  // For proper EV, we should use the market cap in USD
  const calculatedEV = marketCap + netDebt;

  // Also try API's enterprise value for comparison
  const rawEV = ev?.enterpriseValue;
  let enterpriseValue;

  // Use calculated EV (more reliable with proper currency handling)
  // Only use API EV if calculated EV is zero or missing
  if (calculatedEV > 0) {
    enterpriseValue = calculatedEV;
    if (rawEV && Math.abs(rawEV - calculatedEV) / calculatedEV > 0.3) {
      console.log(`[FMP] ${ticker}: EV API=${(rawEV/1e9).toFixed(1)}B vs Calculated=${(calculatedEV/1e9).toFixed(1)}B (using calculated)`);
    }
  } else if (rawEV) {
    enterpriseValue = toUSD(rawEV);
    console.log(`[FMP] ${ticker}: Using API EV (calculated EV is zero)`);
  } else {
    enterpriseValue = marketCap; // Fallback: assume no net debt
  }

  console.log(`[FMP] ${ticker} Capital: MarketCap=${(marketCap/1e9).toFixed(1)}B, Debt=${(totalDebt/1e9).toFixed(1)}B, Cash=${(cash/1e9).toFixed(1)}B, NetDebt=${(netDebt/1e9).toFixed(1)}B, EV=${(enterpriseValue/1e9).toFixed(1)}B`);

  // FY1 calculations (convert to USD)
  const fy1Revenue = toUSD(estimates?.fy1?.revenue) || 0;
  const fy1Ebitda = toUSD(estimates?.fy1?.ebitda) || 0;
  const fy1Ebit = toUSD(estimates?.fy1?.ebit) || 0;
  const fy1NetIncome = toUSD(estimates?.fy1?.netIncome) || 0;
  const fy1Eps = toUSD(estimates?.fy1?.eps) || 0;

  // Use historical gross margin to estimate forward gross profit if not available
  const historicalGrossMargin = income?.grossProfitRatio || metrics?.grossProfitMargin || 0;
  const fy1GrossProfit = toUSD(estimates?.fy1?.grossProfit) || (fy1Revenue * historicalGrossMargin);

  // FY2 calculations (convert to USD)
  const fy2Revenue = toUSD(estimates?.fy2?.revenue) || 0;
  const fy2Ebitda = toUSD(estimates?.fy2?.ebitda) || 0;
  const fy2Ebit = toUSD(estimates?.fy2?.ebit) || 0;
  const fy2NetIncome = toUSD(estimates?.fy2?.netIncome) || 0;
  const fy2Eps = toUSD(estimates?.fy2?.eps) || 0;
  const fy2GrossProfit = toUSD(estimates?.fy2?.grossProfit) || (fy2Revenue * historicalGrossMargin);

  // FY0 (prior year) - get from most recent historical data before FY1
  const fy1FiscalYear = estimates?.fy1?.fiscalYear;

  // Sort historical by year descending and find the most recent year before FY1
  const sortedHistorical = [...(income?.historical || [])].sort((a, b) => (b.year || 0) - (a.year || 0));

  // Try exact match first (FY1 - 1), then fall back to most recent historical before FY1
  let priorYearData = sortedHistorical.find(h => h.year && h.year === fy1FiscalYear - 1);
  if (!priorYearData && fy1FiscalYear) {
    // Fall back to most recent historical year less than FY1
    priorYearData = sortedHistorical.find(h => h.year && h.year < fy1FiscalYear);
  }
  // If still no match, use the most recent historical data (for comparison purposes)
  if (!priorYearData && sortedHistorical.length > 0) {
    priorYearData = sortedHistorical[0];
  }

  // FY0 values (convert to USD)
  const fy0Revenue = toUSD(priorYearData?.revenue) || 0;
  const fy0Eps = toUSD(priorYearData?.eps) || 0;
  const fy0NetIncome = toUSD(priorYearData?.netIncome) || 0;
  const fy0FiscalYear = priorYearData?.year || (fy1FiscalYear ? fy1FiscalYear - 1 : null);

  console.log('[FMP] FY0/FY1 for', ticker, '- FY0 year:', fy0FiscalYear, 'rev:', fy0Revenue, '- FY1 year:', fy1FiscalYear, 'rev:', fy1Revenue, '- currency:', reportingCurrency);

  return {
    ticker,
    name: quote?.name || ticker,
    price,
    marketCap,
    enterpriseValue,
    changesPercentage: quote?.changesPercentage || 0,

    // FY1 estimates
    fy1: {
      fiscalYear: fy1FiscalYear,
      date: estimates?.fy1?.date,
      revenue: fy1Revenue,
      grossProfit: fy1GrossProfit,
      ebit: fy1Ebit,
      ebitda: fy1Ebitda,
      netIncome: fy1NetIncome,
      eps: fy1Eps,
      // Margins
      grossMargin: fy1Revenue ? fy1GrossProfit / fy1Revenue : 0,
      ebitMargin: fy1Revenue ? fy1Ebit / fy1Revenue : 0,
      netMargin: fy1Revenue ? fy1NetIncome / fy1Revenue : 0,
    },

    // FY2 estimates
    fy2: {
      date: estimates?.fy2?.date,
      revenue: fy2Revenue,
      grossProfit: fy2GrossProfit,
      ebit: fy2Ebit,
      ebitda: fy2Ebitda,
      netIncome: fy2NetIncome,
      eps: fy2Eps,
      // Margins
      grossMargin: fy2Revenue ? fy2GrossProfit / fy2Revenue : 0,
      ebitMargin: fy2Revenue ? fy2Ebit / fy2Revenue : 0,
      netMargin: fy2Revenue ? fy2NetIncome / fy2Revenue : 0,
    },

    // FY0 (prior fiscal year actuals) - for calculating YoY growth to FY1
    fy0: {
      fiscalYear: fy0FiscalYear,
      revenue: fy0Revenue,
      eps: fy0Eps,
      netIncome: fy0NetIncome,
    },

    // Forward valuation multiples (FY1 = current fiscal year, FY2 = next fiscal year)
    multiples: {
      // FY1 multiples
      fy1PE: fy1Eps ? price / fy1Eps : null,
      fy1EvToEbitda: fy1Ebitda ? enterpriseValue / fy1Ebitda : null,
      fy1EvToEbit: fy1Ebit ? enterpriseValue / fy1Ebit : null,
      fy1PriceToSales: fy1Revenue ? marketCap / fy1Revenue : null,
      fy1EvToSales: fy1Revenue ? enterpriseValue / fy1Revenue : null,
      // FY2 multiples (next year forward)
      fy2PE: fy2Eps ? price / fy2Eps : null,
      fy2EvToEbitda: fy2Ebitda ? enterpriseValue / fy2Ebitda : null,
      fy2EvToEbit: fy2Ebit ? enterpriseValue / fy2Ebit : null,
      fy2PriceToSales: fy2Revenue ? marketCap / fy2Revenue : null,
      fy2EvToSales: fy2Revenue ? enterpriseValue / fy2Revenue : null,
      // Legacy field names for backwards compatibility
      forwardPE: fy1Eps ? price / fy1Eps : null,
      evToEbitda: fy1Ebitda ? enterpriseValue / fy1Ebitda : null,
      evToEbit: fy1Ebit ? enterpriseValue / fy1Ebit : null,
      priceToSales: fy1Revenue ? marketCap / fy1Revenue : null,
    },

    // Historical metrics for reference
    historical: {
      grossMargin: metrics?.grossProfitMargin || income?.grossProfitRatio,
      operatingMargin: metrics?.operatingProfitMargin || income?.operatingIncomeRatio,
      netMargin: metrics?.netProfitMargin || income?.netIncomeRatio,
      peRatio: metrics?.peRatio,
      pbRatio: metrics?.pbRatio,
      evToEbitda: metrics?.evToEbitda,
    },

    // Profitability & Returns
    profitability: {
      roe: metrics?.roe || ratios?.returnOnEquity,
      roa: metrics?.roa || ratios?.returnOnAssets,
      roic: metrics?.roic || ratios?.returnOnCapitalEmployed,
      avgROE: ratios?.avgROE,
      avgROA: ratios?.avgROA,
      freeCashFlowYield: ratios?.freeCashFlowYield || metrics?.freeCashFlowYield,
    },

    // Balance Sheet Health
    health: {
      debtToEquity: metrics?.debtToEquity || ratios?.debtEquityRatio,
      currentRatio: metrics?.currentRatio || ratios?.currentRatio,
      quickRatio: metrics?.quickRatio || ratios?.quickRatio,
      interestCoverage: ratios?.interestCoverage,
      altmanZScore: scores?.altmanZScore,
      piotroskiScore: scores?.piotroskiScore,
    },

    // Cash Flow & Dividend
    cashFlow: {
      freeCashFlow: toUSD(cashFlowStmt?.freeCashFlow),
      freeCashFlowPerShare: toUSD(ratios?.freeCashFlowPerShare),
      operatingCashFlow: toUSD(cashFlowStmt?.operatingCashFlow),
      operatingCashFlowPerShare: toUSD(ratios?.operatingCashFlowPerShare),
      capitalExpenditure: toUSD(cashFlowStmt?.capitalExpenditure),
      // TTM Valuation ratios from ratios endpoint
      priceToFCF: ratios?.priceToFreeCashFlowsRatio,
      fcfYield: ratios?.freeCashFlowYield,
      evToSales: ratios?.evToSales,
      evToFreeCashFlow: ratios?.evToFreeCashFlow,
      priceToBook: ratios?.priceToBookRatio || metrics?.pbRatio,
      dividendYield: ratios?.dividendYield || metrics?.dividendYield,
      payoutRatio: metrics?.payoutRatio,
      // FCF conversion = FCF / Net Income (ratio, no conversion needed)
      fcfConversion: (cashFlowStmt?.freeCashFlow && income?.netIncome)
        ? cashFlowStmt.freeCashFlow / income.netIncome : null,
      // FCF margin = FCF / Revenue (ratio, no conversion needed)
      fcfMargin: (cashFlowStmt?.freeCashFlow && income?.revenue)
        ? cashFlowStmt.freeCashFlow / income.revenue : null,
      // Historical FCF data (converted to USD)
      historical: (cashFlowStmt?.historical || []).map(cf => ({
        ...cf,
        freeCashFlow: toUSD(cf.freeCashFlow),
        operatingCashFlow: toUSD(cf.operatingCashFlow),
        capitalExpenditure: toUSD(cf.capitalExpenditure),
        netIncome: toUSD(cf.netIncome),
        dividendsPaid: toUSD(cf.dividendsPaid),
        stockRepurchases: toUSD(cf.stockRepurchases),
      })),
    },

    // Balance sheet data for display (already converted to USD above)
    balanceSheet: {
      totalDebt: totalDebt,
      shortTermDebt: toUSD(balanceSheet?.shortTermDebt) || 0,
      longTermDebt: toUSD(balanceSheet?.longTermDebt) || 0,
      cashAndEquivalents: cash,
      netDebt: netDebt,
      totalAssets: toUSD(balanceSheet?.totalAssets) || 0,
      totalLiabilities: toUSD(balanceSheet?.totalLiabilities) || 0,
      totalEquity: toUSD(balanceSheet?.totalEquity) || 0,
    },

    // Efficiency
    efficiency: {
      assetTurnover: ratios?.assetTurnover,
      inventoryTurnover: ratios?.inventoryTurnover,
      receivablesTurnover: ratios?.receivablesTurnover,
    },

    // Analyst price targets (converted to USD)
    priceTargets: priceTargets ? {
      high: toUSD(priceTargets.targetHigh),
      low: toUSD(priceTargets.targetLow),
      consensus: toUSD(priceTargets.targetConsensus),
      median: toUSD(priceTargets.targetMedian),
      // Upside calculated from already-converted price and target
      upside: price ? (toUSD(priceTargets.targetConsensus) - price) / price : null,
    } : null,

    // Analyst ratings (buy/hold/sell)
    ratings: ratings ? {
      strongBuy: ratings.strongBuy,
      buy: ratings.buy,
      hold: ratings.hold,
      sell: ratings.sell,
      strongSell: ratings.strongSell,
      consensus: ratings.consensus,
      totalAnalysts: (ratings.strongBuy || 0) + (ratings.buy || 0) + (ratings.hold || 0) + (ratings.sell || 0) + (ratings.strongSell || 0),
    } : null,

    // Historical growth rates (3Y average)
    growth: growth ? {
      revenue: growth.revenueGrowth,
      eps: growth.epsgrowth,
      ebit: growth.ebitgrowth,
      netIncome: growth.netIncomeGrowth,
      periods: growth.periods,
    } : null,

    // Earnings calendar and surprises
    earnings: earnings ? {
      nextDate: earnings.nextEarningsDate,
      nextEpsEstimate: earnings.nextEpsEstimate,
      lastSurprise: earnings.lastSurprise,
      avgSurprise: earnings.avgSurprise,
      beatCount: earnings.beatCount,
      missCount: earnings.missCount,
    } : null,

    // Currency info
    currency: {
      reporting: reportingCurrency,  // Currency used in financial statements
      trading: tradingCurrency,      // Currency used for stock price (usually USD for ADRs)
      exchangeRate: exchangeRate,
      isConverted: reportingCurrency !== 'USD',
    },

    // TIME SERIES DATA for detailed analysis (converted to USD)
    timeSeries: {
      // Historical actuals from income statements (up to 5 years, sorted newest first, converted to USD)
      historical: (income?.historical || []).map(h => ({
        ...h,
        revenue: toUSD(h.revenue),
        grossProfit: toUSD(h.grossProfit),
        operatingIncome: toUSD(h.operatingIncome),
        ebitda: toUSD(h.ebitda),
        netIncome: toUSD(h.netIncome),
        eps: toUSD(h.eps),
      })),

      // Forward estimates from analysts (sorted nearest future first, converted to USD)
      forward: (estimates?.forwardEstimates || []).map(f => ({
        ...f,
        revenue: toUSD(f.revenue),
        grossProfit: toUSD(f.grossProfit),
        ebit: toUSD(f.ebit),
        ebitda: toUSD(f.ebitda),
        netIncome: toUSD(f.netIncome),
        eps: toUSD(f.eps),
      })),

      // FY3 estimate if available (converted to USD)
      fy3: estimates?.fy3 ? {
        ...estimates.fy3,
        revenue: toUSD(estimates.fy3.revenue),
        grossProfit: toUSD(estimates.fy3.grossProfit),
        ebit: toUSD(estimates.fy3.ebit),
        ebitda: toUSD(estimates.fy3.ebitda),
        netIncome: toUSD(estimates.fy3.netIncome),
        eps: toUSD(estimates.fy3.eps),
      } : null,
    },
  };
};

/**
 * Batch fetch consensus data for multiple tickers
 * Pre-filters ETFs to avoid wasting API calls
 * Includes symbol resolution for international tickers
 * @param {string[]} tickers - Array of ticker symbols
 * @param {string} apiKey - FMP API key
 * @param {function} onProgress - Optional progress callback (current, total, currentTicker, phase)
 * @returns {Object} Map of ticker -> consensus data (includes { isEtf: true } for filtered ETFs)
 */
export const batchFetchConsensusData = async (tickers, apiKey, onProgress) => {
  const results = {};
  const symbolMap = {}; // Maps user ticker -> FMP symbol
  const etfTickers = new Set();

  // Phase 1: Pre-fetch ETF list to filter before expensive API calls
  console.log('[FMP] Fetching ETF list for pre-filtering...');
  const etfSet = await fetchEtfList(apiKey);

  // Identify ETFs
  for (const ticker of tickers) {
    if (etfSet.has(ticker.toUpperCase())) {
      etfTickers.add(ticker);
      results[ticker] = { ticker, isEtf: true, name: ticker };
    }
  }

  if (etfTickers.size > 0) {
    console.log(`[FMP] Pre-filtered ${etfTickers.size} ETFs:`, [...etfTickers]);
  }

  // Get non-ETF tickers
  const stockTickers = tickers.filter(t => !etfTickers.has(t));
  const total = stockTickers.length;

  // Phase 2: Identify which tickers might need symbol resolution
  // International tickers typically have:
  // - Exchange suffixes (.AS, .T, .L, etc.)
  // - Are numeric (Japanese stocks like 6525)
  // - Start with numeric (6525.T)
  const needsResolution = stockTickers.filter(t => {
    const hasExchangeSuffix = t.includes('.');
    const isNumeric = /^\d+/.test(t);
    // European tickers that might need exchange suffix added (e.g., BESI -> BESI.AS)
    const mightBeEuropean = /^[A-Z]{2,6}$/.test(t) && !['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AMD', 'INTC', 'NFLX', 'GOOG', 'COST', 'AVGO', 'CSCO'].includes(t.toUpperCase());
    return hasExchangeSuffix || isNumeric;
  });

  // Phase 3: Resolve international symbols if needed
  if (needsResolution.length > 0) {
    console.log('[FMP] Resolving international symbols:', needsResolution);

    for (const ticker of needsResolution) {
      try {
        const resolved = await resolveSymbol(ticker, apiKey);
        if (resolved) {
          symbolMap[ticker] = resolved.fmpSymbol;
          console.log(`[FMP] Resolved ${ticker} -> ${resolved.fmpSymbol} (${resolved.exchange})`);
        } else {
          // If resolution fails, try the original ticker anyway
          symbolMap[ticker] = ticker;
        }
      } catch (err) {
        console.warn(`[FMP] Failed to resolve ${ticker}:`, err);
        symbolMap[ticker] = ticker;
      }

      // Small delay for rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  // Phase 4: Fetch consensus data for non-ETF tickers only
  const failedTickers = []; // Track failed tickers for retry

  for (let i = 0; i < stockTickers.length; i++) {
    const userTicker = stockTickers[i];
    let fmpSymbol = symbolMap[userTicker] || userTicker;

    if (onProgress) {
      // Show progress including ETFs in count
      onProgress(etfTickers.size + i + 1, tickers.length, userTicker);
    }

    try {
      let data = await fetchConsensusData(fmpSymbol, apiKey);

      // If no data and we haven't tried resolution yet, try it now
      if (!data && !symbolMap[userTicker]) {
        console.log(`[FMP] No data for ${userTicker}, trying symbol resolution...`);
        const resolved = await resolveSymbol(userTicker, apiKey);
        if (resolved && resolved.fmpSymbol !== userTicker) {
          fmpSymbol = resolved.fmpSymbol;
          console.log(`[FMP] Resolved ${userTicker} -> ${fmpSymbol}`);
          data = await fetchConsensusData(fmpSymbol, apiKey);
        }
      }

      if (data) {
        // Store with user's original ticker, but include the FMP symbol
        results[userTicker] = {
          ...data,
          ticker: userTicker, // Keep user's ticker for display
          fmpSymbol: fmpSymbol !== userTicker ? fmpSymbol : undefined,
        };
      } else {
        // Mark as failed for UI to show
        console.warn(`[FMP] No data found for ${userTicker}`);
        results[userTicker] = { ticker: userTicker, failed: true, error: 'No data found' };
        failedTickers.push(userTicker);
      }
    } catch (err) {
      console.warn(`Failed to fetch consensus data for ${userTicker} (${fmpSymbol}):`, err);
      // Track failed tickers for potential retry
      failedTickers.push(userTicker);
      results[userTicker] = { ticker: userTicker, failed: true, error: err.message };

      // If rate limited (429), increase delay
      if (err.message?.includes('429') || err.message?.includes('rate')) {
        console.log('[FMP] Rate limited, increasing delay...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Delay between tickers to respect rate limits
    // 12 API calls per ticker + potential resolution, 300 calls/min limit
    // 12 calls = needs ~2.4s at 5 calls/sec, using 2.5s delay for safety
    if (i < stockTickers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
  }

  // Retry failed tickers after a longer delay (rate limit reset)
  if (failedTickers.length > 0) {
    console.log(`[FMP] Retrying ${failedTickers.length} failed tickers after delay...`);
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second wait for rate limit reset

    for (let i = 0; i < failedTickers.length; i++) {
      const userTicker = failedTickers[i];
      const fmpSymbol = symbolMap[userTicker] || userTicker;

      if (onProgress) {
        onProgress(tickers.length, tickers.length, `Retry: ${userTicker}`);
      }

      try {
        const data = await fetchConsensusData(fmpSymbol, apiKey);
        if (data) {
          results[userTicker] = {
            ...data,
            ticker: userTicker,
            fmpSymbol: fmpSymbol !== userTicker ? fmpSymbol : undefined,
          };
        }
      } catch (err) {
        console.warn(`[FMP] Retry failed for ${userTicker}:`, err);
        // Mark as failed for UI to show
        results[userTicker] = { ticker: userTicker, failed: true, error: err.message };
      }

      // Longer delay on retry
      if (i < failedTickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  return results;
};

/**
 * Fetch consensus data for specific tickers only (for retry/refresh)
 * Use this to load missing tickers without re-fetching everything
 */
export const fetchMissingConsensusData = async (tickers, existingData, apiKey, onProgress) => {
  // Find tickers that don't have valid data yet
  const missingTickers = tickers.filter(t => {
    const data = existingData[t];
    // Missing if: no data, failed, is ETF, or no estimates
    if (!data) return true;
    if (data.failed) return true;
    if (data.isEtf) return false; // Don't retry ETFs
    return false;
  });

  if (missingTickers.length === 0) {
    console.log('[FMP] No missing tickers to fetch');
    return existingData;
  }

  console.log(`[FMP] Fetching ${missingTickers.length} missing tickers:`, missingTickers);

  // Fetch missing tickers
  const newData = await batchFetchConsensusData(missingTickers, apiKey, onProgress);

  // Merge with existing data
  return { ...existingData, ...newData };
};

/**
 * Validate API key by making a test request
 */
export const validateApiKey = async (apiKey) => {
  try {
    const data = await fetchFMP('/quote?symbol=AAPL', apiKey);
    return data && data.length > 0;
  } catch {
    return false;
  }
};

/**
 * Search for a symbol in FMP's database
 * Useful for finding the correct FMP symbol for international stocks
 * @param {string} query - Search query (ticker or company name)
 * @param {string} apiKey - FMP API key
 * @param {number} limit - Max results to return (default: 10)
 * @returns {Promise<Array<{symbol: string, name: string, currency: string, exchange: string}>>}
 */
export const searchSymbol = async (query, apiKey, limit = 10) => {
  try {
    const data = await fetchFMP(`/search-symbol?query=${encodeURIComponent(query)}&limit=${limit}`, apiKey);

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map(item => ({
      symbol: item.symbol,
      name: item.name,
      currency: item.currency,
      exchange: item.exchangeShortName || item.exchange,
    }));
  } catch (err) {
    console.warn(`Failed to search symbol for ${query}:`, err);
    return [];
  }
};

/**
 * Resolve a user-provided ticker to FMP's symbol format
 * Handles international tickers with exchange suffixes (e.g., "BESI.AS" -> "BESI.AS" or proper FMP format)
 * @param {string} ticker - User's ticker symbol
 * @param {string} apiKey - FMP API key
 * @returns {Promise<{fmpSymbol: string, name: string, exchange: string} | null>}
 */
export const resolveSymbol = async (ticker, apiKey) => {
  console.log('[FMP] Resolving symbol:', ticker);

  // Extract the base ticker and suffix
  const parts = ticker.split('.');
  const baseTicker = parts[0];
  const exchangeSuffix = parts[1]?.toUpperCase();

  // Map Yahoo/common suffixes to FMP format
  // Yahoo uses .AS for Amsterdam, FMP might use .AMS or the ticker directly
  const yahooToFmpSuffix = {
    'AS': ['AS', 'AMS', ''], // Amsterdam - try with suffix, AMS suffix, or without
    'T': ['T', 'TSE', ''],   // Tokyo
    'L': ['L', 'LON', ''],   // London
    'HK': ['HK', ''],        // Hong Kong
    'DE': ['DE', 'XETRA', ''], // Germany
    'PA': ['PA', 'EPA', ''], // Paris
    'SW': ['SW', 'SIX', ''], // Swiss
  };

  // Build list of symbol variations to try
  const symbolsToTry = [ticker]; // Try original first

  if (exchangeSuffix && yahooToFmpSuffix[exchangeSuffix]) {
    for (const suffix of yahooToFmpSuffix[exchangeSuffix]) {
      if (suffix === '') {
        symbolsToTry.push(baseTicker); // Try without suffix
      } else if (suffix !== exchangeSuffix) {
        symbolsToTry.push(`${baseTicker}.${suffix}`);
      }
    }
  }

  // Try each symbol variation with direct quote
  for (const symbol of symbolsToTry) {
    try {
      const quoteData = await fetchFMP(`/quote?symbol=${symbol}`, apiKey);
      if (quoteData && quoteData.length > 0) {
        console.log(`[FMP] Resolved ${ticker} -> ${symbol} via quote`);
        return {
          fmpSymbol: symbol,
          name: quoteData[0].name,
          exchange: quoteData[0].exchange,
        };
      }
    } catch (e) {
      // Quote failed, try next
    }
  }

  // Search for the symbol
  try {
    const results = await searchSymbol(baseTicker, apiKey, 20);

    if (results.length === 0) {
      return null;
    }

    // Try to find exact match or best match
    // Priority: exact match > same exchange suffix > first result
    const exactMatch = results.find(r => r.symbol.toUpperCase() === ticker.toUpperCase());
    if (exactMatch) {
      return {
        fmpSymbol: exactMatch.symbol,
        name: exactMatch.name,
        exchange: exactMatch.exchange,
      };
    }

    // Check for exchange suffix match (e.g., .AS for Amsterdam, .T for Tokyo)
    const exchangeSuffix = ticker.includes('.') ? ticker.split('.')[1].toUpperCase() : null;
    if (exchangeSuffix) {
      const suffixMatch = results.find(r => r.symbol.toUpperCase().endsWith(`.${exchangeSuffix}`));
      if (suffixMatch) {
        return {
          fmpSymbol: suffixMatch.symbol,
          name: suffixMatch.name,
          exchange: suffixMatch.exchange,
        };
      }

      // Look for exchange name match
      const exchangeMap = {
        'AS': ['AMS', 'AMSTERDAM', 'EURONEXT'],
        'T': ['TSE', 'TOKYO', 'JPX'],
        'L': ['LSE', 'LONDON'],
        'HK': ['HKEX', 'HONG KONG'],
        'DE': ['XETRA', 'FRANKFURT'],
        'PA': ['EPA', 'PARIS', 'EURONEXT'],
      };

      const possibleExchanges = exchangeMap[exchangeSuffix] || [];
      const exchangeMatch = results.find(r =>
        possibleExchanges.some(ex =>
          r.exchange?.toUpperCase().includes(ex) || r.symbol.toUpperCase().includes(`.${ex}`)
        )
      );
      if (exchangeMatch) {
        return {
          fmpSymbol: exchangeMatch.symbol,
          name: exchangeMatch.name,
          exchange: exchangeMatch.exchange,
        };
      }
    }

    // Return first result as fallback
    return {
      fmpSymbol: results[0].symbol,
      name: results[0].name,
      exchange: results[0].exchange,
    };
  } catch (err) {
    console.warn(`Failed to resolve symbol ${ticker}:`, err);
    return null;
  }
};

/**
 * Batch resolve multiple symbols
 * @param {string[]} tickers - Array of user tickers
 * @param {string} apiKey - FMP API key
 * @returns {Promise<Object>} Map of userTicker -> { fmpSymbol, name, exchange }
 */
export const batchResolveSymbols = async (tickers, apiKey) => {
  const results = {};

  for (const ticker of tickers) {
    const resolved = await resolveSymbol(ticker, apiKey);
    if (resolved) {
      results[ticker] = resolved;
    }
    // Small delay to avoid rate limiting (1 API call per symbol)
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
};
