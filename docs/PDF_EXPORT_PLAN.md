# PDF Export Enhancement Game Plan

## Current State Analysis

The current PDF export is basic and doesn't match the premium visual language of the app.

---

## Exportable Content by Tab

### 1. PositionsTab
| Component | Type | Priority |
|-----------|------|----------|
| Position Table | Table | ⭐⭐⭐ High |
| Exposure Summary (Long/Short/Gross/Net) | Stats | ⭐⭐⭐ High |
| Portfolio Value | Stat | ⭐⭐⭐ High |
| Cash Balance & Rate | Stat | ⭐⭐ Medium |
| Beta Distribution | Chart | ⭐ Low |
| Volatility Distribution | Chart | ⭐ Low |

### 2. SimulationTab
| Component | Type | Priority |
|-----------|------|----------|
| Return Distribution (P5/P25/P50/P75/P95) | Stats + Histogram | ⭐⭐⭐ High |
| Dollar Distribution | Stats + Histogram | ⭐⭐⭐ High |
| Max Drawdown Distribution | Stats + Histogram | ⭐⭐⭐ High |
| Loss Probabilities (breakeven, 10%, 20%, 30%) | Stats | ⭐⭐⭐ High |
| Contribution Analysis Table | Table | ⭐⭐⭐ High |
| Sanity Check | Stats | ⭐⭐ Medium |

### 3. CorrelationTab
| Component | Type | Priority |
|-----------|------|----------|
| Correlation Matrix (full heatmap) | Matrix | ⭐⭐⭐ High |
| Covariance Matrix | Matrix | ⭐⭐ Medium |
| Volatility Breakdown | Table | ⭐⭐ Medium |

### 4. OptimizeTab
| Component | Type | Priority |
|-----------|------|----------|
| Portfolio Summary (Return, Vol, Sharpe) | Stats | ⭐⭐⭐ High |
| Top Swaps Recommendations | Table | ⭐⭐⭐ High |
| Risk Contribution (MCTR, iSharpe, %Risk) | Table | ⭐⭐ Medium |
| Swap Heatmap | Matrix | ⭐ Low |

### 5. FactorsTab
| Component | Type | Priority |
|-----------|------|----------|
| Factor Exposures (MKT, SMB, HML, MOM) | Stats | ⭐⭐⭐ High |
| Thematic Concentrations | Cards + Progress | ⭐⭐⭐ High |
| Return Attribution Table | Table | ⭐⭐ Medium |
| Risk Decomposition (Factor vs Idio) | Stats + Bar | ⭐⭐ Medium |
| Position Loadings Table | Table | ⭐ Low |
| Thematic Swap Results | Table | ⭐ Low |

---

## Optimal PDF Page Order

### Page 1: Cover Page
- Monte Carlo Portfolio Analysis title
- Portfolio Value (large, green)
- Key Parameters summary
- Quick Results Preview (P5/Median/P95)

### Page 2: Executive Summary (NEW)
- 5-card stat grid: Portfolio Value, Median Return, P5 Return, P95 Return, P(Loss)
- Key risk metrics: Max Drawdown (P50, P95), Sharpe Ratio
- Exposure breakdown: Long %, Short %, Net %

### Page 3: Portfolio Positions
- Full position table with premium styling
- Columns: Ticker, Qty, Price, Value, Weight, Type
- Exposure Summary table below

### Page 4: Return Assumptions
- Per-position distribution parameters
- Columns: Ticker, P5, P50, P95, μ, σ
- Color-coded values (red for P5, green for P95)

### Page 5: Correlation Matrix
- Full NxN correlation matrix
- Color-coded cells (green >0.5, red <-0.3, muted =1)
- Key correlations callout box

### Page 6: Simulation Results - Returns
- Terminal Return Distribution stats
- Visual percentile range bar
- Dollar value projections

### Page 7: Simulation Results - Risk
- Drawdown Distribution stats
- Loss Probabilities table
- Risk interpretation

