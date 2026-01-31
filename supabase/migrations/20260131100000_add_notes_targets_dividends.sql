-- Migration: Add position notes, target allocations, and dividend history tables
-- Date: 2026-01-31

-- ============================================
-- POSITION NOTES TABLE
-- ============================================
-- Stores investment thesis, notes, and tags for each position

CREATE TABLE IF NOT EXISTS public.position_notes (
  position_id UUID PRIMARY KEY REFERENCES public.positions(id) ON DELETE CASCADE,
  notes TEXT,
  tags TEXT[],
  thesis TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.position_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access notes for positions in their portfolios
CREATE POLICY "Users can CRUD own position notes"
  ON public.position_notes
  FOR ALL
  USING (
    position_id IN (
      SELECT p.id FROM public.positions p
      JOIN public.portfolios pf ON p.portfolio_id = pf.id
      WHERE pf.user_id = auth.uid()
    )
  );

-- Trigger to update updated_at
CREATE TRIGGER position_notes_updated_at
  BEFORE UPDATE ON public.position_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- TARGET ALLOCATIONS TABLE
-- ============================================
-- Stores rebalancing target weights for each symbol

CREATE TABLE IF NOT EXISTS public.target_allocations (
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  target_weight NUMERIC NOT NULL,
  min_weight NUMERIC,
  max_weight NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (portfolio_id, symbol)
);

-- Enable RLS
ALTER TABLE public.target_allocations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own target allocations
CREATE POLICY "Users can CRUD own target allocations"
  ON public.target_allocations
  FOR ALL
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Trigger to update updated_at
CREATE TRIGGER target_allocations_updated_at
  BEFORE UPDATE ON public.target_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_target_allocations_portfolio ON public.target_allocations(portfolio_id);

-- ============================================
-- DIVIDEND HISTORY TABLE
-- ============================================
-- Tracks dividend payments received

CREATE TABLE IF NOT EXISTS public.dividend_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  ex_date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  shares_held NUMERIC,
  total_amount NUMERIC,
  received_date DATE,
  reinvested BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dividend_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own dividend history
CREATE POLICY "Users can CRUD own dividend history"
  ON public.dividend_history
  FOR ALL
  USING (portfolio_id IN (SELECT id FROM public.portfolios WHERE user_id = auth.uid()));

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_dividend_history_portfolio ON public.dividend_history(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_dividend_history_symbol ON public.dividend_history(portfolio_id, symbol);
CREATE INDEX IF NOT EXISTS idx_dividend_history_date ON public.dividend_history(portfolio_id, ex_date);

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON public.position_notes TO authenticated;
GRANT ALL ON public.target_allocations TO authenticated;
GRANT ALL ON public.dividend_history TO authenticated;
