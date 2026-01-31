import { useCallback, useContext } from 'react';
import { MarketDataContext } from '../contexts/MarketDataContext';
import { PortfolioContext } from '../contexts/PortfolioContext';
import { toast } from '../components/common';

// Services - use Worker-first functions from yahooFinance
import {
  fetchYahooQuote,
  fetchYahooHistory,
  fetchYahooProfile,
  fetchExchangeRate,
  fetchYahooData
} from '../services/yahooFinance';

// Utils
import { 
  ALL_FACTOR_ETFS,
  THEMATIC_ETFS,
} from '../utils/factorDefinitions';
import {
  processTickerData,
  rehydrateTickerData,
  prepareForStorage,
  computeDailyReturns,
} from '../utils/marketDataHelpers';

// Cache keys
const UNIFIED_CACHE_KEY = 'mc-unified-market-data';
const UNIFIED_CACHE_MAX_AGE = 24 * 3600 * 1000; // 24 hours

/**
 * useMarketData - Custom hook for fetching and managing market data
 * 
 * Extracts the unified market data fetching logic from App.jsx
 * Provides a single source of truth for all market data operations
 */
export function useMarketData() {
  const {
    unifiedMarketData,
    setUnifiedMarketData,
    isFetchingUnified,
    setIsFetchingUnified,
    unifiedFetchProgress,
    setUnifiedFetchProgress,
    fetchErrors,
    setFetchErrors,
    positionBetas,
    setPositionBetas,
    positionMetadata,
    setPositionMetadata,
    calendarYearReturns,
    setCalendarYearReturns,
  } = useContext(MarketDataContext);
  
  const { positions } = useContext(PortfolioContext);

  // Note: fetchYahooQuote, fetchYahooHistory, fetchYahooProfile, fetchExchangeRate, fetchYahooData
  // are imported from yahooFinance.js which uses Cloudflare Worker with CORS proxy fallback

  /**
   * MAIN UNIFIED FETCH - fetches everything in parallel
   * This is the core data loading function extracted from App.jsx
   */
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
    
    // Add SPY if not already in positions (needed for beta calculation)
    // Also add factor ETFs for factor analysis
    const factorETFs = ['SPY', 'IWM', 'IWD', 'IWF', 'MTUM', 'QUAL', 'SPLV', ...Object.keys(THEMATIC_ETFS)];
    const allTickers = [...new Set([...factorETFs, ...tickers])];
    setUnifiedFetchProgress({ current: 0, total: allTickers.length, message: 'Initializing...' });
    
    console.log(`🚀 Fetching unified data for ${allTickers.length} tickers (${tickers.length} positions + ${factorETFs.length} factor ETFs)...`);
    
    const newData = { ...unifiedMarketData };
    const errors = [];
    
    // Separate cached vs need-to-fetch
    const needsFetch = [];
    const cachedTickers = [];
    const historyResults = {};
    
    for (const ticker of allTickers) {
      const cached = newData[ticker];
      if (!forceRefresh && cached?.fetchedAt && Date.now() - cached.fetchedAt < UNIFIED_CACHE_MAX_AGE) {
        cachedTickers.push(ticker);
        historyResults[ticker] = { ticker, data: cached.closePrices, cached: true };
      } else {
        needsFetch.push(ticker);
      }
    }
    
    let completedCount = cachedTickers.length;
    console.log(`📦 ${cachedTickers.length} tickers from cache, ${needsFetch.length} to fetch`);
    
    setUnifiedFetchProgress({ 
      current: completedCount, 
      total: allTickers.length, 
      message: `${cachedTickers.length} cached, fetching ${needsFetch.length}...` 
    });
    
    // Start profile fetches (don't await yet)
    const tickersNeedingProfiles = allTickers
      .filter(t => !newData[t]?.name || forceRefresh)
      .filter(t => !t.includes('.')); // Skip exchange-suffixed tickers
    
    const profilePromise = Promise.all(
      tickersNeedingProfiles.map(async (ticker) => {
        try {
          const profile = await fetchYahooProfile(ticker);
          return { ticker, profile };
        } catch (err) {
          return { ticker, profile: null };
        }
      })
    );
    
    // Fetch history with concurrency limiting
    const CONCURRENCY_LIMIT = 6;
    const historyFetchResults = [];
    const fetchQueue = [...needsFetch];

    const fetchWorker = async () => {
      while (fetchQueue.length > 0) {
        const ticker = fetchQueue.shift();
        if (!ticker) continue;

        try {
          // fetchYahooHistory returns array of {date, close} directly
          const prices = await fetchYahooHistory(ticker, '5y', '1d');
          completedCount++;
          const daysCount = prices?.length || 0;
          setUnifiedFetchProgress({
            current: completedCount,
            total: allTickers.length,
            message: ticker,
            detail: `${daysCount} days`
          });
          historyFetchResults.push({
            ticker,
            data: prices || null,
            currency: 'USD', // Currency info not available from this API
            regularMarketPrice: prices?.[prices.length - 1]?.close,
            cached: false
          });
        } catch (err) {
          completedCount++;
          setUnifiedFetchProgress({
            current: completedCount,
            total: allTickers.length,
            message: ticker,
            detail: 'failed'
          });
          historyFetchResults.push({ ticker, data: null, error: err.message });
        }
      }
    };

    // Create worker pool with concurrency limit
    const workers = Array(Math.min(CONCURRENCY_LIMIT, needsFetch.length))
      .fill(null)
      .map(() => fetchWorker());

    await Promise.all(workers);
    historyFetchResults.forEach(r => {
      historyResults[r.ticker] = r;
      if (r.error) errors.push(`${r.ticker}: ${r.error}`);
    });
    
    console.log(`📊 History fetch complete in ${(performance.now() - startTime).toFixed(0)}ms`);
    
    // Fetch exchange rates for non-USD currencies
    const uniqueCurrencies = [...new Set(
      historyFetchResults
        .filter(r => r.currency && r.currency !== 'USD')
        .map(r => r.currency)
    )];
    
    const exchangeRates = { USD: 1 };
    if (uniqueCurrencies.length > 0) {
      console.log(`💱 Fetching exchange rates in parallel for: ${uniqueCurrencies.join(', ')}`);

      const ratePromises = uniqueCurrencies.map(async (currency) => {
        const rate = await fetchExchangeRate(currency, 'USD');
        return { currency, rate };
      });

      const rateResults = await Promise.all(ratePromises);

      rateResults.forEach(({ currency, rate }) => {
        if (rate) {
          exchangeRates[currency] = rate;
          console.log(`   ${currency}/USD = ${rate.toFixed(4)}`);
        } else {
          console.warn(`   ${currency}/USD rate not found, using 1`);
          exchangeRates[currency] = 1;
        }
      });
    }
    
    // Await profiles
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: 'Processing profiles...' 
    });
    
    const profileResults = await profilePromise;
    const profiles = {};
    profileResults.forEach(r => {
      profiles[r.ticker] = r.profile;
    });
    
    console.log(`📋 Profile fetch complete in ${(performance.now() - startTime).toFixed(0)}ms`);
    
    // Process all data
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: 'Calculating betas & correlations...' 
    });
    
    // Get SPY data for beta calculation
    const spyHistory = historyResults['SPY']?.data;
    const spyReturns = spyHistory ? computeDailyReturns(spyHistory) : [];
    const spyTimestamps = spyHistory ? spyHistory.slice(1).map(h => h.date?.getTime?.() || h.date) : [];
    const spyData = { returns: spyReturns, timestamps: spyTimestamps };
    
    console.log('📅 Data date ranges:');
    
    // Process each ticker with progress updates
    let processedCount = 0;
    const totalToProcess = allTickers.length;
    
    for (const ticker of allTickers) {
      const histResult = historyResults[ticker];
      
      // Use cached data if history fetch was cached
      if (histResult?.cached && newData[ticker]) {
        processedCount++;
        continue;
      }
      
      const history = histResult?.data;
      const profile = profiles[ticker] || newData[ticker] || {};
      const currency = histResult?.currency || 'USD';
      const exchangeRate = exchangeRates[currency] || 1;
      
      if (history && history.length > 10) {
        const startDate = history[0]?.date?.toLocaleDateString() || 'N/A';
        const endDate = history[history.length - 1]?.date?.toLocaleDateString() || 'N/A';
        const years = (history.length / 252).toFixed(1);
        const currencyNote = currency !== 'USD' ? ` [${currency}→USD @${exchangeRate.toFixed(4)}]` : '';
        console.log(`   ${ticker}: ${history.length} days (~${years}yr) from ${startDate} to ${endDate}${currencyNote}`);
        
        const processed = processTickerData(ticker, history, profile, spyData, currency, exchangeRate);
        newData[ticker] = processed;
      } else if (!newData[ticker]) {
        newData[ticker] = { ticker, error: 'No data available' };
        errors.push(`${ticker}: No historical data available`);
      }
      
      processedCount++;
      // Update progress during processing
      if (processedCount % 2 === 0 || processedCount === totalToProcess) {
        setUnifiedFetchProgress({ 
          current: allTickers.length, 
          total: allTickers.length, 
          message: `Processing ${ticker}... (${processedCount}/${totalToProcess})` 
        });
        await new Promise(r => setTimeout(r, 0));
      }
    }
    
    // Update all state from unified data
    const betas = {};
    const metadata = {};
    const yearReturns = {};
    
    Object.entries(newData).forEach(([ticker, d]) => {
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
          type: d.type,
          currency: d.currency,
          exchangeRate: d.exchangeRate,
          domesticPrice: d.domesticPrice,
        };
      }
      if (d.calendarYearReturns) {
        yearReturns[ticker] = d.calendarYearReturns;
      }
    });
    
    // Compute factor spreads
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: 'Computing factor spreads...' 
    });
    
    const spy = newData['SPY']?.dailyReturns || [];
    if (spy.length > 50) {
      const spyTs = newData['SPY']?.timestamps?.slice(1) || [];
      
      // SMB, HML, MOM, QUAL_FACTOR, LVOL
      const iwm = newData['IWM']?.dailyReturns || [];
      const iwd = newData['IWD']?.dailyReturns || [];
      const iwf = newData['IWF']?.dailyReturns || [];
      
      if (iwm.length === spy.length && iwm.length > 0) {
        const smbReturns = spy.map((s, i) => (iwm[i] || 0) - s);
        // Store as if it's a regular ticker for factor analysis
        newData['SMB'] = {
          ticker: 'SMB',
          dailyReturns: smbReturns,
          timestamps: spyTs,
          oneYearReturn: (newData['IWM']?.oneYearReturn || 0) - (newData['SPY']?.oneYearReturn || 0),
          name: 'Size (Small-Big)',
        };
      }
      
      if (iwd.length === iwf.length && iwd.length > 0) {
        const hmlReturns = iwd.map((v, i) => v - (iwf[i] || 0));
        newData['HML'] = {
          ticker: 'HML',
          dailyReturns: hmlReturns,
          timestamps: spyTs,
          oneYearReturn: (newData['IWD']?.oneYearReturn || 0) - (newData['IWF']?.oneYearReturn || 0),
          name: 'Value (High-Low)',
        };
      }
      
      console.log(`📊 Computed ${Object.keys(newData).length} factor/ETF series`);
    }
    
    // Update all state
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: 'Updating state...' 
    });
    
    setUnifiedMarketData(newData);
    setPositionBetas(betas);
    setPositionMetadata(prev => ({ ...prev, ...metadata }));
    setCalendarYearReturns(prev => ({ ...prev, ...yearReturns }));
    
    if (errors.length > 0) {
      setFetchErrors(errors);
    }
    
    // Cache to localStorage
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: 'Saving to cache...' 
    });
    
    try {
      const slimData = {};
      for (const [ticker, data] of Object.entries(newData)) {
        slimData[ticker] = prepareForStorage(data);
      }
      
      const cachePayload = JSON.stringify({
        data: slimData,
        timestamp: Date.now(),
      });
      
      console.log(`💾 Cache size: ${(cachePayload.length / 1024).toFixed(1)}KB for ${Object.keys(slimData).length} tickers`);
      localStorage.setItem(UNIFIED_CACHE_KEY, cachePayload);
    } catch (e) {
      console.warn('Failed to cache unified data:', e);
    }
    
    const elapsed = performance.now() - startTime;
    console.log(`✅ Unified fetch complete: ${Object.keys(newData).length} tickers in ${elapsed.toFixed(0)}ms`);
    
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: `✓ Complete! ${Object.keys(newData).length} tickers loaded in ${(elapsed/1000).toFixed(1)}s` 
    });
    await new Promise(r => setTimeout(r, 800));
    
    setUnifiedFetchProgress({ current: 0, total: 0, message: '' });
    setIsFetchingUnified(false);
    
    toast.success(`${Object.keys(newData).length} tickers loaded in ${(elapsed/1000).toFixed(1)}s`, {
      duration: 3000,
    });
    
    return newData;
  }, [positions, unifiedMarketData, setIsFetchingUnified, setFetchErrors, setUnifiedFetchProgress, 
      setUnifiedMarketData, setPositionBetas, setPositionMetadata, setCalendarYearReturns]);

  /**
   * Refresh prices from unified data (lightweight update)
   */
  const refreshPrices = useCallback((dataSource = null) => {
    const marketData = dataSource || unifiedMarketData;
    let updatedCount = 0;
    
    // This would update positions - but positions are in PortfolioContext
    // So we return the price data for the caller to apply
    const priceUpdates = {};
    
    positions.forEach(pos => {
      if (!pos.ticker) return;
      const data = marketData[pos.ticker.toUpperCase()];
      if (data?.currentPrice) {
        priceUpdates[pos.id] = {
          price: data.currentPrice,
          currency: data.currency || 'USD',
          domesticPrice: data.domesticPrice || data.currentPrice,
        };
        updatedCount++;
      }
    });
    
    return { priceUpdates, updatedCount };
  }, [positions, unifiedMarketData]);

  return {
    // Data
    unifiedMarketData,
    positionBetas,
    positionMetadata,
    calendarYearReturns,
    
    // Loading state
    isLoading: isFetchingUnified,
    progress: unifiedFetchProgress,
    errors: fetchErrors,
    
    // Actions
    fetchMarketData,
    refreshPrices,
    
    // Utilities (expose for other hooks)
    fetchYahooQuote,
    fetchYahooData,
    fetchYahooProfile,
    fetchYahooHistory,
    fetchExchangeRate,
  };
}
