/**
 * Consensus Tab - Enhanced Fundamental Analysis View
 *
 * @module components/tabs/ConsensusTab
 * @description Comprehensive analyst estimates, price targets, ratings, and growth metrics
 */

import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import {
  getApiKey,
  saveApiKey,
  batchFetchConsensusData,
  validateApiKey,
} from '../../services/fmpService';

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

// Reusable Card component
const Card = memo(({ children, gradient = false, style = {} }) => (
  <div
    style={{
      background: gradient
        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.03) 0%, rgba(123, 47, 247, 0.03) 100%)'
        : 'rgba(255, 255, 255, 0.02)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '16px',
      ...style,
    }}
  >
    {children}
  </div>
));

// Format large numbers compactly
const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
};

// Format percentage
const formatPercent = (num, showSign = false) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  const pct = (num * 100).toFixed(1);
  if (showSign && num > 0) return `+${pct}%`;
  return `${pct}%`;
};

// Check if consensus data has valid analyst estimates
const hasValidEstimates = (data) => {
  if (!data) return false;
  const fy1Rev = data.fy1?.revenue || 0;
  const fy1Eps = data.fy1?.eps || 0;
  return fy1Rev > 0 || fy1Eps !== 0;
};

// Format multiple
const formatMultiple = (num) => {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '—';
  if (num < 0) return '—';
  return `${num.toFixed(1)}x`;
};

// Calculate growth rate
const calcGrowth = (current, next) => {
  if (!current || !next || current === 0) return null;
  return (next - current) / Math.abs(current);
};

// Format growth with arrow
const formatGrowth = (growth) => {
  if (growth === null || growth === undefined || isNaN(growth)) return '—';
  const pct = (growth * 100).toFixed(0);
  const arrow = growth > 0 ? '↑' : growth < 0 ? '↓' : '→';
  return `${arrow}${Math.abs(pct)}%`;
};

// Get color for growth
const getGrowthColor = (growth) => {
  if (growth === null || growth === undefined || isNaN(growth)) return 'rgba(255,255,255,0.4)';
  if (growth > 0.15) return COLORS.green;
  if (growth > 0) return '#7dcea0';
  if (growth > -0.1) return COLORS.orange;
  return COLORS.red;
};

// Get fiscal year label
const getFyLabel = (fiscalYear) => {
  if (!fiscalYear) return '—';
  return `FY${String(fiscalYear).slice(-2)}`;
};

// Color for margin
const getMarginColor = (margin, thresholds = { good: 0.2, ok: 0.1 }) => {
  if (margin === null || margin === undefined || isNaN(margin)) return 'rgba(255,255,255,0.4)';
  if (margin >= thresholds.good) return COLORS.green;
  if (margin >= thresholds.ok) return COLORS.gold;
  if (margin >= 0) return COLORS.orange;
  return COLORS.red;
};

// Color for P/E multiple
const getMultipleColor = (pe, thresholds = { cheap: 15, fair: 25 }) => {
  if (pe === null || pe === undefined || isNaN(pe) || !isFinite(pe) || pe < 0) return 'rgba(255,255,255,0.4)';
  if (pe < thresholds.cheap) return COLORS.green;
  if (pe < thresholds.fair) return COLORS.gold;
  return COLORS.red;
};

// Rating badge component
const RatingBadge = memo(({ rating, size = 'normal' }) => {
  const colors = {
    'Strong Buy': { bg: 'rgba(46, 204, 113, 0.2)', border: COLORS.green, text: COLORS.green },
    'Buy': { bg: 'rgba(46, 204, 113, 0.15)', border: '#7dcea0', text: '#7dcea0' },
    'Hold': { bg: 'rgba(241, 196, 15, 0.15)', border: COLORS.gold, text: COLORS.gold },
    'Sell': { bg: 'rgba(231, 76, 60, 0.15)', border: '#e88a82', text: '#e88a82' },
    'Strong Sell': { bg: 'rgba(231, 76, 60, 0.2)', border: COLORS.red, text: COLORS.red },
  };
  const style = colors[rating] || colors['Hold'];
  const isSmall = size === 'small';

  return (
    <span style={{
      padding: isSmall ? '2px 6px' : '3px 8px',
      borderRadius: '4px',
      fontSize: isSmall ? '9px' : '10px',
      fontWeight: '600',
      background: style.bg,
      border: `1px solid ${style.border}`,
      color: style.text,
      whiteSpace: 'nowrap',
    }}>
      {rating}
    </span>
  );
});

