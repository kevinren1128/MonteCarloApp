# Portfolio Optimization Analysis Tab - Design Document

## Overview

A new tab between "Simulation" and "Export" that provides actionable recommendations for portfolio improvement through incremental swap analysis. The key question: **"What single trade (buy X, sell Y at 1% each) would most improve my portfolio?"**

---

## Mathematical Framework

### 1. Marginal Contribution to Risk (MCTR)

The MCTR measures how much an asset contributes to portfolio risk at the margin:

```
MCTR_i = ∂σ_p / ∂w_i = (Σw)_i / σ_p = σ_i × ρ_{i,p}
```

Where:
- `σ_p` = portfolio volatility
- `w_i` = weight of asset i  
- `Σ` = covariance matrix
- `σ_i` = asset i volatility
- `ρ_{i,p}` = correlation of asset i with portfolio

**Interpretation**: Higher MCTR means the asset adds more risk per unit of weight.

### 2. Percentage Risk Contribution

```
%RC_i = (w_i × MCTR_i) / σ_p
```

Sum of all %RC = 100%. Shows how much of total portfolio risk comes from each asset.

### 3. Incremental Sharpe Ratio (iSharpe)

From research (Northstar Risk / Benhamou & Guez):

```
iSharpe_i = S_i - ρ_{i,p} × S_p
```

Where:
- `S_i` = Sharpe ratio of asset i = (μ_i - r_f) / σ_i
- `S_p` = Sharpe ratio of portfolio
- `ρ_{i,p}` = correlation between asset i and portfolio

**Key Insight**: 
- If `iSharpe > 0`: Adding to this position increases portfolio Sharpe ratio
- If `iSharpe < 0`: Adding to this position decreases portfolio Sharpe ratio
- Even a low-Sharpe asset can be accretive if it has low/negative correlation with portfolio!

### 4. Risk Budget Optimality Ratio

```
Optimality_i = (E[R_i] - R_f) / MCTR_i
```

A portfolio is optimally risk-budgeted when this ratio is equal for all assets. 
- **High ratio**: Asset is "cheap" in terms of risk-adjusted return (should increase)
- **Low ratio**: Asset is "expensive" in terms of risk-adjusted return (should decrease)

### 5. Swap Impact Calculation

For a swap of Δ% (e.g., 1%): Buy asset X, Sell asset Y

```
New weights: w'_i = w_i + Δ × (𝟙_{i=X} - 𝟙_{i=Y})

New expected return: μ'_p = μ_p + Δ × (μ_X - μ_Y)

New volatility: σ'_p = √(w' × Σ × w'^T)

New Sharpe: S'_p = (μ'_p - r_f) / σ'_p

ΔSharpe = S'_p - S_p
```

---

## Implementation Strategy

### Phase 1: Theoretical Analysis (Instant)

Computed directly from existing parameters (μ, σ, Σ, w):

| Metric | Formula | Use |
|--------|---------|-----|
| MCTR | `(Σw)_i / σ_p` | Risk contribution |
| %Risk | `w_i × MCTR_i / σ_p` | Risk decomposition |
| iSharpe | `S_i - ρ_{i,p} × S_p` | Sharpe accretion |
| Optimality | `(μ_i - r_f) / MCTR_i` | Risk budget efficiency |

**Output**: Ranking of assets by iSharpe (tells us what to buy/sell)

### Phase 2: Swap Matrix (Fast - O(n²))

For each pair (X, Y) where X ≠ Y:
1. Compute new weights with 1% swap
2. Calculate new Sharpe ratio analytically
3. Store ΔSharpe in n×n matrix

**Output**: Heatmap showing best swaps, ranked list of top 15 swaps

### Phase 3: Monte Carlo Validation (User's Preference)

For top 15 candidate swaps from Phase 2:
1. Run mini Monte Carlo (2,000 paths) with modified weights
2. Compute full metrics:
   - Mean/Median return
   - P(loss) - probability of negative return
   - VaR 5% - 5th percentile return
   - CVaR 5% - average of returns below VaR
   - P(drawdown > 10%) - from estimated drawdown distribution
   
3. Compare to baseline portfolio

**Output**: Detailed comparison table with Monte Carlo confidence

---

## UI Design

### Tab Name: "🎯 Optimize"

### Section 1: Risk Decomposition

**Card: "📊 Risk Contribution Analysis"**

```
[Bar Chart showing % Risk Contribution per asset]

Table:
| Ticker | Weight | MCTR | %Risk | iSharpe | Status |
|--------|--------|------|-------|---------|--------|
| NVDA   | 15.2%  | 0.42 | 28.3% | -0.12   | ⬇️ Reduce |
| AAPL   | 12.1%  | 0.28 | 15.1% | +0.08   | ✅ Hold |
| GLD    | 8.5%   | 0.12 | 4.5%  | +0.24   | ⬆️ Increase |
...
```

**Insight Box**:
> "3 positions have negative iSharpe (diluting returns): NVDA, TSLA, SOXL"
> "2 positions have high iSharpe (accretive): GLD, TLT"

### Section 2: Swap Analysis Matrix

**Card: "🔄 Swap Impact Matrix"**

