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

// Storage key for persisting consensus data
const CONSENSUS_STORAGE_KEY = 'monte-carlo-consensus-data';
const CONSENSUS_TIMESTAMP_KEY = 'monte-carlo-consensus-timestamp';

// Save consensus data to localStorage
const saveConsensusData = (data) => {
  try {
    localStorage.setItem(CONSENSUS_STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(CONSENSUS_TIMESTAMP_KEY, Date.now().toString());
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

const formatPct = (num, showSign = false) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  const pct = (num * 100).toFixed(1);
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

const Cell = memo(({ value, color, sub, align = 'right' }) => (
  <td style={{ padding: '6px 5px', fontSize: '10px', textAlign: align, verticalAlign: 'middle' }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      <span style={{ color: color || 'rgba(255,255,255,0.85)', fontWeight: color ? '600' : '400' }}>{value}</span>
      {sub && <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{sub}</span>}
    </div>
  </td>
));

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

    // Load persisted consensus data
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
      setConsensusData(data);
      setLastUpdated(new Date());
      // Persist to localStorage
      saveConsensusData(data);
    } catch (err) { setError(err.message); }
    setIsLoading(false);
  }, [apiKey, tickers]);

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
      setConsensusData(updatedData);
      setLastUpdated(new Date());
      saveConsensusData(updatedData);
    } catch (err) { setError(err.message); }
    setIsLoading(false);
  }, [apiKey, tickers, consensusData]);

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
          case 'revGrowth': aVal = calcGrowth(a.fy1?.revenue, a.fy2?.revenue) ?? -999; bVal = calcGrowth(b.fy1?.revenue, b.fy2?.revenue) ?? -999; break;
          case 'eps': aVal = a.fy1?.eps || 0; bVal = b.fy1?.eps || 0; break;
          case 'epsGrowth': aVal = calcGrowth(a.fy1?.eps, a.fy2?.eps) ?? -999; bVal = calcGrowth(b.fy1?.eps, b.fy2?.eps) ?? -999; break;
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

  // Styles
  const thStyle = {
    padding: '6px 5px', textAlign: 'left', fontSize: '9px', fontWeight: '600',
    color: 'rgba(255,255,255,0.5)', borderBottom: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none',
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
        <th key="rev" onClick={() => handleSort('revenue')} style={{ ...thStyle, textAlign: 'right' }}>Revenue<SortIcon col="revenue" /></th>,
        <th key="revG" onClick={() => handleSort('revGrowth')} style={{ ...thStyle, textAlign: 'right' }}>Rev Gr<SortIcon col="revGrowth" /></th>,
        <th key="eps" onClick={() => handleSort('eps')} style={{ ...thStyle, textAlign: 'right' }}>EPS<SortIcon col="eps" /></th>,
        <th key="epsG" onClick={() => handleSort('epsGrowth')} style={{ ...thStyle, textAlign: 'right' }}>EPS Gr<SortIcon col="epsGrowth" /></th>,
        <th key="ebit" style={{ ...thStyle, textAlign: 'right' }}>EBIT%</th>,
        <th key="net" style={{ ...thStyle, textAlign: 'right' }}>Net%</th>,
        <th key="earn" style={{ ...thStyle, textAlign: 'center' }}>Earnings</th>,
        <th key="surp" style={{ ...thStyle, textAlign: 'center' }}>Surprise</th>,
      ];
    }

    if (viewTab === 'valuation') {
      return [...common,
        <th key="pe" onClick={() => handleSort('pe')} style={{ ...thStyle, textAlign: 'right' }}>Fwd P/E<SortIcon col="pe" /></th>,
        <th key="evE" onClick={() => handleSort('evEbitda')} style={{ ...thStyle, textAlign: 'right' }}>EV/EBITDA<SortIcon col="evEbitda" /></th>,
        <th key="evEbit" style={{ ...thStyle, textAlign: 'right' }}>EV/EBIT</th>,
        <th key="ps" style={{ ...thStyle, textAlign: 'right' }}>P/S</th>,
        <th key="pfcf" style={{ ...thStyle, textAlign: 'right' }}>P/FCF</th>,
        <th key="pb" style={{ ...thStyle, textAlign: 'right' }}>P/B</th>,
        <th key="divY" style={{ ...thStyle, textAlign: 'right' }}>Div Yld</th>,
        <th key="fcfY" style={{ ...thStyle, textAlign: 'right' }}>FCF Yld</th>,
      ];
    }

    if (viewTab === 'profitability') {
      return [...common,
        <th key="gm" style={{ ...thStyle, textAlign: 'right' }}>Gross%</th>,
        <th key="om" style={{ ...thStyle, textAlign: 'right' }}>EBIT%</th>,
        <th key="nm" style={{ ...thStyle, textAlign: 'right' }}>Net%</th>,
        <th key="roe" onClick={() => handleSort('roe')} style={{ ...thStyle, textAlign: 'right' }}>ROE<SortIcon col="roe" /></th>,
        <th key="roa" style={{ ...thStyle, textAlign: 'right' }}>ROA</th>,
        <th key="roic" style={{ ...thStyle, textAlign: 'right' }}>ROIC</th>,
        <th key="revHG" style={{ ...thStyle, textAlign: 'right' }}>Rev 3Y</th>,
        <th key="epsHG" style={{ ...thStyle, textAlign: 'right' }}>EPS 3Y</th>,
      ];
    }

    if (viewTab === 'health') {
      return [...common,
        <th key="zScore" onClick={() => handleSort('zScore')} style={{ ...thStyle, textAlign: 'center' }}>Z-Score<SortIcon col="zScore" /></th>,
        <th key="piotr" onClick={() => handleSort('piotroski')} style={{ ...thStyle, textAlign: 'center' }}>Piotroski<SortIcon col="piotroski" /></th>,
        <th key="de" style={{ ...thStyle, textAlign: 'right' }}>D/E</th>,
        <th key="curr" style={{ ...thStyle, textAlign: 'right' }}>Current</th>,
        <th key="quick" style={{ ...thStyle, textAlign: 'right' }}>Quick</th>,
        <th key="intCov" style={{ ...thStyle, textAlign: 'right' }}>Int Cov</th>,
        <th key="payout" style={{ ...thStyle, textAlign: 'right' }}>Payout%</th>,
        <th key="fcfps" style={{ ...thStyle, textAlign: 'right' }}>FCF/Sh</th>,
      ];
    }

    return common;
  };

  const renderTableRow = (row) => {
    const revGrowth = calcGrowth(row.fy1?.revenue, row.fy2?.revenue);
    const epsGrowth = calcGrowth(row.fy1?.eps, row.fy2?.eps);
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
          <span style={{ color: getUpsideColor(upside), fontWeight: '600' }}>
            {upside > 0 ? '+' : ''}{(upside * 100).toFixed(0)}%
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
        <Cell key="rev" value={formatNumber(row.fy1?.revenue)} sub={getFyLabel(row.fy1?.fiscalYear)} />,
        <Cell key="revG" value={revGrowth != null ? `${revGrowth > 0 ? '+' : ''}${(revGrowth * 100).toFixed(0)}%` : '—'} color={getGrowthColor(revGrowth)} />,
        <Cell key="eps" value={row.fy1?.eps != null ? `$${row.fy1.eps.toFixed(2)}` : '—'} sub={getFyLabel(row.fy1?.fiscalYear)} />,
        <Cell key="epsG" value={epsGrowth != null ? `${epsGrowth > 0 ? '+' : ''}${(epsGrowth * 100).toFixed(0)}%` : '—'} color={getGrowthColor(epsGrowth)} />,
        <Cell key="ebit" value={formatPct(row.fy1?.ebitMargin)} color={getMarginColor(row.fy1?.ebitMargin)} />,
        <Cell key="net" value={formatPct(row.fy1?.netMargin)} color={getMarginColor(row.fy1?.netMargin, { good: 0.15, ok: 0.05 })} />,
        <td key="earn" style={{ padding: '6px 5px', textAlign: 'center', fontSize: '10px' }}>
          {row.earnings?.nextDate ? (
            <Badge color={COLORS.cyan} small>{row.earnings.nextDate.slice(5)}</Badge>
          ) : '—'}
        </td>,
        <td key="surp" style={{ padding: '6px 5px', textAlign: 'center', fontSize: '10px' }}>
          {row.earnings?.avgSurprise != null ? (
            <span style={{ color: row.earnings.avgSurprise > 0 ? COLORS.green : COLORS.red, fontWeight: '600' }}>
              {row.earnings.avgSurprise > 0 ? '+' : ''}{(row.earnings.avgSurprise * 100).toFixed(0)}%
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', marginLeft: '2px' }}>({row.earnings.beatCount}B/{row.earnings.missCount}M)</span>
            </span>
          ) : '—'}
        </td>,
      ];
    }

    if (viewTab === 'valuation') {
      return [...common,
        <Cell key="pe" value={formatMult(row.multiples?.forwardPE)} color={getMultColor(row.multiples?.forwardPE)} />,
        <Cell key="evE" value={formatMult(row.multiples?.evToEbitda)} color={getMultColor(row.multiples?.evToEbitda, { cheap: 10, fair: 15 })} />,
        <Cell key="evEbit" value={formatMult(row.multiples?.evToEbit)} />,
        <Cell key="ps" value={formatMult(row.multiples?.priceToSales)} />,
        <Cell key="pfcf" value={formatMult(row.cashFlow?.priceToFCF)} />,
        <Cell key="pb" value={formatMult(row.cashFlow?.priceToBook || row.historical?.pbRatio)} />,
        <Cell key="divY" value={row.cashFlow?.dividendYield != null ? formatPct(row.cashFlow.dividendYield) : '—'} color={row.cashFlow?.dividendYield > 0.02 ? COLORS.green : undefined} />,
        <Cell key="fcfY" value={row.profitability?.freeCashFlowYield != null ? formatPct(row.profitability.freeCashFlowYield) : '—'} color={row.profitability?.freeCashFlowYield > 0.05 ? COLORS.green : undefined} />,
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
    const colSpan = viewTab === 'estimates' ? 12 : viewTab === 'valuation' ? 12 : viewTab === 'profitability' ? 12 : 12;

    return (
      <tr key={`${row.ticker}-exp`}>
        <td colSpan={colSpan} style={{ padding: '10px 14px', background: 'rgba(0,212,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', fontSize: '10px' }}>
            {/* FY2 Estimates */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>{getFyLabel(row.fy2?.fiscalYear)} Est</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Rev: {formatNumber(row.fy2?.revenue)}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>EPS: ${row.fy2?.eps?.toFixed(2) || '—'}</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>EBITDA: {formatNumber(row.fy2?.ebitda)}</div>
            </div>
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
            {/* Historical Growth */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>3Y Growth Avg</div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Revenue: <span style={{ color: getGrowthColor(row.growth?.revenue) }}>{formatPct(row.growth?.revenue, true)}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>EPS: <span style={{ color: getGrowthColor(row.growth?.eps) }}>{formatPct(row.growth?.eps, true)}</span></div>
              <div style={{ color: 'rgba(255,255,255,0.7)' }}>Net Inc: <span style={{ color: getGrowthColor(row.growth?.netIncome) }}>{formatPct(row.growth?.netIncome, true)}</span></div>
            </div>
            {/* Financial Health */}
            <div>
              <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '6px' }}>Health Scores</div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>Z:</span><ZScoreBadge score={row.health?.altmanZScore} />
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '3px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>P:</span><PiotroskiBadge score={row.health?.piotroskiScore} />
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

      {/* Summary Stats */}
      {stats && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>ANALYST SENTIMENT</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: stats.buyPct > 0.5 ? COLORS.green : COLORS.gold }}>{stats.buyPct != null ? `${(stats.buyPct * 100).toFixed(0)}% Buy` : '—'}</div>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>AVG UPSIDE</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: getUpsideColor(stats.avgUpside) }}>{stats.avgUpside != null ? `${stats.avgUpside > 0 ? '+' : ''}${(stats.avgUpside * 100).toFixed(0)}%` : '—'}</div>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>AVG Z-SCORE</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: getZScoreColor(stats.avgZScore) }}>{stats.avgZScore != null ? stats.avgZScore.toFixed(1) : '—'}</div>
          </div>
          <div style={{ padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginBottom: '3px' }}>AVG PIOTROSKI</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: getPiotroskiColor(stats.avgPiotroski) }}>{stats.avgPiotroski != null ? stats.avgPiotroski.toFixed(1) : '—'}</div>
          </div>
        </div>
      )}

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
                {sortedData.map(row => (
                  <React.Fragment key={row.ticker}>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer', background: expandedRows.has(row.ticker) ? 'rgba(0,212,255,0.03)' : 'transparent' }}
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
