# Monte Carlo App - Complete Refactoring Plan

## Executive Summary

**Current State:** 8,413 lines in App.jsx with 42+ useState hooks
**Target State:** ~2,000 lines in App.jsx with 0 useState hooks (all in contexts)

### Key Metrics
| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| App.jsx lines | 8,413 | ~2,000 | 76% |
| useState hooks | 42 | 0 | 100% |
| Top-level functions | 25+ | 0 | 100% |
| Code organization | Monolith | Modular | ✓ |

---

## Phase Overview

| Phase | Focus | Files | Time | Risk |
|-------|-------|-------|------|------|
| A | Extract Utilities | 3-4 new | 2-3 hrs | Low |
| B | Create Contexts | 4 new | 3-4 hrs | Medium |
| C | Create Custom Hooks | 5-6 new | 4-6 hrs | Medium |
| D | Refactor App.jsx | 1 modified | 3-4 hrs | High |
| E | Testing & Polish | - | 2-3 hrs | Low |
| **Total** | | **15-18 files** | **14-20 hrs** | |

---

## Target File Structure

```
src/
├── App.jsx                    # ~2,000 lines (down from 8,413)
├── contexts/
│   ├── index.js               # Re-exports (update existing)
│   ├── AppContext.js          # Keep existing
│   ├── MarketDataContext.jsx  # NEW: market data + fetching
│   ├── PortfolioContext.jsx   # NEW: positions, cash, undo/redo
│   ├── SimulationContext.jsx  # NEW: simulation state + results
│   └── UIContext.jsx          # NEW: ui state, modals, loading flags
├── hooks/
│   ├── index.js               # Re-exports (update existing)
│   ├── useAutosave.js         # Keep existing
│   ├── useUndoRedo.js         # Keep existing
│   ├── useChartInteraction.js # Keep existing
│   ├── useLocalStorage.js     # Keep existing
│   ├── useMarketData.js       # NEW: wraps fetchUnifiedMarketData
│   ├── useCorrelation.js      # NEW: wraps fetchAndComputeCorrelation
│   ├── useFactorAnalysis.js   # NEW: wraps runFactorAnalysis
│   ├── useSimulation.js       # NEW: wraps runSimulation
│   └── useOptimization.js     # NEW: wraps runPortfolioOptimization
├── utils/
│   ├── index.js               # Keep existing
│   ├── statistics.js          # Keep existing (move more to it)
│   ├── yahooFinanceHelpers.js # NEW: pure fetch/transform functions
│   ├── factorCompute.js       # NEW: pure factor calculations
│   └── constants.js           # NEW: all constants/config
├── services/
│   └── yahooFinance.js        # Keep existing
└── components/
    └── tabs/                  # Keep existing
```

---

## Phase A: Extract Utilities (2-3 hours)

### Risk Level: 🟢 LOW
Utilities are pure functions with no React dependencies. Zero risk of breaking the app.

### A.1: Create `utils/yahooFinanceHelpers.js`

**Lines to move from App.jsx:** ~250 lines (168-494)

```javascript
// utils/yahooFinanceHelpers.js

// Move these pure functions:
export const fetchYahooData = async (url) => { ... }        // Lines 168-207
export const fetchExchangeRate = async (from, to) => { ... } // Lines 208-240
export const fetchYahooProfile = async (symbol) => { ... }   // Lines 242-267
export const inferETFSector = (symbol, name) => { ... }      // Lines 269-421
export const fetchYahooHistory = async (symbol) => { ... }   // Lines 423-458
export const getCalendarYearReturns = (prices) => { ... }    // Lines 461-493
```

**Testing A.1:**
```bash
# Create test file
cat > src/utils/__tests__/yahooFinanceHelpers.test.js << 'EOF'
import { fetchYahooData, inferETFSector } from '../yahooFinanceHelpers';

test('inferETFSector returns correct sector for known ETFs', () => {
  expect(inferETFSector('SOXL', '')).toEqual(expect.objectContaining({ sector: 'Technology' }));
  expect(inferETFSector('GLD', '')).toEqual(expect.objectContaining({ sector: 'Commodities' }));
});
EOF

npm test -- --testPathPattern=yahooFinanceHelpers
```

### A.2: Create `utils/constants.js`

**Lines to move from App.jsx:** ~90 lines (54-161)

```javascript
// utils/constants.js

export const STORAGE_KEY = 'monte-carlo-portfolio-v1';
export const UNIFIED_CACHE_KEY = 'monte-carlo-unified-market-data-v6';
export const UNIFIED_CACHE_MAX_AGE = 4 * 60 * 60 * 1000; // 4 hours
export const FACTOR_CACHE_KEY = 'monte-carlo-factor-etf-data-v1';
export const FACTOR_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const STANDARD_FACTOR_ETFS = { ... };     // Lines 109-112
export const FACTOR_SPREAD_DEFINITIONS = { ... }; // Lines 115-122
export const THEMATIC_ETFS = { ... };             // Lines 124-159
export const ALL_FACTOR_ETFS = [ ... ];           // Lines 161-164
```

### A.3: Move more pure math to `utils/statistics.js`

**Lines to move from App.jsx:** ~200 lines

```javascript
// ADD to existing utils/statistics.js

export const computeDailyReturns = (prices) => { ... }         // Lines 502-513
export const computeBetaAndCorrelation = (...) => { ... }      // Lines 515-625
export const computeReturns = (prices) => { ... }              // Lines 627-648
export const computeVolatility = (returns) => { ... }          // Lines 650-656
export const bootstrapAnnualReturns = (dr, n) => { ... }       // Lines 658-690
export const normalCDF = (x) => { ... }                        // Lines 1497-1510
export const normalInvCDF = (p) => { ... }                     // Lines 1512-1535
export const studentTInvCDF = (p, df) => { ... }               // Lines 1537-1549
export const boxMuller = () => { ... }                         // Lines 1551-1557
export const boxMullerPair = () => { ... }                     // Lines 1559-1567
export const generateChiSquared = (df) => { ... }              // Lines 1569-1586
export const choleskyDecomposition = (matrix) => { ... }       // Lines 1588-1607
export const makeValidCorrelation = (matrix) => { ... }        // Lines 1609-1659
export const correlationToCovariance = (corr, vols) => { ... } // Lines 1661-1671
export const calculateSampleCorrelation = (rm) => { ... }      // Lines 1697-1727
```

### A.4: Create `utils/factorCompute.js`

**Lines to move:** ~100 lines

