/**
 * Position Price Cache Service
 *
 * Provides persistent localStorage caching for portfolio position price data
 * with incremental updates to minimize API calls.
 *
 * Key differences from factorETFCache:
 * - Tickers are dynamic (based on current portfolio)
 * - Cache is pruned to only include current positions (no bloat)
 * - Same incremental update logic for new trading days
 *
 * @module services/positionPriceCache
 */

import { fetchYahooHistory } from './yahooFinance';

// Cache configuration
const CACHE_KEY = 'monte-carlo-position-prices-v2'; // v2: currency info support
const CACHE_VERSION = 2;
const MAX_HISTORY_DAYS = 756; // ~3 years of trading days (max timeline option in app)
const MAX_GAP_DAYS = 30; // If gap > 30 days, do full refresh
const FETCH_DELAY_MS = 100; // Delay between fetches to avoid rate limits

/**
 * Load cached position price data from localStorage
 * @returns {Object|null} Cached data or null if not found/invalid
 */
export const loadPositionPriceCache = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Validate structure
    if (data.version !== CACHE_VERSION || !data.positions || !data.lastUpdated) {
      console.log('[PositionCache] Invalid cache structure, will refresh');
      return null;
    }

    return data;
  } catch (e) {
    console.warn('[PositionCache] Failed to load cache:', e);
    return null;
  }
};

/**
 * Save position price data to localStorage
 * @param {Object} data - Cache data to save
 * @returns {boolean} Success status
 */
export const savePositionPriceCache = (data) => {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(CACHE_KEY, json);
    console.log(`[PositionCache] Saved ${(json.length / 1024).toFixed(1)} KB for ${Object.keys(data.positions).length} positions`);
    return true;
  } catch (e) {
    console.error('[PositionCache] Failed to save:', e);
    if (e.name === 'QuotaExceededError') {
      console.log('[PositionCache] Quota exceeded, clearing old cache');
      localStorage.removeItem(CACHE_KEY);
    }
    return false;
  }
};

/**
 * Clear the position price cache
 */
export const clearPositionPriceCache = () => {
  localStorage.removeItem(CACHE_KEY);
  console.log('[PositionCache] Cache cleared');
};

/**
 * Get today's date in YYYY-MM-DD format (EST timezone for US markets)
 * @returns {string}
 */
const getTodayEST = () => {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return est.toISOString().split('T')[0];
};

/**
 * Parse a date string to Date object
 * @param {string} dateStr - YYYY-MM-DD format
 * @returns {Date}
 */
const parseDate = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Check if a date is a trading day (not weekend)
 * @param {Date} date
 * @returns {boolean}
 */
const isTradingDay = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

/**
 * Calculate trading days between two dates
 * @param {string} fromDate - YYYY-MM-DD
 * @param {string} toDate - YYYY-MM-DD
 * @returns {number} Approximate trading days
 */
const tradingDaysBetween = (fromDate, toDate) => {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  const diffDays = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays * 5 / 7);
};

/**
 * Determine the Yahoo Finance range parameter for incremental fetch
 * @param {number} daysNeeded - Approximate trading days needed
 * @returns {string} Yahoo Finance range parameter
 */
const getRangeForDays = (daysNeeded) => {
  if (daysNeeded <= 5) return '5d';
  if (daysNeeded <= 20) return '1mo';
  if (daysNeeded <= 60) return '3mo';
  if (daysNeeded <= 120) return '6mo';
  return '1y';
};

/**
 * Convert Yahoo Finance history data to compact cache format
 * @param {Array} history - Array of {date: Date, close: number}
 * @returns {Array} Compact format [{d, p}, ...]
 */
const toCompactFormat = (history) => {
  return history
    .filter(h => h.close != null && !isNaN(h.close))
    .map(h => ({
      d: h.date instanceof Date ? h.date.toISOString().split('T')[0] : h.date,
      p: Math.round(h.close * 100) / 100,
    }));
};

/**
 * Merge new data into existing cache, avoiding duplicates
 * @param {Array} existing - Existing compact data
 * @param {Array} newData - New compact data
 * @returns {Array} Merged and sorted data
 */
