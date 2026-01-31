# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build to ./dist/
npm run preview  # Preview production build
```

No test framework is configured. The project uses Vite for fast HMR during development.

## Architecture Overview

This is a React 18 Monte Carlo portfolio simulation tool (v6.3.0) that fetches market data from Yahoo Finance, runs correlated return simulations using Web Workers, and provides portfolio optimization analysis.

### Entry Point Flow

```
main.jsx -> AppContainer -> AllProviders -> AppContent -> App.jsx (MonteCarloSimulator)
```

- `AppContainer.jsx` - Root component wrapping app with context providers
- `AllProviders.jsx` - Composes all context providers
- `AppContent.jsx` - Bridge between contexts and App.jsx
- `App.jsx` - Main app with business logic (7,700 lines, manages own state)

### Key Architectural Patterns

**State Management**: React Context + custom hooks (no Redux)
- `AppStateContext` - Comprehensive context with 80+ state variables
- Contexts in `src/contexts/` provide global state infrastructure
- Custom hooks in `src/hooks/` encapsulate business logic
- **Current State**: App.jsx manages its own state and passes props to tabs. Context infrastructure is in place for gradual migration.

**Heavy Computation**: Web Workers for non-blocking Monte Carlo simulations
- `src/workers/simulationWorker.js` - Standard Monte Carlo
- `src/workers/qmcSimulationWorker.js` - Quasi-Monte Carlo with Sobol sequences

**Data Flow**: Yahoo Finance API → Services → App.jsx state → Tab components (via props)

---

## Server-Side Persistence Architecture

The app uses a hybrid architecture for persistence and caching:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           VERCEL                                     │
│            React App (static) - CDN edge cached                     │
│            https://monte-carlo-app-ivory.vercel.app                 │
└───────────────────┬─────────────────────────┬───────────────────────┘
                    │                         │
                    ▼                         ▼
┌───────────────────────────────────┐  ┌──────────────────────────────┐
│     CLOUDFLARE WORKER + KV        │  │         SUPABASE             │
│     (Shared Market Data Cache)    │  │   (Auth + User Data)         │
│                                   │  │                              │
│  monte-carlo-cache.               │  │  Google OAuth + PostgreSQL   │
│  kevinren1128.workers.dev         │  │  uoyvihrdllwslljminid        │
└───────────────────────────────────┘  └──────────────────────────────┘
```

**Why this architecture:**
- **Vercel**: Free hosting, auto-deploy from GitHub, optimized for React/Vite
- **Cloudflare Worker + KV**: Edge-cached market data shared across all users (reduces Yahoo API rate limiting)
- **Supabase**: PostgreSQL with Row Level Security, Google OAuth built-in, free tier sufficient

**Cost: $0/month** on free tiers for personal use.

### Deployment URLs

| Service | URL | Dashboard |
|---------|-----|-----------|
| **Production App** | https://monte-carlo-app-ivory.vercel.app | https://vercel.com |
| **Cloudflare Worker** | https://monte-carlo-cache.kevinren1128.workers.dev | https://dash.cloudflare.com |
| **Supabase** | https://uoyvihrdllwslljminid.supabase.co | https://supabase.com/dashboard/project/uoyvihrdllwslljminid |

---

## Authentication (Google OAuth)

Auth is handled by Supabase with Google OAuth provider.

### Flow
1. User clicks "Sign in with Google" → `signInWithGoogle()` in authService.js
2. Redirects to Google → User consents → Redirects back to app
3. Supabase exchanges code for JWT → Stored in localStorage
4. `AuthContext` provides auth state to all components
5. On login, portfolio syncs from Supabase (or pushes local if newer)

### Key Files
```
src/services/authService.js    # Supabase client, OAuth methods
src/contexts/AuthContext.jsx   # Auth state provider (isAuthenticated, user, logout)
src/components/auth/
  GoogleSignIn.jsx             # Sign-in button (compact and full variants)
  UserMenu.jsx                 # Avatar dropdown with sync status, logout
```

