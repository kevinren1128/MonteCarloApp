/**
 * Factor ETF Price Cache Service
 *
 * Provides persistent localStorage caching for factor ETF price data
 * with incremental updates to minimize API calls.
 *
 * @module services/factorETFCache
 */

import { fetchYahooHistory } from './yahooFinance';
import { ALL_FACTOR_ETFS } from '../utils/factorDefinitions';

// Cache configuration
const CACHE_KEY = 'monte-carlo-factor-etf-prices-v1';
const CACHE_VERSION = 1;
const MAX_HISTORY_DAYS = 630; // ~2.5 years of trading days
const MAX_GAP_DAYS = 30; // If gap > 30 days, do full refresh
const FETCH_DELAY_MS = 100; // Delay between ETF fetches to avoid rate limits

/**
 * Load cached factor ETF data from localStorage
 * @returns {Object|null} Cached data or null if not found/invalid
 */
export const loadFactorETFCache = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Validate structure
    if (data.version !== CACHE_VERSION || !data.etfs || !data.lastUpdated) {
      console.log('[FactorCache] Invalid cache structure, will refresh');
      return null;
    }

    // Check if we have enough ETFs cached
    const cachedETFs = Object.keys(data.etfs);
    if (cachedETFs.length < ALL_FACTOR_ETFS.length * 0.8) {
      console.log(`[FactorCache] Only ${cachedETFs.length}/${ALL_FACTOR_ETFS.length} ETFs cached, will refresh`);
      return null;
    }

    return data;
  } catch (e) {
    console.warn('[FactorCache] Failed to load cache:', e);
    return null;
  }
};

/**
 * Save factor ETF data to localStorage
 * @param {Object} data - Cache data to save
 * @returns {boolean} Success status
 */
export const saveFactorETFCache = (data) => {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(CACHE_KEY, json);
    console.log(`[FactorCache] Saved ${(json.length / 1024).toFixed(1)} KB`);
    return true;
  } catch (e) {
    console.error('[FactorCache] Failed to save:', e);
    // Try to clear old data if quota exceeded
    if (e.name === 'QuotaExceededError') {
      console.log('[FactorCache] Quota exceeded, clearing old cache');
      localStorage.removeItem(CACHE_KEY);
    }
    return false;
  }
};

/**
 * Clear the factor ETF cache
 */
export const clearFactorETFCache = () => {
  localStorage.removeItem(CACHE_KEY);
  console.log('[FactorCache] Cache cleared');
};

/**
 * Check if a date is a trading day (not weekend)
 * Note: Doesn't account for holidays, but that's okay - we'll just get no data
 * @param {Date} date
 * @returns {boolean}
 */
const isTradingDay = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6; // Not Sunday (0) or Saturday (6)
};

/**
 * Get today's date in YYYY-MM-DD format (EST timezone for US markets)
 * @returns {string}
 */
