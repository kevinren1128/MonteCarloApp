/**
 * LocalStorage Configuration
 * 
 * @module constants/storage
 * @description Defines localStorage keys and cache configuration.
 * All persistent data is stored in localStorage with versioned keys
 * to handle schema migrations.
 */

/**
 * LocalStorage keys for different data types
 * Version numbers in keys force cache invalidation on schema changes
 */
export const STORAGE_KEYS = {
  /** User's portfolio (positions, cash, settings) */
  PORTFOLIO: 'monte-carlo-portfolio-v1',
  
  /** Unified market data cache (prices, returns, metadata) */
  MARKET_DATA: 'monte-carlo-unified-market-data-v6',
  
  /** User preferences and settings */
  SETTINGS: 'monte-carlo-settings-v1',
};

/**
 * Cache TTL (Time To Live) configurations
 */
export const CACHE_CONFIG = {
  /** Market data cache max age (4 hours in milliseconds) */
  MARKET_DATA_MAX_AGE: 4 * 60 * 60 * 1000,
  
  /** Quote data cache max age (15 minutes) */
  QUOTE_MAX_AGE: 15 * 60 * 1000,
  
  /** Profile data cache max age (24 hours - rarely changes) */
  PROFILE_MAX_AGE: 24 * 60 * 60 * 1000,
};

/**
 * Storage size limits (approximate)
 */
export const STORAGE_LIMITS = {
  /** Maximum localStorage quota (5MB typical) */
  MAX_TOTAL: 5 * 1024 * 1024,
  
  /** Target max size for market data cache */
  MARKET_DATA_TARGET: 1 * 1024 * 1024, // 1MB
  
  /** Warning threshold for storage usage */
  WARNING_THRESHOLD: 4 * 1024 * 1024,
};

/**
 * Save data to localStorage with error handling
 * @param {string} key - Storage key
 * @param {*} data - Data to store (will be JSON stringified)
 * @returns {boolean} Success status
 */
export const saveToStorage = (key, data) => {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(key, json);
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.warn(`Storage quota exceeded for ${key}. Attempting cleanup...`);
      // Could implement cleanup logic here
      return false;
    }
    console.error(`Error saving to storage (${key}):`, e);
    return false;
  }
};

/**
 * Load data from localStorage with error handling
 * @param {string} key - Storage key
 * @returns {*} Parsed data or null if not found/error
 */
export const loadFromStorage = (key) => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (e) {
    console.error(`Error loading from storage (${key}):`, e);
    return null;
  }
};

/**
 * Remove data from localStorage
 * @param {string} key - Storage key
 */
export const removeFromStorage = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Error removing from storage (${key}):`, e);
  }
};

/**
 * Get current storage usage
 * @returns {{ used: number, total: number, percentage: number }}
 */
export const getStorageUsage = () => {
  let used = 0;
  for (const key in localStorage) {
    if (localStorage.hasOwnProperty(key)) {
      used += localStorage.getItem(key).length * 2; // UTF-16 = 2 bytes per char
    }
  }
  return {
    used,
    total: STORAGE_LIMITS.MAX_TOTAL,
    percentage: (used / STORAGE_LIMITS.MAX_TOTAL) * 100,
  };
};

/**
 * Check if cache is stale
 * @param {number} cachedAt - Timestamp when data was cached
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {boolean} True if cache is stale
 */
export const isCacheStale = (cachedAt, maxAge) => {
  if (!cachedAt) return true;
  return Date.now() - cachedAt > maxAge;
};

export default {
  STORAGE_KEYS,
  CACHE_CONFIG,
  STORAGE_LIMITS,
  saveToStorage,
  loadFromStorage,
  removeFromStorage,
  getStorageUsage,
  isCacheStale,
};
