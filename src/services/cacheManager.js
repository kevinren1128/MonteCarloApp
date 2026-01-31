/**
 * Cache Manager Service
 * Handles localStorage and IndexedDB persistence for portfolio and market data
 * Uses LZ-String compression to reduce storage size
 */

// ============================================
// LZ-STRING COMPRESSION (inline implementation)
// ============================================

const LZString = (() => {
  const f = String.fromCharCode;
  const keyStrBase64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const baseReverseDic = {};

  function getBaseValue(alphabet, character) {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (let i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  }

  function compressToBase64(input) {
    if (input == null) return '';
    const res = _compress(input, 6, (a) => keyStrBase64.charAt(a));
    switch (res.length % 4) {
      case 0: return res;
      case 1: return res + '===';
      case 2: return res + '==';
      case 3: return res + '=';
    }
  }

  function decompressFromBase64(input) {
    if (input == null) return '';
    if (input === '') return null;
    return _decompress(input.length, 32, (index) => getBaseValue(keyStrBase64, input.charAt(index)));
  }

  function _compress(uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed == null) return '';
    let i, value;
    const context_dictionary = {};
    const context_dictionaryToCreate = {};
    let context_c = '';
    let context_wc = '';
    let context_w = '';
    let context_enlargeIn = 2;
    let context_dictSize = 3;
    let context_numBits = 2;
    let context_data = [];
    let context_data_val = 0;
    let context_data_position = 0;

    for (let ii = 0; ii < uncompressed.length; ii++) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }

      context_wc = context_w + context_c;
      if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
        context_w = context_wc;
      } else {
        if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) {
              context_data_val = context_data_val << 1;
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn === 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }

    if (context_w !== '') {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
        if (context_w.charCodeAt(0) < 256) {
          for (i = 0; i < context_numBits; i++) {
            context_data_val = context_data_val << 1;
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 8; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 16; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i = 0; i < context_numBits; i++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
      }
      context_enlargeIn--;
      if (context_enlargeIn === 0) {
        context_numBits++;
      }
    }

    value = 2;
    for (i = 0; i < context_numBits; i++) {
      context_data_val = (context_data_val << 1) | (value & 1);
      if (context_data_position === bitsPerChar - 1) {
        context_data_position = 0;
        context_data.push(getCharFromInt(context_data_val));
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }

    while (true) {
      context_data_val = context_data_val << 1;
      if (context_data_position === bitsPerChar - 1) {
        context_data.push(getCharFromInt(context_data_val));
        break;
      } else context_data_position++;
    }
    return context_data.join('');
  }

  function _decompress(length, resetValue, getNextValue) {
    const dictionary = [];
    let enlargeIn = 4;
    let dictSize = 4;
    let numBits = 3;
    let entry = '';
    const result = [];
    let i;
    let w;
    let c;
    let resb;
    const data = { val: getNextValue(0), position: resetValue, index: 1 };

    for (i = 0; i < 3; i++) {
      dictionary[i] = i;
    }

    let bits = 0;
    let maxpower = Math.pow(2, 2);
    let power = 1;
    while (power !== maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch (bits) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = f(bits);
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = f(bits);
        break;
      case 2:
        return '';
    }
    dictionary[3] = c;
    w = c;
    result.push(c);

    while (true) {
      if (data.index > length) {
        return '';
      }

      bits = 0;
      maxpower = Math.pow(2, numBits);
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch ((c = bits)) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }

          dictionary[dictSize++] = f(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = f(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 2:
          return result.join('');
      }

      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result.push(entry);
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;

      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

      w = entry;
    }
  }

  return { compressToBase64, decompressFromBase64 };
})();

// ============================================
// INDEXEDDB FALLBACK
// ============================================

