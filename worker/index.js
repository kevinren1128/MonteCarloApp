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
 *   GET /api/factor-exposures?symbols=AAPL&factors=SPY,QQQ - Factor betas (6h cache)
 *   GET /api/snapshot?symbols=AAPL,MSFT&benchmark=SPY    - All data in one call
 *   GET /api/optimize?symbols=AAPL,MSFT&rf=0.05         - Portfolio optimization
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
  factorExposures: 6 * 60 * 60, // 6 hours (factor betas are relatively stable)
  snapshot: 15 * 60, // 15 minutes (aggregated data, short TTL)
  optimization: 6 * 60 * 60, // 6 hours (expensive computation, relatively stable)
  metrics: 24 * 60 * 60,    // 24 hours (unified metrics for Positions tab, refreshed by cron)
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
  // Scheduled handler for cron job (daily consensus data update)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event, env));
  },

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
      } else if (path.startsWith('/api/metrics')) {
        handler = 'metrics';
        response = await handleMetrics(url, env, requestId);
      } else if (path.startsWith('/api/distribution')) {
        handler = 'distribution';
        response = await handleDistribution(url, env, requestId);
      } else if (path.startsWith('/api/calendar-returns')) {
        handler = 'calendar-returns';
        response = await handleCalendarReturns(url, env, requestId);
      } else if (path.startsWith('/api/correlation')) {
        handler = 'correlation';
        response = await handleCorrelation(url, env, requestId);
      } else if (path.startsWith('/api/factor-exposures')) {
        handler = 'factor-exposures';
        response = await handleFactorExposures(url, env, requestId);
      } else if (path.startsWith('/api/snapshot')) {
        handler = 'snapshot';
        response = await handleSnapshot(url, env, requestId);
      } else if (path.startsWith('/api/optimize')) {
        handler = 'optimize';
        response = await handleOptimize(url, env, requestId);
      } else if (path === '/api/cron-test') {
        // Manual trigger for testing the cron job
        handler = 'cron-test';
        log.info('Manual cron trigger', { requestId });
        await handleScheduled({ scheduledTime: new Date().toISOString() }, env);
        response = jsonResponse({ status: 'ok', message: 'Cron job triggered manually' });
      } else if (path === '/api/db-test') {
        // Test database connection
        handler = 'db-test';
        try {
          const db = createSupabaseRest(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
          await db.upsert('consensus_snapshots', [{
            ticker: 'DBTEST',
            as_of_date: new Date().toISOString().split('T')[0],
            price: 999,
            data: { test: true },
            status: 'ok',
          }]);
          response = jsonResponse({ status: 'ok', message: 'DB test insert successful' });
        } catch (err) {
          response = jsonResponse({ status: 'error', message: err.message }, 500);
        }
      } else if (url.searchParams.has('url')) {
        handler = 'legacy';
        response = await handleLegacyProxy(url, env, requestId);
      } else if (path === '/health' || path === '/') {
        handler = 'health';
        response = jsonResponse({
          status: 'ok',
          version: '2.7.0',
          endpoints: [
            '/api/prices', '/api/quotes', '/api/profile', '/api/consensus', '/api/fx',
            '/api/beta', '/api/volatility', '/api/metrics', '/api/distribution', '/api/calendar-returns',
            '/api/correlation', '/api/factor-exposures', '/api/snapshot', '/api/optimize'
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
// SCHEDULED CRON JOB HANDLER
// Daily consensus data update for shared database
// ============================================

/**
 * Supabase REST API helper (no external dependencies)
 * Uses direct fetch calls to Supabase REST API
 */
function createSupabaseRest(url, serviceKey) {
  const baseUrl = `${url}/rest/v1`;
  const headers = {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  };

  return {
    async select(table, query = '') {
      const res = await fetch(`${baseUrl}/${table}?${query}`, { headers });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`SELECT ${table}: ${res.status} - ${text}`);
      }
      return res.json();
    },

    async upsert(table, records, onConflict = 'ticker,as_of_date') {
      const res = await fetch(`${baseUrl}/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(records),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`UPSERT ${table}: ${res.status} - ${text}`);
      }
    },

    async update(table, data, filter) {
      const res = await fetch(`${baseUrl}/${table}?${filter}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`UPDATE ${table}: ${res.status} - ${text}`);
      }
    },

    async rpc(fn) {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`RPC ${fn}: ${res.status} - ${text}`);
      }
    },
  };
}

/**
 * Main scheduled handler - runs daily to update consensus data
 */
async function handleScheduled(event, env) {
  log.info('[Cron] Starting consensus data update', { scheduledTime: event.scheduledTime });

  // Check for required environment variables
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    log.error('[Cron] Missing Supabase credentials', {
      hasUrl: !!env.SUPABASE_URL,
      hasKey: !!env.SUPABASE_SERVICE_ROLE_KEY
    });
    return;
  }

  if (!env.FMP_API_KEY) {
    log.error('[Cron] Missing FMP API key');
    return;
  }

  const db = createSupabaseRest(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // 1. Get tickers eligible for update
    // Filter: active, not ETF, and either no next_retry_at or it's in the past
    const tickers = await db.select('tracked_tickers',
      'select=ticker,failure_count,failure_reason&active=eq.true&is_etf=eq.false&or=(next_retry_at.is.null,next_retry_at.lte.now())');

    log.info('[Cron] Found tickers to update', { count: tickers.length });

    if (tickers.length === 0) {
      log.info('[Cron] No tickers to update, exiting');
      return;
    }

    // 2. Batch process (respect rate limits)
    const BATCH_SIZE = 5;
    const BATCH_DELAY_MS = 3000;  // 3 seconds between batches (conservative for rate limits)

    const results = { success: 0, partial: 0, failed: 0 };
    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);

      await Promise.all(batch.map(async ({ ticker, failure_count }) => {
        try {
          const consensus = await fetchFullFMPConsensus(ticker, env.FMP_API_KEY);

          if (!consensus || consensus.failed) {
            await handleTickerFailure(db, ticker, consensus?.error || 'No data found', failure_count);
            results.failed++;
            log.warn('[Cron] Ticker failed', { ticker, error: consensus?.error });
          } else {
            await saveConsensusSnapshot(db, ticker, today, consensus);
            await resetTickerFailure(db, ticker);
            results[consensus.partial ? 'partial' : 'success']++;
            log.info('[Cron] Ticker updated', { ticker, partial: !!consensus.partial });
          }
        } catch (error) {
          await handleTickerFailure(db, ticker, error.message, failure_count);
          results.failed++;
          log.error('[Cron] Error processing ticker', { ticker, error: error.message });
        }
      }));

      // Rate limit pause between batches
      if (i + BATCH_SIZE < tickers.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    // 3. Refresh materialized view
    try {
      await db.rpc('refresh_consensus_latest');
      log.info('[Cron] Materialized view refreshed');
    } catch (error) {
      log.error('[Cron] Failed to refresh materialized view', { error: error.message });
    }

    // 4. Cleanup old snapshots (keep 7 days)
    try {
      await db.rpc('cleanup_old_consensus_snapshots');
      log.info('[Cron] Old snapshots cleaned up');
    } catch (error) {
      log.warn('[Cron] Failed to cleanup old snapshots', { error: error.message });
    }

    log.info('[Cron] Complete', results);

  } catch (error) {
    log.error('[Cron] Fatal error', { error: error.message, stack: error.stack?.slice(0, 200) });
  }
}

