/**
 * Yahoo Finance API Service
 *
 * @module services/yahooFinance
 * @description Handles all Yahoo Finance API interactions including:
 * - Stock quotes and prices
 * - Historical price data
 * - Company profiles (sector/industry)
 * - Exchange rates
 *
 * Uses CORS proxies since Yahoo doesn't support browser-based requests directly.
 * Implements aggressive caching to work reliably even when proxies are down.
 */

// ============================================
// LOGGING UTILITIES
// ============================================

const LOG_PREFIX = '[YahooFinance]';

/**
 * Structured logging for frontend observability
 * Logs are visible in browser console and can be captured by monitoring tools
 */
const logger = {
  info: (message, data = {}) => {
    console.log(`${LOG_PREFIX} ${message}`, Object.keys(data).length > 0 ? data : '');
  },
  warn: (message, data = {}) => {
    console.warn(`${LOG_PREFIX} ${message}`, Object.keys(data).length > 0 ? data : '');
  },
  error: (message, data = {}) => {
    console.error(`${LOG_PREFIX} ${message}`, Object.keys(data).length > 0 ? data : '');
  },
  metric: (name, value, tags = {}) => {
    // For future: could send to analytics/monitoring service
    if (process.env.NODE_ENV === 'development') {
      console.log(`${LOG_PREFIX} [METRIC] ${name}=${value}`, tags);
    }
  },
};

// ============================================
// CACHE CONFIGURATION
// ============================================

const CACHE_KEY = 'yahoo-finance-cache-v1';
const CACHE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours
const CACHE_STALE_AGE = 24 * 60 * 60 * 1000; // 24 hours (use stale data if fresh fetch fails)

// In-memory cache for faster access
const memoryCache = new Map();

// Load cache from localStorage
const loadCache = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      Object.entries(parsed).forEach(([key, value]) => {
        memoryCache.set(key, value);
      });
      logger.info('Cache loaded from localStorage', { entries: Object.keys(parsed).length });
    }
  } catch (e) {
    logger.warn('Failed to load cache', { error: e.message });
  }
};

// Save cache to localStorage (debounced)
let saveTimeout = null;
const saveCache = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const obj = {};
      memoryCache.forEach((value, key) => {
        // Only save entries less than 24 hours old
        if (Date.now() - value.timestamp < CACHE_STALE_AGE) {
          obj[key] = value;
        }
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
    } catch (e) {
      // Quota exceeded - clear old entries
      const entries = [...memoryCache.entries()]
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, 50); // Keep only 50 most recent
      memoryCache.clear();
      entries.forEach(([k, v]) => memoryCache.set(k, v));
    }
  }, 1000);
};

// Initialize cache on load
loadCache();

// Get from cache
const getFromCache = (key) => {
  const cached = memoryCache.get(key);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  return {
    data: cached.data,
    isFresh: age < CACHE_MAX_AGE,
    isStale: age >= CACHE_MAX_AGE && age < CACHE_STALE_AGE,
    isExpired: age >= CACHE_STALE_AGE,
    age,
  };
};

// Save to cache
const saveToCache = (key, data) => {
  memoryCache.set(key, { data, timestamp: Date.now() });
  saveCache();
};

// ============================================
// CLOUDFLARE WORKER CONFIGURATION
// ============================================

// Cloudflare Worker URL for cached market data
const WORKER_URL = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_WORKER_URL
  : null;

const isWorkerConfigured = WORKER_URL &&
  !WORKER_URL.includes('your-subdomain') &&
  !WORKER_URL.includes('undefined') &&
  WORKER_URL.length > 0;

/**
 * Fetch from Cloudflare Worker API
 * @param {string} endpoint - API endpoint (e.g., '/api/prices')
 * @param {Object} params - Query parameters
 * @returns {Promise<Object|null>}
 */
const fetchFromWorker = async (endpoint, params = {}) => {
  if (!isWorkerConfigured) return null;

  const startTime = performance.now();
  try {
    const url = new URL(endpoint, WORKER_URL);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);

    const duration = Math.round(performance.now() - startTime);

    if (!response.ok) {
      logger.warn('Worker fetch failed', { endpoint, status: response.status, duration });
      return null;
    }

    const data = await response.json();
    logger.metric('worker_fetch_ms', duration, { endpoint });
    return data;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    if (error.name === 'AbortError') {
      logger.warn('Worker fetch timeout', { endpoint, duration });
    } else {
      logger.warn('Worker fetch error', { endpoint, error: error.message, duration });
    }
    return null;
  }
};

