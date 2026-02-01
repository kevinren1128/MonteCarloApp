/**
 * Consensus Tab - Professional Fundamental Analysis View
 *
 * @module components/tabs/ConsensusTab
 * @description Comprehensive analyst estimates, valuations, profitability, and financial health metrics
 * Designed for professional generalist analysts with high information density
 */

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  getApiKey,
  saveApiKey,
  batchFetchConsensusData,
  validateApiKey,
  fetchMissingConsensusData,
} from '../../services/fmpService';
import {
  getSharedConsensusData,
  getMissingOrStaleTickers,
  getSharedDataSummary,
} from '../../services/consensusService';

// Storage keys for localStorage persistence
const CONSENSUS_STORAGE_KEY = 'monte-carlo-consensus-data';
const CONSENSUS_TIMESTAMP_KEY = 'monte-carlo-consensus-timestamp';

// Save consensus data to localStorage
const saveConsensusData = (data) => {
  try {
    localStorage.setItem(CONSENSUS_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(CONSENSUS_TIMESTAMP_KEY, Date.now().toString());
    console.log('[Consensus] Saved data for', Object.keys(data).length, 'tickers');
  } catch (err) {
    console.warn('Failed to save consensus data:', err);
  }
};

// Load consensus data from localStorage
const loadConsensusData = () => {
  try {
    const data = localStorage.getItem(CONSENSUS_STORAGE_KEY);
    const timestamp = localStorage.getItem(CONSENSUS_TIMESTAMP_KEY);
    if (data) {
      return {
        data: JSON.parse(data),
        timestamp: timestamp ? new Date(parseInt(timestamp)) : null,
      };
    }
  } catch (err) {
    console.warn('Failed to load consensus data:', err);
  }
  return { data: {}, timestamp: null };
};

// Design tokens
const COLORS = {
  cyan: '#00d4ff',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#f39c12',
  purple: '#9b59b6',
  gold: '#f1c40f',
  blue: '#3498db',
};

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

// Format helpers
const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
};

const formatPct = (num, showSign = false, decimals = 1) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  const pct = (num * 100).toFixed(decimals);
  if (showSign && num > 0) return `+${pct}%`;
  return `${pct}%`;
};

const formatMult = (num) => {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '—';
  if (num < 0) return 'NM';
  return `${num.toFixed(1)}x`;
};

const formatRatio = (num, decimals = 1) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return num.toFixed(decimals);
};

const calcGrowth = (current, next) => {
  if (!current || !next || current === 0) return null;
  return (next - current) / Math.abs(current);
};

const hasValidEstimates = (data) => {
  if (!data) return false;
  const fy1Rev = data.fy1?.revenue || 0;
  const fy1Eps = data.fy1?.eps || 0;
  return fy1Rev > 0 || fy1Eps !== 0;
};

const getFyLabel = (fiscalYear) => {
  if (!fiscalYear) return '—';
  return `FY${String(fiscalYear).slice(-2)}`;
};

// Color functions
const getGrowthColor = (g) => {
  if (g === null || g === undefined) return 'rgba(255,255,255,0.4)';
  if (g > 0.2) return COLORS.green;
  if (g > 0.05) return '#7dcea0';
  if (g > -0.05) return COLORS.gold;
  if (g > -0.15) return COLORS.orange;
  return COLORS.red;
};

const getMarginColor = (m, thresholds = { good: 0.2, ok: 0.1 }) => {
  if (m === null || m === undefined) return 'rgba(255,255,255,0.4)';
  if (m >= thresholds.good) return COLORS.green;
  if (m >= thresholds.ok) return COLORS.gold;
  if (m >= 0) return COLORS.orange;
  return COLORS.red;
};

const getMultColor = (pe, thresholds = { cheap: 15, fair: 25 }) => {
  if (pe === null || pe === undefined || !isFinite(pe) || pe < 0) return 'rgba(255,255,255,0.4)';
  if (pe < thresholds.cheap) return COLORS.green;
  if (pe < thresholds.fair) return COLORS.gold;
  return COLORS.red;
};

const getZScoreColor = (z) => {
  if (z === null || z === undefined) return 'rgba(255,255,255,0.4)';
  if (z > 2.99) return COLORS.green; // Safe
  if (z > 1.81) return COLORS.gold; // Grey zone
  return COLORS.red; // Distress
};

const getPiotroskiColor = (p) => {
  if (p === null || p === undefined) return 'rgba(255,255,255,0.4)';
  if (p >= 7) return COLORS.green; // Strong
  if (p >= 4) return COLORS.gold; // Moderate
  return COLORS.red; // Weak
};

const getUpsideColor = (u) => {
  if (u === null || u === undefined) return 'rgba(255,255,255,0.4)';
  if (u > 0.15) return COLORS.green;
  if (u > 0) return '#7dcea0';
  if (u > -0.1) return COLORS.orange;
  return COLORS.red;
};

// Micro-components
const Badge = memo(({ children, color, small }) => (
  <span style={{
    padding: small ? '1px 4px' : '2px 6px',
    borderRadius: '3px',
    fontSize: small ? '8px' : '9px',
    fontWeight: '600',
    background: `${color}20`,
    border: `1px solid ${color}40`,
    color,
    whiteSpace: 'nowrap',
  }}>
    {children}
  </span>
));

const RatingBadge = memo(({ rating }) => {
  const colors = {
    'Strong Buy': COLORS.green, 'Buy': '#7dcea0',
    'Hold': COLORS.gold, 'Sell': COLORS.orange, 'Strong Sell': COLORS.red,
  };
  return <Badge color={colors[rating] || COLORS.gold} small>{rating}</Badge>;
});

// Consistent null value display component - use everywhere for missing data
const NullValue = memo(() => (
  <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: '400' }}>—</span>
));

const ZScoreBadge = memo(({ score }) => {
  if (score === null || score === undefined) return <NullValue />;
  const color = getZScoreColor(score);
  const label = score > 2.99 ? 'Safe' : score > 1.81 ? 'Grey' : 'Risk';
  return <Badge color={color} small>{score.toFixed(1)} {label}</Badge>;
});

const PiotroskiBadge = memo(({ score }) => {
  if (score === null || score === undefined) return <NullValue />;
  const color = getPiotroskiColor(score);
  return <Badge color={color} small>{score}/9</Badge>;
});