// Price target bar component
const PriceTargetBar = memo(({ current, low, high, target }) => {
  if (!low || !high || !current) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;

  const range = high - low;
  const currentPos = Math.max(0, Math.min(100, ((current - low) / range) * 100));
  const targetPos = Math.max(0, Math.min(100, ((target - low) / range) * 100));
  const upside = ((target - current) / current) * 100;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
      <div style={{
        flex: 1,
        height: '6px',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '3px',
        position: 'relative',
      }}>
        {/* Current price marker */}
        <div style={{
          position: 'absolute',
          left: `${currentPos}%`,
          top: '-2px',
          width: '2px',
          height: '10px',
          background: COLORS.cyan,
          borderRadius: '1px',
        }} />
        {/* Target marker */}
        <div style={{
          position: 'absolute',
          left: `${targetPos}%`,
          top: '-1px',
          width: '8px',
          height: '8px',
          background: upside > 0 ? COLORS.green : COLORS.red,
          borderRadius: '50%',
          transform: 'translateX(-50%)',
        }} />
      </div>
      <span style={{
        fontSize: '10px',
        fontWeight: '600',
        color: upside > 0 ? COLORS.green : COLORS.red,
        minWidth: '40px',
        textAlign: 'right',
      }}>
        {upside > 0 ? '+' : ''}{upside.toFixed(0)}%
      </span>
    </div>
  );
});

// Days until date
const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const today = new Date();
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  return diff;
};

// Earnings countdown badge
const EarningsCountdown = memo(({ date }) => {
  const days = daysUntil(date);
  if (days === null) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;

  let color = COLORS.cyan;
  let text = `${days}d`;
  if (days <= 0) {
    color = COLORS.gold;
    text = days === 0 ? 'Today' : 'Reported';
  } else if (days <= 7) {
    color = COLORS.orange;
  } else if (days <= 14) {
    color = COLORS.gold;
  }

  return (
    <span style={{
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '9px',
      fontWeight: '600',
      background: `${color}20`,
      border: `1px solid ${color}40`,
      color,
    }}>
      {text}
    </span>
  );
});

// Surprise indicator
const SurpriseIndicator = memo(({ surprise, beats, misses }) => {
  if (surprise === null || surprise === undefined) return <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>;

  const pct = (surprise * 100).toFixed(1);
  const isPositive = surprise > 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{
        fontSize: '10px',
        color: isPositive ? COLORS.green : COLORS.red,
        fontWeight: '600',
      }}>
        {isPositive ? '+' : ''}{pct}%
      </span>
      {beats !== undefined && misses !== undefined && (
        <span style={{
          fontSize: '8px',
          color: 'rgba(255,255,255,0.4)',
        }}>
          ({beats}B/{misses}M)
        </span>
      )}
    </div>
  );
});

// Summary stat card
const StatCard = memo(({ label, value, subValue, color, icon }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.05)',
    minWidth: '120px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '14px' }}>{icon}</span>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <span style={{ fontSize: '18px', fontWeight: '700', color: color || '#fff' }}>{value}</span>
    {subValue && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{subValue}</span>}
  </div>
));

