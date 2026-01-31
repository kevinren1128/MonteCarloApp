/**
 * Cloudflare Worker - Market Data API with KV Caching
 *
 * Deploy this to Cloudflare Workers with a KV namespace for shared caching.
 *
 * Setup Instructions:
 * 1. Go to https://dash.cloudflare.com/
 * 2. Workers & Pages -> KV -> Create a namespace called "MONTE_CARLO_CACHE"
 * 3. Workers & Pages -> Create Worker
 * 4. In worker settings, bind the KV namespace: CACHE -> MONTE_CARLO_CACHE
 * 5. Add secrets: FMP_API_KEY (for Financial Modeling Prep API)
 * 6. Deploy this code
 * 7. Update wrangler.toml with your namespace ID
 *
 * API Endpoints:
 *   GET /api/prices?symbols=AAPL,MSFT&range=1y           - Historical prices (Yahoo)
 *   GET /api/prices?symbols=AAPL,VOD.L&range=1y&currency=USD  - Prices converted to USD
 *   GET /api/quotes?symbols=AAPL,MSFT                    - Current quotes (Yahoo)
 *   GET /api/quotes?symbols=AAPL,VOD.L&currency=USD      - Quotes converted to USD
 *   GET /api/profile?symbols=AAPL                        - Company profiles (Yahoo)
 *   GET /api/consensus?symbols=AAPL                      - Analyst estimates (FMP)
 *   GET /api/fx?pairs=EURUSD,GBPUSD                      - Exchange rates (Yahoo)
 *   GET /api/correlation?symbols=AAPL,MSFT,GOOG&range=5y - Correlation matrix (6h cache)
 *   GET ?url=...                                         - Legacy proxy mode
 *
 * USD Conversion (currency=USD):
 *   When specified, non-USD prices are converted using spot FX rates.
 *   Response includes: localCurrency, localPrices/localPrice, fxRate, fxTimestamp
 *   FX rates are cached for 24h. A _fx summary block is added to the response.
 */

// ============================================
// CONFIGURATION
// ============================================

const CACHE_TTLS = {
  prices: 4 * 60 * 60,      // 4 hours
  quotes: 15 * 60,          // 15 minutes
  profile: 7 * 24 * 60 * 60, // 7 days
  consensus: 4 * 60 * 60,   // 4 hours
  fx: 24 * 60 * 60,         // 24 hours
  // Derived metrics (computed from prices)
  beta: 6 * 60 * 60,        // 6 hours (more stable than prices)
  volatility: 6 * 60 * 60,  // 6 hours
  distribution: 12 * 60 * 60, // 12 hours (expensive to compute, stable)
  calendarReturns: 24 * 60 * 60, // 24 hours (only changes end of day)
  correlation: 6 * 60 * 60, // 6 hours (depends on price data)
};

// ============================================
// LOGGING UTILITIES
// ============================================

/**
 * Structured logging for observability
 * Logs are visible in Cloudflare dashboard: Workers -> Logs
 */
const log = {
  info: (message, data = {}) => {
    console.log(JSON.stringify({ level: 'info', message, ...data, timestamp: new Date().toISOString() }));
  },
  warn: (message, data = {}) => {
    console.warn(JSON.stringify({ level: 'warn', message, ...data, timestamp: new Date().toISOString() }));
  },
  error: (message, data = {}) => {
    console.error(JSON.stringify({ level: 'error', message, ...data, timestamp: new Date().toISOString() }));
  },
  metric: (name, value, tags = {}) => {
    console.log(JSON.stringify({ level: 'metric', metric: name, value, ...tags, timestamp: new Date().toISOString() }));
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

// ============================================
// MAIN HANDLER
// ============================================

export default {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Log incoming request
    log.info('Request received', {
      requestId,
      path,
      query: Object.fromEntries(url.searchParams),
      userAgent: request.headers.get('user-agent')?.slice(0, 50),
    });

    try {
      let response;
      let handler = 'unknown';

      // Route to appropriate handler
      if (path.startsWith('/api/prices')) {
        handler = 'prices';
        response = await handlePrices(url, env, requestId);
      } else if (path.startsWith('/api/quotes')) {
        handler = 'quotes';
        response = await handleQuotes(url, env, requestId);
      } else if (path.startsWith('/api/profile')) {
        handler = 'profile';
        response = await handleProfile(url, env, requestId);
      } else if (path.startsWith('/api/consensus')) {
        handler = 'consensus';
        response = await handleConsensus(url, env, requestId);
      } else if (path.startsWith('/api/fx')) {
        handler = 'fx';
        response = await handleFx(url, env, requestId);
      } else if (path.startsWith('/api/beta')) {
        handler = 'beta';
        response = await handleBeta(url, env, requestId);
      } else if (path.startsWith('/api/volatility')) {
        handler = 'volatility';
        response = await handleVolatility(url, env, requestId);
      } else if (path.startsWith('/api/distribution')) {
        handler = 'distribution';
        response = await handleDistribution(url, env, requestId);
      } else if (path.startsWith('/api/calendar-returns')) {
        handler = 'calendar-returns';
        response = await handleCalendarReturns(url, env, requestId);
      } else if (path.startsWith('/api/correlation')) {
        handler = 'correlation';
        response = await handleCorrelation(url, env, requestId);
      } else if (url.searchParams.has('url')) {
        handler = 'legacy';
        response = await handleLegacyProxy(url, env, requestId);
      } else if (path === '/health' || path === '/') {
        handler = 'health';
        response = jsonResponse({
          status: 'ok',
          version: '2.3.0',
          endpoints: [
            '/api/prices', '/api/quotes', '/api/profile', '/api/consensus', '/api/fx',
            '/api/beta', '/api/volatility', '/api/distribution', '/api/calendar-returns',
            '/api/correlation'
          ],
          kvBound: !!env.CACHE,
        });
      } else {
        response = jsonResponse({ error: 'Not found' }, 404);
      }

      // Log response metrics
      const duration = Date.now() - startTime;
      log.metric('request_duration_ms', duration, { requestId, handler, status: response.status });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error('Request failed', {
        requestId,
        path,
        error: error.message,
        stack: error.stack?.slice(0, 200),
        duration,
      });
      return jsonResponse({ error: error.message || 'Internal error' }, 500);
    }
  },
};

// ============================================
// CACHE HELPERS
// ============================================

async function getCached(env, key, requestId = '') {
  if (!env.CACHE) {
    log.warn('KV not bound', { requestId, key });
    return null;
  }
  try {
    const startTime = Date.now();
    const data = await env.CACHE.get(key, 'json');
    const duration = Date.now() - startTime;

    if (data) {
      log.info('Cache HIT', { requestId, key, duration });
      log.metric('cache_hit', 1, { key: key.split(':')[0] });
    } else {
      log.info('Cache MISS', { requestId, key, duration });
      log.metric('cache_miss', 1, { key: key.split(':')[0] });
    }
    return data;
  } catch (e) {
    log.error('Cache get error', { requestId, key, error: e.message });
    return null;
  }
}

async function setCache(env, key, data, ttl, requestId = '') {
  if (!env.CACHE) return;
  try {
    const startTime = Date.now();
    const size = JSON.stringify(data).length;
    await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });
    const duration = Date.now() - startTime;
    log.info('Cache SET', { requestId, key, ttl, sizeBytes: size, duration });
  } catch (e) {
    log.error('Cache set error', { requestId, key, error: e.message });
  }
}