```javascript
// utils/factorCompute.js

export const processTickerData = (ticker, history, ...) => { ... } // Lines 692-765
export const rehydrateTickerData = (data, spyData) => { ... }      // Lines 767-831
export const prepareForStorage = (data) => { ... }                  // Lines 833-857
export const getPercentilesFromParams = (mu, sigma, ...) => { ... } // Lines 860-882
export const getParamsFromPercentiles = (p5, p25, ...) => { ... }   // Lines 884-907
```

### A.5: Git Strategy for Phase A

```bash
# Create feature branch
git checkout -b refactor/phase-a-utilities

# After each file:
git add src/utils/yahooFinanceHelpers.js
git commit -m "Extract Yahoo Finance helpers to utils"

git add src/utils/constants.js  
git commit -m "Extract constants to utils/constants.js"

git add src/utils/statistics.js
git commit -m "Move pure math functions to statistics.js"

git add src/utils/factorCompute.js
git commit -m "Extract factor computation utilities"

# Update App.jsx imports (don't remove code yet!)
git add src/App.jsx
git commit -m "Update App.jsx to import from new utils"

# Test everything works
npm run build && npm test

# Merge
git checkout main
git merge refactor/phase-a-utilities
```

### Phase A Verification Checklist
- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] App loads without console errors
- [ ] Market data fetch still works
- [ ] Simulation still runs
- [ ] Factor analysis still works

---

## Phase B: Create Contexts (3-4 hours)

### Risk Level: 🟡 MEDIUM
Creating context structure. Components still use props, but we're setting up the plumbing.

### B.1: Create `contexts/UIContext.jsx`

**State to move:** 15 useState hooks (~100 lines)

```javascript
// contexts/UIContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';

const UIContext = createContext(null);

export const useUIContext = () => {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUIContext must be used within UIProvider');
  return ctx;
};

export const UIProvider = ({ children }) => {
  // Tab navigation
  const [activeTab, setActiveTab] = useState('positions');
  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1920
  );
  
  // Modals
  const [showMethodologyExplainer, setShowMethodologyExplainer] = useState(false);
  const [showWelcome, setShowWelcome] = useState(() => 
    !localStorage.getItem('mc-welcome-dismissed')
  );
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showAddPositionsModal, setShowAddPositionsModal] = useState(false);
  const [showScreenshotImportModal, setShowScreenshotImportModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  // Loading states
  const [isSimulating, setIsSimulating] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isFetchingUnified, setIsFetchingUnified] = useState(false);
  const [isFetchingFactors, setIsFetchingFactors] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isFullLoading, setIsFullLoading] = useState(false);
  const [isAnalyzingLag, setIsAnalyzingLag] = useState(false);
  
  // Progress indicators
  const [unifiedFetchProgress, setUnifiedFetchProgress] = useState({ current: 0, total: 0, message: '' });
  const [optimizationProgress, setOptimizationProgress] = useState({ current: 0, total: 0, phase: '' });
  const [fullLoadProgress, setFullLoadProgress] = useState({ step: 0, total: 8, phase: '', detail: '' });
  
  // Autosave
  const [autosaveStatus, setAutosaveStatus] = useState('idle');
  const [lastSaved, setLastSaved] = useState(null);
  
  // Helpers
  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem('mc-welcome-dismissed', 'true');
  }, []);
  
  const value = {
    // Tab navigation
    activeTab, setActiveTab,
    sidebarExpanded, setSidebarExpanded,
    windowWidth, setWindowWidth,
    // Modals
    showMethodologyExplainer, setShowMethodologyExplainer,
    showWelcome, dismissWelcome,
    showKeyboardShortcuts, setShowKeyboardShortcuts,
    showUserGuide, setShowUserGuide,
    showAddPositionsModal, setShowAddPositionsModal,
    showScreenshotImportModal, setShowScreenshotImportModal,
    showCommandPalette, setShowCommandPalette,
    showRecoveryDialog, setShowRecoveryDialog,
    recoveryData, setRecoveryData,
    confirmDialog, setConfirmDialog,
    // Loading
    isSimulating, setIsSimulating,
    isFetchingData, setIsFetchingData,
    isFetchingUnified, setIsFetchingUnified,
    isFetchingFactors, setIsFetchingFactors,
    isFetchingMetadata, setIsFetchingMetadata,
    isOptimizing, setIsOptimizing,
    isFullLoading, setIsFullLoading,
    isAnalyzingLag, setIsAnalyzingLag,
    // Progress
    unifiedFetchProgress, setUnifiedFetchProgress,
    optimizationProgress, setOptimizationProgress,
    fullLoadProgress, setFullLoadProgress,
    // Autosave
    autosaveStatus, setAutosaveStatus,
    lastSaved, setLastSaved,
  };
  
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
```

### B.2: Create `contexts/PortfolioContext.jsx`

**State to move:** 12 useState hooks (~150 lines)

