/**
 * Financial Modeling Prep (FMP) Service
 *
 * @module services/fmpService
 * @description API integration for fetching analyst estimates and financial data
 * Uses the stable API endpoint with header-based authentication.
 */

const BASE_URL = 'https://financialmodelingprep.com/stable';
const STORAGE_KEY = 'monte-carlo-fmp-api-key';

// Cache for ETF list to avoid repeated API calls
let etfListCache = null;
let etfListCacheTime = 0;
const ETF_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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
 * Note: FMP returns estimates for future fiscal years. Dates represent fiscal year end.
 */
export const fetchAnalystEstimates = async (ticker, apiKey) => {
  try {
    // Fetch more periods to ensure we get future estimates
    const data = await fetchFMP(`/analyst-estimates?symbol=${ticker}&period=annual&limit=5`, apiKey);

    if (!data || data.length === 0) {
      console.warn('[FMP] No analyst estimates data for', ticker);
      return null;
    }

    // Log all fields to understand data structure
    if (data[0]) {
      console.log('[FMP] Analyst estimates fields for', ticker, ':', Object.keys(data[0]));
    }

    // Get current date to filter for forward-looking estimates only
    const today = new Date().toISOString().split('T')[0];

    // Log full response for debugging - include currency if available
    console.log('[FMP] Analyst estimates for', ticker, '- raw data:', data.map(d => ({
      date: d.date,
      symbol: d.symbol,
      revenue: d.estimatedRevenueAvg || d.revenueAvg,
      eps: d.estimatedEpsAvg || d.epsAvg,
      isFuture: d.date > today,
    })));

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

    // Sort by date DESCENDING to get most recent first (FMP typically returns this way)
    const sortedData = [...data].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateB.localeCompare(dateA); // Descending - newest first
    });

    // The first item is the furthest future estimate (FY2)
    // The second item is the nearer future estimate (FY1)
    // We want FY1 to be the next fiscal year, FY2 to be the year after
    const fy2Data = sortedData[0] || {};
    const fy1Data = sortedData[1] || sortedData[0] || {};

    console.log('[FMP] Selected for', ticker, '- FY1:', fy1Data.date, 'FY2:', fy2Data.date);

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
      evToRevenue: metrics.evToRevenue || metrics.evToSalesTTM,
      grossProfitMargin: metrics.grossProfitMarginTTM || metrics.grossProfitMargin,
      operatingProfitMargin: metrics.operatingProfitMarginTTM || metrics.operatingProfitMargin,
      netProfitMargin: metrics.netProfitMarginTTM || metrics.netProfitMargin,
      revenuePerShare: metrics.revenuePerShareTTM || metrics.revenuePerShare,
      roe: metrics.roeTTM || metrics.roe,
      roa: metrics.roaTTM || metrics.roa,
      roic: metrics.roicTTM || metrics.roic,
      debtToEquity: metrics.debtToEquityTTM || metrics.debtToEquity,
      currentRatio: metrics.currentRatioTTM || metrics.currentRatio,
      quickRatio: metrics.quickRatioTTM || metrics.quickRatio,
      freeCashFlowYield: metrics.freeCashFlowYieldTTM || metrics.freeCashFlowYield,
      dividendYield: metrics.dividendYieldTTM || metrics.dividendYield || metrics.dividendYieldPercentageTTM,
      payoutRatio: metrics.payoutRatioTTM || metrics.payoutRatio,
    };
  } catch (err) {
    console.warn(`Failed to fetch key metrics for ${ticker}:`, err);
    return null;
  }
};

/**
 * Fetch financial ratios (profitability, liquidity, solvency)
 */