const mergeData = (existing, newData) => {
  const dateMap = new Map(existing.map(e => [e.d, e]));

  for (const item of newData) {
    dateMap.set(item.d, item);
  }

  const merged = Array.from(dateMap.values());
  merged.sort((a, b) => a.d.localeCompare(b.d));

  if (merged.length > MAX_HISTORY_DAYS) {
    return merged.slice(-MAX_HISTORY_DAYS);
  }

  return merged;
};

/**
 * Check if we need to fetch new data for positions
 * @param {Object|null} cache - Current cache data
 * @param {Array<string>} currentTickers - Current portfolio tickers
 * @returns {{needsFetch: boolean, fetchType: string, reason: string, newTickers: Array, existingTickers: Array}}
 */
export const checkPositionUpdateNeeded = (cache, currentTickers) => {
  const today = getTodayEST();
  const normalizedTickers = currentTickers.map(t => t.toUpperCase());

  // No cache - need full fetch
  if (!cache) {
    return {
      needsFetch: true,
      fetchType: 'full',
      reason: 'No cache exists',
      newTickers: normalizedTickers,
      existingTickers: [],
    };
  }

  // Already fetched today - check for new tickers only
  const lastFetchDate = cache.lastFetchAttempt
    ? new Date(cache.lastFetchAttempt).toISOString().split('T')[0]
    : null;

  // Find new tickers not in cache
  const cachedTickers = Object.keys(cache.positions);
  const newTickers = normalizedTickers.filter(t => !cachedTickers.includes(t));
  const existingTickers = normalizedTickers.filter(t => cachedTickers.includes(t));

  if (lastFetchDate === today && newTickers.length === 0) {
    return {
      needsFetch: false,
      fetchType: 'none',
      reason: 'Already fetched today, no new tickers',
      newTickers: [],
      existingTickers,
    };
  }

  // Check gap since last update
  const gapDays = cache.lastUpdated ? tradingDaysBetween(cache.lastUpdated, today) : MAX_GAP_DAYS + 1;

  // Weekend check
  if (gapDays <= 0 && newTickers.length === 0) {
    const todayDate = parseDate(today);
    if (!isTradingDay(todayDate)) {
      return {
        needsFetch: false,
        fetchType: 'none',
        reason: 'Weekend - no new data',
        newTickers: [],
        existingTickers,
      };
    }
  }

  // Large gap - do full refresh for existing tickers
  if (gapDays > MAX_GAP_DAYS) {
    return {
      needsFetch: true,
      fetchType: 'full',
      reason: `Gap of ${gapDays} days too large`,
      newTickers: normalizedTickers, // Treat all as new for full refresh
      existingTickers: [],
    };
  }

  // Normal incremental update + any new tickers
  return {
    needsFetch: true,
    fetchType: newTickers.length > 0 ? 'mixed' : 'incremental',
    reason: newTickers.length > 0
      ? `${newTickers.length} new ticker(s), ${gapDays} trading days to fetch for existing`
      : `${gapDays} trading days to fetch`,
    newTickers,
    existingTickers,
  };
};

/**
 * Prune cache to only include current portfolio positions
 * This prevents cache bloat from old positions
 * @param {Object} cache - Current cache data
 * @param {Array<string>} currentTickers - Current portfolio tickers
 * @returns {Object} Pruned cache data
 */
export const pruneCache = (cache, currentTickers) => {
  if (!cache?.positions) return cache;

  const normalizedTickers = new Set(currentTickers.map(t => t.toUpperCase()));
  const prunedPositions = {};
  let removedCount = 0;

  for (const [ticker, data] of Object.entries(cache.positions)) {
    if (normalizedTickers.has(ticker)) {
      prunedPositions[ticker] = data;
    } else {
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`[PositionCache] Pruned ${removedCount} old ticker(s) from cache`);
  }

  return {
    ...cache,
    positions: prunedPositions,
  };
};

