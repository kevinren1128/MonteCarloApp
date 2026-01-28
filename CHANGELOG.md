# Monte Carlo Portfolio Simulator - Changelog

All notable changes to this project are documented in this file.

---

## [6.3.0] - 2026-01-25

### 🌍 International Currency Support & Bug Fixes

#### Currency Conversion
- **Full USD conversion for international stocks** - All prices now properly converted to USD
- **Load All button** - Now correctly refreshes prices with currency conversion
- **Add Positions Modal** - Fetches exchange rates and converts to USD, shows both USD and local currency
- **Ticker input auto-fetch** - Currency conversion applied when typing international tickers
- **Exchange rate display** - Modal shows local currency price below USD price (e.g., "EUR 140.50")

#### Quick Add Row Fixes
- **Fixed text reset bug** - Typing in new row no longer resets/overwrites characters
- **Root cause**: Auto-focus useEffect had `sortedPositions` dependency causing re-focus on every keystroke
- **Solution**: Added `hasFocusedNewestRef` to track if position already focused, only focus once on creation

#### Sorting Stability During Editing
- **Brand new positions detected** - Sorting now detects new rows and keeps them stable at bottom
- **Functional state updates** - `addPosition`, `addPositionsBatch`, `updatePosition`, `removePosition` all use functional updates to avoid stale closures
- **Editing state preserved** - Table doesn't re-sort while any ticker input is focused

#### Tab Indicator Dots (Header)
- **Improved logic** - Green dots now indicate actual workflow completion, not just "has positions"
  - Positions: Green when market data loaded (betas fetched)
  - Distributions: Green when distributions customized from defaults
  - Correlation: Green when matrix computed, orange when data ready
  - Simulation: Green when run, orange when correlation ready
  - Factors/Optimize: Green when analysis complete
- **Tooltips added** - Hover over dots to see what they mean
- **Orange dots** - Only show when green isn't showing (no overlap)

#### Add Positions Modal
- **X button alignment fixed** - Delete button now properly right-aligned with `marginLeft: 'auto'`
- **Currency info preserved** - When adding positions, currency/domesticPrice passed through

---

## [6.2.1] - 2026-01-25

### 🏗️ Refactoring Foundation

#### Fixes
- **Toast notifications now working** - Fixed globalToastRef to call function directly
- **Full text labels restored** in header tabs and buttons

#### Architecture Improvements
- **Styles extracted** to `/src/styles/appStyles.js` (~300 lines)
- **Chart utilities extracted** to `/src/utils/chartUtils.js`:
  - generateHistogramData
  - generateReturnHistogramData
  - generateDollarHistogramData
  - formatDollars, formatCurrency, formatPercent
  - getValueColor, getPercentile
- **AppContext created** for future tab component extraction
- Utils index updated with new exports
- Contexts index updated

#### Performance Optimization Prep
- Ready for React.memo on tab components
- Ready for useMemo on expensive calculations
- Ready for useCallback on event handlers
- Ready for React.lazy loading of tabs

### Header UI Updates
- Title: "Monte Carlo Simulator" (full text)
- Tabs: Full labels - "Positions", "Distributions", "Correlation", "Simulation", "Factors", "Optimize", "Export"
- Buttons: Full labels - "🚀 Load Data", "📤 Export", "📥 Import", "🔄 Reset"

## [6.2.0] - 2026-01-25

### 🛠️ Bug Fixes & Layout Improvements

#### Blank Screen Fix
- **Fixed Toast component** - handleDismiss was called before defined in useEffect
- Renamed internal Toast component to ToastItem to avoid naming conflicts
- Added useCallback for proper hook dependencies
- Used ref to track exiting state for cleanup

#### Code Refactoring
- **Extracted styles** to `/src/styles/appStyles.js` (~300 lines)
- Reduces App.jsx from 12,376 lines to 12,072 lines
- Still above 500KB threshold, but improved structure

