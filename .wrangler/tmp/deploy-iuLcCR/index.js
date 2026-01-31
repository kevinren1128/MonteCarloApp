var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
var CACHE_TTLS = {
  prices: 4 * 60 * 60,
  // 4 hours
  quotes: 15 * 60,
  // 15 minutes
  profile: 7 * 24 * 60 * 60,
  // 7 days
  consensus: 4 * 60 * 60,
  // 4 hours
  fx: 24 * 60 * 60
  // 24 hours
};
var log = {
  info: /* @__PURE__ */ __name((message, data = {}) => {
    console.log(JSON.stringify({ level: "info", message, ...data, timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
  }, "info"),
  warn: /* @__PURE__ */ __name((message, data = {}) => {
    console.warn(JSON.stringify({ level: "warn", message, ...data, timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
  }, "warn"),
  error: /* @__PURE__ */ __name((message, data = {}) => {
    console.error(JSON.stringify({ level: "error", message, ...data, timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
  }, "error"),
  metric: /* @__PURE__ */ __name((name, value, tags = {}) => {
    console.log(JSON.stringify({ level: "metric", metric: name, value, ...tags, timestamp: (/* @__PURE__ */ new Date()).toISOString() }));
  }, "metric")
};
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
var index_default = {
  async fetch(request, env, ctx) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    log.info("Request received", {
      requestId,
      path,
      query: Object.fromEntries(url.searchParams),
      userAgent: request.headers.get("user-agent")?.slice(0, 50)
    });
    try {
      let response;
      let handler = "unknown";
      if (path.startsWith("/api/prices")) {
        handler = "prices";
        response = await handlePrices(url, env, requestId);
      } else if (path.startsWith("/api/quotes")) {
        handler = "quotes";
        response = await handleQuotes(url, env, requestId);
      } else if (path.startsWith("/api/profile")) {
        handler = "profile";
        response = await handleProfile(url, env, requestId);
      } else if (path.startsWith("/api/consensus")) {
        handler = "consensus";
        response = await handleConsensus(url, env, requestId);
      } else if (path.startsWith("/api/fx")) {
        handler = "fx";
        response = await handleFx(url, env, requestId);
      } else if (url.searchParams.has("url")) {
        handler = "legacy";
        response = await handleLegacyProxy(url, env, requestId);
      } else if (path === "/health" || path === "/") {
        handler = "health";
        response = jsonResponse({
          status: "ok",
          version: "2.1.0",
          endpoints: ["/api/prices", "/api/quotes", "/api/profile", "/api/consensus", "/api/fx"],
          kvBound: !!env.CACHE
        });
      } else {
        response = jsonResponse({ error: "Not found" }, 404);
      }
      const duration = Date.now() - startTime;
      log.metric("request_duration_ms", duration, { requestId, handler, status: response.status });
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      log.error("Request failed", {
        requestId,
        path,
        error: error.message,
        stack: error.stack?.slice(0, 200),
        duration
      });
      return jsonResponse({ error: error.message || "Internal error" }, 500);
    }
  }
};
async function getCached(env, key, requestId = "") {
  if (!env.CACHE) {
    log.warn("KV not bound", { requestId, key });
    return null;
  }
  try {
    const startTime = Date.now();
    const data = await env.CACHE.get(key, "json");
    const duration = Date.now() - startTime;
    if (data) {
      log.info("Cache HIT", { requestId, key, duration });
      log.metric("cache_hit", 1, { key: key.split(":")[0] });
    } else {
      log.info("Cache MISS", { requestId, key, duration });
      log.metric("cache_miss", 1, { key: key.split(":")[0] });
    }
    return data;
  } catch (e) {
    log.error("Cache get error", { requestId, key, error: e.message });
    return null;
  }
}
__name(getCached, "getCached");
async function setCache(env, key, data, ttl, requestId = "") {
  if (!env.CACHE) return;
  try {
    const startTime = Date.now();
    const size = JSON.stringify(data).length;
    await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });
    const duration = Date.now() - startTime;
    log.info("Cache SET", { requestId, key, ttl, sizeBytes: size, duration });
  } catch (e) {
    log.error("Cache set error", { requestId, key, error: e.message });
  }
}
__name(setCache, "setCache");
async function handlePrices(url, env, requestId) {
  const symbols = (url.searchParams.get("symbols") || "").split(",").filter(Boolean);
  const range = url.searchParams.get("range") || "1y";
  const interval = url.searchParams.get("interval") || "1d";
  if (symbols.length === 0) {
    log.warn("Missing symbols param", { requestId, handler: "prices" });
    return jsonResponse({ error: "symbols parameter required" }, 400);
  }
  log.info("Fetching prices", { requestId, symbols, range, interval });
  const results = {};
  const cacheStats = { hits: 0, misses: 0 };
  const promises = symbols.map(async (symbol) => {
    const cacheKey = `prices:v1:${symbol.toUpperCase()}:${range}:${interval}`;
    let data = await getCached(env, cacheKey, requestId);
    if (data) {
      results[symbol] = { ...data, cached: true };
      cacheStats.hits++;
      return;
    }
    cacheStats.misses++;
    data = await fetchYahooChart(symbol, range, interval, requestId);
    if (data) {
      await setCache(env, cacheKey, data, CACHE_TTLS.prices, requestId);
    }
    results[symbol] = data;
  });
  await Promise.all(promises);
  log.info("Prices complete", { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}
__name(handlePrices, "handlePrices");
async function handleQuotes(url, env, requestId) {
  const symbols = (url.searchParams.get("symbols") || "").split(",").filter(Boolean);
  if (symbols.length === 0) {
    log.warn("Missing symbols param", { requestId, handler: "quotes" });
    return jsonResponse({ error: "symbols parameter required" }, 400);
  }
  log.info("Fetching quotes", { requestId, symbols });
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
  log.info("Quotes complete", { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}
__name(handleQuotes, "handleQuotes");
async function handleProfile(url, env, requestId) {
  const symbols = (url.searchParams.get("symbols") || "").split(",").filter(Boolean);
  if (symbols.length === 0) {
    log.warn("Missing symbols param", { requestId, handler: "profile" });
    return jsonResponse({ error: "symbols parameter required" }, 400);
  }
  log.info("Fetching profiles", { requestId, symbols });
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
  log.info("Profiles complete", { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}
__name(handleProfile, "handleProfile");
async function handleConsensus(url, env, requestId) {
  const symbols = (url.searchParams.get("symbols") || "").split(",").filter(Boolean);
  const apiKey = env.FMP_API_KEY;
  if (symbols.length === 0) {
    log.warn("Missing symbols param", { requestId, handler: "consensus" });
    return jsonResponse({ error: "symbols parameter required" }, 400);
  }
  if (!apiKey) {
    log.error("FMP API key not configured", { requestId });
    return jsonResponse({ error: "FMP API key not configured" }, 500);
  }
  log.info("Fetching consensus", { requestId, symbols });
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
  log.info("Consensus complete", { requestId, symbolCount: symbols.length, ...cacheStats });
  return jsonResponse(results);
}
__name(handleConsensus, "handleConsensus");
async function handleFx(url, env, requestId) {
  const pairs = (url.searchParams.get("pairs") || "").split(",").filter(Boolean);
  if (pairs.length === 0) {
    log.warn("Missing pairs param", { requestId, handler: "fx" });
    return jsonResponse({ error: "pairs parameter required" }, 400);
  }
  log.info("Fetching FX rates", { requestId, pairs });
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
  log.info("FX rates complete", { requestId, pairCount: pairs.length, ...cacheStats });
  return jsonResponse(results);
}
__name(handleFx, "handleFx");
async function handleLegacyProxy(url, env, requestId) {
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    log.warn("Missing url param", { requestId, handler: "legacy" });
    return jsonResponse({ error: "Missing url parameter" }, 400);
  }
  if (!targetUrl.startsWith("https://query1.finance.yahoo.com/") && !targetUrl.startsWith("https://query2.finance.yahoo.com/")) {
    log.warn("Blocked non-Yahoo URL", { requestId, url: targetUrl.slice(0, 50) });
    return jsonResponse({ error: "Only Yahoo Finance URLs allowed" }, 403);
  }
  log.info("Legacy proxy request", { requestId, targetUrl: targetUrl.slice(0, 80) });
  const cacheKey = `legacy:v1:${btoa(targetUrl).slice(0, 100)}`;
  let data = await getCached(env, cacheKey, requestId);
  if (data) {
    return jsonResponse(data);
  }
  try {
    const startTime = Date.now();
    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    data = await response.json();
    const duration = Date.now() - startTime;
    log.info("Legacy fetch complete", { requestId, duration, status: response.status });
    await setCache(env, cacheKey, data, CACHE_TTLS.prices, requestId);
    return jsonResponse(data);
  } catch (error) {
    log.error("Legacy fetch failed", { requestId, error: error.message });
    return jsonResponse({ error: error.message }, 500);
  }
}
__name(handleLegacyProxy, "handleLegacyProxy");
async function fetchYahooChart(symbol, range, interval, requestId = "") {
  const startTime = Date.now();
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const duration = Date.now() - startTime;
    if (!response.ok) {
      log.warn("Yahoo chart fetch failed", { requestId, symbol, status: response.status, duration });
      return null;
    }
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      log.warn("Yahoo chart empty result", { requestId, symbol, duration });
      return null;
    }
    const timestamps = result.timestamp || [];
    const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];
    const quote = result.indicators?.quote?.[0] || {};
    log.info("Yahoo chart fetched", { requestId, symbol, dataPoints: timestamps.length, duration });
    return {
      symbol: result.meta?.symbol || symbol,
      currency: result.meta?.currency || "USD",
      exchangeName: result.meta?.exchangeName,
      timestamps,
      prices: adjClose.length ? adjClose : quote.close,
      volume: quote.volume,
      meta: {
        regularMarketPrice: result.meta?.regularMarketPrice,
        previousClose: result.meta?.previousClose,
        instrumentType: result.meta?.instrumentType
      }
    };
  } catch (error) {
    log.error("Yahoo chart fetch error", { requestId, symbol, error: error.message });
    return null;
  }
}
__name(fetchYahooChart, "fetchYahooChart");
async function fetchYahooQuote(symbol, requestId = "") {
  const startTime = Date.now();
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const duration = Date.now() - startTime;
    if (!response.ok) {
      log.warn("Yahoo quote fetch failed", { requestId, symbol, status: response.status, duration });
      return null;
    }
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      log.warn("Yahoo quote empty result", { requestId, symbol, duration });
      return null;
    }
    const meta = result.meta || {};
    const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close || [];
    log.info("Yahoo quote fetched", { requestId, symbol, price: meta.regularMarketPrice, duration });
    return {
      symbol: meta.symbol || symbol,
      price: meta.regularMarketPrice || closes[closes.length - 1] || meta.previousClose,
      previousClose: meta.previousClose,
      name: meta.shortName || meta.longName || symbol,
      type: meta.instrumentType || (meta.quoteType === "ETF" ? "ETF" : "Equity"),
      currency: meta.currency || "USD"
    };
  } catch (error) {
    log.error("Yahoo quote fetch error", { requestId, symbol, error: error.message });
    return null;
  }
}
__name(fetchYahooQuote, "fetchYahooQuote");
async function fetchYahooProfile(symbol, requestId = "") {
  const startTime = Date.now();
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=assetProfile,quoteType`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const duration = Date.now() - startTime;
    if (!response.ok) {
      log.warn("Yahoo profile fetch failed", { requestId, symbol, status: response.status, duration });
      return null;
    }
    const json = await response.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) {
      log.warn("Yahoo profile empty result", { requestId, symbol, duration });
      return null;
    }
    const profile = result.assetProfile || {};
    const quoteType = result.quoteType || {};
    log.info("Yahoo profile fetched", { requestId, symbol, sector: profile.sector, duration });
    return {
      symbol,
      sector: profile.sector || null,
      industry: profile.industry || null,
      longName: quoteType.longName || profile.longBusinessSummary?.slice(0, 100),
      shortName: quoteType.shortName || symbol,
      quoteType: quoteType.quoteType || "EQUITY",
      website: profile.website,
      country: profile.country
    };
  } catch (error) {
    log.error("Yahoo profile fetch error", { requestId, symbol, error: error.message });
    return null;
  }
}
__name(fetchYahooProfile, "fetchYahooProfile");
async function fetchYahooFx(pair, requestId = "") {
  const startTime = Date.now();
  try {
    const from = pair.slice(0, 3);
    const to = pair.slice(3, 6) || "USD";
    const symbol = `${from}${to}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    const duration = Date.now() - startTime;
    if (!response.ok) {
      log.warn("Yahoo FX fetch failed", { requestId, pair, status: response.status, duration });
      return null;
    }
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      log.warn("Yahoo FX empty result", { requestId, pair, duration });
      return null;
    }
    const meta = result.meta || {};
    log.info("Yahoo FX fetched", { requestId, pair, rate: meta.regularMarketPrice, duration });
    return {
      pair,
      from,
      to,
      rate: meta.regularMarketPrice || meta.previousClose,
      previousClose: meta.previousClose
    };
  } catch (error) {
    log.error("Yahoo FX fetch error", { requestId, pair, error: error.message });
    return null;
  }
}
__name(fetchYahooFx, "fetchYahooFx");
async function fetchFMPConsensus(symbol, apiKey, requestId = "") {
  const startTime = Date.now();
  try {
    const [estimates, keyMetrics] = await Promise.all([
      fetchFMPEndpoint(`/api/v3/analyst-estimates/${symbol}`, apiKey, requestId),
      fetchFMPEndpoint(`/api/v3/key-metrics/${symbol}?limit=1`, apiKey, requestId)
    ]);
    const duration = Date.now() - startTime;
    if (!estimates && !keyMetrics) {
      log.warn("FMP consensus no data", { requestId, symbol, duration });
      return null;
    }
    const latestEstimate = Array.isArray(estimates) ? estimates[0] : null;
    const latestMetrics = Array.isArray(keyMetrics) ? keyMetrics[0] : null;
    log.info("FMP consensus fetched", {
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
      fetchedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    log.error("FMP consensus fetch error", { requestId, symbol, error: error.message });
    return null;
  }
}
__name(fetchFMPConsensus, "fetchFMPConsensus");
async function fetchFMPEndpoint(endpoint, apiKey, requestId = "") {
  try {
    const url = `https://financialmodelingprep.com${endpoint}${endpoint.includes("?") ? "&" : "?"}apikey=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      log.warn("FMP endpoint failed", { requestId, endpoint, status: response.status });
      return null;
    }
    return await response.json();
  } catch (error) {
    log.error("FMP endpoint error", { requestId, endpoint, error: error.message });
    return null;
  }
}
__name(fetchFMPEndpoint, "fetchFMPEndpoint");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      "Cache-Control": status === 200 ? "public, max-age=60" : "no-cache"
    }
  });
}
__name(jsonResponse, "jsonResponse");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map
