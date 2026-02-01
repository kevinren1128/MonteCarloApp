# Architecture Overview

## What Was Implemented

A React-based Monte Carlo portfolio simulation tool that fetches market data, runs correlated return simulations, and provides portfolio optimization analysis.

### Entry Point Flow

```
main.jsx → AppContainer → AllProviders → AppContent → App.jsx (MonteCarloSimulator)
```

### Three-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           VERCEL                                     │
│            React App (static) - CDN edge cached                     │
│            https://monte-carlo-app-ivory.vercel.app                 │
└───────────────────┬─────────────────────────┬───────────────────────┘
                    │                         │
                    ▼                         ▼
┌───────────────────────────────┐  ┌──────────────────────────────────┐
│     CLOUDFLARE WORKER + KV    │  │           SUPABASE               │
│     (Shared Market Data)      │  │     (Auth + User Data)           │
│                               │  │                                  │
│  - Yahoo Finance proxy        │  │  - Google OAuth                  │
│  - Pre-computed metrics       │  │  - PostgreSQL with RLS           │
│  - Edge-cached responses      │  │  - Portfolio persistence         │
└───────────────────────────────┘  └──────────────────────────────────┘
```

### Key Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `App.jsx` | Main business logic (~7,700 lines) | `src/App.jsx` |
| `AllProviders` | Context provider composition | `src/contexts/AllProviders.jsx` |
| `AppContent` | Auth-aware routing | `src/components/AppContent.jsx` |
| Tab Components | Feature-specific UI | `src/components/tabs/` |
| Hooks | Reusable business logic | `src/hooks/` |
| Services | API communication | `src/services/` |
| Workers | Heavy computation | `src/workers/` |

## Key Decisions

### 1. Hybrid Backend (Cloudflare + Supabase)

**Why not just Supabase?**
- Market data is shared across all users (no RLS needed)
- Edge caching reduces Yahoo API rate limiting
- Cloudflare Workers are faster for compute-heavy operations

**Why not just Cloudflare?**
- Supabase has built-in Google OAuth
- PostgreSQL is better for relational user data
- Row Level Security for data isolation

### 2. App.jsx as Monolith (for now)

**Why one big file?**
- Started as prototype, grew organically
- State management is tightly coupled
- Refactoring would be risky mid-development

**Migration path:**
- Context infrastructure (`AllProviders`, `AppStateContext`) is in place
- Can gradually migrate state to contexts
- Tab components can use `useAppState()` hook

### 3. Web Workers for Simulation

**Why workers?**
- Monte Carlo with 10K+ paths blocks UI
- Workers run in separate threads
- Can parallelize across CPU cores

**Implementation:**
- `simulationWorker.js` — Standard MC
- `qmcSimulationWorker.js` — Quasi-Monte Carlo with Sobol sequences

### 4. Inline Styles (no CSS framework)

**Why?**
- Rapid prototyping without build config
- Component-scoped styling
- No class name conflicts

**Trade-offs:**
- Larger bundle size
- No design system consistency
- Hard to maintain themes

## What We Tried That Didn't Work

1. **Redux for state management**
   - Overkill for single-user app
   - Context + hooks is simpler

2. **Server-side rendering**
   - Not needed for dashboard app
   - Added complexity for no benefit

3. **Separate microservices**
   - Overengineered for personal use
   - Monolithic worker + Supabase is simpler

## Gotchas

1. **App.jsx state timing**
   - State updates are async
   - Pass computed values directly to avoid race conditions
   - Example: `runSimulation(finalCorrelation)` not `runSimulation()` after `setEditedCorrelation()`

2. **editedCorrelation can become corrupted**
   - After certain operations, it may become an object instead of 2D array
   - Always validate with `isValidCorrelationMatrix()` before use
   - Fall back to `correlationMatrix` if invalid

3. **Context vs App.jsx state**
   - `AppStateContext` exists but isn't fully wired
   - App.jsx still manages its own state
   - Tabs receive props from App.jsx (legacy pattern)

## Future Ideas

1. **Migrate to context-based state**
   - Move state from App.jsx to AppStateContext
   - Tabs use `useAppState()` directly
   - Cleaner prop drilling

2. **Code splitting**
   - Dynamic imports for tab components
   - Reduce initial bundle size
   - Faster first load

3. **TypeScript migration**
   - Catch type errors at compile time
   - Better IDE support
   - Self-documenting code
