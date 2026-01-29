# Monte Carlo App - Phase 2 Refactoring Plan

**Date:** January 29, 2026  
**Status:** Ready for Implementation  
**Estimated Effort:** 12-16 hours over 3-4 days  
**Risk Level:** Medium (large refactor, well-structured approach)

---

## Executive Summary

App.jsx currently stands at **8,414 lines** with **42 useState hooks**, making it unmaintainable. This plan extracts the monolith into:
- **4 React Contexts** (state containers)
- **5 Custom Hooks** (data fetching/computation logic)
- **~600 lines** of pure utilities
- **1 AppContainer** (coordination layer)

The goal: App.jsx drops to ~500 lines, just rendering and wiring.

---

## 1. New File Structure

### Directory Layout
```
src/
├── App.jsx                    # Slim coordinator (~500 lines)
├── AppContainer.jsx           # Optional: wrap with providers (NEW)
├── contexts/                  # NEW - State management
│   ├── index.js
│   ├── MarketDataContext.jsx
│   ├── PortfolioContext.jsx
│   ├── SimulationContext.jsx
│   └── UIContext.jsx
├── hooks/                     # EXPAND - Custom hooks
│   ├── index.js               # Re-export all
│   ├── useAutosave.js         # (exists)
│   ├── useChartInteraction.js # (exists)
│   ├── useLocalStorage.js     # (exists)
│   ├── useUndoRedo.js         # (exists)
│   ├── useMarketData.js       # NEW - fetchUnifiedMarketData logic
│   ├── useCorrelation.js      # NEW - correlation computation
│   ├── useFactorAnalysis.js   # NEW - factor beta computation
│   ├── useSimulation.js       # NEW - Monte Carlo engine
│   └── useOptimization.js     # NEW - portfolio optimization
├── utils/                     # EXPAND - Pure functions
│   ├── index.js
│   ├── statistics.js          # (exists)
│   ├── matrix.js              # (exists)
│   ├── yahooFinance.js        # (exists) - needs expansion
│   ├── marketDataHelpers.js   # NEW - ticker processing, date alignment
│   ├── factorDefinitions.js   # NEW - ETF constants, factor spreads
│   └── distributionParams.js  # NEW - percentile/param conversions
├── services/                  # NEW - API layer
│   ├── index.js
│   ├── yahooFinance.js        # (move from utils, expand)
│   └── cacheManager.js        # NEW - localStorage cache logic
├── components/
│   ├── common/                # (exists)
│   └── tabs/                  # (exists - 8 tab components)
└── styles/                    # (exists)
```

### Files to Create

| File | Lines Est. | Purpose |
|------|------------|---------|
| `contexts/MarketDataContext.jsx` | ~150 | Unified market data, factor data, position metadata |
| `contexts/PortfolioContext.jsx` | ~120 | Positions, cash balance, weights, undo/redo |
| `contexts/SimulationContext.jsx` | ~100 | Simulation results, settings (paths, fat-tail, QMC) |
| `contexts/UIContext.jsx` | ~80 | Active tab, modals, loading states, sidebar |
| `hooks/useMarketData.js` | ~400 | fetchUnifiedMarketData logic |
| `hooks/useCorrelation.js` | ~350 | fetchAndComputeCorrelation, lag analysis |
| `hooks/useFactorAnalysis.js` | ~300 | runFactorAnalysis, computeFactorBetas |
| `hooks/useSimulation.js` | ~350 | runSimulation Monte Carlo engine |
| `hooks/useOptimization.js` | ~250 | runPortfolioOptimization |
| `utils/marketDataHelpers.js` | ~200 | Date alignment, return computation, ticker processing |
| `utils/factorDefinitions.js` | ~150 | FACTOR_SPREAD_DEFINITIONS, THEMATIC_ETFS |
| `utils/distributionParams.js` | ~100 | getPercentilesFromParams, getParamsFromPercentiles |
| `services/cacheManager.js` | ~80 | UNIFIED_CACHE_KEY, save/load/validate |

---

## 2. State Migration Map

### MarketDataContext
Holds all fetched market data - the "truth" about prices and metadata.

```javascript
// State variables to migrate:
const MarketDataState = {
  unifiedMarketData: {},        // Line 2086 - Main data store
  positionMetadata: {},         // Line 1873 - Sector/industry info
  positionBetas: {},            // Line 1996 - Beta vs SPY
  factorData: null,             // Line 1883 - Factor ETF returns
  lagAnalysis: null,            // Line 1878 - Timezone lag data
  
  // Loading flags
  isFetchingUnified: false,     // Line 2087
  isFetchingMetadata: false,    // Line 1874
  isFetchingBetas: false,       // Line 1997
  isFetchingFactors: false,     // Line 1885
  isAnalyzingLag: false,        // Line 1879
  
  // Progress/errors
  unifiedFetchProgress: {},     // Line 2088
  fetchErrors: [],              // Line 1865
  dataSource: 'none',           // Line 1864
};
```

### PortfolioContext
Holds positions and derived values.