// ============================================
// CORS PROXY CONFIGURATION (fallback)
// ============================================

// Custom proxy URL from environment (legacy)
const CUSTOM_PROXY_URL = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_CORS_PROXY_URL
  : null;

// Build proxy list dynamically
const getProxies = () => {
  const proxies = [];

  // Custom proxy first (most reliable if configured)
  if (CUSTOM_PROXY_URL) {
    proxies.push({
      name: 'custom',
      buildUrl: (url) => `${CUSTOM_PROXY_URL}?url=${encodeURIComponent(url)}`,
      parseResponse: async (response) => {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          return null;
        }
      },
    });
  }

  // Public proxies as fallback
  proxies.push(
    {
      name: 'allorigins-raw',
      buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      parseResponse: async (response) => {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          return null;
        }
      },
    },
    {
      name: 'allorigins-get',
      buildUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      parseResponse: async (response) => {
        const data = await response.json();
        if (data.contents) {
          try {
            return JSON.parse(data.contents);
          } catch (e) {
            return null;
          }
        }
        return null;
      },
    }
  );

  return proxies;
};

// Track proxy success rates
const proxyStats = {};

const recordProxyResult = (name, success) => {
  if (!proxyStats[name]) {
    proxyStats[name] = { successes: 0, failures: 0, lastSuccess: 0 };
  }
  if (success) {
    proxyStats[name].successes++;
    proxyStats[name].lastSuccess = Date.now();
  } else {
    proxyStats[name].failures++;
  }
};

// Sort proxies by reliability
const getSortedProxies = () => {
  const proxies = getProxies();
  return proxies.sort((a, b) => {
    const aStats = proxyStats[a.name] || { successes: 0, failures: 0, lastSuccess: 0 };
    const bStats = proxyStats[b.name] || { successes: 0, failures: 0, lastSuccess: 0 };

    // Prefer proxies that worked recently
    const recentThreshold = 5 * 60 * 1000; // 5 minutes
    const aRecent = Date.now() - aStats.lastSuccess < recentThreshold;
    const bRecent = Date.now() - bStats.lastSuccess < recentThreshold;
    if (aRecent && !bRecent) return -1;
    if (bRecent && !aRecent) return 1;

    // Then by success rate
    const aTotal = aStats.successes + aStats.failures;
    const bTotal = bStats.successes + bStats.failures;
    if (aTotal === 0 && bTotal === 0) return 0;
    if (aTotal === 0) return 1;
    if (bTotal === 0) return -1;

    return (bStats.successes / bTotal) - (aStats.successes / aTotal);
  });
};

// ============================================
// FETCH WITH RETRY AND CACHE
// ============================================

/**
 * Sleep for a given duration
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Fetch data from Yahoo Finance with CORS proxy, caching, and retry logic
 * @param {string} url - Yahoo Finance API URL
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms per attempt (default: 12000)
 * @param {number} options.retries - Number of retry attempts (default: 2)
 * @param {boolean} options.useCache - Whether to use cache (default: true)
 * @returns {Promise<Object|null>} Parsed JSON response or null on failure
 */