/**
 * Fetch comprehensive consensus data for a ticker from FMP
 * Returns the full data structure matching the frontend's fetchConsensusData
 */
/**
 * Fetch complete consensus data for a ticker - mirrors frontend fmpService.js
 * Makes 13 API calls to get all financial data
 */
async function fetchFullFMPConsensus(ticker, apiKey) {
  const startTime = Date.now();
  const requestId = `cron-${crypto.randomUUID().slice(0, 8)}`;

  // Helper functions for field name variations (same as frontend fmpService.js)
  const getRevenue = (obj) =>
    obj?.estimatedRevenueAvg || obj?.revenueAvg || obj?.revenue ||
    obj?.estimatedRevenueLow || obj?.estimatedRevenueHigh || 0;

  const getEps = (obj) =>
    obj?.estimatedEpsAvg || obj?.epsAvg || obj?.eps ||
    obj?.estimatedEpsLow || obj?.estimatedEpsHigh || 0;

  const getEbitda = (obj) =>
    obj?.estimatedEbitdaAvg || obj?.ebitdaAvg || obj?.ebitda ||
    obj?.estimatedEbitdaLow || obj?.estimatedEbitdaHigh || null;

  const getNetIncome = (obj) =>
    obj?.estimatedNetIncomeAvg || obj?.netIncomeAvg || obj?.netIncome ||
    obj?.estimatedNetIncomeLow || obj?.estimatedNetIncomeHigh || null;

  const getEbit = (obj) =>
    obj?.estimatedEbitAvg || obj?.ebitAvg || obj?.ebit ||
    obj?.estimatedEbitLow || obj?.estimatedEbitHigh || null;

  const getGrossProfit = (obj) =>
    obj?.estimatedGrossProfitAvg || obj?.grossProfitAvg || obj?.grossProfit ||
    obj?.estimatedGrossProfitLow || obj?.estimatedGrossProfitHigh || null;

  const extractFiscalYear = (dateStr) => {
    if (!dateStr) return null;
    const year = parseInt(dateStr.substring(0, 4), 10);
    return isNaN(year) ? null : year;
  };

  try {
    // Fetch all 13 endpoints in parallel (same as frontend fmpService.js)
    const [
      estimatesRaw, quoteRaw, evRaw, metricsRaw, incomeRaw,
      priceTargetsRaw, ratingsRaw, growthRaw, earningsRaw,
      ratiosTtmRaw, ratiosAnnualRaw, cashFlowRaw, balanceSheetRaw
    ] = await Promise.all([
      fetchFMPStableEndpoint(`/analyst-estimates?symbol=${ticker}&period=annual&limit=5`, apiKey, requestId),
      fetchFMPStableEndpoint(`/quote?symbol=${ticker}`, apiKey, requestId),
      fetchFMPStableEndpoint(`/enterprise-values?symbol=${ticker}&limit=1`, apiKey, requestId),
      fetchFMPStableEndpoint(`/key-metrics?symbol=${ticker}&period=ttm`, apiKey, requestId),
      fetchFMPStableEndpoint(`/income-statement?symbol=${ticker}&period=annual&limit=10`, apiKey, requestId),
      fetchFMPStableEndpoint(`/price-target-consensus?symbol=${ticker}`, apiKey, requestId),
      fetchFMPStableEndpoint(`/grades-consensus?symbol=${ticker}`, apiKey, requestId),
      fetchFMPStableEndpoint(`/financial-growth?symbol=${ticker}&limit=3`, apiKey, requestId),
      fetchFMPStableEndpoint(`/earnings?symbol=${ticker}&limit=20`, apiKey, requestId),
      fetchFMPStableEndpoint(`/ratios-ttm?symbol=${ticker}`, apiKey, requestId),
      fetchFMPStableEndpoint(`/ratios?symbol=${ticker}&period=annual&limit=3`, apiKey, requestId),
      fetchFMPStableEndpoint(`/cash-flow-statement?symbol=${ticker}&period=annual&limit=10`, apiKey, requestId),
      fetchFMPStableEndpoint(`/balance-sheet-statement?symbol=${ticker}&period=annual&limit=1`, apiKey, requestId),
    ]);

    const duration = Date.now() - startTime;

    // Extract arrays
    const quote = Array.isArray(quoteRaw) ? quoteRaw[0] : quoteRaw;
    const ev = Array.isArray(evRaw) ? evRaw[0] : evRaw;
    const metrics = Array.isArray(metricsRaw) ? metricsRaw[0] : metricsRaw;
    const priceTargets = Array.isArray(priceTargetsRaw) ? priceTargetsRaw[0] : priceTargetsRaw;
    const ratings = Array.isArray(ratingsRaw) ? ratingsRaw[0] : ratingsRaw;
    const growthData = Array.isArray(growthRaw) ? growthRaw : [];
    const ratiosTtm = Array.isArray(ratiosTtmRaw) ? ratiosTtmRaw[0] : ratiosTtmRaw;
    const ratiosAnnual = Array.isArray(ratiosAnnualRaw) ? ratiosAnnualRaw : [];
    const income = Array.isArray(incomeRaw) ? incomeRaw : [];
    const cashFlow = Array.isArray(cashFlowRaw) ? cashFlowRaw : [];
    const balanceSheet = Array.isArray(balanceSheetRaw) ? balanceSheetRaw[0] : balanceSheetRaw;
    const earnings = Array.isArray(earningsRaw) ? earningsRaw : [];

    if (!quote && (!estimatesRaw || estimatesRaw.length === 0)) {
      log.warn('[FMP Full] No data found', { ticker, duration });
      return { failed: true, error: 'No quote or estimates data' };
    }

    // Process estimates (sort by date ascending for future estimates)
    const today = new Date();
    const sixMonthsAgo = new Date(today.getTime() - 180 * 24 * 60 * 60 * 1000);
    const cutoffDate = sixMonthsAgo.toISOString().split('T')[0];
    const estimatesArray = Array.isArray(estimatesRaw) ? estimatesRaw : [];
    const relevantEstimates = estimatesArray.filter(d => d.date && d.date > cutoffDate);
    const estimatesToUse = relevantEstimates.length > 0 ? relevantEstimates : estimatesArray;
    const sortedEstimates = [...estimatesToUse].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const fy1Data = sortedEstimates[0] || null;
    const fy2Data = sortedEstimates[1] || null;
    const fy3Data = sortedEstimates[2] || null;

    // Extract quote data
    const price = quote?.price || 0;
    const marketCap = quote?.marketCap || 0;

    // Process income statement for historical data and reporting currency
    const sortedIncome = [...income].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestIncome = sortedIncome[0];
    const reportingCurrency = latestIncome?.reportedCurrency || balanceSheet?.reportedCurrency || 'USD';

    // Build income historical time series
    const incomeHistorical = sortedIncome.map(d => ({
      year: d.calendarYear || extractFiscalYear(d.date),
      date: d.date,
      revenue: d.revenue,
      grossProfit: d.grossProfit,
      grossMargin: d.grossProfitRatio || (d.revenue ? d.grossProfit / d.revenue : null),
      operatingIncome: d.operatingIncome,
      operatingMargin: d.operatingIncomeRatio || (d.revenue ? d.operatingIncome / d.revenue : null),
      ebitda: d.ebitda || (d.operatingIncome && d.depreciationAndAmortization
        ? d.operatingIncome + d.depreciationAndAmortization : null),
      netIncome: d.netIncome,
      netMargin: d.netIncomeRatio || (d.revenue ? d.netIncome / d.revenue : null),
      eps: d.eps || d.epsdiluted,
    }));

    // Find prior year data for growth calculations
    const fy1FiscalYear = fy1Data ? extractFiscalYear(fy1Data.date) : null;
    let priorYearData = sortedIncome.find(h => h.calendarYear === fy1FiscalYear - 1);
    if (!priorYearData && fy1FiscalYear) {
      priorYearData = sortedIncome.find(h => (h.calendarYear || extractFiscalYear(h.date)) < fy1FiscalYear);
    }
    if (!priorYearData && sortedIncome.length > 0) {
      priorYearData = sortedIncome[0];
    }

    // Process balance sheet
    const shortTermDebt = balanceSheet?.shortTermDebt || balanceSheet?.shortTermBorrowings || 0;
    const longTermDebt = balanceSheet?.longTermDebt || 0;
    const totalDebt = balanceSheet?.totalDebt || (shortTermDebt + longTermDebt);
    const cash = balanceSheet?.cashAndCashEquivalents || balanceSheet?.cashAndShortTermInvestments || 0;
    const netDebt = totalDebt - cash;

    // Calculate enterprise value
    const calculatedEV = marketCap + netDebt;
    const enterpriseValue = calculatedEV > 0 ? calculatedEV : (ev?.enterpriseValue || marketCap);

    // Process cash flow
    const sortedCashFlow = [...cashFlow].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latestCashFlow = sortedCashFlow[0];
    const cashFlowHistorical = sortedCashFlow.map(d => ({
      year: d.calendarYear || extractFiscalYear(d.date),
      date: d.date,
      operatingCashFlow: d.operatingCashFlow || 0,
      capitalExpenditure: d.capitalExpenditure,
      freeCashFlow: d.freeCashFlow || ((d.operatingCashFlow || 0) - Math.abs(d.capitalExpenditure || 0)),
      netIncome: d.netIncome || 0,
      dividendsPaid: d.dividendsPaid,
      stockRepurchases: d.commonStockRepurchased,
    }));

    // Process earnings calendar
    const todayStr = today.toISOString().split('T')[0];
    const sortedEarnings = [...earnings].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const historicalEarnings = sortedEarnings.filter(e => e.epsActual != null && e.epsEstimated != null);
    const recentWithActuals = historicalEarnings.slice(0, 4);
    const surprises = recentWithActuals
      .map(e => (e.epsActual != null && e.epsEstimated != null && e.epsEstimated !== 0)
        ? (e.epsActual - e.epsEstimated) / Math.abs(e.epsEstimated) : null)
      .filter(s => s != null);
    const avgSurprise = surprises.length > 0 ? surprises.reduce((a, b) => a + b, 0) / surprises.length : null;
    const upcomingEarnings = sortedEarnings
      .filter(e => e.date && e.date >= todayStr && e.epsActual == null)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const nextEarnings = upcomingEarnings[0] || null;

    // Process growth (3Y average)
    const avgGrowth = (field) => {
      const values = growthData.map(d => d[field]).filter(v => v != null && !isNaN(v));
      return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
    };

    // Build ratings
    const analystCount = ratings
      ? (ratings.strongBuy || 0) + (ratings.buy || 0) + (ratings.hold || 0) + (ratings.sell || 0) + (ratings.strongSell || 0)
      : null;
    let consensusRating = null;
    if (ratings) {
      const buyWeight = (ratings.strongBuy || 0) * 2 + (ratings.buy || 0);
      const sellWeight = (ratings.strongSell || 0) * 2 + (ratings.sell || 0);
      const holdWeight = ratings.hold || 0;
      if (buyWeight > sellWeight + holdWeight) consensusRating = 'Buy';
      else if (sellWeight > buyWeight + holdWeight) consensusRating = 'Sell';
      else consensusRating = 'Hold';
    }

    const priceTargetConsensus = priceTargets?.targetConsensus || priceTargets?.priceTargetConsensus || null;

    // Build FY estimates with margins
    const buildFyData = (obj) => {
      if (!obj) return null;
      const revenue = getRevenue(obj);
      const ebit = getEbit(obj);
      const ebitda = getEbitda(obj);
      const netIncome = getNetIncome(obj);
      const grossProfit = getGrossProfit(obj);
      return {
        fiscalYear: extractFiscalYear(obj.date),
        date: obj.date,
        revenue,
        grossProfit,
        ebit,
        ebitda,
        netIncome,
        eps: getEps(obj),
        grossMargin: revenue && grossProfit ? grossProfit / revenue : null,
        ebitMargin: revenue && ebit ? ebit / revenue : null,
        ebitdaMargin: revenue && ebitda ? ebitda / revenue : null,
        netMargin: revenue && netIncome ? netIncome / revenue : null,
      };
    };

    const fy1 = buildFyData(fy1Data);
    const fy2 = buildFyData(fy2Data);
    const fy3 = buildFyData(fy3Data);

    // Build the full data object (matches frontend structure exactly)
    const fullData = {
      ticker,
      name: quote?.name || ticker,
      price,
      marketCap,
      enterpriseValue,
      changesPercentage: quote?.changesPercentage || 0,

      // FY estimates
      fy1,
      fy2,
      fy0: priorYearData ? {
        fiscalYear: priorYearData.calendarYear || extractFiscalYear(priorYearData.date),
        revenue: priorYearData.revenue,
        eps: priorYearData.eps || priorYearData.epsdiluted,
        netIncome: priorYearData.netIncome,
      } : null,

      // Forward valuation multiples
      multiples: {
        fy1PE: fy1?.eps ? price / fy1.eps : null,
        fy1EvToEbitda: fy1?.ebitda ? enterpriseValue / fy1.ebitda : null,
        fy1EvToEbit: fy1?.ebit ? enterpriseValue / fy1.ebit : null,
        fy1PriceToSales: fy1?.revenue ? marketCap / fy1.revenue : null,
        fy1EvToSales: fy1?.revenue ? enterpriseValue / fy1.revenue : null,
        fy2PE: fy2?.eps ? price / fy2.eps : null,
        fy2EvToEbitda: fy2?.ebitda ? enterpriseValue / fy2.ebitda : null,
        fy2EvToEbit: fy2?.ebit ? enterpriseValue / fy2.ebit : null,
        fy2PriceToSales: fy2?.revenue ? marketCap / fy2.revenue : null,
        fy2EvToSales: fy2?.revenue ? enterpriseValue / fy2.revenue : null,
        forwardPE: fy1?.eps ? price / fy1.eps : null,
        evToEbitda: metrics?.enterpriseValueOverEBITDATTM || metrics?.evToEbitda,
        priceToSales: metrics?.priceToSalesRatio,
      },

      // Historical metrics (TTM - from ratios-ttm endpoint)
      historical: {
        grossMargin: ratiosTtm?.grossProfitMarginTTM || latestIncome?.grossProfitRatio,
        operatingMargin: ratiosTtm?.operatingProfitMarginTTM || latestIncome?.operatingIncomeRatio,
        netMargin: ratiosTtm?.netProfitMarginTTM || latestIncome?.netIncomeRatio,
        peRatio: ratiosTtm?.priceToEarningsRatioTTM || metrics?.peRatio,
        pbRatio: ratiosTtm?.priceToBookRatioTTM || metrics?.pbRatio,
        evToEbitda: metrics?.evToEBITDA,
      },

      // Profitability & Returns (TTM)
      profitability: {
        roe: metrics?.returnOnEquity || ratiosTtm?.returnOnEquityTTM,
        roa: metrics?.returnOnAssets || ratiosTtm?.returnOnAssetsTTM,
        roic: metrics?.returnOnInvestedCapital || ratiosTtm?.returnOnCapitalEmployedTTM,
        freeCashFlowYield: metrics?.freeCashFlowYield || (ratiosTtm?.priceToFreeCashFlowRatioTTM
          ? 1 / ratiosTtm.priceToFreeCashFlowRatioTTM : null),
      },

      // Balance Sheet Health
      health: {
        debtToEquity: metrics?.debtToEquity || ratiosTtm?.debtEquityRatioTTM,
        currentRatio: metrics?.currentRatio || ratiosTtm?.currentRatioTTM,
        quickRatio: metrics?.quickRatio || ratiosTtm?.quickRatioTTM,
        interestCoverage: ratiosTtm?.interestCoverageTTM,
      },

      // Cash Flow
      cashFlow: {
        freeCashFlow: latestCashFlow?.freeCashFlow,
        operatingCashFlow: latestCashFlow?.operatingCashFlow,
        capitalExpenditure: latestCashFlow?.capitalExpenditure,
        freeCashFlowPerShare: ratiosTtm?.freeCashFlowPerShareTTM || ratiosAnnual[0]?.freeCashFlowPerShare,
        operatingCashFlowPerShare: ratiosTtm?.operatingCashFlowPerShareTTM || ratiosAnnual[0]?.operatingCashFlowPerShare,
        priceToFCF: ratiosTtm?.priceToFreeCashFlowsRatioTTM,
        fcfYield: ratiosTtm?.priceToFreeCashFlowsRatioTTM
          ? 1 / ratiosTtm.priceToFreeCashFlowsRatioTTM : null,
        fcfMargin: (latestCashFlow?.freeCashFlow && latestIncome?.revenue)
          ? latestCashFlow.freeCashFlow / latestIncome.revenue : null,
        fcfConversion: (latestCashFlow?.freeCashFlow && latestIncome?.netIncome && latestIncome.netIncome !== 0)
          ? latestCashFlow.freeCashFlow / latestIncome.netIncome : null,
        historical: cashFlowHistorical,
      },

      // Balance sheet data
      balanceSheet: {
        totalDebt,
        shortTermDebt,
        longTermDebt,
        cashAndEquivalents: cash,
        netDebt,
        totalAssets: balanceSheet?.totalAssets || 0,
        totalLiabilities: balanceSheet?.totalLiabilities || 0,
        totalEquity: balanceSheet?.totalStockholdersEquity || balanceSheet?.totalEquity || 0,
      },

      // Price targets
      priceTargets: priceTargets ? {
        high: priceTargets.targetHigh,
        low: priceTargets.targetLow,
        consensus: priceTargetConsensus,
        median: priceTargets.targetMedian,
        upside: (price && priceTargetConsensus) ? (priceTargetConsensus - price) / price : null,
      } : null,

      // Analyst ratings
      ratings: ratings ? {
        strongBuy: ratings.strongBuy,
        buy: ratings.buy,
        hold: ratings.hold,
        sell: ratings.sell,
        strongSell: ratings.strongSell,
        consensus: consensusRating,
        totalAnalysts: analystCount,
      } : null,

      // Historical growth rates
      growth: {
        revenue: avgGrowth('revenueGrowth'),
        eps: avgGrowth('epsgrowth'),
        ebit: avgGrowth('ebitgrowth'),
        netIncome: avgGrowth('netIncomeGrowth'),
        periods: growthData.length,
      },

      // Earnings calendar
      earnings: {
        nextDate: nextEarnings?.date || null,
        nextEpsEstimate: nextEarnings?.epsEstimated ?? null,
        lastSurprise: surprises[0] ?? null,
        avgSurprise,
        beatCount: surprises.filter(s => s > 0).length,
        missCount: surprises.filter(s => s < 0).length,
      },

      // Currency info
      currency: {
        reporting: reportingCurrency,
        trading: 'USD',
      },

      // Time series data
      timeSeries: {
        historical: incomeHistorical,
        forward: sortedEstimates.map(buildFyData),
        fy3,
      },

      // Metadata
      fetchedAt: new Date().toISOString(),
      partial: !fy1 || !ratings || !priceTargets,
    };

    log.info('[FMP Full] Fetched complete data', { ticker, duration, fy1Rev: fy1?.revenue, hasBalanceSheet: !!balanceSheet });

    return fullData;

  } catch (error) {
    log.error('[FMP Full] Error', { ticker, error: error.message });
    return { failed: true, error: error.message };
  }
}