```javascript
// contexts/PortfolioContext.jsx
import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { STORAGE_KEY } from '../utils/constants';

const PortfolioContext = createContext(null);

export const usePortfolioContext = () => {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolioContext must be used within PortfolioProvider');
  return ctx;
};

// Load from localStorage helper
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    console.warn('Failed to load from localStorage:', e);
    return null;
  }
};

export const PortfolioProvider = ({ children }) => {
  const savedData = useMemo(() => loadFromStorage(), []);
  
  // Positions with percentile migration
  const [positions, setPositions] = useState(() => {
    const defaultPositions = [
      { id: 1, ticker: 'SPY', quantity: 100, type: 'ETF', price: 450,
        p5: -0.20, p25: 0.02, p50: 0.10, p75: 0.18, p95: 0.35 },
      { id: 2, ticker: 'QQQ', quantity: 50, type: 'ETF', price: 380,
        p5: -0.30, p25: -0.02, p50: 0.12, p75: 0.26, p95: 0.50 },
      { id: 3, ticker: 'GLD', quantity: 30, type: 'ETF', price: 185,
        p5: -0.10, p25: 0.00, p50: 0.05, p75: 0.10, p95: 0.20 },
    ];
    if (!savedData?.positions) return defaultPositions;
    // Migration logic here...
    return savedData.positions;
  });
  
  // Cash
  const [cashBalance, setCashBalance] = useState(savedData?.cashBalance ?? 0);
  const [cashRate, setCashRate] = useState(savedData?.cashRate ?? 0.05);
  
  // Settings
  const [gldAsCash, setGldAsCash] = useState(savedData?.gldAsCash || false);
  const [numPaths, setNumPaths] = useState(savedData?.numPaths || 10000);
  const [correlationMethod, setCorrelationMethod] = useState(savedData?.correlationMethod || 'shrinkage');
  const [useEwma, setUseEwma] = useState(savedData?.useEwma ?? true);
  const [fatTailMethod, setFatTailMethod] = useState(savedData?.fatTailMethod || 'multivariateTStudent');
  const [useQmc, setUseQmc] = useState(savedData?.useQmc || false);
  const [drawdownThreshold, setDrawdownThreshold] = useState(savedData?.drawdownThreshold || 20);
  const [historyTimeline, setHistoryTimeline] = useState('1y');
  const [riskFreeRate, setRiskFreeRate] = useState(0.05);
  const [swapSize, setSwapSize] = useState(savedData?.swapSize ?? 0.01);
  const [optimizationPaths, setOptimizationPaths] = useState(savedData?.optimizationPaths ?? 100000);
  
  // Metadata
  const [positionMetadata, setPositionMetadata] = useState(savedData?.positionMetadata || {});
  const [thematicOverrides, setThematicOverrides] = useState({});
  
  // Sorting/filtering
  const [positionSort, setPositionSort] = useState({ column: 'value', direction: 'desc' });
  const [positionFilter, setPositionFilter] = useState('all');
  const [positionSearch, setPositionSearch] = useState('');
  
  // Undo/redo
  const positionsHistoryRef = useRef([]);
  const positionsFutureRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // Derived values
  const totalValue = useMemo(() => {
    return positions.reduce((sum, p) => sum + (p.quantity * p.price), 0) + cashBalance;
  }, [positions, cashBalance]);
  
  const weights = useMemo(() => {
    if (totalValue === 0) return positions.map(() => 0);
    return positions.map(p => (p.quantity * p.price) / totalValue);
  }, [positions, totalValue]);
  
  // Position helpers
  const getDistributionParams = useCallback((pos) => {
    // ... existing getDistributionParams logic
  }, []);
  
  const value = {
    // Core data
    positions, setPositions,
    cashBalance, setCashBalance,
    cashRate, setCashRate,
    // Settings
    gldAsCash, setGldAsCash,
    numPaths, setNumPaths,
    correlationMethod, setCorrelationMethod,
    useEwma, setUseEwma,
    fatTailMethod, setFatTailMethod,
    useQmc, setUseQmc,
    drawdownThreshold, setDrawdownThreshold,
    historyTimeline, setHistoryTimeline,
    riskFreeRate, setRiskFreeRate,
    swapSize, setSwapSize,
    optimizationPaths, setOptimizationPaths,
    // Metadata
    positionMetadata, setPositionMetadata,
    thematicOverrides, setThematicOverrides,
    // Sorting/filtering
    positionSort, setPositionSort,
    positionFilter, setPositionFilter,
    positionSearch, setPositionSearch,
    // Undo/redo
    positionsHistoryRef, positionsFutureRef,
    canUndo, setCanUndo, canRedo, setCanRedo,
    // Derived
    totalValue, weights,
    getDistributionParams,
  };
  
  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
};
```

### B.3: Create `contexts/MarketDataContext.jsx`

**State to move:** 8 useState hooks (~80 lines)

```javascript
// contexts/MarketDataContext.jsx
import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { UNIFIED_CACHE_KEY, UNIFIED_CACHE_MAX_AGE } from '../utils/constants';

const MarketDataContext = createContext(null);

export const useMarketDataContext = () => {
  const ctx = useContext(MarketDataContext);
  if (!ctx) throw new Error('useMarketDataContext must be used within MarketDataProvider');
  return ctx;
};

export const MarketDataProvider = ({ children }) => {
  // Unified market data (single source of truth)
  const [unifiedMarketData, setUnifiedMarketData] = useState({});
  const [historicalData, setHistoricalData] = useState({});
  const [dataSource, setDataSource] = useState('none');
  const [fetchErrors, setFetchErrors] = useState([]);
  
  // Calendar year returns
  const [calendarYearReturns, setCalendarYearReturns] = useState({});
  
  // Correlation data
  const [correlationMatrix, setCorrelationMatrix] = useState(null);
  const [editedCorrelation, setEditedCorrelation] = useState(null);
  const [correlationGroups, setCorrelationGroups] = useState(null);
  
  // Lag analysis
  const [lagAnalysis, setLagAnalysis] = useState(null);
  const [useLagAdjusted, setUseLagAdjusted] = useState(false);
  
  // Factor data
  const [factorData, setFactorData] = useState(null);
  const [factorAnalysis, setFactorAnalysis] = useState(null);
  
  // Position betas
  const [positionBetas, setPositionBetas] = useState({});
  
  // Matrix view mode
  const [matrixViewMode, setMatrixViewMode] = useState('correlation');
  
  // Load cached data on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(UNIFIED_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < UNIFIED_CACHE_MAX_AGE && data) {
          // Rehydrate...
          setUnifiedMarketData(data);
          setDataSource('cache');
        }
      }
    } catch (e) {
      console.warn('Failed to load cached market data:', e);
    }
  }, []);
  
  const value = {
    // Market data
    unifiedMarketData, setUnifiedMarketData,
    historicalData, setHistoricalData,
    dataSource, setDataSource,
    fetchErrors, setFetchErrors,
    // Calendar returns
    calendarYearReturns, setCalendarYearReturns,
    // Correlation
    correlationMatrix, setCorrelationMatrix,
    editedCorrelation, setEditedCorrelation,
    correlationGroups, setCorrelationGroups,
    // Lag
    lagAnalysis, setLagAnalysis,
    useLagAdjusted, setUseLagAdjusted,
    // Factors
    factorData, setFactorData,
    factorAnalysis, setFactorAnalysis,
    // Betas
    positionBetas, setPositionBetas,
    // View
    matrixViewMode, setMatrixViewMode,
  };
  
  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>;
};
```

### B.4: Create `contexts/SimulationContext.jsx`

**State to move:** 7 useState hooks (~60 lines)