const getTodayEST = () => {
  const now = new Date();
  // Convert to EST (UTC-5) - simplified, doesn't account for DST perfectly
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
 * Calculate trading days between two dates
 * @param {string} fromDate - YYYY-MM-DD
 * @param {string} toDate - YYYY-MM-DD
 * @returns {number} Approximate trading days
 */
const tradingDaysBetween = (fromDate, toDate) => {
  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  const diffDays = Math.floor((to - from) / (1000 * 60 * 60 * 24));
  // Rough estimate: ~5/7 of calendar days are trading days
  return Math.floor(diffDays * 5 / 7);
};

/**
 * Determine if we need to fetch new data
 * @param {Object|null} cache - Current cache data
 * @returns {{needsFetch: boolean, fetchType: string, reason: string}}
 */
export const checkUpdateNeeded = (cache) => {
  const today = getTodayEST();
  const now = Date.now();

  // No cache - need full fetch
  if (!cache) {
    return { needsFetch: true, fetchType: 'full', reason: 'No cache exists' };
  }

  // Already fetched today - skip
  if (cache.lastFetchAttempt) {
    const lastFetchDate = new Date(cache.lastFetchAttempt).toISOString().split('T')[0];
    if (lastFetchDate === today) {
      return { needsFetch: false, fetchType: 'none', reason: 'Already fetched today' };
    }
  }

  // Check gap since last update
  const lastUpdated = cache.lastUpdated;
  const gapDays = tradingDaysBetween(lastUpdated, today);

  // No gap or weekend - might still need to check
  if (gapDays <= 0) {
    // Check if it's a weekend
    const todayDate = parseDate(today);
    if (!isTradingDay(todayDate)) {
      return { needsFetch: false, fetchType: 'none', reason: 'Weekend - no new data' };
    }
    // Might be same day or just a holiday
    return { needsFetch: true, fetchType: 'incremental', reason: 'Checking for new data' };
  }

  // Large gap - do full refresh
  if (gapDays > MAX_GAP_DAYS) {
    return { needsFetch: true, fetchType: 'full', reason: `Gap of ${gapDays} days too large` };
  }

  // Normal incremental update
  return { needsFetch: true, fetchType: 'incremental', reason: `${gapDays} trading days to fetch` };
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
  return '6mo';
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
      p: Math.round(h.close * 100) / 100, // Round to 2 decimals
    }));
};

/**
 * Merge new data into existing cache, avoiding duplicates
 * @param {Array} existing - Existing compact data
 * @param {Array} newData - New compact data
 * @returns {Array} Merged and sorted data
 */
const mergeData = (existing, newData) => {
  // Create a map of existing dates for fast lookup
  const dateMap = new Map(existing.map(e => [e.d, e]));

  // Add/update with new data
  for (const item of newData) {
    dateMap.set(item.d, item);
  }

  // Convert back to array and sort by date
  const merged = Array.from(dateMap.values());
  merged.sort((a, b) => a.d.localeCompare(b.d));

  // Trim to max history
  if (merged.length > MAX_HISTORY_DAYS) {
    return merged.slice(-MAX_HISTORY_DAYS);
  }

  return merged;
};

/**
 * Fetch factor ETF data (full or incremental) with parallel requests
 * @param {string} fetchType - 'full' or 'incremental'
 * @param {Object|null} existingCache - Current cache for incremental updates
 * @param {Function} onProgress - Progress callback (current, total, etf)
 * @returns {Promise<Object>} Updated cache data
 */