const IDB_NAME = 'monte-carlo-db';
const IDB_STORE = 'portfolio';
const IDB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, IDB_VERSION);

    request.onerror = () => {
      console.warn('IndexedDB not available');
      resolve(null);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

async function saveToIDB(key, data) {
  try {
    const db = await openDB();
    if (!db) return false;

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({ key, data, timestamp: Date.now() });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (e) {
    return false;
  }
}

async function loadFromIDB(key) {
  try {
    const db = await openDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        resolve(request.result?.data || null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

// ============================================
// PORTFOLIO STORAGE
// ============================================

/**
 * LocalStorage key for portfolio data
 * @type {string}
 */
export const STORAGE_KEY = 'monte-carlo-portfolio-v2'; // v2: compressed format

/**
 * Clean up old cache entries to free space
 */
const cleanupOldCaches = () => {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('monte-carlo-') &&
      key !== STORAGE_KEY &&
      !key.includes('v2') // Keep current version caches
    )) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => {
    console.log(`Cleaning up old cache: ${key}`);
    localStorage.removeItem(key);
  });
  return keysToRemove.length;
};

/**
 * Progressively trim data to reduce size
 */
const trimDataForStorage = (data, level) => {
  const trimmed = JSON.parse(JSON.stringify(data));

  if (level >= 1 && trimmed.simulationResults) {
    // Level 1: Remove full distribution arrays (largest data)
    if (trimmed.simulationResults.terminal?.distribution) {
      trimmed.simulationResults.terminal.distribution = [];
    }
    if (trimmed.simulationResults.terminalDollars?.distribution) {
      trimmed.simulationResults.terminalDollars.distribution = [];
    }
    if (trimmed.simulationResults.drawdown?.distribution) {
      trimmed.simulationResults.drawdown.distribution = [];
    }
  }

  if (level >= 2 && trimmed.simulationResults) {
    // Level 2: Remove path data
    if (trimmed.simulationResults.paths) {
      trimmed.simulationResults.paths = [];
    }
    if (trimmed.simulationResults.samplePaths) {
      trimmed.simulationResults.samplePaths = [];
    }
  }

  if (level >= 3) {
    // Level 3: Remove historical data
    delete trimmed.historicalPrices;
    delete trimmed.factorLoadings;
    delete trimmed.correlationHistory;
  }

  if (level >= 4) {
    // Level 4: Remove simulation results entirely
    delete trimmed.simulationResults;
  }

  return trimmed;
};

/**
 * Save portfolio data to localStorage with compression
 * Falls back to IndexedDB for large data
 * Safe to call fire-and-forget - never throws
 *
 * @param {Object} data - Portfolio data to save
 */
export const saveToStorage = async (data) => {
  try {
    // First, try to clean up old caches
    cleanupOldCaches();

    const json = JSON.stringify(data);
    const originalSize = json.length / 1024;

    // Try compressed localStorage first
    try {
      const compressed = LZString.compressToBase64(json);
      const compressedSize = compressed.length / 1024;
      console.log(`Compressing: ${originalSize.toFixed(1)}KB → ${compressedSize.toFixed(1)}KB (${((1 - compressedSize/originalSize) * 100).toFixed(0)}% reduction)`);

      localStorage.setItem(STORAGE_KEY, 'LZ:' + compressed);
      console.log(`Saved ${compressedSize.toFixed(1)}KB compressed to localStorage`);
      return;
    } catch (e) {
      if (e.name !== 'QuotaExceededError') {
        console.warn('localStorage save failed:', e);
      }
    }

    // If compression wasn't enough, try progressive trimming
    for (let level = 1; level <= 4; level++) {
      try {
        const trimmed = trimDataForStorage(data, level);
        const trimmedJson = JSON.stringify(trimmed);
        const compressed = LZString.compressToBase64(trimmedJson);

        localStorage.setItem(STORAGE_KEY, 'LZ:' + compressed);
        console.log(`Saved with trim level ${level}: ${(compressed.length / 1024).toFixed(1)}KB`);
        return;
      } catch (e) {
        if (e.name !== 'QuotaExceededError') break;
      }
    }

    // Last resort: try IndexedDB for the full data
    console.log('localStorage full, trying IndexedDB...');
    const saved = await saveToIDB(STORAGE_KEY, data);
    if (saved) {
      // Store a marker in localStorage so we know to check IDB
      try {
        localStorage.setItem(STORAGE_KEY, 'IDB:true');
      } catch (e) {
        // Even the marker won't fit, just rely on IDB check
      }
      console.log(`Saved ${originalSize.toFixed(1)}KB to IndexedDB`);
    } else {
      console.warn('Failed to save to both localStorage and IndexedDB');
    }
  } catch (e) {
    console.warn('saveToStorage failed:', e);
  }
};

/**
 * Load portfolio data from localStorage (synchronous)
 * For IndexedDB data, schedules async load and returns null initially
 * @returns {Object|null} Loaded portfolio data or null if not found/error
 */
export const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);

    // Also check legacy key
    const legacyStored = !stored ? localStorage.getItem('monte-carlo-portfolio-v1') : null;
    const data = stored || legacyStored;

    if (data) {
      // Check if it's compressed
      if (data.startsWith('LZ:')) {
        const decompressed = LZString.decompressFromBase64(data.slice(3));
        if (decompressed) {
          const parsed = JSON.parse(decompressed);
          console.log(`Loaded ${(data.length / 1024).toFixed(1)}KB compressed from localStorage`);
          return parsed;
        }
      }

      // Check if it's in IndexedDB (return null, async load will happen separately)
      if (data === 'IDB:true') {
        console.log('Data is in IndexedDB, will load asynchronously');
        // Schedule async load - callers should handle this case
        return null;
      }

      // Try parsing as raw JSON (legacy format)
      try {
        const parsed = JSON.parse(data);
        console.log(`Loaded ${(data.length / 1024).toFixed(1)}KB (uncompressed) from localStorage`);
        return parsed;
      } catch (e) {
        // Not valid JSON
      }
    }

    return null;
  } catch (e) {
    console.warn('Failed to load from storage:', e);
    return null;
  }
};