### Page 8: Contribution Analysis
- Contribution by position table
- Sorted by P50 contribution
- Color-coded positive/negative

### Page 9: Factor Analysis (conditional)
- Factor Exposures (4 factor cards)
- Thematic Concentrations
- Return Attribution summary

### Page 10: Optimization Summary (conditional)
- Portfolio metrics
- Top 5 swap recommendations
- Risk contribution highlights

---

## Visual Design System for PDF

### Colors (RGB for jsPDF)
```javascript
const PDF_COLORS = {
  background: [10, 10, 21],      // #0a0a15
  cardBg: [22, 27, 44],          // #161b2c (slightly lighter for contrast)
  primary: [0, 212, 255],        // #00d4ff (cyan)
  secondary: [123, 47, 247],     // #7b2ff7 (purple)
  green: [46, 204, 113],         // #2ecc71
  red: [231, 76, 60],            // #e74c3c
  orange: [255, 159, 67],        // #ff9f43
  text: [224, 224, 224],         // #e0e0e0
  muted: [136, 136, 136],        // #888888
  subtle: [68, 68, 68],          // #444444
};
```

### Typography
- Title: 28pt, Primary color
- Section Header: 16pt, Primary color
- Card Title: 12pt, White, Bold
- Body Text: 9pt, Text color
- Table Header: 9pt, Primary color, Bold
- Table Body: 8pt, Text color

### Card Styling
- Background: cardBg color
- Border Radius: 3mm
- Padding: 5mm internal
- Border: 0.3pt, rgba(255,255,255,0.1)

### Table Styling
- Header Row: cardBg background, primary text
- Alternate Rows: Slight background variation
- Number alignment: Right
- Ticker column: Primary color, bold

### Status Pills (for page headers)
- Rounded rectangles
- Dot indicator
- Color-coded by status

### Progress Bars
- Height: 3mm
- Background: subtle color
- Fill: gradient from primary to secondary

---

## Implementation Phases

### Phase 1: Core Infrastructure
1. Create PDF design system constants
2. Create reusable PDF drawing helpers:
   - drawCard(doc, x, y, w, h, options)
   - drawStatCard(doc, x, y, w, h, { icon, label, value, color })
   - drawProgressBar(doc, x, y, w, h, value, color)
   - drawTable(doc, x, y, headers, data, options)
   - drawCorrelationMatrix(doc, x, y, tickers, matrix)

### Phase 2: Page Generation
1. Cover Page (enhanced)
2. Executive Summary (new)
3. Portfolio Positions (enhanced)
4. Return Assumptions (enhanced)
5. Correlation Matrix (new visual style)
6. Simulation Results - Returns
7. Simulation Results - Risk
8. Contribution Analysis
9. Factor Analysis (conditional)
10. Optimization Summary (conditional)

### Phase 3: Polish
1. Page transitions
2. Footer with page numbers
3. Header on each page
4. Consistent margins
5. Visual hierarchy check

---

## Additional Props Needed

The ExportTab component needs these additional props for complete export:
- `factorAnalysis` - for factor exposures
- `optimizationResults` - for swap recommendations
- `positionMetadata` - for security names/types
- `positionBetas` - for beta column

---

## Execution Checklist

- [ ] Update ExportTab props
- [ ] Create PDF helper functions
- [ ] Implement Cover Page (enhanced)
- [ ] Implement Executive Summary
- [ ] Implement Positions page
- [ ] Implement Return Assumptions page
- [ ] Implement Correlation Matrix page
- [ ] Implement Simulation Returns page
- [ ] Implement Simulation Risk page
- [ ] Implement Contribution page
- [ ] Implement Factor Analysis page (conditional)
- [ ] Implement Optimization page (conditional)
- [ ] Add consistent headers/footers
- [ ] Test with various portfolio sizes
- [ ] Optimize file size
