import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

/**
 * @typedef {Object} MarketDataPoint
 * @property {string} date - Date in ISO format
 * @property {number} close - Closing price
 * @property {number} return - Daily return
 */

/**
 * @typedef {Object} PositionMetadata
 * @property {string} ticker - Stock ticker
 * @property {string} name - Company name
 * @property {string} sector - Sector classification
 * @property {number} marketCap - Market capitalization
 */

/**
 * @typedef {Object} MarketDataState
 * @property {Object.<string, MarketDataPoint[]>} unifiedMarketData - Historical market data by ticker
 * @property {Object.<string, PositionMetadata>} positionMetadata - Metadata for each position
 * @property {Object.<string, number>} positionBetas - Beta values for each position
 * @property {Object} factorData - Factor model data (market, size, value, etc.)
 * @property {Object} lagAnalysis - Lag correlation analysis results
 * @property {Object} fetchFlags - Flags indicating data fetch status
 */

/**
 * @typedef {Object} MarketDataContextValue
 * @property {MarketDataState} state - Market data state
 * @property {Function} setUnifiedMarketData - Set market data for a ticker
 * @property {Function} setPositionMetadata - Set metadata for a position
 * @property {Function} setPositionBeta - Set beta for a position
 * @property {Function} setFactorData - Set factor data
 * @property {Function} setLagAnalysis - Set lag analysis results
 * @property {Function} setFetchFlag - Set a fetch status flag
 * @property {Function} clearMarketData - Clear all market data
 */

const MarketDataContext = createContext(null);

/**
 * MarketDataContext Provider component
 * Manages market data, position metadata, betas, and factor analysis
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function MarketDataProvider({ children }) {
  const [unifiedMarketData, setUnifiedMarketDataState] = useState({});
  const [positionMetadata, setPositionMetadataState] = useState({});
  const [positionBetas, setPositionBetasState] = useState({});
  const [factorData, setFactorData] = useState({});
  const [lagAnalysis, setLagAnalysis] = useState({});
  const [fetchFlags, setFetchFlags] = useState({
    marketDataLoading: false,
    metadataLoading: false,
    betasLoading: false,
    factorsLoading: false,
  });

  const setUnifiedMarketData = useCallback((ticker, data) => {
    setUnifiedMarketDataState(prev => ({
      ...prev,
      [ticker]: data,
    }));
  }, []);

  const setPositionMetadata = useCallback((ticker, metadata) => {
    setPositionMetadataState(prev => ({
      ...prev,
      [ticker]: metadata,
    }));
  }, []);

  const setPositionBeta = useCallback((ticker, beta) => {
    setPositionBetasState(prev => ({
      ...prev,
      [ticker]: beta,
    }));
  }, []);

  const setFetchFlag = useCallback((flag, value) => {
    setFetchFlags(prev => ({
      ...prev,
      [flag]: value,
    }));
  }, []);

  const clearMarketData = useCallback(() => {
    setUnifiedMarketDataState({});
    setPositionMetadataState({});
    setPositionBetasState({});
    setFactorData({});
    setLagAnalysis({});
    setFetchFlags({
      marketDataLoading: false,
      metadataLoading: false,
      betasLoading: false,
      factorsLoading: false,
    });
  }, []);

  const value = useMemo(() => ({
    state: {
      unifiedMarketData,
      positionMetadata,
      positionBetas,
      factorData,
      lagAnalysis,
      fetchFlags,
    },
    setUnifiedMarketData,
    setPositionMetadata,
    setPositionBeta,
    setFactorData,
    setLagAnalysis,
    setFetchFlag,
    clearMarketData,
  }), [
    unifiedMarketData,
    positionMetadata,
    positionBetas,
    factorData,
    lagAnalysis,
    fetchFlags,
    setUnifiedMarketData,
    setPositionMetadata,
    setPositionBeta,
    setFetchFlag,
    clearMarketData,
  ]);

  return <MarketDataContext.Provider value={value}>{children}</MarketDataContext.Provider>;
}

/**
 * Hook to access MarketData context
 * @returns {MarketDataContextValue}
 * @throws {Error} If used outside MarketDataProvider
 */
export function useMarketData() {
  const context = useContext(MarketDataContext);
  if (!context) {
    throw new Error('useMarketData must be used within a MarketDataProvider');
  }
  return context;
}
