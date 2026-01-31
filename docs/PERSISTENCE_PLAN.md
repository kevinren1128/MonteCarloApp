# Server-Side Persistence Implementation Plan

## Overview

Hybrid architecture for persisting user data and caching market data:
- **Supabase**: Auth (Google OAuth) + User data (PostgreSQL)
- **Cloudflare Worker + KV**: Shared market data cache
- **localStorage**: Fast local cache, syncs with Supabase

```
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE (Per-User Private)                 │
├─────────────────────────────────────────────────────────────────┤
│ portfolios           │ name, cash, revision                     │
│ positions            │ symbol, shares, cost, p5/p25/p50/p75/p95 │
│ correlation_overrides│ edited correlation matrix                │
│ simulation_results   │ Monte Carlo outputs, percentiles         │
│ factor_results       │ factor exposures, betas, R²              │
│ optimization_results │ optimal weights, efficient frontier      │
│ reports              │ PDF report history/metadata              │
│ portfolio_settings   │ UI preferences, defaults                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                 CLOUDFLARE KV (Shared Cache)                    │
├─────────────────────────────────────────────────────────────────┤
│ prices:AAPL:1y       │ Historical price data (shared)          │
│ profile:AAPL         │ Company sector/industry                  │
│ consensus:AAPL       │ FMP analyst estimates                    │
│ fx:EURUSD            │ Exchange rates                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    localStorage (Fast Cache)                    │
├─────────────────────────────────────────────────────────────────┤
│ Same as Supabase     │ Offline support + instant load          │
│ Syncs bidirectionally with Supabase when online                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Progress Tracker

### ✅ Phase 1: Supabase Auth (COMPLETE)
- [x] Create Supabase project
- [x] Create `src/services/authService.js` - Supabase client with Google OAuth
- [x] Create `src/contexts/AuthContext.jsx` - Auth state provider
- [x] Create `src/components/auth/GoogleSignIn.jsx` - Sign in button
- [x] Create `src/components/auth/UserMenu.jsx` - User dropdown
- [x] Wire up AuthProvider in AllProviders.jsx
- [x] Add UserMenu to Sidebar
- [x] Configure Google OAuth in Google Cloud Console
- [x] Configure Google provider in Supabase dashboard
- [x] Test login flow ✓

**Supabase Credentials (in .env):**
```
VITE_SUPABASE_URL=https://uoyvihrdllwslljminid.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ERomnJZe6GkrmOYlmy0sRw_4xrC_E9u
```

### ✅ Phase 2: Database Schema (COMPLETE)
- [x] Create `supabase/schema.sql` - Initial tables (portfolios, positions, settings)
- [x] Run schema.sql in Supabase SQL Editor
- [x] Create `supabase/schema_v2.sql` - Extended tables
- [x] Run schema_v2.sql in Supabase SQL Editor

**Tables Created:**
1. `portfolios` - Portfolio metadata
2. `positions` - Stock positions with distribution params (p5-p95)
3. `portfolio_settings` - User preferences (JSONB)
4. `correlation_overrides` - Edited correlation matrix
5. `simulation_results` - Monte Carlo outputs
6. `factor_results` - Factor analysis results
7. `optimization_results` - Portfolio optimization results
8. `reports` - Generated report history
9. `market_data_cache` - Optional per-user price cache

### ✅ Phase 3: Portfolio Service (COMPLETE)
- [x] Create `src/services/portfolioService.js` - CRUD operations
- [x] Create `src/hooks/usePortfolioSync.js` - Sync hook
- [x] **Wire up usePortfolioSync to App.jsx state**
- [x] Save positions with distribution params (on change, debounced)
- [x] Save correlation overrides (on change)
- [x] Save simulation results (after simulation runs)
- [x] Save factor results (after factor analysis)
- [x] Save optimization results (after optimization)

### ✅ Phase 4: Cloudflare Worker (COMPLETE)
- [x] Create Cloudflare account
- [x] Create KV namespace (`MONTE_CARLO_CACHE` - ID: 69f4d706eb4943e7af055d297cca3c78)
- [x] Deploy `worker/index.js`
- [x] Update wrangler.toml with namespace ID
- [x] Add VITE_WORKER_URL to .env
- [x] Frontend already configured to use Worker endpoints (marketService.js)

**Worker URL:** https://monte-carlo-cache.kevinren1128.workers.dev

**Worker Endpoints (already coded in worker/index.js):**
```
GET /api/prices?symbols=AAPL,MSFT&range=1y
GET /api/quotes?symbols=AAPL,MSFT
GET /api/profile?symbols=AAPL
GET /api/consensus?symbols=AAPL
GET /api/fx?pairs=EURUSD,GBPUSD
```

### ✅ Phase 5: Frontend Data Sync (COMPLETE)
- [x] Update portfolioService.js to save all data types
- [x] Modify App.jsx to call sync on:
  - Position changes (debounced 2s)
  - Distribution param changes (with positions)
  - Correlation matrix edits
  - After simulation runs
  - After factor analysis
  - After optimization
- [x] Add sync status indicator (in UserMenu)
- [x] Handle offline mode gracefully
- [ ] Test cross-device sync (manual test needed)

### 🔲 Phase 6: Vercel Deployment (NOT STARTED)
- [ ] Connect GitHub repo to Vercel
- [ ] Add environment variables to Vercel dashboard
- [ ] Update Google OAuth redirect URLs for production domain
- [ ] Update Supabase redirect URLs
- [ ] Test production deployment

---

## Files Created

```
src/
  services/
    authService.js       ✅ Supabase auth client
    portfolioService.js  ✅ CRUD for portfolios (needs extension)
    marketService.js     ✅ Worker API client with fallback
  contexts/
    AuthContext.jsx      ✅ Auth state provider
  hooks/
    usePortfolioSync.js  ✅ Sync hook (needs wiring)
  components/
    auth/
      GoogleSignIn.jsx   ✅ Sign in button
      UserMenu.jsx       ✅ User dropdown
      index.js           ✅ Exports

supabase/
  schema.sql             ✅ Initial tables
  schema_v2.sql          ✅ Extended tables

worker/
  index.js               ✅ Cloudflare Worker with KV caching

wrangler.toml            ✅ Cloudflare config (needs namespace ID)
.env.example             ✅ Environment template
.env                     ✅ Local environment (git-ignored)
```

---

## Next Steps (in order)

1. ~~**Wire up data sync**~~ ✅ COMPLETE - Data syncs automatically on login and on change
2. **Set up Cloudflare Worker** - Deploy for shared market data cache
3. ~~**Extend portfolioService**~~ ✅ COMPLETE - All data types now supported
4. **Deploy to Vercel** - Production deployment with real URLs
5. **Test cross-device sync** - Verify data loads correctly on different devices

---

## Quick Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Deploy Cloudflare Worker (after setup)
npx wrangler deploy

# Supabase CLI (future migrations)
supabase link --project-ref uoyvihrdllwslljminid
supabase db push
```

---

## Credentials & URLs

| Service | Dashboard |
|---------|-----------|
| Supabase | https://supabase.com/dashboard/project/uoyvihrdllwslljminid |
| Google Cloud | https://console.cloud.google.com/ |
| Cloudflare | https://dash.cloudflare.com/ (not set up yet) |
| Vercel | (not connected yet) |

---

*Last updated: January 2026*
