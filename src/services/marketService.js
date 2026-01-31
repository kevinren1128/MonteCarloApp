/**
 * Market Data Service - Cloudflare Worker API Client
 *
 * @module services/marketService
 * @description Fetches market data from Cloudflare Worker with KV caching.
 * Falls back to direct Yahoo Finance API via CORS proxy if Worker is not configured.
 *
 * Benefits of using the Worker:
 * - Shared cache: One user fetches AAPL, all users benefit
 * - Edge caching: Data cached closer to users
 * - Reduced rate limiting: Fewer direct API calls
 * - Consistent data: All users see same cached values
 */

import { fetchYahooData, fetchYahooQuote, fetchYahooHistory, fetchYahooProfile } from './yahooFinance';

// ============================================
// CONFIGURATION
// ============================================

const WORKER_URL = import.meta.env.VITE_WORKER_URL;

// Check if Worker is configured
const isWorkerConfigured = WORKER_URL &&
  !WORKER_URL.includes('your-subdomain') &&
  !WORKER_URL.includes('undefined');

/**
 * Check if the Cloudflare Worker is available
 * @returns {boolean}
 */
export const isWorkerAvailable = () => {
  return isWorkerConfigured;
};

// ============================================
// WORKER API CALLS
// ============================================

/**
 * Fetch from Worker API with timeout
 * @param {string} endpoint - API endpoint (e.g., '/api/prices')
 * @param {Object} params - Query parameters
 * @param {number} timeout - Timeout in ms
 * @returns {Promise<Object|null>}
 */
async function fetchFromWorker(endpoint, params = {}, timeout = 15000) {
  if (!isWorkerConfigured) {
    return null;
  }

  const url = new URL(endpoint, WORKER_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Worker API error: ${response.status} for ${endpoint}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`Worker API timeout for ${endpoint}`);
    } else {
      console.warn(`Worker API error for ${endpoint}:`, error.message);
    }
    return null;
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Fetch historical prices for multiple symbols
 * Uses Worker if available, falls back to direct Yahoo API
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {string} range - Time range ('1y', '2y', '5y', etc.)
 * @param {string} interval - Data interval ('1d', '1wk', '1mo')
 * @param {Object} options - Additional options
 * @param {string} options.currency - Target currency ('USD' for conversion)
 * @returns {Promise<Object>} Map of symbol -> price data
 */
export async function fetchPrices(symbols, range = '1y', interval = '1d', options = {}) {
  const { currency } = options;

  // Try Worker first
  if (isWorkerConfigured) {
    const params = {
      symbols: symbols.join(','),
      range,
      interval,
    };
    // Add currency param for USD conversion
    if (currency) {
      params.currency = currency;
    }

    const data = await fetchFromWorker('/api/prices', params);

    if (data) {
      // Extract _fx summary if present (used for USD conversion)
      const fxSummary = data._fx;
      delete data._fx;

      console.log(`[MarketService] Fetched ${Object.keys(data).length} symbols from Worker${currency ? ` (${currency} converted)` : ''}`);
      const transformed = transformWorkerPrices(data);

      // Attach FX summary to result for client reference
      if (fxSummary) {
        transformed._fx = fxSummary;
      }
      return transformed;
    }
  }

  // Fallback to direct Yahoo API (no USD conversion in fallback)
  console.log('[MarketService] Falling back to direct Yahoo API');
  const results = {};

  await Promise.all(symbols.map(async (symbol) => {
    const historyResult = await fetchYahooHistory(symbol, range, interval);
    if (historyResult?.prices) {
      results[symbol] = {
        prices: historyResult.prices.map(p => p.close),
        timestamps: historyResult.prices.map(p => p.date.getTime()),
        symbol,
        currency: historyResult.currency,
      };
    }
  }));

  return results;
}

/**
 * Fetch current quotes for multiple symbols
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {Object} options - Additional options
 * @param {string} options.currency - Target currency ('USD' for conversion)
 * @returns {Promise<Object>} Map of symbol -> quote data
 */
