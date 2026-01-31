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
 *   GET /api/prices?symbols=AAPL,MSFT&range=1y    - Historical prices (Yahoo)
 *   GET /api/quotes?symbols=AAPL,MSFT             - Current quotes (Yahoo)
 *   GET /api/profile?symbols=AAPL                 - Company profiles (Yahoo)
 *   GET /api/consensus?symbols=AAPL               - Analyst estimates (FMP)
 *   GET /api/fx?pairs=EURUSD,GBPUSD              - Exchange rates (Yahoo)
 *   GET ?url=...                                  - Legacy proxy mode
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
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route to appropriate handler
      if (path.startsWith('/api/prices')) {
        return await handlePrices(url, env);
      }
      if (path.startsWith('/api/quotes')) {
        return await handleQuotes(url, env);
      }
      if (path.startsWith('/api/profile')) {
        return await handleProfile(url, env);
      }
      if (path.startsWith('/api/consensus')) {
        return await handleConsensus(url, env);
      }
      if (path.startsWith('/api/fx')) {
        return await handleFx(url, env);
      }

      // Legacy proxy mode (backwards compatible)
      if (url.searchParams.has('url')) {
        return await handleLegacyProxy(url, env);
      }

      // Health check
      if (path === '/health' || path === '/') {
        return jsonResponse({
          status: 'ok',
          version: '2.0.0',
          endpoints: ['/api/prices', '/api/quotes', '/api/profile', '/api/consensus', '/api/fx'],
        });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse({ error: error.message || 'Internal error' }, 500);
    }
  },
};

// ============================================
// CACHE HELPERS
// ============================================

async function getCached(env, key) {
  if (!env.CACHE) return null;
  try {
    const data = await env.CACHE.get(key, 'json');
    return data;
  } catch (e) {
    console.error('Cache get error:', e);
    return null;
  }
}

async function setCache(env, key, data, ttl) {
  if (!env.CACHE) return;
  try {
    await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });
  } catch (e) {
    console.error('Cache set error:', e);
  }
}

// ============================================
// API HANDLERS
// ============================================

/**
 * Historical prices from Yahoo Finance
 * GET /api/prices?symbols=AAPL,MSFT&range=1y&interval=1d
 */
async function handlePrices(url, env) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const range = url.searchParams.get('range') || '1y';
  const interval = url.searchParams.get('interval') || '1d';

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  const results = {};
  const promises = symbols.map(async (symbol) => {
    const cacheKey = `prices:v1:${symbol.toUpperCase()}:${range}:${interval}`;

    // Check cache first
    let data = await getCached(env, cacheKey);
    if (data) {
      results[symbol] = { ...data, cached: true };
      return;
    }

    // Fetch from Yahoo
    data = await fetchYahooChart(symbol, range, interval);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.prices);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);
  return jsonResponse(results);
}

/**
 * Current quotes from Yahoo Finance
 * GET /api/quotes?symbols=AAPL,MSFT
 */
async function handleQuotes(url, env) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  const results = {};
  const promises = symbols.map(async (symbol) => {
    const cacheKey = `quotes:v1:${symbol.toUpperCase()}`;

    let data = await getCached(env, cacheKey);
    if (data) {
      results[symbol] = { ...data, cached: true };
      return;
    }

    data = await fetchYahooQuote(symbol);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.quotes);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);
  return jsonResponse(results);
}

/**
 * Company profiles from Yahoo Finance
 * GET /api/profile?symbols=AAPL
 */
async function handleProfile(url, env) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  const results = {};
  const promises = symbols.map(async (symbol) => {
    const cacheKey = `profile:v1:${symbol.toUpperCase()}`;

    let data = await getCached(env, cacheKey);
    if (data) {
      results[symbol] = { ...data, cached: true };
      return;
    }

    data = await fetchYahooProfile(symbol);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.profile);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);
  return jsonResponse(results);
}

/**
 * Analyst consensus from Financial Modeling Prep
 * GET /api/consensus?symbols=AAPL
 */
async function handleConsensus(url, env) {
  const symbols = (url.searchParams.get('symbols') || '').split(',').filter(Boolean);
  const apiKey = env.FMP_API_KEY;

  if (symbols.length === 0) {
    return jsonResponse({ error: 'symbols parameter required' }, 400);
  }

  if (!apiKey) {
    return jsonResponse({ error: 'FMP API key not configured' }, 500);
  }

  const results = {};
  const promises = symbols.map(async (symbol) => {
    const cacheKey = `consensus:v1:${symbol.toUpperCase()}`;

    let data = await getCached(env, cacheKey);
    if (data) {
      results[symbol] = { ...data, cached: true };
      return;
    }

    data = await fetchFMPConsensus(symbol, apiKey);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.consensus);
    }
    results[symbol] = data;
  });

  await Promise.all(promises);
  return jsonResponse(results);
}

