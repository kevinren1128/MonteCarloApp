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

const ZScoreBadge = memo(({ score }) => {
  if (score === null || score === undefined) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
  const color = getZScoreColor(score);
  const label = score > 2.99 ? 'Safe' : score > 1.81 ? 'Grey' : 'Risk';
  return <Badge color={color} small>{score.toFixed(1)} {label}</Badge>;
});

const PiotroskiBadge = memo(({ score }) => {
  if (score === null || score === undefined) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;
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
  { id: 'estimates', label: 'Estimates', icon: '📊' },
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

    // Load persisted consensus data from localStorage
    const { data, timestamp } = loadConsensusData();
    if (data && Object.keys(data).length > 0) {
      setConsensusData(data);
      setLastUpdated(timestamp);
      console.log('[Consensus] Loaded persisted data for', Object.keys(data).length, 'tickers');
    }
  }, []);

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

  // Fetch data (refresh all)
  const handleFetchData = useCallback(async () => {
    if (!apiKey || !tickers.length) return;
    setIsLoading(true);
    setError(null);
    setLoadingProgress({ current: 0, total: tickers.length, ticker: '' });
    try {
      const data = await batchFetchConsensusData(tickers, apiKey, (current, total, ticker) =>
        setLoadingProgress({ current, total, ticker })
      );

      // Validate data before saving
      validateData(data);

      setConsensusData(data);
      setLastUpdated(new Date());

      // Persist to localStorage
      saveConsensusData(data);
    } catch (err) { setError(err.message); }
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
          ebitda: h.ebitda,
          ebitdaMargin: calcMargin(h.ebitda, h.revenue),
          operatingIncome: h.operatingIncome,
          ebitMargin: h.operatingMargin ?? calcMargin(h.operatingIncome, h.revenue),
          netIncome: h.netIncome,
          netMargin: h.netMargin ?? calcMargin(h.netIncome, h.revenue),
          eps: h.eps,
          grossMargin: h.grossMargin,
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
          ebitda: ebitda,
          ebitdaMargin: calcMargin(ebitda, revenue),
          operatingIncome: ebit,
          ebitMargin: calcMargin(ebit, revenue),
          netIncome: netIncome,
          netMargin: calcMargin(netIncome, revenue),
          eps: f.eps,
          grossMargin: f.grossMargin,
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

    // Keep last 7 periods max (e.g., FY21, FY22, FY23, FY24, FY25E, FY26E, FY27E)
    return series.slice(-7);
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
        <th key="pe" onClick={() => handleSort('pe')} style={{ ...thStyle, textAlign: 'right' }} title={`Forward P/E = Price / ${fyLabels.fy1} EPS`}>{fyLabels.fy1} P/E<SortIcon col="pe" /></th>,
        <th key="evE" onClick={() => handleSort('evEbitda')} style={{ ...thStyle, textAlign: 'right' }} title={`EV/EBITDA = Enterprise Value / ${fyLabels.fy1} EBITDA`}>{fyLabels.fy1} EV/EBITDA<SortIcon col="evEbitda" /></th>,
        <th key="ps" style={{ ...thStyle, textAlign: 'right' }} title={`P/S = Market Cap / ${fyLabels.fy1} Revenue`}>{fyLabels.fy1} P/S</th>,
        <th key="pfcf" style={{ ...thStyle, textAlign: 'right' }} title="P/FCF = Price / TTM Free Cash Flow per Share">TTM P/FCF</th>,
        <th key="fcfY" style={{ ...thStyle, textAlign: 'right' }} title="TTM FCF Yield = FCF per Share / Price">TTM FCF%</th>,
      ];
    }

    if (viewTab === 'profitability') {
      return [...common,
        <th key="gm" style={{ ...thStyle, textAlign: 'right' }} title="TTM Gross Profit Margin">TTM Gross%</th>,
        <th key="om" style={{ ...thStyle, textAlign: 'right' }} title="TTM Operating (EBIT) Margin">TTM EBIT%</th>,
        <th key="nm" style={{ ...thStyle, textAlign: 'right' }} title="TTM Net Profit Margin">TTM Net%</th>,
        <th key="roe" onClick={() => handleSort('roe')} style={{ ...thStyle, textAlign: 'right' }} title="TTM Return on Equity">TTM ROE<SortIcon col="roe" /></th>,
        <th key="roa" style={{ ...thStyle, textAlign: 'right' }} title="TTM Return on Assets">TTM ROA</th>,
        <th key="roic" style={{ ...thStyle, textAlign: 'right' }} title="TTM Return on Invested Capital">TTM ROIC</th>,
        <th key="revHG" style={{ ...thStyle, textAlign: 'right' }} title="3-Year Average Annual Revenue Growth">3Y Rev CAGR</th>,
        <th key="epsHG" style={{ ...thStyle, textAlign: 'right' }} title="3-Year Average Annual EPS Growth">3Y EPS CAGR</th>,
      ];
    }

    if (viewTab === 'health') {
      return [...common,
        <th key="zScore" onClick={() => handleSort('zScore')} style={{ ...thStyle, textAlign: 'center' }} title="Altman Z-Score: >2.99 Safe, 1.81-2.99 Grey, <1.81 Distress">Z-Score<SortIcon col="zScore" /></th>,
        <th key="piotr" onClick={() => handleSort('piotroski')} style={{ ...thStyle, textAlign: 'center' }} title="Piotroski F-Score (0-9): ≥7 Strong, 4-6 Moderate, <4 Weak">Piotroski<SortIcon col="piotroski" /></th>,
        <th key="de" style={{ ...thStyle, textAlign: 'right' }} title="Debt to Equity Ratio">D/E</th>,
        <th key="curr" style={{ ...thStyle, textAlign: 'right' }} title="Current Ratio = Current Assets / Current Liabilities">Current</th>,
        <th key="quick" style={{ ...thStyle, textAlign: 'right' }} title="Quick Ratio = (Current Assets - Inventory) / Current Liabilities">Quick</th>,
        <th key="intCov" style={{ ...thStyle, textAlign: 'right' }} title="Interest Coverage = EBIT / Interest Expense">Int Cov</th>,
        <th key="payout" style={{ ...thStyle, textAlign: 'right' }} title="Dividend Payout Ratio">Payout%</th>,
        <th key="fcfps" style={{ ...thStyle, textAlign: 'right' }} title="TTM Free Cash Flow per Share">FCF/Sh</th>,
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
        <Cell key="evE" value={formatMult(row.multiples?.evToEbitda)} color={getMultColor(row.multiples?.evToEbitda, { cheap: 10, fair: 15 })} />,
        <Cell key="ps" value={formatMult(row.multiples?.priceToSales)} />,
        <Cell key="pfcf" value={formatMult(row.cashFlow?.priceToFCF)} />,
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

  const renderExpandedRow = (row) => {
    if (!expandedRows.has(row.ticker)) return null;
    const colSpan = 12;
    const timeSeries = buildTimeSeries(row);

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
          <div style={{ fontSize: '12px', fontWeight: '700', color: COLORS.cyan, marginBottom: '10px' }}>
            📈 Financial Time Series (Historical → Forward Estimates)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
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
                      <div>{s.capitalExpenditure ? formatNumber(Math.abs(s.capitalExpenditure)) : (s.isEstimate ? <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '8px' }}>N/A</span> : '—')}</div>
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
                      <div>{s.freeCashFlow ? formatNumber(s.freeCashFlow) : (s.isEstimate ? <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '8px' }}>N/A</span> : '—')}</div>
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
          <div style={{ fontSize: '13px', fontWeight: '700', color: COLORS.cyan, marginBottom: '12px' }}>
            💰 Valuation Multiples (Forward Estimates)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
            {/* Forward P/E by FY */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: '600' }}>Forward P/E</div>
              {timeSeries.filter(s => s.isEstimate && s.eps).slice(0, 3).map((s, i) => {
                const pe = s.eps ? price / s.eps : null;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{s.label}:</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: getMultColor(pe) }}>
                      {formatMult(pe)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* EV/EBITDA by FY */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: '600' }}>EV/EBITDA</div>
              {timeSeries.filter(s => s.isEstimate && s.ebitda).slice(0, 3).map((s, i) => {
                const evEbitda = s.ebitda ? ev / s.ebitda : null;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{s.label}:</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: getMultColor(evEbitda, { cheap: 10, fair: 15 }) }}>
                      {formatMult(evEbitda)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* EV/EBIT by FY */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: '600' }}>EV/EBIT</div>
              {timeSeries.filter(s => s.isEstimate && s.operatingIncome).slice(0, 3).map((s, i) => {
                const evEbit = s.operatingIncome ? ev / s.operatingIncome : null;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{s.label}:</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: getMultColor(evEbit, { cheap: 12, fair: 20 }) }}>
                      {formatMult(evEbit)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* P/S by FY */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '8px', fontWeight: '600' }}>Price/Sales</div>
              {timeSeries.filter(s => s.isEstimate && s.revenue).slice(0, 3).map((s, i) => {
                const ps = s.revenue ? marketCap / s.revenue : null;
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{s.label}:</span>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>
                      {formatMult(ps)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional valuation metrics */}
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>NTM P/E</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: getMultColor(row.multiples?.forwardPE) }}>{formatMult(row.multiples?.forwardPE)}</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>P/B</div>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatMult(row.cashFlow?.priceToBook || row.historical?.pbRatio)}</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>P/FCF</div>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatMult(row.cashFlow?.priceToFCF)}</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>Div Yield</div>
              <div style={{ fontSize: '13px', fontWeight: '700', fontStyle: 'italic', color: row.cashFlow?.dividendYield > 0.02 ? COLORS.green : undefined }}>{formatPct(row.cashFlow?.dividendYield)}</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>FCF Yield</div>
              <div style={{ fontSize: '13px', fontWeight: '700', fontStyle: 'italic', color: row.profitability?.freeCashFlowYield > 0.05 ? COLORS.green : undefined }}>{formatPct(row.profitability?.freeCashFlowYield)}</div>
            </div>
            <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', padding: '10px' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>EV/Sales</div>
              <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatMult(row.historical?.evToEbitda)}</div>
            </div>
          </div>
        </div>
      );
    };

    const renderProfitabilityContent = () => (
      timeSeries.length > 0 && (
        <div style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '14px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: COLORS.cyan, marginBottom: '12px' }}>
            📈 Profitability & Margins (Historical → Forward)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
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
          <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>ROE</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getMarginColor(row.profitability?.roe, { good: 0.15, ok: 0.08 }) }}>{formatPct(row.profitability?.roe)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>ROA</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getMarginColor(row.profitability?.roa, { good: 0.08, ok: 0.03 }) }}>{formatPct(row.profitability?.roa)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>ROIC</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getMarginColor(row.profitability?.roic, { good: 0.12, ok: 0.06 }) }}>{formatPct(row.profitability?.roic)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>3Y Avg ROE</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic' }}>{formatPct(row.profitability?.avgROE)}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>3Y Rev CAGR</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getGrowthColor(row.growth?.revenue) }}>{row.growth?.revenue != null ? formatPct(row.growth.revenue, true) : '—'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>3Y EPS CAGR</div>
              <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: getGrowthColor(row.growth?.eps) }}>{row.growth?.eps != null ? formatPct(row.growth.eps, true) : '—'}</div>
            </div>
          </div>
        </div>
      )
    );

    const renderHealthContent = () => (
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>
          🏥 Financial Health & Liquidity
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {/* Scores */}
          <div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>Risk Scores</div>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
              <div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Altman Z-Score</div>
                <div style={{ marginTop: '2px' }}><ZScoreBadge score={row.health?.altmanZScore} /></div>
                <div style={{ fontSize: '7px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                  {row.health?.altmanZScore > 2.99 ? 'Safe Zone' : row.health?.altmanZScore > 1.81 ? 'Grey Zone' : 'Distress Zone'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Piotroski F-Score</div>
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
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Current Ratio</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: row.health?.currentRatio > 1.5 ? COLORS.green : row.health?.currentRatio > 1 ? COLORS.gold : COLORS.red }}>{formatRatio(row.health?.currentRatio)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Quick Ratio</div>
                <div style={{ fontSize: '11px', fontWeight: '600' }}>{formatRatio(row.health?.quickRatio)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>D/E Ratio</div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: row.health?.debtToEquity > 2 ? COLORS.red : row.health?.debtToEquity > 1 ? COLORS.orange : COLORS.green }}>{formatRatio(row.health?.debtToEquity)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional health metrics */}
        <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Int Coverage</div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: row.health?.interestCoverage > 5 ? COLORS.green : row.health?.interestCoverage > 2 ? COLORS.gold : COLORS.red }}>{formatRatio(row.health?.interestCoverage)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>Payout Ratio</div>
            <div style={{ fontSize: '11px', fontWeight: '600', fontStyle: 'italic', color: row.cashFlow?.payoutRatio > 0.8 ? COLORS.red : undefined }}>{formatPct(row.cashFlow?.payoutRatio)}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>FCF/Share</div>
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
        <td colSpan={colSpan} style={{ padding: '12px 14px', background: 'rgba(0,212,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {/* View-specific content */}
          {viewTab === 'estimates' && renderEstimatesContent()}
          {viewTab === 'valuation' && renderValuationContent()}
          {viewTab === 'profitability' && renderProfitabilityContent()}
          {viewTab === 'health' && renderHealthContent()}

          {/* Common Info Row - 5 columns with key data (always show) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', fontSize: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
            {/* Price Targets */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>Price Targets</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Low: ${row.priceTargets?.low?.toFixed(2) || '—'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Consensus: ${row.priceTargets?.consensus?.toFixed(2) || '—'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>High: ${row.priceTargets?.high?.toFixed(2) || '—'}</div>
            </div>
            {/* Ratings Breakdown */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>Ratings ({row.ratings?.totalAnalysts || 0})</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {row.ratings?.strongBuy > 0 && <span style={{ color: COLORS.green }}>SB:{row.ratings.strongBuy}</span>}
                {row.ratings?.buy > 0 && <span style={{ color: '#7dcea0' }}>B:{row.ratings.buy}</span>}
                {row.ratings?.hold > 0 && <span style={{ color: COLORS.gold }}>H:{row.ratings.hold}</span>}
                {row.ratings?.sell > 0 && <span style={{ color: COLORS.orange }}>S:{row.ratings.sell}</span>}
                {row.ratings?.strongSell > 0 && <span style={{ color: COLORS.red }}>SS:{row.ratings.strongSell}</span>}
              </div>
            </div>
            {/* Capital Structure */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>Capital Structure</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Mkt Cap: {formatNumber(row.marketCap)}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>EV: {formatNumber(row.enterpriseValue)}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Net Debt: {row.balanceSheet?.netDebt != null ? formatNumber(row.balanceSheet.netDebt) : '—'}</div>
            </div>
            {/* Cash Flow */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>Cash Flow (TTM)</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>FCF: {row.cashFlow?.freeCashFlow != null ? formatNumber(row.cashFlow.freeCashFlow) : '—'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>FCF Conv: <span style={{ color: row.cashFlow?.fcfConversion > 1 ? COLORS.green : row.cashFlow?.fcfConversion > 0.7 ? COLORS.gold : COLORS.red, fontStyle: 'italic' }}>{row.cashFlow?.fcfConversion != null ? `${(row.cashFlow.fcfConversion * 100).toFixed(1)}%` : '—'}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>FY End: {row.fy1?.date ? row.fy1.date.slice(5) : '—'}</div>
            </div>
            {/* Earnings */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>Earnings</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Next: {row.earnings?.nextDate || '—'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                Surprise: <span style={{ color: row.earnings?.avgSurprise > 0 ? COLORS.green : COLORS.red, fontStyle: 'italic' }}>
                  {row.earnings?.avgSurprise != null ? `${(row.earnings.avgSurprise * 100).toFixed(1)}%` : '—'}
                </span>
                {row.earnings?.beatCount != null && <span style={{ fontSize: '8px', marginLeft: '4px' }}>({row.earnings.beatCount}B/{row.earnings.missCount}M)</span>}
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
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#fff' }}>📊 Consensus Estimates</h2>
          <p style={{ margin: '3px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
            {tickers.length} positions • {tickersWithData.length} with coverage • {tickersWithoutData.length} ETFs/no data
            {lastUpdated && ` • ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
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
                    {renderExpandedRow(row)}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sortedData.length === 0 && !isLoading && !Object.keys(consensusData).length && (
        <div style={{ textAlign: 'center', padding: '50px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <h3 style={{ margin: '0 0 6px', color: '#fff', fontSize: '14px' }}>Ready to Load Estimates</h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>
            Click "Load Data" to fetch analyst data for {tickers.length} positions<br/>
            <span style={{ fontSize: '10px' }}>~{Math.ceil(tickers.length * 2.5)}s (11 API calls/stock)</span>
          </p>
        </div>
      )}
    </div>
  );
});

ConsensusTab.displayName = 'ConsensusTab';
export default ConsensusTab;