```javascript
const PortfolioState = {
  positions: [],                // Line 1742 - Array of position objects
  cashBalance: 0,               // Line 1858
  cashRate: 0.05,               // Line 1859
  
  // Derived (could be computed in context)
  // portfolioValue, weights, netPositionsValue computed via useMemo
  
  // Undo/Redo managed internally
  canUndo: false,
  canRedo: false,
};
```

### SimulationContext
Holds simulation configuration and results.

```javascript
const SimulationState = {
  // Configuration
  numPaths: 10000,              // Line 1844
  fatTailMethod: 'multivariateTStudent', // Line 1852
  useQmc: false,                // Line 1853
  drawdownThreshold: 20,        // Line 1855
  
  // Correlation inputs
  correlationMatrix: null,      // Line 1840
  editedCorrelation: null,      // Line 1841
  correlationMethod: 'shrinkage', // Line 1847
  useEwma: true,                // Line 1851
  useLagAdjusted: false,        // Line 1880
  historyTimeline: '1y',        // Line 1866
  
  // Results
  simulationResults: null,      // Line 1842
  previousSimulationResults: null, // Line 1843
  isSimulating: false,          // Line 1845
  
  // Factor analysis results
  factorAnalysis: null,         // Line 1884
  thematicOverrides: {},        // Line 1886
};
```

### UIContext
Holds all UI state - modals, tabs, loading indicators.

```javascript
const UIState = {
  // Navigation
  activeTab: 'positions',       // Line 1834
  sidebarExpanded: true,        // Line 1835
  windowWidth: 1920,            // Line 1839
  
  // Modals
  showWelcome: false,           // Line 2041
  showKeyboardShortcuts: false, // Line 2069
  showUserGuide: false,         // Line 2072
  showAddPositionsModal: false, // Line 2075
  showScreenshotImportModal: false, // Line 2078
  showCommandPalette: false,    // Line 2081
  showRecoveryDialog: false,    // Line 2084
  confirmDialog: null,          // Line 2038
  
  // Full load orchestration
  isFullLoading: false,         // Line 2025
  fullLoadProgress: {},         // Line 2026
  
  // View modes
  matrixViewMode: 'correlation', // Line 1889
  positionSort: {},             // Line 1991
  positionFilter: 'all',        // Line 1992
  positionSearch: '',           // Line 1993
  
  // Optimization UI
  selectedSwap: null,           // Line 2016
  swapValidationResults: null,  // Line 2017
  optimizationResults: null,    // Line 2013
  isOptimizing: false,          // Line 2014
  optimizationProgress: {},     // Line 2015
  
  // Autosave
  autosaveStatus: 'idle',       // Line 2089
  lastSaved: null,              // Line 2090
};
```

---

## 3. Extraction Order (Dependencies Matter!)

### Phase 2.1: Pure Utilities (Zero Dependencies)
**Effort: 1-2 hours | Risk: Very Low**

Extract these first - they're pure functions with no React deps:

1. **`utils/factorDefinitions.js`**
   - Move: `STANDARD_FACTOR_ETFS`, `FACTOR_SPREAD_DEFINITIONS`, `THEMATIC_ETFS`, `ALL_FACTOR_ETFS` (Lines 109-161)
   - Why first: No deps, imported by multiple functions

2. **`utils/distributionParams.js`**
   - Move: `getPercentilesFromParams`, `getParamsFromPercentiles` (Lines 793-840)
   - Move: `PercentileInput`, `BlurInput`, `PercentileSlider`, `PercentileEditor` components (Lines 905-1170) → to `components/common/`
   
3. **`utils/marketDataHelpers.js`**
   - Move: `computeDailyReturns`, `computeBetaAndCorrelation`, `computeReturns`, `computeVolatility`, `bootstrapAnnualReturns` (Lines 502-680)
   - Move: `processTickerData`, `rehydrateTickerData`, `prepareForStorage` (Lines 685-792)
   - Move: `inferETFSector` (Lines 262-420)
   - Move: `getCalendarYearReturns` (Lines 452-480)

4. **`services/cacheManager.js`**
   - Move: `STORAGE_KEY`, `saveToStorage`, `loadFromStorage` (Lines 55-100)
   - Move: `UNIFIED_CACHE_KEY`, `UNIFIED_CACHE_MAX_AGE`, `FACTOR_CACHE_KEY` (Lines 485-490)

### Phase 2.2: Contexts (State Containers)
**Effort: 2-3 hours | Risk: Low**

Create contexts without migrating logic yet - just state:

1. **`contexts/UIContext.jsx`** - Start here (simplest)
   - Extract: Modal states, tab state, loading flags
   - No data dependencies

2. **`contexts/PortfolioContext.jsx`** 
   - Extract: positions, cashBalance, cashRate
   - Add: Undo/redo logic from App.jsx
   - Expose: `addPosition`, `updatePosition`, `removePosition`, `addPositionsBatch`

3. **`contexts/MarketDataContext.jsx`**
   - Extract: unifiedMarketData, positionMetadata, positionBetas, factorData
   - Just state holders for now, no fetch logic

4. **`contexts/SimulationContext.jsx`**
   - Extract: simulationResults, correlationMatrix, config options
   - Keep in sync with MarketDataContext

