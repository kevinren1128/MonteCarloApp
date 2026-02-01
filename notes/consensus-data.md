# Shared FMP Consensus Data System

## Overview

The consensus data system provides shared analyst estimates across all users via a centralized cron job that fetches FMP data daily.

## Architecture

```
                                           Cloudflare Worker
                                           Cron (6 AM UTC)
                                                  │
                                                  ▼
┌─────────────────┐     positions      ┌─────────────────────┐
│     Users       │ ─────sync────────► │   tracked_tickers   │
│   (Supabase)    │                    │       table         │
└─────────────────┘                    └──────────┬──────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────┐
                                    │   consensus_snapshots   │
                                    │         table           │
                                    └──────────┬──────────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────┐
                                    │    consensus_latest     │
                                    │  (materialized view)    │
                                    └──────────┬──────────────┘
                                                  │
                                                  ▼
                                    ┌─────────────────────────┐
                                    │     ConsensusTab.jsx    │
                                    │   (reads from shared)   │
                                    └─────────────────────────┘
```

## Database Tables

### `tracked_tickers`
Aggregates all unique tickers across user portfolios.

| Column | Type | Description |
|--------|------|-------------|
| ticker | TEXT (PK) | Stock symbol |
| ref_count | INTEGER | Number of portfolios containing this ticker |
| active | BOOLEAN | Whether ticker is in any active portfolio |
| failure_count | INTEGER | Consecutive fetch failures |
| next_retry_at | TIMESTAMPTZ | When to retry after failure (exponential backoff) |
| failure_reason | TEXT | 'unsupported', 'rate_limited', 'fetch_error' |
| is_etf | BOOLEAN | Whether ticker is an ETF (skip consensus fetch) |

**Sync Trigger**: Statement-level trigger on `positions` table recomputes counts after each save.

### `consensus_snapshots`
Stores daily consensus data with JSONB for full data + typed columns for fast queries.

| Column | Type | Description |
|--------|------|-------------|
| ticker | TEXT | Stock symbol |
| as_of_date | DATE | Date of snapshot |
| price | NUMERIC | Stock price |
| market_cap | NUMERIC | Market capitalization |
| forward_pe | NUMERIC | Forward P/E ratio |
| fy1_revenue | NUMERIC | FY1 revenue estimate |
| fy1_eps | NUMERIC | FY1 EPS estimate |
| analyst_count | INTEGER | Total analysts covering |
| consensus_rating | TEXT | 'Buy', 'Hold', 'Sell' |
| data | JSONB | Full FMP response (100+ fields) |
| status | TEXT | 'ok', 'partial', 'failed' |

**RLS**: Authenticated users can read, only service_role can write.

### `consensus_latest` (Materialized View)
Fast lookup for most recent data per ticker.

Refreshed concurrently after each cron run.

## Cron Job Details

**Schedule**: Daily at 6 AM UTC

**Process**:
1. Query `tracked_tickers` for active, non-ETF tickers with `next_retry_at <= now()`
2. Batch fetch from FMP (5 tickers/batch, 3s delay)
3. Save to `consensus_snapshots` with UPSERT
4. Update failure state for failed tickers (exponential backoff)
5. Refresh `consensus_latest` materialized view
6. Cleanup snapshots older than 7 days

**Backoff Schedule** (for failed tickers):
- 1st failure: retry in 1 hour
- 2nd failure: retry in 4 hours
- 3rd failure: retry in 12 hours
- 4th failure: retry in 24 hours
- 5th failure: retry in 3 days
- 6th failure: retry in 7 days
- 7th+ failure: retry in 30 days

## Frontend Integration

### `consensusService.js`
```javascript
// Read from shared database
const sharedData = await getSharedConsensusData(tickers);

// Get tickers needing live fetch
const missing = getMissingOrStaleTickers(tickers, sharedData);
```

### `ConsensusTab.jsx` Changes
1. **On Mount**: Load localStorage, then async fetch from shared DB
2. **On Fetch**: Try shared DB first, then FMP for missing/stale
3. **Data Merge**: `{ ...sharedData, ...liveData }` (live wins)

## Configuration

### Cloudflare Worker Secrets
```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

Get service_role key from: Supabase Dashboard > Settings > API > service_role

### wrangler.toml
```toml
[triggers]
crons = ["0 6 * * *"]  # 6 AM UTC daily
```

## Testing

### Manual Cron Trigger
```bash
# In Cloudflare dashboard: Workers > monte-carlo-cache > Triggers > Run Now
# Or use wrangler:
wrangler tail  # Watch logs during cron run
```

### Verify Database
```sql
-- Check tracked tickers
SELECT * FROM tracked_tickers WHERE active = true LIMIT 10;

-- Check latest consensus
SELECT ticker, as_of_date, status, fetched_at FROM consensus_latest LIMIT 10;

-- Check failure backoff
SELECT ticker, failure_count, next_retry_at FROM tracked_tickers WHERE failure_count > 0;
```

## Gotchas

1. **Materialized View RLS**: Views bypass RLS. While this is fine for shared read-only data, the frontend Supabase client still needs explicit GRANT permissions to read the view.

2. **GRANT SELECT Required**: After creating `consensus_latest` view, you MUST run:
   ```sql
   GRANT SELECT ON consensus_latest TO anon, authenticated;
   ```
   Without this, the anon/authenticated roles get empty results (no error, just `[]`).

3. **Statement-Level Trigger**: Uses AFTER STATEMENT (not row-level) to handle delete+insert atomic saves.

4. **Supabase JS in Workers**: Direct REST API used instead of `@supabase/supabase-js` (Node.js deps don't work in Workers).

5. **Data Shape Transformation**: JSONB stores full FMP response; frontend transforms to match existing ConsensusTab format.

6. **Stale Threshold**: Data older than 48 hours triggers live FMP fallback (if user has API key).

## Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260131300000_shared_consensus_data.sql` | Database schema |
| `supabase/migrations/20260201000000_fix_consensus_view_permissions.sql` | GRANT SELECT on materialized view |
| `worker/index.js` (scheduled handler) | Cron job implementation |
| `src/services/consensusService.js` | Frontend database reads |
| `src/components/tabs/ConsensusTab.jsx` | UI integration |
| `wrangler.toml` | Cron trigger config |

## Future Enhancements

- [ ] Email alerts for repeated failures
- [ ] Dashboard for cron job monitoring
- [ ] Historical charts from consensus_snapshots
- [ ] Automatic ETF detection from FMP API