export async function fetchQuotes(symbols, options = {}) {
  const { currency } = options;

  // Try Worker first
  if (isWorkerConfigured) {
    const params = { symbols: symbols.join(',') };
    if (currency) {
      params.currency = currency;
    }

    const data = await fetchFromWorker('/api/quotes', params);

    if (data) {
      // Extract _fx summary if present
      const fxSummary = data._fx;
      delete data._fx;

      if (fxSummary) {
        data._fx = fxSummary;
      }
      return data;
    }
  }

  // Fallback to direct Yahoo API (no USD conversion in fallback)
  const results = {};

  await Promise.all(symbols.map(async (symbol) => {
    const quote = await fetchYahooQuote(symbol);
    if (quote) {
      results[symbol] = quote;
    }
  }));

  return results;
}

/**
 * Fetch company profiles for multiple symbols
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @returns {Promise<Object>} Map of symbol -> profile data
 */
export async function fetchProfiles(symbols) {
  // Try Worker first
  if (isWorkerConfigured) {
    const data = await fetchFromWorker('/api/profile', {
      symbols: symbols.join(','),
    });

    if (data) {
      return data;
    }
  }

  // Fallback to direct Yahoo API
  const results = {};

  await Promise.all(symbols.map(async (symbol) => {
    const profile = await fetchYahooProfile(symbol);
    if (profile) {
      results[symbol] = profile;
    }
  }));

  return results;
}

/**
 * Fetch exchange rates for currency pairs
 *
 * @param {string[]} pairs - Array of currency pairs (e.g., ['EURUSD', 'GBPUSD'])
 * @returns {Promise<Object>} Map of pair -> rate data
 */
export async function fetchExchangeRates(pairs) {
  // Try Worker first
  if (isWorkerConfigured) {
    const data = await fetchFromWorker('/api/fx', {
      pairs: pairs.join(','),
    });

    if (data) {
      return data;
    }
  }

  // Fallback to direct Yahoo API
  const { fetchExchangeRate } = await import('./yahooFinance');
  const results = {};

  await Promise.all(pairs.map(async (pair) => {
    const from = pair.slice(0, 3);
    const to = pair.slice(3, 6) || 'USD';
    const rate = await fetchExchangeRate(from, to);
    if (rate) {
      results[pair] = { pair, from, to, rate };
    }
  }));

  return results;
}

/**
 * Fetch analyst consensus data for multiple symbols
 * This uses the Worker's FMP proxy if available
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @returns {Promise<Object>} Map of symbol -> consensus data
 */
export async function fetchConsensus(symbols) {
  // Try Worker first
  if (isWorkerConfigured) {
    const data = await fetchFromWorker('/api/consensus', {
      symbols: symbols.join(','),
    });

    if (data) {
      return data;
    }
  }

  // No fallback - FMP API requires key and is handled by fmpService directly
  console.log('[MarketService] Consensus data requires fmpService (no Worker fallback)');
  return {};
}

// ============================================
// HELPERS
// ============================================

/**
 * Transform Worker price response to match expected format
 * Preserves USD conversion fields if present
 */
function transformWorkerPrices(workerData) {
  const results = {};

  for (const [symbol, data] of Object.entries(workerData)) {
    if (!data) continue;

    results[symbol] = {
      symbol: data.symbol || symbol,
      prices: data.prices || [],
      timestamps: data.timestamps || [],
      currency: data.currency || 'USD',
      meta: data.meta || {},
      cached: data.cached || false,
      // USD conversion fields (present when currency=USD was requested)
      ...(data.localCurrency && { localCurrency: data.localCurrency }),
      ...(data.localPrices && { localPrices: data.localPrices }),
      ...(data.fxRate !== undefined && { fxRate: data.fxRate }),
      ...(data.fxTimestamp && { fxTimestamp: data.fxTimestamp }),
      ...(data.fxError && { fxError: data.fxError }),
    };
  }

  return results;
}