```javascript
// contexts/SimulationContext.jsx
import React, { createContext, useContext, useState, useRef } from 'react';

const SimulationContext = createContext(null);

export const useSimulationContext = () => {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error('useSimulationContext must be used within SimulationProvider');
  return ctx;
};

export const SimulationProvider = ({ children }) => {
  // Simulation results
  const [simulationResults, setSimulationResults] = useState(null);
  const [previousSimulationResults, setPreviousSimulationResults] = useState(null);
  
  // Optimization results
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [selectedSwap, setSelectedSwap] = useState(null);
  const [swapValidationResults, setSwapValidationResults] = useState(null);
  
  // Thematic swap results
  const [thematicSwapResults, setThematicSwapResults] = useState(null);
  const [thematicSwapProgress, setThematicSwapProgress] = useState({ current: 0, total: 0, phase: '' });
  
  // Hovered scenario (for charts)
  const [hoveredScenario, setHoveredScenario] = useState(null);
  const lastHoverUpdate = useRef(0);
  
  // Worker refs
  const simulationWorkerRef = useRef(null);
  
  const value = {
    simulationResults, setSimulationResults,
    previousSimulationResults, setPreviousSimulationResults,
    optimizationResults, setOptimizationResults,
    selectedSwap, setSelectedSwap,
    swapValidationResults, setSwapValidationResults,
    thematicSwapResults, setThematicSwapResults,
    thematicSwapProgress, setThematicSwapProgress,
    hoveredScenario, setHoveredScenario,
    lastHoverUpdate,
    simulationWorkerRef,
  };
  
  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
};
```

### B.5: Update `contexts/index.js`

```javascript
// contexts/index.js
export { AppContextProvider, useAppContext } from './AppContext';
export { UIProvider, useUIContext } from './UIContext';
export { PortfolioProvider, usePortfolioContext } from './PortfolioContext';
export { MarketDataProvider, useMarketDataContext } from './MarketDataContext';
export { SimulationProvider, useSimulationContext } from './SimulationContext';

// Convenience wrapper that includes all providers
export const AllProviders = ({ children }) => (
  <UIProvider>
    <PortfolioProvider>
      <MarketDataProvider>
        <SimulationProvider>
          {children}
        </SimulationProvider>
      </MarketDataProvider>
    </PortfolioProvider>
  </UIProvider>
);
```

### B.6: Git Strategy for Phase B

```bash
git checkout -b refactor/phase-b-contexts

git add src/contexts/UIContext.jsx
git commit -m "Create UIContext for UI state management"

git add src/contexts/PortfolioContext.jsx
git commit -m "Create PortfolioContext for portfolio state"

git add src/contexts/MarketDataContext.jsx
git commit -m "Create MarketDataContext for market data"

git add src/contexts/SimulationContext.jsx
git commit -m "Create SimulationContext for simulation state"

git add src/contexts/index.js
git commit -m "Export all contexts from index"

# Test
npm run build && npm test

git checkout main
git merge refactor/phase-b-contexts
```

### Phase B Verification Checklist
- [ ] All 4 new context files created
- [ ] `contexts/index.js` exports all providers
- [ ] `npm run build` succeeds
- [ ] No circular dependency errors
- [ ] Providers can be imported independently

---

## Phase C: Create Custom Hooks (4-6 hours)

### Risk Level: 🟡 MEDIUM
Moving complex async logic to hooks. Test each hook in isolation before integration.

### C.1: Create `hooks/useMarketData.js`

**Function to extract:** `fetchUnifiedMarketData` (~437 lines)

```javascript
// hooks/useMarketData.js
import { useCallback } from 'react';
import { useMarketDataContext } from '../contexts';
import { useUIContext } from '../contexts';
import { usePortfolioContext } from '../contexts';
import { 
  fetchYahooData, 
  fetchYahooHistory, 
  fetchYahooProfile,
  fetchExchangeRate,
  processTickerData,
  rehydrateTickerData,
} from '../utils/yahooFinanceHelpers';
import { UNIFIED_CACHE_KEY, UNIFIED_CACHE_MAX_AGE } from '../utils/constants';

export const useMarketData = () => {
  const { positions } = usePortfolioContext();
  const { 
    unifiedMarketData, setUnifiedMarketData,
    setDataSource, setFetchErrors,
    setCalendarYearReturns,
  } = useMarketDataContext();
  const { 
    setIsFetchingUnified, 
    setUnifiedFetchProgress 
  } = useUIContext();
  
  const fetchUnifiedMarketData = useCallback(async (forceRefresh = false) => {
    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(UNIFIED_CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < UNIFIED_CACHE_MAX_AGE) {
            setUnifiedMarketData(data);
            setDataSource('cache');
            return data;
          }
        }
      } catch (e) {
        console.warn('Cache read failed:', e);
      }
    }
    
    setIsFetchingUnified(true);
    const errors = [];
    const newData = {};
    
    // Get unique tickers
    const tickers = [...new Set(positions.map(p => p.ticker.toUpperCase()))];
    
    // Always fetch SPY first (needed for beta calculations)
    setUnifiedFetchProgress({ current: 0, total: tickers.length + 1, message: 'Fetching SPY...' });
    
    try {
      const spyHistory = await fetchYahooHistory('SPY', '1y');
      if (spyHistory?.prices?.length > 0) {
        newData['SPY'] = processTickerData('SPY', spyHistory, null, null);
      }
    } catch (e) {
      errors.push({ ticker: 'SPY', error: e.message });
    }
    
    // Fetch each position
    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];
      if (ticker === 'SPY') continue; // Already fetched
      
      setUnifiedFetchProgress({ 
        current: i + 1, 
        total: tickers.length + 1, 
        message: `Fetching ${ticker}...` 
      });
      
      try {
        const [history, profile] = await Promise.all([
          fetchYahooHistory(ticker, '1y'),
          fetchYahooProfile(ticker),
        ]);
        
        if (history?.prices?.length > 0) {
          newData[ticker] = processTickerData(ticker, history, profile, newData['SPY']);
        } else {
          errors.push({ ticker, error: 'No data returned' });
        }
      } catch (e) {
        errors.push({ ticker, error: e.message });
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }
    
    // Save to cache
    try {
      localStorage.setItem(UNIFIED_CACHE_KEY, JSON.stringify({
        data: newData,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Cache write failed:', e);
    }
    
    setUnifiedMarketData(newData);
    setDataSource('yahoo');
    setFetchErrors(errors);
    setIsFetchingUnified(false);
    setUnifiedFetchProgress({ current: 0, total: 0, message: '' });
    
    return newData;
  }, [positions, setUnifiedMarketData, setDataSource, setFetchErrors, 
      setIsFetchingUnified, setUnifiedFetchProgress]);
  
  return {
    unifiedMarketData,
    fetchUnifiedMarketData,
  };
};
```

