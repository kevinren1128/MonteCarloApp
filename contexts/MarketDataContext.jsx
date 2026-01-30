import React, { createContext, useContext, useReducer, useCallback, useEffect, useMemo } from 'react';
import { UNIFIED_CACHE_KEY, UNIFIED_CACHE_MAX_AGE, FACTOR_CACHE_KEY, FACTOR_CACHE_MAX_AGE } from '../utils/constants';

const MarketDataContext = createContext(null);

const marketDataReducer = (state, action) => {
  switch (action.type) {
    case 'SET_UNIFIED_DATA':
      return { ...state, unifiedMarketData: action.payload, dataSource: 'api' };
    case 'SET_HISTORICAL_DATA':
      return { ...state, historicalData: action.payload };
    case 'SET_CORRELATION_MATRIX':
      return { ...state, correlationMatrix: action.payload };
    case 'SET_EDITED_CORRELATION':
      return { ...state, editedCorrelation: action.payload };
    case 'SET_CORRELATION_GROUPS':
      return { ...state, correlationGroups: action.payload };
    case 'SET_LAG_ANALYSIS':
      return { ...state, lagAnalysis: action.payload };
    case 'SET_FACTOR_DATA':
      return { ...state, factorData: action.payload };
    case 'SET_FACTOR_ANALYSIS':
      return { ...state, factorAnalysis: action.payload };
    case 'SET_POSITION_BETAS':
      return { ...state, positionBetas: action.payload };
    case 'SET_MATRIX_VIEW_MODE':
      return { ...state, matrixViewMode: action.payload };
    case 'RESET_EDITED_CORRELATION':
      return { ...state, editedCorrelation: state.correlationMatrix };
    default:
      return state;
  }
};

export const MarketDataProvider = ({ children }) => {
  const initialState = {
    unifiedMarketData: {},
    historicalData: {},
    dataSource: 'none',
    fetchErrors: [],
    calendarYearReturns: {},
    correlationMatrix: null,
    editedCorrelation: null,
    correlationGroups: null,
    lagAnalysis: null,
    useLagAdjusted: false,
    factorData: null,
    factorAnalysis: null,
    positionBetas: {},
    matrixViewMode: 'correlation'
  };

  const [state, dispatch] = useReducer(marketDataReducer, initialState);

  // Cache management
  useEffect(() => {
    // Handle cache persistence for unified market data
    if (state.dataSource === 'api' && Object.keys(state.unifiedMarketData).length > 0) {
      try {
        localStorage.setItem(UNIFIED_CACHE_KEY, JSON.stringify({
          data: state.unifiedMarketData,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to save market data to cache:', e);
      }
    }
  }, [state.unifiedMarketData, state.dataSource]);

  useEffect(() => {
    // Load cache on mount
    try {
      const cached = localStorage.getItem(UNIFIED_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < UNIFIED_CACHE_MAX_AGE && data) {
          dispatch({ type: 'SET_UNIFIED_DATA', payload: data });
        }
      }
    } catch (e) {
      console.warn('Failed to load cached market data:', e);
    }
  }, []);

  // Action creators
  const setUnifiedData = useCallback((data) => {
    dispatch({ type: 'SET_UNIFIED_DATA', payload: data });
  }, []);

  const setHistoricalData = useCallback((data) => {
    dispatch({ type: 'SET_HISTORICAL_DATA', payload: data });
  }, []);

  const setCorrelationMatrix = useCallback((matrix) => {
    dispatch({ type: 'SET_CORRELATION_MATRIX', payload: matrix });
    if (state.editedCorrelation === null) {
      dispatch({ type: 'SET_EDITED_CORRELATION', payload: matrix });
    }
  }, [state.editedCorrelation]);

  const setEditedCorrelation = useCallback((matrix) => {
    dispatch({ type: 'SET_EDITED_CORRELATION', payload: matrix });
  }, []);

  const resetEditedCorrelation = useCallback(() => {
    if (state.correlationMatrix) {
      dispatch({ type: 'RESET_EDITED_CORRELATION' });
    }
  }, [state.correlationMatrix]);

  const addFetchError = useCallback((error) => {
    dispatch({ type: 'SET_FETCH_ERRORS', payload: [...state.fetchErrors, error] });
  }, [state.fetchErrors]);

  const clearFetchErrors = useCallback(() => {
    dispatch({ type: 'SET_FETCH_ERRORS', payload: [] });
  }, []);

  const setMatrixViewMode = useCallback((mode) => {
    dispatch({ type: 'SET_MATRIX_VIEW_MODE', payload: mode });
  }, []);

  // Derived values
  const hasData = useMemo(() => Object.keys(state.unifiedMarketData).length > 0, [state.unifiedMarketData]);
  const hasCorrelation = useMemo(() => state.correlationMatrix !== null, [state.correlationMatrix]);
  const isDataFresh = useMemo(() => {
    return state.dataSource === 'api' || Date.now() < UNIFIED_CACHE_MAX_AGE;
  }, [state.dataSource]);

  const value = {
    ...state,
    hasData,
    hasCorrelation,
    isDataFresh,
    // Actions
    setUnifiedData,
    setHistoricalData,
    setCorrelationMatrix,
    setEditedCorrelation,
    resetEditedCorrelation,
    addFetchError,
    clearFetchErrors,
    setMatrixViewMode
  };

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
};

export const useMarketDataContext = () => {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketDataContext must be used within MarketDataProvider');
  }
  return context;
};
