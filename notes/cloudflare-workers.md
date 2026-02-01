# Cloudflare Workers

## What Was Implemented

A Cloudflare Worker that proxies Yahoo Finance API calls, pre-computes derived metrics, and caches responses in KV for edge delivery.

### Worker URL

```
https://monte-carlo-cache.kevinren1128.workers.dev
```

### Endpoints

**Market Data (shared cache):**
```
GET /api/prices?symbols=AAPL,MSFT&range=1y   → Historical prices (4h cache)
GET /api/quotes?symbols=AAPL,MSFT            → Current quotes (15m cache)
GET /api/profile?symbols=AAPL                → Company info (7d cache)
GET /api/consensus?symbols=AAPL              → FMP analyst data (4h cache)
GET /api/fx?pairs=EURUSD,GBPUSD              → Exchange rates (24h cache)
```

**Derived Metrics (pre-computed):**
```
GET /api/metrics?symbols=AAPL,MSFT&benchmark=SPY    → Unified metrics (24h cache)
GET /api/beta?symbols=AAPL&benchmark=SPY&range=1y   → Beta vs benchmark (6h cache)
GET /api/volatility?symbols=AAPL&range=1y           → Annualized vol (6h cache)
GET /api/distribution?symbols=AAPL&range=5y&bootstrap=1000  → P5-P95 (12h cache)
GET /api/calendar-returns?symbols=AAPL&range=10y    → Calendar year returns (24h cache)
```

### Key Files

| File | Purpose |
|------|---------|
| `worker/index.js` | Main worker entry point |
| `wrangler.toml` | Cloudflare configuration |

## Key Decisions

### 1. Worker over Vercel Functions

**Why Cloudflare?**
- Edge execution (lower latency)
- KV storage for caching
- 100K free requests/day
- Already have account

**Trade-offs:**
- Separate deployment from frontend
- Different runtime (not Node.js)

### 2. Pre-computed Metrics

**Why compute on worker?**
- Reduce client-side computation
- Share results across users
- Faster page loads

**What's pre-computed:**
- Beta (with lag testing for international stocks)
- Volatility (annualized %)
- YTD/1Y/30D returns
- 30-day sparkline data
- Bootstrap percentiles (P5/P25/P50/P75/P95)

### 3. Unified Metrics Endpoint

**Why `/api/metrics`?**
- Single request for Positions tab data
- Combines: beta, vol, returns, sparkline, price
- 24h cache (positions don't change that fast)

### 4. FX Conversion on Worker

**Why server-side FX?**
- Consistent conversion across users
- Cache FX rates (they change slowly)
- Frontend always gets USD prices

## What We Tried That Didn't Work

1. **Caching FX-converted prices with currency in key**
   - Problem: Same data cached twice (with/without conversion)
   - Solution: Cache raw data, do FX conversion on each request

2. **Long cache TTLs for quotes**
   - Problem: Stale prices during market hours
   - Solution: 15-minute cache, shorter during trading

3. **Passing all parameters in URL**
   - Problem: URL length limits for many symbols
   - Solution: POST body for large requests

## Gotchas

1. **KV Rate Limits (Free Tier)**
   - 100,000 reads/day — rarely an issue
   - 1,000 writes/day — can be exhausted during heavy dev
   - If writes fail (error 10048), limits reset at UTC midnight

2. **Worker vs Node.js**
   - No `fs`, `path`, or Node built-ins
   - Use Web APIs (`fetch`, `crypto`)
   - No npm packages that use Node APIs

3. **CORS Headers**
   - Must add `Access-Control-Allow-Origin: *` to responses
   - Preflight (OPTIONS) requests need handling
   - Credentials mode affects allowed origins

4. **Yahoo Finance Rate Limiting**
   - Worker helps by caching, but still hits limits
   - Use batch endpoints where possible
   - Add delays between requests if needed

## Future Ideas

1. **Real-time quotes via WebSocket**
   - Durable Objects for WebSocket connections
   - Push price updates to connected clients

2. **Historical data backfill**
   - Store 10+ years of data in R2
   - Query historical data without Yahoo API

3. **Portfolio analytics API**
   - Move Monte Carlo to Worker
   - Return simulation results as API

4. **Rate limit tracking**
   - Track requests per user
   - Implement fair usage limits
