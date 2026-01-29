import { useCallback, useContext } from 'react';
import { MarketDataContext } from '../contexts/MarketDataContext';
import { PortfolioContext } from '../contexts/PortfolioContext';
import { SimulationContext } from '../contexts/SimulationContext';
import { toast } from '../components/common';

// Utils
import { makeValidCorrelation, choleskyDecomposition } from '../utils/matrix';
import { normalCDF } from '../utils/statistics';

/**
 * useCorrelation - Custom hook for correlation matrix computation and lag analysis
 * 
 * Extracts correlation computation, lag analysis, and correlation adjustment logic from App.jsx
 */
export function useCorrelation() {
  const { unifiedMarketData } = useContext(MarketDataContext);
  const { positions } = useContext(PortfolioContext);
  const {
    correlationMatrix,
    setCorrelationMatrix,
    editedCorrelation,
    setEditedCorrelation,
    correlationMethod,
    useEwma,
    historyTimeline,
    gldAsCash,
    lagAnalysis,
    setLagAnalysis,
    useLagAdjusted,
    setUseLagAdjusted,
  } = useContext(SimulationContext);

  const [isComputing, setIsComputing] = React.useState(false);

  /**
   * Compute pairwise correlation with optional EWMA weighting
   */
  const computePairwiseCorrelation = useCallback((returns1, returns2, lambda = 1.0) => {
    const len = Math.min(returns1.length, returns2.length);
    if (len < 20) return { corr: 0, overlap: len };
    
    const r1 = returns1.slice(-len);
    const r2 = returns2.slice(-len);
    
    // Equal weight (standard correlation)
    if (lambda >= 0.9999) {
      const mean1 = r1.reduce((a, b) => a + b, 0) / len;
      const mean2 = r2.reduce((a, b) => a + b, 0) / len;
      
      let cov = 0, var1 = 0, var2 = 0;
      for (let t = 0; t < len; t++) {
        const d1 = r1[t] - mean1;
        const d2 = r2[t] - mean2;
        cov += d1 * d2;
        var1 += d1 * d1;
        var2 += d2 * d2;
      }
      
      const std1 = Math.sqrt(var1 / len);
      const std2 = Math.sqrt(var2 / len);
      const correlation = (std1 > 0 && std2 > 0) ? (cov / len) / (std1 * std2) : 0;
      
      return { corr: Math.max(-1, Math.min(1, correlation)), overlap: len };
    }
    
    // EWMA correlation
    const weights = new Array(len);
    let sumWeights = 0;
    for (let t = 0; t < len; t++) {
      weights[t] = Math.pow(lambda, len - 1 - t);
      sumWeights += weights[t];
    }
    for (let t = 0; t < len; t++) {
      weights[t] /= sumWeights;
    }
    
    let mean1 = 0, mean2 = 0;
    for (let t = 0; t < len; t++) {
      mean1 += weights[t] * r1[t];
      mean2 += weights[t] * r2[t];
    }
    
    let cov = 0, var1 = 0, var2 = 0;
    for (let t = 0; t < len; t++) {
      const d1 = r1[t] - mean1;
      const d2 = r2[t] - mean2;
      cov += weights[t] * d1 * d2;
      var1 += weights[t] * d1 * d1;
      var2 += weights[t] * d2 * d2;
    }
    
    const std1 = Math.sqrt(var1);
    const std2 = Math.sqrt(var2);
    const correlation = (std1 > 0 && std2 > 0) ? cov / (std1 * std2) : 0;
    
    return { corr: Math.max(-1, Math.min(1, correlation)), overlap: len };
  }, []);

  /**
   * Compute lagged correlation (for lag analysis)
   */
  const computeLaggedCorrelation = useCallback((returns1, returns2, lag, lambda = 1.0) => {
    const len1 = returns1.length;
    const len2 = returns2.length;
    
    let r1, r2;
    if (lag >= 0) {
      const overlap = Math.min(len1 - lag, len2);
      if (overlap < 30) return null;
      r1 = returns1.slice(len1 - overlap);
      r2 = returns2.slice(len2 - overlap - lag, len2 - lag || undefined);
    } else {
      const absLag = Math.abs(lag);
      const overlap = Math.min(len1, len2 - absLag);
      if (overlap < 30) return null;
      r1 = returns1.slice(len1 - overlap - absLag, len1 - absLag || undefined);
      r2 = returns2.slice(len2 - overlap);
    }
    
    const len = Math.min(r1.length, r2.length);
    if (len < 30) return null;
    
    r1 = r1.slice(-len);
    r2 = r2.slice(-len);
    
    // Equal weight
    if (lambda >= 0.9999) {
      const mean1 = r1.reduce((a, b) => a + b, 0) / len;
      const mean2 = r2.reduce((a, b) => a + b, 0) / len;
      
      let cov = 0, var1 = 0, var2 = 0;
      for (let t = 0; t < len; t++) {
        const d1 = r1[t] - mean1;
        const d2 = r2[t] - mean2;
        cov += d1 * d2;
        var1 += d1 * d1;
        var2 += d2 * d2;
      }
      
      const std1 = Math.sqrt(var1 / len);
      const std2 = Math.sqrt(var2 / len);
      if (std1 === 0 || std2 === 0) return 0;
      
      return Math.max(-1, Math.min(1, (cov / len) / (std1 * std2)));
    }
    
    // EWMA
    const weights = new Array(len);
    let sumWeights = 0;
    for (let t = 0; t < len; t++) {
      weights[t] = Math.pow(lambda, len - 1 - t);
      sumWeights += weights[t];
    }
    for (let t = 0; t < len; t++) {
      weights[t] /= sumWeights;
    }
    
    let mean1 = 0, mean2 = 0;
    for (let t = 0; t < len; t++) {
      mean1 += weights[t] * r1[t];
      mean2 += weights[t] * r2[t];
    }
    
    let cov = 0, var1 = 0, var2 = 0;
    for (let t = 0; t < len; t++) {
      const d1 = r1[t] - mean1;
      const d2 = r2[t] - mean2;
      cov += weights[t] * d1 * d2;
      var1 += weights[t] * d1 * d1;
      var2 += weights[t] * d2 * d2;
    }
    
    const std1 = Math.sqrt(var1);
    const std2 = Math.sqrt(var2);
    if (std1 === 0 || std2 === 0) return 0;
    
    return Math.max(-1, Math.min(1, cov / (std1 * std2)));
  }, []);

  /**
   * Main correlation computation function
   */
  const computeCorrelation = useCallback(async (marketData = null) => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    if (tickers.length === 0) return;
    
    setIsComputing(true);
    
    const data = marketData || unifiedMarketData;
    const missingTickers = tickers.filter(t => !data[t]?.dailyReturns?.length);
    
    if (missingTickers.length > 0) {
      console.warn(`⚠️ Missing data for: ${missingTickers.join(', ')}`);
      setIsComputing(false);
      return;
    }
    
    console.log(`📊 Computing ${historyTimeline} correlation for ${tickers.length} tickers...`);
    
    const targetDays = {
      '6mo': 126,
      '1y': 252,
      '2y': 504,
      '3y': 756,
    }[historyTimeline] || 252;
    
    // Get returns for each ticker
    const allReturns = tickers.map(ticker => {
      const tickerData = data[ticker];
      const allRets = tickerData?.dailyReturns || [];
      return allRets.slice(-targetDays);
    });
    
    // Compute EWMA lambda
    let ewmaLambda = 1.0;
    if (useEwma) {
      const halfLifeDays = {
        '6mo': 63,
        '1y': 126,
        '2y': 252,
        '3y': 378,
      }[historyTimeline] || 126;
      ewmaLambda = Math.exp(-Math.LN2 / halfLifeDays);
      console.log(`📊 Using EWMA with half-life: ${halfLifeDays} days (λ=${ewmaLambda.toFixed(4)})`);
    }
    
    // Compute pairwise correlations
    const N = tickers.length;
    let corr = Array(N).fill(null).map(() => Array(N).fill(0));
    
    for (let i = 0; i < N; i++) {
      corr[i][i] = 1;
      for (let j = i + 1; j < N; j++) {
        const { corr: pairCorr } = computePairwiseCorrelation(allReturns[i], allReturns[j], ewmaLambda);
        corr[i][j] = pairCorr;
        corr[j][i] = pairCorr;
      }
    }
    
    // Apply GLD as cash if enabled
    if (gldAsCash) {
      const gldIdx = tickers.indexOf('GLD');
      if (gldIdx >= 0) {
        for (let i = 0; i < corr.length; i++) {
          if (i !== gldIdx) {
            corr[i][gldIdx] = 0;
            corr[gldIdx][i] = 0;
          }
        }
      }
    }
    
    // Apply shrinkage if selected
    if (correlationMethod === 'shrinkage' || correlationMethod === 'ledoitWolf') {
      let sumCorr = 0, countCorr = 0;
      for (let i = 0; i < N - 1; i++) {
        for (let j = i + 1; j < N; j++) {
          sumCorr += corr[i][j];
          countCorr++;
        }
      }
      const rBar = countCorr > 0 ? sumCorr / countCorr : 0;
      
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (i !== j) {
            const shrinkageIntensity = 0.2; // Fixed for simplicity
            corr[i][j] = (1 - shrinkageIntensity) * corr[i][j] + shrinkageIntensity * rBar;
          }
        }
      }
      console.log(`Applied shrinkage (target corr: ${rBar.toFixed(3)})`);
    }
    
    corr = makeValidCorrelation(corr);
    setCorrelationMatrix(corr);
    setEditedCorrelation(corr.map(row => [...row]));
    console.log(`✅ Correlation matrix computed: ${corr.length}x${corr.length}`);
    
    setIsComputing(false);
    
    toast.success(`${corr.length}×${corr.length} matrix for ${historyTimeline} period`, {
      duration: 3500,
    });
    
    return corr;
  }, [positions, unifiedMarketData, historyTimeline, useEwma, gldAsCash, correlationMethod,
      setCorrelationMatrix, setEditedCorrelation, computePairwiseCorrelation]);

  /**
   * Run lag analysis for international stocks
   */
  const runLagAnalysis = useCallback(async (marketData = null) => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    if (tickers.length < 2) return null;
    
    setIsComputing(true);
    console.log('🕐 Running lag analysis for timezone effects...');
    
    const data = marketData || unifiedMarketData;
    
    const getReturns = (ticker) => {
      const unified = data[ticker];
      if (unified?.dailyReturns?.length > 0) return unified.dailyReturns;
      return [];
    };
    
    const allReturns = tickers.map(t => getReturns(t));
    const N = tickers.length;
    
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
    
    // Compute lagged correlations for all pairs
    const lagResults = [];
    const lagMatrix = {
      lagMinus1: Array(N).fill(null).map(() => Array(N).fill(0)),
      lag0: Array(N).fill(null).map(() => Array(N).fill(0)),
      lagPlus1: Array(N).fill(null).map(() => Array(N).fill(0)),
      maxCorr: Array(N).fill(null).map(() => Array(N).fill(0)),
      bestLag: Array(N).fill(null).map(() => Array(N).fill(0)),
    };
    
    for (let i = 0; i < N; i++) {
      lagMatrix.lag0[i][i] = 1;
      lagMatrix.lagMinus1[i][i] = 1;
      lagMatrix.lagPlus1[i][i] = 1;
      lagMatrix.maxCorr[i][i] = 1;
      lagMatrix.bestLag[i][i] = 0;
      
      for (let j = i + 1; j < N; j++) {
        const r1 = allReturns[i];
        const r2 = allReturns[j];
        
        const corrMinus1 = computeLaggedCorrelation(r1, r2, -1, ewmaLambda) ?? 0;
        const corr0 = computeLaggedCorrelation(r1, r2, 0, ewmaLambda) ?? 0;
        const corrPlus1 = computeLaggedCorrelation(r1, r2, 1, ewmaLambda) ?? 0;
        
        const correlations = [
          { lag: -1, corr: corrMinus1, abs: Math.abs(corrMinus1) },
          { lag: 0, corr: corr0, abs: Math.abs(corr0) },
          { lag: +1, corr: corrPlus1, abs: Math.abs(corrPlus1) },
        ];
        const best = correlations.reduce((a, b) => a.abs > b.abs ? a : b);
        
        lagMatrix.lagMinus1[i][j] = corrMinus1;
        lagMatrix.lagMinus1[j][i] = corrMinus1;
        lagMatrix.lag0[i][j] = corr0;
        lagMatrix.lag0[j][i] = corr0;
        lagMatrix.lagPlus1[i][j] = corrPlus1;
        lagMatrix.lagPlus1[j][i] = corrPlus1;
        lagMatrix.maxCorr[i][j] = best.corr;
        lagMatrix.maxCorr[j][i] = best.corr;
        lagMatrix.bestLag[i][j] = best.lag;
        lagMatrix.bestLag[j][i] = -best.lag;
        
        const lagEffect = best.abs - Math.abs(corr0);
        if (lagEffect > 0.03 || best.lag !== 0) {
          lagResults.push({
            ticker1: tickers[i],
            ticker2: tickers[j],
            idx1: i,
            idx2: j,
            corrMinus1,
            corr0,
            corrPlus1,
            bestLag: best.lag,
            bestCorr: best.corr,
            improvement: lagEffect,
            significant: lagEffect > 0.05,
          });
        }
      }
    }
    
    lagResults.sort((a, b) => b.improvement - a.improvement);
    
    const significantPairs = lagResults.filter(r => r.significant);
    console.log(`📊 Lag analysis complete: ${lagResults.length} pairs with lag effects, ${significantPairs.length} significant`);
    
    const lagAnalysisData = {
      tickers,
      results: lagResults,
      matrix: lagMatrix,
      significantCount: significantPairs.length,
      timestamp: new Date().toISOString(),
    };
    
    setLagAnalysis(lagAnalysisData);
    setIsComputing(false);
    
    return lagAnalysisData;
  }, [positions, unifiedMarketData, useEwma, historyTimeline, setLagAnalysis, computeLaggedCorrelation]);

  /**
   * Apply lag-adjusted correlations to the matrix
   */
  const applyLagAdjustment = useCallback((lagData = null) => {
    const analysis = lagData || lagAnalysis;
    if (!analysis?.matrix?.maxCorr || !editedCorrelation) {
      console.log('❌ Cannot apply: missing lagAnalysis or editedCorrelation');
      return;
    }
    
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    const lagTickers = analysis.tickers;
    
    console.log('🔧 Applying lag-adjusted correlations...');
    
    const newCorr = editedCorrelation.map(row => [...row]);
    let adjustmentsMade = 0;
    const adjustmentLog = [];
    
    for (let i = 0; i < tickers.length; i++) {
      for (let j = i + 1; j < tickers.length; j++) {
        const lagI = lagTickers.indexOf(tickers[i]);
        const lagJ = lagTickers.indexOf(tickers[j]);
        
        if (lagI >= 0 && lagJ >= 0) {
          const maxCorr = analysis.matrix.maxCorr[lagI][lagJ];
          const currentCorr = newCorr[i][j];
          
          if (Math.abs(maxCorr) > Math.abs(currentCorr) + 0.01) {
            adjustmentLog.push(`${tickers[i]}-${tickers[j]}: ${(currentCorr*100).toFixed(1)}% → ${(maxCorr*100).toFixed(1)}%`);
            newCorr[i][j] = maxCorr;
            newCorr[j][i] = maxCorr;
            adjustmentsMade++;
          }
        }
      }
    }
    
    console.log(`Made ${adjustmentsMade} adjustments`);
    adjustmentLog.forEach(log => console.log(`  ${log}`));
    
    // Gentle PSD fix
    const n = newCorr.length;
    for (let i = 0; i < n; i++) {
      newCorr[i][i] = 1.0;
      for (let j = i + 1; j < n; j++) {
        const avg = (newCorr[i][j] + newCorr[j][i]) / 2;
        const clamped = Math.max(-0.999, Math.min(0.999, avg));
        newCorr[i][j] = clamped;
        newCorr[j][i] = clamped;
      }
    }
    
    setEditedCorrelation(newCorr);
    setUseLagAdjusted(true);
    
    if (adjustmentsMade > 0) {
      const summary = adjustmentLog.slice(0, 3).join('\n');
      toast.success(`Applied ${adjustmentsMade} lag adjustments:\n${summary}${adjustmentsMade > 3 ? `\n...and ${adjustmentsMade - 3} more` : ''}`, {
        duration: 6000,
      });
    } else {
      toast.info('No adjustments needed - correlations already optimal.');
    }
    
    return newCorr;
  }, [lagAnalysis, editedCorrelation, positions, setEditedCorrelation, setUseLagAdjusted]);

  return {
    // Data
    correlationMatrix,
    editedCorrelation,
    lagAnalysis,
    useLagAdjusted,
    
    // State
    isComputing,
    
    // Actions
    computeCorrelation,
    runLagAnalysis,
    applyLagAdjustment,
    
    // Utilities
    computePairwiseCorrelation,
    computeLaggedCorrelation,
  };
}