### Phase 2.3: Custom Hooks (Business Logic)
**Effort: 4-6 hours | Risk: Medium**

This is the complex part - extract data fetching into hooks:

1. **`hooks/useMarketData.js`** (Most Complex)
   - Move: `fetchUnifiedMarketData` (~350 lines, starting Line 2441)
   - Dependencies: factorDefinitions, marketDataHelpers, yahooFinance
   - Consumes: PortfolioContext (for position tickers)
   - Updates: MarketDataContext
   
   ```javascript
   // Interface
   const {
     fetchMarketData,
     refreshPrices,
     isLoading,
     progress,
     errors
   } = useMarketData();
   ```

2. **`hooks/useCorrelation.js`**
   - Move: `fetchAndComputeCorrelation` (~280 lines, starting Line 3907)
   - Move: `runLagAnalysis` (~180 lines, starting Line 4244)
   - Move: `applyLagAdjustedCorrelations` (starting Line 4470)
   - Dependencies: MarketDataContext, matrix.js, statistics.js
   
   ```javascript
   const {
     computeCorrelation,
     runLagAnalysis,
     applyLagAdjustment,
     isComputing
   } = useCorrelation();
   ```

3. **`hooks/useFactorAnalysis.js`**
   - Move: `fetchFactorData` (~150 lines, starting Line 4586)
   - Move: `computeFactorBetas` (~220 lines, starting Line 4876)
   - Move: `runFactorAnalysis` (~250 lines, starting Line 5233)
   - Move: `detectThematicMatch` (starting Line 5161)
   - Move: `alignReturnsByDate`, `computeCorrelationFromAligned` (Lines 4785-4875)
   
   ```javascript
   const {
     fetchFactorData,
     runAnalysis,
     getFactorExposure,
     isAnalyzing
   } = useFactorAnalysis();
   ```

4. **`hooks/useSimulation.js`**
   - Move: `runSimulation` (~800 lines, starting Line 5499)
   - This is the Monte Carlo engine - core of the app
   - Dependencies: SimulationContext (config), PortfolioContext (positions), matrix.js
   
   ```javascript
   const {
     runSimulation,
     simulationResults,
     isSimulating,
     progress
   } = useSimulation();
   ```

5. **`hooks/useOptimization.js`**
   - Move: `runPortfolioOptimization` (~200 lines, starting Line 6418)
   - Move: `analyticalSwapMatrix` computation
   - Dependencies: SimulationContext, PortfolioContext
   
   ```javascript
   const {
     runOptimization,
     analyzeSwap,
     results,
     isOptimizing
   } = useOptimization();
   ```

### Phase 2.4: AppContainer & Wiring
**Effort: 2-3 hours | Risk: Medium**

1. **Create `AppContainer.jsx`**
   - Wrap App with all providers
   - Handle initialization sequence (runFullLoad)
   - Keyboard shortcut coordination

2. **Refactor `App.jsx`**
   - Remove all extracted state/logic
   - Import from contexts via hooks
   - Keep only: JSX rendering, component composition
   - Target: ~500 lines

### Phase 2.5: Testing & Verification
**Effort: 2-3 hours | Risk: Low**

- Run through all tabs
- Verify data persistence (localStorage)
- Test undo/redo
- Test Full Load sequence
- Performance profiling

---

## 4. Testing Checkpoints

### After Phase 2.1 (Utilities)
- [ ] App still compiles
- [ ] No broken imports
- [ ] All tabs render correctly
- [ ] Run simulation works

**Rollback:** `git checkout src/App.jsx` (utils are additive)

### After Phase 2.2 (Contexts)
- [ ] Context providers wrap app
- [ ] State accessible via `useContext`
- [ ] localStorage save/load works
- [ ] Tab switching works

**Rollback:** Remove context imports, restore useState in App

### After Phase 2.3 (Hooks)
- [ ] **Critical:** Run Full Load sequence
- [ ] Fetch market data works
- [ ] Correlation matrix computes
- [ ] Simulation runs
- [ ] Factor analysis works
- [ ] Optimization runs

**Rollback:** Keep contexts, restore functions to App.jsx

### After Phase 2.4 (Final Wiring)
- [ ] Full app functionality
- [ ] Performance is same or better
- [ ] No console errors
- [ ] Mobile responsive

**Rollback:** Full git revert

---

## 5. Code Templates

