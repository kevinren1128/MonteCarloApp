-- Monte Carlo Portfolio Tracker - Schema V2
-- Adds: distribution params, results storage, report history
-- Run this AFTER the initial schema.sql

-- ============================================
-- UPDATE POSITIONS TABLE
-- Add distribution parameters (the percentile inputs)
-- ============================================

ALTER TABLE positions
ADD COLUMN IF NOT EXISTS p5 NUMERIC,
ADD COLUMN IF NOT EXISTS p25 NUMERIC,
ADD COLUMN IF NOT EXISTS p50 NUMERIC,
ADD COLUMN IF NOT EXISTS p75 NUMERIC,
ADD COLUMN IF NOT EXISTS p95 NUMERIC,
ADD COLUMN IF NOT EXISTS price NUMERIC,
ADD COLUMN IF NOT EXISTS position_type TEXT DEFAULT 'Equity';

COMMENT ON COLUMN positions.p5 IS '5th percentile annual return estimate';
COMMENT ON COLUMN positions.p25 IS '25th percentile annual return estimate';
COMMENT ON COLUMN positions.p50 IS '50th percentile (median) annual return estimate';
COMMENT ON COLUMN positions.p75 IS '75th percentile annual return estimate';
COMMENT ON COLUMN positions.p95 IS '95th percentile annual return estimate';

-- ============================================
-- CORRELATION OVERRIDES TABLE
-- Stores user's manual edits to the correlation matrix
-- ============================================

CREATE TABLE IF NOT EXISTS correlation_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  -- Store the full matrix as JSONB (flexible, handles any size)
  correlation_matrix JSONB NOT NULL,
  -- Method used to generate base matrix
  method TEXT DEFAULT 'historical', -- 'historical', 'ewma', 'shrinkage'
  -- Tickers in order (to map matrix indices)
  tickers TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_correlation_portfolio ON correlation_overrides(portfolio_id);

-- Only one correlation matrix per portfolio
CREATE UNIQUE INDEX IF NOT EXISTS idx_correlation_portfolio_unique
  ON correlation_overrides(portfolio_id);

-- ============================================
-- SIMULATION RESULTS TABLE
-- Stores Monte Carlo simulation outputs
-- ============================================

