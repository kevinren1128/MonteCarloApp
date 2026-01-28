/**
 * Consensus Data IndexedDB Service
 *
 * @module services/consensusDb
 * @description Persistent storage for consensus/analyst data using IndexedDB.
 * Stores raw API responses and processed data per ticker with timestamps
 * for intelligent cache invalidation and selective refresh.
 */

const DB_NAME = 'monte-carlo-consensus';
const DB_VERSION = 1;

// Object store names
const STORES = {
  TICKERS: 'tickers',      // Per-ticker consensus data
  ETF_LIST: 'etfList',     // Cached ETF list
  METADATA: 'metadata',    // App-level settings/state
};

// Default cache duration: 24 hours
const DEFAULT_CACHE_DURATION = 24 * 60 * 60 * 1000;

let dbInstance = null;

/**
 * Initialize and return the IndexedDB database instance
 * @returns {Promise<IDBDatabase>}
 */
const getDb = () => {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[ConsensusDB] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[ConsensusDB] Database opened successfully');
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('[ConsensusDB] Upgrading database schema...');

      // Tickers store - primary store for consensus data
      if (!db.objectStoreNames.contains(STORES.TICKERS)) {
        const tickerStore = db.createObjectStore(STORES.TICKERS, { keyPath: 'symbol' });
        tickerStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
        tickerStore.createIndex('status', 'status', { unique: false });
      }

      // ETF list store - cached list of all ETF symbols
      if (!db.objectStoreNames.contains(STORES.ETF_LIST)) {
        db.createObjectStore(STORES.ETF_LIST, { keyPath: 'id' });
      }

      // Metadata store - app settings and state
      if (!db.objectStoreNames.contains(STORES.METADATA)) {
        db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }
    };
  });
};

/**
 * Generic helper to perform a transaction
 * @param {string} storeName - Object store name
 * @param {string} mode - 'readonly' or 'readwrite'
 * @param {Function} callback - Function receiving the object store
 * @returns {Promise<any>}
 */
const withStore = async (storeName, mode, callback) => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    try {
      const result = callback(store);

      if (result instanceof IDBRequest) {
        result.onsuccess = () => resolve(result.result);
        result.onerror = () => reject(result.error);
      } else {
        transaction.oncomplete = () => resolve(result);
      }
    } catch (err) {
      reject(err);
    }

    transaction.onerror = () => reject(transaction.error);
  });
};

// ============================================
// TICKER DATA OPERATIONS
// ============================================

/**
 * Save consensus data for a ticker
 * @param {string} symbol - Ticker symbol
 * @param {Object} data - Processed consensus data
 * @param {Object} rawData - Raw API responses (optional, for debugging)
 * @param {string} status - 'complete' | 'partial' | 'error' | 'etf'
 */
export const saveTickerData = async (symbol, data, rawData = null, status = 'complete') => {
  const record = {
    symbol: symbol.toUpperCase(),
    data,
    rawData,
    status,
    lastUpdated: Date.now(),
    expiresAt: Date.now() + DEFAULT_CACHE_DURATION,
  };

  await withStore(STORES.TICKERS, 'readwrite', (store) => store.put(record));
  console.log(`[ConsensusDB] Saved data for ${symbol}`);
};

/**
 * Get consensus data for a ticker
 * @param {string} symbol - Ticker symbol
 * @returns {Promise<Object|null>} Ticker record or null if not found
 */
export const getTickerData = async (symbol) => {
  return withStore(STORES.TICKERS, 'readonly', (store) =>
    store.get(symbol.toUpperCase())
  );
};

/**
 * Get all ticker data
 * @returns {Promise<Object>} Map of symbol -> data
 */
