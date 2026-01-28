/**
 * Financial Modeling Prep (FMP) Service
 *
 * @module services/fmpService
 * @description API integration for fetching analyst estimates and financial data
 * Uses CORS proxies since FMP doesn't support browser-based requests directly.
 */

const BASE_URL = 'https://financialmodelingprep.com/api/v3';
const STORAGE_KEY = 'monte-carlo-fmp-api-key';

// CORS proxy configuration - using proxies that allow API keys
const CORS_PROXIES = [
  {
    name: 'allorigins-raw',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    parseResponse: async (response) => response.json(),
  },
  {
    name: 'allorigins',
    buildUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parseResponse: async (response) => {
      const data = await response.json();
      return data.contents ? JSON.parse(data.contents) : null;
    },
  },
  {
    name: 'thingproxy',
    buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    parseResponse: async (response) => response.json(),
  },
];

/**
 * Get API key from environment or localStorage
 */
export const getApiKey = () => {
  // Check environment variable first (Vite format)
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
 * Make authenticated API request via CORS proxy
 */
const fetchFMP = async (endpoint, apiKey, timeout = 10000) => {
  const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${apiKey}`;

  console.log('[FMP] Fetching:', endpoint);

  // Try each proxy sequentially to avoid rate limiting
  for (const proxy of CORS_PROXIES) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const proxyUrl = proxy.buildUrl(url);
      const fetchOptions = {
        signal: controller.signal,
        headers: proxy.headers || {},
      };
      const response = await fetch(proxyUrl, fetchOptions);
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await proxy.parseResponse(response);
        if (data) {
          // Check for FMP error responses
          if (data['Error Message']) {
            throw new Error(data['Error Message']);
          }
          console.log('[FMP] Response for', endpoint, ':', Array.isArray(data) ? `${data.length} items` : 'object');
          return data;
        }
      }
      // Response not ok, try next proxy
    } catch (e) {
      clearTimeout(timeoutId);
      // Request failed, try next proxy
    }
  }

  console.error('[FMP] All proxies failed for:', endpoint);
  throw new Error(`Failed to fetch ${endpoint}`);
};

/**
 * Fetch analyst estimates for a ticker
 * Returns forward revenue, EPS, EBIT, net income estimates
 */
export const fetchAnalystEstimates = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/analyst-estimates/${ticker}?limit=2`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    // FMP returns estimates sorted by date (most recent first)
    // FY1 = next fiscal year, FY2 = year after
    const fy1 = data[0] || {};
    const fy2 = data[1] || {};

    return {
      fy1: {
        date: fy1.date,
        revenue: fy1.estimatedRevenueAvg,
        grossProfit: fy1.estimatedGrossProfitAvg || null,
        ebit: fy1.estimatedEbitAvg,
        ebitda: fy1.estimatedEbitdaAvg,
        netIncome: fy1.estimatedNetIncomeAvg,
        eps: fy1.estimatedEpsAvg,
      },
      fy2: {
        date: fy2.date,
        revenue: fy2.estimatedRevenueAvg,
        grossProfit: fy2.estimatedGrossProfitAvg || null,
        ebit: fy2.estimatedEbitAvg,
        ebitda: fy2.estimatedEbitdaAvg,
        netIncome: fy2.estimatedNetIncomeAvg,
        eps: fy2.estimatedEpsAvg,
      },
    };
  } catch (err) {
    console.warn(`Failed to fetch analyst estimates for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch current quote data (price, market cap)
 */
export const fetchQuote = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/quote/${ticker}`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const quote = data[0];
    return {
      price: quote.price,
      marketCap: quote.marketCap,
      name: quote.name,
      exchange: quote.exchange,
      changesPercentage: quote.changesPercentage,
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
    const data = await fetchFMP(`/enterprise-values/${ticker}?limit=1`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const ev = data[0];
    return {
      enterpriseValue: ev.enterpriseValue,
      marketCap: ev.marketCapitalization,
      totalDebt: ev.addTotalDebt,
      cashAndEquivalents: ev.minusCashAndCashEquivalents,
    };
  } catch (err) {
    console.warn(`Failed to fetch enterprise value for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch key metrics (ratios, margins)
 */
export const fetchKeyMetrics = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/key-metrics-ttm/${ticker}`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const metrics = data[0];
    return {
      peRatio: metrics.peRatioTTM,
      pbRatio: metrics.pbRatioTTM,
      evToEbitda: metrics.enterpriseValueOverEBITDATTM,
      evToSales: metrics.evToSalesTTM,
      grossProfitMargin: metrics.grossProfitMarginTTM,
      operatingProfitMargin: metrics.operatingProfitMarginTTM,
      netProfitMargin: metrics.netProfitMarginTTM,
      revenuePerShare: metrics.revenuePerShareTTM,
    };
  } catch (err) {
    console.warn(`Failed to fetch key metrics for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch income statement for gross profit calculation
 */
export const fetchIncomeStatement = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/income-statement/${ticker}?limit=1`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const income = data[0];
    return {
      revenue: income.revenue,
      grossProfit: income.grossProfit,
      grossProfitRatio: income.grossProfitRatio,
      operatingIncome: income.operatingIncome,
      operatingIncomeRatio: income.operatingIncomeRatio,
      netIncome: income.netIncome,
      netIncomeRatio: income.netIncomeRatio,
    };
  } catch (err) {
    console.warn(`Failed to fetch income statement for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch all consensus data for a single ticker
 */
export const fetchConsensusData = async (ticker, apiKey) => {
  // Fetch all data in parallel
  const [estimates, quote, ev, metrics, income] = await Promise.all([
    fetchAnalystEstimates(ticker, apiKey),
    fetchQuote(ticker, apiKey),
    fetchEnterpriseValue(ticker, apiKey),
    fetchKeyMetrics(ticker, apiKey),
    fetchIncomeStatement(ticker, apiKey),
  ]);

  if (!estimates && !quote) {
    return null;
  }

  // Calculate forward metrics
  const price = quote?.price || 0;
  const marketCap = quote?.marketCap || ev?.marketCap || 0;
  const enterpriseValue = ev?.enterpriseValue || 0;

  // FY1 calculations
  const fy1Revenue = estimates?.fy1?.revenue || 0;
  const fy1Ebitda = estimates?.fy1?.ebitda || 0;
  const fy1Ebit = estimates?.fy1?.ebit || 0;
  const fy1NetIncome = estimates?.fy1?.netIncome || 0;
  const fy1Eps = estimates?.fy1?.eps || 0;

  // Use historical gross margin to estimate forward gross profit if not available
  const historicalGrossMargin = income?.grossProfitRatio || metrics?.grossProfitMargin || 0;
  const fy1GrossProfit = estimates?.fy1?.grossProfit || (fy1Revenue * historicalGrossMargin);

  // FY2 calculations
  const fy2Revenue = estimates?.fy2?.revenue || 0;
  const fy2Ebitda = estimates?.fy2?.ebitda || 0;
  const fy2Ebit = estimates?.fy2?.ebit || 0;
  const fy2NetIncome = estimates?.fy2?.netIncome || 0;
  const fy2Eps = estimates?.fy2?.eps || 0;
  const fy2GrossProfit = estimates?.fy2?.grossProfit || (fy2Revenue * historicalGrossMargin);

  return {
    ticker,
    name: quote?.name || ticker,
    price,
    marketCap,
    enterpriseValue,
    changesPercentage: quote?.changesPercentage || 0,

    // FY1 estimates
    fy1: {
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

    // Valuation multiples (using FY1)
    multiples: {
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
      evToEbitda: metrics?.evToEbitda,
    },
  };
};

/**
 * Batch fetch consensus data for multiple tickers
 * @param {string[]} tickers - Array of ticker symbols
 * @param {string} apiKey - FMP API key
 * @param {function} onProgress - Optional progress callback (current, total)
 * @returns {Object} Map of ticker -> consensus data
 */
export const batchFetchConsensusData = async (tickers, apiKey, onProgress) => {
  const results = {};
  const total = tickers.length;

  // Process sequentially to respect rate limits
  // FMP free tier has limited requests per minute
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];

    try {
      const data = await fetchConsensusData(ticker, apiKey);
      if (data) {
        results[ticker] = data;
      }
    } catch (err) {
      console.warn(`Failed to fetch consensus data for ${ticker}:`, err);
    }

    if (onProgress) {
      onProgress(i + 1, total);
    }

    // Small delay to avoid rate limiting (250ms between requests)
    if (i < tickers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  return results;
};

/**
 * Validate API key by making a test request
 */
export const validateApiKey = async (apiKey) => {
  try {
    const data = await fetchFMP('/quote/AAPL', apiKey);
    return data && data.length > 0;
  } catch {
    return false;
  }
};
