/**
 * Yahoo Finance API utilities with CORS proxy handling
 */

import { YAHOO_API, CORS_PROXIES, DEFAULT_EXCHANGE_RATES } from '../constants';

/**
 * Fetch data from Yahoo Finance through CORS proxies
 * Uses Promise.any for fastest response, with timeout protection
 * @param {string} url - Yahoo Finance API URL
 * @returns {Promise<Object>} Parsed JSON response
 */
export const fetchYahooData = async (url) => {
  const TIMEOUT_MS = 8000; // 8 second timeout per request
  
  // Create fetch promises for all proxies simultaneously
  const proxyPromises = CORS_PROXIES.map(async (proxyFn, index) => {
    const proxyUrl = proxyFn(url);
    
    // Create an AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    try {
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Proxy ${index} returned ${response.status}`);
      }
      
      const data = await response.json();
      
      // allorigins wraps content in { contents: "..." }
      if (data.contents) {
        return JSON.parse(data.contents);
      }
      
      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  });
  
  // Try to get the fastest successful response
  try {
    // Use Promise.any to get first successful result (ignores rejections)
    return await Promise.any(proxyPromises);
  } catch (e) {
    // Promise.any throws AggregateError if all promises reject
    throw new Error('All CORS proxies failed');
  }
};

/**
 * Fetch current price and metadata for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} { price, currency, name, sector, industry }
 */
export const fetchTickerData = async (ticker) => {
  if (!ticker) {
    throw new Error('Ticker is required');
  }
  
  const url = YAHOO_API.chart(ticker);
  const data = await fetchYahooData(url);
  
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data found for ${ticker}`);
  }
  
  const meta = result.meta;
  const price = meta?.regularMarketPrice || result.indicators?.quote?.[0]?.close?.slice(-1)[0];
  
  return {
    price: price || 0,
    currency: meta?.currency || 'USD',
    name: meta?.longName || meta?.shortName || ticker,
    exchangeName: meta?.exchangeName || '',
    sector: meta?.sector || '',
    industry: meta?.industry || '',
  };
};

/**
 * Fetch historical price data
 * @param {string} ticker - Stock ticker symbol
 * @param {string} range - Time range ('6mo', '1y', '2y', '5y')
 * @param {string} interval - Data interval ('1d', '1wk', '1mo')
 * @returns {Promise<Object>} { timestamps, prices, returns }
 */
