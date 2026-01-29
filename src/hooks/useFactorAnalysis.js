import { useCallback, useContext, useState } from 'react';
import { MarketDataContext } from '../contexts/MarketDataContext';
import { PortfolioContext } from '../contexts/PortfolioContext';
import { SimulationContext } from '../contexts/SimulationContext';
import { toast } from '../components/common';

// Utils
import { ALL_FACTOR_ETFS, THEMATIC_ETFS } from '../utils/factorDefinitions';

// Cache
const FACTOR_CACHE_KEY = 'mc-factor-data';
const FACTOR_CACHE_MAX_AGE = 24 * 3600 * 1000; // 24 hours

/**
 * useFactorAnalysis - Custom hook for factor analysis
 * 
 * Extracts factor analysis logic from App.jsx including:
 * - fetchFactorData
 * - computeFactorBetas
 * - runFactorAnalysis
 * - detectThematicMatch
 */
export function useFactorAnalysis() {
  const { unifiedMarketData, fetchYahooData } = useContext(MarketDataContext);
  const { positions, portfolioValue, weights } = useContext(PortfolioContext);
  const { historyTimeline, useEwma, factorData, setFactorData, factorAnalysis, setFactorAnalysis } = useContext(SimulationContext);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  /**
   * Helper: Align returns by calendar date (for international stocks)
   */
  const alignReturnsByDate = useCallback((posReturns, posTimestamps, etfReturns, etfTimestamps, lag = 0) => {
    if (!posTimestamps?.length || !etfTimestamps?.length) {
      return { posAligned: [], etfAligned: [], matchedDates: 0 };
    }
    
    const etfByDate = new Map();
    for (let i = 0; i < etfReturns.length && i < etfTimestamps.length; i++) {
      const dateKey = new Date(etfTimestamps[i]).toISOString().slice(0, 10);
      etfByDate.set(dateKey, etfReturns[i]);
    }
    
    const posAligned = [];
    const etfAligned = [];
    
    for (let i = 0; i < posReturns.length && i < posTimestamps.length; i++) {
      const posDate = new Date(posTimestamps[i]);
      let targetDate = new Date(posDate);
      
      if (lag === -1) {
        targetDate.setDate(targetDate.getDate() - 1);
      } else if (lag === 1) {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      const targetKey = targetDate.toISOString().slice(0, 10);
      const etfReturn = etfByDate.get(targetKey);
      
      if (etfReturn !== undefined) {
        posAligned.push(posReturns[i]);
        etfAligned.push(etfReturn);
      }
    }
    
    return { posAligned, etfAligned, matchedDates: posAligned.length };
  }, []);

  /**
   * Compute correlation and beta from aligned returns
   */
  const computeCorrelationFromAligned = useCallback((posAligned, etfAligned, ewmaLambda = 1.0) => {
    const n = posAligned.length;
    if (n < 30) {
      return { correlation: 0, beta: 0, rSquared: 0 };
    }
    
    let weights = null;
    if (ewmaLambda < 0.9999) {
      weights = new Array(n);
      let sumW = 0;
      for (let t = 0; t < n; t++) {
        weights[t] = Math.pow(ewmaLambda, n - 1 - t);
        sumW += weights[t];
      }
      for (let t = 0; t < n; t++) {
        weights[t] /= sumW;
      }
    }
    
    let meanY = 0, meanX = 0;
    if (weights) {
      for (let i = 0; i < n; i++) {
        meanY += weights[i] * posAligned[i];
        meanX += weights[i] * etfAligned[i];
      }
    } else {
      meanY = posAligned.reduce((a, b) => a + b, 0) / n;
      meanX = etfAligned.reduce((a, b) => a + b, 0) / n;
    }
    
    let cov = 0, varX = 0, varY = 0;
    for (let i = 0; i < n; i++) {
      const w = weights ? weights[i] : 1;
      cov += w * (posAligned[i] - meanY) * (etfAligned[i] - meanX);
      varX += w * (etfAligned[i] - meanX) ** 2;
      varY += w * (posAligned[i] - meanY) ** 2;
    }
    
    const beta = varX > 0 ? cov / varX : 0;
    const correlation = (varX > 0 && varY > 0) ? cov / Math.sqrt(varX * varY) : 0;
    const rSquared = correlation * correlation;
    
    return { correlation, beta, rSquared };
  }, []);

  /**
   * Fetch factor ETF data
   */
  const fetchFactorData = useCallback(async (marketData = null, forceRefresh = false) => {
    setIsAnalyzing(true);

    // Check cache first
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(FACTOR_CACHE_KEY);
        if (cached) {
          const { data: cachedFactorData, timestamp, timeline } = JSON.parse(cached);
          const isFresh = Date.now() - timestamp < FACTOR_CACHE_MAX_AGE;
          const sameTimeline = timeline === historyTimeline;

          if (isFresh && sameTimeline && cachedFactorData && Object.keys(cachedFactorData).length > 5) {
            console.log(`📊 Using cached factor data`);
            setFactorData(cachedFactorData);
            setIsAnalyzing(false);
            return cachedFactorData;
          }
        }
      } catch (e) {
        console.warn('Factor cache read failed:', e);
      }
    }

    console.log('📊 Fetching factor ETF data...');

    try {
      const targetDays = {
        '6mo': 126,
        '1y': 252,
        '2y': 504,
        '3y': 756,
      }[historyTimeline] || 252;

      // Fetch all factor ETFs in parallel
      const results = await Promise.all(
        ALL_FACTOR_ETFS.map(async (ticker) => {
          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3y`;
            const data = await fetchYahooData(url);

            if (data?.chart?.result?.[0]) {
              const result = data.chart.result[0];
              const adjCloses = result.indicators?.adjclose?.[0]?.adjclose ||
                               result.indicators?.quote?.[0]?.close || [];
              const timestamps = result.timestamp || [];

              const returns = [];
              const returnTimestamps = [];
              for (let i = 1; i < adjCloses.length; i++) {
                if (adjCloses[i] && adjCloses[i-1] && adjCloses[i-1] !== 0) {
                  returns.push((adjCloses[i] - adjCloses[i-1]) / adjCloses[i-1]);
                  if (timestamps[i]) {
                    returnTimestamps.push(timestamps[i] * 1000);
                  }
                }
              }

              const trimmedReturns = returns.slice(-targetDays);
              const trimmedTimestamps = returnTimestamps.slice(-targetDays);
              const totalReturn = trimmedReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;

              return {
                ticker,
                returns: trimmedReturns,
                timestamps: trimmedTimestamps,
                totalReturn,
                success: true
              };
            }
            return { ticker, success: false };
          } catch (e) {
            console.warn(`Failed to fetch ${ticker}:`, e.message);
            return { ticker, success: false };
          }
        })
      );
      
      // Build factor data object
      const newFactorData = {};
      results.forEach(r => {
        if (r.success && r.returns.length > 50) {
          newFactorData[r.ticker] = {
            returns: r.returns,
            timestamps: r.timestamps,
            totalReturn: r.totalReturn,
          };
        }
      });
      
      // Compute factor spreads
      const spy = newFactorData['SPY']?.returns || [];
      const spyTimestamps = newFactorData['SPY']?.timestamps || [];
      if (spy.length > 0) {
        const iwm = newFactorData['IWM']?.returns || [];
        if (iwm.length === spy.length) {
          newFactorData['SMB'] = {
            returns: spy.map((s, i) => (iwm[i] || 0) - s),
            timestamps: spyTimestamps,
            totalReturn: (newFactorData['IWM']?.totalReturn || 0) - (newFactorData['SPY']?.totalReturn || 0),
            name: 'Size (Small-Big)',
          };
        }
        
        const iwd = newFactorData['IWD']?.returns || [];
        const iwf = newFactorData['IWF']?.returns || [];
        if (iwd.length === iwf.length && iwd.length > 0) {
          newFactorData['HML'] = {
            returns: iwd.map((v, i) => v - (iwf[i] || 0)),
            timestamps: spyTimestamps.slice(0, iwd.length),
            totalReturn: (newFactorData['IWD']?.totalReturn || 0) - (newFactorData['IWF']?.totalReturn || 0),
            name: 'Value (High-Low)',
          };
        }
        
        // Add other factor spreads (MOM, QUAL, LVOL)
        const mtum = newFactorData['MTUM']?.returns || [];
        if (mtum.length === spy.length) {
          newFactorData['MOM'] = {
            returns: spy.map((s, i) => (mtum[i] || 0) - s),
            timestamps: spyTimestamps,
            totalReturn: (newFactorData['MTUM']?.totalReturn || 0) - (newFactorData['SPY']?.totalReturn || 0),
            name: 'Momentum',
          };
        }
      }
      
      console.log(`✅ Fetched ${Object.keys(newFactorData).length} factor ETFs`);
      setFactorData(newFactorData);

      // Cache
      try {
        const cachePayload = JSON.stringify({
          data: newFactorData,
          timestamp: Date.now(),
          timeline: historyTimeline,
        });
        localStorage.setItem(FACTOR_CACHE_KEY, cachePayload);
        console.log(`💾 Factor data cached`);
      } catch (e) {
        console.warn('Failed to cache factor data:', e);
      }

      return newFactorData;
    } catch (e) {
      console.error('Factor data fetch failed:', e);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [historyTimeline, setFactorData, fetchYahooData]);

  /**
   * Detect best thematic match for a position
   */
  const detectThematicMatch = useCallback((positionReturns, posTimestamps, factorReturnsMap, excludeList = ['SPY'], ewmaLambda = 1.0, isInternational = false) => {
    const thematicETFTickers = Object.keys(THEMATIC_ETFS);
    
    let bestMatch = { ticker: null, beta: 0, rSquared: 0, name: 'None', lag: 0 };
    
    for (const etfTicker of thematicETFTickers) {
      if (excludeList.includes(etfTicker)) continue;
      
      const etfData = factorReturnsMap[etfTicker];
      if (!etfData?.returns || etfData.returns.length < 30) continue;
      
      const etfReturns = etfData.returns;
      const etfTimestamps = etfData.timestamps;
      
      // Try lags and pick best R²
      const lags = [-1, 0, 1];
      let bestLagResult = { rSquared: 0, lag: 0, beta: 0, correlation: 0 };
      
      for (const lag of lags) {
        let result;
        
        if (isInternational && posTimestamps?.length > 0 && etfTimestamps?.length > 0) {
          const { posAligned, etfAligned } = alignReturnsByDate(
            positionReturns, posTimestamps, etfReturns, etfTimestamps, lag
          );
          result = computeCorrelationFromAligned(posAligned, etfAligned, ewmaLambda);
        } else {
          // Simple index alignment
          const len = Math.min(positionReturns.length, etfReturns.length);
          const y = positionReturns.slice(-len);
          const x = etfReturns.slice(-len);
          result = computeCorrelationFromAligned(y, x, ewmaLambda);
        }
        
        if (result.rSquared > bestLagResult.rSquared) {
          bestLagResult = { ...result, lag };
        }
      }
      
      if (bestLagResult.rSquared > bestMatch.rSquared && bestLagResult.rSquared > 0.10) {
        bestMatch = {
          ticker: etfTicker,
          beta: bestLagResult.beta,
          rSquared: bestLagResult.rSquared,
          correlation: bestLagResult.correlation,
          lag: bestLagResult.lag,
          name: THEMATIC_ETFS[etfTicker]?.name || etfTicker,
          category: THEMATIC_ETFS[etfTicker]?.category || 'unknown',
        };
      }
    }
    
    return bestMatch;
  }, [alignReturnsByDate, computeCorrelationFromAligned]);

  /**
   * Compute factor betas for a position
   */
  const computeFactorBetas = useCallback((positionReturns, posTimestamps, factorReturnsMap, ewmaLambda = 1.0, isInternational = false) => {
    const spyData = factorReturnsMap['SPY'];
    if (!spyData?.returns || spyData.returns.length < 30) {
      return { alpha: 0, betas: {}, rSquared: 0, residualVol: 0, lag: 0 };
    }
    
    const spy = spyData.returns;
    const len = Math.min(positionReturns.length, spy.length);
    
    if (len < 30) {
      return { alpha: 0, betas: {}, rSquared: 0, residualVol: 0, lag: 0 };
    }
    
    const y = positionReturns.slice(-len);
    const mkt = spy.slice(-len);
    
    // Compute market beta
    const meanY = y.reduce((a, b) => a + b, 0) / len;
    const meanMkt = mkt.reduce((a, b) => a + b, 0) / len;
    
    let covYMkt = 0, varMkt = 0, varY = 0;
    for (let i = 0; i < len; i++) {
      covYMkt += (y[i] - meanY) * (mkt[i] - meanMkt);
      varMkt += (mkt[i] - meanMkt) ** 2;
      varY += (y[i] - meanY) ** 2;
    }
    covYMkt /= len;
    varMkt /= len;
    varY /= len;
    
    const betaMkt = varMkt > 0 ? covYMkt / varMkt : 0;
    
    // Compute residuals
    const residuals = y.map((yi, i) => yi - betaMkt * mkt[i]);
    const meanResid = residuals.reduce((a, b) => a + b, 0) / len;
    const alpha = meanResid * 252;
    
    // Compute other factor betas from residuals
    const betas = { MKT: betaMkt };
    
    // SMB, HML, MOM (simplified)
    ['SMB', 'HML', 'MOM'].forEach(factor => {
      const factorReturns = factorReturnsMap[factor]?.returns;
      if (factorReturns && factorReturns.length >= len) {
        const fSlice = factorReturns.slice(-len);
        const meanF = fSlice.reduce((a, b) => a + b, 0) / len;
        let covRF = 0, varF = 0;
        for (let i = 0; i < len; i++) {
          covRF += residuals[i] * (fSlice[i] - meanF);
          varF += (fSlice[i] - meanF) ** 2;
        }
        betas[factor] = varF > 0 ? (covRF / len) / (varF / len) : 0;
      }
    });
    
    // Compute R²
    let ssResid = 0;
    for (let i = 0; i < len; i++) {
      const predicted = betaMkt * mkt[i];
      ssResid += (y[i] - predicted) ** 2;
    }
    const rSquared = varY > 0 ? Math.max(0, 1 - (ssResid / len) / varY) : 0;
    const residualVol = Math.sqrt(ssResid / len) * Math.sqrt(252);
    
    return { alpha, betas, rSquared, residualVol, lag: 0 };
  }, []);

  /**
   * Run complete factor analysis
   */
  const runAnalysis = useCallback(async (factorDataInput, marketData = null) => {
    const fData = factorDataInput || factorData;
    if (!fData || !fData['SPY']) {
      console.warn('No factor data available');
      return;
    }
    
    setIsAnalyzing(true);
    
    const mktData = marketData || unifiedMarketData;
    
    console.log('🔬 Running factor analysis...');
    
    // Calculate EWMA lambda
    let ewmaLambda = 1.0;
    if (useEwma) {
      const halfLifeDays = {
        '6mo': 63,
        '1y': 126,
        '2y': 252,
        '3y': 378,
      }[historyTimeline] || 126;
      ewmaLambda = Math.exp(-Math.LN2 / halfLifeDays);
    }
    
    // Analyze each position
    const positionAnalysis = [];
    
    for (const pos of positions) {
      const ticker = pos.ticker?.toUpperCase();
      if (!ticker) continue;
      
      const returns = mktData[ticker]?.dailyReturns || [];
      if (returns.length < 30) {
        positionAnalysis.push({
          id: pos.id,
          ticker,
          weight: (pos.quantity * pos.price) / portfolioValue,
          factorBetas: { alpha: 0, betas: { MKT: 1 }, rSquared: 0 },
          thematicMatch: { ticker: null, name: 'Insufficient data', rSquared: 0 },
          hasData: false,
        });
        continue;
      }
      
      const isInternational = ticker.includes('.') && !ticker.endsWith('.US');
      const posTimestamps = mktData[ticker]?.timestamps?.slice(1) || [];
      
      const factorBetas = computeFactorBetas(returns, posTimestamps, fData, ewmaLambda, isInternational);
      const thematicMatch = detectThematicMatch(returns, posTimestamps, fData, ['SPY'], ewmaLambda, isInternational);
      
      positionAnalysis.push({
        id: pos.id,
        ticker,
        weight: (pos.quantity * pos.price) / portfolioValue,
        factorBetas,
        thematicMatch,
        hasData: true,
      });
    }
    
    // Aggregate portfolio-level exposures
    const portfolioFactorBetas = { MKT: 0, SMB: 0, HML: 0, MOM: 0 };
    let portfolioAlpha = 0;
    
    for (const pa of positionAnalysis) {
      if (!pa.hasData) continue;
      const w = pa.weight;
      
      portfolioFactorBetas.MKT += w * (pa.factorBetas.betas.MKT || 0);
      portfolioFactorBetas.SMB += w * (pa.factorBetas.betas.SMB || 0);
      portfolioFactorBetas.HML += w * (pa.factorBetas.betas.HML || 0);
      portfolioFactorBetas.MOM += w * (pa.factorBetas.betas.MOM || 0);
      portfolioAlpha += w * pa.factorBetas.alpha;
    }
    
    const analysis = {
      positions: positionAnalysis,
      portfolioFactorBetas,
      portfolioAlpha,
      timestamp: new Date().toISOString(),
    };
    
    console.log('✅ Factor analysis complete');
    setFactorAnalysis(analysis);
    setIsAnalyzing(false);
    
    toast.success(`${positionAnalysis.length} positions analyzed`, {
      duration: 4000,
    });
    
    return analysis;
  }, [factorData, positions, portfolioValue, unifiedMarketData, useEwma, historyTimeline,
      setFactorAnalysis, computeFactorBetas, detectThematicMatch]);

  /**
   * Get factor exposure for a specific position
   */
  const getFactorExposure = useCallback((positionId) => {
    if (!factorAnalysis) return null;
    return factorAnalysis.positions.find(p => p.id === positionId);
  }, [factorAnalysis]);

  return {
    // Data
    factorData,
    factorAnalysis,
    
    // State
    isAnalyzing,
    
    // Actions
    fetchFactorData,
    runAnalysis,
    getFactorExposure,
    
    // Utilities
    detectThematicMatch,
    computeFactorBetas,
    alignReturnsByDate,
    computeCorrelationFromAligned,
  };
}