export const fetchFinancialRatios = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/ratios?symbol=${ticker}&period=annual&limit=3`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const latest = data[0];
    // Log all available ratio fields
    console.log('[FMP] Ratios fields for', ticker, ':', Object.keys(latest));

    // Calculate 3Y averages for key ratios
    const avg = (field) => {
      const values = data.map(d => d[field]).filter(v => v != null && !isNaN(v));
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    return {
      // Latest values
      grossProfitMargin: latest.grossProfitMargin,
      operatingProfitMargin: latest.operatingProfitMargin,
      netProfitMargin: latest.netProfitMargin,
      returnOnEquity: latest.returnOnEquity,
      returnOnAssets: latest.returnOnAssets,
      returnOnCapitalEmployed: latest.returnOnCapitalEmployed,
      debtRatio: latest.debtRatio,
      // Valuation ratios
      priceToBookRatio: latest.priceToBookRatio || latest.priceBookValueRatio,
      priceEarningsRatio: latest.priceEarningsRatio,
      priceToSalesRatio: latest.priceToSalesRatio,
      dividendYield: latest.dividendYield,
      debtEquityRatio: latest.debtEquityRatio,
      interestCoverage: latest.interestCoverage,
      currentRatio: latest.currentRatio,
      quickRatio: latest.quickRatio,
      cashRatio: latest.cashRatio,
      assetTurnover: latest.assetTurnover,
      inventoryTurnover: latest.inventoryTurnover,
      receivablesTurnover: latest.receivablesTurnover,
      payablesTurnover: latest.payablesTurnover,
      operatingCashFlowPerShare: latest.operatingCashFlowPerShare,
      freeCashFlowPerShare: latest.freeCashFlowPerShare,
      priceToOperatingCashFlowsRatio: latest.priceToOperatingCashFlowsRatio,
      priceToFreeCashFlowsRatio: latest.priceToFreeCashFlowsRatio,
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
 */
export const fetchFinancialScores = async (ticker, apiKey) => {
  try {
    const data = await fetchFMP(`/score?symbol=${ticker}`, apiKey);

    if (!data || data.length === 0) {
      return null;
    }

    const score = data[0];
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
 * Fetch all consensus data for a single ticker (enhanced with 11 API calls)
 */
export const fetchConsensusData = async (ticker, apiKey) => {
  // Fetch all data in parallel (11 API calls per ticker)
  const [estimates, quote, ev, metrics, income, priceTargets, ratings, growth, earnings, ratios, scores] = await Promise.all([
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
      freeCashFlowYield: metrics?.freeCashFlowYield,
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
      freeCashFlowPerShare: ratios?.freeCashFlowPerShare,
      operatingCashFlowPerShare: ratios?.operatingCashFlowPerShare,
      priceToFCF: ratios?.priceToFreeCashFlowsRatio,
      priceToBook: ratios?.priceToBookRatio || metrics?.pbRatio,
      dividendYield: ratios?.dividendYield || metrics?.dividendYield,
      payoutRatio: metrics?.payoutRatio,
    },

    // Efficiency
    efficiency: {
      assetTurnover: ratios?.assetTurnover,
      inventoryTurnover: ratios?.inventoryTurnover,
      receivablesTurnover: ratios?.receivablesTurnover,
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

  // Phase 2: Identify which tickers need symbol resolution
  // International tickers typically have exchange suffixes (.AS, .T, .L, etc.)
  // or are numeric (Japanese stocks like 6525)
  const needsResolution = stockTickers.filter(t => {
    const hasExchangeSuffix = t.includes('.') && !/^[A-Z]+$/.test(t);
    const isNumeric = /^\d+/.test(t);
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
    const fmpSymbol = symbolMap[userTicker] || userTicker;

    if (onProgress) {
      // Show progress including ETFs in count
      onProgress(etfTickers.size + i + 1, tickers.length, userTicker);
    }

    try {
      const data = await fetchConsensusData(fmpSymbol, apiKey);
      if (data) {
        // Store with user's original ticker, but include the FMP symbol
        results[userTicker] = {
          ...data,
          ticker: userTicker, // Keep user's ticker for display
          fmpSymbol: fmpSymbol !== userTicker ? fmpSymbol : undefined,
        };
      }
    } catch (err) {
      console.warn(`Failed to fetch consensus data for ${userTicker} (${fmpSymbol}):`, err);
      // Track failed tickers for potential retry
      failedTickers.push(userTicker);

      // If rate limited (429), increase delay
      if (err.message?.includes('429') || err.message?.includes('rate')) {
        console.log('[FMP] Rate limited, increasing delay...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    // Delay between tickers to respect rate limits
    // 11 API calls per ticker + potential resolution, 300 calls/min limit
    // 11 calls = needs ~2.2s at 5 calls/sec, using 2.5s delay for safety
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
