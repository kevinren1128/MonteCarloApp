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
 * @returns {Promise<Object>} Map of symbol -> price data
 */
export async function fetchPrices(symbols, range = '1y', interval = '1d') {
  // Try Worker first
  if (isWorkerConfigured) {
    const data = await fetchFromWorker('/api/prices', {
      symbols: symbols.join(','),
      range,
      interval,
    });

    if (data) {
      console.log(`[MarketService] Fetched ${Object.keys(data).length} symbols from Worker`);
      return transformWorkerPrices(data);
    }
  }

  // Fallback to direct Yahoo API
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
 * @returns {Promise<Object>} Map of symbol -> quote data
 */
export async function fetchQuotes(symbols) {
  // Try Worker first
  if (isWorkerConfigured) {
    const data = await fetchFromWorker('/api/quotes', {
      symbols: symbols.join(','),
    });

    if (data) {
      return data;
    }
  }

  // Fallback to direct Yahoo API
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

export default {
  isWorkerAvailable,
  fetchPrices,
  fetchQuotes,
  fetchProfiles,
  fetchExchangeRates,
  fetchConsensus,
  getWorkerStatus,
};
