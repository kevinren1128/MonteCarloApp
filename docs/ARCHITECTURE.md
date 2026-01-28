# Monte Carlo Portfolio Simulator — Architecture Guide

> **🎯 START HERE: This document is the SOURCE OF TRUTH for the codebase.**
>
> Engineers (human or AI/LLM) should read this document FIRST before making any changes.
> It provides navigation, explains design decisions, and documents the data flow.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Project Overview](#project-overview)
3. [Directory Structure](#directory-structure)
4. [Architecture Diagram](#architecture-diagram)
5. [Core Concepts](#core-concepts)
6. [Data Flow](#data-flow)
7. [Module Reference](#module-reference)
8. [Component Hierarchy](#component-hierarchy)
9. [State Management](#state-management)
10. [Key Algorithms](#key-algorithms)
11. [Adding Features](#adding-features)
12. [Troubleshooting](#troubleshooting)
13. [Glossary](#glossary)

---

## Quick Reference

### 🔍 "I want to..."

| Task | Location | Notes |
|------|----------|-------|
| **Add a new ticker** | `src/hooks/usePortfolio.js` | `addPosition()` function |
| **Modify data fetching** | `src/services/yahooFinance.js` | CORS proxy logic here |
| **Change correlation calc** | `src/utils/correlation.js` | EWMA, shrinkage methods |
| **Add simulation logic** | `src/workers/qmcSimulationWorker.js` | Web Worker for Monte Carlo |
| **Add a factor** | `src/constants/factors.js` | Factor definitions |
| **Add thematic ETF** | `src/constants/thematic.js` | Sector/thematic mappings |
| **Modify UI components** | `src/components/` | React components |
| **Change storage format** | `src/constants/storage.js` | Bump version key |
| **Debug data issues** | `src/hooks/useMarketData.js` | Unified data layer |

### 📁 Key Files

```
src/
├── App.jsx                    # Main component (being refactored into hooks/components)
├── hooks/
│   ├── usePortfolio.js        # Portfolio state management
│   ├── useMarketData.js       # Data fetching & caching
│   ├── useCorrelation.js      # Correlation matrix
│   ├── useSimulation.js       # Monte Carlo simulation
│   ├── useFactorAnalysis.js   # Factor decomposition
│   └── useOptimization.js     # Portfolio optimization
├── services/
│   └── yahooFinance.js        # Yahoo Finance API client
├── utils/
│   ├── statistics.js          # Statistical functions
│   ├── correlation.js         # Correlation utilities
│   ├── distribution.js        # Distribution sampling
│   ├── matrix.js              # Matrix operations
│   └── quasiMonteCarlo.js     # Sobol sequences
├── constants/
│   ├── factors.js             # Factor ETF definitions
│   ├── thematic.js            # Sector/thematic mappings
│   ├── storage.js             # localStorage config
│   └── defaults.js            # Default values
└── workers/
    ├── simulationWorker.js    # Standard Monte Carlo
    └── qmcSimulationWorker.js # Quasi-Monte Carlo
```

---

## Project Overview

### What This App Does

A **Monte Carlo portfolio simulation tool** that:

1. **Fetches real market data** from Yahoo Finance (with CORS proxy handling)
2. **Computes correlation matrices** using multiple methods (sample, EWMA, Ledoit-Wolf shrinkage)
3. **Runs Monte Carlo simulations** (10,000+ paths) to estimate portfolio risk/return
4. **Performs factor analysis** (Fama-French style betas + thematic detection)
5. **Optimizes portfolios** (mean-variance, risk parity, etc.)

### Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **UI Framework** | React 18 | Functional components + hooks |
| **Build Tool** | Vite | Fast HMR, ESM native |
| **Styling** | Inline styles | No CSS framework (keeps bundle small) |
| **Charts** | Recharts | React charting library |
| **State** | React hooks + Context | No Redux needed |
| **Persistence** | localStorage | Portfolio survives refresh |
| **Heavy Compute** | Web Workers | Non-blocking simulations |

---

## Directory Structure

```
monte-carlo-app/
│
├── docs/                          # 📚 Documentation
│   ├── ARCHITECTURE.md            # THIS FILE - Start here!
│   ├── DATA_FLOW.md               # Detailed data flow diagrams
│   └── OPTIMIZATION_TAB_DESIGN.md # Optimization feature spec
│
├── src/
│   ├── main.jsx                   # App entry point
│   ├── App.jsx                    # Root component (being modularized)
│   │
│   ├── components/                # 🧩 React Components
│   │   ├── common/                # Shared UI components
│   │   │   ├── BlurInput.jsx      # Input that commits on blur
│   │   │   ├── PercentileInput.jsx
│   │   │   ├── PercentileSlider.jsx
│   │   │   ├── PercentileEditor.jsx
│   │   │   ├── LoadingProgress.jsx
│   │   │   └── index.js           # Barrel export
│   │   ├── positions/             # Positions tab
│   │   ├── correlation/           # Correlation tab
│   │   ├── factors/               # Factor Analysis tab
│   │   ├── simulation/            # Simulation tab
│   │   ├── optimization/          # Optimization tab
│   │   └── layout/                # Header, TabBar, etc.
│   │
│   ├── hooks/                     # 🎣 Custom React Hooks
│   │   ├── usePortfolio.js        # Portfolio state & operations
│   │   ├── useMarketData.js       # Unified data fetching
│   │   ├── useCorrelation.js      # Correlation computation
│   │   ├── useSimulation.js       # Monte Carlo runner
│   │   ├── useFactorAnalysis.js   # Factor decomposition
│   │   ├── useOptimization.js     # Portfolio optimization
│   │   ├── useLocalStorage.js     # Persistence helper
│   │   └── index.js
│   │
│   ├── services/                  # 🌐 External API Clients
│   │   ├── yahooFinance.js        # Yahoo Finance API
│   │   └── index.js
│   │
│   ├── utils/                     # 🔧 Pure Utility Functions
│   │   ├── statistics.js          # Statistical calculations
│   │   ├── correlation.js         # Correlation functions
│   │   ├── distribution.js        # Distribution sampling
│   │   ├── matrix.js              # Matrix operations
│   │   ├── formatting.js          # Number/date formatting
│   │   ├── quasiMonteCarlo.js     # Sobol sequences
│   │   └── index.js
│   │
│   ├── constants/                 # 📋 Configuration
│   │   ├── factors.js             # Factor ETF definitions
│   │   ├── thematic.js            # Sector/thematic ETFs
│   │   ├── storage.js             # localStorage keys
│   │   ├── defaults.js            # Default values
│   │   └── index.js
│   │
│   ├── contexts/                  # 🔄 React Context Providers
│   │   └── (future use)
│   │
│   └── workers/                   # ⚡ Web Workers
│       ├── simulationWorker.js    # Standard Monte Carlo
│       └── qmcSimulationWorker.js # Quasi-Monte Carlo
│
├── public/                        # Static assets
├── package.json
├── vite.config.js
├── CHANGELOG.md                   # Version history
├── CONTRIBUTING.md                # Contribution guidelines
└── README.md                      # Project overview
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INTERFACE                                 │
│  ┌───────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Positions │ │ Correlation│ │ Factors  │ │Simulation│ │Optimization│ │
│  │    Tab    │ │    Tab     │ │   Tab    │ │   Tab    │ │    Tab     │ │
│  └─────┬─────┘ └─────┬──────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
└────────┼─────────────┼─────────────┼────────────┼─────────────┼────────┘
         │             │             │            │             │
         └──────────────────────┬────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CUSTOM HOOKS (State Layer)                       │
│                                                                          │
│  usePortfolio    useMarketData    useCorrelation    useSimulation       │
│  ─────────────   ─────────────    ──────────────    ──────────────      │
│  • positions     • fetchData()    • matrix          • runSimulation()   │
│  • addPosition   • cache mgmt     • EWMA/shrinkage  • progress          │
│  • updatePos     • progress       • PSD fix         • results           │
│                                                                          │
│  useFactorAnalysis              useOptimization                         │
│  ─────────────────              ───────────────                         │
│  • factor betas                 • optimize()                            │
│  • thematic detection           • risk parity                           │
│  • R² calculation               • mean-variance                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         │                           │                           │
         ▼                           ▼                           ▼
┌─────────────────┐      ┌─────────────────────┐      ┌─────────────────┐
│    SERVICES     │      │       UTILS         │      │    WORKERS      │
│                 │      │                     │      │                 │
│ yahooFinance.js │      │ statistics.js       │      │ simulationWkr   │
│ • fetchQuote    │      │ correlation.js      │      │ qmcSimWkr       │
│ • fetchHistory  │      │ distribution.js     │      │                 │
│ • fetchProfile  │      │ matrix.js           │      │ (run 10K+ paths │
│ • CORS proxies  │      │ quasiMonteCarlo.js  │      │  off main thread)│
└─────────────────┘      └─────────────────────┘      └─────────────────┘
         │                                                     │
         ▼                                                     │
┌─────────────────┐                                           │
│  Yahoo Finance  │◄──────────────────────────────────────────┘
│  (External API) │    Fetches real market data
└─────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                          PERSISTENCE (localStorage)                      │
│                                                                          │
│  STORAGE_KEYS.PORTFOLIO          STORAGE_KEYS.MARKET_DATA              │
│  • positions                     • unified ticker data                  │
│  • correlationMatrix             • factor ETF returns                   │
│  • simulationResults             • 4-hour cache TTL                     │
│  • settings                                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Position

A position represents a stock/ETF holding in the portfolio:

```javascript
{
  id: 'pos_1704067200000',     // Unique ID (timestamp-based)
  ticker: 'AAPL',              // Stock symbol
  shares: 100,                 // Number of shares (can be negative for shorts)
  price: 178.50,               // Current price per share
  currency: 'USD',             // Currency
  distribution: {              // Return distribution parameters
    mu: 0.12,                  // Expected annual return (12%)
    sigma: 0.28,               // Annual volatility (28%)
    skew: -0.2,                // Negative skew (fatter left tail)
    tailDf: 8                  // Student-t df (lower = fatter tails)
  }
}
```

### 2. Unified Market Data

All market data flows through a single unified layer. This ensures consistency:

```javascript
{
  'AAPL': {
    ticker: 'AAPL',
    currentPrice: 178.50,
    dailyReturns: [0.012, -0.008, ...],  // Array of daily log returns
    timestamps: [1704067200000, ...],     // Corresponding timestamps (ms)
    oneYearReturn: 0.48,                  // 1Y total return
    ytdReturn: 0.15,                      // YTD return
    volatility: 0.28,                     // Annualized volatility
    beta: 1.15,                           // Beta vs SPY
    correlation: 0.82,                    // Correlation with SPY
    sector: 'Technology',
    industry: 'Consumer Electronics',
    name: 'Apple Inc.',
    sparkline: [175, 176, 178, ...]       // Recent prices for mini chart
  },
  'SPY': { ... },
  // Factor spreads computed as synthetic "tickers"
  'SMB': {
    returns: [...],                        // IWM - SPY daily
    timestamps: [...],
    name: 'Size Factor (Small minus Big)'
  },
  ...
}
```

### 3. Correlation Matrix

An NxN matrix where `corr[i][j]` is the correlation between positions i and j:

```javascript
// For 3 positions: AAPL, MSFT, GLD
[
  [1.00,  0.85,  0.05],  // AAPL
  [0.85,  1.00,  0.08],  // MSFT
  [0.05,  0.08,  1.00]   // GLD
]
```

**Requirements:**
- Diagonal must be 1.0 (asset correlates perfectly with itself)
- Symmetric: `corr[i][j] === corr[j][i]`
- Must be **Positive Semi-Definite (PSD)** for valid Cholesky decomposition

### 4. Factor Analysis

Decomposes returns into systematic factor exposures (Fama-French style):

```javascript
{
  ticker: 'NVDA',
  factors: {
    MKT: { beta: 1.8, tStat: 12.5 },   // Market beta
    SMB: { beta: 0.2, tStat: 1.8 },    // Size: slightly small-cap tilt
    HML: { beta: -0.5, tStat: -4.2 },  // Value: growth stock (negative)
    MOM: { beta: 0.3, tStat: 2.1 }     // Momentum: positive momentum
  },
  rSquared: 0.72,                       // 72% variance explained
  alpha: 0.15,                          // 15% annualized alpha
  residualVol: 0.35,                    // Idiosyncratic volatility
  thematicMatch: {
    etf: 'SOXX',
    name: 'Semiconductors',
    correlation: 0.92,
    rSquared: 0.85
  }
}
```

---

## Data Flow

### Loading Market Data

```
User clicks "Load All Data"
           │
           ▼
┌──────────────────────────────┐
│   Check localStorage cache    │
│   (4-hour TTL)               │
└──────────────┬───────────────┘
               │
    ┌──────────┴──────────┐
    │ Fresh?              │ Stale/Missing?
    ▼                     ▼
Return cached      ┌──────────────────────┐
data               │ Build ticker list:   │
                   │ • Portfolio tickers  │
                   │ • Factor ETFs        │
                   │ • Thematic ETFs      │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Fetch in parallel:   │
                   │ (5 concurrent)       │
                   │ • Quote (price)      │
                   │ • History (1Y daily) │
                   │ • Profile (sector)   │
                   └──────────┬───────────┘
                              │
                   ┌──────────┴───────────┐
                   │ For each ticker:     │
                   │ Try CORS proxies:    │
                   │ 1. allorigins.win    │
                   │ 2. corsproxy.io      │
                   │ 3. Direct (fallback) │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Process raw data:    │
                   │ • Compute returns    │
                   │ • Compute beta       │
                   │ • Compute volatility │
                   │ • Infer sector       │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Compute factor       │
                   │ spreads:             │
                   │ SMB = IWM - SPY      │
                   │ HML = IWD - IWF      │
                   │ MOM = MTUM - SPY     │
                   └──────────┬───────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │ Store to cache       │
                   │ (slim format)        │
                   │ Update React state   │
                   └──────────────────────┘
```

### Running Simulation

```
User clicks "Run Simulation"
           │
           ▼
┌──────────────────────────────┐
│ Prepare simulation inputs:   │
│ • Position weights           │
│ • Distribution params        │
│ • Correlation matrix         │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Validate correlation matrix  │
│ (must be PSD for Cholesky)   │
│ Apply fix if needed          │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Post to Web Worker           │
│ (non-blocking)               │
└──────────────┬───────────────┘
               │
               ▼ (in Worker)
┌──────────────────────────────┐
│ For each of 10,000 paths:    │
│ 1. Generate correlated       │
│    random numbers (Cholesky) │
│ 2. Apply fat-tail transform  │
│    (Student-t)               │
│ 3. Apply skew transform      │
│ 4. Compute portfolio return  │
│ 5. Report progress           │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Aggregate results:           │
│ • Percentiles (5,25,50,75,95)│
│ • VaR (95%, 99%)             │
│ • Expected return            │
│ • Volatility                 │
│ • Sharpe ratio               │
│ • Contribution by position   │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ Post results back to main    │
│ Update React state           │
│ Save to localStorage         │
└──────────────────────────────┘
```

---

## Module Reference

### Hooks (`src/hooks/`)

#### `usePortfolio`
Manages portfolio state: positions, cash balance, CRUD operations.

```javascript
const {
  positions,          // Position[]
  addPosition,        // (ticker: string) => void
  updatePosition,     // (id: string, updates: Partial<Position>) => void
  removePosition,     // (id: string) => void
  cashBalance,        // number
  setCashBalance,     // (amount: number) => void
  totalValue,         // number (computed)
  weights,            // number[] (computed)
} = usePortfolio();
```

#### `useMarketData`
Unified data fetching with caching.

```javascript
const {
  marketData,         // { [ticker]: MarketData }
  factorData,         // { SMB, HML, MOM, ... }
  isLoading,          // boolean
  progress,           // { current, total, message }
  loadAllData,        // () => Promise<void>
  refreshTicker,      // (ticker: string) => Promise<void>
} = useMarketData(positions);
```

#### `useCorrelation`
Correlation matrix computation and editing.

```javascript
const {
  correlationMatrix,  // number[][] (computed, read-only)
  editedCorrelation,  // number[][] (user-editable)
  updateCell,         // (i: number, j: number, value: number) => void
  computeCorrelation, // () => Promise<void>
  makeValidPSD,       // () => void
  method,             // 'sample' | 'ewma' | 'shrinkage'
  setMethod,          // (method: string) => void
} = useCorrelation(marketData, positions);
```

#### `useSimulation`
Monte Carlo simulation runner.

```javascript
const {
  results,            // SimulationResults | null
  isRunning,          // boolean
  progress,           // { completed, total }
  runSimulation,      // () => Promise<void>
  cancelSimulation,   // () => void
} = useSimulation(positions, correlationMatrix, settings);
```

### Services (`src/services/`)

#### `yahooFinance.js`

```javascript
// Fetch current quote
const quote = await fetchYahooQuote('AAPL');
// => { price: 178.50, name: 'Apple Inc.', type: 'Equity', currency: 'USD' }

// Fetch price history
const history = await fetchYahooHistory('AAPL', '1y', '1d');
// => [{ date: Date, close: 175.0 }, ...]

// Fetch company profile
const profile = await fetchYahooProfile('AAPL');
// => { sector: 'Technology', industry: 'Consumer Electronics', ... }

// Fetch exchange rate
const rate = await fetchExchangeRate('EUR', 'USD');
// => 1.08
```

### Utils (`src/utils/`)

#### `correlation.js`
```javascript
computeCorrelation(x, y)           // Pearson correlation
computeEWMACorrelation(x, y, λ)    // EWMA-weighted correlation
computeCorrelationMatrix(returns)  // Full matrix from returns
ledoitWolfShrinkage(sample)        // Shrinkage estimator
alignReturnsByDate(r1, t1, r2, t2) // Date alignment for intl stocks
computeRegression(y, x)            // OLS regression (beta, R², alpha)
```

#### `matrix.js`
```javascript
choleskyDecomposition(matrix)      // L * L^T decomposition
makeValidCorrelation(matrix)       // Fix non-PSD matrix
correlationToCovariance(corr, vol) // Convert correlation → covariance
matrixMultiply(A, B)               // Matrix multiplication
```

#### `distribution.js`
```javascript
normalCDF(x)                       // Normal cumulative distribution
normalInvCDF(p)                    // Normal inverse CDF (quantile)
studentTInvCDF(p, df)              // Student-t inverse CDF
generateSkewedT(mu, sigma, skew, df) // Sample skewed Student-t
bootstrapAnnualReturns(daily)      // Bootstrap annual from daily
```

### Constants (`src/constants/`)

#### `factors.js`
```javascript
STANDARD_FACTOR_ETFS = {
  MKT: { ticker: 'SPY', name: 'Market' }
}

FACTOR_SPREAD_DEFINITIONS = {
  SMB: { long: 'IWM', short: 'SPY', name: 'Size' },
  HML: { long: 'IWD', short: 'IWF', name: 'Value' },
  MOM: { long: 'MTUM', short: 'SPY', name: 'Momentum' },
  ...
}
```

#### `thematic.js`
```javascript
THEMATIC_ETFS = {
  // Sectors
  XLK: { name: 'Technology', category: 'sector' },
  XLF: { name: 'Financials', category: 'sector' },
  ...
  // Thematic
  SOXX: { name: 'Semiconductors', category: 'thematic' },
  ...
}

KNOWN_SECTOR_OVERRIDES = {
  NVDA: { sector: 'Semiconductors', industry: 'Semiconductors' },
  ...
}
```

---

## Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── LoadAllDataButton
│   ├── LoadingProgress
│   └── SettingsDropdown
│
├── TabBar
│   └── TabButton × 5
│
├── TabContent (conditional)
│   │
│   ├── [positions] PositionsTab
│   │   ├── AddPositionForm
│   │   ├── PositionsTable
│   │   │   └── PositionRow × N
│   │   └── DistributionGrid
│   │       └── DistributionEditor × N
│   │
│   ├── [correlation] CorrelationTab
│   │   ├── CorrelationSettings
│   │   ├── CorrelationMatrix
│   │   │   └── CorrelationCell × N²
│   │   └── CorrelationTimeline
│   │
│   ├── [factors] FactorAnalysisTab
│   │   ├── FactorTable
│   │   ├── ThematicGroups
│   │   └── FactorExposureChart
│   │
│   ├── [simulation] SimulationTab
│   │   ├── SimulationSettings
│   │   ├── SimulationProgress
│   │   ├── ResultsSummary
│   │   ├── DistributionChart
│   │   └── ContributionChart
│   │
│   └── [optimization] OptimizationTab
│       ├── OptimizationSettings
│       ├── EfficientFrontier
│       └── RecommendedTrades
│
└── Footer
```

---

## State Management

### State Locations

| State | Location | Persistence |
|-------|----------|-------------|
| Positions | `usePortfolio` hook | localStorage |
| Market data | `useMarketData` hook | localStorage (4h cache) |
| Correlation matrix | `useCorrelation` hook | localStorage |
| Simulation results | `useSimulation` hook | localStorage |
| Active tab | Local `useState` | No |
| Modal visibility | Local `useState` | No |
| Form inputs | Local `useState` | No |

### localStorage Schema

```javascript
// Key: 'monte-carlo-portfolio-v1'
{
  positions: [...],
  correlationMatrix: [[...]],
  editedCorrelation: [[...]],
  simulationResults: {...},
  settings: {
    numPaths: 10000,
    correlationMethod: 'shrinkage',
    useEwma: true,
    fatTailMethod: 'bootstrap',
    ...
  }
}

// Key: 'monte-carlo-unified-market-data-v6'
{
  cachedAt: 1704067200000,
  data: {
    'AAPL': {...},
    'SPY': {...},
    ...
  }
}
```

---

## Key Algorithms

### 1. Quasi-Monte Carlo (Sobol Sequences)

Located in `src/utils/quasiMonteCarlo.js`

Unlike pseudo-random Monte Carlo, QMC uses **low-discrepancy sequences** that fill the probability space more uniformly. This provides faster convergence (O(1/N) vs O(1/√N)).

```javascript
// Generate Sobol sequence
const sobol = new SobolSequence(dimensions);
for (let i = 0; i < numPaths; i++) {
  const uniformVector = sobol.next(); // [0,1]^d
  const normalVector = uniformVector.map(u => normalInvCDF(u));
  // Apply Cholesky correlation...
}
```

### 2. Correlation Matrix PSD Fix

Located in `src/utils/matrix.js`

User-edited correlation matrices may not be positive semi-definite. We fix this via iterative shrinkage:

```javascript
function makeValidPSD(matrix) {
  while (!isPSD(matrix)) {
    // Shrink off-diagonal elements toward zero
    for (i, j where i ≠ j) {
      matrix[i][j] *= 0.95;
    }
  }
  return matrix;
}
```

### 3. EWMA Correlation

Located in `src/utils/correlation.js`

Exponentially-weighted correlations give more weight to recent observations:

```javascript
function ewmaCorrelation(x, y, lambda = 0.94) {
  // Weight[t] = λ^(T-t) where T is most recent
  // Half-life = ln(0.5) / ln(λ) ≈ 30 days for λ=0.97
}
```

### 4. Date Alignment for International Stocks

Located in `src/utils/correlation.js`

International stocks trade on different days. We align by calendar date:

```javascript
function alignReturnsByDate(returns1, timestamps1, returns2, timestamps2, lag = 0) {
  // Build date map for series 2
  // Match dates from series 1
  // Apply lag offset if needed (-1, 0, +1 day)
}
```

---

## Adding Features

### Adding a New Factor

1. **Define the factor** in `src/constants/factors.js`:
```javascript
FACTOR_SPREAD_DEFINITIONS = {
  ...existing,
  NEW_FACTOR: { long: 'ETF1', short: 'ETF2', name: 'New Factor' }
}
```

2. **Add ETFs to fetch list** in `src/constants/factors.js`:
```javascript
FACTOR_ETF_TICKERS = [...existing, 'ETF1', 'ETF2']
```

3. **Compute the spread** in the market data loading logic
4. **Display in Factor Analysis tab**

### Adding a New Tab

1. **Create component** in `src/components/[tab-name]/`
2. **Add to TabBar** in `src/constants/index.js`:
```javascript
TABS = [...existing, { id: 'newtab', label: '🆕 New Tab' }]
```
3. **Add conditional render** in `App.jsx`
4. **Create hook** if needed in `src/hooks/`

### Adding a New Data Source

1. **Create API client** in `src/services/`
2. **Integrate into `useMarketData`** hook
3. **Update cache key** if data format changes
4. **Add error handling** for the new source

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Correlation matrix not PSD" | User edited invalid values | Click "Fix PSD" button |
| Data not loading | CORS proxy down | Check console, try different proxy |
| Simulation hangs | Worker crashed | Check console, refresh page |
| International stocks show 0% R² | Date misalignment | Enable lag adjustment |
| Storage quota exceeded | Too much cached data | Clear localStorage |

### Debug Logging

Enable verbose logging by setting in console:
```javascript
localStorage.setItem('debug', 'true');
```

---

## Glossary

| Term | Definition |
|------|------------|
| **Beta** | Sensitivity of returns to market movements. β=1.2 means 20% more volatile than market. |
| **Cholesky** | Matrix decomposition A = L·Lᵀ used to generate correlated random numbers. |
| **EWMA** | Exponentially Weighted Moving Average. Recent data weighted more heavily. |
| **Fama-French** | Factor model explaining returns via Market, Size, Value (and more) factors. |
| **HML** | High Minus Low. Value factor (value stocks minus growth stocks). |
| **PSD** | Positive Semi-Definite. A matrix property required for valid covariance/correlation. |
| **QMC** | Quasi-Monte Carlo. Uses low-discrepancy sequences instead of random numbers. |
| **R²** | Coefficient of determination. Fraction of variance explained by the model. |
| **Sharpe** | Risk-adjusted return: (Return - RiskFreeRate) / Volatility. |
| **SMB** | Small Minus Big. Size factor (small cap stocks minus large cap). |
| **Sobol** | A low-discrepancy sequence used in QMC for better convergence. |
| **VaR** | Value at Risk. Maximum loss at a given confidence level. |

---

## Version History

See [CHANGELOG.md](../CHANGELOG.md) for detailed version history.

---

*Last updated: January 2026*
*Document version: 2.0*