### Auth State Shape
```javascript
const { state, logout } = useAuth();
// state = { isAuthenticated, isAvailable, isLoading, displayInfo: { name, email, avatar } }
```

---

## Cloudflare Worker (Market Data Cache)

The Worker provides KV-cached market data, reducing Yahoo Finance API calls.

### Endpoints

**Market Data (shared cache):**
```
GET /api/prices?symbols=AAPL,MSFT&range=1y   → Historical prices (4h cache)
GET /api/quotes?symbols=AAPL,MSFT            → Current quotes (15m cache)
GET /api/profile?symbols=AAPL                → Company info (7d cache)
GET /api/consensus?symbols=AAPL              → FMP analyst data (4h cache)
GET /api/fx?pairs=EURUSD,GBPUSD              → Exchange rates (24h cache)
```

**Derived Metrics (pre-computed, shared cache):**
```
GET /api/beta?symbols=AAPL&benchmark=SPY&range=1y   → Beta vs benchmark (6h cache)
GET /api/volatility?symbols=AAPL&range=1y           → Annualized vol + returns (6h cache)
GET /api/distribution?symbols=AAPL&range=5y&bootstrap=1000  → P5/P25/P50/P75/P95 (12h cache)
GET /api/calendar-returns?symbols=AAPL&range=10y    → Calendar year returns (24h cache)
```

### Cache TTLs (KV Namespace: MONTE_CARLO_CACHE)
| Data Type | TTL | Key Pattern |
|-----------|-----|-------------|
| Historical prices | 4 hours | `prices:v1:{symbol}:{range}:{interval}` |
| Quotes | 15 minutes | `quotes:v1:{symbol}` |
| Company profile | 7 days | `profile:v1:{symbol}` |
| FX rates | 24 hours | `fx:v1:{base}:{quote}` |
| Beta | 6 hours | `beta:v1:{symbol}:{benchmark}:{range}:{interval}` |
| Volatility | 6 hours | `vol:v1:{symbol}:{range}:{interval}` |
| Distribution | 12 hours | `dist:v1:{symbol}:{range}:{interval}:b{count}` |
| Calendar returns | 24 hours | `calret:v1:{symbol}:{range}:{interval}` |

### Fallback Pattern
Frontend tries Worker first, falls back to CORS proxy if Worker fails:
```javascript
// In yahooFinance.js
const data = await fetchFromWorker('/api/prices', { symbols, range });
if (!data) {
  // Fallback to direct Yahoo via CORS proxy
  data = await fetchYahooDirect(symbol, range);
}
```

### Deployment
```bash
npx wrangler deploy              # Deploy worker
npx wrangler kv key list CACHE   # List cached keys
```

**Config:** `wrangler.toml` (KV namespace ID: 69f4d706eb4943e7af055d297cca3c78)

---

## Supabase Database Schema

### Tables

**Core Tables:**
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `portfolios` | Portfolio metadata | user_id, name, cash_balance, revision |
| `positions` | Stock positions | portfolio_id, symbol, shares, avg_cost, p5/p25/p50/p75/p95, price |
| `portfolio_settings` | UI preferences | portfolio_id, settings (JSONB) |

**Analysis Results:**
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `correlation_overrides` | Edited correlation matrix | portfolio_id, correlation_matrix (JSONB), tickers[] |
| `simulation_results` | Monte Carlo outputs | portfolio_id, num_paths, percentiles, var_95, cvar_95 |
| `factor_results` | Factor analysis | portfolio_id, factor_exposures, r_squared |
| `optimization_results` | Portfolio optimization | portfolio_id, optimal_weights, efficient_frontier |
| `reports` | Generated report history | portfolio_id, title, generated_at |

**Position Enrichment (Added Jan 2026):**
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `position_notes` | Investment thesis & tags | position_id, notes, thesis, tags[] |
| `target_allocations` | Rebalancing targets | portfolio_id, symbol, target_weight, min_weight, max_weight |
| `dividend_history` | Dividend tracking | portfolio_id, symbol, ex_date, amount, shares_held, reinvested |

