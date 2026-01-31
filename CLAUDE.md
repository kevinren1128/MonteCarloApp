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