### C.2: Create `hooks/useCorrelation.js`

**Function to extract:** `fetchAndComputeCorrelation` (complex - ~300+ lines of core logic)

```javascript
// hooks/useCorrelation.js
import { useCallback } from 'react';
import { useMarketDataContext } from '../contexts';
import { usePortfolioContext } from '../contexts';
import { useUIContext } from '../contexts';
import { 
  calculateSampleCorrelation, 
  makeValidCorrelation,
  // ... other statistics functions
} from '../utils/statistics';

export const useCorrelation = () => {
  const { positions, correlationMethod, useEwma, historyTimeline } = usePortfolioContext();
  const { 
    unifiedMarketData,
    correlationMatrix, setCorrelationMatrix,
    editedCorrelation, setEditedCorrelation,
    setCorrelationGroups,
  } = useMarketDataContext();
  const { setIsFetchingData } = useUIContext();
  
  const computeCorrelationMatrix = useCallback(async (marketData = null) => {
    const data = marketData || unifiedMarketData;
    if (!data || Object.keys(data).length === 0) {
      console.warn('No market data available for correlation');
      return null;
    }
    
    setIsFetchingData(true);
    
    try {
      // Get aligned returns for all positions
      const tickers = positions.map(p => p.ticker.toUpperCase());
      const returnsMatrix = [];
      
      for (const ticker of tickers) {
        const tickerData = data[ticker];
        if (tickerData?.dailyReturns?.length > 0) {
          returnsMatrix.push(tickerData.dailyReturns);
        } else {
          // Use synthetic returns if no data
          returnsMatrix.push(Array(252).fill(0).map(() => (Math.random() - 0.5) * 0.02));
        }
      }
      
      // Compute sample correlation
      let corrMatrix = calculateSampleCorrelation(returnsMatrix);
      
      // Apply shrinkage if selected
      if (correlationMethod === 'shrinkage') {
        // Shrink toward identity matrix
        const shrinkage = 0.2;
        corrMatrix = corrMatrix.map((row, i) => 
          row.map((val, j) => i === j ? 1 : val * (1 - shrinkage))
        );
      }
      
      // Ensure positive semi-definite
      corrMatrix = makeValidCorrelation(corrMatrix);
      
      setCorrelationMatrix(corrMatrix);
      setIsFetchingData(false);
      
      return corrMatrix;
    } catch (e) {
      console.error('Correlation computation failed:', e);
      setIsFetchingData(false);
      return null;
    }
  }, [positions, correlationMethod, useEwma, unifiedMarketData, 
      setCorrelationMatrix, setIsFetchingData]);
  
  return {
    correlationMatrix,
    editedCorrelation,
    setEditedCorrelation,
    computeCorrelationMatrix,
  };
};
```

### C.3: Create `hooks/useSimulation.js`

**Function to extract:** `runSimulation` (~400+ lines of core logic)

```javascript
// hooks/useSimulation.js
import { useCallback, useRef } from 'react';
import { useSimulationContext } from '../contexts';
import { usePortfolioContext } from '../contexts';
import { useMarketDataContext } from '../contexts';
import { useUIContext } from '../contexts';
import { 
  choleskyDecomposition,
  boxMullerPair,
  generateChiSquared,
  correlationToCovariance,
} from '../utils/statistics';

export const useSimulation = () => {
  const { 
    positions, cashBalance, cashRate,
    numPaths, fatTailMethod, useQmc, drawdownThreshold,
    getDistributionParams,
  } = usePortfolioContext();
  const { correlationMatrix, editedCorrelation } = useMarketDataContext();
  const { 
    simulationResults, setSimulationResults,
    setPreviousSimulationResults,
  } = useSimulationContext();
  const { setIsSimulating } = useUIContext();
  
  const workerRef = useRef(null);
  
  const runSimulation = useCallback(async (corrMatrixOverride = null) => {
    const corrMatrix = corrMatrixOverride || editedCorrelation || correlationMatrix;
    
    if (!corrMatrix || !positions.length) {
      console.warn('Cannot run simulation: missing correlation matrix or positions');
      return null;
    }
    
    setIsSimulating(true);
    
    // Store previous results for comparison
    if (simulationResults) {
      setPreviousSimulationResults(simulationResults);
    }
    
    try {
      // Get position parameters
      const positionParams = positions.map(p => ({
        ...getDistributionParams(p),
        weight: (p.quantity * p.price) / positions.reduce((s, pos) => s + pos.quantity * pos.price, 0),
        ticker: p.ticker,
      }));
      
      // Cholesky decomposition for correlated sampling
      const L = choleskyDecomposition(corrMatrix);
      
      // Run Monte Carlo
      const results = runMonteCarloCore({
        positionParams,
        L,
        numPaths,
        fatTailMethod,
        useQmc,
        cashBalance,
        cashRate,
        drawdownThreshold,
      });
      
      setSimulationResults(results);
      setIsSimulating(false);
      
      return results;
    } catch (e) {
      console.error('Simulation failed:', e);
      setIsSimulating(false);
      return null;
    }
  }, [positions, correlationMatrix, editedCorrelation, numPaths, 
      fatTailMethod, useQmc, cashBalance, cashRate, drawdownThreshold,
      getDistributionParams, setIsSimulating, setSimulationResults,
      setPreviousSimulationResults, simulationResults]);
  
  return {
    simulationResults,
    runSimulation,
    workerRef,
  };
};

// Core simulation logic (pure function, no React)
function runMonteCarloCore({ 
  positionParams, L, numPaths, fatTailMethod, 
  useQmc, cashBalance, cashRate, drawdownThreshold 
}) {
  const n = positionParams.length;
  const terminalValues = [];
  const maxDrawdowns = [];
  
  for (let path = 0; path < numPaths; path++) {
    // Generate correlated normal samples
    const z = Array(n).fill(0).map(() => boxMullerPair()[0]);
    const correlated = L.map((row, i) => 
      row.reduce((sum, l, j) => sum + l * z[j], 0)
    );
    
    // Transform to position returns
    let portfolioReturn = 0;
    for (let i = 0; i < n; i++) {
      const { mu, sigma, skew, tailDf, weight } = positionParams[i];
      
      // Student-t transformation for fat tails
      let posReturn;
      if (fatTailMethod === 'multivariateTStudent' && tailDf < 30) {
        const chi2 = generateChiSquared(tailDf);
        const scale = Math.sqrt(tailDf / chi2);
        posReturn = mu + sigma * correlated[i] * scale;
      } else {
        posReturn = mu + sigma * correlated[i];
      }
      
      // Apply skew
      if (skew !== 0) {
        posReturn += skew * sigma * 0.15 * (correlated[i] ** 2 - 1);
      }
      
      portfolioReturn += weight * posReturn;
    }
    
    // Add cash contribution
    const totalValue = positionParams.reduce((s, p) => s + p.weight, 0) + cashBalance;
    if (cashBalance !== 0 && totalValue > 0) {
      portfolioReturn += (cashBalance / totalValue) * cashRate;
    }
    
    terminalValues.push(portfolioReturn);
    maxDrawdowns.push(0); // Simplified - full implementation would track path
  }
  
  // Compute statistics
  terminalValues.sort((a, b) => a - b);
  
  return {
    terminal: {
      mean: terminalValues.reduce((a, b) => a + b, 0) / numPaths,
      p5: terminalValues[Math.floor(numPaths * 0.05)],
      p25: terminalValues[Math.floor(numPaths * 0.25)],
      p50: terminalValues[Math.floor(numPaths * 0.50)],
      p75: terminalValues[Math.floor(numPaths * 0.75)],
      p95: terminalValues[Math.floor(numPaths * 0.95)],
      distribution: terminalValues,
    },
    drawdown: {
      // ... drawdown stats
    },
    contributions: {
      // ... contribution analysis
    },
  };
}
```

