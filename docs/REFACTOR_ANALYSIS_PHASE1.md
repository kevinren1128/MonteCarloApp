# App.jsx Refactoring Analysis - Phase 1

**Date:** January 29, 2026
**Analysis Type:** Codebase structure & complexity assessment
**Source File:** `/Users/kevinren/MonteCarloApp/src/App.jsx`

---

## 1. File Size & Complexity

| Metric | Value |
|--------|-------|
| **Total Lines** | 8,414 |
| **useState Hooks** | ~42 |
| **useCallback Hooks** | ~18 |
| **useMemo Hooks** | ~8 |
| **useEffect Hooks** | ~10 |

### Top 5 Largest Functions (Approximate)
1. **`fetchUnifiedMarketData`** (~350 lines) - Main data fetching orchestrator
2. **`runFactorAnalysis`** (~250 lines) - Factor beta calculations
3. **`fetchAndComputeCorrelation`** (~280 lines) - Correlation matrix computation  
4. **`computeFactorBetas`** (~220 lines) - Factor regression analysis
5. **`runLagAnalysis`** (~180 lines) - Timezone lag detection

---

## 2. Current Structure

### Main State Variables (42 total)

**Portfolio Core:**
- `positions`, `cashBalance`, `cashRate`

**Market Data:**
- `unifiedMarketData`, `historicalData`, `positionBetas`, `positionMetadata`

**Correlation & Risk:**
- `correlationMatrix`, `editedCorrelation`, `correlationMethod`, `useEwma`, `lagAnalysis`

**Simulation & Results:**
- `simulationResults`, `previousSimulationResults`, `numPaths`, `isSimulating`

**Optimization:**
- `optimizationResults`, `riskFreeRate`, `swapSize`

**Factor Analysis:**
- `factorData`, `factorAnalysis`, `thematicOverrides`

**UI & Loading:**
- `activeTab`, `sidebarExpanded`, various `isFetching*` flags, modals

### Key Imports
- **React:** useState, useCallback, useMemo, useEffect, useRef
- **Recharts:** XAxis, YAxis, BarChart, AreaChart (visualization)
- **Custom UI:** ToastProvider, ConfirmDialog, Sidebar, InfoTooltip
- **Tab Components:** CorrelationTab, SimulationTab, OptimizeTab, etc. (already extracted!)
- **Hooks:** useAutosave, useUndoRedo
- **Utils:** crashRecovery, portfolioOptimization

### Main Render Sections
1. Header with portfolio value & action buttons
2. Welcome banner (dismissable)
3. `<Sidebar />` component
4. Tab content area (8 tabs total)
5. Footer
6. Modal dialogs

---

## 3. Pain Points for Refactoring

### State That Should Be Extracted to Context

| State Group | Variables | Recommended Context | Impact |
|------------|-----------|---------------------|--------|
| Market Data | `unifiedMarketData`, `positionBetas`, `positionMetadata`, `historicalData` | `MarketDataContext` | Prevents re-renders when only UI state changes |
| Portfolio | `positions`, `cashBalance`, `cashRate` | `PortfolioContext` | Clear separation of concerns |
| Simulation | `simulationResults`, `numPaths`, `fatTailMethod`, `useQmc` | `SimulationContext` | Reduces main component prop drilling |
| UI/Loading | All `isFetching*`, `isSimulating`, `activeTab` | `AppUIContext` | Isolates UI state from data |

### Functions Doing Multiple Things

**High Priority:**
1. **`fetchUnifiedMarketData`** (~350 lines)
   - Fetches from Yahoo Finance
   - Computes betas for all positions
   - Computes factor spreads
   - Updates multiple state variables
   - Caches to localStorage
   - **Issue:** Touches 10+ state vars, hard to test/refactor

2. **`fetchAndComputeCorrelation`** (~280 lines)
   - Fetches price history
   - Applies EWMA smoothing
   - Handles timezone lag detection
   - Applies shrinkage/validation
   - **Issue:** Too many concerns in one function

3. **`runFactorAnalysis`** (~250 lines)
   - Computes betas across 50+ factors
   - Detects thematic exposures
   - Aggregates portfolio-level metrics
   - **Issue:** Complex algorithm mixed with state management

### Long Conditional Renders
- Welcome banner (~30 lines) → Could be extracted component
- Tab content switching → Already extracted ✅

### Extractable Code Blocks

| Category | Estimated Lines | Extraction Strategy |
|----------|-----------------|-------------------|
| Utility Functions (Yahoo API, stats) | ~600 | Move to `/utils/` or new file |
| Inline UI Components (sliders, inputs) | ~200 | Extract to `/components/` |
| Data-fetching functions | ~1,000+ | Convert to custom hooks |
| useState consolidation | 42 → 4-5 | Migrate to contexts |

---

## 4. Recommendations

### 🟢 Easiest Win (Do First)
**Extract utility functions to `/utils/`**
- Pure functions: Yahoo API helpers, statistical functions (normalCDF, choleskyDecomposition), data processing
- Zero React dependencies → trivial to move
- Immediately improves readability
- **Effort:** 1-2 hours
- **Impact:** High (cleaner code, easier testing)

### 🔴 Most Complex (Most Dependencies)
**`fetchUnifiedMarketData` → Custom Hook**
- Touches 10+ state variables
- Calls multiple API helpers
- Updates localStorage
- Sets derived states
- **Would need:** Careful refactoring into `useMarketData()` hook + MarketDataContext
- **Effort:** 3-4 hours
- **Impact:** Highest (massive simplification of main component)

### ⚡ Performance Impact
**Market Data in Context** = Biggest win
- Currently: Any state change re-renders entire component
- After: Only UI state changes trigger re-renders (market data isolated)
- Estimated improvement: 30-40% fewer re-renders

**Callback memoization** also needs attention:
- Many callbacks passed to tab components
- Should use `useCallback` + context to prevent unnecessary re-renders

---

## 5. Refactoring Strategy

### Phase 2 (Next): Detailed Plan
- Specify exact files to create
- Map state migrations to contexts
- Identify function extraction order
- Document dependencies between modules
- Create implementation checklist

### Phase 3: Implementation Order
1. Extract utilities (easiest, no blockers)
2. Create contexts (no risk)
3. Migrate state (medium complexity)
4. Extract functions to hooks (high complexity)
5. Test & verify (ensure no regressions)

---

## Summary

**The Good:**
- Tab components already extracted ✅
- Good use of useMemo/useCallback in places
- Clear separation between data + UI logic exists

**The Bad:**
- 42 useState hooks should be 4-5 contexts
- ~1,000+ lines of functions doing multiple things
- Main component handles data fetching + state + UI all at once

**The Path Forward:**
Extract utilities first (easy win), then tackle the big refactoring (contexts + custom hooks) in a controlled way. The file has good bones—just needs organized extraction.

**Estimated Total Effort:** 6-8 hours over 2-3 days
**Risk Level:** Medium (large refactor, but well-structured approach)
**Biggest Payoff:** Reduced component complexity, better testability, cleaner separation of concerns