```
[N×N Heatmap: Color = ΔSharpe]
- Green = positive (improvement)
- Red = negative (degradation)
- X-axis = "Buy" asset
- Y-axis = "Sell" asset

Dropdown: Swap Amount [1% | 2% | 5%]
```

### Section 3: Top Recommendations

**Card: "💡 Recommended Trades"**

```
Based on 1% swap analysis:

#1: Sell 1% NVDA → Buy 1% GLD
    ΔSharpe: +0.042 | ΔVol: -0.8% | ΔReturn: -0.3%
    [Run Monte Carlo Validation]

#2: Sell 1% TSLA → Buy 1% TLT  
    ΔSharpe: +0.038 | ΔVol: -1.2% | ΔReturn: -0.5%
    [Run Monte Carlo Validation]
    
#3: Sell 1% SOXL → Buy 1% AAPL
    ΔSharpe: +0.031 | ΔVol: -0.6% | ΔReturn: -0.2%
    [Run Monte Carlo Validation]
```

### Section 4: Monte Carlo Comparison (Expandable)

**Card: "🎲 Monte Carlo Validation"**

When user clicks "Run Monte Carlo Validation" on a swap:

```
Comparing: Current Portfolio vs. Swap #1 (Sell NVDA → Buy GLD)

                    | Current | After Swap | Change
--------------------|---------|------------|--------
Expected Return     | 12.4%   | 12.1%      | -0.3%
Portfolio Vol       | 22.1%   | 21.3%      | -0.8%
Sharpe Ratio        | 0.467   | 0.509      | +0.042
Median Return       | 11.8%   | 11.6%      | -0.2%
P(Loss)             | 18.2%   | 16.1%      | -2.1% ✓
VaR 5%              | -24.3%  | -22.1%     | +2.2% ✓
CVaR 5%             | -31.2%  | -28.4%     | +2.8% ✓
P(DD > 20%)         | 12.3%   | 10.1%      | -2.2% ✓

[Distribution Comparison Chart - overlay of two return distributions]

Recommendation: ✅ This trade improves risk-adjusted returns
```

---

## Technical Implementation

### Data Requirements (Already Available)

From existing simulation infrastructure:
- `positions[]` - tickers, weights, μ, σ
- `editedCorrelation[][]` - correlation matrix
- `annualMu[]`, `annualSigma[]` - distribution parameters
- `weights[]` - current allocation
- Monte Carlo simulation function

### New Functions Needed

```javascript
// Phase 1: Risk decomposition
function computeRiskDecomposition(weights, mu, sigma, correlationMatrix, riskFreeRate) {
  // Returns: { mctr[], pctRisk[], iSharpe[], optimality[], portfolioSharpe }
}

// Phase 2: Swap matrix
function computeSwapMatrix(weights, mu, sigma, correlationMatrix, riskFreeRate, swapPct) {
  // Returns: { deltaSharpe[][], deltaVol[][], deltaReturn[][] }
}

// Phase 3: Monte Carlo comparison
function runSwapMonteCarlo(baseWeights, swapWeights, numPaths, ...mcParams) {
  // Returns: { 
  //   baseline: { mean, median, pLoss, var5, cvar5, ... },
  //   swapped: { mean, median, pLoss, var5, cvar5, ... }
  // }
}

// Helper: Compute covariance matrix from correlation + volatilities
function buildCovarianceMatrix(correlationMatrix, sigmaArray) {
  // Σ_ij = ρ_ij × σ_i × σ_j
}

// Helper: Portfolio volatility
function computePortfolioVolatility(weights, covarianceMatrix) {
  // √(w^T × Σ × w)
}
```

### Performance Considerations

| Operation | Complexity | Time (18 assets) |
|-----------|------------|------------------|
| Risk decomposition | O(n²) | <1ms |
| Swap matrix | O(n³) | ~5ms |
| Monte Carlo (2000 paths) | O(paths × n) | ~50ms |
| Full MC for top 15 swaps | O(10 × paths × n) | ~500ms |

All operations should complete in <1 second total.

---

## User Flow

1. User navigates to "🎯 Optimize" tab
2. **Instant**: Risk decomposition shows current portfolio analysis
3. **Instant**: Swap matrix heatmap shows all possible 1% swaps
4. **Instant**: Top 5 recommendations shown based on ΔSharpe
5. **On-demand**: User clicks "Validate with Monte Carlo" on any recommendation
6. **~500ms**: Monte Carlo comparison results displayed
7. User can adjust swap amount (1%, 2%, 5%) and analysis updates

---

## Future Enhancements

1. **Multi-swap optimization**: Find optimal 2-3 simultaneous swaps
2. **Constraints**: "Don't reduce any position below 5%", "Max 20% in any sector"
3. **Tax-aware**: Consider tax lots and holding periods
4. **Rebalancing schedule**: Suggest timing based on market conditions
5. **What-if scenarios**: "What if I add $10K to position X?"

---

## References

1. Benhamou, E. & Guez, B. (2021). "Computation of the marginal contribution of Sharpe ratio"
2. Maillard, S., Roncalli, T., Teiletche, J. (2010). "The properties of equally weighted risk contribution portfolios"
3. Northstar Risk. "Incremental Sharpe" - https://www.northstarrisk.com/incrementalsharpe
4. Kim, Y.S. (2022). "Portfolio optimization and marginal contribution to risk on multivariate normal tempered stable model"