export const getAllTickerData = async () => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.TICKERS, 'readonly');
    const store = transaction.objectStore(STORES.TICKERS);
    const request = store.getAll();

    request.onsuccess = () => {
      const result = {};
      for (const record of request.result) {
        result[record.symbol] = record;
      }
      resolve(result);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Get processed data for all tickers (for display)
 * @returns {Promise<Object>} Map of symbol -> processed data
 */
export const getAllProcessedData = async () => {
  const allData = await getAllTickerData();
  const result = {};
  for (const [symbol, record] of Object.entries(allData)) {
    if (record.data) {
      result[symbol] = record.data;
    }
  }
  return result;
};

/**
 * Delete ticker data
 * @param {string} symbol - Ticker symbol
 */
export const deleteTickerData = async (symbol) => {
  await withStore(STORES.TICKERS, 'readwrite', (store) =>
    store.delete(symbol.toUpperCase())
  );
  console.log(`[ConsensusDB] Deleted data for ${symbol}`);
};

/**
 * Check if ticker data is stale (expired)
 * @param {string} symbol - Ticker symbol
 * @returns {Promise<boolean>} True if data is stale or missing
 */
export const isTickerStale = async (symbol) => {
  const record = await getTickerData(symbol);
  if (!record) return true;
  return Date.now() > record.expiresAt;
};

/**
 * Get list of tickers that need refresh
 * @param {string[]} symbols - List of symbols to check
 * @returns {Promise<string[]>} Symbols that are stale or missing
 */
export const getStaleSymbols = async (symbols) => {
  const allData = await getAllTickerData();
  const now = Date.now();

  return symbols.filter(symbol => {
    const record = allData[symbol.toUpperCase()];
    if (!record) return true;
    if (record.status === 'error') return true; // Retry errors
    return now > record.expiresAt;
  });
};

/**
 * Get list of tickers with errors (for retry)
 * @returns {Promise<string[]>} Symbols with error status
 */
export const getErrorSymbols = async () => {
  const allData = await getAllTickerData();
  return Object.entries(allData)
    .filter(([_, record]) => record.status === 'error')
    .map(([symbol]) => symbol);
};

/**
 * Clear all ticker data
 */
export const clearAllTickerData = async () => {
  await withStore(STORES.TICKERS, 'readwrite', (store) => store.clear());
  console.log('[ConsensusDB] Cleared all ticker data');
};

// ============================================
// ETF LIST OPERATIONS
// ============================================

/**
 * Save ETF list
 * @param {Set<string>|string[]} symbols - ETF symbols
 */
export const saveEtfList = async (symbols) => {
  const symbolArray = Array.from(symbols);
  const record = {
    id: 'etf-list',
    symbols: symbolArray,
    lastUpdated: Date.now(),
    expiresAt: Date.now() + DEFAULT_CACHE_DURATION,
  };

  await withStore(STORES.ETF_LIST, 'readwrite', (store) => store.put(record));
  console.log(`[ConsensusDB] Saved ETF list with ${symbolArray.length} symbols`);
};

/**
 * Get ETF list
 * @returns {Promise<Set<string>|null>} Set of ETF symbols or null
 */
export const getEtfList = async () => {
  const record = await withStore(STORES.ETF_LIST, 'readonly', (store) =>
    store.get('etf-list')
  );

  if (!record) return null;
  if (Date.now() > record.expiresAt) return null; // Expired

  return new Set(record.symbols);
};

// ============================================
// METADATA OPERATIONS
// ============================================

/**
 * Save metadata value
 * @param {string} key - Metadata key
 * @param {any} value - Value to store
 */
export const saveMetadata = async (key, value) => {
  await withStore(STORES.METADATA, 'readwrite', (store) =>
    store.put({ key, value, updatedAt: Date.now() })
  );
};

/**
 * Get metadata value
 * @param {string} key - Metadata key
 * @returns {Promise<any>} Stored value or undefined
 */
export const getMetadata = async (key) => {
  const record = await withStore(STORES.METADATA, 'readonly', (store) =>
    store.get(key)
  );
  return record?.value;
};

/**
 * Get last refresh timestamp
 * @returns {Promise<number|null>}
 */
export const getLastRefreshTime = async () => {
  return getMetadata('lastRefreshTime');
};

/**
 * Set last refresh timestamp
 */
export const setLastRefreshTime = async () => {
  await saveMetadata('lastRefreshTime', Date.now());
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get database statistics
 * @returns {Promise<Object>} Stats about stored data
 */
export const getDbStats = async () => {
  const allData = await getAllTickerData();
  const etfList = await getEtfList();
  const lastRefresh = await getLastRefreshTime();

  const symbols = Object.keys(allData);
  const complete = symbols.filter(s => allData[s].status === 'complete').length;
  const errors = symbols.filter(s => allData[s].status === 'error').length;
  const etfs = symbols.filter(s => allData[s].status === 'etf').length;
  const stale = symbols.filter(s => Date.now() > allData[s].expiresAt).length;

  return {
    totalTickers: symbols.length,
    complete,
    errors,
    etfs,
    stale,
    etfListSize: etfList?.size || 0,
    lastRefresh: lastRefresh ? new Date(lastRefresh).toISOString() : null,
  };
};

/**
 * Export all data (for backup/debugging)
 * @returns {Promise<Object>}
 */
export const exportAllData = async () => {
  const tickers = await getAllTickerData();
  const etfList = await getEtfList();
  const lastRefresh = await getLastRefreshTime();

  return {
    exportedAt: new Date().toISOString(),
    tickers,
    etfList: etfList ? Array.from(etfList) : null,
    lastRefresh,
  };
};

/**
 * Import data (from backup)
 * @param {Object} data - Exported data object
 */
export const importData = async (data) => {
  if (data.tickers) {
    const db = await getDb();
    const transaction = db.transaction(STORES.TICKERS, 'readwrite');
    const store = transaction.objectStore(STORES.TICKERS);

    for (const record of Object.values(data.tickers)) {
      store.put(record);
    }

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }

  if (data.etfList) {
    await saveEtfList(data.etfList);
  }

  console.log('[ConsensusDB] Data imported successfully');
};

/**
 * Close database connection (for cleanup)
 */
export const closeDb = () => {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
};

export default {
  // Ticker operations
  saveTickerData,
  getTickerData,
  getAllTickerData,
  getAllProcessedData,
  deleteTickerData,
  isTickerStale,
  getStaleSymbols,
  getErrorSymbols,
  clearAllTickerData,

  // ETF list operations
  saveEtfList,
  getEtfList,

  // Metadata operations
  saveMetadata,
  getMetadata,
  getLastRefreshTime,
  setLastRefreshTime,

  // Utility
  getDbStats,
  exportAllData,
  importData,
  closeDb,
};