### MarketDataContext.jsx
```jsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const MarketDataContext = createContext(null);

export function MarketDataProvider({ children }) {
  // Core data
  const [unifiedMarketData, setUnifiedMarketData] = useState({});
  const [positionMetadata, setPositionMetadata] = useState({});
  const [positionBetas, setPositionBetas] = useState({});
  const [factorData, setFactorData] = useState(null);
  const [lagAnalysis, setLagAnalysis] = useState(null);
  
  // Loading states
  const [isFetchingUnified, setIsFetchingUnified] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isFetchingBetas, setIsFetchingBetas] = useState(false);
  const [isFetchingFactors, setIsFetchingFactors] = useState(false);
  const [isAnalyzingLag, setIsAnalyzingLag] = useState(false);
  
  // Progress & errors
  const [unifiedFetchProgress, setUnifiedFetchProgress] = useState({ current: 0, total: 0, message: '' });
  const [fetchErrors, setFetchErrors] = useState([]);
  const [dataSource, setDataSource] = useState('none');
  
  // Memoized context value
  const value = useMemo(() => ({
    // Data
    unifiedMarketData,
    positionMetadata,
    positionBetas,
    factorData,
    lagAnalysis,
    
    // Setters (for hooks to use)
    setUnifiedMarketData,
    setPositionMetadata,
    setPositionBetas,
    setFactorData,
    setLagAnalysis,
    
    // Loading states
    isFetchingUnified,
    setIsFetchingUnified,
    isFetchingMetadata,
    setIsFetchingMetadata,
    isFetchingBetas,
    setIsFetchingBetas,
    isFetchingFactors,
    setIsFetchingFactors,
    isAnalyzingLag,
    setIsAnalyzingLag,
    
    // Progress
    unifiedFetchProgress,
    setUnifiedFetchProgress,
    fetchErrors,
    setFetchErrors,
    dataSource,
    setDataSource,
    
    // Derived
    isAnyFetching: isFetchingUnified || isFetchingMetadata || isFetchingBetas || isFetchingFactors,
  }), [
    unifiedMarketData, positionMetadata, positionBetas, factorData, lagAnalysis,
    isFetchingUnified, isFetchingMetadata, isFetchingBetas, isFetchingFactors, isAnalyzingLag,
    unifiedFetchProgress, fetchErrors, dataSource
  ]);
  
  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketDataContext() {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketDataContext must be used within MarketDataProvider');
  }
  return context;
}

export default MarketDataContext;
```

### PortfolioContext.jsx
```jsx
import React, { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { loadFromStorage, saveToStorage } from '../services/cacheManager';

const PortfolioContext = createContext(null);

const DEFAULT_POSITIONS = [
  { id: 1, ticker: 'SPY', quantity: 100, type: 'ETF', price: 450,
    p5: -0.20, p25: 0.02, p50: 0.10, p75: 0.18, p95: 0.35 },
  { id: 2, ticker: 'QQQ', quantity: 50, type: 'ETF', price: 380,
    p5: -0.30, p25: -0.02, p50: 0.12, p75: 0.26, p95: 0.50 },
  { id: 3, ticker: 'GLD', quantity: 30, type: 'ETF', price: 185,
    p5: -0.10, p25: 0.00, p50: 0.05, p75: 0.10, p95: 0.20 },
];

export function PortfolioProvider({ children }) {
  const savedData = useMemo(() => loadFromStorage(), []);
  
  // Core state
  const [positions, setPositions] = useState(() => savedData?.positions || DEFAULT_POSITIONS);
  const [cashBalance, setCashBalance] = useState(savedData?.cashBalance ?? 0);
  const [cashRate, setCashRate] = useState(savedData?.cashRate ?? 0.05);
  
  // Undo/Redo
  const historyRef = useRef([]);
  const futureRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // Record change for undo
  const recordChange = useCallback((newPositions) => {
    historyRef.current.push([...positions]);
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setPositions(newPositions);
  }, [positions]);
  
  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    futureRef.current.push([...positions]);
    const prev = historyRef.current.pop();
    setPositions(prev);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  }, [positions]);
  
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    historyRef.current.push([...positions]);
    const next = futureRef.current.pop();
    setPositions(next);
    setCanUndo(true);
    setCanRedo(futureRef.current.length > 0);
  }, [positions]);
  
  // Position operations
  const addPosition = useCallback((position) => {
    const id = Date.now();
    recordChange([...positions, { ...position, id }]);
  }, [positions, recordChange]);
  
  const updatePosition = useCallback((id, updates) => {
    recordChange(positions.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [positions, recordChange]);
  
  const removePosition = useCallback((id) => {
    recordChange(positions.filter(p => p.id !== id));
  }, [positions, recordChange]);
  
  const addPositionsBatch = useCallback((newPositions) => {
    const startId = Date.now();
    const withIds = newPositions.map((p, i) => ({ ...p, id: startId + i }));
    recordChange([...positions, ...withIds]);
  }, [positions, recordChange]);
  
  // Computed values
  const portfolioValue = useMemo(() => {
    const posValue = positions.reduce((sum, p) => sum + (p.price || 0) * (p.quantity || 0), 0);
    return posValue + cashBalance;
  }, [positions, cashBalance]);
  
  const weights = useMemo(() => {
    if (portfolioValue === 0) return {};
    return positions.reduce((acc, p) => {
      acc[p.id] = ((p.price || 0) * (p.quantity || 0)) / portfolioValue;
      return acc;
    }, {});
  }, [positions, portfolioValue]);
  
  const value = useMemo(() => ({
    // State
    positions,
    cashBalance,
    cashRate,
    setCashBalance,
    setCashRate,
    
    // Operations
    addPosition,
    updatePosition,
    removePosition,
    addPositionsBatch,
    setPositions: recordChange,
    
    // Undo/Redo
    undo,
    redo,
    canUndo,
    canRedo,
    
    // Computed
    portfolioValue,
    weights,
  }), [
    positions, cashBalance, cashRate,
    addPosition, updatePosition, removePosition, addPositionsBatch, recordChange,
    undo, redo, canUndo, canRedo,
    portfolioValue, weights
  ]);
  
  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within PortfolioProvider');
  }
  return context;
}

export default PortfolioContext;
```