/**
 * Exchange rates from Yahoo Finance
 * GET /api/fx?pairs=EURUSD,GBPUSD
 */
async function handleFx(url, env) {
  const pairs = (url.searchParams.get('pairs') || '').split(',').filter(Boolean);

  if (pairs.length === 0) {
    return jsonResponse({ error: 'pairs parameter required' }, 400);
  }

  const results = {};
  const promises = pairs.map(async (pair) => {
    const cacheKey = `fx:v1:${pair.toUpperCase()}`;

    let data = await getCached(env, cacheKey);
    if (data) {
      results[pair] = { ...data, cached: true };
      return;
    }

    data = await fetchYahooFx(pair);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.fx);
    }
    results[pair] = data;
  });

  await Promise.all(promises);
  return jsonResponse(results);
}

/**
 * Legacy proxy mode for backwards compatibility
 * GET ?url=https://query1.finance.yahoo.com/...
 */
async function handleLegacyProxy(url, env) {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  // Only allow Yahoo Finance URLs
  if (!targetUrl.startsWith('https://query1.finance.yahoo.com/') &&
      !targetUrl.startsWith('https://query2.finance.yahoo.com/')) {
    return jsonResponse({ error: 'Only Yahoo Finance URLs allowed' }, 403);
  }

  // Use URL as cache key
  const cacheKey = `legacy:v1:${btoa(targetUrl).slice(0, 100)}`;

  let data = await getCached(env, cacheKey);
  if (data) {
    return jsonResponse(data);
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    data = await response.json();
    await setCache(env, cacheKey, data, CACHE_TTLS.prices);
    return jsonResponse(data);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// ============================================
// YAHOO FINANCE FETCHERS
// ============================================

async function fetchYahooChart(symbol, range, interval) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];
    const quote = result.indicators?.quote?.[0] || {};

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
    console.error(`Yahoo chart fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchYahooQuote(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};
    const closes = result.indicators?.adjclose?.[0]?.adjclose ||
                   result.indicators?.quote?.[0]?.close || [];

    return {
      symbol: meta.symbol || symbol,
      price: meta.regularMarketPrice || closes[closes.length - 1] || meta.previousClose,
      previousClose: meta.previousClose,
      name: meta.shortName || meta.longName || symbol,
      type: meta.instrumentType || (meta.quoteType === 'ETF' ? 'ETF' : 'Equity'),
      currency: meta.currency || 'USD',
    };
  } catch (error) {
    console.error(`Yahoo quote fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchYahooProfile(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,quoteType`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) return null;

    const json = await response.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const profile = result.assetProfile || {};
    const quoteType = result.quoteType || {};

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
    console.error(`Yahoo profile fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchYahooFx(pair) {
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

    if (!response.ok) return null;

    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta || {};

    return {
      pair,
      from,
      to,
      rate: meta.regularMarketPrice || meta.previousClose,
      previousClose: meta.previousClose,
    };
  } catch (error) {
    console.error(`Yahoo FX fetch error for ${pair}:`, error);
    return null;
  }
}

// ============================================
// FMP (Financial Modeling Prep) FETCHERS
// ============================================

async function fetchFMPConsensus(symbol, apiKey) {
  try {
    // Fetch multiple endpoints for comprehensive data
    const [estimates, keyMetrics] = await Promise.all([
      fetchFMPEndpoint(`/api/v3/analyst-estimates/${symbol}`, apiKey),
      fetchFMPEndpoint(`/api/v3/key-metrics/${symbol}?limit=1`, apiKey),
    ]);

    if (!estimates && !keyMetrics) return null;

    const latestEstimate = Array.isArray(estimates) ? estimates[0] : null;
    const latestMetrics = Array.isArray(keyMetrics) ? keyMetrics[0] : null;

    return {
      symbol,
      estimates: latestEstimate,
      metrics: latestMetrics,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`FMP consensus fetch error for ${symbol}:`, error);
    return null;
  }
}

async function fetchFMPEndpoint(endpoint, apiKey) {
  try {
    const url = `https://financialmodelingprep.com${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error(`FMP endpoint fetch error:`, error);
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