export const fetchYahooData = async (url, { timeout = 12000, retries = 2, useCache = true } = {}) => {
  const startTime = performance.now();
  const cacheKey = url;
  const symbol = url.match(/chart\/([^?]+)/)?.[1] || url.match(/quoteSummary\/([^?]+)/)?.[1] || 'unknown';

  // Check cache first
  if (useCache) {
    const cached = getFromCache(cacheKey);
    if (cached?.isFresh) {
      logger.info('Cache hit (fresh)', { symbol, ageMin: Math.round(cached.age / 60000) });
      return cached.data;
    }
  }

  const sortedProxies = getSortedProxies();
  let lastError = null;
  let attemptsMade = 0;

  // Try each proxy with retries
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 1s, 2s, 4s...
      await sleep(Math.pow(2, attempt - 1) * 1000);
    }

    for (const proxy of sortedProxies) {
      attemptsMade++;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const proxyUrl = proxy.buildUrl(url);
        const response = await fetch(proxyUrl, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await proxy.parseResponse(response);
          if (data && !data.error) {
            recordProxyResult(proxy.name, true);
            const duration = Math.round(performance.now() - startTime);
            logger.info('Fetch success via proxy', { symbol, proxy: proxy.name, duration, attemptsMade });
            logger.metric('proxy_fetch_ms', duration, { proxy: proxy.name });
            // Save to cache
            if (useCache) {
              saveToCache(cacheKey, data);
            }
            return data;
          }
        }
        recordProxyResult(proxy.name, false);
      } catch (e) {
        clearTimeout(timeoutId);
        lastError = e;
        recordProxyResult(proxy.name, false);
      }
    }
  }

  // All attempts failed - try stale cache
  if (useCache) {
    const cached = getFromCache(cacheKey);
    if (cached && !cached.isExpired) {
      logger.warn('Using stale cache', { symbol, ageMin: Math.round(cached.age / 60000) });
      return cached.data;
    }
  }

  // Log failure
  const duration = Math.round(performance.now() - startTime);
  logger.error('Fetch failed after all retries', { symbol, attemptsMade, duration, lastError: lastError?.message });
  return null;
};

/**
 * Fetch current quote for a symbol
 * @param {string} symbol - Ticker symbol (e.g., 'AAPL')
 * @returns {Promise<{price: number, name: string, type: string, currency: string}|null>}
 */
export const fetchYahooQuote = async (symbol) => {
  const startTime = performance.now();

  // Try Cloudflare Worker first (shared cache - 15 min TTL)
  if (isWorkerConfigured) {
    const workerData = await fetchFromWorker('/api/quotes', { symbols: symbol });
    if (workerData?.[symbol]?.price) {
      const duration = Math.round(performance.now() - startTime);
      logger.info('Quote from Worker', { symbol, price: workerData[symbol].price, duration });
      return workerData[symbol];
    }
  }

  // Fallback to direct fetch via CORS proxy
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const data = await fetchYahooData(url);

    if (data?.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      const closes = result.indicators?.adjclose?.[0]?.adjclose ||
                     result.indicators?.quote?.[0]?.close || [];

      const latestPrice = meta?.regularMarketPrice ||
                          closes[closes.length - 1] ||
                          meta?.previousClose;

      if (latestPrice) {
        const duration = Math.round(performance.now() - startTime);
        logger.info('Quote from proxy', { symbol, price: latestPrice, duration });
        return {
          price: latestPrice,
          name: meta?.shortName || meta?.longName || symbol,
          type: meta?.instrumentType || (meta?.quoteType === 'ETF' ? 'ETF' : 'Equity'),
          currency: meta?.currency || 'USD',
        };
      }
    }
    logger.warn('Quote fetch returned no data', { symbol });
    return null;
  } catch (error) {
    logger.error('Quote fetch error', { symbol, error: error.message });
    return null;
  }
};

/**
 * Fetch historical price data
 * @param {string} symbol - Ticker symbol
 * @param {string} range - Time range ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max')
 * @param {string} interval - Data interval ('1d', '1wk', '1mo')
 * @param {Object} options - Additional options
 * @param {string} options.currency - Target currency ('USD' for conversion)
 * @returns {Promise<{prices: Array<{date: Date, close: number}>, currency: string, regularMarketPrice: number, localCurrency?: string, localPrices?: number[], fxRate?: number}|null>}
 */