### SimulationContext.jsx
```jsx
import React, { createContext, useContext, useState, useMemo } from 'react';
import { loadFromStorage } from '../services/cacheManager';

const SimulationContext = createContext(null);

export function SimulationProvider({ children }) {
  const savedData = useMemo(() => loadFromStorage(), []);
  
  // Configuration
  const [numPaths, setNumPaths] = useState(savedData?.numPaths || 10000);
  const [fatTailMethod, setFatTailMethod] = useState(savedData?.fatTailMethod || 'multivariateTStudent');
  const [useQmc, setUseQmc] = useState(savedData?.useQmc || false);
  const [drawdownThreshold, setDrawdownThreshold] = useState(savedData?.drawdownThreshold || 20);
  
  // Correlation settings
  const [correlationMatrix, setCorrelationMatrix] = useState(savedData?.correlationMatrix || null);
  const [editedCorrelation, setEditedCorrelation] = useState(savedData?.editedCorrelation || null);
  const [correlationMethod, setCorrelationMethod] = useState(savedData?.correlationMethod || 'shrinkage');
  const [useEwma, setUseEwma] = useState(savedData?.useEwma ?? true);
  const [useLagAdjusted, setUseLagAdjusted] = useState(false);
  const [historyTimeline, setHistoryTimeline] = useState('1y');
  
  // Results
  const [simulationResults, setSimulationResults] = useState(savedData?.simulationResults || null);
  const [previousSimulationResults, setPreviousSimulationResults] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Factor analysis
  const [factorAnalysis, setFactorAnalysis] = useState(null);
  const [thematicOverrides, setThematicOverrides] = useState({});
  
  // Active correlation (edited or computed)
  const activeCorrelation = useMemo(() => 
    editedCorrelation || correlationMatrix, 
    [editedCorrelation, correlationMatrix]
  );
  
  const value = useMemo(() => ({
    // Config
    numPaths, setNumPaths,
    fatTailMethod, setFatTailMethod,
    useQmc, setUseQmc,
    drawdownThreshold, setDrawdownThreshold,
    
    // Correlation
    correlationMatrix, setCorrelationMatrix,
    editedCorrelation, setEditedCorrelation,
    correlationMethod, setCorrelationMethod,
    useEwma, setUseEwma,
    useLagAdjusted, setUseLagAdjusted,
    historyTimeline, setHistoryTimeline,
    activeCorrelation,
    
    // Results
    simulationResults, setSimulationResults,
    previousSimulationResults, setPreviousSimulationResults,
    isSimulating, setIsSimulating,
    
    // Factor
    factorAnalysis, setFactorAnalysis,
    thematicOverrides, setThematicOverrides,
  }), [
    numPaths, fatTailMethod, useQmc, drawdownThreshold,
    correlationMatrix, editedCorrelation, correlationMethod, useEwma, useLagAdjusted, historyTimeline, activeCorrelation,
    simulationResults, previousSimulationResults, isSimulating,
    factorAnalysis, thematicOverrides
  ]);
  
  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulationContext() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulationContext must be used within SimulationProvider');
  }
  return context;
}

export default SimulationContext;
```

### UIContext.jsx
```jsx
import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  // Navigation
  const [activeTab, setActiveTab] = useState('positions');
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  
  // Modals
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem('mc-welcome-dismissed'));
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showAddPositionsModal, setShowAddPositionsModal] = useState(false);
  const [showScreenshotImportModal, setShowScreenshotImportModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  // Full load orchestration
  const [isFullLoading, setIsFullLoading] = useState(false);
  const [fullLoadProgress, setFullLoadProgress] = useState({ step: 0, total: 8, phase: '', detail: '' });
  
  // View modes
  const [matrixViewMode, setMatrixViewMode] = useState('correlation');
  const [positionSort, setPositionSort] = useState({ column: 'value', direction: 'desc' });
  const [positionFilter, setPositionFilter] = useState('all');
  const [positionSearch, setPositionSearch] = useState('');
  
  // Optimization state
  const [selectedSwap, setSelectedSwap] = useState(null);
  const [swapValidationResults, setSwapValidationResults] = useState(null);
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState({ current: 0, total: 0, phase: '' });
  
  // Window resize handler
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Persist sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);
  
  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem('mc-welcome-dismissed', 'true');
  }, []);
  
  const value = useMemo(() => ({
    // Navigation
    activeTab, setActiveTab,
    sidebarExpanded, setSidebarExpanded,
    windowWidth,
    
    // Modals
    showWelcome, dismissWelcome,
    showKeyboardShortcuts, setShowKeyboardShortcuts,
    showUserGuide, setShowUserGuide,
    showAddPositionsModal, setShowAddPositionsModal,
    showScreenshotImportModal, setShowScreenshotImportModal,
    showCommandPalette, setShowCommandPalette,
    showRecoveryDialog, setShowRecoveryDialog,
    confirmDialog, setConfirmDialog,
    
    // Full load
    isFullLoading, setIsFullLoading,
    fullLoadProgress, setFullLoadProgress,
    
    // View modes
    matrixViewMode, setMatrixViewMode,
    positionSort, setPositionSort,
    positionFilter, setPositionFilter,
    positionSearch, setPositionSearch,
    
    // Optimization
    selectedSwap, setSelectedSwap,
    swapValidationResults, setSwapValidationResults,
    optimizationResults, setOptimizationResults,
    isOptimizing, setIsOptimizing,
    optimizationProgress, setOptimizationProgress,
  }), [
    activeTab, sidebarExpanded, windowWidth,
    showWelcome, dismissWelcome, showKeyboardShortcuts, showUserGuide, showAddPositionsModal,
    showScreenshotImportModal, showCommandPalette, showRecoveryDialog, confirmDialog,
    isFullLoading, fullLoadProgress,
    matrixViewMode, positionSort, positionFilter, positionSearch,
    selectedSwap, swapValidationResults, optimizationResults, isOptimizing, optimizationProgress
  ]);
  
  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
}

export default UIContext;
```