/**
 * Get Worker health/status
 * @returns {Promise<Object|null>}
 */
export async function getWorkerStatus() {
  if (!isWorkerConfigured) {
    return null;
  }

  return await fetchFromWorker('/health');
}

// ============================================
// DERIVED METRICS (Pre-computed by Worker)
// ============================================

/**
 * Fetch unified metrics for Positions tab (beta, vol, returns, sparkline)
 * This is the PRIMARY endpoint for fast Positions tab loading.
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {string} benchmark - Benchmark symbol (default: SPY)
 * @returns {Promise<Object|null>} Map of symbol -> metrics (UI-ready shape) or null if failed
 */
export async function fetchMetrics(symbols, benchmark = 'SPY') {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping metrics fetch');
    return null;
  }

  if (symbols.length === 0) {
    return {};
  }

  const data = await fetchFromWorker('/api/metrics', {
    symbols: symbols.join(','),
    benchmark,
  });

  if (!data) {
    return null;
  }

  // Map API response to UI-expected shape
  const mapped = {};
  for (const [symbol, metrics] of Object.entries(data)) {
    if (metrics.error) {
      // Skip symbols with errors
      console.warn(`[MarketService] Metrics error for ${symbol}:`, metrics.error);
      continue;
    }

    mapped[symbol] = {
      // Core metrics (match positionBetas shape)
      beta: metrics.beta,
      correlation: metrics.correlation,
      volatility: metrics.volatility,        // Already percentage from Worker
      ytdReturn: metrics.ytdReturn,
      oneYearReturn: metrics.oneYearReturn,
      thirtyDayReturn: metrics.thirtyDayReturn,
      sparklineData: metrics.sparkline,      // Rename: sparkline → sparklineData
      // International stock handling
      betaLag: metrics.betaLag,
      isInternational: metrics.isInternational,
      // Extra fields for position updates
      latestPrice: metrics.latestPrice,
      currency: metrics.currency,
      // Metadata
      asOf: metrics.asOf,
      cached: metrics.cached || false,
    };
  }

  console.log(`[MarketService] Fetched metrics for ${Object.keys(mapped).length} symbols from Worker`);
  return mapped;
}

/**
 * Fetch pre-computed beta values from Worker
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {string} benchmark - Benchmark symbol (default: SPY)
 * @param {string} range - Time range (default: 1y)
 * @returns {Promise<Object>} Map of symbol -> beta data
 */
export async function fetchBetas(symbols, benchmark = 'SPY', range = '1y') {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping beta fetch');
    return null;
  }

  const data = await fetchFromWorker('/api/beta', {
    symbols: symbols.join(','),
    benchmark,
    range,
  });

  if (data) {
    console.log(`[MarketService] Fetched betas for ${Object.keys(data).length} symbols from Worker`);
  }

  return data;
}

/**
 * Fetch pre-computed volatility and returns from Worker
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {string} range - Time range (default: 1y)
 * @returns {Promise<Object>} Map of symbol -> volatility data
 */
export async function fetchVolatility(symbols, range = '1y') {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping volatility fetch');
    return null;
  }

  const data = await fetchFromWorker('/api/volatility', {
    symbols: symbols.join(','),
    range,
  });

  if (data) {
    console.log(`[MarketService] Fetched volatility for ${Object.keys(data).length} symbols from Worker`);
  }

  return data;
}

/**
 * Fetch pre-computed distribution estimates from Worker
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {string} range - Time range for bootstrap (default: 5y)
 * @param {number} bootstrap - Number of bootstrap iterations (default: 1000)
 * @returns {Promise<Object>} Map of symbol -> distribution data (p5, p25, p50, p75, p95)
 */