**Cache:**
| Table | Purpose | Key Fields |
|-------|---------|------------|
| `market_data_cache` | Per-user price cache (optional) | user_id, symbol, data (JSONB) |

### Row Level Security (RLS)
All tables have RLS enabled. Users can only access their own data:
```sql
CREATE POLICY "Users can CRUD own portfolios"
  ON portfolios FOR ALL
  USING (auth.uid() = user_id);
```

### Supabase CLI Commands
```bash
npx supabase db dump --schema public -f supabase/current_schema.sql  # Export schema
npx supabase db push                                                  # Push migrations
npx supabase migration new <name>                                     # Create migration
```

**Full schema:** `supabase/current_schema.sql`

---

## Services Layer

### authService.js
```javascript
signInWithGoogle()           // Initiate OAuth flow
signOut()                    // Logout, clear session
getSession()                 // Get current JWT session
onAuthStateChange(callback)  // Subscribe to auth changes
supabase                     // Supabase client (exported for direct queries)
```

### portfolioService.js
```javascript
// Core CRUD
getOrCreatePortfolio()       // Get user's portfolio (creates if none)
savePositions(positions, cash)  // Upsert positions with distribution params
loadFullPortfolio()          // Load everything for a user

// Analysis results
saveCorrelationOverrides(matrix, tickers, method)
saveSimulationResults(results)
saveFactorResults(results)
saveOptimizationResults(results)
saveSettings(settings)

// Position notes (investment thesis)
savePositionNotes(positionId, notes, tags, thesis)
getPositionNotes(positionId)
getAllPositionNotes(portfolioId)
deletePositionNotes(positionId)

// Target allocations (rebalancing)
saveTargetAllocation(portfolioId, symbol, targetWeight, minWeight, maxWeight)
saveTargetAllocations(portfolioId, allocations)  // Batch save
getTargetAllocations(portfolioId)
deleteTargetAllocation(portfolioId, symbol)

// Dividend tracking
addDividend(portfolioId, symbol, exDate, amount, sharesHeld, reinvested)
getDividends(portfolioId, symbol)  // Optional symbol filter
getDividendSummary(portfolioId)    // Aggregated by symbol
deleteDividend(dividendId)
```

### yahooFinance.js
```javascript
fetchYahooHistory(symbol, range)  // Historical prices (Worker → CORS fallback)
fetchYahooQuote(symbol)           // Current quote
fetchYahooProfile(symbol)         // Company sector/industry
fetchExchangeRate(from, to)       // FX rates
fetchYahooData(symbol)            // Combined quote + history + profile
```

### marketService.js
```javascript
// Market data (shared cache)
fetchPrices(symbols, range)    // Batch price fetch via Worker
fetchQuotes(symbols)           // Batch quotes via Worker
fetchProfiles(symbols)         // Batch profiles via Worker
fetchExchangeRates(pairs)      // Batch FX via Worker
isWorkerAvailable()            // Check if Worker is configured

// Derived metrics (pre-computed by Worker)
fetchBetas(symbols, benchmark, range)      // Beta vs benchmark
fetchVolatility(symbols, range)            // Annualized vol + returns
fetchDistributions(symbols, range, bootstrap)  // Bootstrap p5-p95
fetchCalendarReturns(symbols, range)       // Calendar year returns
fetchAllDerivedMetrics(symbols)            // Fetch all in parallel
```

---

## Data Sync Flow

### On Login
1. `usePortfolioSync` hook detects auth state change
2. Calls `loadFromServer()` → fetches portfolio from Supabase
3. Compares revision numbers: server wins if higher, else push local
4. Updates local state with merged data

### On Change (Debounced 2s)
1. User edits position/distribution/correlation
2. `usePortfolioSync` debounces changes
3. After 2s idle, calls appropriate save function
4. Sync indicator shows: blue spinner → green checkmark

### Sync State
```javascript
const { syncState } = usePortfolioSync();
// syncState = { status: 'idle'|'syncing'|'synced'|'error'|'offline', lastSynced, hasUnsyncedChanges }
```

---

## Environment Variables