export const fetchHistoricalData = async (ticker, range = '2y', interval = '1d') => {
  const url = YAHOO_API.chartWithRange(ticker, range, interval);
  const data = await fetchYahooData(url);
  
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No historical data for ${ticker}`);
  }
  
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const adjCloses = result.indicators?.adjclose?.[0]?.adjclose || closes;
  
  // Filter out null values
  const validData = timestamps
    .map((t, i) => ({ timestamp: t, price: adjCloses[i] || closes[i] }))
    .filter(d => d.price != null && d.price > 0);
  
  // Calculate returns
  const returns = [];
  for (let i = 1; i < validData.length; i++) {
    const ret = (validData[i].price - validData[i-1].price) / validData[i-1].price;
    if (isFinite(ret)) {
      returns.push(ret);
    }
  }
  
  return {
    timestamps: validData.map(d => d.timestamp),
    prices: validData.map(d => d.price),
    returns,
  };
};

/**
 * Fetch calendar year returns for a ticker
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<Object>} { 2023: return, 2024: return, 2025: return }
 */
export const fetchCalendarYearReturns = async (ticker) => {
  const url = YAHOO_API.chartWithRange(ticker, '5y', '1d');
  const data = await fetchYahooData(url);
  
  const result = data?.chart?.result?.[0];
  if (!result) {
    throw new Error(`No data for ${ticker}`);
  }
  
  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  
  // Group by year
  const yearData = {};
  for (let i = 0; i < timestamps.length; i++) {
    const price = closes[i];
    if (!price) continue;
    
    const date = new Date(timestamps[i] * 1000);
    const year = date.getFullYear();
    
    if (!yearData[year]) {
      yearData[year] = { firstDate: date, lastDate: date, first: price, last: price };
    } else {
      if (date < yearData[year].firstDate) {
        yearData[year].firstDate = date;
        yearData[year].first = price;
      }
      if (date > yearData[year].lastDate) {
        yearData[year].lastDate = date;
        yearData[year].last = price;
      }
    }
  }
  
  // Calculate returns
  const returns = {};
  const currentYear = new Date().getFullYear();
  
  for (let year = currentYear - 2; year <= currentYear; year++) {
    if (yearData[year]) {
      // For current year, use YTD (last available vs prior year end)
      if (year === currentYear && yearData[year - 1]) {
        returns[year] = (yearData[year].last - yearData[year - 1].last) / yearData[year - 1].last;
      } else {
        // Full year return
        returns[year] = (yearData[year].last - yearData[year].first) / yearData[year].first;
      }
    }
  }
  
  return returns;
};

/**
 * Estimate percentiles from historical returns using bootstrap
 * @param {number[]} returns - Array of historical returns
 * @param {number} annualizationFactor - Days in a year / days in sample period
 * @returns {Object} { p5, p25, p50, p75, p95 }
 */
export const estimatePercentilesFromReturns = (returns, annualizationFactor = 252) => {
  if (!returns || returns.length < 20) {
    throw new Error('Insufficient data for estimation');
  }
  
  // Bootstrap annual returns
  const numSamples = 10000;
  const annualReturns = [];
  
  for (let i = 0; i < numSamples; i++) {
    // Sample with replacement
    let cumReturn = 1;
    for (let j = 0; j < annualizationFactor; j++) {
      const idx = Math.floor(Math.random() * returns.length);
      cumReturn *= (1 + returns[idx]);
    }
    annualReturns.push(cumReturn - 1);
  }
  
  // Sort and extract percentiles
  annualReturns.sort((a, b) => a - b);
  
  const percentile = (arr, p) => {
    const idx = Math.floor(arr.length * p);
    return arr[Math.min(idx, arr.length - 1)];
  };
  
  return {
    p5: percentile(annualReturns, 0.05),
    p25: percentile(annualReturns, 0.25),
    p50: percentile(annualReturns, 0.50),
    p75: percentile(annualReturns, 0.75),
    p95: percentile(annualReturns, 0.95),
  };
};

/**
 * Convert price from foreign currency to USD
 * @param {number} price - Price in original currency
 * @param {string} currency - Currency code
 * @param {Object} rates - Exchange rates to USD (optional)
 * @returns {number} Price in USD
 */
export const convertToUSD = (price, currency, rates = null) => {
  if (currency === 'USD') return price;
  
  const effectiveRates = rates || DEFAULT_EXCHANGE_RATES;
  const rate = effectiveRates[currency];
  
  if (rate) {
    return price * rate;
  }
  
  console.warn(`Unknown currency: ${currency}, assuming 1:1`);
  return price;
};

/**
 * Fetch exchange rate from Yahoo Finance
 * @param {string} currency - Currency code
 * @returns {Promise<number>} Exchange rate to USD
 */
export const fetchExchangeRate = async (currency) => {
  if (currency === 'USD') return 1;
  
  try {
    // Try common forex pairs
    const pairs = [
      `${currency}USD=X`,
      `${currency}=X`,
    ];
    
    for (const pair of pairs) {
      try {
        const data = await fetchTickerData(pair);
        if (data?.price && data.price > 0) {
          return data.price;
        }
      } catch (e) {
        // Try next pair
      }
    }
    
    // Fallback to defaults
    return DEFAULT_EXCHANGE_RATES[currency] || 1;
  } catch (e) {
    console.warn(`Failed to fetch exchange rate for ${currency}:`, e);
    return DEFAULT_EXCHANGE_RATES[currency] || 1;
  }
};
