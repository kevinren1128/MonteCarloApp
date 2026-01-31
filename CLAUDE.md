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

### Key Architectural Patterns

**State Management**: React Context + custom hooks (no Redux)
- Contexts in `src/contexts/` provide global state (Portfolio, MarketData, Simulation, UI)
- Custom hooks in `src/hooks/` encapsulate business logic

**Heavy Computation**: Web Workers for non-blocking Monte Carlo simulations
- `src/workers/simulationWorker.js` - Standard Monte Carlo
- `src/workers/qmcSimulationWorker.js` - Quasi-Monte Carlo with Sobol sequences

**Data Flow**: Yahoo Finance API → Services → Hooks → Context → Components

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

- Original `App.jsx` is ~7,700 lines (refactoring in progress to modular hooks/contexts)
- Inline styles used throughout (no CSS framework)
- State persists to localStorage automatically
- Math-heavy: uses Cholesky decomposition, skewed t-distributions, Sobol sequences, Ledoit-Wolf shrinkage

## Workflow Instructions

- After completing any code changes, automatically commit with a descriptive message
- Push to GitHub after commits