/**
 * Fetch position price data (full or incremental) with parallel requests
 * @param {Array<string>} tickers - Tickers to fetch
 * @param {string} fetchType - 'full', 'incremental', or 'mixed'
 * @param {Object|null} existingCache - Current cache for incremental updates
 * @param {Object} options - Options { newTickers, existingTickers }
 * @param {Function} onProgress - Progress callback (current, total, ticker)
 * @returns {Promise<Object>} Updated cache data
 */
export const fetchPositionPriceData = async (tickers, fetchType, existingCache, options = {}, onProgress) => {
  const { newTickers = [], existingTickers = [] } = options;
  const today = getTodayEST();
  const total = tickers.length;

  console.log(`[PositionCache] Fetching ${fetchType} data for ${total} positions (parallel)`);

  // Start with existing cache data (pruned to current positions)
  const prunedCache = existingCache ? pruneCache(existingCache, tickers) : null;

  const newCache = {
    version: CACHE_VERSION,
    lastUpdated: prunedCache?.lastUpdated || '',
    lastFetchAttempt: Date.now(),
    positions: prunedCache?.positions ? { ...prunedCache.positions } : {},
  };

  let latestDate = prunedCache?.lastUpdated || '';

  // Determine range for incremental fetch
  let incrementalRange = '5d';
  if (fetchType === 'incremental' || fetchType === 'mixed') {
    if (prunedCache?.lastUpdated) {
      const gapDays = tradingDaysBetween(prunedCache.lastUpdated, today);
      incrementalRange = getRangeForDays(gapDays + 5);
    }
  }

  // Build fetch tasks
  const fetchTasks = tickers.map(t => {
    const ticker = t.toUpperCase();
    let range;
    if (fetchType === 'full') {
      range = '3y';
    } else if (newTickers.includes(ticker)) {
      range = '3y';
    } else {
      range = incrementalRange;
    }
    return { ticker, range, isNew: newTickers.includes(ticker) };
  });

  // Parallel fetch with concurrency limit
  const CONCURRENCY = 5; // Fetch 5 at a time
  let completed = 0;
  let successCount = 0;

  const processBatch = async (batch) => {
    const results = await Promise.allSettled(
      batch.map(async ({ ticker, range, isNew }) => {
        const historyResult = await fetchYahooHistory(ticker, range, '1d');
        return { ticker, history: historyResult?.prices || null, isNew };
      })
    );

    for (const result of results) {
      completed++;
      if (onProgress) {
        onProgress(completed, total, result.status === 'fulfilled' ? result.value.ticker : '...');
      }

      if (result.status === 'fulfilled' && result.value.history?.length > 0) {
        const { ticker, history, isNew } = result.value;
        const compactData = toCompactFormat(history);

        if (compactData.length > 0) {
          // Merge with existing data if we have it
          if (newCache.positions[ticker] && !isNew) {
            newCache.positions[ticker] = mergeData(newCache.positions[ticker], compactData);
          } else {
            newCache.positions[ticker] = compactData;
          }

          // Track latest date
          const tickerLatest = compactData[compactData.length - 1].d;
          if (tickerLatest > latestDate) {
            latestDate = tickerLatest;
          }

          successCount++;
        }
      }
    }
  };

  // Process in batches
  for (let i = 0; i < fetchTasks.length; i += CONCURRENCY) {
    const batch = fetchTasks.slice(i, i + CONCURRENCY);
    await processBatch(batch);
    // Small delay between batches to avoid rate limits
    if (i + CONCURRENCY < fetchTasks.length) {
      await new Promise(r => setTimeout(r, FETCH_DELAY_MS));
    }
  }

  newCache.lastUpdated = latestDate;
  console.log(`[PositionCache] Fetched ${successCount}/${total} positions, latest date: ${latestDate}`);

  return newCache;
};

/**
 * Main update function - checks if update needed and fetches if so
 * @param {Array<string>} currentTickers - Current portfolio tickers
 * @param {Function} onProgress - Optional progress callback
 * @param {Object} options - Options { skipIncremental: boolean }
 * @returns {Promise<{cache: Object, updated: boolean, reason: string}>}
 */
