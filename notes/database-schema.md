# Database Schema

## What Was Implemented

PostgreSQL database on Supabase with Row Level Security for user data isolation.

### Supabase Project

```
URL: https://uoyvihrdllwslljminid.supabase.co
Dashboard: https://supabase.com/dashboard/project/uoyvihrdllwslljminid
```

### Tables

**Core Tables:**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `portfolios` | Portfolio metadata | user_id, name, cash_balance, revision |
| `positions` | Stock positions | portfolio_id, symbol, shares, avg_cost, p5/p25/p50/p75/p95, currency, domestic_price, exchange_rate |
| `portfolio_settings` | UI preferences | portfolio_id, settings (JSONB) |

**Analysis Results:**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `correlation_overrides` | Edited correlation matrix | portfolio_id, correlation_matrix (JSONB), tickers[] |
| `simulation_results` | Monte Carlo outputs | portfolio_id, num_paths, percentiles, var_95, cvar_95 |
| `factor_results` | Factor analysis | portfolio_id, factor_exposures, r_squared |
| `optimization_results` | Portfolio optimization | portfolio_id, optimal_weights, efficient_frontier |
| `reports` | Generated report history | portfolio_id, title, generated_at |

**Position Enrichment:**

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `position_notes` | Investment thesis & tags | position_id, notes, thesis, tags[] |
| `target_allocations` | Rebalancing targets | portfolio_id, symbol, target_weight, min_weight, max_weight |
| `dividend_history` | Dividend tracking | portfolio_id, symbol, ex_date, amount, shares_held, reinvested |

### Row Level Security (RLS)

All tables have RLS enabled. Example policy:

```sql
CREATE POLICY "Users can CRUD own portfolios"
  ON portfolios FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD positions in own portfolios"
  ON positions FOR ALL
  USING (portfolio_id IN (SELECT id FROM portfolios WHERE user_id = auth.uid()));
```

## Key Decisions

### 1. Delete + Insert for Positions

**Why not upsert?**
- User can have same ticker multiple times (different lots)
- Unique constraint on (portfolio_id, symbol) would prevent this
- Delete all, insert fresh is simpler and correct

**Trade-offs:**
- More database writes
- Brief moment with no positions (acceptable)

### 2. JSONB for Flexible Data

**Where we use JSONB:**
- `portfolio_settings.settings` — UI preferences (flexible schema)
- `correlation_overrides.correlation_matrix` — 2D array stored as JSON

**Why JSONB over normalized tables?**
- Settings change frequently, schema flexibility needed
- Correlation matrix is a blob, not relational

### 3. Revision-Based Conflict Resolution

**How it works:**
- Each portfolio has a `revision` counter
- On sync, higher revision wins
- Prevents lost updates in multi-device scenarios

**Trigger:**
```sql
CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 4. Currency Fields in Positions

**Fields for international stocks:**
- `currency` — Original currency code (e.g., 'JPY')
- `domestic_price` — Price in local currency
- `exchange_rate` — Local → USD conversion rate
- `price` — USD price (used for calculations)

## What We Tried That Didn't Work

1. **Upsert on positions**
   - Problem: Can't have same ticker twice
   - Solution: Delete + Insert pattern

2. **Storing correlation matrix in separate table**
   - Problem: Complex queries, many rows
   - Solution: JSONB in single row

3. **Real-time subscriptions for sync**
   - Problem: Overkill for single-user scenarios
   - Solution: Pull-based sync on login/save

## Gotchas

1. **positionsKey must include all synced fields**
   - If you add a new field to positions, add it to `positionsKey` in App.jsx
   - Otherwise, changes won't trigger sync
   - We learned this with currency fields

2. **RLS hides data, doesn't error**
   - If RLS blocks access, query returns empty, not error
   - Debug by checking `auth.uid()` matches `user_id`

3. **JSONB arrays are not PostgreSQL arrays**
   - `correlation_matrix` is JSONB, not `float[][]`
   - Use `jsonb_array_elements` for queries

4. **Timestamps are UTC**
   - Supabase stores `timestamptz` in UTC
   - Convert to local time on frontend

## Future Ideas

1. **Audit log table**
   - Track all changes to positions
   - Show portfolio history over time

2. **Shared portfolios**
   - Allow read-only sharing via link
   - RLS policy for shared access

3. **Portfolio versioning**
   - Store snapshots at key points
   - "Time travel" to past portfolios

4. **Database functions**
   - Move complex calculations to PL/pgSQL
   - Reduce client-side computation

### Supabase CLI Commands

```bash
npx supabase db dump --schema public -f supabase/current_schema.sql  # Export schema
npx supabase db push                                                  # Push migrations
npx supabase migration new <name>                                     # Create migration
```