// ============================================
// API HANDLERS
// ============================================

/**
 * Historical prices from Yahoo Finance
 * GET /api/prices?symbols=AAPL,MSFT&range=1y&interval=1d
 */
async function handlePrices(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const range = url.searchParams.get('range') || '1y';
  const interval = url.searchParams.get('interval') || '1d';
  const targetCurrency = url.searchParams.get('currency')?.toUpperCase(); // Optional: 'USD' for conversion

  if (symbols.length === 0) {
    log.warn('Missing symbols param', { requestId, handler: 'prices' });
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Fetching prices', { requestId, symbols, range, interval, targetCurrency });

  const results = {};
  const cacheStats = { hits: 0, misses: 0 };

  // Step 1: Fetch all price data
  const promises = symbols.map(async (symbol) => {
    const cacheKey = `prices:v1:${symbol.toUpperCase()}:${range}:${interval}`;

    // Check cache first
    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    // Fetch from Yahoo
    cacheStats.misses++;
    data = await fetchYahooChart(symbol, range, interval, requestId);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.prices, requestId);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);

  // Step 2: If currency=USD requested, convert non-USD prices
  let fxSummary = null;
  if (targetCurrency === 'USD') {
    const conversionResult = await convertPricesToUSD(results, env, requestId);
    fxSummary = conversionResult.fxSummary;
    // results is mutated in place by convertPricesToUSD
  }

  log.info('Prices complete', {
    requestId,
    symbolCount: symbols.length,
    ...cacheStats,
    usdConverted: targetCurrency === 'USD'
  });

  // Include FX summary in response if conversion was done
  if (fxSummary && Object.keys(fxSummary).length > 0) {
    return jsonResponse({ ...results, _fx: fxSummary });
  }
  return jsonResponse(results);
}

/**
 * Convert price results to USD using FX rates
 * Mutates the results object in place, adding USD-converted fields
 */
async function convertPricesToUSD(results, env, requestId) {
  const fxSummary = {};
  const fxTimestamp = new Date().toISOString();

  // Collect unique non-USD currencies
  const currenciesNeeded = new Set();
  for (const [symbol, data] of Object.entries(results)) {
    if (data && data.currency && data.currency !== 'USD') {
      currenciesNeeded.add(data.currency);
    }
  }

  if (currenciesNeeded.size === 0) {
    // All USD, just add the USD fields for consistency
    for (const [symbol, data] of Object.entries(results)) {
      if (data && data.prices) {
        data.localCurrency = 'USD';
        data.localPrices = data.prices;
        data.fxRate = 1;
        data.fxTimestamp = fxTimestamp;
        if (data.meta) {
          data.meta.localPrice = data.meta.regularMarketPrice;
        }
      }
    }
    return { fxSummary };
  }

  log.info('Fetching FX rates for USD conversion', { requestId, currencies: [...currenciesNeeded] });

  // Fetch FX rates for all needed currencies
  const fxRates = { USD: 1 };
  const fxPromises = [...currenciesNeeded].map(async (currency) => {
    const pair = `${currency}USD`;
    const cacheKey = `fx:v1:${pair}`;

    // Check cache first
    let fxData = await getCached(env, cacheKey, requestId);
    if (!fxData) {
      fxData = await fetchYahooFx(pair, requestId);
      if (fxData) {
        await setCache(env, cacheKey, fxData, CACHE_TTLS.fx, requestId);
      }
    }

    if (fxData && fxData.rate) {
      fxRates[currency] = fxData.rate;
      fxSummary[currency] = {
        rate: fxData.rate,
        pair,
        timestamp: fxTimestamp,
        cached: !!fxData.cached
      };
    } else {
      log.warn('FX rate unavailable', { requestId, currency, pair });
      fxRates[currency] = null;
      fxSummary[currency] = {
        rate: null,
        pair,
        error: 'Rate unavailable'
      };
    }
  });

  await Promise.all(fxPromises);

  // Convert each symbol's prices to USD
  for (const [symbol, data] of Object.entries(results)) {
    if (!data || !data.prices) continue;

    const localCurrency = data.currency || 'USD';
    const fxRate = fxRates[localCurrency];

    // Store original values
    data.localCurrency = localCurrency;
    data.localPrices = [...data.prices];
    data.fxTimestamp = fxTimestamp;

    if (localCurrency === 'USD') {
      data.fxRate = 1;
      if (data.meta) {
        data.meta.localPrice = data.meta.regularMarketPrice;
      }
    } else if (fxRate && fxRate !== null) {
      // Convert prices to USD
      data.currency = 'USD';
      data.fxRate = Math.round(fxRate * 10000) / 10000; // 4 decimal precision
      data.prices = data.localPrices.map(p =>
        p !== null ? Math.round(p * fxRate * 10000) / 10000 : null
      );
      if (data.meta) {
        data.meta.localPrice = data.meta.regularMarketPrice;
        data.meta.regularMarketPrice = data.meta.regularMarketPrice
          ? Math.round(data.meta.regularMarketPrice * fxRate * 100) / 100
          : null;
      }
      log.info('Converted to USD', { requestId, symbol, localCurrency, fxRate });
    } else {
      // FX rate unavailable - keep local currency, mark as unconverted
      data.fxRate = null;
      data.fxError = `FX rate unavailable for ${localCurrency}`;
      if (data.meta) {
        data.meta.localPrice = data.meta.regularMarketPrice;
      }
      log.warn('Could not convert to USD', { requestId, symbol, localCurrency });
    }
  }

  return { fxSummary };
}

/**
 * Current quotes from Yahoo Finance
 * GET /api/quotes?symbols=AAPL,MSFT&currency=USD
 */
async function handleQuotes(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const targetCurrency = url.searchParams.get('currency')?.toUpperCase();

  if (symbols.length === 0) {
    log.warn('Missing symbols param', { requestId, handler: 'quotes' });
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Fetching quotes', { requestId, symbols, targetCurrency });

  const results = {};
  const cacheStats = { hits: 0, misses: 0 };

  const promises = symbols.map(async (symbol) => {
    const cacheKey = `quotes:v1:${symbol.toUpperCase()}`;

    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;
    data = await fetchYahooQuote(symbol, requestId);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.quotes, requestId);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);

  // Convert to USD if requested
  let fxSummary = null;
  if (targetCurrency === 'USD') {
    const conversionResult = await convertQuotesToUSD(results, env, requestId);
    fxSummary = conversionResult.fxSummary;
  }

  log.info('Quotes complete', { requestId, symbolCount: symbols.length, ...cacheStats, usdConverted: targetCurrency === 'USD' });

  if (fxSummary && Object.keys(fxSummary).length > 0) {
    return jsonResponse({ ...results, _fx: fxSummary });
  }
  return jsonResponse(results);
}

/**
 * Convert quote results to USD using FX rates
 * Mutates the results object in place
 */
async function convertQuotesToUSD(results, env, requestId) {
  const fxSummary = {};
  const fxTimestamp = new Date().toISOString();

  // Collect unique non-USD currencies
  const currenciesNeeded = new Set();
  for (const [symbol, data] of Object.entries(results)) {
    if (data && data.currency && data.currency !== 'USD') {
      currenciesNeeded.add(data.currency);
    }
  }

  if (currenciesNeeded.size === 0) {
    // All USD, just add USD fields for consistency
    for (const [symbol, data] of Object.entries(results)) {
      if (data && data.price) {
        data.localCurrency = 'USD';
        data.localPrice = data.price;
        data.fxRate = 1;
        data.fxTimestamp = fxTimestamp;
      }
    }
    return { fxSummary };
  }

  log.info('Fetching FX rates for quote USD conversion', { requestId, currencies: [...currenciesNeeded] });

  // Fetch FX rates
  const fxRates = { USD: 1 };
  const fxPromises = [...currenciesNeeded].map(async (currency) => {
    const pair = `${currency}USD`;
    const cacheKey = `fx:v1:${pair}`;

    let fxData = await getCached(env, cacheKey, requestId);
    if (!fxData) {
      fxData = await fetchYahooFx(pair, requestId);
      if (fxData) {
        await setCache(env, cacheKey, fxData, CACHE_TTLS.fx, requestId);
      }
    }

    if (fxData && fxData.rate) {
      fxRates[currency] = fxData.rate;
      fxSummary[currency] = { rate: fxData.rate, pair, timestamp: fxTimestamp };
    } else {
      fxRates[currency] = null;
      fxSummary[currency] = { rate: null, pair, error: 'Rate unavailable' };
    }
  });

  await Promise.all(fxPromises);

  // Convert each quote to USD
  for (const [symbol, data] of Object.entries(results)) {
    if (!data || !data.price) continue;

    const localCurrency = data.currency || 'USD';
    const fxRate = fxRates[localCurrency];

    data.localCurrency = localCurrency;
    data.localPrice = data.price;
    data.fxTimestamp = fxTimestamp;

    if (localCurrency === 'USD') {
      data.fxRate = 1;
    } else if (fxRate && fxRate !== null) {
      data.currency = 'USD';
      data.fxRate = Math.round(fxRate * 10000) / 10000;
      data.price = Math.round(data.localPrice * fxRate * 100) / 100;
      if (data.previousClose) {
        data.localPreviousClose = data.previousClose;
        data.previousClose = Math.round(data.previousClose * fxRate * 100) / 100;
      }
    } else {
      data.fxRate = null;
      data.fxError = `FX rate unavailable for ${localCurrency}`;
    }
  }

  return { fxSummary };
}

/**
 * Company profiles from Yahoo Finance
 * GET /api/profile?symbols=AAPL
 */
async function handleProfile(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);

  if (symbols.length === 0) {
    log.warn('Missing symbols param', { requestId, handler: 'profile' });
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Fetching profiles', { requestId, symbols });

  const results = {};
  const cacheStats = { hits: 0, misses: 0 };

  const promises = symbols.map(async (symbol) => {
    const cacheKey = `profile:v1:${symbol.toUpperCase()}`;

    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;
    data = await fetchYahooProfile(symbol, requestId);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.profile, requestId);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);

  log.info('Profiles complete', { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}

/**
 * Analyst consensus from Financial Modeling Prep
 * GET /api/consensus?symbols=AAPL
 */
async function handleConsensus(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const apiKey = env.FMP_API_KEY;

  if (symbols.length === 0) {
    log.warn('Missing symbols param', { requestId, handler: 'consensus' });
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  if (!apiKey) {
    log.error('FMP API key not configured', { requestId });
    return jsonResponse({ error: 'FMP API key not configured' }, 500);
  }

  log.info('Fetching consensus', { requestId, symbols });

  const results = {};
  const cacheStats = { hits: 0, misses: 0 };

  const promises = symbols.map(async (symbol) => {
    const cacheKey = `consensus:v1:${symbol.toUpperCase()}`;

    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;
    data = await fetchFMPConsensus(symbol, apiKey, requestId);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.consensus, requestId);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);

  log.info('Consensus complete', { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}

/**
 * Exchange rates from Yahoo Finance
 * GET /api/fx?pairs=EURUSD,GBPUSD
 */
async function handleFx(url, env, requestId) {
  const pairs = (url.searchParams.get('pairs') || '').split(',').filter(Boolean);

  if (pairs.length === 0) {
    log.warn('Missing pairs param', { requestId, handler: 'fx' });
    return jsonResponse({ error: 'pairs parameter required' }, 400);
  }

  log.info('Fetching FX rates', { requestId, pairs });

  const results = {};
  const cacheStats = { hits: 0, misses: 0 };

  const promises = pairs.map(async (pair) => {
    const cacheKey = `fx:v1:${pair.toUpperCase()}`;

    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[pair] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;
    data = await fetchYahooFx(pair, requestId);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.fx, requestId);
    }
    results[pair] = data;
  });

  await Promise.all(promises);

  log.info('FX rates complete', { requestId, pairCount: pairs.length, ...cacheStats });
  return jsonResponse(results);
}

/**
 * Legacy proxy mode for backwards compatibility
 * GET ?url=https://query1.finance.yahoo.com/...
 */
async function handleLegacyProxy(url, env, requestId) {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    log.warn('Missing url param', { requestId, handler: 'legacy' });
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  // Only allow Yahoo Finance URLs
  if (!targetUrl.startsWith('https://query1.finance.yahoo.com/') &&
      !targetUrl.startsWith('https://query2.finance.yahoo.com/')) {
    log.warn('Blocked non-Yahoo URL', { requestId, url: targetUrl.slice(0, 50) });
    return jsonResponse({ error: 'Only Yahoo Finance URLs allowed' }, 403);
  }

  log.info('Legacy proxy request', { requestId, targetUrl: targetUrl.slice(0, 80) });

  // Use URL as cache key
  const cacheKey = `legacy:v1:${btoa(targetUrl).slice(0, 100)}`;

  let data = await getCached(env, cacheKey, requestId);
  if (data) {
    return jsonResponse(data);
  }

  try {
    const startTime = Date.now();
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    data = await response.json();
    const duration = Date.now() - startTime;

    log.info('Legacy fetch complete', { requestId, duration, status: response.status });
    await setCache(env, cacheKey, data, CACHE_TTLS.prices, requestId);
    return jsonResponse(data);
  } catch (error) {
    log.error('Legacy fetch failed', { requestId, error: error.message });
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================
// YAHOO FINANCE FETCHERS
// ============================================

async function fetchYahooChart(symbol, range, interval, requestId = '') {
  const startTime = Date.now();
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      log.warn('Yahoo chart fetch failed', { requestId, symbol, status: response.status, duration });
      return null;
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      log.warn('Yahoo chart empty result', { requestId, symbol, duration });
      return null;
    }

    const timestamps = result.timestamp || [];
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];
    const quote = result.indicators?.quote?.[0] || {};

    log.info('Yahoo chart fetched', { requestId, symbol, dataPoints: timestamps.length, duration });

    return {
      symbol: result.meta?.symbol || symbol,
      currency: result.meta?.currency || 'USD',
      exchangeName: result.meta?.exchangeName,
      timestamps,
      prices: adjClose.length ? adjClose : quote.close,
      volume: quote.volume,
      meta: {
        regularMarketPrice: result.meta?.regularMarketPrice,
        previousClose: result.meta?.previousClose,
        instrumentType: result.meta?.instrumentType,
      },
    };
  } catch (error) {
    log.error('Yahoo chart fetch error', { requestId, symbol, error: error.message });
    return null;
  }
}

async function fetchYahooQuote(symbol, requestId = '') {
  const startTime = Date.now();
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      log.warn('Yahoo quote fetch failed', { requestId, symbol, status: response.status, duration });
      return null;
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      log.warn('Yahoo quote empty result', { requestId, symbol, duration });
      return null;
    }

    const meta = result.meta || {};
    const closes = result.indicators?.adjclose?.[0]?.adjclose ||
                   result.indicators?.quote?.[0]?.close || [];

    log.info('Yahoo quote fetched', { requestId, symbol, price: meta.regularMarketPrice, duration });

    return {
      symbol: meta.symbol || symbol,
      price: meta.regularMarketPrice || closes[closes.length - 1] || meta.previousClose,
      previousClose: meta.previousClose,
      name: meta.shortName || meta.longName || symbol,
      type: meta.instrumentType || (meta.quoteType === 'ETF' ? 'ETF' : 'Equity'),
      currency: meta.currency || 'USD',
    };
  } catch (error) {
    log.error('Yahoo quote fetch error', { requestId, symbol, error: error.message });
    return null;
  }
}

async function fetchYahooProfile(symbol, requestId = '') {
  const startTime = Date.now();
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,quoteType`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      log.warn('Yahoo profile fetch failed', { requestId, symbol, status: response.status, duration });
      return null;
    }

    const json = await response.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) {
      log.warn('Yahoo profile empty result', { requestId, symbol, duration });
      return null;
    }

    const profile = result.assetProfile || {};
    const quoteType = result.quoteType || {};

    log.info('Yahoo profile fetched', { requestId, symbol, sector: profile.sector, duration });

    return {
      symbol,
      sector: profile.sector || null,
      industry: profile.industry || null,
      longName: quoteType.longName || profile.longBusinessSummary?.slice(0, 100),
      shortName: quoteType.shortName || symbol,
      quoteType: quoteType.quoteType || 'EQUITY',
      website: profile.website,
      country: profile.country,
    };
  } catch (error) {
    log.error('Yahoo profile fetch error', { requestId, symbol, error: error.message });
    return null;
  }
}

async function fetchYahooFx(pair, requestId = '') {
  const startTime = Date.now();
  try {
    // Parse pair (e.g., EURUSD -> EUR/USD)
    const from = pair.slice(0, 3);
    const to = pair.slice(3, 6) || 'USD';
    const symbol = `${from}${to}=X`;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      log.warn('Yahoo FX fetch failed', { requestId, pair, status: response.status, duration });
      return null;
    }

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      log.warn('Yahoo FX empty result', { requestId, pair, duration });
      return null;
    }

    const meta = result.meta || {};

    log.info('Yahoo FX fetched', { requestId, pair, rate: meta.regularMarketPrice, duration });

    return {
      pair,
      from,
      to,
      rate: meta.regularMarketPrice || meta.previousClose,
      previousClose: meta.previousClose,
    };
  } catch (error) {
    log.error('Yahoo FX fetch error', { requestId, pair, error: error.message });
    return null;
  }
}

// ============================================
// FMP (Financial Modeling Prep) FETCHERS
// ============================================

async function fetchFMPConsensus(symbol, apiKey, requestId = '') {
  const startTime = Date.now();
  try {
    // Fetch multiple endpoints for comprehensive data
    const [estimates, keyMetrics] = await Promise.all([
      fetchFMPEndpoint(`/api/v3/analyst-estimates/${symbol}`, apiKey, requestId),
      fetchFMPEndpoint(`/api/v3/key-metrics/${symbol}?limit=1`, apiKey, requestId),
    ]);

    const duration = Date.now() - startTime;

    if (!estimates && !keyMetrics) {
      log.warn('FMP consensus no data', { requestId, symbol, duration });
      return null;
    }

    const latestEstimate = Array.isArray(estimates) ? estimates[0] : null;
    const latestMetrics = Array.isArray(keyMetrics) ? keyMetrics[0] : null;

    log.info('FMP consensus fetched', {
      requestId,
      symbol,
      hasEstimates: !!latestEstimate,
      hasMetrics: !!latestMetrics,
      duration
    });

    return {
      symbol,
      estimates: latestEstimate,
      metrics: latestMetrics,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    log.error('FMP consensus fetch error', { requestId, symbol, error: error.message });
    return null;
  }
}

async function fetchFMPEndpoint(endpoint, apiKey, requestId = '') {
  try {
    const url = `https://financialmodelingprep.com${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      log.warn('FMP endpoint failed', { requestId, endpoint, status: response.status });
      return null;
    }
    return await response.json();
  } catch (error) {
    log.error('FMP endpoint error', { requestId, endpoint, error: error.message });
    return null;
  }
}

