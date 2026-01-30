import { useCallback } from 'react';
import { useMarketDataContext } from '../contexts/MarketDataContext';
import { fetchUnifiedMarketData } from '../services/yahooFinance';
import { UNIFIED_CACHE_KEY, UNIFIED_CACHE_MAX_AGE } from '../utils/constants';

export const useMarketData = () => {
  const context = useMarketDataContext();

  const fetchMarketData = useCallback(async (symbols) => {
    if (!symbols || symbols.length === 0) return;
    
    try {
      context.setLoading('marketData', true);
      context.clearFetchErrors();
      
      const data = await fetchUnifiedMarketData(symbols);
      context.setUnifiedData(data);
      context.setDataSource('api');
      
      return data;
    } catch (error) {
      context.addFetchError({
        type: 'market',
        symbol: symbols.join(','),
        error: error.message
      });
      throw error;
    } finally {
      context.setLoading('marketData', false);
    }
  }, [context]);

  const refreshData = useCallback(() => {
    const symbols = Object.keys(context.unifiedMarketData);
    if (symbols.length > 0) {
      return fetchMarketData(symbols);
    }
  }, [context.unifiedMarketData, fetchMarketData]);

  const isValidCache = useCallback(() => {
    try {
      const cached = localStorage.getItem(UNIFIED_CACHE_KEY);
      if (!cached) return false;
      
      const { data, timestamp } = JSON.parse(cached);
      return Date.now() - timestamp < UNIFIED_CACHE_MAX_AGE && data;
    } catch {
      return false;
    }
  }, []);

  return {
    // State
    unifiedMarketData: context.unifiedMarketData,
    historicalData: context.historicalData,
    dataSource: context.dataSource,
    fetchErrors: context.fetchErrors,
    hasData: context.hasData,

    // Status
    isLoading: context.loading.marketData,
    isDataFresh: context.isDataFresh,

    // Actions
    fetchMarketData,
    refreshData,
    setUnifiedData: context.setUnifiedData,
    isValidCache
  };
};