export const fetchYahooHistory = async (symbol, range = '1y', interval = '1d', options = {}) => {
  const startTime = performance.now();
  const { currency } = options;

  // Try Cloudflare Worker first (shared cache)
  if (isWorkerConfigured) {
    const params = { symbols: symbol, range, interval };
    if (currency) {
      params.currency = currency;
    }
    const workerData = await fetchFromWorker('/api/prices', params);
    if (workerData?.[symbol]) {
      const d = workerData[symbol];
      const prices = [];
      const timestamps = d.timestamps || [];
      const closes = d.prices || [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null && !isNaN(closes[i])) {
          prices.push({
            date: new Date(timestamps[i] * 1000),
            close: closes[i],
          });
        }
      }
      if (prices.length > 0) {
        const duration = Math.round(performance.now() - startTime);
        const wasConverted = currency === 'USD' && d.localCurrency && d.localCurrency !== 'USD';
        logger.info('History from Worker', {
          symbol,
          dataPoints: prices.length,
          range,
          duration,
          ...(wasConverted && { converted: `${d.localCurrency}→USD`, fxRate: d.fxRate })
        });
        return {
          prices,
          currency: d.currency || 'USD',
          regularMarketPrice: d.meta?.regularMarketPrice || closes[closes.length - 1],
          // USD conversion metadata (present when currency=USD was requested for non-USD assets)
          ...(d.localCurrency && { localCurrency: d.localCurrency }),
          ...(d.localPrices && { localPrices: d.localPrices }),
          ...(d.fxRate !== undefined && { fxRate: d.fxRate }),
          ...(d.fxTimestamp && { fxTimestamp: d.fxTimestamp }),
        };
      }
    }
  }

  // Fallback to direct fetch via CORS proxy
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const data = await fetchYahooData(url);

    if (data?.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const meta = result.meta || {};
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.adjclose?.[0]?.adjclose ||
                     result.indicators?.quote?.[0]?.close || [];

      const prices = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null && !isNaN(closes[i])) {
          prices.push({
            date: new Date(timestamps[i] * 1000),
            close: closes[i],
          });
        }
      }
      const duration = Math.round(performance.now() - startTime);
      logger.info('History from proxy', { symbol, dataPoints: prices.length, range, duration });
      return {
        prices,
        currency: meta.currency || 'USD',
        regularMarketPrice: meta.regularMarketPrice || closes[closes.length - 1],
      };
    }
    logger.warn('History fetch returned no data', { symbol, range });
    return null;
  } catch (error) {
    logger.error('History fetch error', { symbol, range, error: error.message });
    return null;
  }
};

/**
 * Fetch raw history data (returns raw timestamp array too)
 * @param {string} symbol - Ticker symbol
 * @param {string} range - Time range
 * @param {string} interval - Data interval
 * @returns {Promise<{prices: Array, timestamps: Array, meta: Object}|null>}
 */
export const fetchYahooHistoryRaw = async (symbol, range = '1y', interval = '1d') => {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const data = await fetchYahooData(url);

    if (data?.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.adjclose?.[0]?.adjclose ||
                     result.indicators?.quote?.[0]?.close || [];

      const validIndices = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null && !isNaN(closes[i])) {
          validIndices.push(i);
        }
      }

      return {
        prices: validIndices.map(i => closes[i]),
        timestamps: validIndices.map(i => timestamps[i] * 1000),
        meta: result.meta,
      };
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch raw history for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch company profile (sector, industry)
 * @param {string} symbol - Ticker symbol
 * @returns {Promise<{sector: string, industry: string, longName: string, quoteType: string}|null>}
 */
