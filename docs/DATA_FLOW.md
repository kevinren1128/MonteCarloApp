# Data Flow Documentation

> This document describes how data flows through the Monte Carlo Portfolio Simulator.

## Overview Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERACTION                                 │
│  ┌─────────┐  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │Add Stock│  │Load Data │  │Edit Corr│  │ Run Sim  │  │Run Optimization  │ │
│  └────┬────┘  └────┬─────┘  └────┬────┘  └────┬─────┘  └────────┬─────────┘ │
└───────┼────────────┼─────────────┼────────────┼──────────────────┼───────────┘
        │            │             │            │                  │
        ▼            ▼             ▼            ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            REACT STATE (Hooks)                                │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │usePortfolio │  │useMarketData  │  │useCorrelation│  │useOptimization   │ │
│  │ • positions │  │ • marketData  │  │ • matrix     │  │ • results        │ │
│  │ • cash      │  │ • factorData  │  │ • method     │  │ • weights        │ │
│  └──────┬──────┘  └───────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                 │                   │
          │      ┌──────────┴─────────┐       │                   │
          │      ▼                    ▼       ▼                   ▼
          │  ┌────────────┐    ┌──────────────────┐    ┌─────────────────────┐
          │  │Yahoo API   │    │Correlation Calc  │    │Web Worker           │
          │  │• Quotes    │    │• Sample          │    │• Monte Carlo        │
          │  │• History   │    │• EWMA            │    │• QMC Simulation     │
          │  │• Profiles  │    │• Shrinkage       │    │                     │
          │  └─────┬──────┘    └────────┬─────────┘    └──────────┬──────────┘
          │        │                    │                         │
          ▼        ▼                    ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            PERSISTENCE LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                          localStorage                                     ││
│  │  • Portfolio state (positions, cash, settings)                           ││
│  │  • Market data cache (4-hour TTL)                                        ││
│  │  • Correlation matrices (computed + edited)                              ││
│  │  • Simulation results                                                    ││
│  └──────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Position Data Flow

### Adding a New Position

```
User enters ticker → validateTicker() → fetchYahooQuote()
                                              │
                                              ▼
                                    ┌─────────────────┐
                                    │ Yahoo Finance   │
                                    │ • Current price │
                                    │ • Name          │
                                    │ • Type (stock/  │
                                    │   ETF)          │
                                    └────────┬────────┘
                                             │
                                             ▼
                          ┌──────────────────────────────────┐
                          │        Create Position           │
                          │ {                                │
                          │   ticker: 'AAPL',               │
                          │   shares: 0,                    │
                          │   price: 150.00,                │
                          │   distribution: { mu, sigma,    │
                          │                   skew, tailDf }│
                          │ }                               │
                          └────────────────┬─────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
           ┌───────────────┐                            ┌─────────────────┐
           │ Update State  │                            │ Save to Storage │
           │ setPositions()│                            │ localStorage    │
           └───────────────┘                            └─────────────────┘
```

### Position State Structure

```javascript
// positions array
[
  {
    ticker: 'AAPL',
    shares: 100,
    price: 150.00,                    // Current market price
    cost: 145.00,                     // Optional: purchase price
    distribution: {
      mu: 0.12,                       // Expected annual return
      sigma: 0.25,                    // Annual volatility
      skew: -0.1,                     // Skewness
      tailDf: 15,                     // Student-t degrees of freedom
    },
    // Derived fields (computed, not stored):
    value: 15000,                     // shares * price
    weight: 0.25,                     // value / total portfolio
  },
  // ... more positions
]
```

---

## 2. Market Data Flow

### Unified Data Loading

```
"Load All Data" clicked
         │
         ▼
┌─────────────────────────────────────┐
│ 1. Check Cache                      │
│    - Load from localStorage         │
│    - Check timestamp vs TTL         │
└───────────────┬─────────────────────┘
                │
        ┌───────┴───────┐
        │ Cache valid?  │
        └───────┬───────┘
            No  │   Yes
        ┌───────┴───────┐
        │               │
        ▼               ▼
┌───────────────┐ ┌─────────────┐
│ Fetch Fresh   │ │ Rehydrate   │
│ Data          │ │ from Cache  │
└───────┬───────┘ └──────┬──────┘
        │                │
        ▼                │
┌───────────────────────┐│
│ 2. Parallel Fetching  ││
│ For each ticker:      ││
│ • fetchYahooHistory() ││
│ • fetchYahooProfile() ││
│ Race CORS proxies     ││
└───────────┬───────────┘│
            │            │
            ▼            │
┌───────────────────────┐│
│ 3. Process Data       ││
│ • Compute returns     ││
│ • Compute volatility  ││
│ • Compute beta        ││
│ • Fit distribution    ││
└───────────┬───────────┘│
            │            │
            ▼            │
┌───────────────────────┐│
│ 4. Compute Factors    ││
│ • SMB, HML, MOM       ││
│ • Add timestamps      ││
└───────────┬───────────┘│
            │            │
            ▼            ▼
┌─────────────────────────────────────┐
│ 5. Update State & Cache             │
│ • setMarketData(data)               │
│ • setFactorData(factors)            │
│ • saveToCache(slimData)             │
└─────────────────────────────────────┘
```