#### Compact Sticky Header (Refined)
- **Single-row header layout** - title, tabs, and actions all on one line
- **Tabs integrated into header** - no longer a separate row
- Shorter tab labels: "Dist", "Corr", "Sim", "Opt"
- **Dark header background** (#0a0a14) visually distinct from content area
- Inline loading indicator with counter badge
- Portfolio value shown in styled pill
- Properly sized buttons and tabs (not too cramped)

#### Toast Notifications (Redesigned)
- **Matches app info box style** - colored border with subtle same-hue shading
- Uses app's monospace font (JetBrains Mono)
- **Progress bar synced with actual duration** (5 second default)
- Cleaner, simpler design matching the app aesthetic
- Type-based colors: cyan (info), green (success), red (error), orange (warning)
- Positioned below sticky header

#### Currency Conversion Fix
- **Fixed international stock price conversion** - JPY, EUR, GBP, etc. now properly convert to USD
- Fetches exchange rates when loading data
- Stores both domestic price and USD price
- Shows exchange rate in position table

#### Factor Analysis Button Fix
- **Fixed center "Run Factor Analysis" button** - was calling wrong function
- Now properly sets loading state and shows feedback

---

## [6.1.0] - 2026-01-25

### 🎨 Professional UI/UX Improvements

This release transforms the interface with premium styling, smooth animations, and polished interactions.

#### Premium Toast Notifications (Redesigned)
- **Glassmorphism design** with backdrop blur and radial glow effects
- **Animated progress bar** showing time remaining before auto-dismiss
- **Gradient accent bar** with type-specific colors (green/red/orange/cyan)
- **Pulsing glow effect** behind each toast
- **Icon badges** with gradients and box-shadows
- **Smooth slide-in/out** with cubic-bezier physics animation
- **SVG close button** with hover state
- **Inner shadow** for premium depth

#### Tab Transitions
- **Fade + slide animation** when switching tabs (200ms ease-out)
- **Key-based re-render** ensures animation plays on every tab change

#### Contextual Help Tooltips
- **InfoTooltip** components added to simulation settings:
  - Drawdown Threshold explanation
  - Fat Tail Method differences  
  - Sampling Method (QMC) benefits
- **Glassmorphism tooltip design** matching app theme
- **Smart positioning** with arrow indicators

#### Animated Portfolio Value
- **Smooth counter animation** when value changes (600ms ease-out cubic)
- **Flash effect** - green glow on increase, red on decrease
- **Number formatting** with locale-aware separators

#### Enhanced Component Styling
- **Tabs**: Gradient inset background, cyan glow on active, status indicators
- **Cards**: Premium gradient backgrounds, subtle inner glow, enhanced shadows
- **Buttons**: Gradient fills, box-shadows, text-shadows, letter-spacing
- **Inputs**: Gradient backgrounds, inset shadows, smooth focus transitions
- **Delete buttons**: Styled danger state with background and border

#### New Components Library
| Component | Description |
|-----------|-------------|
| `Toast.jsx` | Premium toast with gradients, glows, progress bar |
| `AnimatedCounter.jsx` | Smooth number animations with flash effects |
| `Skeleton.jsx` | Loading placeholders (Table, Card, Chart, Stats) |
| `Tooltip.jsx` | Contextual tooltips (Info, Help, Warning variants) |
| `KeyboardShortcuts.jsx` | Beautiful modal with styled key badges |
| `ConfirmDialog.jsx` | Styled confirmation modals |
| `EmptyState.jsx` | Helpful empty state patterns |

#### Keyboard Shortcuts
- `1-7`: Switch tabs (with toast feedback)
- `⌘/Ctrl + L`: Load all market data
- `⌘/Ctrl + R`: Run simulation  
- `⌘/Ctrl + S`: Export portfolio
- `?`: Show shortcuts modal
- `Esc`: Close dialogs

#### All Toast Events
| Action | Type |
|--------|------|
| Data loaded | ✅ Success |
| Simulation complete | ✅ Success (paths/sec) |
| Optimization complete | ✅ Success |
| Factor analysis | ✅ Success |
| Correlation computed | ✅ Success |
| Matrix validated | ✅ Success |
| Correlation reset | ℹ️ Info |
| Portfolio exported | ✅ Success |
| PDF generated | ✅ Success |
| Cache cleared | ✅ Success |
| Tab switched | ℹ️ Info |
| Lag/Floor adjustments | ✅/ℹ️ |
| Import success/fail | ✅/❌ |

#### Input Improvements
- Preset buttons for paths (1K, 5K, 10K, 50K, 100K)
- Unit labels (paths, %)
- Better visual hierarchy

#### Empty States & Onboarding
- Welcome banner with 3-step guide
- Empty states with checklists
- Tab status indicators (green/orange dots)

#### Global Polish
- Focus rings for keyboard navigation
- Smooth hover transitions
- Button press effects
- Custom scrollbar styling
- Selection colors matching theme
- Text selection color matching theme
- Disabled state styling
- tr:hover highlighting for table rows
- Spin/shimmer/pulse/fadeIn animations

#### Footer Enhancement
- **Clickable keyboard shortcut hint** - click to open help modal
- Version updated to 6.1

#### New Components
- `Toast.jsx` - Redesigned toast with glassmorphism effect
- `KeyboardShortcuts.jsx` - Full keyboard shortcuts help modal
- `ConfirmDialog.jsx` - Styled modal confirmation dialogs
- `EmptyState.jsx` - Reusable empty state patterns
- `designTokens.js` - Centralized design system tokens

---

## [6.0.0] - 2026-01-24

### 🏗️ Major Architecture Refactoring

This release introduces a professional, scalable file architecture with comprehensive documentation.

#### New Documentation Structure

1. **ARCHITECTURE.md** - The Source of Truth
   - Complete system overview and navigation guide
   - Component hierarchy and data flow diagrams
   - Key concepts explained (positions, correlation, factors)
   - Quick reference tables for engineers/LLMs

2. **DATA_FLOW.md** - Data Flow Documentation
   - Visual diagrams for all major flows
   - Position data flow
   - Market data loading and caching
   - Correlation computation pipeline
   - Simulation execution flow
   - Factor analysis pipeline

3. **DEVELOPMENT.md** - Development Guide
   - Setup instructions
   - Code style guidelines
   - Adding new features
   - Testing guidelines
   - Performance considerations
   - Debugging tips

4. **COMPONENTS.md** - Component API Reference
   - Props documentation for all components
   - Usage examples
   - TypeScript-style interfaces

#### New File Organization

```
src/
├── components/           # React components by feature
│   ├── common/          # Shared UI (BlurInput, LoadingProgress, etc.)
│   ├── positions/       # Position management
│   ├── correlation/     # Correlation matrix
│   ├── factors/         # Factor analysis
│   ├── simulation/      # Monte Carlo simulation
│   └── optimization/    # Portfolio optimization
├── hooks/               # Custom React hooks
├── services/            # API clients
│   └── yahooFinance.js  # Yahoo Finance with CORS handling
├── utils/               # Pure utility functions
│   ├── distribution.js  # Distribution functions
│   ├── correlation.js   # Correlation utilities
│   ├── matrix.js        # Matrix operations
│   └── formatting.js    # Display formatting
└── constants/           # Configuration
    ├── factors.js       # Fama-French factor definitions
    ├── thematic.js      # Sector/thematic ETF mappings
    ├── storage.js       # LocalStorage configuration
    └── defaults.js      # Default values
```

#### Extracted Modules

1. **constants/factors.js** - Factor ETF definitions for Fama-French analysis
2. **constants/thematic.js** - Thematic/sector ETF mappings with overrides
3. **constants/storage.js** - LocalStorage keys and cache config
4. **constants/defaults.js** - Default values for positions, simulation, UI
5. **services/yahooFinance.js** - Complete Yahoo Finance API client
6. **utils/distribution.js** - Normal, Student-t, skewed distribution functions
7. **utils/correlation.js** - Correlation computation (sample, EWMA, regression)
8. **utils/matrix.js** - Cholesky, PSD fixes, matrix operations
9. **utils/formatting.js** - Currency, percent, date formatting

#### New Common Components

- `BlurInput` - Input that commits on blur
- `PercentileInput` - Percentage input with validation
- `PercentileSlider` - Preview-during-drag slider
- `LoadingProgress` - Animated progress bar
- `LoadingSpinner` - Inline spinner
- `LoadingOverlay` - Full loading overlay

#### Professional App Files

- Updated `README.md` with quick start and documentation links
- `CONTRIBUTING.md` with contribution guidelines
- Proper `package.json` with scripts
- Version bumped to 6.0.0

### Technical Notes

- **Backward Compatible**: No breaking changes to functionality
- **Storage Preserved**: Existing localStorage data still works
- **Gradual Migration**: App.jsx still contains main logic; hooks can be extracted incrementally
- **Documentation First**: ARCHITECTURE.md is now the entry point for understanding the codebase

---

## [5.7.0] - 2026-01-24

### New Features

1. **Factor Analysis Tab** 🧬
   - New "Factors" tab for portfolio factor decomposition
   - **Standard Factor Exposures**: Market (β), Size (SMB), Value (HML), Momentum (MOM)
   - **Correlation-Based Thematic Detection**: Automatically identifies concentrated exposures
   - Uses actual price behavior, not labels (solves the "KDEF labeled as semiconductors" problem)
   
2. **Thematic Concentration Detection**
   - Regresses each position against ~25 sector/thematic ETFs
   - Auto-detects best match based on R² (minimum 15% to qualify)
   - Includes: SOXX (Semis), ITA (Defense), XBI (Biotech), IGV (Software), etc.
   - Shows portfolio-level concentration with impact estimates
   - Example: "If SOXX drops 20% → ~7% portfolio impact"

3. **Factor ETF Universe**
   - Standard factors via ETF spreads: IWM-SPY (Size), IWD-IWF (Value), MTUM-SPY (Momentum)
   - Sector ETFs: XLK, XLF, XLE, XLV, XLI, XLY, XLP, XLU, XLRE, XLC, XLB
   - Thematic ETFs: SOXX, ITA, XBI, IGV, TAN, KWEB, ARKK, GDX, XHB, KRE, SMH
   - International: EEM, EFA, FXI, EWJ, EWZ

4. **Historical Return Attribution**
   - Decomposes returns into factor contributions
   - Shows: Factor Return × Your β = Contribution
   - Separate thematic attribution section

5. **Risk Decomposition**
   - Factor Risk (Systematic) vs Idiosyncratic Risk (Stock-Specific)
   - Based on weighted average R² across positions
   - Visual stacked bar showing risk split

6. **Position-Level Factor Loadings Table**
   - Per-position: β_MKT, Size, Value, Momentum, R², α (annualized)
   - Best thematic match with R² score
   - **User Override**: Dropdown to manually assign thematic ETF
   - Re-run analysis button when overrides are set

7. **Implementation Details**
   - Fetches ~25 ETFs in parallel for factor data
   - Computes factor spreads: SMB = IWM - SPY, HML = IWD - IWF, etc.
   - Simple OLS regression for factor betas
   - Uses same history timeline as correlation tab (6mo/1y/2y/3y)

---

## [5.6.2] - 2026-01-24

### New Features

1. **EWMA Recency-Weighted Correlations** 📊
   - Simple toggle in Correlation tab: "Recency Weighted"
   - **Now ON by default** (along with Ledoit-Wolf shrinkage)
   - When enabled, automatically scales half-life based on selected time period:
     - 6 months → 63-day half-life (~3 months)
     - 1 year → 126-day half-life (~6 months)
     - 2 years → 252-day half-life (~1 year)
     - 3 years → 378-day half-life (~1.5 years)
   - Half-life ≈ 1/2 of the history period
   - Older data contributes less to correlation estimates
   - **Also applies to timezone lag analysis** (±1 day lag correlations)
   - Useful when recent market regime differs from historical average

2. **New Default Settings**
   - Correlation Method: **Ledoit-Wolf Shrinkage** (was Sample)
   - Recency Weighted: **ON** (was OFF)
   - Rationale: More robust correlation estimates for typical portfolios

2. **How EWMA Works**
   - Weight at time t: `w_t = λ^(T-t)` where T is most recent
   - Lambda (λ) computed from half-life: `λ = exp(-ln(2)/half_life)`
   - Example for 1-year with 126-day half-life (λ ≈ 0.9945):
     - Today: weight = 1.0
     - 126 days ago (~6 mo): weight ≈ 0.5
     - 252 days ago (~1 yr): weight ≈ 0.25
   - Correlation = weighted covariance / (weighted σ₁ × weighted σ₂)

3. **EWMA Applied Consistently Across**
   - Correlation matrix calculation
   - Timezone lag analysis (±1 day)
   - Factor analysis (standard factors and thematic ETF detection)

4. **Factor Analysis Integration**
   - Factor ETFs (~25 tickers) now fetched as part of "🚀 Load All Data"
   - Correlation tab: "Compute Correlation" button now just computes (no fetch)
   - Factor tab: "Run Factor Analysis" button uses pre-loaded data
   - Single source of truth: all data comes from header's "Load All Data" button
   - Data status indicators show what's loaded before running analysis

5. **Lag-Adjusted Factor Analysis for International Stocks**
   - Both standard factor regression AND thematic detection now test lag -1, 0, +1
   - For international stocks (tickers with . but not .US), automatically finds best lag
   - Fixes BESI.AS, 6525.T, and other non-US stocks showing R²=0%
   - Shows ⏱-1d indicator in both R² column and theme match when lag adjustment used
   - Lowered thematic match threshold from 15% to 10% R² to catch more valid matches

6. **Date-Aligned Correlation for International Stocks** (CRITICAL FIX)
   - Discovered that index-based alignment was comparing different calendar dates
   - International stocks (BESI.AS, 6525.T) trade on different days than US ETFs
   - Now aligns returns by calendar date before computing correlations
   - Applied to BOTH thematic detection AND factor beta calculation
   - SMB, HML, MOM factors now properly computed for international stocks (were showing 0)
   - BESI.AS shows ~24% R² with SOXX (was 0% before)
   - 6525.T shows ~14% R² with SOXX at lag -1 (was 0% before)
   - Factor betas (β_MKT, Size, Value, Mom) now properly computed for international stocks

7. **Storage Optimization (90% reduction)**
   - Slimmed localStorage from ~5MB to ~700KB
   - Removed redundant fields: full OHLCV history, prices, logReturns, distribution
   - Now stores only: closePrices, timestamps, dailyReturns, computed metrics
   - Rehydration on load recomputes distribution and other derived fields on demand
   - Cache key updated to v6 (old caches will be refreshed)

8. **Load All Data Performance (~3x faster)**
   - Removed batch delays - all requests fire simultaneously
   - CORS proxies now race in parallel (Promise.any) instead of sequential fallback
   - Added third CORS proxy for more parallelism
   - History and profile fetches run concurrently 
   - Added 8s timeout to prevent slow proxies from blocking
   - Smart caching: cached tickers skip network entirely

---

## [5.6.1] - 2026-01-24

### Statistical Engine Improvements

1. **Full QMC Consistency for Multivariate-t** 🎯
   - Fixed chi-squared generation in QMC multivariate-t mode to use Sobol sequence
   - Added `inverseChiSquaredCDF` function using Wilson-Hilferty approximation
   - Sobol sequence now uses n+1 dimensions (extra dimension for chi-squared)
   - Eliminates mixing of deterministic QMC with pseudo-random Box-Muller
   - Ensures fully deterministic, reproducible multivariate-t simulations
   - Preserves low-discrepancy properties throughout entire simulation

2. **New QMC Generator Options**
   - `includeChiSquaredDim` option in `QMCCorrelatedNormalGenerator`
   - `nextWithChiSquared()` method returns both normals and chi-squared uniform
   - `multivariateTMode` option in `createQMCGenerator` factory function
   - Automatic dimension adjustment when multivariate-t is enabled

### Technical Details

The Wilson-Hilferty approximation for inverse chi-squared CDF:
- For X ~ χ²(df): X ≈ df × (1 - 2/(9df) + √(2/(9df)) × Φ⁻¹(u))³
- Accurate for df ≥ 2, single Sobol dimension instead of df dimensions
- Properly handles edge cases at distribution tails

---

## [5.6] - 2026-01-24

### UI/UX Improvements

1. **Global Actions Moved to Header** 🎯
   - "Load All Data", "Export", "Import", "Clear Cache", and "Reset" buttons now in header
   - Available from any tab without switching to Positions
   - Cleaner Positions tab with only position-specific actions remaining
   - Removed duplicate Portfolio Data card

2. **Loading Progress Bar** 📊
   - New animated progress bar appears below header when loading data
   - Shows current ticker / total tickers progress
   - Displays phase messages: "Fetching prices...", "Fetching profiles...", "Calculating betas..."
   - Smooth green gradient animation with pulsing indicator
   - Matches app's dark theme styling

3. **Improved Correlation Matrix Colors** 🎨
   - Simplified continuous color gradient: Purple → Blue → Green → Yellow → Orange → Red
   - Green now highlights zero correlation (excellent diversification)
   - Logical progression from hedging (cool colors) to concentration risk (warm colors)
   - Updated legend to match new color scale

---

## [5.5] - 2026-01-24

### New Features

1. **Timezone Lag Analysis for International Stocks** 🕐
   - New analysis tool in Correlation tab to detect timezone effects
   - Computes correlations at -1, 0, and +1 day lags
   - Identifies pairs where lagged correlation is significantly higher
   - Highlights Japanese stocks (e.g., 6525.T) and other international securities
   - "Apply Lag-Adjusted Correlations" button to fix underestimated correlations
   - Shows detailed table with all lags and improvement percentages
   - Custom styled scrollbar matching app theme

### Performance Optimizations

1. **Contribution Waterfall Chart Performance**
   - Memoized chart data computation (`contributionChartMemo`) to prevent recalculation on hover
   - Throttled hover handler (max 20 updates/sec) to reduce re-renders
   - Pre-computed ticker colors and sorted indices outside render cycle
   - Significantly improved responsiveness when hovering over the waterfall chart

2. **QMC Toggle Synchronized Across Tabs**
   - Added QMC checkbox to Optimization tab header (matches Simulation tab)
   - Both checkboxes control the same `useQmc` state - toggling one updates both
   - Optimization swap validation now uses QMC when enabled

3. **Optimization Results Persistence**
   - Optimization results now saved to localStorage and restored on page load
   - Top 10 swaps preserved (trimmed to reduce storage size)
   - Results persist across browser sessions

4. **Distributions Tab Search Filter**
   - Added "🔍 Filter by ticker..." search box to Distributions tab
   - Filters position list to show only matching tickers
   - Shows count of filtered results

### Bug Fixes

1. **Optimization Tab Stability**
   - Added validation for loaded optimization results from localStorage
   - Invalid/incomplete data is now cleared automatically
   - Added try-catch wrapper around optimization tab rendering
   - Shows error message with clear button if rendering fails
   - Added defensive null checks (`?.` and `|| []`) throughout optimization UI

2. **Lag Analysis Apply Button Fix**
   - Fixed issue where applied lag adjustments were being shrunk by aggressive PSD fix
   - Now uses gentle PSD adjustment (max 5 iterations at 2% shrinkage)
   - Preserves the actual lag-adjusted correlation values
   - Resets lag analysis state when changing history period or fetching new data
   - Added detailed console logging for debugging

### Technical Details

**Lag Analysis Algorithm:**
- For each pair (i, j), computes:
  - `corr(i_t, j_{t-1})` - j leads i by 1 day
  - `corr(i_t, j_t)` - same day (current approach)
  - `corr(i_t, j_{t+1})` - i leads j by 1 day
- Takes the maximum absolute correlation
- Flags pairs with >5% improvement as "significant"
- Tokyo market closes ~15 hours before NYSE, so US news affects next-day Japan returns

**PSD Fix Changes:**
- Original: Up to 50 iterations at 5% shrinkage (0.95^50 = 7.7% of original value!)
- New for lag adjustments: Max 5 iterations at 2% shrinkage (0.98^5 = 90.4% preserved)

**Other Technical Changes:**
- Added `contributionChartMemo` useMemo hook for chart data
- Added `handleContributionHover` with `useRef` for throttling
- Added `trimmedOptResults` to autosave effect
- New state: `lagAnalysis`, `isAnalyzingLag`, `useLagAdjusted`
- New functions: `runLagAnalysis`, `applyLagAdjustedCorrelations`

---

## [5.4] - 2026-01-24

### UI Improvements

1. **Simulation Tab: 2x2 Distribution Grid**
   - Reorganized into a clean 2x2 grid layout
   - Top Left: Terminal Return Distribution (1Y)
   - Top Right: Terminal Portfolio Value Distribution
   - Bottom Left: Max Drawdown Distribution (Estimated)
   - Bottom Right: **NEW** Loss Scenario Analysis (Monte Carlo)

2. **Loss Scenario Analysis (NEW)**
   - Deep dive into loss scenarios using actual Monte Carlo outputs
   - Shows: Loss count, Average Loss, Median Loss, Worst Case, P25 (Severe), CVaR 5%
   - Histogram of loss magnitude distribution
   - Only includes scenarios where returns are negative

3. **Correlation Matrix Color Scale**
   - New diversification-focused color scale
   - **Gold**: Near-zero correlation (±0.1) - excellent diversification
   - Cyan: Low positive (0.1-0.3) - good diversification
   - Yellow: Moderate (0.3-0.7)
   - Red: High correlation (>0.7) - concentration risk
   - Blue/Purple: Negative correlation - hedging value
   - Color legend added above the matrix

4. **Simulation Methodology Explainer**
   - Expandable "Show Simulation Methodology" button
   - Visual flow diagram: Inputs → Correlation → Cholesky → Sample → Transform → Returns
   - Detailed explanations of Ledoit-Wolf, Cholesky, MV-t, Copula, Skewness, QMC

5. **Quasi-Monte Carlo (QMC) Sampling (NEW)**
   - New "Quasi-MC (Sobol)" checkbox in Monte Carlo settings
   - Uses Halton sequence with inverse CDF for low-discrepancy sampling
   - Provides ~10× better convergence compared to pseudo-random sampling
   - Works with both Multivariate Student-t and Gaussian Copula methods
   - Status shown in methodology explainer (enabled/disabled)

---

## [5.3] - 2026-01-24

### Added: Portfolio Optimization Analysis Tab 🎯

**Major New Feature:** A comprehensive portfolio optimization analysis tab that identifies the best incremental trades to improve risk-adjusted returns.

**What's New:**

1. **Risk Decomposition Analysis**
   - Marginal Contribution to Risk (MCTR) per position
   - Percentage Risk Contribution showing which positions drive portfolio volatility
   - Incremental Sharpe Ratio (iSharpe) - identifies which positions help vs. hurt Sharpe
   - Risk Budget Optimality Ratio

2. **Swap Analysis (1% Trades)**
   - Full N×N swap matrix showing impact of every possible 1% trade
   - Analytical calculation of ΔSharpe, ΔVolatility, ΔReturn for each swap
   - Visual heatmap showing best/worst swaps at a glance

3. **Monte Carlo Validation**
   - Top 15 candidate swaps validated with 100,000 Monte Carlo paths each
   - Full metrics: Mean, Median, P(Loss), VaR 5%, CVaR 5%
   - Progress bar with ~1-2 minute total runtime for comprehensive analysis
   - Results sorted by Monte Carlo Sharpe improvement

4. **Risk Parity Target**
   - Computes risk parity weights (equal risk contribution per position)
   - Shows weight changes needed to achieve risk parity
   - Compares risk parity Sharpe vs. current portfolio

5. **Simulation Methodology Explainer** (NEW)
   - Expandable "Show Simulation Methodology" button in Monte Carlo Settings
   - Visual flow diagram: Inputs → Correlation → Cholesky → Sample → Transform → Returns
   - Detailed explanations of each step:
     - Ledoit-Wolf shrinkage for covariance estimation
     - Cholesky decomposition for correlation structure
     - Multivariate Student-t OR Gaussian Copula sampling
     - Skewness transformation
     - Return generation formula
   - Note about Quasi-Monte Carlo (Sobol) option

**Mathematical Framework:**

```
Marginal Contribution to Risk:
  MCTR_i = (Σw)_i / σ_p = σ_i × ρ_{i,p}

Incremental Sharpe Ratio:
  iSharpe_i = S_i - ρ_{i,p} × S_p
  (If positive: adding to position improves portfolio Sharpe)

Risk Budget Optimality:
  Optimality_i = (E[R_i] - R_f) / MCTR_i
  (Optimal when equal for all assets)

Risk Parity Weights:
  Iteratively adjust w_i until w_i × MCTR_i is equal for all i
```

**Covariance Matrix Consistency:**
All optimization calculations use the same covariance matrix as the main simulation:
- Built from `editedCorrelation` matrix and per-asset volatilities
- Accounts for leverage ratio (gross/NAV adjustment)
- Cash contribution added to return calculations
- Ensures MCTR, iSharpe, swap impacts are all mathematically consistent

**Key Insight from Research:**
A low-Sharpe asset can still be accretive to portfolio Sharpe if it has low correlation with the existing portfolio. The iSharpe metric captures this diversification benefit.

**Usage:**
1. Go to "🎯 Optimize" tab (between Simulation and Export)
2. Ensure correlation matrix is computed (Correlation tab)
3. Set risk-free rate (default 5%)
4. Click "Run Optimization Analysis"
5. Review recommendations and Monte Carlo validation

**References:**
- Benhamou, E. & Guez, B. (2021). "Computation of the marginal contribution of Sharpe ratio"
- Maillard, S., Roncalli, T., Teiletche, J. (2010). "The properties of equally weighted risk contribution portfolios"
- Northstar Risk. "Incremental Sharpe"

---

## [5.2] - 2026-01-24

### Added: Quasi-Monte Carlo Integration

**Based on:** Joy, Boyle & Tan (1996) "Quasi-Monte Carlo Methods in Numerical Finance"

**What's New:**
Added Quasi-Monte Carlo (QMC) methods using low-discrepancy Sobol sequences as an alternative to pseudo-random Monte Carlo simulation.

**Key Benefits:**
| Aspect | Standard MC | Quasi-MC |
|--------|-------------|----------|
| Convergence | O(N^-1/2) | O(N^-1 × log(N)^s) |
| Error Bound | Probabilistic | Deterministic |
| Reproducibility | Varies per run | Identical results |
| Accuracy at 10K paths | ~1% | ~0.1% |

**New Files:**
- `src/utils/quasiMonteCarlo.js` - Complete QMC implementation
  - `SobolSequence` - 21-dimensional Sobol sequence generator
  - `HaltonSequence` - Alternative low-discrepancy sequence
  - `QMCCorrelatedNormalGenerator` - QMC + Cholesky integration
  - `generateQMCReturns()` - QMC correlated return generation
  - `generateQMCMultivariateTReturns()` - QMC with fat tails
- `src/workers/qmcSimulationWorker.js` - QMC-enabled web worker

**Critical Implementation Note (from paper's End Note 6):**
> Box-Muller transform MUST NOT be used with QMC as it destroys the low-discrepancy structure.

The implementation correctly uses `inverseNormalCDF()` to transform Sobol uniform points to standard normals, preserving the space-filling properties.

**Usage:**
```javascript
import { createQMCGenerator, generateQMCReturns } from './utils/quasiMonteCarlo';

// Create generator with correlation matrix
const qmcGen = createQMCGenerator(correlationMatrix, { skip: 1023 });

// Generate correlated returns
const returns = generateQMCReturns(qmcGen, mus, sigmas, skews, dfs);
```

**Worker Usage:**
```javascript
worker.postMessage({
  type: 'runBatch',
  params: {
    ...simulationParams,
    simulationMethod: 'qmc'  // or 'qmc-mvt' for multivariate-t
  }
});
```

**Compatibility:**
QMC integrates seamlessly with existing covariance matrix infrastructure:
- ✅ Ledoit-Wolf shrinkage estimation
- ✅ Cholesky decomposition for correlations
- ✅ Multivariate Student-t for fat tails
- ✅ Importance sampling for VaR

---

## [5.1] - 2026-01-23

### Completed: Parallel API Fetching (Phase 4)

**What Changed:**
The `fetchAndComputeCorrelation` function now fetches historical data for all tickers in parallel batches.

**Before (Sequential):**
```javascript
for (const ticker of tickers) {
  const yahooData = await fetchYahooHistory(ticker, range, '1d'); // One at a time!
}
```

**After (Parallel Batches):**
```javascript
const BATCH_SIZE = 4;
for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
  const batch = tickers.slice(i, i + BATCH_SIZE);
  const batchPromises = batch.map(ticker => fetchYahooHistory(ticker, range, '1d'));
  const results = await Promise.allSettled(batchPromises); // 4 at once!
}
```

**Performance Impact:**
| Portfolio Size | Before | After | Speedup |
|----------------|--------|-------|---------|
| 5 tickers | ~5 sec | ~1.5 sec | ~3x |
| 10 tickers | ~10 sec | ~3 sec | ~3x |
| 20 tickers | ~20 sec | ~5 sec | ~4x |

**Additional Optimizations:**
- Batched `setPositions` calls - instead of updating state for each ticker's volatility individually, we collect all updates and apply them in a single state update
- Added console logging: "📊 Fetching historical data..." and "✅ Fetched X tickers in Yms"

**All Parallelization Complete:**
| Component | Status |
|-----------|--------|
| Monte Carlo simulation | ✅ Web Workers (v5.0) |
| Calendar year returns | ✅ Promise.allSettled (v4.8) |
| Historical correlation data | ✅ Promise.allSettled (v5.1) |

---

## [5.0] - 2026-01-23

### Major Feature: Web Worker Parallel Simulation (3-4x faster on multi-core)

**What Changed:**
The Monte Carlo simulation now runs in parallel across multiple CPU cores using Web Workers.

**How It Works:**
1. Detects available CPU cores via `navigator.hardwareConcurrency`
2. Creates up to 8 Web Workers (one per core)
3. Splits simulation paths evenly across workers
4. Each worker runs its batch independently
5. Results are combined after all workers complete

**Implementation Details:**
```javascript
// Determine workers
const numWorkers = Math.min(8, navigator.hardwareConcurrency || 4);
const pathsPerWorker = Math.ceil(paths / numWorkers);

// Create inline worker with simulation code
const workerCode = `...simulation logic...`;
const blob = new Blob([workerCode], { type: 'application/javascript' });
const workerUrl = URL.createObjectURL(blob);

// Run in parallel
const workerPromises = workers.map(w => 
  new Promise((resolve) => {
    const worker = new Worker(workerUrl);
    worker.onmessage = (e) => resolve(e.data);
    worker.postMessage({ numPaths: batchSize, ...params });
  })
);

const results = await Promise.all(workerPromises);
```

**Performance Gains:**
| CPU Cores | Expected Speedup |
|-----------|-----------------|
| 2 cores | ~1.8x faster |
| 4 cores | ~3.2x faster |
| 8 cores | ~5-6x faster |
| 16 cores | ~6-7x faster (diminishing returns) |

**Fallback:**
If Web Workers fail or aren't available, automatically falls back to optimized single-threaded simulation from v4.9.

**Console Output:**
```
🚀 Starting parallel simulation: 10,000 paths across 8 workers
✅ Parallel simulation complete: 8 workers finished
✅ Simulation complete: 10,000 paths in 245ms (40,816 paths/sec)
```

### Removed Dead Code
- Removed `pathContributions` array and `sortedPaths` variable
- These were unused since v4.6's switch to analytical contribution calculation
- Reduces memory allocation in simulation loop

---

## [4.9] - 2026-01-23

### Performance Optimization - Major Speedup (~50%+ faster)

**Critical Bug Fixed:**
Portfolio volatility (`annualVol`) was being recalculated INSIDE the main simulation loop (lines 2557-2568). This was O(n²) computation happening 10,000 times when it should only happen ONCE (the value is constant across all paths!).

```javascript
// BEFORE (BUG): Inside loop - O(n²) × 10,000 = massive waste
for (let path = 0; path < paths; path++) {
  // ... simulation code ...
  let annualVol = 0;
  for (let i = 0; i < weights.length; i++) {
    for (let j = 0; j < weights.length; j++) {
      annualVol += wi * wj * corr * sigmaI * sigmaJ;
    }
  }
}

// AFTER (FIXED): Outside loop - O(n²) × 1
let precomputedAnnualVol = 0;
for (let i = 0; i < weights.length; i++) { ... }
// Then use precomputedAnnualVol in loop
```

**TypedArrays for Numeric Data:**
- Replaced regular arrays with `Float64Array` for terminalReturns, maxDrawdowns
- Pre-allocated and reused temp arrays (z, correlatedZ, assetReturns)
- Flattened Cholesky matrix for faster memory access

**Parallel API Fetching:**
- Calendar year returns now fetched in parallel batches
- 3 concurrent requests per batch with rate limiting
- ~3-4x faster data loading for portfolios with many positions

**Performance Timing:**
- Added `console.log` showing simulation speed (paths/second)
- Results object includes `simulationTime` field

**Expected Improvements:**
- 5-position portfolio: ~50% faster
- 10-position portfolio: ~60% faster (more benefit from bug fix)
- API fetching: ~3x faster

---

## [4.8] - 2026-01-23

### Fixed - Calendar Year Returns Fetching (Simplified)
**Problem:** v4.7's monthly interval approach was still inefficient and potentially inaccurate for calendar year returns.

**Solution:** Fetch only the specific dates needed - a small window around January 1st for each year boundary (2023, 2024, 2025, 2026).

**Implementation:**
```javascript
// For each year, fetch Dec 28 - Jan 5 window
const period1 = Dec28_timestamp;
const period2 = Jan6_timestamp;
const url = `...?period1=${period1}&period2=${period2}&interval=1d`;
```

**Benefits:**
- Only ~5-8 data points per year boundary instead of 36 monthly or 1250 daily
- Accurate Jan-to-Jan returns (first trading day of each year)
- 4 small API calls per ticker instead of 1 large call

**Calculation:**
- 2023 return = (Jan 2024 price - Jan 2023 price) / Jan 2023 price
- 2024 return = (Jan 2025 price - Jan 2024 price) / Jan 2024 price
- 2025 return = (Jan 2026 price - Jan 2025 price) / Jan 2025 price

---

## [4.7] - 2026-01-23

### Optimized - Calendar Year Returns Fetching
**Problem:** Fetching 5 years of daily data (~1250 data points per ticker) was slow and inefficient when we only need year-end prices.

**Solution:** Switched to monthly interval (`interval=1mo&range=3y`) which returns ~36 data points instead of ~1250. This is 97% less data while still providing accurate Dec-to-Dec returns.

**Implementation:**
- Uses December month-end prices for year boundaries
- For current year (2025), uses most recent available month
- Reduced API delay from 200ms to 150ms per ticker

### Fixed - Probability Y-Axis Label Position
**Problem:** "Probability" label on distribution charts was positioned at the top, misaligned with the chart area.

**Solution:** Changed from `offset: 10` to `dy: 30` to move label down and center it vertically with the chart.

---

## [4.6] - 2026-01-23

### Fixed - Analytical Contribution Attribution
**Problem:** Short position contributions showed incorrect values across percentiles. ORCL short showed -28% at P50 but only -5% at P95, when logically it should be MORE negative at P95 (markets up = short loses more).

**Root Cause:** Sorting paths by total portfolio return created selection bias. At P95, we inadvertently selected paths where ORCL happened to go DOWN (helping portfolio total), even though statistically ORCL should be UP when markets rally.

**Solution:** Replaced Monte Carlo path sampling with analytical conditional expectation:
```
E[r_i | r_portfolio = P_k] = μ_i + β_i × (r_portfolio - E[r_portfolio])
```
Where β_i = Cov(r_i, r_portfolio) / Var(r_portfolio).

This respects the correlation structure properly - short positions now show progressively more negative contributions as portfolio outcomes improve.

---

## [4.5] - 2026-01-23

### Attempted Fix - Window Averaging for Contributions
- Tried averaging contributions across 2% of paths around each percentile
- Did not fully solve the selection bias problem for short positions
- Superseded by v4.6's analytical approach

---

## [4.4] - 2026-01-23

### Added - PDF Report Export
**Feature:** Professional multi-page PDF report generation matching the app's dark theme.

**Pages:**
1. **Cover Page** - Portfolio value, parameters summary, results preview
2. **Portfolio Positions** - Full positions table, exposure summary (long/short/gross/net)
3. **Return Distributions** - All securities with P5/P50/P95, derived μ and σ
4. **Correlation Matrix** - Full matrix with color-coded values
5. **Simulation Results** - Terminal returns, dollar projections, drawdown risk, loss probabilities, contribution analysis

**Implementation:**
- Added jsPDF and jspdf-autotable dependencies
- Dark background (#0a0a15) matching app theme
- Cyan (#00d4ff) headers and accents
- Color-coded values (green positive, red negative)

**UI Changes:**
- Redesigned Export tab with prominent "Generate PDF Report" button
- Added report contents preview cards
- Kept JSON export as secondary option

---

## [4.3] - 2026-01-23

### Fixed - Percentile Reference Lines Visibility
**Problem:** P5/P25/P50/P75/P95 vertical lines disappeared from distribution charts after v4.2 XAxis changes.

**Solution:**
- Added explicit domain calculation: `[Math.min(p5, mu-3.5σ)-5, Math.max(p95, mu+3.5σ)+5]`
- Added `ifOverflow="extendDomain"` to all ReferenceLine components
- Updated `generateDistributionPreview` to accept all 5 percentiles for range calculation

---

## [4.2] - 2026-01-23

### Fixed - X-Axis Tick Marks
**Problem:** X-axis tick labels disappeared after v4.1 domain changes.

**Solution:** Changed domain to `['dataMin', 'dataMax']` with `tickCount={7}`.

### Improved - Simulation Persistence
**Problem:** Large distribution arrays (10,000 values) exceeded localStorage limits (~5MB), causing silent save failures.

**Solutions:**
1. Added `trimDistribution()` function to sample arrays down to max 1,000 points while preserving distribution shape
2. Added fallback: if quota exceeded, retry saving without distributions
3. Added console logging for debugging storage operations
4. Added "cached results" indicator showing when results loaded from storage

---

## [4.1] - 2026-01-23

### Fixed - Percentile Lines Not Visible
**Problem:** Reference lines for P5/P25/P50/P75/P95 were outside the chart's visible domain.

**Solution:**
- Modified `generateDistributionPreview` to extend data range to include all percentiles
- Increased chart height from 140px to 160px
- Made P5/P50/P95 labels bold and larger (10px vs 9px)

---

## [4.0] - 2026-01-23

### Added - Distribution Chart Improvements
- **Labeled Vertical Reference Lines:** P5, P25, P50, P75, P95 shown as dashed vertical lines with colored labels
- Color-coded: P5 (red), P25 (orange), P50 (white), P75 (light green), P95 (green)

### Added - Dynamic Slider Ranges
**Problem:** Fixed -100% to +500% range made sliders hard to use.

**Solution:** Adaptive bounds based on current percentile values:
| Slider | Min Bound | Max Bound |
|--------|-----------|-----------|
| P5 | -80% | max(-10%, P25-1%) |
| P25 | min(-50%, P5+1%) | max(30%, P50-1%) |
| P50 | min(-20%, P25+1%) | max(60%, P75-1%) |
| P75 | min(0%, P50+1%) | max(100%, P95-1%) |
| P95 | min(20%, P75+1%) | max(150%, P95+50%) |

### Removed
- Redundant P5/P25/P50/P75/P95 text labels below charts

---

## [3.9] - 2026-01-23

### Added - Calendar Year Returns
**Feature:** Fetch actual historical calendar year performance (2023, 2024, 2025 YTD).

**Implementation:**
- "📅 Fetch Year Returns" button in Distributions tab
- Fetches 5 years of daily data from Yahoo Finance
- Groups by calendar year, calculates first-to-last price returns
- For partial years (2025), calculates YTD from Dec 31 of prior year
- Displayed per security: "Actual: 2025: +19% | 2024: +62% | 2023: +28%"
- Saved to localStorage with key `calendarYearReturns`

### Added - Persistent Simulation Results
- Simulation results now saved to localStorage after each run
- Restored automatically on page reload
- No need to re-run simulation after refresh

---

## [3.8] - 2026-01-23

### Changed - Net Exposure Percentages
**Before:** Position percentages relative to total long or total short.
**After:** All percentages relative to net exposure (liquidation value).

```javascript
// Before
const pct = totalLong > 0 ? (p.value / totalLong) * 100 : 0;

// After  
const pctOfNet = (p.value / netExposure) * 100;
```

### Added - Summary Stats Ratios
Each exposure metric now shows both absolute dollars AND percentage of net:
- Gross Long: `$500,000` / `160% of net`
- Gross Short: `$200,000` / `64% of net`
- Gross Exposure: `$700,000` / `224% of net`
- Net Exposure: `$312,500` / `100% (base)`

---

## [3.7] - 2026-01-23

### Added - Separate Distributions Tab
**New Tab Structure:**
1. 📊 Positions
2. 📈 Distributions (NEW)
3. 🔗 Correlation
4. 🎲 Simulation
5. 📄 Export

### Added - Exposure Charts (Positions Tab)
- **Long Positions Chart:** Each long position with value and % of net exposure
- **Short Positions Chart:** Each short position with value and % of net exposure
- **Summary Stats:** Gross Long, Gross Short, Gross Exposure, Net Exposure

### Added - Return Rankings (Distributions Tab)
Three horizontal bar charts at bottom of Distributions tab:
- **P5 (Bad Year):** Securities ranked by worst-case return
- **P50 (Median):** Securities ranked by expected median return
- **P95 (Great Year):** Securities ranked by best-case return

---

## [3.6] - 2026-01-23

### Added - Persistent Legend
- Legend stays on last hovered scenario instead of resetting
- Defaults to P50 (Median) on first load
- Removed "Hover to see breakdown" text

### Added - Styled Vertical Scrollbar
- Legend panel scrollbar matches horizontal scrollbar styling
- Purple-to-cyan gradient thumb with hover effect

### Improved - Performance Optimizations
- Memoized histogram data with `useMemo`
- Pre-computed chart data for contribution waterfall
- Added `useCallback` for histogram generation functions
- Removed redundant calculations in render loops

---

## [3.5] - 2026-01-23

### Fixed - Contribution Calculation Accuracy
- Fixed incorrect contribution values in waterfall chart
- Ensured contributions sum to total portfolio return

---

## [3.4] - 2026-01-23

### Added - Multi-Currency Support
- Automatic currency detection from Yahoo Finance
- Real-time USD conversion using forex rates
- Currency badge displayed per position (USD, GBP, EUR, JPY, etc.)
- All values normalized to USD for simulation

---

## [3.3] - 2026-01-23

### Added - Stacked Contribution Waterfall Chart
- Visual waterfall showing each position's contribution to portfolio return
- Positive contributions stacked above zero
- Negative contributions stacked below zero
- Hover to see breakdown at different percentiles

---

## [3.2] - 2026-01-23

### Added - Real-Time Slider Preview
- Distribution chart updates in real-time as sliders are dragged
- No lag when adjusting P5/P25/P50/P75/P95 values

---

## [3.1] - 2026-01-23

### Added - Portfolio Correlation Summary
- Overview showing weighted average correlation
- Correlation contribution by position
- Visual indicator of diversification benefit

### Added - Persistent Industry Groupings
- Industry/sector assignments saved to localStorage
- Survives page reloads

---

## [3.0] - 2026-01-23

### Added - Blur-Update Pattern
**Problem:** Slider lag when updating values due to re-renders.

**Solution:** BlurInput component that only triggers state updates on blur, not on every keystroke.

### Changed - Weight Calculation
- Changed from gross exposure to net portfolio value basis
- More intuitive for portfolios with shorts

### Added - Click-to-Edit Correlation Cells
- Click any correlation cell to edit directly
- Automatic symmetric matrix updates

### Added - Company Names
- Fetched from Yahoo Finance alongside price
- Displayed in positions table

### Removed - Number Input Spinners
- Cleaner UI without browser default spinners

---

## [2.8] - 2026-01-23

### Added - Expanded Slider Ranges
- P5: -100% to 0%
- P50: -20% to +60%
- P95: +20% to +500%
- Dynamic constraint labels showing valid ranges

---

## [2.7] - 2026-01-23

### Added - Terminal Dollar Value Distribution
- New chart showing dollar outcomes (not just percentages)
- Starting value → P5/P50/P95 terminal values

### Changed - Chart Y-Axes to Percentage Odds
- All distribution charts now show "% of simulations" on Y-axis

### Added - History Timeline Selector
- Choose 6mo, 1yr, or 2yr of historical data for estimation

---

## [2.6] - 2026-01-23

### Fixed - Correlation Groups with Duplicate Tickers
- Position ID tracking instead of ticker-based
- Handles multiple positions in same security

---

## [2.5] - 2026-01-23

### Added - Beta/Torque Matrix View
- Toggle between correlation and beta views
- Shows sensitivity of each position to portfolio

---

## [2.4] - 2026-01-23

### Added - Styled UI Scrollbars
- Custom purple-to-cyan gradient scrollbars
- Consistent dark theme styling

---

## [2.3] - 2026-01-23

### Added - Automatic Sector/Industry Detection
- Fetches sector and industry from Yahoo Finance
- Editable correlation groups based on sector

---

## [2.2] - 2026-01-23

### Added - Return Attribution Table
- Shows each position's contribution at P5/P25/P50/P75/P95
- Sorted by P50 contribution
- Color-coded positive (green) vs negative (red)

---

## [2.1] - 2026-01-23

### Fixed - NaN Errors with Comprehensive Safeguards
- Added isFinite checks throughout simulation
- Capped extreme values to prevent overflow
- Default fallbacks for missing data

---

## [2.0] - 2026-01-23

### Added - Cash/Margin Positions
- Explicit cash balance input
- Margin cost rate for leveraged portfolios
- Cash contributes deterministic return to simulation

### Added - Historical Distribution Estimation
- "Estimate from History" button per security
- Bootstrap sampling from Yahoo Finance returns
- Estimates P5/P25/P50/P75/P95 from historical data

---

## [1.9] - 2026-01-23

### Fixed - NaN Errors with Short Positions
- Weight calculation fixes for negative quantities
- Leverage ratio implementation
- Proper handling of portfolios with shorts + margin

---

## [1.8] - 2026-01-23

### Changed - Percentile-Based Input (Major Refactor)
**Before:** Abstract parameters (μ, σ, skew, tailDf)
**After:** Intuitive percentiles (P5, P25, P50, P75, P95)

Users now input:
- P5: "In a bad year, this stock might return X%"
- P50: "In a typical year, I expect X%"
- P95: "In a great year, this could return X%"

System derives μ, σ, skew, and tail heaviness from these inputs.

---

## [1.7] - 2026-01-23

### Added - Data Persistence
- Export portfolio to JSON file
- Import portfolio from JSON file
- LocalStorage auto-save

---

## [1.6] - 2026-01-23

### Fixed - Critical Simulation Bug
**Problem:** Skew transform caused phantom returns - positions showing 20%+ returns even with conservative inputs.

**Root Cause:** Daily compounding of skewed returns accumulated unrealistic gains.

**Solution:** Switched from 252-step daily compounding to point-to-point annual returns.

### Added - Yahoo Finance Integration
- Live price fetching
- CORS proxy handling (allorigins, corsproxy.io)

---

## [1.5] - 2026-01-23

### Added - Full-Width Distribution Charts
- Charts span full width of panel
- Labeled axes (Return %, Probability)

---

## [1.4] - 2026-01-23

### Added - Real-Time Distribution Preview
- Visual PDF curve showing expected return distribution
- Updates as parameters change

---

## [1.3] - 2026-01-23

### Changed - Correlation Matrix Input
**Before:** Covariance matrix (confusing units)
**After:** Correlation matrix (-1 to +1, intuitive)

### Fixed - Sample Paths Visualization Bug
- Paths now display correctly in simulation results

---

## [1.0] - 2026-01-23

### Initial Release
**Core Features:**
- Monte Carlo portfolio simulation
- Correlated asset returns using Cholesky decomposition
- Skewed t-distribution modeling
- Configurable number of simulation paths
- Terminal return distribution (P5, P25, P50, P75, P95)
- Maximum drawdown estimation
- Loss probability calculations

**UI:**
- Dark theme with gradient background
- Tab-based navigation
- Responsive design
- Interactive sliders and inputs

---

## Architecture Notes

### State Management
- React useState for all state
- localStorage for persistence
- No external state library (Redux, Zustand)

### Key Data Structures
```javascript
// Position
{
  id: number,
  ticker: string,
  quantity: number,
  price: number,
  currency: string,
  p5: number,   // -0.25 = -25%
  p25: number,
  p50: number,
  p75: number,
  p95: number,
}

// Simulation Results
{
  terminal: { p5, p10, p25, p50, p75, p90, p95, mean, distribution },
  terminalDollars: { ... },
  drawdown: { p50, p75, p90, p95, p99, distribution },
  probLoss: { prob10, prob20, prob30, probCustom },
  contributions: { tickers, p5, p25, p50, p75, p95, mean },
}
```

### Mathematical Models
- **Return Generation:** Skewed t-distribution with configurable degrees of freedom
- **Correlation:** Cholesky decomposition of correlation matrix
- **Contribution Attribution:** Conditional expectation E[r_i | r_portfolio]

---

## Future Considerations

### Potential Improvements
1. Split App.jsx into smaller components
2. Add unit tests for simulation logic
3. Add scenario analysis (stress testing)
4. Multi-period simulation (rebalancing)
5. Factor model integration
6. Options/derivatives support

### Known Limitations
1. Single file architecture (App.jsx ~6000 lines)
2. No server-side persistence
3. Yahoo Finance CORS requires proxy
4. PDF export requires npm install (jsPDF)
