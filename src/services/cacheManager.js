/**
 * Cache Manager Service
 * Handles localStorage persistence for portfolio and market data
 */

// ============================================
// PORTFOLIO STORAGE
// ============================================

/**
 * LocalStorage key for portfolio data
 * @type {string}
 */
export const STORAGE_KEY = 'monte-carlo-portfolio-v1';

/**
 * Save portfolio data to localStorage
 * Handles quota errors by trimming simulation results if needed
 * 
 * @param {Object} data - Portfolio data to save
 */
export const saveToStorage = (data) => {
  try {
    const json = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, json);
    // Debug: log successful save size
    console.log(`Saved ${(json.length / 1024).toFixed(1)}KB to localStorage`);
  } catch (e) {
    console.warn('Failed to save to localStorage:', e);
    // If quota exceeded, try saving without distributions
    if (e.name === 'QuotaExceededError') {
      try {
        const trimmedData = { ...data };
        if (trimmedData.simulationResults) {
          trimmedData.simulationResults = {
            ...trimmedData.simulationResults,
            terminal: { ...trimmedData.simulationResults.terminal, distribution: [] },
            terminalDollars: { ...trimmedData.simulationResults.terminalDollars, distribution: [] },
            drawdown: { ...trimmedData.simulationResults.drawdown, distribution: [] },
          };
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedData));
        console.log('Saved without distributions due to quota');
      } catch (e2) {
        console.warn('Failed to save even without distributions:', e2);
      }
    }
  }
};

/**
 * Load portfolio data from localStorage
 * @returns {Object|null} Loaded portfolio data or null if not found/error
 */
export const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      console.log(`Loaded ${(stored.length / 1024).toFixed(1)}KB from localStorage`, 
        data.simulationResults ? '(includes simulation results)' : '(no simulation results)');
      return data;
    }
    return null;
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    return null;
  }
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
 * LocalStorage key for factor ETF data cache
 * @type {string}
 */
export const FACTOR_CACHE_KEY = 'monte-carlo-factor-etf-data-v1';

/**
 * Maximum age for factor cache (24 hours in milliseconds)
 * Factor ETFs are less volatile so cache longer
 * @type {number}
 */
export const FACTOR_CACHE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