export async function fetchDistributions(symbols, range = '5y', bootstrap = 1000) {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping distribution fetch');
    return null;
  }

  const data = await fetchFromWorker('/api/distribution', {
    symbols: symbols.join(','),
    range,
    bootstrap: String(bootstrap),
  });

  if (data) {
    console.log(`[MarketService] Fetched distributions for ${Object.keys(data).length} symbols from Worker`);
  }

  return data;
}

/**
 * Fetch pre-computed calendar year returns from Worker
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {string} range - Time range (default: 10y)
 * @returns {Promise<Object>} Map of symbol -> { years: { 2024: 0.12, ... } }
 */
export async function fetchCalendarReturns(symbols, range = '10y') {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping calendar returns fetch');
    return null;
  }

  const data = await fetchFromWorker('/api/calendar-returns', {
    symbols: symbols.join(','),
    range,
  });

  if (data) {
    console.log(`[MarketService] Fetched calendar returns for ${Object.keys(data).length} symbols from Worker`);
  }

  return data;
}

/**
 * Fetch pre-computed correlation matrix from Worker
 *
 * @param {string[]} symbols - Array of ticker symbols (will be normalized: uppercase, sorted, unique)
 * @param {string} range - Time range (default: 5y)
 * @param {string} interval - Data interval (default: 1d)
 * @returns {Promise<Object|null>} { symbols: string[], matrix: number[][], ... } or null if failed
 */
export async function fetchCorrelationMatrix(symbols, range = '5y', interval = '1d') {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping correlation fetch');
    return null;
  }

  if (symbols.length < 2) {
    console.log('[MarketService] Need at least 2 symbols for correlation matrix');
    return null;
  }

  const data = await fetchFromWorker('/api/correlation', {
    symbols: symbols.join(','),
    range,
    interval,
  });

  if (data?.matrix) {
    console.log(`[MarketService] Fetched ${data.symbols.length}x${data.symbols.length} correlation matrix from Worker`);
    return data;
  }

  return null;
}

/**
 * Fetch all derived metrics in parallel
 * Returns null for any that fail, allowing local fallback
 *
 * @param {string[]} symbols - Array of ticker symbols (for betas, volatility, distributions, calendar returns)
 * @param {Object} options - Optional parameters
 * @param {string[]} options.correlationSymbols - Symbols for correlation matrix (defaults to symbols)
 * @param {string} options.correlationRange - Range for correlation (default: '5y')
 * @returns {Promise<Object>} { betas, volatility, distributions, calendarReturns, correlation }
 */
export async function fetchAllDerivedMetrics(symbols, options = {}) {
  if (!isWorkerConfigured) {
    return { betas: null, volatility: null, distributions: null, calendarReturns: null, correlation: null };
  }

  const { correlationRange = '5y', correlationSymbols } = options;
  // Use separate symbols for correlation (portfolio only, not factor ETFs)
  const corrSymbols = correlationSymbols || symbols;

  console.log(`[MarketService] Fetching all derived metrics for ${symbols.length} symbols (correlation: ${corrSymbols.length})...`);
  const startTime = performance.now();

  const [betas, volatility, distributions, calendarReturns, correlation] = await Promise.all([
    fetchBetas(symbols).catch(() => null),
    fetchVolatility(symbols).catch(() => null),
    fetchDistributions(symbols).catch(() => null),
    fetchCalendarReturns(symbols).catch(() => null),
    corrSymbols.length >= 2 ? fetchCorrelationMatrix(corrSymbols, correlationRange).catch(() => null) : Promise.resolve(null),
  ]);

  const duration = Math.round(performance.now() - startTime);
  console.log(`[MarketService] Derived metrics fetch complete in ${duration}ms`, {
    betas: betas ? Object.keys(betas).length : 0,
    volatility: volatility ? Object.keys(volatility).length : 0,
    distributions: distributions ? Object.keys(distributions).length : 0,
    calendarReturns: calendarReturns ? Object.keys(calendarReturns).length : 0,
    correlation: correlation ? `${correlation.symbols?.length}x${correlation.symbols?.length}` : null,
  });

  return { betas, volatility, distributions, calendarReturns, correlation };
}