/**
 * Load portfolio data from IndexedDB (async version)
 * Use this when localStorage indicates IDB storage
 * @returns {Promise<Object|null>}
 */
export const loadFromStorageAsync = async () => {
  // First try synchronous load
  const syncData = loadFromStorage();
  if (syncData) return syncData;

  // Check if data is in IndexedDB
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'IDB:true') {
    const idbData = await loadFromIDB(STORAGE_KEY);
    if (idbData) {
      console.log('Loaded from IndexedDB');
      return idbData;
    }
  }

  // Last resort: check IDB even without marker
  const idbData = await loadFromIDB(STORAGE_KEY);
  if (idbData) {
    console.log('Loaded from IndexedDB (no marker)');
    return idbData;
  }

  return null;
};

// ============================================
// UNIFIED MARKET DATA CACHE
// ============================================

/**
 * LocalStorage key for unified market data cache
 * Version suffix indicates cache format changes
 * @type {string}
 */
export const UNIFIED_CACHE_KEY = 'monte-carlo-unified-market-data-v6'; // v6: timestamps for SMB/HML/MOM factor spreads

/**
 * Maximum age for unified cache (4 hours in milliseconds)
 * @type {number}
 */
export const UNIFIED_CACHE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours

// ============================================
// FACTOR DATA CACHE
// ============================================

/**
 * LocalStorage key for factor ETF data cache (legacy - 24hr expiry)
 * @deprecated Use FACTOR_ETF_PRICES_CACHE_KEY for persistent cache
 * @type {string}
 */
export const FACTOR_CACHE_KEY = 'monte-carlo-factor-etf-data-v1';

/**
 * Maximum age for legacy factor cache (24 hours in milliseconds)
 * @deprecated Use persistent cache in factorETFCache.js instead
 * @type {number}
 */
export const FACTOR_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * LocalStorage key for persistent factor ETF price cache
 * This cache stores raw price data and updates incrementally (only new days)
 * @type {string}
 */
export const FACTOR_ETF_PRICES_CACHE_KEY = 'monte-carlo-factor-etf-prices-v1';