### useMarketData.js (Hook)
```jsx
import { useCallback, useRef } from 'react';
import { useMarketDataContext } from '../contexts/MarketDataContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { fetchYahooHistory, fetchYahooProfile, fetchExchangeRate } from '../services/yahooFinance';
import { processTickerData, rehydrateTickerData, inferETFSector } from '../utils/marketDataHelpers';
import { ALL_FACTOR_ETFS, THEMATIC_ETFS } from '../utils/factorDefinitions';
import { UNIFIED_CACHE_MAX_AGE } from '../services/cacheManager';

export function useMarketData() {
  const { positions } = usePortfolio();
  const {
    unifiedMarketData,
    setUnifiedMarketData,
    isFetchingUnified,
    setIsFetchingUnified,
    unifiedFetchProgress,
    setUnifiedFetchProgress,
    fetchErrors,
    setFetchErrors,
  } = useMarketDataContext();
  
  const abortRef = useRef(null);
  
  const fetchMarketData = useCallback(async (forceRefresh = false) => {
    const startTime = performance.now();
    setIsFetchingUnified(true);
    setFetchErrors([]);
    
    // Get all unique tickers
    const tickers = [...new Set(
      positions.map(p => p.ticker?.toUpperCase()).filter(Boolean)
    )];
    
    if (tickers.length === 0) {
      setIsFetchingUnified(false);
      return;
    }
    
    // Add factor ETFs
    const factorETFs = ['SPY', ...Object.keys(THEMATIC_ETFS)];
    const allTickers = [...new Set([...factorETFs, ...tickers])];
    setUnifiedFetchProgress({ current: 0, total: allTickers.length, message: 'Initializing...' });
    
    const newData = { ...unifiedMarketData };
    const errors = [];
    
    // Separate cached vs need-to-fetch
    const needsFetch = [];
    const cachedTickers = [];
    
    for (const ticker of allTickers) {
      const cached = newData[ticker];
      if (!forceRefresh && cached?.fetchedAt && Date.now() - cached.fetchedAt < UNIFIED_CACHE_MAX_AGE) {
        cachedTickers.push(ticker);
      } else {
        needsFetch.push(ticker);
      }
    }
    
    let completedCount = cachedTickers.length;
    setUnifiedFetchProgress({ 
      current: completedCount, 
      total: allTickers.length, 
      message: `${cachedTickers.length} cached, fetching ${needsFetch.length}...` 
    });
    
    // Concurrent fetch with limit
    const CONCURRENCY_LIMIT = 6;
    const fetchQueue = [...needsFetch];
    const historyResults = [];
    
    const fetchWorker = async () => {
      while (fetchQueue.length > 0) {
        const ticker = fetchQueue.shift();
        if (!ticker) continue;
        
        try {
          const historyResult = await fetchYahooHistory(ticker, '5y', '1d');
          completedCount++;
          setUnifiedFetchProgress({
            current: completedCount,
            total: allTickers.length,
            message: ticker,
            detail: `${historyResult?.prices?.length || 0} days`
          });
          historyResults.push({
            ticker,
            data: historyResult?.prices || null,
            currency: historyResult?.currency || 'USD',
            cached: false
          });
        } catch (err) {
          completedCount++;
          historyResults.push({ ticker, data: null, error: err.message });
          errors.push(`${ticker}: ${err.message}`);
        }
      }
    };
    
    // Create worker pool
    const workers = Array(Math.min(CONCURRENCY_LIMIT, needsFetch.length))
      .fill(null)
      .map(() => fetchWorker());
    
    await Promise.all(workers);
    
    // Process results into unified format
    const spyData = historyResults.find(r => r.ticker === 'SPY')?.data;
    const spyReturns = spyData ? computeDailyReturns(spyData) : [];
    
    for (const result of historyResults) {
      if (result.data) {
        const profile = await fetchYahooProfile(result.ticker).catch(() => null);
        newData[result.ticker] = processTickerData(
          result.ticker,
          result.data,
          profile,
          spyReturns,
          result.currency,
          1 // Exchange rate handled separately
        );
      }
    }
    
    setUnifiedMarketData(newData);
    setFetchErrors(errors);
    setIsFetchingUnified(false);
    
    console.log(`✅ Market data fetch complete in ${(performance.now() - startTime).toFixed(0)}ms`);
    return newData;
  }, [positions, unifiedMarketData, setUnifiedMarketData, setIsFetchingUnified, setUnifiedFetchProgress, setFetchErrors]);
  
  const getTickerData = useCallback((ticker) => {
    return unifiedMarketData[ticker?.toUpperCase()];
  }, [unifiedMarketData]);
  
  return {
    // Actions
    fetchMarketData,
    getTickerData,
    
    // State
    unifiedMarketData,
    isFetching: isFetchingUnified,
    progress: unifiedFetchProgress,
    errors: fetchErrors,
  };
}

export default useMarketData;
```