// ============================================
// RESPONSE HELPERS
// ============================================

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-cache',
    },
  });
}

// ============================================
// DERIVED METRICS HANDLERS
// ============================================

/**
 * Beta vs benchmark (default SPY)
 * GET /api/beta?symbols=AAPL,MSFT&benchmark=SPY&range=1y
 */
async function handleBeta(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const benchmark = url.searchParams.get('benchmark') || 'SPY';
  const range = url.searchParams.get('range') || '1y';
  const interval = url.searchParams.get('interval') || '1d';

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Computing beta', { requestId, symbols, benchmark, range });

  const results = {};
  const cacheStats = { hits: 0, misses: 0, computed: 0 };

  // First, get benchmark prices (needed for all beta calculations)
  const benchmarkKey = `prices:v1:${benchmark}:${range}:${interval}`;
  let benchmarkData = await getCached(env, benchmarkKey, requestId);
  if (!benchmarkData) {
    benchmarkData = await fetchYahooChart(benchmark, range, interval, requestId);
    if (benchmarkData) {
      await setCache(env, benchmarkKey, benchmarkData, CACHE_TTLS.prices, requestId);
    }
  }

  if (!benchmarkData?.prices?.length) {
    return jsonResponse({ error: `Could not fetch benchmark ${benchmark}` }, 500);
  }

  const benchmarkReturns = computeDailyReturns(benchmarkData.prices);

  // Process each symbol
  const promises = symbols.map(async (symbol) => {
    const cacheKey = `beta:v1:${symbol.toUpperCase()}:${benchmark}:${range}:${interval}`;

    // Check cache first
    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;

    // Get price data for this symbol
    const priceKey = `prices:v1:${symbol.toUpperCase()}:${range}:${interval}`;
    let priceData = await getCached(env, priceKey, requestId);
    if (!priceData) {
      priceData = await fetchYahooChart(symbol, range, interval, requestId);
      if (priceData) {
        await setCache(env, priceKey, priceData, CACHE_TTLS.prices, requestId);
      }
    }

    if (!priceData?.prices?.length || priceData.prices.length < 30) {
      results[symbol] = { error: 'Insufficient price data', minRequired: 30 };
      return;
    }

    // Compute beta
    const symbolReturns = computeDailyReturns(priceData.prices);
    const { beta, correlation } = computeBetaCorrelation(symbolReturns, benchmarkReturns);

    cacheStats.computed++;

    data = {
      symbol,
      benchmark,
      beta,
      correlation,
      range,
      interval,
      pointsUsed: Math.min(symbolReturns.length, benchmarkReturns.length),
      asOf: new Date().toISOString().split('T')[0],
    };

    await setCache(env, cacheKey, data, CACHE_TTLS.beta, requestId);
    results[symbol] = data;
  });

  await Promise.all(promises);

  log.info('Beta complete', { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}

/**
 * Volatility and returns
 * GET /api/volatility?symbols=AAPL&range=1y
 */
async function handleVolatility(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const range = url.searchParams.get('range') || '1y';
  const interval = url.searchParams.get('interval') || '1d';

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Computing volatility', { requestId, symbols, range });

  const results = {};
  const cacheStats = { hits: 0, misses: 0, computed: 0 };

  const promises = symbols.map(async (symbol) => {
    const cacheKey = `vol:v1:${symbol.toUpperCase()}:${range}:${interval}`;

    // Check cache first
    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;

    // Get price data
    const priceKey = `prices:v1:${symbol.toUpperCase()}:${range}:${interval}`;
    let priceData = await getCached(env, priceKey, requestId);
    if (!priceData) {
      priceData = await fetchYahooChart(symbol, range, interval, requestId);
      if (priceData) {
        await setCache(env, priceKey, priceData, CACHE_TTLS.prices, requestId);
      }
    }

    if (!priceData?.prices?.length || priceData.prices.length < 30) {
      results[symbol] = { error: 'Insufficient price data', minRequired: 30 };
      return;
    }

    // Compute volatility and returns
    const prices = priceData.prices;
    const timestamps = priceData.timestamps;
    const dailyReturns = computeDailyReturns(prices);
    const annualizedVol = computeAnnualizedVolatility(dailyReturns);
    const { ytdReturn, oneYearReturn, thirtyDayReturn } = computeReturns(prices, timestamps);

    cacheStats.computed++;

    data = {
      symbol,
      annualizedVol,
      ytdReturn,
      oneYearReturn,
      thirtyDayReturn,
      range,
      interval,
      pointsUsed: prices.length,
      asOf: new Date().toISOString().split('T')[0],
    };

    await setCache(env, cacheKey, data, CACHE_TTLS.volatility, requestId);
    results[symbol] = data;
  });

  await Promise.all(promises);

  log.info('Volatility complete', { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}

/**
 * Bootstrap distribution estimates (p5, p25, p50, p75, p95)
 * GET /api/distribution?symbols=AAPL&range=5y&bootstrap=1000
 */
async function handleDistribution(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const range = url.searchParams.get('range') || '5y';
  const interval = url.searchParams.get('interval') || '1d';
  const bootstrapCount = Math.min(parseInt(url.searchParams.get('bootstrap') || '1000'), 2000);

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Computing distribution', { requestId, symbols, range, bootstrapCount });

  const results = {};
  const cacheStats = { hits: 0, misses: 0, computed: 0 };

  const promises = symbols.map(async (symbol) => {
    const cacheKey = `dist:v1:${symbol.toUpperCase()}:${range}:${interval}:b${bootstrapCount}`;

    // Check cache first
    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;

    // Get price data
    const priceKey = `prices:v1:${symbol.toUpperCase()}:${range}:${interval}`;
    let priceData = await getCached(env, priceKey, requestId);
    if (!priceData) {
      priceData = await fetchYahooChart(symbol, range, interval, requestId);
      if (priceData) {
        await setCache(env, priceKey, priceData, CACHE_TTLS.prices, requestId);
      }
    }

    if (!priceData?.prices?.length || priceData.prices.length < 100) {
      results[symbol] = { error: 'Insufficient price data for distribution', minRequired: 100 };
      return;
    }

    // Compute bootstrap distribution
    const logReturns = computeLogReturns(priceData.prices);
    const distribution = bootstrapAnnualReturns(logReturns, bootstrapCount);

    cacheStats.computed++;

    data = {
      symbol,
      ...distribution,
      bootstrapCount,
      range,
      interval,
      pointsUsed: priceData.prices.length,
      asOf: new Date().toISOString().split('T')[0],
    };

    await setCache(env, cacheKey, data, CACHE_TTLS.distribution, requestId);
    results[symbol] = data;
  });

  await Promise.all(promises);

  log.info('Distribution complete', { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}

/**
 * Calendar year returns
 * GET /api/calendar-returns?symbols=AAPL&range=10y
 */
async function handleCalendarReturns(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const range = url.searchParams.get('range') || '10y';
  const interval = url.searchParams.get('interval') || '1d';

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Computing calendar returns', { requestId, symbols, range });

  const results = {};
  const cacheStats = { hits: 0, misses: 0, computed: 0 };

  const promises = symbols.map(async (symbol) => {
    const cacheKey = `calret:v1:${symbol.toUpperCase()}:${range}:${interval}`;

    // Check cache first
    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;

    // Get price data
    const priceKey = `prices:v1:${symbol.toUpperCase()}:${range}:${interval}`;
    let priceData = await getCached(env, priceKey, requestId);
    if (!priceData) {
      priceData = await fetchYahooChart(symbol, range, interval, requestId);
      if (priceData) {
        await setCache(env, priceKey, priceData, CACHE_TTLS.prices, requestId);
      }
    }

    if (!priceData?.prices?.length || priceData.prices.length < 30) {
      results[symbol] = { error: 'Insufficient price data', minRequired: 30 };
      return;
    }

    // Compute calendar year returns
    const years = computeCalendarYearReturns(priceData.prices, priceData.timestamps);

    cacheStats.computed++;

    data = {
      symbol,
      years,
      range,
      interval,
      pointsUsed: priceData.prices.length,
      asOf: new Date().toISOString().split('T')[0],
    };

    await setCache(env, cacheKey, data, CACHE_TTLS.calendarReturns, requestId);
    results[symbol] = data;
  });

  await Promise.all(promises);

  log.info('Calendar returns complete', { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}

/**
 * Correlation matrix
 * GET /api/correlation?symbols=AAPL,MSFT,GOOG&range=5y&interval=1d
 *
 * Returns NxN correlation matrix for the given symbols.
 * Symbols are normalized (uppercase, sorted, unique) for consistent caching.
 */
async function handleCorrelation(url, env, requestId) {
  const rawSymbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const range = url.searchParams.get('range') || '5y';
  const interval = url.searchParams.get('interval') || '1d';

  if (rawSymbols.length < 2) {
    return jsonResponse({ error: 'At least 2 symbols required for correlation matrix' }, 400);
  }

  // Normalize symbols: uppercase, unique, sorted for consistent cache keys
  const symbols = [...new Set(rawSymbols.map(s => s.toUpperCase()))].sort();

  log.info('Computing correlation matrix', { requestId, symbols, range, interval });

  // Cache key uses sorted symbols joined by pipe
  const cacheKey = `corr:v1:${range}:${interval}:${symbols.join('|')}`;

  // Check cache first
  const cached = await getCached(env, cacheKey, requestId);
  if (cached) {
    log.info('Correlation matrix from cache', { requestId, symbolCount: symbols.length });
    return jsonResponse({
      ...cached,
      cached: true,
      source: 'kv'
    });
  }

  // Fetch price data for all symbols
  const priceDataMap = {};
  const fetchPromises = symbols.map(async (symbol) => {
    const priceKey = `prices:v1:${symbol}:${range}:${interval}`;
    let priceData = await getCached(env, priceKey, requestId);
    if (!priceData) {
      priceData = await fetchYahooChart(symbol, range, interval, requestId);
      if (priceData) {
        await setCache(env, priceKey, priceData, CACHE_TTLS.prices, requestId);
      }
    }
    priceDataMap[symbol] = priceData;
  });

  await Promise.all(fetchPromises);

  // Compute daily returns for each symbol
  const returnsMap = {};
  let minLength = Infinity;

  for (const symbol of symbols) {
    const priceData = priceDataMap[symbol];
    if (!priceData?.prices?.length || priceData.prices.length < 30) {
      return jsonResponse({
        error: `Insufficient price data for ${symbol}`,
        symbol,
        minRequired: 30,
        actual: priceData?.prices?.length || 0
      }, 400);
    }
    const returns = computeDailyReturns(priceData.prices);
    returnsMap[symbol] = returns;
    minLength = Math.min(minLength, returns.length);
  }

  // Align all return series to same length (use most recent data)
  for (const symbol of symbols) {
    returnsMap[symbol] = returnsMap[symbol].slice(-minLength);
  }

  // Compute NxN correlation matrix
  const n = symbols.length;
  const matrix = [];

  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1.0);
      } else if (j < i) {
        // Lower triangle - copy from upper triangle
        row.push(matrix[j][i]);
      } else {
        // Upper triangle - compute correlation
        const corr = computePearsonCorrelation(returnsMap[symbols[i]], returnsMap[symbols[j]]);
        row.push(Math.round(corr * 1000) / 1000); // Round to 3 decimal places
      }
    }
    matrix.push(row);
  }

  const result = {
    symbols,
    matrix,
    range,
    interval,
    pointsUsed: minLength,
    asOf: new Date().toISOString().split('T')[0],
  };

  // Cache the result
  await setCache(env, cacheKey, result, CACHE_TTLS.correlation, requestId);

  log.info('Correlation matrix computed', {
    requestId,
    symbolCount: symbols.length,
    matrixSize: `${n}x${n}`,
    pointsUsed: minLength
  });

  return jsonResponse({
    ...result,
    cached: false,
    source: 'computed'
  });
}

// ============================================
// COMPUTATION HELPERS
// ============================================

/**
 * Compute daily returns from price array
 */
function computeDailyReturns(prices) {
  if (!prices || prices.length < 2) return [];
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
  }
  return returns;
}

/**
 * Compute log returns from price array
 */
function computeLogReturns(prices) {
  if (!prices || prices.length < 2) return [];
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] > 0 && prices[i - 1] > 0) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
  }
  return returns;
}