// Main ConsensusTab component
const ConsensusTab = memo(({
  positions,
  styles,
}) => {
  const [consensusData, setConsensusData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [sortBy, setSortBy] = useState('ticker');
  const [sortDir, setSortDir] = useState('asc');
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Load API key on mount
  useEffect(() => {
    const savedKey = getApiKey();
    if (savedKey) {
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
    }
  }, []);

  // Get unique tickers from ALL positions
  const tickers = [...new Set(
    positions
      .map(p => p.ticker?.toUpperCase())
      .filter(t => t && t.length > 0)
  )];

  // Filter to positions with valid estimates
  const tickersWithData = tickers.filter(t => hasValidEstimates(consensusData[t]));
  const tickersWithoutData = tickers.filter(t => consensusData[t] && !hasValidEstimates(consensusData[t]));

  // Validate and save API key
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      setKeyError('Please enter an API key');
      return;
    }
    setIsValidatingKey(true);
    setKeyError(null);

    try {
      const isValid = await validateApiKey(apiKeyInput.trim());
      if (isValid) {
        setApiKey(apiKeyInput.trim());
        saveApiKey(apiKeyInput.trim());
        setKeyError(null);
      } else {
        setKeyError('Invalid API key');
      }
    } catch (err) {
      setKeyError('Failed to validate API key');
    }
    setIsValidatingKey(false);
  };

  // Fetch data
  const handleFetchData = useCallback(async () => {
    if (!apiKey || tickers.length === 0) return;

    setIsLoading(true);
    setError(null);
    setLoadingProgress({ current: 0, total: tickers.length });

    try {
      const data = await batchFetchConsensusData(
        tickers,
        apiKey,
        (current, total) => setLoadingProgress({ current, total })
      );
      setConsensusData(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to fetch data');
    }
    setIsLoading(false);
  }, [apiKey, tickers]);

  // Sort data
  const sortedData = useMemo(() => {
    return [...tickers]
      .map(ticker => consensusData[ticker])
      .filter(data => hasValidEstimates(data))
      .sort((a, b) => {
        let aVal, bVal;
        switch (sortBy) {
          case 'ticker': aVal = a.ticker; bVal = b.ticker; break;
          case 'price': aVal = a.price || 0; bVal = b.price || 0; break;
          case 'upside': aVal = a.priceTargets?.upside || -999; bVal = b.priceTargets?.upside || -999; break;
          case 'revenue': aVal = a.fy1?.revenue || 0; bVal = b.fy1?.revenue || 0; break;
          case 'revGrowth': aVal = calcGrowth(a.fy1?.revenue, a.fy2?.revenue) || -999; bVal = calcGrowth(b.fy1?.revenue, b.fy2?.revenue) || -999; break;
          case 'eps': aVal = a.fy1?.eps || 0; bVal = b.fy1?.eps || 0; break;
          case 'epsGrowth': aVal = calcGrowth(a.fy1?.eps, a.fy2?.eps) || -999; bVal = calcGrowth(b.fy1?.eps, b.fy2?.eps) || -999; break;
          case 'pe': aVal = a.multiples?.forwardPE || 999; bVal = b.multiples?.forwardPE || 999; break;
          default: aVal = a.ticker; bVal = b.ticker;
        }
        if (typeof aVal === 'string') {
          return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      });
  }, [tickers, consensusData, sortBy, sortDir]);

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  // Toggle row expansion
  const toggleRow = (ticker) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  // Calculate aggregate stats
  const aggregateStats = useMemo(() => {
    if (sortedData.length === 0) return null;

    let totalBuy = 0, totalHold = 0, totalSell = 0;
    let upsideSum = 0, upsideCount = 0;
    let upcomingEarnings = [];

    sortedData.forEach(row => {
      if (row.ratings) {
        totalBuy += (row.ratings.strongBuy || 0) + (row.ratings.buy || 0);
        totalHold += row.ratings.hold || 0;
        totalSell += (row.ratings.sell || 0) + (row.ratings.strongSell || 0);
      }
      if (row.priceTargets?.upside != null) {
        upsideSum += row.priceTargets.upside;
        upsideCount++;
      }
      if (row.earnings?.nextDate) {
        const days = daysUntil(row.earnings.nextDate);
        if (days !== null && days >= 0 && days <= 30) {
          upcomingEarnings.push({ ticker: row.ticker, days, date: row.earnings.nextDate });
        }
      }
    });

    upcomingEarnings.sort((a, b) => a.days - b.days);

    return {
      totalBuy,
      totalHold,
      totalSell,
      avgUpside: upsideCount > 0 ? upsideSum / upsideCount : null,
      upcomingEarnings: upcomingEarnings.slice(0, 3),
      stockCount: sortedData.length,
    };
  }, [sortedData]);

  // Styles
  const thStyle = {
    padding: '8px 6px',
    textAlign: 'left',
    fontSize: '10px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    userSelect: 'none',
  };

  const tdStyle = {
    padding: '8px 6px',
    fontSize: '11px',
    color: 'rgba(255,255,255,0.85)',
    verticalAlign: 'middle',
  };

  const SortIndicator = ({ column }) => {
    if (sortBy !== column) return null;
    return <span style={{ marginLeft: '2px', opacity: 0.7 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // No API key state
  if (!apiKey) {
    return (
      <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
        <Card style={{ maxWidth: '400px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔑</div>
          <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '16px' }}>FMP API Key Required</h3>
          <p style={{ margin: '0 0 20px', color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
            Get your free API key from <a href="https://financialmodelingprep.com" target="_blank" rel="noopener noreferrer" style={{ color: COLORS.cyan }}>financialmodelingprep.com</a>
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter API key..."
              style={{
                flex: 1,
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                fontFamily: FONT_FAMILY,
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveApiKey()}
            />
            <button
              onClick={handleSaveApiKey}
              disabled={isValidatingKey}
              style={{
                padding: '10px 16px',
                background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              {isValidatingKey ? '...' : 'Save'}
            </button>
          </div>
          {keyError && <p style={{ margin: '12px 0 0', color: COLORS.red, fontSize: '11px' }}>{keyError}</p>}
        </Card>
      </div>
    );
  }

  // No positions state
  if (tickers.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)' }}>Add positions to see consensus estimates</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: FONT_FAMILY }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
            📊 Consensus Estimates
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
            {tickers.length} positions • {tickersWithData.length} with estimates
            {tickersWithoutData.length > 0 && ` • ${tickersWithoutData.length} ETFs/no coverage`}
            {lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={handleFetchData}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            background: isLoading ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: '600',
            cursor: isLoading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {isLoading ? (
            <>
              <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
              Loading {loadingProgress.current}/{loadingProgress.total}...
            </>
          ) : (
            <>🔄 Load Estimates</>
          )}
        </button>
      </div>

      {/* Error display */}
      {error && (
        <Card style={{ marginBottom: '16px', background: 'rgba(231, 76, 60, 0.1)', borderColor: 'rgba(231, 76, 60, 0.3)' }}>
          <p style={{ margin: 0, color: COLORS.red, fontSize: '12px' }}>⚠️ {error}</p>
        </Card>
      )}

      {/* Summary Cards */}
      {aggregateStats && sortedData.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <StatCard
            icon="📈"
            label="Analyst Sentiment"
            value={`${((aggregateStats.totalBuy / (aggregateStats.totalBuy + aggregateStats.totalHold + aggregateStats.totalSell)) * 100 || 0).toFixed(0)}% Buy`}
            subValue={`${aggregateStats.totalBuy} Buy / ${aggregateStats.totalHold} Hold / ${aggregateStats.totalSell} Sell`}
            color={aggregateStats.totalBuy > aggregateStats.totalSell ? COLORS.green : COLORS.red}
          />
          <StatCard
            icon="🎯"
            label="Avg Price Target"
            value={aggregateStats.avgUpside != null ? `${aggregateStats.avgUpside > 0 ? '+' : ''}${(aggregateStats.avgUpside * 100).toFixed(0)}%` : '—'}
            subValue={`Upside across ${aggregateStats.stockCount} stocks`}
            color={aggregateStats.avgUpside > 0 ? COLORS.green : COLORS.red}
          />
          {aggregateStats.upcomingEarnings.length > 0 && (
            <StatCard
              icon="📅"
              label="Next Earnings"
              value={aggregateStats.upcomingEarnings[0].ticker}
              subValue={`in ${aggregateStats.upcomingEarnings[0].days} days (${aggregateStats.upcomingEarnings[0].date})`}
              color={COLORS.cyan}
            />
          )}
        </div>
      )}

      {/* Main Data Table */}
      {sortedData.length > 0 && (
        <Card style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <th onClick={() => handleSort('ticker')} style={{ ...thStyle, position: 'sticky', left: 0, background: 'rgba(12,14,24,0.98)', zIndex: 1 }}>
                    Ticker<SortIndicator column="ticker" />
                  </th>
                  <th onClick={() => handleSort('price')} style={{ ...thStyle, textAlign: 'right' }}>Price<SortIndicator column="price" /></th>
                  <th onClick={() => handleSort('upside')} style={{ ...thStyle, textAlign: 'center' }}>Target<SortIndicator column="upside" /></th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Rating</th>
                  <th onClick={() => handleSort('revenue')} style={{ ...thStyle, textAlign: 'right' }}>Revenue<SortIndicator column="revenue" /></th>
                  <th onClick={() => handleSort('revGrowth')} style={{ ...thStyle, textAlign: 'right' }}>Rev Grth<SortIndicator column="revGrowth" /></th>
                  <th onClick={() => handleSort('eps')} style={{ ...thStyle, textAlign: 'right' }}>EPS<SortIndicator column="eps" /></th>
                  <th onClick={() => handleSort('epsGrowth')} style={{ ...thStyle, textAlign: 'right' }}>EPS Grth<SortIndicator column="epsGrowth" /></th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>EBIT%</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Net%</th>
                  <th onClick={() => handleSort('pe')} style={{ ...thStyle, textAlign: 'right' }}>Fwd P/E<SortIndicator column="pe" /></th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>EV/EBITDA</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Earnings</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Surprise</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map(row => {
                  const revGrowth = calcGrowth(row.fy1?.revenue, row.fy2?.revenue);
                  const epsGrowth = calcGrowth(row.fy1?.eps, row.fy2?.eps);
                  const isExpanded = expandedRows.has(row.ticker);

                  return (
                    <React.Fragment key={row.ticker}>
                      <tr
                        onClick={() => toggleRow(row.ticker)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.03)',
                          cursor: 'pointer',
                          background: isExpanded ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
                        }}
                      >
                        <td style={{ ...tdStyle, position: 'sticky', left: 0, background: isExpanded ? 'rgba(12,14,24,0.98)' : 'rgba(12,14,24,0.95)', zIndex: 1 }}>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: '600', color: COLORS.cyan }}>{row.ticker}</span>
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {row.name}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ color: row.changesPercentage >= 0 ? COLORS.green : COLORS.red }}>
                            ${row.price?.toFixed(2) || '—'}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <PriceTargetBar
                            current={row.price}
                            low={row.priceTargets?.low}
                            high={row.priceTargets?.high}
                            target={row.priceTargets?.consensus}
                          />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {row.ratings?.consensus ? (
                            <RatingBadge rating={row.ratings.consensus} size="small" />
                          ) : '—'}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span>{formatNumber(row.fy1?.revenue)}</span>
                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{getFyLabel(row.fy1?.fiscalYear)}</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ color: getGrowthColor(revGrowth), fontWeight: '600' }}>
                            {formatGrowth(revGrowth)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                            <span>${row.fy1?.eps?.toFixed(2) || '—'}</span>
                            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)' }}>{getFyLabel(row.fy1?.fiscalYear)}</span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ color: getGrowthColor(epsGrowth), fontWeight: '600' }}>
                            {formatGrowth(epsGrowth)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ color: getMarginColor(row.fy1?.ebitMargin) }}>
                            {formatPercent(row.fy1?.ebitMargin)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ color: getMarginColor(row.fy1?.netMargin, { good: 0.15, ok: 0.05 }) }}>
                            {formatPercent(row.fy1?.netMargin)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ color: getMultipleColor(row.multiples?.forwardPE) }}>
                            {formatMultiple(row.multiples?.forwardPE)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                          <span style={{ color: getMultipleColor(row.multiples?.evToEbitda, { cheap: 10, fair: 15 }) }}>
                            {formatMultiple(row.multiples?.evToEbitda)}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <EarningsCountdown date={row.earnings?.nextDate} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <SurpriseIndicator
                            surprise={row.earnings?.avgSurprise}
                            beats={row.earnings?.beatCount}
                            misses={row.earnings?.missCount}
                          />
                        </td>
                      </tr>
                      {/* Expanded row with more details */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="14" style={{ padding: '12px 16px', background: 'rgba(0, 212, 255, 0.02)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '11px' }}>
                              {/* FY2 Estimates */}
                              <div>
                                <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '8px' }}>
                                  {getFyLabel(row.fy2?.fiscalYear)} Estimates
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>Revenue: {formatNumber(row.fy2?.revenue)}</div>
                                  <div>EPS: ${row.fy2?.eps?.toFixed(2) || '—'}</div>
                                  <div>EBITDA: {formatNumber(row.fy2?.ebitda)}</div>
                                </div>
                              </div>
                              {/* Historical Growth */}
                              <div>
                                <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '8px' }}>
                                  Historical Growth (3Y Avg)
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>Revenue: <span style={{ color: getGrowthColor(row.growth?.revenue) }}>{formatPercent(row.growth?.revenue, true)}</span></div>
                                  <div>EPS: <span style={{ color: getGrowthColor(row.growth?.eps) }}>{formatPercent(row.growth?.eps, true)}</span></div>
                                  <div>Net Income: <span style={{ color: getGrowthColor(row.growth?.netIncome) }}>{formatPercent(row.growth?.netIncome, true)}</span></div>
                                </div>
                              </div>
                              {/* Analyst Ratings Detail */}
                              <div>
                                <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '8px' }}>
                                  Analyst Ratings ({row.ratings?.totalAnalysts || 0} analysts)
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {row.ratings?.strongBuy > 0 && <span style={{ color: COLORS.green }}>Strong Buy: {row.ratings.strongBuy}</span>}
                                  {row.ratings?.buy > 0 && <span style={{ color: '#7dcea0' }}>Buy: {row.ratings.buy}</span>}
                                  {row.ratings?.hold > 0 && <span style={{ color: COLORS.gold }}>Hold: {row.ratings.hold}</span>}
                                  {row.ratings?.sell > 0 && <span style={{ color: '#e88a82' }}>Sell: {row.ratings.sell}</span>}
                                  {row.ratings?.strongSell > 0 && <span style={{ color: COLORS.red }}>Strong Sell: {row.ratings.strongSell}</span>}
                                </div>
                              </div>
                              {/* Price Target Detail */}
                              <div>
                                <div style={{ fontWeight: '600', color: COLORS.cyan, marginBottom: '8px' }}>
                                  Price Targets
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <div>Low: ${row.priceTargets?.low?.toFixed(2) || '—'}</div>
                                  <div>Consensus: ${row.priceTargets?.consensus?.toFixed(2) || '—'}</div>
                                  <div>High: ${row.priceTargets?.high?.toFixed(2) || '—'}</div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {sortedData.length === 0 && !isLoading && Object.keys(consensusData).length === 0 && (
        <Card style={{ textAlign: 'center', padding: '60px 40px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '16px' }}>Ready to Load Estimates</h3>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
            Click "Load Estimates" to fetch analyst data for your {tickers.length} positions
            <br />
            <span style={{ fontSize: '11px' }}>(~{Math.ceil(tickers.length * 0.4)} seconds, 9 API calls per stock)</span>
          </p>
        </Card>
      )}

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
});

ConsensusTab.displayName = 'ConsensusTab';

export default ConsensusTab;
