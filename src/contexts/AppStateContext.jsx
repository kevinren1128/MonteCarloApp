import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAutosave, AutosaveStatus, useUndoRedo } from '../hooks';
import {
  STORAGE_KEY,
  saveToStorage,
  loadFromStorage,
  UNIFIED_CACHE_KEY,
  UNIFIED_CACHE_MAX_AGE,
} from '../services/cacheManager';
import { toast } from '../components/common';
import {
  rehydrateTickerData,
  prepareForStorage,
} from '../utils/marketDataHelpers';

/**
 * AppStateContext - Comprehensive state management for Monte Carlo App
 *
 * This context consolidates ALL application state that was previously in App.jsx,
 * making it accessible to any component via useAppState() hook.
 */

const AppStateContext = createContext(null);

export function AppStateProvider({ children }) {
  // Load saved data on mount
  const savedData = useMemo(() => loadFromStorage(), []);

  // ============================================
  // PORTFOLIO STATE
  // ============================================
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

    return savedData.positions.map(pos => {
      if (pos.p5 !== undefined) return pos;
      const mu = pos.mu || 0.10;
      const sigma = pos.sigma || 0.20;
      const skew = pos.skew || 0;
      const skewAdj = skew * 0.15;
      return {
        ...pos,
        p5: mu - 1.645 * sigma + skewAdj,
        p25: mu - 0.675 * sigma + skewAdj * 0.5,
        p50: mu + skewAdj * 0.2,
        p75: mu + 0.675 * sigma + skewAdj * 0.5,
        p95: mu + 1.645 * sigma + skewAdj,
      };
    });
  });

  const [cashBalance, setCashBalance] = useState(savedData?.cashBalance ?? 0);
  const [cashRate, setCashRate] = useState(savedData?.cashRate ?? 0.05);

  // Position filtering/sorting
  const [positionSort, setPositionSort] = useState({ column: 'value', direction: 'desc' });
  const [positionFilter, setPositionFilter] = useState('all');
  const [positionSearch, setPositionSearch] = useState('');

  // ============================================
  // UI STATE
  // ============================================
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
  const [showMethodologyExplainer, setShowMethodologyExplainer] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [recoveryData, setRecoveryData] = useState(null);

  // ============================================
  // MARKET DATA STATE
  // ============================================
  const [unifiedMarketData, setUnifiedMarketData] = useState({});
  const [historicalData, setHistoricalData] = useState({});
  const [positionMetadata, setPositionMetadata] = useState(savedData?.positionMetadata || {});
  const [positionBetas, setPositionBetas] = useState({});
  const [calendarYearReturns, setCalendarYearReturns] = useState(savedData?.calendarYearReturns || {});
  const [factorData, setFactorData] = useState(null);
  const [factorAnalysis, setFactorAnalysis] = useState(null);
  const [lagAnalysis, setLagAnalysis] = useState(null);
  const [thematicOverrides, setThematicOverrides] = useState({});

  // Loading states
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [isFetchingUnified, setIsFetchingUnified] = useState(false);
  const [isFetchingBetas, setIsFetchingBetas] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isFetchingFactors, setIsFetchingFactors] = useState(false);
  const [isFetchingYearReturns, setIsFetchingYearReturns] = useState(false);
  const [isAnalyzingLag, setIsAnalyzingLag] = useState(false);
  const [unifiedFetchProgress, setUnifiedFetchProgress] = useState({ current: 0, total: 0, message: '' });

  const [dataSource, setDataSource] = useState('none');
  const [fetchErrors, setFetchErrors] = useState([]);
  const [historyTimeline, setHistoryTimeline] = useState('1y');
  const [useLagAdjusted, setUseLagAdjusted] = useState(false);

  // ============================================
  // CORRELATION STATE
  // ============================================
  const [correlationMatrix, setCorrelationMatrix] = useState(savedData?.correlationMatrix || null);
  const [editedCorrelation, setEditedCorrelation] = useState(savedData?.editedCorrelation || null);
  const [correlationMethod, setCorrelationMethod] = useState(savedData?.correlationMethod || 'shrinkage');
  const [correlationGroups, setCorrelationGroups] = useState(savedData?.correlationGroups || null);
  const [useEwma, setUseEwma] = useState(savedData?.useEwma ?? true);
  const [gldAsCash, setGldAsCash] = useState(savedData?.gldAsCash || false);
  const [matrixViewMode, setMatrixViewMode] = useState('correlation');

  // ============================================
  // SIMULATION STATE
  // ============================================
  const [simulationResults, setSimulationResults] = useState(savedData?.simulationResults || null);
  const [previousSimulationResults, setPreviousSimulationResults] = useState(null);
  const [numPaths, setNumPaths] = useState(savedData?.numPaths || 10000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [fatTailMethod, setFatTailMethod] = useState(savedData?.fatTailMethod || 'multivariateTStudent');
  const [useQmc, setUseQmc] = useState(savedData?.useQmc || false);
  const [drawdownThreshold, setDrawdownThreshold] = useState(savedData?.drawdownThreshold || 20);
  const [hoveredScenario, setHoveredScenario] = useState(null);

  // ============================================
  // OPTIMIZATION STATE
  // ============================================
  const validatedOptResults = (() => {
    const saved = savedData?.optimizationResults;
    if (!saved) return null;
    if (!saved.current || !saved.positions || !Array.isArray(saved.positions)) {
      console.log('Clearing invalid optimization results from localStorage');
      return null;
    }
    return saved;
  })();

  const [optimizationResults, setOptimizationResults] = useState(validatedOptResults);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState({ current: 0, total: 0, phase: '' });
  const [selectedSwap, setSelectedSwap] = useState(null);
  const [swapValidationResults, setSwapValidationResults] = useState(null);
  const [riskFreeRate, setRiskFreeRate] = useState(0.05);
  const [swapSize, setSwapSize] = useState(savedData?.swapSize ?? 0.01);
  const [optimizationPaths, setOptimizationPaths] = useState(savedData?.optimizationPaths ?? 100000);
  const [thematicSwapResults, setThematicSwapResults] = useState(null);
  const [isRunningThematicSwaps, setIsRunningThematicSwaps] = useState(false);
  const [thematicSwapProgress, setThematicSwapProgress] = useState({ current: 0, total: 0, phase: '' });

  // Full load state
  const [isFullLoading, setIsFullLoading] = useState(false);
  const [fullLoadProgress, setFullLoadProgress] = useState({ step: 0, total: 8, phase: '', detail: '' });

  // ============================================
  // AUTOSAVE & UNDO/REDO
  // ============================================
  const [autosaveStatus, setAutosaveStatus] = useState(AutosaveStatus.IDLE);
  const [lastSaved, setLastSaved] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const positionsHistoryRef = useRef([]);
  const positionsFutureRef = useRef([]);
  const tickerFetchTimeoutRef = useRef({});
  const lastHoverUpdate = useRef(0);
  const runFullLoadRef = useRef(null);

  // ============================================
  // COMPUTED VALUES
  // ============================================
  const portfolioValue = useMemo(() => {
    const positionsValue = positions.reduce((sum, pos) => {
      const price = pos.price || 0;
      const quantity = pos.quantity || 0;
      return sum + (price * quantity);
    }, 0);
    return positionsValue + cashBalance;
  }, [positions, cashBalance]);

  const grossPositionsValue = useMemo(() => {
    return positions.reduce((sum, pos) => {
      const price = pos.price || 0;
      const quantity = Math.abs(pos.quantity || 0);
      return sum + (price * quantity);
    }, 0);
  }, [positions]);

  const cashWeight = useMemo(() => {
    return portfolioValue > 0 ? cashBalance / portfolioValue : 0;
  }, [cashBalance, portfolioValue]);

  const isCompact = windowWidth < 1400;
  const isNarrow = windowWidth < 1200;

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const showToast = useCallback((options) => {
    if (options.type === 'success') toast.success(options.message, options);
    else if (options.type === 'error') toast.error(options.message, options);
    else if (options.type === 'warning') toast.warning(options.message, options);
    else toast.info(options.message, options);
  }, []);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    localStorage.setItem('mc-welcome-dismissed', 'true');
  }, []);

  const getDistributionParams = useCallback((pos) => {
    const p5 = pos.p5 ?? (pos.mu ? pos.mu - 1.645 * (pos.sigma || 0.2) : -0.20);
    const p25 = pos.p25 ?? (pos.mu ? pos.mu - 0.675 * (pos.sigma || 0.2) : 0.02);
    const p50 = pos.p50 ?? (pos.mu || 0.10);
    const p75 = pos.p75 ?? (pos.mu ? pos.mu + 0.675 * (pos.sigma || 0.2) : 0.18);
    const p95 = pos.p95 ?? (pos.mu ? pos.mu + 1.645 * (pos.sigma || 0.2) : 0.35);

    const mu = isFinite(p50) ? p50 : 0.10;
    const iqr = (p75 || 0.18) - (p25 || 0.02);
    const sigma = Math.max(0.01, Math.abs(iqr) / 1.35);

    const upperTail = Math.max(0.01, (p95 || 0.35) - (p50 || 0.10));
    const lowerTail = Math.max(0.01, (p50 || 0.10) - (p5 || -0.20));
    const skewRaw = (upperTail - lowerTail) / (upperTail + lowerTail + 0.001);
    const skew = Math.max(-1, Math.min(1, isFinite(skewRaw) ? skewRaw * 1.5 : 0));

    const expectedSpread = 2 * 1.645 * sigma;
    const actualSpread = Math.abs((p95 || 0.35) - (p5 || -0.20));
    const tailRatio = actualSpread / (expectedSpread + 0.001);
    const tailDf = Math.max(3, Math.min(30, Math.round(30 / Math.max(0.8, tailRatio))));

    return {
      mu: isFinite(mu) ? mu : 0.10,
      sigma: isFinite(sigma) ? sigma : 0.20,
      skew: isFinite(skew) ? skew : 0,
      tailDf: isFinite(tailDf) ? tailDf : 30
    };
  }, []);

  // ============================================
  // EFFECTS
  // ============================================

  // Window resize listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load cached unified data on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(UNIFIED_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < UNIFIED_CACHE_MAX_AGE && data) {
          const rehydratedData = {};
          const spyData = data['SPY'];

          if (spyData) {
            rehydratedData['SPY'] = rehydrateTickerData(spyData, null);
          }

          for (const [ticker, d] of Object.entries(data)) {
            if (ticker !== 'SPY') {
              rehydratedData[ticker] = rehydrateTickerData(d, rehydratedData['SPY']);
            }
          }

          setUnifiedMarketData(rehydratedData);

          const betas = {};
          const metadata = {};
          const yearReturns = {};
          Object.entries(rehydratedData).forEach(([ticker, d]) => {
            if (d.beta != null) {
              betas[ticker] = {
                beta: d.beta,
                correlation: d.correlation,
                volatility: d.volatility,
                ytdReturn: d.ytdReturn,
                oneYearReturn: d.oneYearReturn,
                sparklineData: d.sparkline,
                betaLag: d.betaLag,
                isInternational: d.isInternational,
              };
            }
            if (d.name || d.sector) {
              metadata[ticker] = {
                name: d.name,
                sector: d.sector,
                industry: d.industry,
              };
            }
            if (d.calendarYearReturns) {
              yearReturns[ticker] = d.calendarYearReturns;
            }
          });
          setPositionBetas(betas);
          setPositionMetadata(prev => ({ ...prev, ...metadata }));
          setCalendarYearReturns(prev => ({ ...prev, ...yearReturns }));

          console.log(`Loaded unified cache: ${Object.keys(rehydratedData).length} tickers`);
        }
      }
    } catch (e) {
      console.warn('Failed to load unified cache:', e);
    }
  }, []);

  // Save sidebar state
  useEffect(() => {
    localStorage.setItem('sidebar-expanded', JSON.stringify(sidebarExpanded));
  }, [sidebarExpanded]);

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value = useMemo(() => ({
    // Portfolio
    positions,
    setPositions,
    cashBalance,
    setCashBalance,
    cashRate,
    setCashRate,
    positionSort,
    setPositionSort,
    positionFilter,
    setPositionFilter,
    positionSearch,
    setPositionSearch,
    portfolioValue,
    grossPositionsValue,
    cashWeight,

    // UI
    activeTab,
    setActiveTab,
    sidebarExpanded,
    setSidebarExpanded,
    windowWidth,
    isCompact,
    isNarrow,
    showWelcome,
    setShowWelcome,
    dismissWelcome,
    showKeyboardShortcuts,
    setShowKeyboardShortcuts,
    showUserGuide,
    setShowUserGuide,
    showAddPositionsModal,
    setShowAddPositionsModal,
    showScreenshotImportModal,
    setShowScreenshotImportModal,
    showCommandPalette,
    setShowCommandPalette,
    showRecoveryDialog,
    setShowRecoveryDialog,
    showMethodologyExplainer,
    setShowMethodologyExplainer,
    confirmDialog,
    setConfirmDialog,
    recoveryData,
    setRecoveryData,
    showToast,

    // Market Data
    unifiedMarketData,
    setUnifiedMarketData,
    historicalData,
    setHistoricalData,
    positionMetadata,
    setPositionMetadata,
    positionBetas,
    setPositionBetas,
    calendarYearReturns,
    setCalendarYearReturns,
    factorData,
    setFactorData,
    factorAnalysis,
    setFactorAnalysis,
    lagAnalysis,
    setLagAnalysis,
    thematicOverrides,
    setThematicOverrides,
    dataSource,
    setDataSource,
    fetchErrors,
    setFetchErrors,
    historyTimeline,
    setHistoryTimeline,
    useLagAdjusted,
    setUseLagAdjusted,

    // Loading states
    isFetchingData,
    setIsFetchingData,
    isFetchingUnified,
    setIsFetchingUnified,
    isFetchingBetas,
    setIsFetchingBetas,
    isFetchingMetadata,
    setIsFetchingMetadata,
    isFetchingFactors,
    setIsFetchingFactors,
    isFetchingYearReturns,
    setIsFetchingYearReturns,
    isAnalyzingLag,
    setIsAnalyzingLag,
    unifiedFetchProgress,
    setUnifiedFetchProgress,

    // Correlation
    correlationMatrix,
    setCorrelationMatrix,
    editedCorrelation,
    setEditedCorrelation,
    correlationMethod,
    setCorrelationMethod,
    correlationGroups,
    setCorrelationGroups,
    useEwma,
    setUseEwma,
    gldAsCash,
    setGldAsCash,
    matrixViewMode,
    setMatrixViewMode,

    // Simulation
    simulationResults,
    setSimulationResults,
    previousSimulationResults,
    setPreviousSimulationResults,
    numPaths,
    setNumPaths,
    isSimulating,
    setIsSimulating,
    fatTailMethod,
    setFatTailMethod,
    useQmc,
    setUseQmc,
    drawdownThreshold,
    setDrawdownThreshold,
    hoveredScenario,
    setHoveredScenario,

    // Optimization
    optimizationResults,
    setOptimizationResults,
    isOptimizing,
    setIsOptimizing,
    optimizationProgress,
    setOptimizationProgress,
    selectedSwap,
    setSelectedSwap,
    swapValidationResults,
    setSwapValidationResults,
    riskFreeRate,
    setRiskFreeRate,
    swapSize,
    setSwapSize,
    optimizationPaths,
    setOptimizationPaths,
    thematicSwapResults,
    setThematicSwapResults,
    isRunningThematicSwaps,
    setIsRunningThematicSwaps,
    thematicSwapProgress,
    setThematicSwapProgress,
    isFullLoading,
    setIsFullLoading,
    fullLoadProgress,
    setFullLoadProgress,

    // Autosave/Undo
    autosaveStatus,
    setAutosaveStatus,
    lastSaved,
    setLastSaved,
    canUndo,
    setCanUndo,
    canRedo,
    setCanRedo,

    // Refs
    positionsHistoryRef,
    positionsFutureRef,
    tickerFetchTimeoutRef,
    lastHoverUpdate,
    runFullLoadRef,

    // Helpers
    getDistributionParams,
  }), [
    positions, cashBalance, cashRate, positionSort, positionFilter, positionSearch,
    portfolioValue, grossPositionsValue, cashWeight,
    activeTab, sidebarExpanded, windowWidth, isCompact, isNarrow,
    showWelcome, showKeyboardShortcuts, showUserGuide, showAddPositionsModal,
    showScreenshotImportModal, showCommandPalette, showRecoveryDialog,
    showMethodologyExplainer, confirmDialog, recoveryData, showToast, dismissWelcome,
    unifiedMarketData, historicalData, positionMetadata, positionBetas,
    calendarYearReturns, factorData, factorAnalysis, lagAnalysis, thematicOverrides,
    dataSource, fetchErrors, historyTimeline, useLagAdjusted,
    isFetchingData, isFetchingUnified, isFetchingBetas, isFetchingMetadata,
    isFetchingFactors, isFetchingYearReturns, isAnalyzingLag, unifiedFetchProgress,
    correlationMatrix, editedCorrelation, correlationMethod, correlationGroups,
    useEwma, gldAsCash, matrixViewMode,
    simulationResults, previousSimulationResults, numPaths, isSimulating,
    fatTailMethod, useQmc, drawdownThreshold, hoveredScenario,
    optimizationResults, isOptimizing, optimizationProgress, selectedSwap,
    swapValidationResults, riskFreeRate, swapSize, optimizationPaths,
    thematicSwapResults, isRunningThematicSwaps, thematicSwapProgress,
    isFullLoading, fullLoadProgress,
    autosaveStatus, lastSaved, canUndo, canRedo,
    getDistributionParams,
  ]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
}

export default AppStateContext;