CREATE TABLE IF NOT EXISTS simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

  -- Run metadata
  run_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  num_paths INTEGER NOT NULL,
  method TEXT DEFAULT 'quasi-monte-carlo', -- 'standard', 'quasi-monte-carlo'

  -- Summary statistics (always save these)
  mean_return NUMERIC,
  median_return NUMERIC,
  std_dev NUMERIC,
  var_95 NUMERIC, -- Value at Risk (5th percentile)
  cvar_95 NUMERIC, -- Conditional VaR
  sharpe_ratio NUMERIC,
  max_drawdown NUMERIC,

  -- Percentile results
  percentiles JSONB, -- {p1: x, p5: x, p10: x, ..., p99: x}

  -- Full distribution (optional, can be large)
  -- Store as array of final portfolio values
  path_endpoints NUMERIC[], -- Final values of each path

  -- Don't store full paths (too large) - can regenerate if needed

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_portfolio ON simulation_results(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_simulation_date ON simulation_results(run_date DESC);

-- Keep only latest N results per portfolio (optional cleanup)
-- Can implement via trigger or scheduled job

-- ============================================
-- FACTOR ANALYSIS RESULTS TABLE
-- Stores factor decomposition outputs
-- ============================================

CREATE TABLE IF NOT EXISTS factor_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

  run_date TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Factor exposures (betas)
  factor_exposures JSONB NOT NULL, -- {SPY: 0.8, QQQ: 0.3, ...}

  -- R-squared and residual
  r_squared NUMERIC,
  residual_vol NUMERIC,

  -- Per-position factor betas
  position_betas JSONB, -- {AAPL: {SPY: 1.2, QQQ: 0.8}, ...}

  -- Risk contribution by factor
  risk_contribution JSONB, -- {market: 60%, size: 10%, ...}

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_factor_portfolio ON factor_results(portfolio_id);

-- ============================================
-- OPTIMIZATION RESULTS TABLE
-- Stores portfolio optimization outputs
-- ============================================

CREATE TABLE IF NOT EXISTS optimization_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

  run_date TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optimization type
  objective TEXT DEFAULT 'max_sharpe', -- 'max_sharpe', 'min_variance', 'risk_parity'

  -- Constraints used
  constraints JSONB, -- {max_position: 0.3, min_position: 0.01, ...}

  -- Optimal weights
  optimal_weights JSONB NOT NULL, -- {AAPL: 0.15, MSFT: 0.12, ...}

  -- Resulting metrics
  expected_return NUMERIC,
  expected_volatility NUMERIC,
  sharpe_ratio NUMERIC,

  -- Efficient frontier points (for visualization)
  efficient_frontier JSONB, -- [{return: x, vol: y, weights: {...}}, ...]

  -- Current vs optimal comparison
  current_metrics JSONB,
  improvement JSONB, -- {sharpe_delta: 0.2, vol_reduction: 0.05}

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_portfolio ON optimization_results(portfolio_id);

-- ============================================
-- REPORTS TABLE
-- Stores metadata about generated PDF reports
-- ============================================

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,

  -- Report metadata
  title TEXT NOT NULL,
  report_type TEXT DEFAULT 'full', -- 'full', 'summary', 'simulation', 'factor'
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Snapshot of what was included
  included_sections TEXT[], -- ['positions', 'simulation', 'factors', 'optimization']

  -- Summary data at time of generation
  portfolio_value NUMERIC,
  num_positions INTEGER,

  -- Optional: store the PDF blob (if small) or reference
  -- For large files, better to use Supabase Storage
  -- pdf_data BYTEA,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_portfolio ON reports(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(generated_at DESC);

-- ============================================
-- MARKET DATA CACHE TABLE (optional)
-- For per-user price cache if not using Cloudflare KV
-- ============================================

-- NOTE: This is OPTIONAL - prefer Cloudflare KV for shared market data
-- Only use this if you want per-user isolation or offline support

CREATE TABLE IF NOT EXISTS market_data_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  symbol TEXT NOT NULL,
  data_type TEXT NOT NULL DEFAULT 'price_history', -- 'price_history', 'profile', 'consensus'

  -- The actual data
  data JSONB NOT NULL,

  -- Cache metadata
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,

  UNIQUE(user_id, symbol, data_type)
);

CREATE INDEX IF NOT EXISTS idx_market_cache_user ON market_data_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_market_cache_symbol ON market_data_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_market_cache_expires ON market_data_cache(expires_at);

-- ============================================
-- ROW LEVEL SECURITY FOR NEW TABLES
-- ============================================

ALTER TABLE correlation_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE factor_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data_cache ENABLE ROW LEVEL SECURITY;

-- Policies (users can only access their own data)
CREATE POLICY "Users can CRUD own correlations"
  ON correlation_overrides FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can CRUD own simulations"
  ON simulation_results FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can CRUD own factor results"
  ON factor_results FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can CRUD own optimization results"
  ON optimization_results FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can CRUD own reports"
  ON reports FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

CREATE POLICY "Users can CRUD own market cache"
  ON market_data_cache FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- HELPER: Cleanup old results (keep last 10 per portfolio)
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_simulation_results()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM simulation_results
  WHERE portfolio_id = NEW.portfolio_id
    AND id NOT IN (
      SELECT id FROM simulation_results
      WHERE portfolio_id = NEW.portfolio_id
      ORDER BY created_at DESC
      LIMIT 10
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-cleanup after insert
DROP TRIGGER IF EXISTS cleanup_simulations ON simulation_results;
CREATE TRIGGER cleanup_simulations
  AFTER INSERT ON simulation_results
  FOR EACH ROW EXECUTE FUNCTION cleanup_old_simulation_results();

-- ============================================
-- VERIFICATION
-- ============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
