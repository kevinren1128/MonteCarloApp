# Financial Calculations

## What Was Implemented

Monte Carlo simulation engine with correlated returns, fat-tail distributions, and portfolio optimization analysis.

### Core Calculations

| Calculation | Location | Description |
|-------------|----------|-------------|
| Monte Carlo | `src/workers/simulationWorker.js` | Standard MC simulation |
| Quasi-Monte Carlo | `src/workers/qmcSimulationWorker.js` | Sobol sequence MC |
| Cholesky Decomposition | `src/App.jsx` | Correlation structure |
| Factor Analysis | `src/App.jsx` | Factor exposure regression |
| Optimization | `src/App.jsx` | Swap recommendations |

### Distribution Parameters

From bootstrap percentiles (P5, P25, P50, P75, P95), we derive:
- μ (mu) — Expected return
- σ (sigma) — Volatility
- Skew — Asymmetry adjustment
- Tail df — Degrees of freedom for Student-t

```javascript
const getDistributionParams = (position) => {
  const { p5, p25, p50, p75, p95 } = position;
  // Derive parameters from percentiles...
};
```

### Correlation Methods

1. **Sample Correlation** — Standard Pearson correlation
2. **EWMA Correlation** — Exponentially weighted with half-life
3. **Ledoit-Wolf Shrinkage** — Regularized for stability

### Monte Carlo Flow

```
1. Get distribution params (μ, σ, skew, df) for each position
         │
         ▼
2. Build correlation matrix → Cholesky decomposition → L
         │
         ▼
3. Generate random normals z[] (or Halton sequence for QMC)
         │
         ▼
4. Apply Cholesky: correlatedZ = L × z
         │
         ▼
5. Transform to skewed t-distribution
         │
         ▼
6. Compute position returns: μ + σ × transformed
         │
         ▼
7. Weight and sum for portfolio return
         │
         ▼
8. Repeat 10,000+ times → distribution of outcomes
```

## Key Decisions

### 1. Web Workers for Simulation

**Why?**
- 10K+ path simulation blocks UI
- Workers run in separate threads
- Can parallelize across CPU cores

**Implementation:**
- Split paths across 8 workers
- Each worker runs subset of simulation
- Combine results in main thread

### 2. Quasi-Monte Carlo Option

**Why Sobol sequences?**
- Better coverage than pseudo-random
- Faster convergence
- Same accuracy with fewer paths

**Trade-offs:**
- More complex implementation
- Slight overhead for sequence generation

### 3. Skewed Student-t Distributions

**Why not just normal?**
- Markets have fat tails
- Negative skew (crashes more likely)
- Student-t captures kurtosis

**Implementation:**
- Box-Muller for normal generation
- Chi-squared scaling for Student-t
- Skew adjustment based on percentile asymmetry

### 4. Correlation Groups

**What are they?**
- User-defined groups of related positions
- Positions in same group get correlation floor (0.55)
- Prevents unrealistic diversification benefits

**Example:**
- "Tech" group: AAPL, MSFT, GOOGL
- Minimum pairwise correlation: 0.55

## What We Tried That Didn't Work

1. **Normal distributions only**
   - Problem: Underestimated tail risk
   - Solution: Skewed Student-t with fat tails

2. **Single-threaded simulation**
   - Problem: Blocked UI for seconds
   - Solution: Web Workers with parallelization

3. **editedCorrelation without validation**
   - Problem: State corruption → zero stdDev → zero delta Sharpe
   - Solution: `isValidCorrelationMatrix()` + fallback to `correlationMatrix`

## Gotchas

1. **editedCorrelation can become corrupted**
   - After certain operations, becomes object instead of 2D array
   - Always validate with `isValidCorrelationMatrix()` before use
   - Fall back to `correlationMatrix` if invalid
   - Symptoms: all MC paths identical, stdDev = 0%

2. **Cholesky requires positive semi-definite matrix**
   - User edits can break PSD property
   - `makeValidCorrelation()` fixes this
   - Eigenvalue adjustment via Higham's algorithm

3. **Percentile order matters**
   - p5 < p25 < p50 < p75 < p95
   - Invalid order breaks distribution fitting
   - Validate on input

4. **Weight normalization**
   - Weights must sum to 1 (or leverage ratio)
   - Cash weight affects total return
   - Adjusted weights = raw weights × leverage ratio

5. **International stocks timezone effects**
   - Different trading hours affect correlation
   - Lag analysis detects this
   - Apply lag adjustment if significant

## Future Ideas

1. **GPU acceleration**
   - WebGL for parallel simulation
   - 100x speedup for large portfolios

2. **Historical backtesting**
   - Run simulation on historical data
   - Compare simulated vs actual outcomes

3. **Regime detection**
   - Identify bull/bear market regimes
   - Different parameters per regime

4. **Stress testing**
   - Predefined scenarios (2008, COVID)
   - User-defined stress scenarios

5. **Copula models**
   - Non-Gaussian dependence structure
   - Better tail dependence modeling