### Market Data Structure

```javascript
// marketData object
{
  'AAPL': {
    ticker: 'AAPL',
    currentPrice: 150.00,
    dailyReturns: [0.01, -0.02, ...],  // Array of daily returns
    timestamps: [1704067200000, ...],   // Millisecond timestamps
    logReturns: [-0.02, 0.01, ...],    // Log returns for distribution
    oneYearReturn: 0.15,
    ytdReturn: 0.08,
    volatility: 0.25,
    beta: 1.2,
    correlation: 0.85,                  // vs SPY
    sector: 'Technology',
    industry: 'Consumer Electronics',
    sparkline: [148, 149, 150, ...],    // Mini price chart data
    calendarYearReturns: { '2023': 0.48, '2024': 0.12 },
  },
  'SPY': { ... },
  // Factor ETFs
  'IWM': { ... },
  'IWD': { ... },
  // ... etc
}
```

---

## 3. Correlation Matrix Flow

### Computing Correlation

```
"Compute Correlation" clicked
              │
              ▼
┌──────────────────────────────────────┐
│ 1. Gather Returns                    │
│ For each position:                   │
│   • Get dailyReturns from marketData │
│   • Get timestamps for alignment     │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Align by Date                     │
│ For international stocks:            │
│   • Test lag -1, 0, +1               │
│   • Use best overlap                 │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Compute Pairwise Correlations     │
│ Method depends on correlationMethod: │
│                                      │
│ 'sample':                            │
│   corr = Σ(xi-μx)(yi-μy) /          │
│          √(Σ(xi-μx)²·Σ(yi-μy)²)     │
│                                      │
│ 'ewma':                              │
│   Apply exponential weights:         │
│   w_t = λ^(n-t), λ from half-life   │
│                                      │
│ 'shrinkage':                         │
│   corr = (1-α)·sample + α·target    │
│   Ledoit-Wolf optimal α             │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Make Valid PSD                    │
│ • Symmetrize matrix                  │
│ • Ensure diagonal = 1               │
│ • Fix eigenvalues if needed          │
└──────────────┬───────────────────────┘
               │
        ┌──────┴──────┐
        ▼             ▼
┌────────────┐  ┌──────────────┐
│ Original   │  │ Editable     │
│ Matrix     │  │ Copy         │
│ (read-only)│  │ (user edits) │
└────────────┘  └──────────────┘
```

### Correlation Matrix Structure

```javascript
// correlationMatrix (N x N)
[
  [1.00, 0.75, 0.45, 0.30],  // AAPL correlations
  [0.75, 1.00, 0.60, 0.35],  // MSFT correlations
  [0.45, 0.60, 1.00, 0.20],  // GLD correlations
  [0.30, 0.35, 0.20, 1.00],  // BND correlations
]

// editedCorrelation - same structure, user can modify
// Must remain symmetric and PSD for simulation
```

---

## 4. Simulation Flow

### Running Monte Carlo Simulation

```
"Run Simulation" clicked
              │
              ▼
┌──────────────────────────────────────┐
│ 1. Prepare Inputs                    │
│ • Extract position weights           │
│ • Extract distribution params        │
│ • Get edited correlation matrix      │
│ • Set simulation parameters          │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Send to Web Worker                │
│ postMessage({                        │
│   type: 'RUN_SIMULATION',            │
│   positions: [...],                  │
│   correlationMatrix: [...],          │
│   numPaths: 10000,                   │
│   useQmc: true                       │
│ })                                   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. Worker: Generate Paths            │
│                                      │
│ For each path (1 to numPaths):       │
│   a. Generate correlated normals:    │
│      Z = L · U (Cholesky × randoms)  │
│                                      │
│   b. Transform to returns:           │
│      For each position i:            │
│        r_i = μ_i + σ_i · T(Z_i, df)  │
│                                      │
│   c. Compute portfolio return:       │
│      R = Σ w_i · r_i                 │
│                                      │
│   d. Report progress periodically    │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Worker: Compute Statistics        │
│ • Sort returns                       │
│ • Compute percentiles (5,25,50,75,95)│
│ • Compute VaR (95%, 99%)             │
│ • Compute CVaR (expected shortfall)  │
│ • Compute max drawdown distribution  │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 5. Return Results to Main Thread     │
│ postMessage({                        │
│   type: 'COMPLETE',                  │
│   results: { ... }                   │
│ })                                   │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 6. Update UI                         │
│ • Display percentile chart           │
│ • Show VaR/CVaR metrics              │
│ • Show contribution breakdown        │
└──────────────────────────────────────┘
```