### useCorrelation.js (Hook)
```jsx
import { useCallback } from 'react';
import { useMarketDataContext } from '../contexts/MarketDataContext';
import { useSimulationContext } from '../contexts/SimulationContext';
import { usePortfolio } from '../contexts/PortfolioContext';
import { computeEWMACorrelation, applyShrinkage, makeValidCorrelation } from '../utils/statistics';

export function useCorrelation() {
  const { positions } = usePortfolio();
  const { unifiedMarketData, lagAnalysis, setLagAnalysis, isAnalyzingLag, setIsAnalyzingLag } = useMarketDataContext();
  const { 
    correlationMatrix, setCorrelationMatrix,
    correlationMethod, useEwma, useLagAdjusted, historyTimeline 
  } = useSimulationContext();
  
  const computeCorrelation = useCallback(async () => {
    if (positions.length === 0) return null;
    
    // Get daily returns for each position
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(Boolean);
    const returnsMatrix = tickers.map(ticker => {
      const data = unifiedMarketData[ticker];
      return data?.dailyReturns || [];
    }).filter(r => r.length > 0);
    
    if (returnsMatrix.length < 2) return null;
    
    // Align returns by length
    const minLen = Math.min(...returnsMatrix.map(r => r.length));
    const aligned = returnsMatrix.map(r => r.slice(-minLen));
    
    // Compute raw correlation
    let corr = computeRawCorrelation(aligned);
    
    // Apply EWMA if enabled
    if (useEwma) {
      const halfLife = historyTimeline === '6mo' ? 30 : historyTimeline === '1y' ? 60 : 90;
      corr = computeEWMACorrelation(aligned, halfLife);
    }
    
    // Apply shrinkage if enabled
    if (correlationMethod === 'shrinkage') {
      corr = applyShrinkage(corr, 0.2);
    }
    
    // Ensure valid correlation matrix
    corr = makeValidCorrelation(corr);
    
    setCorrelationMatrix(corr);
    return corr;
  }, [positions, unifiedMarketData, useEwma, historyTimeline, correlationMethod, setCorrelationMatrix]);
  
  const runLagAnalysis = useCallback(async () => {
    setIsAnalyzingLag(true);
    
    // Identify international tickers
    const intlTickers = positions
      .map(p => p.ticker?.toUpperCase())
      .filter(t => unifiedMarketData[t]?.isInternational);
    
    if (intlTickers.length === 0) {
      setIsAnalyzingLag(false);
      return null;
    }
    
    // Test lag correlations (-1, 0, +1)
    const lagResults = {};
    const spyData = unifiedMarketData['SPY'];
    
    for (const ticker of intlTickers) {
      const data = unifiedMarketData[ticker];
      if (!data?.dailyReturns) continue;
      
      const lags = [-1, 0, 1];
      let bestLag = 0;
      let bestCorr = 0;
      
      for (const lag of lags) {
        const corr = computeLaggedCorrelation(data.dailyReturns, spyData.dailyReturns, lag);
        if (Math.abs(corr) > Math.abs(bestCorr)) {
          bestCorr = corr;
          bestLag = lag;
        }
      }
      
      lagResults[ticker] = { bestLag, correlation: bestCorr };
    }
    
    setLagAnalysis(lagResults);
    setIsAnalyzingLag(false);
    return lagResults;
  }, [positions, unifiedMarketData, setLagAnalysis, setIsAnalyzingLag]);
  
  return {
    computeCorrelation,
    runLagAnalysis,
    correlationMatrix,
    lagAnalysis,
    isAnalyzing: isAnalyzingLag,
  };
}

// Helper functions (inline or import from utils)
function computeRawCorrelation(returnsMatrix) {
  const n = returnsMatrix.length;
  const corr = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        corr[i][j] = 1;
      } else {
        const c = pearsonCorrelation(returnsMatrix[i], returnsMatrix[j]);
        corr[i][j] = c;
        corr[j][i] = c;
      }
    }
  }
  
  return corr;
}

function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  
  const meanX = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const meanY = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  
  const den = Math.sqrt(denX * denY);
  return den > 0 ? num / den : 0;
}

function computeLaggedCorrelation(returns1, returns2, lag) {
  if (lag === 0) return pearsonCorrelation(returns1, returns2);
  
  const r1 = lag > 0 ? returns1.slice(lag) : returns1.slice(0, lag);
  const r2 = lag > 0 ? returns2.slice(0, -lag) : returns2.slice(-lag);
  
  return pearsonCorrelation(r1, r2);
}

export default useCorrelation;
```