const Cell = memo(({ value, color, sub, align = 'right' }) => {
  // Auto-detect percentage values and italicize them
  const isPercentage = typeof value === 'string' && value.includes('%');
  return (
    <td style={{ padding: '10px 8px', fontSize: '12px', textAlign: align, verticalAlign: 'middle' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <span style={{ color: color || 'rgba(255,255,255,0.9)', fontWeight: color ? '600' : '500', fontStyle: isPercentage ? 'italic' : 'normal' }}>{value}</span>
        {sub && <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>{sub}</span>}
      </div>
    </td>
  );
});

// View tabs
const VIEW_TABS = [
  { id: 'estimates', label: 'Estimates', icon: '📝' },
  { id: 'valuation', label: 'Valuation', icon: '💰' },
  { id: 'profitability', label: 'Profitability', icon: '📈' },
  { id: 'health', label: 'Health', icon: '🏥' },
];

// Main Component
const ConsensusTab = memo(({ positions, styles }) => {
  const [consensusData, setConsensusData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, ticker: '' });
  const [sortBy, setSortBy] = useState('ticker');
  const [sortDir, setSortDir] = useState('asc');
  const [viewTab, setViewTab] = useState('estimates');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Load API key and persisted consensus data on mount
  useEffect(() => {
    const savedKey = getApiKey();
    if (savedKey) {
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
    }

    // Load persisted consensus data from localStorage first (instant)
    const { data: localData, timestamp } = loadConsensusData();
    if (localData && Object.keys(localData).length > 0) {
      setConsensusData(localData);
      setLastUpdated(timestamp);
      console.log('[Consensus] Loaded persisted data for', Object.keys(localData).length, 'tickers');
    }

    // Then try to load from shared database (async, may have fresher data)
    const loadSharedData = async () => {
      try {
        // Get tickers from positions prop (need to wait for it to be available)
        const tickerList = positions?.map(p => p.ticker?.toUpperCase()).filter(Boolean) || [];
        if (tickerList.length === 0) return;

        const sharedData = await getSharedConsensusData(tickerList);
        if (Object.keys(sharedData).length > 0) {
          console.log('[Consensus] Loaded shared DB data for', Object.keys(sharedData).length, 'tickers');
          // Merge with local data (shared data takes precedence for freshness)
          setConsensusData(prev => {
            const merged = { ...prev, ...sharedData };
            // Save merged data to localStorage
            saveConsensusData(merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn('[Consensus] Failed to load shared data:', err.message);
      }
    };

    loadSharedData();
  }, [positions]);

  // Tickers
  const tickers = [...new Set(positions.map(p => p.ticker?.toUpperCase()).filter(Boolean))];
  const tickersWithData = tickers.filter(t => hasValidEstimates(consensusData[t]));
  const tickersWithoutData = tickers.filter(t => consensusData[t] && !hasValidEstimates(consensusData[t]));

  // API key handlers
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) { setKeyError('Enter API key'); return; }
    setIsValidatingKey(true);
    setKeyError(null);
    try {
      if (await validateApiKey(apiKeyInput.trim())) {
        setApiKey(apiKeyInput.trim());
        saveApiKey(apiKeyInput.trim());
      } else {
        setKeyError('Invalid key');
      }
    } catch { setKeyError('Validation failed'); }
    setIsValidatingKey(false);
  };

  // Validate fetched data - log any suspicious values
  const validateData = useCallback((data) => {
    const issues = [];
    for (const [ticker, tickerData] of Object.entries(data)) {
      if (!tickerData || tickerData.isEtf || tickerData.failed) continue;

      // Check for potentially wrong revenue (should be in billions for most large caps)
      const fy1Rev = tickerData.fy1?.revenue;
      if (fy1Rev && fy1Rev < 1e6) {
        issues.push(`${ticker}: FY1 revenue seems too low (${fy1Rev})`);
      }

      // Check fiscal year dates are in the future
      const fy1Date = tickerData.fy1?.date;
      if (fy1Date) {
        const today = new Date().toISOString().split('T')[0];
        if (fy1Date < today) {
          issues.push(`${ticker}: FY1 date ${fy1Date} is in the past`);
        }
      }

      // Check forward P/E is reasonable (between 0 and 200)
      const fwdPE = tickerData.multiples?.forwardPE;
      if (fwdPE && (fwdPE < 0 || fwdPE > 200)) {
        issues.push(`${ticker}: Forward P/E seems unusual (${fwdPE?.toFixed(1)})`);
      }
    }

    if (issues.length > 0) {
      console.warn('[Consensus] Data validation issues:', issues);
    }
    return issues;
  }, []);

  // Fetch data - tries shared database first, then falls back to live FMP API
  const handleFetchData = useCallback(async () => {
    if (!tickers.length) return;
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ current: 0, total: tickers.length, ticker: 'Loading from shared database...' });

    try {
      // 1. Try shared database first (no API key needed)
      let sharedData = {};
      try {
        sharedData = await getSharedConsensusData(tickers);
        const summary = getSharedDataSummary(tickers, sharedData);
        console.log('[Consensus] Shared DB summary:', summary);
      } catch (dbError) {
        console.warn('[Consensus] Shared DB unavailable, falling back to live API:', dbError.message);
      }

      // 2. Identify tickers that need live FMP fetch (missing or stale)
      const missingTickers = getMissingOrStaleTickers(tickers, sharedData);

      // 3. Fetch missing from live FMP (requires API key)
      let liveData = {};
      if (missingTickers.length > 0 && apiKey) {
        console.log(`[Consensus] Fetching ${missingTickers.length} tickers from live FMP API`);
        setLoadingProgress({ current: Object.keys(sharedData).length, total: tickers.length, ticker: 'Fetching missing from FMP...' });

        liveData = await batchFetchConsensusData(missingTickers, apiKey, (current, total, ticker) =>
          setLoadingProgress({
            current: Object.keys(sharedData).length + current,
            total: tickers.length,
            ticker
          })
        );
      } else if (missingTickers.length > 0 && !apiKey) {
        console.log(`[Consensus] ${missingTickers.length} tickers missing but no API key for live fetch`);
      }

      // 4. Merge results (live data overrides shared for freshness)
      const mergedData = { ...sharedData, ...liveData };

      // Validate data before saving
      validateData(mergedData);

      setConsensusData(mergedData);
      setLastUpdated(new Date());

      // Persist to localStorage
      saveConsensusData(mergedData);

    } catch (err) {
      console.error('[Consensus] Fetch error:', err);
      setError(err.message);
    }
    setIsLoading(false);
  }, [apiKey, tickers, validateData]);

  // Fetch only missing/failed tickers
  const handleRetryFailed = useCallback(async () => {
    if (!apiKey || !tickers.length) return;
    setIsLoading(true);
    setError(null);
    try {
      const updatedData = await fetchMissingConsensusData(
        tickers,
        consensusData,
        apiKey,
        (current, total, ticker) => setLoadingProgress({ current, total, ticker })
      );

      // Validate data before saving
      validateData(updatedData);

      setConsensusData(updatedData);
      setLastUpdated(new Date());
      saveConsensusData(updatedData);
    } catch (err) { setError(err.message); }
    setIsLoading(false);
  }, [apiKey, tickers, consensusData, validateData]);

  // Sorting
  const sortedData = useMemo(() => {
    return [...tickers]
      .map(t => consensusData[t])
      .filter(hasValidEstimates)
      .sort((a, b) => {
        let aVal, bVal;
        switch (sortBy) {
          case 'ticker': aVal = a.ticker; bVal = b.ticker; break;
          case 'price': aVal = a.price || 0; bVal = b.price || 0; break;
          case 'upside': aVal = a.priceTargets?.upside ?? -999; bVal = b.priceTargets?.upside ?? -999; break;
          case 'revenue': aVal = a.fy1?.revenue || 0; bVal = b.fy1?.revenue || 0; break;
          case 'revGrowth': aVal = calcGrowth(a.fy0?.revenue, a.fy1?.revenue) ?? -999; bVal = calcGrowth(b.fy0?.revenue, b.fy1?.revenue) ?? -999; break;
          case 'eps': aVal = a.fy1?.eps || 0; bVal = b.fy1?.eps || 0; break;
          case 'epsGrowth': aVal = calcGrowth(a.fy0?.eps, a.fy1?.eps) ?? -999; bVal = calcGrowth(b.fy0?.eps, b.fy1?.eps) ?? -999; break;
          case 'pe': aVal = a.multiples?.forwardPE ?? 999; bVal = b.multiples?.forwardPE ?? 999; break;
          case 'evEbit': aVal = a.multiples?.fy1EvToEbit ?? a.multiples?.evToEbit ?? (a.enterpriseValue && a.fy1?.ebit > 0 ? a.enterpriseValue / a.fy1.ebit : 999); bVal = b.multiples?.fy1EvToEbit ?? b.multiples?.evToEbit ?? (b.enterpriseValue && b.fy1?.ebit > 0 ? b.enterpriseValue / b.fy1.ebit : 999); break;
          case 'evEbitda': aVal = a.multiples?.evToEbitda ?? 999; bVal = b.multiples?.evToEbitda ?? 999; break;
          case 'roe': aVal = a.profitability?.roe ?? -999; bVal = b.profitability?.roe ?? -999; break;
          case 'zScore': aVal = a.health?.altmanZScore ?? -999; bVal = b.health?.altmanZScore ?? -999; break;
          case 'piotroski': aVal = a.health?.piotroskiScore ?? -999; bVal = b.health?.piotroskiScore ?? -999; break;
          default: aVal = a.ticker; bVal = b.ticker;
        }
        if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
  }, [tickers, consensusData, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const toggleRow = (ticker) => setExpandedRows(prev => {
    const next = new Set(prev);
    next.has(ticker) ? next.delete(ticker) : next.add(ticker);
    return next;
  });

  // Summary stats
  const stats = useMemo(() => {
    if (!sortedData.length) return null;
    let buyCount = 0, holdCount = 0, sellCount = 0, upsideSum = 0, upsideN = 0;
    let avgZScore = 0, zN = 0, avgPiotroski = 0, pN = 0;

    sortedData.forEach(r => {
      if (r.ratings) {
        buyCount += (r.ratings.strongBuy || 0) + (r.ratings.buy || 0);
        holdCount += r.ratings.hold || 0;
        sellCount += (r.ratings.sell || 0) + (r.ratings.strongSell || 0);
      }
      if (r.priceTargets?.upside != null) { upsideSum += r.priceTargets.upside; upsideN++; }
      if (r.health?.altmanZScore != null) { avgZScore += r.health.altmanZScore; zN++; }
      if (r.health?.piotroskiScore != null) { avgPiotroski += r.health.piotroskiScore; pN++; }
    });

    return {
      buyPct: buyCount + holdCount + sellCount > 0 ? buyCount / (buyCount + holdCount + sellCount) : null,
      avgUpside: upsideN > 0 ? upsideSum / upsideN : null,
      avgZScore: zN > 0 ? avgZScore / zN : null,
      avgPiotroski: pN > 0 ? avgPiotroski / pN : null,
      count: sortedData.length,
    };
  }, [sortedData]);

  // Get dominant FY labels from data for column headers (must be before early returns)
  const fyLabels = useMemo(() => {
    if (!sortedData.length) {
      return { fy1: 'FY1', fy2: 'FY2', fy1Full: '', fy2Full: '' };
    }
    // Find the most common FY1/FY2 fiscal years across all tickers
    const fy1Years = {};
    const fy2Years = {};

    sortedData.forEach(row => {
      const fy1Year = row.fy1?.fiscalYear || (row.fy1?.date ? parseInt(row.fy1.date.substring(0, 4)) : null);
      const fy2Year = row.fy2?.fiscalYear || (row.fy2?.date ? parseInt(row.fy2.date.substring(0, 4)) : null);
      if (fy1Year) fy1Years[fy1Year] = (fy1Years[fy1Year] || 0) + 1;
      if (fy2Year) fy2Years[fy2Year] = (fy2Years[fy2Year] || 0) + 1;
    });

    // Get most common years
    const fy1 = Object.entries(fy1Years).sort((a, b) => b[1] - a[1])[0]?.[0] || 'FY1';
    const fy2 = Object.entries(fy2Years).sort((a, b) => b[1] - a[1])[0]?.[0] || 'FY2';

    return {
      fy1: fy1 ? `FY${String(fy1).slice(-2)}` : 'FY1',
      fy2: fy2 ? `FY${String(fy2).slice(-2)}` : 'FY2',
      fy1Full: fy1,
      fy2Full: fy2,
    };
  }, [sortedData]);

  // Build combined time series for a ticker (must be before early returns)
  const buildTimeSeries = useCallback((row) => {
    const seriesMap = new Map(); // Use map to handle deduplication, preferring estimates

    // Helper to calculate margin safely
    const calcMargin = (num, denom) => {
      if (!num || !denom || denom === 0) return null;
      return num / denom;
    };

    // Add historical data first (will be overwritten by estimates if same year)
    const historical = row.timeSeries?.historical || [];
    // Sort historical by year ascending (oldest first)
    const sortedHistorical = [...historical].sort((a, b) => (a.year || 0) - (b.year || 0));

    // Build a map of FCF by year from cash flow historical data
    const fcfByYear = {};
    const cashFlowHistorical = row.cashFlow?.historical || [];
    cashFlowHistorical.forEach((cf) => {
      if (cf.year) {
        fcfByYear[cf.year] = {
          freeCashFlow: cf.freeCashFlow,
          fcfConversion: cf.fcfConversion,
          capitalExpenditure: cf.capitalExpenditure,
          operatingCashFlow: cf.operatingCashFlow,
        };
      }
    });

    sortedHistorical.forEach((h) => {
      if (h.year) {
        const cfData = fcfByYear[h.year] || {};
        seriesMap.set(h.year, {
          year: h.year,
          label: `FY${String(h.year).slice(-2)}`,
          isEstimate: false,
          revenue: h.revenue,
          grossProfit: h.grossProfit,
          grossMargin: h.grossMargin,
          ebitda: h.ebitda,
          ebitdaMargin: calcMargin(h.ebitda, h.revenue),
          operatingIncome: h.operatingIncome,
          ebitMargin: h.operatingMargin ?? calcMargin(h.operatingIncome, h.revenue),
          netIncome: h.netIncome,
          netMargin: h.netMargin ?? calcMargin(h.netIncome, h.revenue),
          eps: h.eps,
          capitalExpenditure: cfData.capitalExpenditure,
          capexRatio: calcMargin(Math.abs(cfData.capitalExpenditure || 0), h.revenue),
          freeCashFlow: cfData.freeCashFlow,
          fcfMargin: calcMargin(cfData.freeCashFlow, h.revenue),
        });
      }
    });

    // Add forward estimates (overwrite historical for same year - estimates are more relevant)
    const forward = row.timeSeries?.forward || [];
    forward.forEach((f) => {
      if (f.fiscalYear) {
        // Calculate margins from the estimate values directly
        const revenue = f.revenue || 0;
        const ebitda = f.ebitda || 0;
        const ebit = f.ebit || 0;
        const netIncome = f.netIncome || 0;

        seriesMap.set(f.fiscalYear, {
          year: f.fiscalYear,
          label: `FY${String(f.fiscalYear).slice(-2)}E`,
          isEstimate: true,
          revenue: revenue,
          grossProfit: f.grossProfit,
          grossMargin: f.grossMargin,
          ebitda: ebitda,
          ebitdaMargin: calcMargin(ebitda, revenue),
          operatingIncome: ebit,
          ebitMargin: calcMargin(ebit, revenue),
          netIncome: netIncome,
          netMargin: calcMargin(netIncome, revenue),
          eps: f.eps,
          // CapEx and FCF not available in forward estimates
          capitalExpenditure: null,
          capexRatio: null,
          freeCashFlow: null,
          fcfMargin: null,
        });
      }
    });

    // Convert map to array, sorted by year
    const series = Array.from(seriesMap.values()).sort((a, b) => a.year - b.year);

    // Keep last 20 periods max to show as much historical data as possible
    // Tables have horizontal scrolling enabled for overflow
    return series.slice(-20);
  }, []);

  // Calculate YoY growth for a metric
  const calcYoYGrowth = useCallback((series, idx, field) => {
    if (idx === 0) return null;
    const curr = series[idx][field];
    const prev = series[idx - 1][field];
    if (!curr || !prev || prev === 0) return null;
    return (curr - prev) / Math.abs(prev);
  }, []);

  // Styles
  const thStyle = {
    padding: '12px 8px', textAlign: 'left', fontSize: '11px', fontWeight: '700',
    color: 'rgba(255,255,255,0.7)', borderBottom: '2px solid rgba(255,255,255,0.15)',
    cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
    textTransform: 'uppercase', letterSpacing: '0.3px',
  };

  const SortIcon = ({ col }) => sortBy === col ? <span style={{ opacity: 0.7, marginLeft: '2px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span> : null;

  // No API key
  if (!apiKey) {
    return (
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ maxWidth: '380px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', padding: '24px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔑</div>
          <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '15px' }}>FMP API Key Required</h3>
          <p style={{ margin: '0 0 16px', color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
            Get your key from <a href="https://financialmodelingprep.com" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.cyan }}>financialmodelingprep.com</a>
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="API key..." onKeyPress={(e) => e.key === 'Enter' && handleSaveApiKey()}
              style={{ flex: 1, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '11px', fontFamily: FONT_FAMILY }}
            />
            <button onClick={handleSaveApiKey} disabled={isValidatingKey}
              style={{ padding: '8px 14px', background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
              {isValidatingKey ? '...' : 'Save'}
            </button>
          </div>
          {keyError && <p style={{ margin: '10px 0 0', color: COLORS.red, fontSize: '10px' }}>{keyError}</p>}
        </div>
      </div>
    );
  }

  // No positions
  if (!tickers.length) {
    return <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>Add positions to see consensus estimates</div>;
  }

  // Column definitions by view
  const renderTableHead = () => {
    const common = [
      <th key="ticker" onClick={() => handleSort('ticker')} style={{ ...thStyle, position: 'sticky', left: 0, background: 'rgba(12,14,24,0.98)', zIndex: 2 }}>Ticker<SortIcon col="ticker" /></th>,
      <th key="price" onClick={() => handleSort('price')} style={{ ...thStyle, textAlign: 'right' }}>Price<SortIcon col="price" /></th>,
      <th key="upside" onClick={() => handleSort('upside')} style={{ ...thStyle, textAlign: 'right' }}>Target<SortIcon col="upside" /></th>,
      <th key="rating" style={{ ...thStyle, textAlign: 'center' }}>Rating</th>,
    ];

    if (viewTab === 'estimates') {
      return [...common,
        <th key="rev" onClick={() => handleSort('revenue')} style={{ ...thStyle, textAlign: 'right' }} title={`Forward Revenue (${fyLabels.fy1Full})`}>{fyLabels.fy1} Rev<SortIcon col="revenue" /></th>,
        <th key="revG" onClick={() => handleSort('revGrowth')} style={{ ...thStyle, textAlign: 'right' }} title={`YoY Revenue Growth (prior year to ${fyLabels.fy1})`}>YoY Rev<SortIcon col="revGrowth" /></th>,
        <th key="eps" onClick={() => handleSort('eps')} style={{ ...thStyle, textAlign: 'right' }} title={`Forward EPS (${fyLabels.fy1Full})`}>{fyLabels.fy1} EPS<SortIcon col="eps" /></th>,
        <th key="epsG" onClick={() => handleSort('epsGrowth')} style={{ ...thStyle, textAlign: 'right' }} title={`YoY EPS Growth (prior year to ${fyLabels.fy1})`}>YoY EPS<SortIcon col="epsGrowth" /></th>,
        <th key="ebit" style={{ ...thStyle, textAlign: 'right' }} title={`${fyLabels.fy1} EBIT Margin = EBIT / Revenue`}>{fyLabels.fy1} EBIT%</th>,
        <th key="net" style={{ ...thStyle, textAlign: 'right' }} title={`${fyLabels.fy1} Net Margin = Net Income / Revenue`}>{fyLabels.fy1} Net%</th>,
        <th key="earn" style={{ ...thStyle, textAlign: 'center' }} title="Next Earnings Date">Next Earn</th>,
        <th key="surp" style={{ ...thStyle, textAlign: 'center' }} title="Average EPS Surprise (last 4 quarters)">Avg Surp</th>,
      ];
    }

    if (viewTab === 'valuation') {
      return [...common,
        <th key="mktcap" style={{ ...thStyle, textAlign: 'right' }} title="Market Capitalization">Mkt Cap</th>,
        <th key="ev" style={{ ...thStyle, textAlign: 'right' }} title="Enterprise Value = Market Cap + Debt - Cash">EV</th>,
        <th key="pe" onClick={() => handleSort('pe')} style={{ ...thStyle, textAlign: 'right' }} title="Price-to-Earnings. Lower may indicate value; compare to industry peers">{fyLabels.fy1} P/E<SortIcon col="pe" /></th>,
        <th key="evEbit" onClick={() => handleSort('evEbit')} style={{ ...thStyle, textAlign: 'right' }} title="Enterprise Value / EBIT. Better than EV/EBITDA for comparing capital intensity">{fyLabels.fy1} EV/EBIT<SortIcon col="evEbit" /></th>,
        <th key="evE" onClick={() => handleSort('evEbitda')} style={{ ...thStyle, textAlign: 'right' }} title="Enterprise Value / EBITDA. Useful for comparing companies with different debt levels">{fyLabels.fy1} EV/EBITDA<SortIcon col="evEbitda" /></th>,
        <th key="ps" style={{ ...thStyle, textAlign: 'right' }} title="Price-to-Sales. Useful for unprofitable growth companies">{fyLabels.fy1} P/S</th>,
        <th key="pfcf" style={{ ...thStyle, textAlign: 'right' }} title="Price to Free Cash Flow. Shows how much you pay for each $1 of cash generated">TTM P/FCF</th>,
        <th key="fcfY" style={{ ...thStyle, textAlign: 'right' }} title="FCF / Market Cap. Higher = more cash return potential">TTM FCF%</th>,
      ];
    }

    if (viewTab === 'profitability') {
      return [...common,
        <th key="gm" style={{ ...thStyle, textAlign: 'right' }} title="TTM Gross Profit Margin">TTM Gross%</th>,
        <th key="om" style={{ ...thStyle, textAlign: 'right' }} title="Operating margin before interest and taxes">TTM EBIT%</th>,
        <th key="nm" style={{ ...thStyle, textAlign: 'right' }} title="TTM Net Profit Margin">TTM Net%</th>,
        <th key="roe" onClick={() => handleSort('roe')} style={{ ...thStyle, textAlign: 'right' }} title="Return on Equity. How efficiently profits are generated from shareholder equity">TTM ROE<SortIcon col="roe" /></th>,
        <th key="roa" style={{ ...thStyle, textAlign: 'right' }} title="Return on Assets. Measures profitability relative to total assets">TTM ROA</th>,
        <th key="roic" style={{ ...thStyle, textAlign: 'right' }} title="Return on Invested Capital. Shows efficiency of capital allocation">TTM ROIC</th>,
        <th key="revHG" style={{ ...thStyle, textAlign: 'right' }} title="3-Year Average Annual Revenue Growth">3Y Rev CAGR</th>,
        <th key="epsHG" style={{ ...thStyle, textAlign: 'right' }} title="3-Year Average Annual EPS Growth">3Y EPS CAGR</th>,
      ];
    }

    if (viewTab === 'health') {
      return [...common,
        <th key="zScore" onClick={() => handleSort('zScore')} style={{ ...thStyle, textAlign: 'center' }} title="Altman Z-Score measures bankruptcy risk. >2.99 = Safe, 1.81-2.99 = Grey zone, <1.81 = Distress risk">Z-Score<SortIcon col="zScore" /></th>,
        <th key="piotr" onClick={() => handleSort('piotroski')} style={{ ...thStyle, textAlign: 'center' }} title="F-Score (0-9) rates financial strength. 7-9 = Strong, 4-6 = Average, 0-3 = Weak">Piotroski<SortIcon col="piotroski" /></th>,
        <th key="de" style={{ ...thStyle, textAlign: 'right' }} title="Debt-to-Equity ratio. Lower is safer; >2 may signal high leverage">D/E</th>,
        <th key="curr" style={{ ...thStyle, textAlign: 'right' }} title="Current Ratio = Current Assets / Current Liabilities. >1.5 is healthy">Current</th>,
        <th key="quick" style={{ ...thStyle, textAlign: 'right' }} title="Quick Ratio excludes inventory. >1 means good liquidity">Quick</th>,
        <th key="intCov" style={{ ...thStyle, textAlign: 'right' }} title="Interest Coverage = EBIT / Interest. >5 is comfortable, <2 is risky">Int Cov</th>,
        <th key="payout" style={{ ...thStyle, textAlign: 'right' }} title="Dividend Payout Ratio">Payout%</th>,
        <th key="fcfps" style={{ ...thStyle, textAlign: 'right' }} title="Free Cash Flow per Share available to shareholders">FCF/Sh</th>,
      ];
    }

    return common;
  };

  const renderTableRow = (row) => {
    // Calculate YoY growth: prior year (fy0) to current estimate year (fy1)
    const revGrowth = calcGrowth(row.fy0?.revenue, row.fy1?.revenue);
    const epsGrowth = calcGrowth(row.fy0?.eps, row.fy1?.eps);
    const upside = row.priceTargets?.upside;
    const isExpanded = expandedRows.has(row.ticker);

    const tickerCell = (
      <td key="ticker" style={{
        padding: '6px 5px',
        fontSize: '10px',
        position: 'sticky',
        left: 0,
        background: isExpanded ? 'rgba(12,14,24,0.98)' : 'rgba(12,14,24,0.95)',
        zIndex: 1,
        userSelect: 'none',
        cursor: 'pointer',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              fontSize: '10px',
              color: 'rgba(255,255,255,0.5)',
              width: '12px',
              flexShrink: 0,
            }}>
              {isExpanded ? '▼' : '▶'}
            </span>
            <span style={{ fontWeight: '600', color: COLORS.cyan }}>
              {row.ticker}
            </span>
            {row.fmpSymbol && row.fmpSymbol !== row.ticker && (
              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>→{row.fmpSymbol}</span>
            )}
            {row.isEtf && <Badge color={COLORS.purple} small>ETF</Badge>}
            {row.failed && <Badge color={COLORS.red} small>Failed</Badge>}
          </div>
          <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '16px' }}>{row.name}</span>
        </div>
      </td>
    );

    const priceCell = <Cell key="price" value={`$${row.price?.toFixed(2) || '—'}`} color={row.changesPercentage >= 0 ? COLORS.green : COLORS.red} />;

    const upsideCell = (
      <td key="upside" style={{ padding: '6px 5px', fontSize: '10px', textAlign: 'right' }}>
        {upside != null ? (
          <span style={{ color: getUpsideColor(upside), fontWeight: '600', fontStyle: 'italic' }}>
            {upside > 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
          </span>
        ) : '—'}
      </td>
    );

    const ratingCell = (
      <td key="rating" style={{ padding: '6px 5px', textAlign: 'center' }}>
        {row.ratings?.consensus ? <RatingBadge rating={row.ratings.consensus} /> : '—'}
      </td>
    );

    const common = [tickerCell, priceCell, upsideCell, ratingCell];

    if (viewTab === 'estimates') {
      return [...common,
        <Cell key="rev" value={formatNumber(row.fy1?.revenue)} />,
        <td key="revG" style={{ padding: '6px 5px', fontSize: '10px', textAlign: 'right' }}>
          <span style={{ color: getGrowthColor(revGrowth), fontWeight: '600', fontStyle: 'italic' }}>
            {revGrowth != null ? `${revGrowth > 0 ? '+' : ''}${(revGrowth * 100).toFixed(1)}%` : '—'}
          </span>
        </td>,
        <Cell key="eps" value={row.fy1?.eps != null ? `$${row.fy1.eps.toFixed(2)}` : '—'} />,
        <td key="epsG" style={{ padding: '6px 5px', fontSize: '10px', textAlign: 'right' }}>
          <span style={{ color: getGrowthColor(epsGrowth), fontWeight: '600', fontStyle: 'italic' }}>
            {epsGrowth != null ? `${epsGrowth > 0 ? '+' : ''}${(epsGrowth * 100).toFixed(1)}%` : '—'}
          </span>
        </td>,
        <td key="ebit" style={{ padding: '6px 5px', fontSize: '10px', textAlign: 'right' }}>
          <span style={{ color: getMarginColor(row.fy1?.ebitMargin), fontStyle: 'italic' }}>
            {formatPct(row.fy1?.ebitMargin)}
          </span>
        </td>,
        <td key="net" style={{ padding: '6px 5px', fontSize: '10px', textAlign: 'right' }}>
          <span style={{ color: getMarginColor(row.fy1?.netMargin, { good: 0.15, ok: 0.05 }), fontStyle: 'italic' }}>
            {formatPct(row.fy1?.netMargin)}
          </span>
        </td>,
        <td key="earn" style={{ padding: '6px 5px', textAlign: 'center', fontSize: '10px' }}>
          {row.earnings?.nextDate ? (
            <Badge color={COLORS.cyan} small>{row.earnings.nextDate.slice(5)}</Badge>
          ) : '—'}
        </td>,
        <td key="surp" style={{ padding: '6px 5px', textAlign: 'center', fontSize: '10px' }}>
          {row.earnings?.avgSurprise != null ? (
            <span style={{ color: row.earnings.avgSurprise > 0 ? COLORS.green : COLORS.red, fontWeight: '600', fontStyle: 'italic' }}>
              {row.earnings.avgSurprise > 0 ? '+' : ''}{(row.earnings.avgSurprise * 100).toFixed(1)}%
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginLeft: '2px', fontStyle: 'normal' }}>({row.earnings.beatCount}B/{row.earnings.missCount}M)</span>
            </span>
          ) : '—'}
        </td>,
      ];
    }

    if (viewTab === 'valuation') {
      return [...common,
        <Cell key="mktcap" value={formatNumber(row.marketCap)} />,
        <Cell key="ev" value={formatNumber(row.enterpriseValue)} />,
        <Cell key="pe" value={formatMult(row.multiples?.forwardPE)} color={getMultColor(row.multiples?.forwardPE)} />,
        <Cell key="evEbit" value={formatMult(
          row.multiples?.fy1EvToEbit || row.multiples?.evToEbit ||
          ((row.enterpriseValue && row.fy1?.ebit && row.fy1.ebit > 0)
            ? row.enterpriseValue / row.fy1.ebit : null)
        )} color={getMultColor(row.multiples?.fy1EvToEbit || row.multiples?.evToEbit || (row.enterpriseValue && row.fy1?.ebit > 0 ? row.enterpriseValue / row.fy1.ebit : null), { cheap: 12, fair: 18 })} />,
        <Cell key="evE" value={formatMult(row.multiples?.fy1EvToEbitda || row.multiples?.fy2EvToEbitda || row.multiples?.evToEbitda)} color={getMultColor(row.multiples?.fy1EvToEbitda || row.multiples?.fy2EvToEbitda || row.multiples?.evToEbitda, { cheap: 10, fair: 15 })} />,
        <Cell key="ps" value={formatMult(row.multiples?.fy1PriceToSales || row.multiples?.fy2PriceToSales || row.multiples?.priceToSales)} />,
        <Cell key="pfcf" value={formatMult(
          row.cashFlow?.priceToFCF || row.multiples?.priceToFCF ||
          ((row.marketCap && row.cashFlow?.freeCashFlow && row.cashFlow.freeCashFlow > 0)
            ? row.marketCap / row.cashFlow.freeCashFlow : null)
        )} />,
        <Cell key="fcfY" value={row.profitability?.freeCashFlowYield != null ? formatPct(row.profitability.freeCashFlowYield) : (row.cashFlow?.fcfMargin != null ? formatPct(row.cashFlow.fcfMargin) : '—')} color={row.profitability?.freeCashFlowYield > 0.05 || row.cashFlow?.fcfMargin > 0.05 ? COLORS.green : undefined} />,
      ];
    }

    if (viewTab === 'profitability') {
      return [...common,
        <Cell key="gm" value={formatPct(row.historical?.grossMargin)} color={getMarginColor(row.historical?.grossMargin, { good: 0.4, ok: 0.2 })} />,
        <Cell key="om" value={formatPct(row.historical?.operatingMargin)} color={getMarginColor(row.historical?.operatingMargin)} />,
        <Cell key="nm" value={formatPct(row.historical?.netMargin)} color={getMarginColor(row.historical?.netMargin, { good: 0.15, ok: 0.05 })} />,
        <Cell key="roe" value={formatPct(row.profitability?.roe)} color={getMarginColor(row.profitability?.roe, { good: 0.15, ok: 0.08 })} />,
        <Cell key="roa" value={formatPct(row.profitability?.roa)} color={getMarginColor(row.profitability?.roa, { good: 0.08, ok: 0.03 })} />,
        <Cell key="roic" value={formatPct(row.profitability?.roic)} color={getMarginColor(row.profitability?.roic, { good: 0.12, ok: 0.06 })} />,
        <Cell key="revHG" value={row.growth?.revenue != null ? formatPct(row.growth.revenue, true) : '—'} color={getGrowthColor(row.growth?.revenue)} />,
        <Cell key="epsHG" value={row.growth?.eps != null ? formatPct(row.growth.eps, true) : '—'} color={getGrowthColor(row.growth?.eps)} />,
      ];
    }

    if (viewTab === 'health') {
      return [...common,
        <td key="zScore" style={{ padding: '6px 5px', textAlign: 'center' }}><ZScoreBadge score={row.health?.altmanZScore} /></td>,
        <td key="piotr" style={{ padding: '6px 5px', textAlign: 'center' }}><PiotroskiBadge score={row.health?.piotroskiScore} /></td>,
        <Cell key="de" value={formatRatio(row.health?.debtToEquity)} color={row.health?.debtToEquity > 2 ? COLORS.red : row.health?.debtToEquity > 1 ? COLORS.orange : COLORS.green} />,
        <Cell key="curr" value={formatRatio(row.health?.currentRatio)} color={row.health?.currentRatio > 1.5 ? COLORS.green : row.health?.currentRatio > 1 ? COLORS.gold : COLORS.red} />,
        <Cell key="quick" value={formatRatio(row.health?.quickRatio)} />,
        <Cell key="intCov" value={formatRatio(row.health?.interestCoverage)} color={row.health?.interestCoverage > 5 ? COLORS.green : row.health?.interestCoverage > 2 ? COLORS.gold : COLORS.red} />,
        <Cell key="payout" value={formatPct(row.cashFlow?.payoutRatio)} color={row.cashFlow?.payoutRatio > 0.8 ? COLORS.red : row.cashFlow?.payoutRatio > 0.6 ? COLORS.orange : undefined} />,
        <Cell key="fcfps" value={row.cashFlow?.freeCashFlowPerShare != null ? `$${row.cashFlow.freeCashFlowPerShare.toFixed(2)}` : '—'} />,
      ];
    }

    return common;
  };

  const renderExpandedRow = (row, index) => {
    if (!expandedRows.has(row.ticker)) return null;
    const colSpan = 12;
    const timeSeries = buildTimeSeries(row);

    // Professional colors with good visibility - balanced between subtle and clear
    const accentColors = [
      { bg: 'rgba(80, 180, 220, 0.15)', border: '#5bc0de', text: '#5bc0de' },   // Sky blue
      { bg: 'rgba(230, 160, 60, 0.15)', border: '#e6a03c', text: '#e6a03c' },   // Warm orange
      { bg: 'rgba(90, 180, 120, 0.15)', border: '#5ab478', text: '#5ab478' },   // Fresh green
      { bg: 'rgba(200, 120, 160, 0.15)', border: '#c878a0', text: '#c878a0' },  // Rose pink
      { bg: 'rgba(180, 160, 80, 0.15)', border: '#b4a050', text: '#b4a050' },   // Olive gold
      { bg: 'rgba(200, 130, 130, 0.15)', border: '#c88282', text: '#c88282' },  // Terracotta
    ];
    const accent = accentColors[index % accentColors.length];

    // Enhanced styling for better visibility
    const cellStyle = { padding: '8px 10px', fontSize: '11px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.08)' };
    const headerCellStyle = { ...cellStyle, fontWeight: '700', color: 'rgba(255,255,255,0.8)', textAlign: 'left', background: 'rgba(0,0,0,0.2)' };
    const yearCellStyle = (isEst) => ({
      ...cellStyle,
      fontWeight: '700',
      textAlign: 'center',
      color: isEst ? COLORS.cyan : 'rgba(255,255,255,0.9)',
      background: isEst ? 'rgba(0,212,255,0.12)' : 'rgba(0,0,0,0.15)',
    });

    // Render view-specific time series content
    const renderEstimatesContent = () => (
      timeSeries.length > 0 && (
        <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: accent.text, marginBottom: '10px' }}>
            📈 Financial Time Series (Historical → Forward Estimates)
          </div>
          <div style={{
            overflowX: 'auto',
            maxWidth: '100%',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          }}>
            <table style={{ minWidth: `${100 + timeSeries.length * 85}px`, borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={headerCellStyle}>Metric</th>
                  {timeSeries.map((s, i) => (
                    <th key={i} style={yearCellStyle(s.isEstimate)}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Revenue with YoY growth */}
                <tr>
                  <td style={headerCellStyle}>Revenue</td>
                  {timeSeries.map((s, i) => {
                    const g = calcYoYGrowth(timeSeries, i, 'revenue');
                    return (
                      <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                        <div>{formatNumber(s.revenue)}</div>
                        {i > 0 && g != null && (
                          <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: getGrowthColor(g), marginTop: '2px' }}>
                            {g > 0 ? '+' : ''}{(g * 100).toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* Gross Profit with margin */}
                <tr>
                  <td style={headerCellStyle}>Gross Profit</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <div>{s.grossProfit ? formatNumber(s.grossProfit) : '—'}</div>
                      {s.grossMargin != null && (
                        <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: getMarginColor(s.grossMargin, { good: 0.5, ok: 0.3 }), marginTop: '2px' }}>
                          {(s.grossMargin * 100).toFixed(1)}%
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* EBITDA with margin */}
                <tr>
                  <td style={headerCellStyle}>EBITDA</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <div>{s.ebitda ? formatNumber(s.ebitda) : '—'}</div>
                      {s.ebitdaMargin != null && (
                        <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: getMarginColor(s.ebitdaMargin, { good: 0.25, ok: 0.15 }), marginTop: '2px' }}>
                          {(s.ebitdaMargin * 100).toFixed(1)}%
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* EBIT with margin */}
                <tr>
                  <td style={headerCellStyle}>EBIT</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <div>{s.operatingIncome ? formatNumber(s.operatingIncome) : '—'}</div>
                      {s.ebitMargin != null && (
                        <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: getMarginColor(s.ebitMargin), marginTop: '2px' }}>
                          {(s.ebitMargin * 100).toFixed(1)}%
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* Net Income with margin */}
                <tr>
                  <td style={headerCellStyle}>Net Income</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <div>{s.netIncome ? formatNumber(s.netIncome) : '—'}</div>
                      {s.netMargin != null && (
                        <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: getMarginColor(s.netMargin, { good: 0.15, ok: 0.05 }), marginTop: '2px' }}>
                          {(s.netMargin * 100).toFixed(1)}%
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* EPS with YoY growth */}
                <tr>
                  <td style={headerCellStyle}>EPS</td>
                  {timeSeries.map((s, i) => {
                    const g = calcYoYGrowth(timeSeries, i, 'eps');
                    return (
                      <td key={i} style={{ ...cellStyle, fontWeight: '500', background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                        <div>{s.eps != null ? `$${s.eps.toFixed(2)}` : '—'}</div>
                        {i > 0 && g != null && (
                          <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: getGrowthColor(g), marginTop: '2px' }}>
                            {g > 0 ? '+' : ''}{(g * 100).toFixed(1)}%
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                {/* CapEx with CapEx % of Revenue */}
                <tr>
                  <td style={headerCellStyle}>CapEx</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <div style={{ color: s.capitalExpenditure ? undefined : 'rgba(255,255,255,0.35)' }}>
                        {s.capitalExpenditure ? formatNumber(Math.abs(s.capitalExpenditure)) : '—'}
                      </div>
                      {s.capexRatio != null && (
                        <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                          {(s.capexRatio * 100).toFixed(1)}%
                        </div>
                      )}
                    </td>
                  ))}
                </tr>

                {/* FCF with FCF margin */}
                <tr>
                  <td style={headerCellStyle}>FCF</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <div style={{ color: s.freeCashFlow ? undefined : 'rgba(255,255,255,0.35)' }}>
                        {s.freeCashFlow ? formatNumber(s.freeCashFlow) : '—'}
                      </div>
                      {s.fcfMargin != null && (
                        <div style={{ fontSize: '8px', fontWeight: '500', fontStyle: 'italic', color: getMarginColor(s.fcfMargin, { good: 0.15, ok: 0.08 }), marginTop: '2px' }}>
                          {(s.fcfMargin * 100).toFixed(1)}%
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )
    );

    const renderValuationContent = () => {
      // Build valuation time series using price and forward estimates
      const price = row.price || 0;
      const marketCap = row.marketCap || 0;
      const ev = row.enterpriseValue || 0;

      return (
        <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: accent.text, marginBottom: '12px' }}>
            💰 Valuation Multiples (Forward Estimates)
          </div>
          {/* Time series table with horizontal scroll */}
          <div style={{
            overflowX: 'auto',
            maxWidth: '100%',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          }}>
            <table style={{ minWidth: `${120 + timeSeries.length * 85}px`, borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={headerCellStyle}>Multiple</th>
                  {timeSeries.map((s, i) => (
                    <th key={i} style={yearCellStyle(s.isEstimate)}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Forward P/E */}
                <tr>
                  <td style={headerCellStyle} title="Price-to-Earnings. Lower may indicate value; compare to industry peers">P/E</td>
                  {timeSeries.map((s, i) => {
                    const pe = s.eps ? price / s.eps : null;
                    return (
                      <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                        <span style={{ fontWeight: '600', color: getMultColor(pe) }}>
                          {formatMult(pe)}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* EV/EBITDA */}
                <tr>
                  <td style={headerCellStyle} title="Enterprise Value / EBITDA. Useful for comparing companies with different debt levels">EV/EBITDA</td>
                  {timeSeries.map((s, i) => {
                    const evEbitda = s.ebitda ? ev / s.ebitda : null;
                    return (
                      <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                        <span style={{ fontWeight: '600', color: getMultColor(evEbitda, { cheap: 10, fair: 15 }) }}>
                          {formatMult(evEbitda)}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* EV/EBIT */}
                <tr>
                  <td style={headerCellStyle} title="Enterprise Value / EBIT (Operating Income)">EV/EBIT</td>
                  {timeSeries.map((s, i) => {
                    const evEbit = s.operatingIncome ? ev / s.operatingIncome : null;
                    return (
                      <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                        <span style={{ fontWeight: '600', color: getMultColor(evEbit, { cheap: 12, fair: 20 }) }}>
                          {formatMult(evEbit)}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* Price/Sales */}
                <tr>
                  <td style={headerCellStyle} title="Price-to-Sales. Useful for unprofitable growth companies">P/Sales</td>
                  {timeSeries.map((s, i) => {
                    const ps = s.revenue ? marketCap / s.revenue : null;
                    return (
                      <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                        <span style={{ fontWeight: '600' }}>
                          {formatMult(ps)}
                        </span>
                      </td>
                    );
                  })}
                </tr>

                {/* EV/Sales */}
                <tr>
                  <td style={headerCellStyle} title="Enterprise Value / Sales">EV/Sales</td>
                  {timeSeries.map((s, i) => {
                    const evSales = s.revenue ? ev / s.revenue : null;
                    return (
                      <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                        <span style={{ fontWeight: '600' }}>
                          {formatMult(evSales)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Additional valuation metrics - flex wrap for dynamic width */}
          {(() => {
            // Calculate derived metrics
            const fcf = row.cashFlow?.freeCashFlow;
            const ttmRevenue = row.historical?.revenue || row.fy0?.revenue;
            const priceToFCF = (marketCap && fcf && fcf > 0) ? marketCap / fcf : null;
            const fcfYield = (fcf && marketCap) ? fcf / marketCap : null;
            const evToSalesTTM = (ev && ttmRevenue) ? ev / ttmRevenue : null;

            return (
              <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px', minWidth: '80px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>NTM P/E</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: getMultColor(row.multiples?.forwardPE) }}>{formatMult(row.multiples?.forwardPE)}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px', minWidth: '80px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>P/B</div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatMult(row.cashFlow?.priceToBook || row.historical?.pbRatio)}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px', minWidth: '80px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }} title="Price to Free Cash Flow. Shows how much you pay for each $1 of cash generated">P/FCF</div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatMult(priceToFCF)}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px', minWidth: '80px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Div Yield</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', fontStyle: 'italic', color: row.cashFlow?.dividendYield > 0.02 ? COLORS.green : undefined }}>{formatPct(row.cashFlow?.dividendYield)}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px', minWidth: '80px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }} title="FCF / Market Cap. Higher = more cash return potential">FCF Yield</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', fontStyle: 'italic', color: fcfYield > 0.05 ? COLORS.green : undefined }}>{formatPct(fcfYield)}</div>
                </div>
                <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px', minWidth: '80px' }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>EV/Sales (TTM)</div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatMult(evToSalesTTM)}</div>
                </div>
              </div>
            );
          })()}
        </div>
      );
    };

    const renderProfitabilityContent = () => (
      timeSeries.length > 0 && (
        <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: accent.text, marginBottom: '12px' }}>
            📈 Profitability & Margins (Historical → Forward)
          </div>
          <div style={{
            overflowX: 'auto',
            maxWidth: '100%',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.2) transparent',
          }}>
            <table style={{ minWidth: `${120 + timeSeries.length * 85}px`, borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={headerCellStyle}>Margin</th>
                  {timeSeries.map((s, i) => (
                    <th key={i} style={yearCellStyle(s.isEstimate)}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Gross Margin */}
                <tr>
                  <td style={headerCellStyle}>Gross Margin</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <span style={{ fontStyle: 'italic', color: getMarginColor(s.grossMargin, { good: 0.4, ok: 0.2 }) }}>
                        {s.grossMargin != null ? `${(s.grossMargin * 100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* EBITDA Margin */}
                <tr>
                  <td style={headerCellStyle}>EBITDA Margin</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <span style={{ fontStyle: 'italic', color: getMarginColor(s.ebitdaMargin, { good: 0.25, ok: 0.15 }) }}>
                        {s.ebitdaMargin != null ? `${(s.ebitdaMargin * 100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* EBIT/Operating Margin */}
                <tr>
                  <td style={headerCellStyle}>Operating Margin</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <span style={{ fontStyle: 'italic', color: getMarginColor(s.ebitMargin) }}>
                        {s.ebitMargin != null ? `${(s.ebitMargin * 100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  ))}
                </tr>

                {/* Net Margin */}
                <tr>
                  <td style={headerCellStyle}>Net Margin</td>
                  {timeSeries.map((s, i) => (
                    <td key={i} style={{ ...cellStyle, background: s.isEstimate ? 'rgba(0,212,255,0.05)' : 'transparent' }}>
                      <span style={{ fontStyle: 'italic', color: getMarginColor(s.netMargin, { good: 0.15, ok: 0.05 }) }}>
                        {s.netMargin != null ? `${(s.netMargin * 100).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Returns metrics */}
          <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ textAlign: 'center', minWidth: '60px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Return on Equity. How efficiently profits are generated from shareholder equity">ROE</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getMarginColor(row.profitability?.roe, { good: 0.15, ok: 0.08 }) }}>{formatPct(row.profitability?.roe)}</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '60px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Return on Assets. Measures profitability relative to total assets">ROA</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getMarginColor(row.profitability?.roa, { good: 0.08, ok: 0.03 }) }}>{formatPct(row.profitability?.roa)}</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '60px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Return on Invested Capital. Shows efficiency of capital allocation">ROIC</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getMarginColor(row.profitability?.roic, { good: 0.12, ok: 0.06 }) }}>{formatPct(row.profitability?.roic)}</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '70px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>3Y Avg ROE</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic' }}>{formatPct(row.profitability?.avgROE)}</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '75px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>3Y Rev CAGR</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getGrowthColor(row.growth?.revenue) }}>{row.growth?.revenue != null ? formatPct(row.growth.revenue, true) : '—'}</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '75px' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>3Y EPS CAGR</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getGrowthColor(row.growth?.eps) }}>{row.growth?.eps != null ? formatPct(row.growth.eps, true) : '—'}</div>
            </div>
          </div>
        </div>
      )
    );

    const renderHealthContent = () => (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: '600', color: accent.text, marginBottom: '6px' }}>
          🏥 Financial Health & Liquidity
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {/* Scores */}
          <div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Risk Scores</div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Altman Z-Score measures bankruptcy risk. >2.99 = Safe, 1.81-2.99 = Grey zone, <1.81 = Distress risk">Altman Z-Score</div>
                <div style={{ marginTop: '2px' }}><ZScoreBadge score={row.health?.altmanZScore} /></div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                  {row.health?.altmanZScore > 2.99 ? 'Safe Zone' : row.health?.altmanZScore > 1.81 ? 'Grey Zone' : 'Distress Zone'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="F-Score (0-9) rates financial strength. 7-9 = Strong, 4-6 = Average, 0-3 = Weak">Piotroski F-Score</div>
                <div style={{ marginTop: '2px' }}><PiotroskiBadge score={row.health?.piotroskiScore} /></div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                  {row.health?.piotroskiScore >= 7 ? 'Strong' : row.health?.piotroskiScore >= 4 ? 'Moderate' : 'Weak'}
                </div>
              </div>
            </div>
          </div>

          {/* Liquidity Ratios */}
          <div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Liquidity & Solvency</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Current Ratio = Current Assets / Current Liabilities. >1.5 is healthy">Current Ratio</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: row.health?.currentRatio > 1.5 ? COLORS.green : row.health?.currentRatio > 1 ? COLORS.gold : COLORS.red }}>{formatRatio(row.health?.currentRatio)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Quick Ratio excludes inventory. >1 means good liquidity">Quick Ratio</div>
                <div style={{ fontSize: '11px', fontWeight: '600' }}>{formatRatio(row.health?.quickRatio)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Debt-to-Equity ratio. Lower is safer; >2 may signal high leverage">D/E Ratio</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: row.health?.debtToEquity > 2 ? COLORS.red : row.health?.debtToEquity > 1 ? COLORS.orange : COLORS.green }}>{formatRatio(row.health?.debtToEquity)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional health metrics */}
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Interest Coverage = EBIT / Interest. >5 is comfortable, <2 is risky">Int Coverage</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: row.health?.interestCoverage > 5 ? COLORS.green : row.health?.interestCoverage > 2 ? COLORS.gold : COLORS.red }}>{formatRatio(row.health?.interestCoverage)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Payout Ratio</div>
            <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: row.cashFlow?.payoutRatio > 0.8 ? COLORS.red : undefined }}>{formatPct(row.cashFlow?.payoutRatio)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }} title="Free Cash Flow per Share available to shareholders">FCF/Share</div>
            <div style={{ fontSize: '11px', fontWeight: '600' }}>{row.cashFlow?.freeCashFlowPerShare != null ? `$${row.cashFlow.freeCashFlowPerShare.toFixed(2)}` : '—'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>OpCF/Share</div>
            <div style={{ fontSize: '11px', fontWeight: '600' }}>{row.cashFlow?.operatingCashFlowPerShare != null ? `$${row.cashFlow.operatingCashFlowPerShare.toFixed(2)}` : '—'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Asset Turn</div>
            <div style={{ fontSize: '11px', fontWeight: '600' }}>{formatRatio(row.efficiency?.assetTurnover)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Inv Turn</div>
            <div style={{ fontSize: '11px', fontWeight: '600' }}>{formatRatio(row.efficiency?.inventoryTurnover)}</div>
          </div>
        </div>
      </div>
    );

    return (
      <tr key={`${row.ticker}-exp`}>
        <td colSpan={colSpan} style={{
          padding: '0',
          // Force td to respect parent table width and enable inner scroll
          maxWidth: '0',
          overflow: 'hidden',
        }}>
          {/* Visual container with colored background tint and separation */}
          <div style={{
            borderLeft: `3px solid ${accent.border}`,
            borderRadius: '6px',
            padding: '0',
            background: `linear-gradient(180deg, ${accent.bg} 0%, ${accent.bg.replace('0.15', '0.08')} 80px, rgba(25,30,40,0.98) 100%)`,
            margin: '8px 4px 12px 4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            overflow: 'hidden',
          }}>
            {/* Clean ticker header with subtle accent */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 16px',
              background: accent.bg,
              borderBottom: `1px solid ${accent.border}30`,
            }}>
              <span style={{
                fontSize: '14px',
                fontWeight: '700',
                color: accent.text,
                letterSpacing: '0.5px',
              }}>{row.ticker}</span>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{row.companyName}</span>
              {row.ratings?.consensus && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: row.ratings.consensus === 'Strong Buy' || row.ratings.consensus === 'Buy'
                    ? 'rgba(46,204,113,0.3)'
                    : row.ratings.consensus === 'Hold'
                    ? 'rgba(243,156,18,0.3)'
                    : 'rgba(231,76,60,0.3)',
                  color: row.ratings.consensus === 'Strong Buy' || row.ratings.consensus === 'Buy'
                    ? '#2ecc71'
                    : row.ratings.consensus === 'Hold'
                    ? '#f1c40f'
                    : COLORS.red,
                }}>
                  {row.ratings.consensus}
                </span>
              )}
            </div>
            {/* Content body with padding */}
            <div style={{ padding: '14px 16px' }}>
              {/* View-specific content (tables with horizontal scroll) */}
              {viewTab === 'estimates' && renderEstimatesContent()}
              {viewTab === 'valuation' && renderValuationContent()}
              {viewTab === 'profitability' && renderProfitabilityContent()}
              {viewTab === 'health' && renderHealthContent()}

              {/* Common Info Row - responsive flex layout with key data (always show) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', fontSize: '10px', borderTop: `1px solid ${accent.border}30`, paddingTop: '14px', marginTop: '12px', width: '100%', justifyContent: 'space-between' }}>
            {/* Price Targets */}
            <div style={{ minWidth: '120px', flex: '1' }}>
              <div style={{ fontWeight: '600', color: accent.text, marginBottom: '6px', fontSize: '11px' }}>Price Targets</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>Low: <span style={{ color: 'rgba(255,255,255,0.9)' }}>${row.priceTargets?.low?.toFixed(2) || '—'}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>Consensus: <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>${row.priceTargets?.consensus?.toFixed(2) || '—'}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>High: <span style={{ color: 'rgba(255,255,255,0.9)' }}>${row.priceTargets?.high?.toFixed(2) || '—'}</span></div>
            </div>
            {/* Ratings Breakdown */}
            <div style={{ minWidth: '120px', flex: '1' }}>
              <div style={{ fontWeight: '600', color: accent.text, marginBottom: '6px', fontSize: '11px' }}>Ratings <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '400' }}>({row.ratings?.totalAnalysts || 0})</span></div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {row.ratings?.strongBuy > 0 && <span style={{ color: COLORS.green, fontWeight: '600' }}>SB:{row.ratings.strongBuy}</span>}
                {row.ratings?.buy > 0 && <span style={{ color: '#7dcea0', fontWeight: '600' }}>B:{row.ratings.buy}</span>}
                {row.ratings?.hold > 0 && <span style={{ color: COLORS.gold, fontWeight: '600' }}>H:{row.ratings.hold}</span>}
                {row.ratings?.sell > 0 && <span style={{ color: COLORS.orange, fontWeight: '600' }}>S:{row.ratings.sell}</span>}
                {row.ratings?.strongSell > 0 && <span style={{ color: COLORS.red, fontWeight: '600' }}>SS:{row.ratings.strongSell}</span>}
                {!row.ratings?.totalAnalysts && <span style={{ color: 'rgba(255,255,255,0.35)' }}>—</span>}
              </div>
            </div>
            {/* Capital Structure */}
            <div style={{ minWidth: '120px', flex: '1' }}>
              <div style={{ fontWeight: '600', color: accent.text, marginBottom: '6px', fontSize: '11px' }}>Capital Structure</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>Mkt Cap: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{formatNumber(row.marketCap)}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>EV: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{formatNumber(row.enterpriseValue)}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Net Debt: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{row.balanceSheet?.netDebt != null ? formatNumber(row.balanceSheet.netDebt) : '—'}</span></div>
            </div>
            {/* Cash Flow */}
            <div style={{ minWidth: '130px', flex: '1' }}>
              <div style={{ fontWeight: '600', color: accent.text, marginBottom: '6px', fontSize: '11px' }}>Cash Flow <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '400' }}>(TTM)</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>FCF: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{row.cashFlow?.freeCashFlow != null ? formatNumber(row.cashFlow.freeCashFlow) : '—'}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>FCF Conv: <span style={{ color: row.cashFlow?.fcfConversion > 1 ? COLORS.green : row.cashFlow?.fcfConversion > 0.7 ? COLORS.gold : row.cashFlow?.fcfConversion != null ? COLORS.red : 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontWeight: '600' }}>{row.cashFlow?.fcfConversion != null ? `${(row.cashFlow.fcfConversion * 100).toFixed(1)}%` : '—'}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>FY End: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{row.fy1?.date ? row.fy1.date.slice(5) : '—'}</span></div>
            </div>
            {/* Earnings */}
            <div style={{ minWidth: '120px', flex: '1' }}>
              <div style={{ fontWeight: '600', color: accent.text, marginBottom: '6px', fontSize: '11px' }}>Earnings</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>Next: <span style={{ color: 'rgba(255,255,255,0.9)' }}>{row.earnings?.nextDate || '—'}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                Surprise: <span style={{ color: row.earnings?.avgSurprise != null ? (row.earnings.avgSurprise > 0 ? COLORS.green : COLORS.red) : 'rgba(255,255,255,0.35)', fontStyle: 'italic', fontWeight: '600' }}>
                  {row.earnings?.avgSurprise != null ? `${row.earnings.avgSurprise > 0 ? '+' : ''}${(row.earnings.avgSurprise * 100).toFixed(1)}%` : '—'}
                </span>
                {row.earnings?.beatCount != null && <span style={{ fontSize: '9px', marginLeft: '4px', color: 'rgba(255,255,255,0.5)' }}>({row.earnings.beatCount}B/{row.earnings.missCount}M)</span>}
              </div>
            </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div style={{ padding: '16px', fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>📋 Consensus Estimates</h2>
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {tickers.length} positions • {tickersWithData.length} with coverage • {tickersWithoutData.length} ETFs/no data
            {lastUpdated && ` • ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Collapse All button - show when any rows are expanded */}
          {expandedRows.size > 0 && (
            <button onClick={() => setExpandedRows(new Set())}
              style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
              ▲ Collapse All
            </button>
          )}
          {/* Show Retry button if there are failed tickers */}
          {Object.values(consensusData).some(d => d?.failed) && !isLoading && (
            <button onClick={handleRetryFailed}
              style={{ padding: '8px 12px', background: 'rgba(231,76,60,0.2)', border: '1px solid rgba(231,76,60,0.4)', borderRadius: '6px', color: COLORS.red, fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>
              🔁 Retry Failed
            </button>
          )}
          <button onClick={handleFetchData} disabled={isLoading}
            style={{ padding: '8px 16px', background: isLoading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)', border: 'none', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: '600', cursor: isLoading ? 'wait' : 'pointer' }}>
            {isLoading ? `⏳ ${loadingProgress.current}/${loadingProgress.total} ${loadingProgress.ticker}` : '🔄 Refresh All'}
          </button>
        </div>
      </div>

      {error && <div style={{ marginBottom: '12px', padding: '10px', background: 'rgba(231,76,60,0.1)', borderRadius: '6px', color: COLORS.red, fontSize: '11px' }}>⚠️ {error}</div>}


      {/* View Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {VIEW_TABS.map(tab => (
          <button key={tab.id} onClick={() => setViewTab(tab.id)}
            style={{ padding: '6px 12px', background: viewTab === tab.id ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)', border: viewTab === tab.id ? '1px solid rgba(0,212,255,0.3)' : '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', color: viewTab === tab.id ? COLORS.cyan : 'rgba(255,255,255,0.6)', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Portfolio Summary Stats Bar */}
      {stats && stats.count > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '14px',
          padding: '12px 16px',
          background: 'rgba(0,212,255,0.04)',
          borderRadius: '8px',
          border: '1px solid rgba(0,212,255,0.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Buy Rating</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: stats.buyPct > 0.6 ? COLORS.green : stats.buyPct > 0.4 ? COLORS.gold : COLORS.red }}>
              {stats.buyPct != null ? `${(stats.buyPct * 100).toFixed(0)}%` : '—'}
            </span>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Avg Upside</span>
            <span style={{ fontSize: '13px', fontWeight: '700', fontStyle: 'italic', color: getUpsideColor(stats.avgUpside) }}>
              {stats.avgUpside != null ? `${stats.avgUpside > 0 ? '+' : ''}${(stats.avgUpside * 100).toFixed(1)}%` : '—'}
            </span>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Avg Z-Score</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: getZScoreColor(stats.avgZScore) }}>
              {stats.avgZScore != null ? stats.avgZScore.toFixed(1) : '—'}
            </span>
          </div>
          <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Avg Piotroski</span>
            <span style={{ fontSize: '13px', fontWeight: '700', color: getPiotroskiColor(stats.avgPiotroski) }}>
              {stats.avgPiotroski != null ? stats.avgPiotroski.toFixed(1) : '—'}
            </span>
          </div>
        </div>
      )}

      {/* Data Table */}
      {sortedData.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: 'rgba(0,0,0,0.2)' }}>{renderTableHead()}</tr></thead>
              <tbody>
                {sortedData.map((row, idx) => (
                  <React.Fragment key={row.ticker}>
                    <tr style={{
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      cursor: 'pointer',
                      background: expandedRows.has(row.ticker) ? 'rgba(0,212,255,0.06)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                      transition: 'background 0.15s ease',
                    }}
                      onMouseEnter={(e) => { if (!expandedRows.has(row.ticker)) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={(e) => { if (!expandedRows.has(row.ticker)) e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'; }}
                      onClick={() => toggleRow(row.ticker)}>
                      {renderTableRow(row)}
                    </tr>
                    {renderExpandedRow(row, idx)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading state with progress */}
      {isLoading && sortedData.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              margin: '0 auto',
              border: '3px solid rgba(0,212,255,0.2)',
              borderTopColor: COLORS.cyan,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '14px' }}>Loading Consensus Data</h3>
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              width: '200px',
              height: '4px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '2px',
              margin: '0 auto',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${loadingProgress.total > 0 ? (loadingProgress.current / loadingProgress.total) * 100 : 0}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${COLORS.cyan}, #7b2ff7)`,
                borderRadius: '2px',
                transition: 'width 0.3s ease',
              }} />
            </div>
          </div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>
            {loadingProgress.current}/{loadingProgress.total} stocks
            {loadingProgress.ticker && <span style={{ color: COLORS.cyan }}> - {loadingProgress.ticker}</span>}
          </p>
        </div>
      )}

      {/* Empty state */}
      {sortedData.length === 0 && !isLoading && !Object.keys(consensusData).length && (
        <div style={{ textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <h3 style={{ margin: '0 0 6px', color: '#fff', fontSize: '14px' }}>Ready to Load Estimates</h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
            Click "Refresh All" to fetch analyst data for {tickers.length} positions<br/>
            <span style={{ fontSize: '10px' }}>~{Math.ceil(tickers.length * 2.5)}s (11 API calls/stock)</span>
          </p>
        </div>
      )}
    </div>
  );
});

ConsensusTab.displayName = 'ConsensusTab';
export default ConsensusTab;