/**
 * Compute Pearson correlation between two return series
 * Assumes series are already aligned to same length
 */
function computePearsonCorrelation(x, y) {
  const n = x.length;
  if (n < 30 || n !== y.length) return 0;

  // Compute means
  const meanX = x.reduce((a, v) => a + v, 0) / n;
  const meanY = y.reduce((a, v) => a + v, 0) / n;

  // Compute covariance and standard deviations
  let cov = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    cov += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  const stdX = Math.sqrt(varX / n);
  const stdY = Math.sqrt(varY / n);

  if (stdX === 0 || stdY === 0) return 0;

  return (cov / n) / (stdX * stdY);
}

/**
 * Compute beta and correlation vs benchmark
 */
function computeBetaCorrelation(returns, benchmarkReturns) {
  // Align lengths
  const len = Math.min(returns.length, benchmarkReturns.length);
  if (len < 30) return { beta: null, correlation: null };

  const r = returns.slice(-len);
  const b = benchmarkReturns.slice(-len);

  // Compute means
  const meanR = r.reduce((a, v) => a + v, 0) / len;
  const meanB = b.reduce((a, v) => a + v, 0) / len;

  // Compute covariance and variances
  let cov = 0, varR = 0, varB = 0;
  for (let i = 0; i < len; i++) {
    const diffR = r[i] - meanR;
    const diffB = b[i] - meanB;
    cov += diffR * diffB;
    varR += diffR * diffR;
    varB += diffB * diffB;
  }

  cov /= len;
  varR /= len;
  varB /= len;

  const beta = varB > 0 ? cov / varB : null;
  const correlation = (varR > 0 && varB > 0)
    ? cov / (Math.sqrt(varR) * Math.sqrt(varB))
    : null;

  return {
    beta: beta !== null ? Math.round(beta * 100) / 100 : null,
    correlation: correlation !== null ? Math.round(correlation * 100) / 100 : null,
  };
}

