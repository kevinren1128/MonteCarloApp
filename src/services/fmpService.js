/**
 * Financial Modeling Prep (FMP) Service
 *
 * @module services/fmpService
 * @description API integration for fetching analyst estimates and financial data
 * Uses the stable API endpoint with header-based authentication.
 */

const BASE_URL = 'https://financialmodelingprep.com/stable';
const STORAGE_KEY = 'monte-carlo-fmp-api-key';

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

/**
 * Fetch analyst estimates for a ticker
 * Returns forward revenue, EPS, EBIT, net income estimates
 */
export const fetchAnalystEstimates = async (ticker, apiKey) => {
  try {
    // Fetch more periods to ensure we get future estimates
    const data = await fetchFMP(`/analyst-estimates?symbol=${ticker}&period=annual&limit=5`, apiKey);

    if (!data || data.length === 0) {
      console.warn('[FMP] No analyst estimates data for', ticker);
      return null;
    }

    // Log response for debugging
    console.log('[FMP] Analyst estimates for', ticker, '- dates:', data.map(d => d.date));

    // Try multiple possible field name variations
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

    // Sort by date ascending to get proper FY order
    const sortedData = [...data].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateA.localeCompare(dateB);
    });

    // Get current year to find future estimates
    const currentYear = new Date().getFullYear();

    // Filter to only future fiscal years
    const futureEstimates = sortedData.filter(d => {
      const fy = extractFiscalYear(d.date);
      return fy && fy >= currentYear;
    });

    // Use first two future years, or fall back to most recent data
    const fy1Data = futureEstimates[0] || sortedData[sortedData.length - 2] || {};
    const fy2Data = futureEstimates[1] || sortedData[sortedData.length - 1] || {};

    const buildFyData = (obj) => ({
      date: obj.date,
      fiscalYear: extractFiscalYear(obj.date),
      revenue: getRevenue(obj),
      grossProfit: obj.estimatedGrossProfitAvg || obj.grossProfitAvg || null,
      ebit: getEbit(obj),
      ebitda: getEbitda(obj),
      netIncome: getNetIncome(obj),
      eps: getEps(obj),
    });

    return {
      fy1: buildFyData(fy1Data),
      fy2: buildFyData(fy2Data),
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
    const data = await fetchFMP(`/quote?symbol=${ticker}`, apiKey);

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
    const data = await fetchFMP(`/enterprise-values?symbol=${ticker}&limit=1`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const ev = data[0];
    console.log('[FMP] Enterprise value fields for', ticker, ':', Object.keys(ev));

    return {
      enterpriseValue: ev.enterpriseValue,
      marketCap: ev.marketCapitalization || ev.marketCap,
      totalDebt: ev.addTotalDebt || ev.totalDebt,
      cashAndEquivalents: ev.minusCashAndCashEquivalents || ev.cashAndCashEquivalents,
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
    const data = await fetchFMP(`/key-metrics?symbol=${ticker}&period=ttm`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const metrics = data[0];
    console.log('[FMP] Key metrics fields for', ticker, ':', Object.keys(metrics));

    return {
      peRatio: metrics.peRatioTTM || metrics.peRatio,
      pbRatio: metrics.pbRatioTTM || metrics.pbRatio,
      evToEbitda: metrics.enterpriseValueOverEBITDATTM || metrics.enterpriseValueOverEBITDA,
      evToSales: metrics.evToSalesTTM || metrics.evToSales,
      grossProfitMargin: metrics.grossProfitMarginTTM || metrics.grossProfitMargin,
      operatingProfitMargin: metrics.operatingProfitMarginTTM || metrics.operatingProfitMargin,
      netProfitMargin: metrics.netProfitMarginTTM || metrics.netProfitMargin,
      revenuePerShare: metrics.revenuePerShareTTM || metrics.revenuePerShare,
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
    const data = await fetchFMP(`/income-statement?symbol=${ticker}&limit=1`, apiKey);

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
 */
export const fetchEarningsCalendar = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/earnings-calendar?symbol=${ticker}`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    // Find next upcoming earnings (date >= today)
    const today = new Date().toISOString().split('T')[0];
    const upcoming = data.find(e => e.date >= today);

    // Get most recent past earnings for surprise data
    const recent = data.filter(e => e.date < today).slice(0, 4);

    // Calculate average surprise
    const surprises = recent
      .map(e => {
        if (e.eps != null && e.epsEstimated != null && e.epsEstimated !== 0) {
          return (e.eps - e.epsEstimated) / Math.abs(e.epsEstimated);
        }
        return null;
      })
      .filter(s => s != null);

    const avgSurprise = surprises.length > 0
      ? surprises.reduce((a, b) => a + b, 0) / surprises.length
      : null;

    return {
      nextEarningsDate: upcoming?.date || null,
      nextEpsEstimate: upcoming?.epsEstimated || null,
      lastEps: recent[0]?.eps || null,
      lastEpsEstimate: recent[0]?.epsEstimated || null,
      lastSurprise: recent[0] && recent[0].epsEstimated
        ? (recent[0].eps - recent[0].epsEstimated) / Math.abs(recent[0].epsEstimated)
        : null,
      avgSurprise,
      beatCount: surprises.filter(s => s > 0).length,
      missCount: surprises.filter(s => s < 0).length,
    };
  } catch (err) {
    console.warn(`Failed to fetch earnings calendar for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch all consensus data for a single ticker (enhanced with 9 API calls)
 */
export const fetchConsensusData = async (ticker, apiKey) => {
  // Fetch all data in parallel (9 API calls per ticker)
  const [estimates, quote, ev, metrics, income, priceTargets, ratings, growth, earnings] = await Promise.all([
    fetchAnalystEstimates(ticker, apiKey),
    fetchQuote(ticker, apiKey),
    fetchEnterpriseValue(ticker, apiKey),
    fetchKeyMetrics(ticker, apiKey),
    fetchIncomeStatement(ticker, apiKey),
    fetchPriceTargets(ticker, apiKey),
    fetchAnalystRatings(ticker, apiKey),
    fetchFinancialGrowth(ticker, apiKey),
    fetchEarningsCalendar(ticker, apiKey),
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

    // Analyst price targets
    priceTargets: priceTargets ? {
      high: priceTargets.targetHigh,
      low: priceTargets.targetLow,
      consensus: priceTargets.targetConsensus,
      median: priceTargets.targetMedian,
      upside: price ? (priceTargets.targetConsensus - price) / price : null,
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

    // Delay between tickers to respect rate limits
    // 9 API calls per ticker, 300 calls/min limit = ~33 tickers/min max
    // Using 400ms delay = ~2.5 tickers/sec = safe margin
    if (i < tickers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }

  return results;
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
