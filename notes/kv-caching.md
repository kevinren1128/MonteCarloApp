# KV Caching

## What Was Implemented

Cloudflare KV storage for edge-cached market data, shared across all users.

### KV Namespace

```
Binding: CACHE
ID: 69f4d706eb4943e7af055d297cca3c78
```

### Cache Key Patterns

| Data Type | Key Pattern | TTL |
|-----------|-------------|-----|
| Historical prices | `prices:v1:{symbol}:{range}:{interval}` | 4 hours |
| Current quotes | `quotes:v1:{symbol}` | 15 minutes |
| Company profile | `profile:v1:{symbol}` | 7 days |
| Exchange rates | `fx:v1:{base}:{quote}` | 24 hours |
| **Unified metrics** | `metrics:v1:{symbol}` | **24 hours** |
| Beta | `beta:v1:{symbol}:{benchmark}:{range}:{interval}` | 6 hours |
| Volatility | `vol:v1:{symbol}:{range}:{interval}` | 6 hours |
| Distribution | `dist:v1:{symbol}:{range}:{interval}:b{count}` | 12 hours |
| Calendar returns | `calret:v1:{symbol}:{range}:{interval}` | 24 hours |

### Version Prefix

Keys include version prefix (e.g., `v1:`) to allow cache invalidation when format changes.

## Key Decisions

### 1. Shared Cache (No User Keys)

**Why shared?**
- Market data is same for all users
- Reduces Yahoo API calls
- First user fetches, everyone benefits

**What's NOT cached in KV:**
- User portfolios (in Supabase)
- User settings (in Supabase)
- Anything user-specific

### 2. TTL by Data Volatility

**Shorter TTLs:**
- Quotes (15 min) — prices change frequently
- Historical prices (4h) — new data points added daily

**Longer TTLs:**
- Company profile (7 days) — rarely changes
- Calendar returns (24h) — computed once per day
- FX rates (24h) — change slowly

### 3. Cache-Through Pattern

```javascript
async function getCachedOrFetch(env, key, ttl, fetchFn) {
  // Try KV first
  const cached = await env.CACHE.get(key, 'json');
  if (cached) return cached;

  // Fetch from upstream
  const data = await fetchFn();

  // Store in KV
  await env.CACHE.put(key, JSON.stringify(data), { expirationTtl: ttl });

  return data;
}
```

### 4. Unified Metrics Key

**Why one key per symbol?**
- Positions tab needs all metrics at once
- Single KV read vs multiple
- 24h cache is acceptable for positions

## What We Tried That Didn't Work

1. **Currency in cache key**
   - Pattern: `prices:v1:{symbol}:{range}:USD`
   - Problem: Same data cached twice (with/without conversion)
   - Solution: Cache raw data, convert on read

2. **Long TTLs for everything**
   - Problem: Stale quotes during market hours
   - Solution: 15-minute cache for quotes

3. **Caching errors**
   - Problem: Yahoo API errors cached, propagated
   - Solution: Only cache successful responses

## Gotchas

1. **KV Rate Limits (Free Tier)**
   - 100,000 reads/day — rarely an issue
   - 1,000 writes/day — CAN be exhausted during heavy dev
   - Error code 10048 = daily write limit reached
   - Limits reset at UTC midnight

2. **KV is Eventually Consistent**
   - Writes may not be immediately visible
   - Don't rely on read-after-write consistency
   - Acceptable for cache use case

3. **Key Size Limits**
   - Key: 512 bytes max
   - Value: 25 MB max
   - Careful with long symbol lists

4. **JSON Parsing**
   - Use `await env.CACHE.get(key, 'json')` for auto-parse
   - Returns `null` if not found (not error)

5. **TTL is in Seconds**
   - `expirationTtl: 14400` = 4 hours
   - Easy to confuse with milliseconds

## Future Ideas

1. **Cache warming**
   - Cron job to pre-fetch popular symbols
   - Ensure cache is hot for common requests

2. **Stale-while-revalidate**
   - Return stale data immediately
   - Refresh in background
   - Better UX for expired cache

3. **Cache analytics**
   - Track hit/miss ratio
   - Identify hot keys
   - Optimize TTLs

4. **R2 for large data**
   - Move historical price arrays to R2
   - KV for metadata only
   - Handle 25MB limit

### Local Development

```bash
# List cached keys
npx wrangler kv:key list --binding=CACHE

# Delete a key
npx wrangler kv:key delete --binding=CACHE "prices:v1:AAPL:1y:1d"

# Get a key value
npx wrangler kv:key get --binding=CACHE "prices:v1:AAPL:1y:1d"
```