### Simulation Results Structure

```javascript
// simulationResults
{
  // Portfolio return distribution
  percentiles: {
    p5: -0.15,     // 5th percentile (bad case)
    p25: 0.02,     // 25th percentile
    p50: 0.10,     // Median
    p75: 0.18,     // 75th percentile
    p95: 0.32,     // 95th percentile (good case)
  },
  
  // Risk metrics
  expectedReturn: 0.105,
  volatility: 0.18,
  var95: 0.12,           // 95% VaR (5% chance of losing this much)
  var99: 0.22,           // 99% VaR
  cvar95: 0.18,          // Expected loss given loss > VaR95
  maxDrawdown: {
    p50: 0.15,
    p95: 0.28,
  },
  
  // Per-position contribution
  contributions: [
    { ticker: 'AAPL', weight: 0.30, riskContrib: 0.35, returnContrib: 0.32 },
    { ticker: 'MSFT', weight: 0.25, riskContrib: 0.28, returnContrib: 0.27 },
    // ...
  ],
  
  // Full distribution (for charts)
  returnDistribution: [...],  // 10000 sorted returns
  
  // Metadata
  numPaths: 10000,
  timeHorizon: 12,
  computeTime: 1234,  // ms
}
```

---

## 5. Factor Analysis Flow

```
Factor Analysis Tab opened
              │
              ▼
┌──────────────────────────────────────┐
│ 1. Load Factor Data                  │
│ • SPY (Market)                       │
│ • IWM, IWD, IWF (Size, Value)        │
│ • MTUM (Momentum)                    │
│ • Thematic ETFs                      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 2. Compute Factor Spreads            │
│ SMB = return(IWM) - return(SPY)      │
│ HML = return(IWD) - return(IWF)      │
│ MOM = return(MTUM) - return(SPY)     │
│ (with timestamps for alignment)      │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 3. For Each Position:                │
│                                      │
│ a. Align by date                     │
│    (handle international lags)       │
│                                      │
│ b. Regress on market:                │
│    r_i = α + β_mkt · r_mkt + ε       │
│                                      │
│ c. Regress residuals on factors:     │
│    ε = β_smb·SMB + β_hml·HML +       │
│        β_mom·MOM + residual          │
│                                      │
│ d. Detect thematic exposure:         │
│    Test correlation with thematic    │
│    ETFs (SOXX, XBI, etc.)            │
└──────────────┬───────────────────────┘
               │
               ▼
┌──────────────────────────────────────┐
│ 4. Output Factor Analysis            │
│ Per position:                        │
│ • β_mkt, β_smb, β_hml, β_mom         │
│ • R² (explained variance)            │
│ • α (alpha / excess return)          │
│ • Thematic matches                   │
└──────────────────────────────────────┘
```

---

## 6. Storage Optimization

### What Gets Stored vs Computed

```
STORED (slim format):              COMPUTED on load:
─────────────────────              ──────────────────
• ticker                           • dailyReturns
• currentPrice                     • logReturns  
• prices (array)                   • distribution (bootstrapped)
• timestamps                       • beta (vs SPY)
• sector                           • sparkline
• industry                         • volatility
• oneYearReturn                    
• ytdReturn                        

Storage reduction: ~90%
5.8MB → 700KB typical
```

### Cache Invalidation

```
┌────────────────────────────────────────┐
│ Cache Key: 'monte-carlo-unified-v6'    │
│                                        │
│ Version bumped when:                   │
│ • Data format changes                  │
│ • New fields added                     │
│ • Computation logic changes            │
│                                        │
│ TTL: 4 hours                           │
│ • Fresh data fetched if stale          │
│ • Computed fields regenerated          │
└────────────────────────────────────────┘
```

---

## 7. Error Handling Flow

```
API Request
    │
    ├─── Success ──────────────────► Process Data
    │
    └─── Failure
            │
            ▼
    ┌───────────────┐
    │ Try Proxy #1  │ (allorigins.win)
    └───────┬───────┘
            │
            ├─── Success ──► Process Data
            │
            └─── Failure
                    │
                    ▼
            ┌───────────────┐
            │ Try Proxy #2  │ (corsproxy.io)
            └───────┬───────┘
                    │
                    ├─── Success ──► Process Data
                    │
                    └─── Failure
                            │
                            ▼
                    ┌───────────────┐
                    │ Try Direct    │
                    └───────┬───────┘
                            │
                            ├─── Success ──► Process Data
                            │
                            └─── All Failed
                                    │
                                    ▼
                            ┌───────────────────┐
                            │ Show Error to User│
                            │ Allow Retry       │
                            └───────────────────┘
```

---

*Last updated: January 2026*