### C.4: Create `hooks/useFactorAnalysis.js`

**Function to extract:** `runFactorAnalysis` (~250+ lines of core logic)

```javascript
// hooks/useFactorAnalysis.js
import { useCallback } from 'react';
import { useMarketDataContext } from '../contexts';
import { usePortfolioContext } from '../contexts';
import { useUIContext } from '../contexts';
import { 
  FACTOR_CACHE_KEY, 
  FACTOR_CACHE_MAX_AGE,
  ALL_FACTOR_ETFS,
  FACTOR_SPREAD_DEFINITIONS,
} from '../utils/constants';
import { fetchYahooHistory } from '../utils/yahooFinanceHelpers';

export const useFactorAnalysis = () => {
  const { positions } = usePortfolioContext();
  const { 
    unifiedMarketData,
    factorData, setFactorData,
    factorAnalysis, setFactorAnalysis,
  } = useMarketDataContext();
  const { setIsFetchingFactors } = useUIContext();
  
  const fetchFactorData = useCallback(async () => {
    // Check cache
    try {
      const cached = localStorage.getItem(FACTOR_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < FACTOR_CACHE_MAX_AGE) {
          setFactorData(data);
          return data;
        }
      }
    } catch (e) {
      console.warn('Factor cache read failed:', e);
    }
    
    setIsFetchingFactors(true);
    
    const factorEtfData = {};
    for (const etf of ALL_FACTOR_ETFS) {
      try {
        const history = await fetchYahooHistory(etf, '1y');
        if (history?.prices?.length > 0) {
          factorEtfData[etf] = history.prices;
        }
      } catch (e) {
        console.warn(`Failed to fetch ${etf}:`, e);
      }
      await new Promise(r => setTimeout(r, 50));
    }
    
    // Cache
    try {
      localStorage.setItem(FACTOR_CACHE_KEY, JSON.stringify({
        data: factorEtfData,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Factor cache write failed:', e);
    }
    
    setFactorData(factorEtfData);
    setIsFetchingFactors(false);
    
    return factorEtfData;
  }, [setFactorData, setIsFetchingFactors]);
  
  const runFactorAnalysis = useCallback(async (factorDataInput, marketData = null) => {
    const data = marketData || unifiedMarketData;
    const factors = factorDataInput || factorData;
    
    if (!factors || !data) {
      console.warn('Missing factor or market data');
      return null;
    }
    
    // Compute factor returns
    const factorReturns = {};
    for (const [factor, def] of Object.entries(FACTOR_SPREAD_DEFINITIONS)) {
      const longReturns = computeReturnsFromPrices(factors[def.long]);
      const shortReturns = computeReturnsFromPrices(factors[def.short]);
      if (longReturns && shortReturns) {
        factorReturns[factor] = longReturns.map((r, i) => r - (shortReturns[i] || 0));
      }
    }
    
    // Regress each position against factors
    const analysis = {};
    for (const pos of positions) {
      const ticker = pos.ticker.toUpperCase();
      const tickerData = data[ticker];
      if (!tickerData?.dailyReturns) continue;
      
      analysis[ticker] = runRegression(tickerData.dailyReturns, factorReturns);
    }
    
    setFactorAnalysis(analysis);
    return analysis;
  }, [positions, unifiedMarketData, factorData, setFactorAnalysis]);
  
  return {
    factorData,
    factorAnalysis,
    fetchFactorData,
    runFactorAnalysis,
  };
};

// Helper functions
function computeReturnsFromPrices(prices) {
  if (!prices || prices.length < 2) return null;
  return prices.slice(1).map((p, i) => (p.close - prices[i].close) / prices[i].close);
}

function runRegression(returns, factorReturns) {
  // Simple OLS regression
  // Returns { betas: { MKT, SMB, HML, ... }, r2, residualVol }
  // Implementation details...
  return { betas: {}, r2: 0, residualVol: 0 };
}
```

### C.5: Create `hooks/useOptimization.js`

**Function to extract:** `runPortfolioOptimization` (~300+ lines)

