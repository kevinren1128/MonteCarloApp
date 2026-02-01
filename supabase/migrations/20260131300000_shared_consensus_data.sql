-- Migration: Shared FMP Consensus Data System
-- Creates tables for centralized consensus data management via Cloudflare Worker cron job

-- ============================================================================
-- Table 1: tracked_tickers
-- Aggregates all tickers across user portfolios for cron job targeting
-- ============================================================================

CREATE TABLE IF NOT EXISTS tracked_tickers (
  ticker TEXT PRIMARY KEY,
  ref_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,

  -- Backoff state for failed tickers
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  failure_reason TEXT,  -- 'unsupported', 'rate_limited', 'not_found', 'network_error'

  -- Metadata
  is_etf BOOLEAN DEFAULT false,
  exchange TEXT,
  currency TEXT
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tracked_tickers_active
  ON tracked_tickers(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_tracked_tickers_retry
  ON tracked_tickers(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- NO RLS - this is a shared table managed by service role only
-- Authenticated users cannot read/write directly

-- ============================================================================
-- Table 2: consensus_snapshots
-- Stores historical consensus data with flexible JSONB + typed key fields
-- ============================================================================

CREATE TABLE IF NOT EXISTS consensus_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  as_of_date DATE NOT NULL,

  -- Typed columns for key queryable fields
  currency TEXT,
  price NUMERIC,
  market_cap NUMERIC,
  forward_pe NUMERIC,
  fy1_revenue NUMERIC,
  fy1_eps NUMERIC,
  analyst_count INTEGER,
  consensus_rating TEXT,  -- 'Strong Buy', 'Buy', 'Hold', 'Sell', 'Strong Sell'
  price_target_consensus NUMERIC,

  -- Flexible JSONB for all other fields (stores FULL FMP response)
  data JSONB NOT NULL DEFAULT '{}',

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'ok',  -- 'ok', 'partial', 'failed'
  error_code TEXT,
  error_detail TEXT,

  -- Versioning
  schema_version INTEGER NOT NULL DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'fmp',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_ticker_date UNIQUE (ticker, as_of_date)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_consensus_ticker
  ON consensus_snapshots(ticker);
CREATE INDEX IF NOT EXISTS idx_consensus_date
  ON consensus_snapshots(as_of_date DESC);
CREATE INDEX IF NOT EXISTS idx_consensus_ticker_date
  ON consensus_snapshots(ticker, as_of_date DESC);

-- Enable RLS
ALTER TABLE consensus_snapshots ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read consensus data (shared across all users)
CREATE POLICY "Authenticated users can read consensus data"
  ON consensus_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can write (via Cloudflare Worker cron job)
CREATE POLICY "Service role can manage consensus data"
  ON consensus_snapshots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON consensus_snapshots TO authenticated;
GRANT ALL ON consensus_snapshots TO service_role;

-- ============================================================================
-- View 3: consensus_latest
-- Materialized view for fast lookups of latest data per ticker
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS consensus_latest AS
SELECT DISTINCT ON (ticker)
  id,
  ticker,
  as_of_date,
  currency,
  price,
  market_cap,
  forward_pe,
  fy1_revenue,
  fy1_eps,
  analyst_count,
  consensus_rating,
  price_target_consensus,
  data,
  status,
  error_code,
  schema_version,
  fetched_at
FROM consensus_snapshots
ORDER BY ticker, as_of_date DESC, fetched_at DESC;

-- Unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_consensus_latest_ticker
  ON consensus_latest(ticker);

-- Grant read access to authenticated users
GRANT SELECT ON consensus_latest TO authenticated;
GRANT ALL ON consensus_latest TO service_role;

-- ============================================================================
-- Function: refresh_consensus_latest
-- Called after cron job completes to update materialized view
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_consensus_latest()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY consensus_latest;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION refresh_consensus_latest() TO service_role;

-- ============================================================================
-- Function: sync_tracked_tickers
-- Statement-level recompute of tracked_tickers from positions table
-- Runs AFTER full delete+insert completes (no race conditions)
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_tracked_tickers()
RETURNS TRIGGER AS $$
BEGIN
  -- Recompute ref_counts for all tickers in one atomic operation
  -- This runs AFTER the full delete+insert completes
  INSERT INTO tracked_tickers (ticker, ref_count, last_seen_at, active)
  SELECT
    symbol AS ticker,
    COUNT(*) AS ref_count,
    now() AS last_seen_at,
    true AS active
  FROM positions
  GROUP BY symbol
  ON CONFLICT (ticker) DO UPDATE
  SET ref_count = EXCLUDED.ref_count,
      last_seen_at = EXCLUDED.last_seen_at,
      active = EXCLUDED.ref_count > 0;

  -- Mark tickers no longer in any portfolio as inactive (but keep for retry backoff)
  UPDATE tracked_tickers
  SET active = false, ref_count = 0
  WHERE ticker NOT IN (SELECT DISTINCT symbol FROM positions)
    AND active = true;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Statement-level trigger (runs once per statement, not per row)
-- Handles INSERT, DELETE, and UPDATE on positions table
DROP TRIGGER IF EXISTS positions_sync_tracked_tickers ON positions;
CREATE TRIGGER positions_sync_tracked_tickers
  AFTER INSERT OR DELETE OR UPDATE ON positions
  FOR EACH STATEMENT EXECUTE FUNCTION sync_tracked_tickers();

-- ============================================================================
-- Function: cleanup_old_consensus_snapshots
-- Weekly cleanup to keep only last 7 days of snapshots (for debugging)
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_consensus_snapshots()
RETURNS void AS $$
BEGIN
  DELETE FROM consensus_snapshots
  WHERE as_of_date < CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_old_consensus_snapshots() TO service_role;

-- ============================================================================
-- Initial population of tracked_tickers from existing positions
-- ============================================================================

INSERT INTO tracked_tickers (ticker, ref_count, last_seen_at, active)
SELECT
  symbol AS ticker,
  COUNT(*) AS ref_count,
  now() AS last_seen_at,
  true AS active
FROM positions
GROUP BY symbol
ON CONFLICT (ticker) DO UPDATE
SET ref_count = EXCLUDED.ref_count,
    last_seen_at = EXCLUDED.last_seen_at,
    active = true;
