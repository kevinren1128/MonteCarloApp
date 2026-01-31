-- Monte Carlo Portfolio Tracker - Supabase Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard -> SQL Editor
--
-- This schema provides:
-- - portfolios: User's portfolio with cash balance
-- - positions: Individual stock/ETF positions
-- - portfolio_settings: User preferences stored as JSONB
-- - Row Level Security (RLS): Users can only access their own data
--
-- Prerequisites:
-- 1. Create a Supabase project at https://supabase.com
-- 2. Enable Google OAuth in Authentication -> Providers
-- 3. Run this SQL in the SQL Editor

-- ============================================
-- PORTFOLIOS TABLE
-- ============================================
-- Stores the main portfolio record for each user

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Portfolio',
  cash_balance NUMERIC NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios(user_id);

-- ============================================
-- POSITIONS TABLE
-- ============================================
-- Stores individual positions within a portfolio

CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  shares NUMERIC NOT NULL,
  avg_cost NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast portfolio lookups
CREATE INDEX IF NOT EXISTS idx_positions_portfolio ON positions(portfolio_id);

-- Unique constraint: one position per symbol per portfolio
CREATE UNIQUE INDEX IF NOT EXISTS idx_positions_portfolio_symbol
  ON positions(portfolio_id, symbol);

-- ============================================
-- PORTFOLIO SETTINGS TABLE
-- ============================================
-- Stores user preferences as flexible JSONB

CREATE TABLE IF NOT EXISTS portfolio_settings (
  portfolio_id UUID PRIMARY KEY REFERENCES portfolios(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- AUTO-UPDATE TRIGGERS
-- ============================================
-- Automatically update updated_at and revision on changes

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_portfolio_revision()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  NEW.revision = COALESCE(OLD.revision, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS portfolios_updated_at ON portfolios;
CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_portfolio_revision();

DROP TRIGGER IF EXISTS positions_updated_at ON positions;
CREATE TRIGGER positions_updated_at
  BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS portfolio_settings_updated_at ON portfolio_settings;
CREATE TRIGGER portfolio_settings_updated_at
  BEFORE UPDATE ON portfolio_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Ensures users can only access their own data

-- Enable RLS on all tables
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Users can CRUD own portfolios" ON portfolios;
DROP POLICY IF EXISTS "Users can CRUD positions in own portfolios" ON positions;
DROP POLICY IF EXISTS "Users can CRUD own settings" ON portfolio_settings;

-- Portfolio policies: users can only see/modify their own portfolios
CREATE POLICY "Users can CRUD own portfolios"
  ON portfolios FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Position policies: users can only see/modify positions in their portfolios
CREATE POLICY "Users can CRUD positions in own portfolios"
  ON positions FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- Settings policies: users can only see/modify settings for their portfolios
CREATE POLICY "Users can CRUD own settings"
  ON portfolio_settings FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()))
  WITH CHECK (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- ============================================
-- HELPER FUNCTIONS (Optional)
-- ============================================

-- Function to get portfolio value (positions + cash)
CREATE OR REPLACE FUNCTION get_portfolio_value(p_portfolio_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_cash NUMERIC;
  v_positions_value NUMERIC;
BEGIN
  SELECT cash_balance INTO v_cash FROM portfolios WHERE id = p_portfolio_id;

  -- Note: This doesn't include current prices - just shares * avg_cost
  SELECT COALESCE(SUM(shares * COALESCE(avg_cost, 0)), 0)
  INTO v_positions_value
  FROM positions
  WHERE portfolio_id = p_portfolio_id;

  RETURN COALESCE(v_cash, 0) + v_positions_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a default portfolio for new users
CREATE OR REPLACE FUNCTION create_default_portfolio()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO portfolios (user_id, name, cash_balance)
  VALUES (NEW.id, 'My Portfolio', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional: Auto-create portfolio for new users
-- Uncomment if you want every user to start with a portfolio
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION create_default_portfolio();

-- ============================================
-- SAMPLE QUERIES (for testing)
-- ============================================

-- Test: Insert a portfolio (replace user_id with actual UUID)
-- INSERT INTO portfolios (user_id, name, cash_balance) VALUES ('your-user-uuid', 'Test Portfolio', 10000);

-- Test: Get all portfolios for current user
-- SELECT * FROM portfolios WHERE user_id = auth.uid();

-- Test: Get portfolio with positions
-- SELECT p.*,
--        json_agg(pos.*) as positions
-- FROM portfolios p
-- LEFT JOIN positions pos ON pos.portfolio_id = p.id
-- WHERE p.user_id = auth.uid()
-- GROUP BY p.id;

-- ============================================
-- VERIFICATION
-- ============================================

-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('portfolios', 'positions', 'portfolio_settings');

-- List RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';