export const updatePositionPriceCache = async (currentTickers, onProgress, options = {}) => {
  const { skipIncremental = false } = options;

  if (!currentTickers || currentTickers.length === 0) {
    console.log('[PositionCache] No tickers provided, skipping update');
    return { cache: null, updated: false, reason: 'No tickers' };
  }

  const existingCache = loadPositionPriceCache();
  const { needsFetch, fetchType, reason, newTickers, existingTickers } =
    checkPositionUpdateNeeded(existingCache, currentTickers);

  console.log(`[PositionCache] Update check: ${reason} (fetchType=${fetchType})`);

  // If skipIncremental is true, only fetch for truly NEW tickers (not in cache at all)
  // This makes Load All fast by using cached historical data as-is
  if (skipIncremental && fetchType === 'incremental') {
    console.log('[PositionCache] Skipping incremental update (using cached data)');
    const prunedCache = existingCache ? pruneCache(existingCache, currentTickers) : existingCache;
    if (prunedCache !== existingCache) {
      savePositionPriceCache(prunedCache);
    }
    return { cache: prunedCache, updated: false, reason: 'Using cached data (incremental skipped)' };
  }

  if (!needsFetch) {
    // Still prune cache to remove old positions
    const prunedCache = existingCache ? pruneCache(existingCache, currentTickers) : existingCache;
    if (prunedCache !== existingCache) {
      savePositionPriceCache(prunedCache);
    }
    return { cache: prunedCache, updated: false, reason };
  }

  // For mixed mode with skipIncremental, only fetch new tickers
  let tickersToFetch = currentTickers;
  let effectiveFetchType = fetchType;
  if (skipIncremental && fetchType === 'mixed') {
    tickersToFetch = newTickers;
    effectiveFetchType = 'full'; // Full history for new tickers only
    console.log(`[PositionCache] Fetching only ${newTickers.length} new tickers (skipping incremental for ${existingTickers.length} existing)`);
  }

  try {
    const newCache = await fetchPositionPriceData(
      tickersToFetch,
      effectiveFetchType,
      existingCache,
      { newTickers, existingTickers },
      onProgress
    );
    savePositionPriceCache(newCache);
    return { cache: newCache, updated: true, reason };
  } catch (err) {
    console.error('[PositionCache] Update failed:', err);
    if (existingCache) {
      return { cache: existingCache, updated: false, reason: 'Update failed, using stale cache' };
    }
    throw err;
  }
};

/**
 * Get cached price history for a ticker
 * @param {Object} cache - Cache data
 * @param {string} ticker - Ticker symbol
 * @returns {Array|null} Array of {date, close} or null if not cached
 */
export const getCachedPrices = (cache, ticker) => {
  if (!cache?.positions) return null;

  const data = cache.positions[ticker.toUpperCase()];
  if (!data) return null;

  return data.map(item => ({
    date: new Date(item.d),
    close: item.p,
  }));
};

/**
 * Get cache statistics for display
 * @returns {Object} Stats about the cache
 */
export const getPositionCacheStats = () => {
  const cache = loadPositionPriceCache();

  if (!cache) {
    return { exists: false };
  }

  const tickers = Object.keys(cache.positions);
  const sampleTicker = cache.positions[tickers[0]];
  const dataPoints = sampleTicker?.length || 0;

  const json = JSON.stringify(cache);
  const sizeKB = (json.length / 1024).toFixed(1);

  return {
    exists: true,
    lastUpdated: cache.lastUpdated,
    tickerCount: tickers.length,
    tickers,
    dataPoints,
    sizeKB,
    lastFetchAttempt: cache.lastFetchAttempt
      ? new Date(cache.lastFetchAttempt).toLocaleString()
      : 'Never',
  };
};

export default {
  loadPositionPriceCache,
  savePositionPriceCache,
  clearPositionPriceCache,
  updatePositionPriceCache,
  getCachedPrices,
  getPositionCacheStats,
  checkPositionUpdateNeeded,
  pruneCache,
};