/**
 * Fetch from FMP stable API endpoint
 */
async function fetchFMPStableEndpoint(endpoint, apiKey, requestId = '') {
  const BASE_URL = 'https://financialmodelingprep.com/stable';
  try {
    const url = `${BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${apiKey}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      log.warn('FMP stable endpoint failed', { requestId, endpoint, status: response.status });
      return null;
    }
    const data = await response.json();
    // Check for error responses
    if (data && data['Error Message']) {
      log.warn('FMP stable endpoint error message', { requestId, endpoint, error: data['Error Message'] });
      return null;
    }
    return data;
  } catch (error) {
    log.error('FMP stable endpoint exception', { requestId, endpoint, error: error.message });
    return null;
  }
}

/**
 * Save consensus data to database
 */
async function saveConsensusSnapshot(db, ticker, asOfDate, consensus) {
  await db.upsert('consensus_snapshots', [{
    ticker,
    as_of_date: asOfDate,
    currency: consensus.currency?.reporting || 'USD',
    price: consensus.price,
    market_cap: consensus.marketCap,
    forward_pe: consensus.multiples?.forwardPE,
    fy1_revenue: consensus.fy1?.revenue,
    fy1_eps: consensus.fy1?.eps,
    analyst_count: consensus.ratings?.totalAnalysts,
    consensus_rating: consensus.ratings?.consensus,
    price_target_consensus: consensus.priceTargets?.consensus,
    data: consensus,  // Store FULL structure in JSONB
    status: consensus.partial ? 'partial' : 'ok',
    fetched_at: new Date().toISOString(),
  }]);
}

/**
 * Handle ticker failure with exponential backoff
 */
async function handleTickerFailure(db, ticker, reason, currentFailureCount) {
  const newFailureCount = (currentFailureCount || 0) + 1;

  // Exponential backoff: 1h, 4h, 12h, 24h, 3d, 7d, 30d
  const backoffHours = [1, 4, 12, 24, 72, 168, 720];
  const backoffIndex = Math.min(newFailureCount - 1, backoffHours.length - 1);
  const nextRetry = new Date(Date.now() + backoffHours[backoffIndex] * 60 * 60 * 1000);

  // Detect unsupported international tickers
  const isUnsupported = reason?.includes('not found') || reason?.includes('no data') || reason?.includes('No');

  await db.update('tracked_tickers', {
    failure_count: newFailureCount,
    last_failure_at: new Date().toISOString(),
    next_retry_at: nextRetry.toISOString(),
    failure_reason: isUnsupported ? 'unsupported' : 'fetch_error',
  }, `ticker=eq.${encodeURIComponent(ticker)}`);
}

/**
 * Reset ticker failure state on success
 */
async function resetTickerFailure(db, ticker) {
  await db.update('tracked_tickers', {
    failure_count: 0,
    last_failure_at: null,
    next_retry_at: null,
    failure_reason: null,
  }, `ticker=eq.${encodeURIComponent(ticker)}`);
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Unified metrics for Positions tab - combines beta, volatility, returns, sparkline
 * GET /api/metrics?symbols=AAPL,MSFT,GOOGL
 *
 * Returns pre-computed metrics with 24h cache TTL (refreshed by daily cron)
 * This is the primary endpoint for fast Positions tab loading.
 */
async function handleMetrics(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const benchmark = url.searchParams.get('benchmark') || 'SPY';
  const range = url.searchParams.get('range') || '1y';
  const interval = url.searchParams.get('interval') || '1d';

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Fetching metrics', { requestId, symbols: symbols.length, benchmark, range });

  const results = {};
  const cacheStats = { hits: 0, misses: 0, computed: 0 };

  // First, get benchmark prices (needed for beta calculations)
  const benchmarkKey = `prices:v1:${benchmark}:${range}:${interval}`;
  let benchmarkData = await getCached(env, benchmarkKey, requestId);
  if (!benchmarkData) {
    benchmarkData = await fetchYahooChart(benchmark, range, interval, requestId);
    if (benchmarkData) {
      await setCache(env, benchmarkKey, benchmarkData, CACHE_TTLS.prices, requestId);
    }
  }

  const benchmarkReturns = benchmarkData?.prices?.length > 0
    ? computeDailyReturns(benchmarkData.prices)
    : [];
  const benchmarkTimestamps = benchmarkData?.timestamps || [];

  // Helper to detect international stocks
  const isInternationalTicker = (symbol, currency) => {
    return currency !== 'USD' ||
      /^\d+$/.test(symbol) ||                    // Pure numeric (Japan: 6525)
      /^\d+\.(T|HK|SS|SZ|TW)$/.test(symbol) ||   // Asian exchanges
      /\.(AS|PA|DE|L|MI|MC|SW|AX|TO|V)$/i.test(symbol);  // European/other
  };

  // Helper to compute beta with lag testing for international stocks
  const computeBetaWithLag = (returns, timestamps, isIntl) => {
    if (!returns?.length || returns.length < 30 || benchmarkReturns.length < 30) {
      return { beta: null, correlation: null, betaLag: 0 };
    }

    // For domestic stocks, simple correlation without lag
    if (!isIntl || !timestamps?.length || !benchmarkTimestamps?.length) {
      const { beta, correlation } = computeBetaCorrelation(returns, benchmarkReturns);
      return { beta, correlation, betaLag: 0 };
    }

    // For international stocks, test different lags (-1, 0, +1 days)
    const lags = [-1, 0, 1];
    let bestResult = { beta: null, correlation: null, betaLag: 0 };
    let bestAbsCorr = -1;

    for (const lag of lags) {
      // Build date maps for alignment
      const posDateMap = new Map();
      const spyDateMap = new Map();

      // Map position returns by date
      for (let i = 0; i < returns.length && i < timestamps.length; i++) {
        const ts = timestamps[i];
        if (ts) {
          const date = new Date(ts);
          date.setDate(date.getDate() + lag); // Apply lag
          const dateKey = date.toISOString().split('T')[0];
          posDateMap.set(dateKey, returns[i]);
        }
      }

      // Map benchmark returns by date
      for (let i = 0; i < benchmarkReturns.length && i < benchmarkTimestamps.length; i++) {
        const ts = benchmarkTimestamps[i];
        if (ts) {
          const dateKey = new Date(ts).toISOString().split('T')[0];
          spyDateMap.set(dateKey, benchmarkReturns[i]);
        }
      }

      // Align by matching dates
      const alignedPos = [];
      const alignedSpy = [];
      for (const [dateKey, posReturn] of posDateMap) {
        const spyReturn = spyDateMap.get(dateKey);
        if (spyReturn !== undefined) {
          alignedPos.push(posReturn);
          alignedSpy.push(spyReturn);
        }
      }

      if (alignedPos.length >= 30) {
        const { beta, correlation } = computeBetaCorrelation(alignedPos, alignedSpy);
        const absCorr = Math.abs(correlation || 0);

        if (absCorr > bestAbsCorr) {
          bestAbsCorr = absCorr;
          bestResult = { beta, correlation, betaLag: lag };
        }
      }
    }

    return bestResult;
  };

  // Process each symbol
  const promises = symbols.map(async (symbol) => {
    const upperSymbol = symbol.toUpperCase();
    const cacheKey = `metrics:v1:${upperSymbol}`;

    // Check cache first
    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }

    cacheStats.misses++;

    // Get price data for this symbol
    const priceKey = `prices:v1:${upperSymbol}:${range}:${interval}`;
    let priceData = await getCached(env, priceKey, requestId);
    if (!priceData) {
      priceData = await fetchYahooChart(symbol, range, interval, requestId);
      if (priceData) {
        await setCache(env, priceKey, priceData, CACHE_TTLS.prices, requestId);
      }
    }

    if (!priceData?.prices?.length || priceData.prices.length < 10) {
      results[symbol] = { error: 'Insufficient price data', minRequired: 10 };
      return;
    }

    const prices = priceData.prices;
    const timestamps = priceData.timestamps || [];
    const currency = priceData.currency || 'USD';

    // Detect if international
    const isIntl = isInternationalTicker(symbol, currency);

    // Compute all metrics
    const dailyReturns = computeDailyReturns(prices);
    const returnTimestamps = timestamps.slice(1); // Align with returns (first return is day 2)

    // Beta with lag testing for international stocks
    const { beta, correlation, betaLag } = symbol.toUpperCase() === benchmark.toUpperCase()
      ? { beta: 1.0, correlation: 1.0, betaLag: 0 }
      : computeBetaWithLag(dailyReturns, returnTimestamps, isIntl);

    // Volatility
    const annualizedVol = computeAnnualizedVolatility(dailyReturns);
    const volatility = annualizedVol != null ? annualizedVol * 100 : null; // Convert to percentage

    // Returns
    const { ytdReturn, oneYearReturn, thirtyDayReturn } = computeReturns(prices, timestamps);

    // Sparkline (last 30 prices)
    const sparkline = prices.slice(-30);

    // Latest price
    const latestPrice = prices[prices.length - 1];

    cacheStats.computed++;

    data = {
      symbol: upperSymbol,
      benchmark,
      // Core metrics
      beta,
      correlation,
      volatility,        // Percentage (e.g., 28.5 for 28.5%)
      ytdReturn,         // Decimal (e.g., 0.12 for 12%)
      oneYearReturn,     // Decimal
      thirtyDayReturn,   // Decimal
      // Display data
      sparkline,         // Last 30 prices
      latestPrice,
      // International stock handling
      isInternational: isIntl,
      betaLag: isIntl ? betaLag : undefined,
      // Metadata
      currency,
      pointsUsed: prices.length,
      asOf: new Date().toISOString().split('T')[0],
    };

    await setCache(env, cacheKey, data, CACHE_TTLS.metrics, requestId);
    results[symbol] = data;
  });

  await Promise.all(promises);

  log.info('Metrics complete', { requestId, symbolCount: symbols.length, ...cacheStats });
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

/**
 * Factor exposures (betas against multiple factor ETFs)
 * GET /api/factor-exposures?symbols=AAPL,MSFT&factors=SPY,QQQ,IWM&range=1y
 *
 * Returns beta of each symbol against each factor ETF.
 * Reuses cached individual betas when available.
 */
async function handleFactorExposures(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const factors = (url.searchParams.get('factors') || 'SPY').split(',').filter(Boolean);
  const range = url.searchParams.get('range') || '1y';
  const interval = url.searchParams.get('interval') || '1d';

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Computing factor exposures', { requestId, symbols, factors, range });

  // Normalize
  const normalizedSymbols = symbols.map(s => s.toUpperCase());
  const normalizedFactors = factors.map(f => f.toUpperCase());

  // Check for full result cache (by sorted symbol+factor combination)
  const sortedSymbols = [...normalizedSymbols].sort();
  const sortedFactors = [...normalizedFactors].sort();
  const fullCacheKey = `factorexp:v1:${range}:${interval}:${sortedSymbols.join('|')}:${sortedFactors.join('|')}`;

  const cachedFull = await getCached(env, fullCacheKey, requestId);
  if (cachedFull) {
    log.info('Factor exposures from cache', { requestId, symbolCount: symbols.length, factorCount: factors.length });
    return jsonResponse({ ...cachedFull, cached: true, source: 'kv' });
  }

  // Fetch price data for all symbols and factors
  const allTickers = [...new Set([...normalizedSymbols, ...normalizedFactors])];
  const priceDataMap = {};

  const fetchPromises = allTickers.map(async (ticker) => {
    const priceKey = `prices:v1:${ticker}:${range}:${interval}`;
    let priceData = await getCached(env, priceKey, requestId);
    if (!priceData) {
      priceData = await fetchYahooChart(ticker, range, interval, requestId);
      if (priceData) {
        await setCache(env, priceKey, priceData, CACHE_TTLS.prices, requestId);
      }
    }
    priceDataMap[ticker] = priceData;
  });

  await Promise.all(fetchPromises);

  // Compute returns for all tickers
  const returnsMap = {};
  for (const ticker of allTickers) {
    const priceData = priceDataMap[ticker];
    if (priceData?.prices?.length >= 30) {
      returnsMap[ticker] = computeDailyReturns(priceData.prices);
    }
  }

  // Check factor data availability
  for (const factor of normalizedFactors) {
    if (!returnsMap[factor]?.length) {
      return jsonResponse({
        error: `Insufficient data for factor ${factor}`,
        factor,
        minRequired: 30
      }, 400);
    }
  }

  // Compute exposures for each symbol against each factor
  const exposures = {};
  const rSquared = {};
  const cacheStats = { betaHits: 0, betaMisses: 0 };

  for (const symbol of normalizedSymbols) {
    const symbolReturns = returnsMap[symbol];
    if (!symbolReturns?.length || symbolReturns.length < 30) {
      exposures[symbol] = { error: 'Insufficient data' };
      continue;
    }

    exposures[symbol] = {};
    let totalSS = 0;
    let residualSS = 0;

    // Compute mean return for R² calculation
    const n = symbolReturns.length;
    const meanReturn = symbolReturns.reduce((a, b) => a + b, 0) / n;
    totalSS = symbolReturns.reduce((a, r) => a + (r - meanReturn) ** 2, 0);

    for (const factor of normalizedFactors) {
      // Check individual beta cache
      const betaCacheKey = `beta:v1:${symbol}:${factor}:${range}:${interval}`;
      let betaData = await getCached(env, betaCacheKey, requestId);

      if (betaData?.beta !== undefined) {
        exposures[symbol][factor] = betaData.beta;
        cacheStats.betaHits++;
      } else {
        // Compute beta
        const factorReturns = returnsMap[factor];
        const { beta, correlation } = computeBetaCorrelation(symbolReturns, factorReturns);
        exposures[symbol][factor] = beta;
        cacheStats.betaMisses++;

        // Cache individual beta
        await setCache(env, betaCacheKey, {
          symbol,
          benchmark: factor,
          beta,
          correlation,
          range,
          interval,
          asOf: new Date().toISOString().split('T')[0]
        }, CACHE_TTLS.beta, requestId);
      }
    }

    // Simple R² approximation using market factor (first factor, usually SPY)
    const marketFactor = normalizedFactors[0];
    const marketReturns = returnsMap[marketFactor];
    if (marketReturns && exposures[symbol][marketFactor] !== null) {
      const beta = exposures[symbol][marketFactor];
      const len = Math.min(symbolReturns.length, marketReturns.length);
      const sr = symbolReturns.slice(-len);
      const mr = marketReturns.slice(-len);
      const meanMr = mr.reduce((a, b) => a + b, 0) / len;

      residualSS = 0;
      for (let i = 0; i < len; i++) {
        const predicted = meanReturn + beta * (mr[i] - meanMr);
        residualSS += (sr[i] - predicted) ** 2;
      }
      rSquared[symbol] = totalSS > 0 ? Math.round((1 - residualSS / totalSS) * 1000) / 1000 : 0;
    }
  }

  const result = {
    symbols: normalizedSymbols,
    factors: normalizedFactors,
    exposures,
    rSquared,
    range,
    interval,
    asOf: new Date().toISOString().split('T')[0]
  };

  // Cache the full result
  await setCache(env, fullCacheKey, result, CACHE_TTLS.factorExposures, requestId);

  log.info('Factor exposures complete', {
    requestId,
    symbolCount: symbols.length,
    factorCount: factors.length,
    ...cacheStats
  });

  return jsonResponse({ ...result, cached: false, source: 'computed' });
}

/**
 * Portfolio snapshot - all data in one call
 * GET /api/snapshot?symbols=AAPL,MSFT&benchmark=SPY&currency=USD
 *
 * Returns: quotes, profiles, volatility, beta, and current prices
 * Reduces multiple round-trips to a single request.
 */
async function handleSnapshot(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const benchmark = url.searchParams.get('benchmark') || 'SPY';
  const range = url.searchParams.get('range') || '1y';
  const targetCurrency = url.searchParams.get('currency')?.toUpperCase();

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  log.info('Building snapshot', { requestId, symbols, benchmark, range, targetCurrency });

  const normalizedSymbols = symbols.map(s => s.toUpperCase());
  const allTickers = [...new Set([...normalizedSymbols, benchmark])];

  // Fetch all data in parallel
  const [quotesData, profilesData, pricesData] = await Promise.all([
    // Quotes
    (async () => {
      const results = {};
      await Promise.all(allTickers.map(async (symbol) => {
        const cacheKey = `quotes:v1:${symbol}`;
        let data = await getCached(env, cacheKey, requestId);
        if (!data) {
          data = await fetchYahooQuote(symbol, requestId);
          if (data) {
            await setCache(env, cacheKey, data, CACHE_TTLS.quotes, requestId);
          }
        }
        results[symbol] = data;
      }));
      return results;
    })(),

    // Profiles
    (async () => {
      const results = {};
      await Promise.all(normalizedSymbols.map(async (symbol) => {
        const cacheKey = `profile:v1:${symbol}`;
        let data = await getCached(env, cacheKey, requestId);
        if (!data) {
          data = await fetchYahooProfile(symbol, requestId);
          if (data) {
            await setCache(env, cacheKey, data, CACHE_TTLS.profile, requestId);
          }
        }
        results[symbol] = data;
      }));
      return results;
    })(),

    // Prices (for volatility and beta calculations)
    (async () => {
      const results = {};
      await Promise.all(allTickers.map(async (symbol) => {
        const cacheKey = `prices:v1:${symbol}:${range}:1d`;
        let data = await getCached(env, cacheKey, requestId);
        if (!data) {
          data = await fetchYahooChart(symbol, range, '1d', requestId);
          if (data) {
            await setCache(env, cacheKey, data, CACHE_TTLS.prices, requestId);
          }
        }
        results[symbol] = data;
      }));
      return results;
    })()
  ]);

  // Compute volatility and beta from prices
  const volatility = {};
  const beta = {};
  const benchmarkReturns = pricesData[benchmark]?.prices
    ? computeDailyReturns(pricesData[benchmark].prices)
    : [];

  for (const symbol of normalizedSymbols) {
    const priceData = pricesData[symbol];
    if (priceData?.prices?.length >= 30) {
      const returns = computeDailyReturns(priceData.prices);

      // Volatility
      volatility[symbol] = {
        annualizedVol: computeAnnualizedVolatility(returns),
        ...computeReturns(priceData.prices, priceData.timestamps)
      };

      // Beta vs benchmark
      if (benchmarkReturns.length >= 30) {
        const { beta: b, correlation } = computeBetaCorrelation(returns, benchmarkReturns);
        beta[symbol] = { beta: b, correlation, benchmark };
      }
    }
  }

  // Apply currency conversion to quotes if requested
  let fxSummary = null;
  if (targetCurrency === 'USD') {
    const currenciesNeeded = new Set();
    for (const [symbol, quote] of Object.entries(quotesData)) {
      if (quote?.currency && quote.currency !== 'USD') {
        currenciesNeeded.add(quote.currency);
      }
    }

    if (currenciesNeeded.size > 0) {
      fxSummary = {};
      const fxRates = { USD: 1 };

      await Promise.all([...currenciesNeeded].map(async (currency) => {
        const pair = `${currency}USD`;
        const fxCacheKey = `fx:v1:${currency}:USD`;
        let rate = await getCached(env, fxCacheKey, requestId);
        if (!rate) {
          const fxData = await fetchYahooFxRate(currency, 'USD', requestId);
          if (fxData) {
            rate = fxData.rate;
            await setCache(env, fxCacheKey, rate, CACHE_TTLS.fx, requestId);
          }
        }
        if (rate) {
          fxRates[currency] = typeof rate === 'object' ? rate.rate || rate : rate;
          fxSummary[pair] = fxRates[currency];
        }
      }));

      // Convert quotes to USD
      for (const [symbol, quote] of Object.entries(quotesData)) {
        if (quote?.price && quote.currency && quote.currency !== 'USD') {
          const rate = fxRates[quote.currency] || 1;
          quote.localPrice = quote.price;
          quote.localCurrency = quote.currency;
          quote.price = quote.price * rate;
          quote.currency = 'USD';
          quote.fxRate = rate;
        }
      }
    }
  }

  const result = {
    symbols: normalizedSymbols,
    quotes: quotesData,
    profiles: profilesData,
    volatility,
    beta,
    benchmark,
    range,
    asOf: new Date().toISOString()
  };

  if (fxSummary) {
    result._fx = fxSummary;
  }

  log.info('Snapshot complete', {
    requestId,
    symbolCount: symbols.length,
    hasQuotes: Object.keys(quotesData).filter(k => quotesData[k]).length,
    hasProfiles: Object.keys(profilesData).filter(k => profilesData[k]).length,
    hasVolatility: Object.keys(volatility).length,
    hasBeta: Object.keys(beta).length
  });

  return jsonResponse(result);
}

/**
 * Portfolio optimization
 * GET /api/optimize?symbols=AAPL,MSFT,GOOG&returns=0.12,0.10,0.15&vols=0.25,0.20,0.30&range=1y
 *
 * Computes:
 * - Minimum variance portfolio
 * - Maximum Sharpe ratio portfolio
 * - Risk parity weights
 *
 * If returns/vols not provided, computes from historical prices.
 */
async function handleOptimize(url, env, requestId) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const returnsParam = url.searchParams.get('returns');
  const volsParam = url.searchParams.get('vols');
  const range = url.searchParams.get('range') || '1y';
  const riskFreeRate = parseFloat(url.searchParams.get('rf') || '0.05');

  if (symbols.length < 2) {
    return jsonResponse({ error: 'At least 2 symbols required' }, 400);
  }

  log.info('Running optimization', { requestId, symbols, range, riskFreeRate });

  const n = symbols.length;
  const normalizedSymbols = symbols.map(s => s.toUpperCase());

  // Check cache
  const sortedSymbols = [...normalizedSymbols].sort();
  const cacheKey = `opt:v1:${range}:${sortedSymbols.join('|')}`;
  const cached = await getCached(env, cacheKey, requestId);
  if (cached && !returnsParam && !volsParam) {
    return jsonResponse({ ...cached, cached: true, source: 'kv' });
  }

  // Fetch price data
  const priceDataMap = {};
  await Promise.all(normalizedSymbols.map(async (symbol) => {
    const priceKey = `prices:v1:${symbol}:${range}:1d`;
    let data = await getCached(env, priceKey, requestId);
    if (!data) {
      data = await fetchYahooChart(symbol, range, '1d', requestId);
      if (data) {
        await setCache(env, priceKey, data, CACHE_TTLS.prices, requestId);
      }
    }
    priceDataMap[symbol] = data;
  }));

  // Compute returns and build covariance matrix
  const returnsMap = {};
  const volMap = {};
  let minLength = Infinity;

  for (const symbol of normalizedSymbols) {
    const priceData = priceDataMap[symbol];
    if (!priceData?.prices?.length || priceData.prices.length < 30) {
      return jsonResponse({ error: `Insufficient data for ${symbol}` }, 400);
    }
    const returns = computeDailyReturns(priceData.prices);
    returnsMap[symbol] = returns;
    volMap[symbol] = computeAnnualizedVolatility(returns);
    minLength = Math.min(minLength, returns.length);
  }

  // Align returns
  for (const symbol of normalizedSymbols) {
    returnsMap[symbol] = returnsMap[symbol].slice(-minLength);
  }

  // Expected returns and volatilities (use provided or computed)
  const expectedReturns = returnsParam
    ? returnsParam.split(',').map(parseFloat)
    : normalizedSymbols.map(s => {
        const returns = returnsMap[s];
        const meanDaily = returns.reduce((a, b) => a + b, 0) / returns.length;
        return meanDaily * 252; // Annualize
      });

  const volatilities = volsParam
    ? volsParam.split(',').map(parseFloat)
    : normalizedSymbols.map(s => volMap[s]);

  // Build correlation matrix
  const corrMatrix = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(1);
      } else if (j < i) {
        row.push(corrMatrix[j][i]);
      } else {
        const corr = computePearsonCorrelation(returnsMap[normalizedSymbols[i]], returnsMap[normalizedSymbols[j]]);
        row.push(corr);
      }
    }
    corrMatrix.push(row);
  }

  // Build covariance matrix: Σ_ij = σ_i * σ_j * ρ_ij
  const covMatrix = [];
  for (let i = 0; i < n; i++) {
    const row = [];
    for (let j = 0; j < n; j++) {
      row.push(volatilities[i] * volatilities[j] * corrMatrix[i][j]);
    }
    covMatrix.push(row);
  }

  // Add small ridge term for stability
  const ridge = 0.0001;
  for (let i = 0; i < n; i++) {
    covMatrix[i][i] += ridge;
  }

  // 1. Minimum Variance Portfolio: w ∝ Σ⁻¹·1
  const ones = Array(n).fill(1);
  const invCovOnes = solveLinearSystem(covMatrix, ones);
  const sumInvCovOnes = invCovOnes.reduce((a, b) => a + b, 0);
  const minVarWeights = invCovOnes.map(w => w / sumInvCovOnes);

  // 2. Maximum Sharpe Portfolio: w ∝ Σ⁻¹·(μ - rf)
  const excessReturns = expectedReturns.map(r => r - riskFreeRate);
  const invCovExcess = solveLinearSystem(covMatrix, excessReturns);
  const sumInvCovExcess = invCovExcess.reduce((a, b) => a + b, 0);
  const maxSharpeWeights = sumInvCovExcess !== 0
    ? invCovExcess.map(w => w / sumInvCovExcess)
    : minVarWeights; // Fallback if all excess returns are 0

  // 3. Risk Parity: equal risk contribution
  const riskParityWeights = computeRiskParityWeights(covMatrix, n);

  // Compute portfolio stats
  const computePortfolioStats = (weights) => {
    let portReturn = 0;
    let portVar = 0;
    for (let i = 0; i < n; i++) {
      portReturn += weights[i] * expectedReturns[i];
      for (let j = 0; j < n; j++) {
        portVar += weights[i] * weights[j] * covMatrix[i][j];
      }
    }
    const portVol = Math.sqrt(portVar);
    const sharpe = portVol > 0 ? (portReturn - riskFreeRate) / portVol : 0;
    return {
      return: Math.round(portReturn * 10000) / 10000,
      volatility: Math.round(portVol * 10000) / 10000,
      sharpe: Math.round(sharpe * 100) / 100
    };
  };

  const result = {
    symbols: normalizedSymbols,
    expectedReturns: expectedReturns.map(r => Math.round(r * 10000) / 10000),
    volatilities: volatilities.map(v => Math.round(v * 10000) / 10000),
    riskFreeRate,
    minVariance: {
      weights: minVarWeights.map(w => Math.round(w * 10000) / 10000),
      ...computePortfolioStats(minVarWeights)
    },
    maxSharpe: {
      weights: maxSharpeWeights.map(w => Math.round(w * 10000) / 10000),
      ...computePortfolioStats(maxSharpeWeights)
    },
    riskParity: {
      weights: riskParityWeights.map(w => Math.round(w * 10000) / 10000),
      ...computePortfolioStats(riskParityWeights)
    },
    correlationMatrix: corrMatrix.map(row => row.map(v => Math.round(v * 1000) / 1000)),
    range,
    pointsUsed: minLength,
    asOf: new Date().toISOString().split('T')[0]
  };

  // Cache if using computed values
  if (!returnsParam && !volsParam) {
    await setCache(env, cacheKey, result, CACHE_TTLS.optimization, requestId);
  }

  log.info('Optimization complete', { requestId, symbolCount: n });
  return jsonResponse({ ...result, cached: false, source: 'computed' });
}

/**
 * Solve linear system Ax = b using Gaussian elimination with partial pivoting
 */
function solveLinearSystem(A, b) {
  const n = A.length;
  // Create augmented matrix
  const aug = A.map((row, i) => [...row, b[i]]);

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    if (Math.abs(aug[col][col]) < 1e-10) continue; // Singular

    // Eliminate
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = aug[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= aug[i][j] * x[j];
    }
    x[i] = Math.abs(aug[i][i]) > 1e-10 ? sum / aug[i][i] : 0;
  }

  return x;
}

/**
 * Compute risk parity weights using iterative algorithm
 * Target: each asset contributes equally to portfolio risk
 */
function computeRiskParityWeights(covMatrix, n, maxIter = 100, tol = 1e-6) {
  // Start with equal weights
  let weights = Array(n).fill(1 / n);

  for (let iter = 0; iter < maxIter; iter++) {
    // Compute marginal risk contribution
    const sigmaW = [];
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += covMatrix[i][j] * weights[j];
      }
      sigmaW.push(sum);
    }

    const portVar = weights.reduce((acc, w, i) => acc + w * sigmaW[i], 0);
    const portVol = Math.sqrt(portVar);

    // Risk contribution: RC_i = w_i * (Σw)_i / σ_p
    const riskContrib = weights.map((w, i) => w * sigmaW[i] / portVol);
    const totalRisk = riskContrib.reduce((a, b) => a + b, 0);
    const targetRisk = totalRisk / n; // Equal risk for each asset

    // Update weights to equalize risk contributions
    const newWeights = [];
    let sumNewWeights = 0;
    for (let i = 0; i < n; i++) {
      // Adjust weight inversely proportional to marginal risk
      const marginalRisk = sigmaW[i] / portVol;
      const newW = marginalRisk > 0 ? targetRisk / marginalRisk : weights[i];
      newWeights.push(newW);
      sumNewWeights += newW;
    }

    // Normalize
    for (let i = 0; i < n; i++) {
      newWeights[i] /= sumNewWeights;
    }

    // Check convergence
    const maxChange = Math.max(...weights.map((w, i) => Math.abs(w - newWeights[i])));
    weights = newWeights;

    if (maxChange < tol) break;
  }

  return weights;
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
