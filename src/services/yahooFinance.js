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
 */

// CORS proxy configuration - multiple fallbacks for reliability
// Updated 2025: Using more reliable proxies
const CORS_PROXIES = [
  {
    name: 'corsproxy-io',
    buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    parseResponse: async (response) => response.json(),
  },
  {
    name: 'cors-proxy-htmldriven',
    buildUrl: (url) => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
    parseResponse: async (response) => {
      const data = await response.json();
      return data.body ? JSON.parse(data.body) : null;
    },
  },
  {
    name: 'api-codetabs',
    buildUrl: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    parseResponse: async (response) => response.json(),
  },
  {
    name: 'allorigins-raw',
    buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    parseResponse: async (response) => response.json(),
  },
  {
    name: 'allorigins',
    buildUrl: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
    parseResponse: async (response) => {
      const data = await response.json();
      return data.contents ? JSON.parse(data.contents) : null;
    },
  },
];

// Track proxy success rates to prefer working proxies
const proxyStats = CORS_PROXIES.reduce((acc, p) => {
  acc[p.name] = { successes: 0, failures: 0 };
  return acc;
}, {});

// Get proxies sorted by success rate (most reliable first)
const getSortedProxies = () => {
  return [...CORS_PROXIES].sort((a, b) => {
    const aStats = proxyStats[a.name];
    const bStats = proxyStats[b.name];
    const aTotal = aStats.successes + aStats.failures;
    const bTotal = bStats.successes + bStats.failures;

    // If no data, keep original order
    if (aTotal === 0 && bTotal === 0) return 0;
    if (aTotal === 0) return 1;
    if (bTotal === 0) return -1;

    const aRate = aStats.successes / aTotal;
    const bRate = bStats.successes / bTotal;
    return bRate - aRate;
  });
};

/**
 * Fetch data from Yahoo Finance with CORS proxy fallback
 * Tries proxies sequentially, preferring ones with better success rates
 * @param {string} url - Yahoo Finance API URL
 * @param {number} timeout - Timeout in ms per proxy (default: 10000)
 * @returns {Promise<Object|null>} Parsed JSON response or null on failure
 */
export const fetchYahooData = async (url, timeout = 10000) => {
  // Try each proxy sequentially, sorted by success rate
  const sortedProxies = getSortedProxies();

  for (const proxy of sortedProxies) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const proxyUrl = proxy.buildUrl(url);
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await proxy.parseResponse(response);
        if (data) {
          // Track success
          proxyStats[proxy.name].successes++;
          return data;
        }
      }
      // Response not ok, track failure and try next proxy
      proxyStats[proxy.name].failures++;
    } catch (e) {
      clearTimeout(timeoutId);
      // Request failed, track and try next proxy
      proxyStats[proxy.name].failures++;
    }
  }

  // All proxies failed
  console.warn('All CORS proxies failed for:', url.slice(0, 80) + '...');
  return null;
};

/**
 * Race multiple CORS proxies - returns fastest successful response
 * Useful for reducing latency on critical requests
 * @param {string} url - Yahoo Finance API URL
 * @returns {Promise<Object|null>}
 */
export const fetchYahooDataFastest = async (url) => {
  const sortedProxies = getSortedProxies();

  const promises = sortedProxies.map(async (proxy) => {
    try {
      const proxyUrl = proxy.buildUrl(url);
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const data = await proxy.parseResponse(response);
        if (data) {
          proxyStats[proxy.name].successes++;
          return data;
        }
      }
      proxyStats[proxy.name].failures++;
      throw new Error('Invalid response');
    } catch (e) {
      proxyStats[proxy.name].failures++;
      throw e;
    }
  });

  try {
    return await Promise.any(promises);
  } catch (e) {
    console.warn('All proxies failed for:', url);
    return null;
  }
};

/**
 * Fetch current quote for a symbol
 * @param {string} symbol - Ticker symbol (e.g., 'AAPL')
 * @returns {Promise<{price: number, name: string, type: string, currency: string}|null>}
 */