export const fetchYahooProfile = async (symbol) => {
  const startTime = performance.now();

  // Try Cloudflare Worker first (shared cache - 7 day TTL)
  if (isWorkerConfigured) {
    const workerData = await fetchFromWorker('/api/profile', { symbols: symbol });
    if (workerData?.[symbol]) {
      const duration = Math.round(performance.now() - startTime);
      logger.info('Profile from Worker', { symbol, sector: workerData[symbol].sector, duration });
      return workerData[symbol];
    }
  }

  // Fallback to direct fetch via CORS proxy
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=assetProfile,summaryProfile,quoteType,summaryDetail`;
    const data = await fetchYahooData(url);

    if (data?.quoteSummary?.result?.[0]) {
      const result = data.quoteSummary.result[0];
      const profile = result.assetProfile || result.summaryProfile || {};
      const quoteType = result.quoteType || {};

      const duration = Math.round(performance.now() - startTime);
      logger.info('Profile from proxy', { symbol, sector: profile.sector, duration });
      return {
        sector: profile.sector || null,
        industry: profile.industry || null,
        longName: quoteType.longName || profile.longBusinessSummary?.slice(0, 100) || null,
        quoteType: quoteType.quoteType || 'EQUITY',
        shortName: quoteType.shortName || symbol,
      };
    }
    logger.warn('Profile fetch returned no data', { symbol });
    return null;
  } catch (error) {
    logger.error('Profile fetch error', { symbol, error: error.message });
    return null;
  }
};

/**
 * Fetch currency exchange rate
 * @param {string} fromCurrency - Source currency code (e.g., 'EUR')
 * @param {string} toCurrency - Target currency code (e.g., 'USD')
 * @returns {Promise<number|null>} Exchange rate or null
 */
export const fetchExchangeRate = async (fromCurrency, toCurrency = 'USD') => {
  if (fromCurrency === toCurrency) return 1;

  const startTime = performance.now();
  const pair = `${fromCurrency}${toCurrency}`;

  // Try Cloudflare Worker first (shared cache - 24 hour TTL)
  if (isWorkerConfigured) {
    const workerData = await fetchFromWorker('/api/fx', { pairs: pair });
    if (workerData?.[pair]?.rate) {
      const duration = Math.round(performance.now() - startTime);
      logger.info('FX rate from Worker', { pair, rate: workerData[pair].rate, duration });
      return workerData[pair].rate;
    }
  }

  // Fallback to direct fetch via CORS proxy
  try {
    const symbol = `${fromCurrency}${toCurrency}=X`;
    const reverseSymbol = `${toCurrency}${fromCurrency}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const reverseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${reverseSymbol}?interval=1d&range=1d`;

    const [data, reverseData] = await Promise.all([
      fetchYahooData(url).catch(() => null),
      fetchYahooData(reverseUrl).catch(() => null),
    ]);

    if (data?.chart?.result?.[0]) {
      const meta = data.chart.result[0].meta;
      const rate = meta?.regularMarketPrice || meta?.previousClose;
      if (rate) {
        const duration = Math.round(performance.now() - startTime);
        logger.info('FX rate from proxy', { pair, rate, duration });
        return rate;
      }
    }

    if (reverseData?.chart?.result?.[0]) {
      const meta = reverseData.chart.result[0].meta;
      const rate = meta?.regularMarketPrice || meta?.previousClose;
      if (rate) {
        const invRate = 1 / rate;
        const duration = Math.round(performance.now() - startTime);
        logger.info('FX rate from proxy (inverted)', { pair, rate: invRate, duration });
        return invRate;
      }
    }

    logger.warn('FX rate fetch returned no data', { pair });
    return null;
  } catch (error) {
    logger.error('FX rate fetch error', { pair, error: error.message });
    return null;
  }
};

/**
 * Calculate calendar year returns from price data
 * @param {Array<{date: Date, close: number}>} prices - Price history
 * @returns {Object<string, number>} Object mapping year to return
 */
export const getCalendarYearReturns = (prices) => {
  if (!prices || prices.length === 0) return {};

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
 * Batch fetch multiple symbols with concurrency control
 * @param {string[]} symbols - Array of ticker symbols
 * @param {Function} fetchFn - Fetch function to use
 * @param {number} concurrency - Max concurrent requests (default: 3)
 * @returns {Promise<Object>} Object mapping symbol to result
 */
export const batchFetch = async (symbols, fetchFn, concurrency = 3) => {
  const results = {};
  const queue = [...symbols];

  const worker = async () => {
    while (queue.length > 0) {
      const symbol = queue.shift();
      if (symbol) {
        results[symbol] = await fetchFn(symbol);
        // Small delay between requests to avoid rate limiting
        await sleep(200);
      }
    }
  };

  const workers = Array(Math.min(concurrency, queue.length))
    .fill(null)
    .map(() => worker());

  await Promise.all(workers);
  return results;
};

/**
 * Clear the Yahoo Finance cache
 */
export const clearCache = () => {
  memoryCache.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // Ignore
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  let fresh = 0, stale = 0, expired = 0;
  memoryCache.forEach((value) => {
    const age = Date.now() - value.timestamp;
    if (age < CACHE_MAX_AGE) fresh++;
    else if (age < CACHE_STALE_AGE) stale++;
    else expired++;
  });
  return { total: memoryCache.size, fresh, stale, expired, proxyStats };
};

export default {
  fetchYahooData,
  fetchYahooQuote,
  fetchYahooHistory,
  fetchYahooHistoryRaw,
  fetchYahooProfile,
  fetchExchangeRate,
  getCalendarYearReturns,
  batchFetch,
  clearCache,
  getCacheStats,
};