export const fetchFactorETFData = async (fetchType, existingCache, onProgress) => {
  const etfs = ALL_FACTOR_ETFS;
  const total = etfs.length;
  const today = getTodayEST();

  // Determine range to fetch
  let range = '2y'; // Full fetch default
  if (fetchType === 'incremental' && existingCache?.lastUpdated) {
    const gapDays = tradingDaysBetween(existingCache.lastUpdated, today);
    range = getRangeForDays(gapDays + 5); // Add buffer
  }

  console.log(`[FactorCache] Fetching ${fetchType} data with range=${range} for ${total} ETFs (parallel)`);

  const newCache = {
    version: CACHE_VERSION,
    lastUpdated: existingCache?.lastUpdated || '',
    lastFetchAttempt: Date.now(),
    etfs: existingCache?.etfs ? { ...existingCache.etfs } : {},
  };

  let latestDate = existingCache?.lastUpdated || '';

  // Build fetch tasks
  const fetchTasks = etfs.map(etf => ({ etf, range }));

  // Parallel fetch with concurrency limit
  const CONCURRENCY = 5; // Fetch 5 at a time
  let completed = 0;
  let successCount = 0;

  const processBatch = async (batch) => {
    const results = await Promise.allSettled(
      batch.map(async ({ etf, range: fetchRange }) => {
        const history = await fetchYahooHistory(etf, fetchRange, '1d');
        return { etf, history };
      })
    );

    for (const result of results) {
      completed++;
      if (onProgress) {
        onProgress(completed, total, result.status === 'fulfilled' ? result.value.etf : '...');
      }

      if (result.status === 'fulfilled' && result.value.history?.length > 0) {
        const { etf, history } = result.value;
        const compactData = toCompactFormat(history);

        if (compactData.length > 0) {
          // Merge with existing data if incremental
          if (fetchType === 'incremental' && newCache.etfs[etf]) {
            newCache.etfs[etf] = mergeData(newCache.etfs[etf], compactData);
          } else {
            newCache.etfs[etf] = compactData;
          }

          // Track latest date
          const etfLatest = compactData[compactData.length - 1].d;
          if (etfLatest > latestDate) {
            latestDate = etfLatest;
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
  console.log(`[FactorCache] Fetched ${successCount}/${total} ETFs, latest date: ${latestDate}`);

  return newCache;
};

/**
 * Main update function - checks if update needed and fetches if so
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<{cache: Object, updated: boolean, reason: string}>}
 */
export const updateFactorETFCache = async (onProgress) => {
  const existingCache = loadFactorETFCache();
  const { needsFetch, fetchType, reason } = checkUpdateNeeded(existingCache);

  console.log(`[FactorCache] Update check: ${reason} (fetchType=${fetchType})`);

  if (!needsFetch) {
    return { cache: existingCache, updated: false, reason };
  }

  try {
    const newCache = await fetchFactorETFData(fetchType, existingCache, onProgress);
    saveFactorETFCache(newCache);
    return { cache: newCache, updated: true, reason };
  } catch (err) {
    console.error('[FactorCache] Update failed:', err);
    // Return existing cache if available
    if (existingCache) {
      return { cache: existingCache, updated: false, reason: 'Update failed, using stale cache' };
    }
    throw err;
  }
};

/**
 * Calculate daily returns from price data
 * @param {Array} prices - Array of {d, p} objects
 * @returns {Array} Array of {date, return} objects
 */
const calculateReturns = (prices) => {
  if (!prices || prices.length < 2) return [];

  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1].p;
    const curr = prices[i].p;
    if (prev > 0) {
      returns.push({
        date: prices[i].d,
        return: (curr - prev) / prev,
      });
    }
  }
  return returns;
};

/**
 * Get cached returns data in the format expected by factor analysis
 * @param {Object} cache - Cache data
 * @param {string} timeline - '1y', '2y', '3y', or '5y'
 * @returns {Object} Map of ETF ticker to returns array
 */
export const getCachedReturns = (cache, timeline = '2y') => {
  if (!cache?.etfs) return null;

  // Determine how many trading days to use
  const daysMap = {
    '1y': 252,
    '2y': 504,
    '3y': 756,
    '5y': 1260,
  };
  const targetDays = daysMap[timeline] || 504;

  const result = {};

  for (const [etf, prices] of Object.entries(cache.etfs)) {
    if (!prices || prices.length < 2) continue;

    // Get the most recent N days of prices
    const recentPrices = prices.slice(-targetDays - 1); // +1 for return calculation
    const returns = calculateReturns(recentPrices);

    if (returns.length > 0) {
      result[etf] = returns.map(r => r.return);
    }
  }

  return result;
};

/**
 * Get cache statistics for display
 * @returns {Object} Stats about the cache
 */
export const getCacheStats = () => {
  const cache = loadFactorETFCache();

  if (!cache) {
    return { exists: false };
  }

  const etfCount = Object.keys(cache.etfs).length;
  const sampleETF = cache.etfs[Object.keys(cache.etfs)[0]];
  const dataPoints = sampleETF?.length || 0;

  // Estimate size
  const json = JSON.stringify(cache);
  const sizeKB = (json.length / 1024).toFixed(1);

  return {
    exists: true,
    lastUpdated: cache.lastUpdated,
    etfCount,
    dataPoints,
    sizeKB,
    lastFetchAttempt: cache.lastFetchAttempt
      ? new Date(cache.lastFetchAttempt).toLocaleString()
      : 'Never',
  };
};

export default {
  loadFactorETFCache,
  saveFactorETFCache,
  clearFactorETFCache,
  updateFactorETFCache,
  getCachedReturns,
  getCacheStats,
  checkUpdateNeeded,
};