### AppContainer.jsx
```jsx
import React from 'react';
import { MarketDataProvider } from './contexts/MarketDataContext';
import { PortfolioProvider } from './contexts/PortfolioContext';
import { SimulationProvider } from './contexts/SimulationContext';
import { UIProvider } from './contexts/UIContext';
import { ToastProvider } from './components/common';
import App from './App';

export default function AppContainer() {
  return (
    <ToastProvider>
      <UIProvider>
        <PortfolioProvider>
          <MarketDataProvider>
            <SimulationProvider>
              <App />
            </SimulationProvider>
          </MarketDataProvider>
        </PortfolioProvider>
      </UIProvider>
    </ToastProvider>
  );
}
```

---

## 6. Time Estimates

| Phase | Task | Estimated Hours | Risk |
|-------|------|-----------------|------|
| **2.1** | Utilities extraction | 1.5h | Very Low |
| **2.2** | Create 4 contexts | 2.5h | Low |
| **2.3** | Extract 5 custom hooks | 5-6h | Medium |
| **2.4** | AppContainer + wiring | 2h | Medium |
| **2.5** | Testing & verification | 2h | Low |
| | **Total** | **13-14h** | Medium |

### Recommended Schedule

**Day 1 (4h):**
- Phase 2.1: Extract utilities
- Phase 2.2: Create contexts (state only)
- Checkpoint: Verify app still works

**Day 2 (5h):**
- Phase 2.3: Extract hooks (useMarketData, useCorrelation, useFactorAnalysis)
- Checkpoint: Verify data fetching works

**Day 3 (4h):**
- Phase 2.3 (cont): Extract useSimulation, useOptimization
- Phase 2.4: Create AppContainer, refactor App.jsx
- Checkpoint: Full functionality test

**Day 4 (2h):**
- Phase 2.5: Testing, edge cases, cleanup
- Documentation update
- Git commit final version

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Circular dependencies between contexts | Medium | High | Strict dependency order, useRef for cross-refs |
| Lost state during refactor | Low | High | Git commits after each phase, test checkpoints |
| Performance regression | Low | Medium | Profile before/after, use React DevTools |
| localStorage migration issues | Low | Medium | Version cache keys, graceful fallback |
| Hook dependency arrays wrong | Medium | Medium | ESLint exhaustive-deps rule, careful review |

---

## 8. Success Criteria

After Phase 2 is complete:

- [ ] App.jsx is < 600 lines
- [ ] No more than 5 useState hooks in App.jsx
- [ ] All 8 tabs function identically
- [ ] Full Load sequence works
- [ ] Simulation runs correctly
- [ ] Undo/Redo works
- [ ] localStorage persistence works
- [ ] No console errors/warnings
- [ ] Performance same or better

---

## Appendix: Function Locations Reference

| Function | Current Line | Destination |
|----------|--------------|-------------|
| `fetchUnifiedMarketData` | 2441 | `hooks/useMarketData.js` |
| `fetchAndComputeCorrelation` | 3907 | `hooks/useCorrelation.js` |
| `runLagAnalysis` | 4244 | `hooks/useCorrelation.js` |
| `applyLagAdjustedCorrelations` | 4470 | `hooks/useCorrelation.js` |
| `fetchFactorData` | 4586 | `hooks/useFactorAnalysis.js` |
| `computeFactorBetas` | 4876 | `hooks/useFactorAnalysis.js` |
| `runFactorAnalysis` | 5233 | `hooks/useFactorAnalysis.js` |
| `runSimulation` | 5499 | `hooks/useSimulation.js` |
| `runPortfolioOptimization` | 6418 | `hooks/useOptimization.js` |
| `runFullLoad` | 7286 | `hooks/useFullLoad.js` or `AppContainer` |
| `computeDailyReturns` | 502 | `utils/marketDataHelpers.js` |
| `computeBetaAndCorrelation` | 515 | `utils/marketDataHelpers.js` |
| `processTickerData` | 685 | `utils/marketDataHelpers.js` |
| `inferETFSector` | 262 | `utils/marketDataHelpers.js` |
| `getPercentilesFromParams` | 793 | `utils/distributionParams.js` |
| `getParamsFromPercentiles` | 815 | `utils/distributionParams.js` |
| `THEMATIC_ETFS` | 125 | `utils/factorDefinitions.js` |
| `FACTOR_SPREAD_DEFINITIONS` | 115 | `utils/factorDefinitions.js` |
| `saveToStorage` | 57 | `services/cacheManager.js` |
| `loadFromStorage` | 82 | `services/cacheManager.js` |

---

*This plan was generated from Phase 1 analysis of App.jsx (8,414 lines, 42 useState hooks). Execute phases in order, verify at each checkpoint.*