### Local Development (.env)
```bash
VITE_SUPABASE_URL=https://uoyvihrdllwslljminid.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_WORKER_URL=https://monte-carlo-cache.kevinren1128.workers.dev
VITE_FMP_API_KEY=<optional>
SUPABASE_ACCESS_TOKEN=sbp_...  # For CLI only, not VITE_
```

### Vercel Dashboard
Same VITE_* variables configured in Vercel project settings.

---

## Important Design Decisions

1. **Delete + Insert for Positions**: Instead of upserting, we delete all positions then insert fresh. Avoids unique constraint issues with duplicate tickers (user can have same ticker multiple times for different lots).

2. **Debounced Auto-Save (2s)**: Prevents excessive API calls while user is actively editing. Shows sync status on avatar.

3. **Worker-First with Fallback**: Always try Cloudflare Worker first for market data. If it fails (timeout, error, not configured), fall back to CORS proxy. Provides resilience.

4. **Revision-Based Conflict Resolution**: Each portfolio has a `revision` counter. On sync, higher revision wins. Prevents lost updates.

5. **Dropdown Position Fix**: UserMenu dropdown opens upward (`bottom: 100%`) because avatar is in bottom-left sidebar.

6. **Minimal Sync Indicators**: Only show badge for active states (syncing spinner, synced checkmark). Don't show alarming error icons - details available in dropdown.

7. **Worker Pre-Computation**: Expensive computations (beta, volatility, distribution bootstrap) are done on Cloudflare Worker and cached. Frontend uses these if available, falls back to local computation.

8. **Draggable Sidebar**: Sidebar width is adjustable by dragging the right edge. Width persists to localStorage. Drag below 100px threshold to auto-collapse.

9. **Sign-Out Reset**: When user signs out, app resets to clean default state (not the server-side data from previous user).

### Quick Navigation

| Task | Location |
|------|----------|
| Add/modify positions | `src/hooks/usePortfolio.js` |
| Data fetching logic | `src/services/yahooFinance.js` |
| Correlation calculations | `src/utils/correlation.js` |
| Monte Carlo simulation | `src/workers/qmcSimulationWorker.js` |
| Statistical functions | `src/utils/statistics.js` |
| Factor definitions | `src/constants/factors.js` |
| Thematic ETF mappings | `src/constants/thematic.js` |
| LocalStorage keys | `src/constants/storage.js` |

### Source of Truth

Read `docs/ARCHITECTURE.md` first for comprehensive system documentation, algorithms, and design decisions.

## Codebase Notes

- `App.jsx` is ~7,700 lines containing all business logic and UI rendering
- Context infrastructure is complete (`AllProviders`, `AppStateContext`) but App.jsx still manages its own state
- Tabs receive props from App.jsx (legacy pattern); can be migrated to use `useAppState()` hook
- Inline styles used throughout (no CSS framework)
- State persists to localStorage automatically
- Math-heavy: uses Cholesky decomposition, skewed t-distributions, Sobol sequences, Ledoit-Wolf shrinkage

## Workflow Instructions

- After completing any code changes, automatically commit with a descriptive message
- Push to GitHub after commits
- Use claude-mem:make-plan for multi-step implementation tasks
- Use claude-mem:do to execute implementation plans

### Consult Codex for Second Opinions

**Always ask Codex MCP server for review/alternatives when:**
- Preparing implementation plans for complex features
- Debugging tricky bugs (before implementing a fix)
- Proposing refactoring strategies
- Validating architectural decisions
- Uncertain about the best approach

This provides a second perspective and catches potential issues early.

### FMP API Documentation

The Consensus Tab uses Financial Modeling Prep (FMP) API. Documentation is at:
**https://site.financialmodelingprep.com/developer/docs**

Key endpoints used:
- `/stable/enterprise-values` - Market cap, EV, debt, cash
- `/stable/key-metrics` - Financial ratios and metrics
- `/stable/analyst-estimates` - Revenue, EPS, EBITDA estimates
- `/stable/earnings` - Historical and upcoming earnings