/**
 * Compute annualized volatility from daily returns
 */
function computeAnnualizedVolatility(returns) {
  if (!returns || returns.length < 30) return null;

  const mean = returns.reduce((a, v) => a + v, 0) / returns.length;
  const variance = returns.reduce((a, v) => a + (v - mean) ** 2, 0) / returns.length;
  const dailyVol = Math.sqrt(variance);

  // Annualize (252 trading days)
  return Math.round(dailyVol * Math.sqrt(252) * 1000) / 1000;
}

/**
 * Compute YTD, 1Y, 30D returns
 */
function computeReturns(prices, timestamps) {
  if (!prices || prices.length < 2) {
    return { ytdReturn: null, oneYearReturn: null, thirtyDayReturn: null };
  }

  const now = Date.now();
  const currentYear = new Date().getFullYear();
  const lastPrice = prices[prices.length - 1];

  let ytdReturn = null;
  let oneYearReturn = null;
  let thirtyDayReturn = null;

  // Find YTD start (first trading day of current year)
  if (timestamps) {
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000);
      if (date.getFullYear() === currentYear && prices[i] > 0) {
        ytdReturn = (lastPrice - prices[i]) / prices[i];
        break;
      }
    }
  }

  // 1 year return (252 trading days back)
  const oneYearIdx = Math.max(0, prices.length - 253);
  if (prices[oneYearIdx] > 0) {
    oneYearReturn = (lastPrice - prices[oneYearIdx]) / prices[oneYearIdx];
  }

  // 30 day return
  const thirtyDayIdx = Math.max(0, prices.length - 22);
  if (prices[thirtyDayIdx] > 0) {
    thirtyDayReturn = (lastPrice - prices[thirtyDayIdx]) / prices[thirtyDayIdx];
  }

  return {
    ytdReturn: ytdReturn !== null ? Math.round(ytdReturn * 1000) / 1000 : null,
    oneYearReturn: oneYearReturn !== null ? Math.round(oneYearReturn * 1000) / 1000 : null,
    thirtyDayReturn: thirtyDayReturn !== null ? Math.round(thirtyDayReturn * 1000) / 1000 : null,
  };
}