```javascript
// hooks/useOptimization.js
import { useCallback } from 'react';
import { useSimulationContext } from '../contexts';
import { usePortfolioContext } from '../contexts';
import { useMarketDataContext } from '../contexts';
import { useUIContext } from '../contexts';
import {
  computePortfolioVolatility,
  computePortfolioReturn,
  computeSharpeRatio,
  computeMCTR,
  computeRiskContribution,
} from '../utils/portfolioOptimization';

export const useOptimization = () => {
  const { positions, riskFreeRate, swapSize, optimizationPaths } = usePortfolioContext();
  const { correlationMatrix, editedCorrelation } = useMarketDataContext();
  const { 
    optimizationResults, setOptimizationResults,
    setSelectedSwap, setSwapValidationResults,
  } = useSimulationContext();
  const { setIsOptimizing, setOptimizationProgress } = useUIContext();
  
  const runPortfolioOptimization = useCallback(async (corrMatrixParam = null) => {
    const corrMatrix = corrMatrixParam || editedCorrelation || correlationMatrix;
    if (!corrMatrix || !positions.length) return null;
    
    setIsOptimizing(true);
    setOptimizationProgress({ current: 0, total: 100, phase: 'Starting...' });
    
    try {
      // Get weights and volatilities
      const totalValue = positions.reduce((s, p) => s + p.quantity * p.price, 0);
      const weights = positions.map(p => (p.quantity * p.price) / totalValue);
      const vols = positions.map(p => p.sigma || 0.2);
      
      // Compute current metrics
      const portfolioVol = computePortfolioVolatility(weights, vols, corrMatrix);
      const portfolioReturn = computePortfolioReturn(weights, positions.map(p => p.mu || 0.1));
      const sharpe = computeSharpeRatio(portfolioReturn, portfolioVol, riskFreeRate);
      
      // Compute MCTR for each position
      const mctrs = positions.map((_, i) => 
        computeMCTR(weights, vols, corrMatrix, i, portfolioVol)
      );
      
      // Compute risk contribution
      const riskContrib = computeRiskContribution(weights, mctrs, portfolioVol);
      
      // Find potential swaps
      const swaps = findOptimalSwaps(positions, weights, vols, corrMatrix, riskFreeRate);
      
      const results = {
        current: { portfolioVol, portfolioReturn, sharpe },
        positions: positions.map((p, i) => ({
          ticker: p.ticker,
          weight: weights[i],
          mctr: mctrs[i],
          riskContrib: riskContrib[i],
        })),
        recommendedSwaps: swaps,
        timestamp: Date.now(),
      };
      
      setOptimizationResults(results);
      setIsOptimizing(false);
      
      return results;
    } catch (e) {
      console.error('Optimization failed:', e);
      setIsOptimizing(false);
      return null;
    }
  }, [positions, correlationMatrix, editedCorrelation, riskFreeRate,
      setIsOptimizing, setOptimizationProgress, setOptimizationResults]);
  
  return {
    optimizationResults,
    runPortfolioOptimization,
    setSelectedSwap,
    setSwapValidationResults,
  };
};

function findOptimalSwaps(positions, weights, vols, corrMatrix, riskFreeRate) {
  // Analyze potential swaps and return sorted recommendations
  return [];
}
```

### C.6: Update `hooks/index.js`

```javascript
// hooks/index.js
export { useAutosave, AutosaveStatus } from './useAutosave';
export { useUndoRedo } from './useUndoRedo';
export { useChartInteraction } from './useChartInteraction';
export { useLocalStorage } from './useLocalStorage';

// NEW hooks
export { useMarketData } from './useMarketData';
export { useCorrelation } from './useCorrelation';
export { useSimulation } from './useSimulation';
export { useFactorAnalysis } from './useFactorAnalysis';
export { useOptimization } from './useOptimization';
```

### C.7: Git Strategy for Phase C

```bash
git checkout -b refactor/phase-c-hooks

# Create each hook and test
git add src/hooks/useMarketData.js
git commit -m "Create useMarketData hook"

git add src/hooks/useCorrelation.js
git commit -m "Create useCorrelation hook"

git add src/hooks/useSimulation.js
git commit -m "Create useSimulation hook"

git add src/hooks/useFactorAnalysis.js
git commit -m "Create useFactorAnalysis hook"

git add src/hooks/useOptimization.js
git commit -m "Create useOptimization hook"

git add src/hooks/index.js
git commit -m "Export all hooks from index"

npm run build && npm test

git checkout main
git merge refactor/phase-c-hooks
```

### Phase C Verification Checklist
- [ ] Each hook can be imported without errors
- [ ] Hooks use contexts correctly
- [ ] No circular dependencies
- [ ] `npm run build` succeeds
- [ ] Type errors are resolved (if using TypeScript)

---

## Phase D: Refactor App.jsx (3-4 hours)

### Risk Level: 🔴 HIGH
This is the integration phase. Test frequently. Keep original code commented until verified.

### D.1: Wrap App with Providers

```javascript
// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AllProviders } from './contexts';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AllProviders>
      <App />
    </AllProviders>
  </React.StrictMode>
);
```

### D.2: Refactor MonteCarloSimulator Component

The component should now:
1. Import from contexts instead of using useState
2. Import hooks instead of defining functions inline
3. Wire up the hooks to the UI

**Before (8,000+ lines):**
```javascript
function MonteCarloSimulator() {
  const [positions, setPositions] = useState(...);
  const [correlationMatrix, setCorrelationMatrix] = useState(...);
  // ... 40 more useState
  
  const fetchUnifiedMarketData = useCallback(async () => { /* 400 lines */ }, []);
  const runSimulation = useCallback(async () => { /* 400 lines */ }, []);
  // ... more functions
  
  return (/* render */);
}
```

**After (~2,000 lines):**
```javascript
function MonteCarloSimulator() {
  // Get state from contexts
  const { positions, setPositions, ... } = usePortfolioContext();
  const { correlationMatrix, ... } = useMarketDataContext();
  const { simulationResults, ... } = useSimulationContext();
  const { isSimulating, ... } = useUIContext();
  
  // Get actions from hooks
  const { fetchUnifiedMarketData } = useMarketData();
  const { computeCorrelationMatrix } = useCorrelation();
  const { runSimulation } = useSimulation();
  const { runFactorAnalysis } = useFactorAnalysis();
  const { runPortfolioOptimization } = useOptimization();
  
  // Only component-specific logic remains
  // - Keyboard handlers
  // - Event handlers that call hooks
  // - Render logic
  
  return (/* render */);
}
```

### D.3: Migration Script

Create a migration helper to track what's been moved:

```javascript
// scripts/migration-tracker.js
const migrations = {
  'useState hooks': {
    total: 42,
    migrated: 0,
    remaining: [
      'positions', 'activeTab', 'sidebarExpanded', 'windowWidth',
      'correlationMatrix', 'editedCorrelation', 'simulationResults',
      // ... list all
    ]
  },
  'functions': {
    total: 25,
    migrated: 0,
    remaining: [
      'fetchUnifiedMarketData', 'fetchAndComputeCorrelation',
      'runSimulation', 'runFactorAnalysis', 'runPortfolioOptimization',
      // ... list all
    ]
  }
};

// Update as you migrate
```

### D.4: Incremental Migration Steps

**Step 1: Migrate UI state first (lowest risk)**
```javascript
// Replace:
const [activeTab, setActiveTab] = useState('positions');
// With:
const { activeTab, setActiveTab } = useUIContext();
```