export const fetchYahooQuote = async (symbol) => {
  try {
    // Use chart API with 5 days range - more reliable than quote endpoint
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const data = await fetchYahooData(url);
    
    if (data?.chart?.result?.[0]) {
      const result = data.chart.result[0];
      const meta = result.meta;
      const closes = result.indicators?.adjclose?.[0]?.adjclose || 
                     result.indicators?.quote?.[0]?.close || [];
      
      // Get the most recent price
      const latestPrice = meta?.regularMarketPrice || 
                          closes[closes.length - 1] || 
                          meta?.previousClose;
      
      if (latestPrice) {
        return {
          price: latestPrice,
          name: meta?.shortName || meta?.longName || symbol,
          type: meta?.instrumentType || (meta?.quoteType === 'ETF' ? 'ETF' : 'Equity'),
          currency: meta?.currency || 'USD',
        };
      }
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch quote for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch historical price data
 * @param {string} symbol - Ticker symbol
 * @param {string} range - Time range ('1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', 'max')
 * @param {string} interval - Data interval ('1d', '1wk', '1mo')
 * @returns {Promise<Array<{date: Date, close: number}>|null>}
 */
export const fetchYahooHistory = async (symbol, range = '1y', interval = '1d') => {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const data = await fetchYahooData(url);
    
    if (data?.chart?.result?.[0]) {
      const result = data.chart.result[0];
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
      return prices;
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch history for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch raw history data (returns raw timestamp array too)
 * Used for correlation calculations that need exact date alignment
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
      
      // Filter out null/NaN values while preserving alignment
      const validIndices = [];
      for (let i = 0; i < timestamps.length; i++) {
        if (closes[i] != null && !isNaN(closes[i])) {
          validIndices.push(i);
        }
      }
      
      return {
        prices: validIndices.map(i => closes[i]),
        timestamps: validIndices.map(i => timestamps[i] * 1000), // Convert to ms
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
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=assetProfile,summaryProfile,quoteType,summaryDetail`;
    const data = await fetchYahooData(url);
    
    if (data?.quoteSummary?.result?.[0]) {
      const result = data.quoteSummary.result[0];
      const profile = result.assetProfile || result.summaryProfile || {};
      const quoteType = result.quoteType || {};
      
      return {
        sector: profile.sector || null,
        industry: profile.industry || null,
        longName: quoteType.longName || profile.longBusinessSummary?.slice(0, 100) || null,
        quoteType: quoteType.quoteType || 'EQUITY',
        shortName: quoteType.shortName || symbol,
      };
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch profile for ${symbol}:`, error);
    return null;
  }
};

/**
 * Fetch currency exchange rate
 * Tries both normal and reverse pairs in parallel for speed
 * @param {string} fromCurrency - Source currency code (e.g., 'EUR')
 * @param {string} toCurrency - Target currency code (e.g., 'USD')
 * @returns {Promise<number|null>} Exchange rate or null
 */
export const fetchExchangeRate = async (fromCurrency, toCurrency = 'USD') => {
  if (fromCurrency === toCurrency) return 1;

  try {
    // Try both normal and reverse pairs in parallel
    const symbol = `${fromCurrency}${toCurrency}=X`;
    const reverseSymbol = `${toCurrency}${fromCurrency}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const reverseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${reverseSymbol}?interval=1d&range=1d`;

    // Fetch both simultaneously
    const [data, reverseData] = await Promise.all([
      fetchYahooData(url).catch(() => null),
      fetchYahooData(reverseUrl).catch(() => null),
    ]);

    // Prefer direct pair
    if (data?.chart?.result?.[0]) {
      const meta = data.chart.result[0].meta;
      const rate = meta?.regularMarketPrice || meta?.previousClose;
      if (rate) return rate;
    }

    // Fallback to reverse pair
    if (reverseData?.chart?.result?.[0]) {
      const meta = reverseData.chart.result[0].meta;
      const rate = meta?.regularMarketPrice || meta?.previousClose;
      if (rate) return 1 / rate;
    }

    return null;
  } catch (error) {
    console.warn(`Failed to fetch exchange rate ${fromCurrency}/${toCurrency}:`, error);
    return null;
  }
};

/**
 * Calculate calendar year returns from price data
 * @param {Array<{date: Date, close: number}>} prices - Price history
 * @returns {Object<string, number>} Object mapping year to return (e.g., { '2023': 0.15 })
 */
export const getCalendarYearReturns = (prices) => {
  if (!prices || prices.length === 0) return {};
  
  // Group prices by year
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
  
  // Calculate return for each year
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
 * Batch fetch multiple symbols concurrently
 * @param {string[]} symbols - Array of ticker symbols
 * @param {Function} fetchFn - Fetch function to use (e.g., fetchYahooQuote)
 * @param {number} concurrency - Max concurrent requests (default: 5)
 * @returns {Promise<Object>} Object mapping symbol to result
 */
export const batchFetch = async (symbols, fetchFn, concurrency = 5) => {
  const results = {};
  const queue = [...symbols];
  
  const worker = async () => {
    while (queue.length > 0) {
      const symbol = queue.shift();
      if (symbol) {
        results[symbol] = await fetchFn(symbol);
      }
    }
  };
  
  // Create worker pool
  const workers = Array(Math.min(concurrency, queue.length))
    .fill(null)
    .map(() => worker());
  
  await Promise.all(workers);
  return results;
};

export default {
  fetchYahooData,
  fetchYahooDataFastest,
  fetchYahooQuote,
  fetchYahooHistory,
  fetchYahooHistoryRaw,
  fetchYahooProfile,
  fetchExchangeRate,
  getCalendarYearReturns,
  batchFetch,
};
