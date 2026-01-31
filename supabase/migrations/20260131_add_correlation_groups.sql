-- Migration: Add correlation_groups table for per-user correlation group assignments
-- This table stores ticker → group mappings (sector, industry, custom) per portfolio

-- Create correlation_groups table
CREATE TABLE IF NOT EXISTS correlation_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  group_type TEXT NOT NULL DEFAULT 'sector',  -- 'sector', 'industry', 'custom'
  group_name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'auto',  -- 'auto' (from Yahoo metadata) or 'user' (manually set)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portfolio_id, ticker)
);

-- Create index for faster lookups by portfolio
CREATE INDEX IF NOT EXISTS idx_correlation_groups_portfolio ON correlation_groups(portfolio_id);

-- Enable Row Level Security
ALTER TABLE correlation_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access correlation groups for their own portfolios
CREATE POLICY "Users can CRUD own correlation groups"
  ON correlation_groups FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_correlation_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER correlation_groups_updated_at
  BEFORE UPDATE ON correlation_groups
  FOR EACH ROW EXECUTE FUNCTION update_correlation_groups_updated_at();

-- Grant permissions (Supabase handles this via RLS, but explicit for clarity)
GRANT ALL ON correlation_groups TO authenticated;
GRANT ALL ON correlation_groups TO service_role;