/**
 * Fetch factor exposures (betas against multiple factor ETFs)
 *
 * @param {string[]} symbols - Array of portfolio ticker symbols
 * @param {string[]} factors - Array of factor ETF symbols (default: SPY)
 * @param {string} range - Time range (default: 1y)
 * @returns {Promise<Object|null>} { symbols, factors, exposures, rSquared } or null
 */
export async function fetchFactorExposures(symbols, factors = ['SPY'], range = '1y') {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping factor exposures fetch');
    return null;
  }

  if (symbols.length === 0) {
    return null;
  }

  const data = await fetchFromWorker('/api/factor-exposures', {
    symbols: symbols.join(','),
    factors: factors.join(','),
    range,
  });

  if (data?.exposures) {
    console.log(`[MarketService] Fetched factor exposures for ${symbols.length} symbols x ${factors.length} factors`);
    return data;
  }

  return null;
}

/**
 * Fetch portfolio snapshot (all data in one call)
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {Object} options - Additional options
 * @param {string} options.benchmark - Benchmark symbol (default: SPY)
 * @param {string} options.range - Time range (default: 1y)
 * @param {string} options.currency - Target currency (optional, 'USD' for conversion)
 * @returns {Promise<Object|null>} { symbols, quotes, profiles, volatility, beta } or null
 */
export async function fetchSnapshot(symbols, options = {}) {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping snapshot fetch');
    return null;
  }

  const { benchmark = 'SPY', range = '1y', currency } = options;

  const params = {
    symbols: symbols.join(','),
    benchmark,
    range,
  };
  if (currency) {
    params.currency = currency;
  }

  const data = await fetchFromWorker('/api/snapshot', params);

  if (data?.quotes) {
    console.log(`[MarketService] Fetched snapshot for ${symbols.length} symbols`);
    return data;
  }

  return null;
}

/**
 * Fetch portfolio optimization results
 *
 * @param {string[]} symbols - Array of ticker symbols
 * @param {Object} options - Additional options
 * @param {number[]} options.returns - Expected annual returns (optional, computed if not provided)
 * @param {number[]} options.vols - Annual volatilities (optional, computed if not provided)
 * @param {string} options.range - Time range for historical data (default: 1y)
 * @param {number} options.riskFreeRate - Risk-free rate (default: 0.05)
 * @returns {Promise<Object|null>} { minVariance, maxSharpe, riskParity, ... } or null
 */
export async function fetchOptimization(symbols, options = {}) {
  if (!isWorkerConfigured) {
    console.log('[MarketService] Worker not configured, skipping optimization fetch');
    return null;
  }

  if (symbols.length < 2) {
    console.log('[MarketService] Need at least 2 symbols for optimization');
    return null;
  }

  const { returns, vols, range = '1y', riskFreeRate = 0.05 } = options;

  const params = {
    symbols: symbols.join(','),
    range,
    rf: String(riskFreeRate),
  };
  if (returns) {
    params.returns = returns.join(',');
  }
  if (vols) {
    params.vols = vols.join(',');
  }

  const data = await fetchFromWorker('/api/optimize', params);

  if (data?.minVariance) {
    console.log(`[MarketService] Fetched optimization for ${symbols.length} symbols`);
    return data;
  }

  return null;
}

export default {
  isWorkerAvailable,
  fetchPrices,
  fetchQuotes,
  fetchProfiles,
  fetchExchangeRates,
  fetchConsensus,
  getWorkerStatus,
  // Derived metrics
  fetchMetrics,  // Unified metrics for Positions tab
  fetchBetas,
  fetchVolatility,
  fetchDistributions,
  fetchCalendarReturns,
  fetchCorrelationMatrix,
  fetchAllDerivedMetrics,
  // Advanced endpoints
  fetchFactorExposures,
  fetchSnapshot,
  fetchOptimization,
};