/**
 * Bootstrap annual returns distribution
 */
function bootstrapAnnualReturns(logReturns, iterations = 1000) {
  if (!logReturns || logReturns.length < 50) {
    return { p5: null, p25: null, p50: null, p75: null, p95: null };
  }

  const tradingDaysPerYear = 252;
  const annualReturns = [];

  // Simple seeded random for reproducibility
  let seed = 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let i = 0; i < iterations; i++) {
    let cumReturn = 0;
    for (let d = 0; d < tradingDaysPerYear; d++) {
      const idx = Math.floor(random() * logReturns.length);
      cumReturn += logReturns[idx];
    }
    // Convert log return to simple return
    annualReturns.push(Math.exp(cumReturn) - 1);
  }

  // Sort and get percentiles
  annualReturns.sort((a, b) => a - b);

  const getPercentile = (arr, p) => {
    const idx = Math.floor(p * arr.length);
    return arr[Math.min(idx, arr.length - 1)];
  };

  return {
    p5: Math.round(getPercentile(annualReturns, 0.05) * 1000) / 1000,
    p25: Math.round(getPercentile(annualReturns, 0.25) * 1000) / 1000,
    p50: Math.round(getPercentile(annualReturns, 0.50) * 1000) / 1000,
    p75: Math.round(getPercentile(annualReturns, 0.75) * 1000) / 1000,
    p95: Math.round(getPercentile(annualReturns, 0.95) * 1000) / 1000,
  };
}

/**
 * Compute calendar year returns
 */
function computeCalendarYearReturns(prices, timestamps) {
  if (!prices || !timestamps || prices.length < 30) return {};

  const years = {};
  let currentYear = null;
  let yearStartPrice = null;
  let yearEndPrice = null;

  for (let i = 0; i < prices.length; i++) {
    const date = new Date(timestamps[i] * 1000);
    const year = date.getFullYear();

    if (year !== currentYear) {
      // Save previous year's return
      if (currentYear !== null && yearStartPrice > 0 && yearEndPrice > 0) {
        years[currentYear] = Math.round((yearEndPrice - yearStartPrice) / yearStartPrice * 1000) / 1000;
      }
      // Start new year
      currentYear = year;
      yearStartPrice = prices[i];
    }
    yearEndPrice = prices[i];
  }

  // Save last year (partial or complete)
  if (currentYear !== null && yearStartPrice > 0 && yearEndPrice > 0) {
    years[currentYear] = Math.round((yearEndPrice - yearStartPrice) / yearStartPrice * 1000) / 1000;
  }

  return years;
}