**Step 2: Migrate portfolio state**
```javascript
// Replace:
const [positions, setPositions] = useState(...);
// With:
const { positions, setPositions } = usePortfolioContext();
```

**Step 3: Migrate market data state**
```javascript
// Replace:
const [correlationMatrix, setCorrelationMatrix] = useState(null);
// With:
const { correlationMatrix, setCorrelationMatrix } = useMarketDataContext();
```

**Step 4: Migrate simulation state**
```javascript
// Replace:
const [simulationResults, setSimulationResults] = useState(null);
// With:
const { simulationResults, setSimulationResults } = useSimulationContext();
```

**Step 5: Replace function definitions with hook calls**
```javascript
// Replace 400-line fetchUnifiedMarketData definition with:
const { fetchUnifiedMarketData } = useMarketData();
```

### D.5: Git Strategy for Phase D

```bash
git checkout -b refactor/phase-d-integration

# Make small, incremental commits
git commit -m "Wrap app with AllProviders"
git commit -m "Migrate UI state to UIContext"
git commit -m "Migrate portfolio state to PortfolioContext"
git commit -m "Migrate market data state to MarketDataContext"
git commit -m "Migrate simulation state to SimulationContext"
git commit -m "Replace fetchUnifiedMarketData with hook"
git commit -m "Replace runSimulation with hook"
# ... more commits

# Test after each commit!
npm run build && npm start
# Manual testing of each feature

git checkout main
git merge refactor/phase-d-integration
```

### D.6: Testing Checklist After Each Step

- [ ] App loads without white screen
- [ ] Console has no React errors
- [ ] Positions display correctly
- [ ] Market data can be fetched
- [ ] Correlation matrix computes
- [ ] Simulation runs
- [ ] Results display correctly
- [ ] All tabs navigate properly
- [ ] Modals open/close
- [ ] Undo/redo works
- [ ] Save/load works

---

## Phase E: Testing & Verification (2-3 hours)

### Risk Level: 🟢 LOW
Verification and cleanup. No new code.

### E.1: Comprehensive Feature Test

| Feature | Test Steps | Expected Result |
|---------|------------|-----------------|
| Initial load | Open app fresh | Default positions shown |
| Add position | Click add, enter ticker | New position appears |
| Edit position | Change quantity | Value updates |
| Delete position | Click delete | Position removed |
| Undo/redo | Make change, Cmd+Z | Change reverted |
| Fetch data | Click refresh | Data loads, correlations update |
| Run simulation | Click simulate | Results display |
| View correlation | Go to correlation tab | Matrix renders |
| Edit correlation | Click cell, change value | Value updates |
| Run factors | Go to factors tab | Factor analysis runs |
| Run optimization | Go to optimize tab | Recommendations show |
| Export | Click export | JSON/CSV downloads |
| Save state | Reload page | State persists |

### E.2: Performance Verification

```javascript
// Add performance markers
console.time('simulation');
await runSimulation();
console.timeEnd('simulation');

// Compare with baseline (before refactor)
// Acceptable: within 10% of original
```

### E.3: Bundle Size Analysis

```bash
# Before refactor
npm run build
du -sh dist/assets/*.js

# After refactor
npm run build
du -sh dist/assets/*.js

# Should be similar or smaller
```

### E.4: Code Quality Checks

```bash
# Linting
npm run lint

# Type checking (if applicable)
npm run typecheck

# Dead code analysis
npx depcheck
```

### E.5: Remove Dead Code

After verification:
1. Remove commented-out old code
2. Remove unused imports
3. Remove unused functions
4. Clean up console.logs

### E.6: Documentation Update

```javascript
// Add JSDoc comments to new files
/**
 * @module hooks/useMarketData
 * @description Custom hook for fetching and managing market data
 * 
 * @example
 * const { fetchUnifiedMarketData, unifiedMarketData } = useMarketData();
 * await fetchUnifiedMarketData();
 */
```

---

## Success Metrics

### Quantitative

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| App.jsx lines | 8,413 | ≤2,000 | ___ |
| useState in App.jsx | 42 | 0 | ___ |
| Largest function | ~400 lines | ≤100 lines | ___ |
| Contexts | 1 | 4 | ___ |
| Custom hooks | 4 | 9 | ___ |
| Build time | ___s | ≤___s | ___ |
| Bundle size | ___KB | ≤___KB | ___ |

### Qualitative

- [ ] Code is more readable
- [ ] State management is predictable
- [ ] Adding features is easier
- [ ] Bug isolation is improved
- [ ] Testing is more straightforward

---

## Risk Mitigation Summary

| Risk | Mitigation |
|------|------------|
| Breaking app | Incremental commits, test after each |
| State sync issues | Keep contexts small and focused |
| Performance regression | Profile before/after |
| Circular dependencies | Clear dependency direction |
| Lost functionality | Feature checklist testing |
| Merge conflicts | Feature branches, small PRs |

---

## Timeline Summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| A: Utilities | 2-3 hrs | 2-3 hrs |
| B: Contexts | 3-4 hrs | 5-7 hrs |
| C: Hooks | 4-6 hrs | 9-13 hrs |
| D: Integration | 3-4 hrs | 12-17 hrs |
| E: Testing | 2-3 hrs | 14-20 hrs |

**Recommended approach:** Complete one phase per day for manageable risk and thorough testing.

---

## Quick Reference: What Goes Where

### Contexts (State)
- **UIContext**: tabs, modals, loading flags, progress
- **PortfolioContext**: positions, cash, settings, undo/redo
- **MarketDataContext**: market data, correlations, factors
- **SimulationContext**: results, optimization, swaps

### Hooks (Actions)
- **useMarketData**: fetch market data
- **useCorrelation**: compute correlation matrix
- **useSimulation**: run Monte Carlo
- **useFactorAnalysis**: run factor analysis
- **useOptimization**: run portfolio optimization

### Utils (Pure Functions)
- **constants.js**: config, ETF mappings
- **statistics.js**: math functions
- **yahooFinanceHelpers.js**: API helpers
- **factorCompute.js**: factor calculations

---

## Next Steps

1. **Create git branch**: `git checkout -b refactor/monte-carlo-cleanup`
2. **Start Phase A**: Extract utilities (safest)
3. **Test thoroughly**: Build and run after each change
4. **Continue phases**: B → C → D → E
5. **Review**: Get code review before merging

Good luck! 🚀
