/**
 * Consensus Tab
 *
 * @module components/tabs/ConsensusTab
 * @description Displays forward analyst estimates for portfolio positions
 */

import React, { useState, useEffect, useCallback, memo } from 'react';
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
};

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif';

// Reusable Card component
const Card = memo(({ children, gradient = false, style = {} }) => (
  <div
    style={{
      background: gradient
        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.03) 0%, rgba(123, 47, 247, 0.03) 100%)'
        : 'rgba(255, 255, 255, 0.02)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '20px',
      ...style,
    }}
  >
    {children}
  </div>
));

// Card title component
const CardTitle = memo(({ icon, title, badge = null }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
  }}>
    <span style={{ fontSize: '18px' }}>{icon}</span>
    <span style={{
      fontSize: '14px',
      fontWeight: '600',
      color: '#fff',
    }}>
      {title}
    </span>
    {badge && (
      <span style={{
        fontSize: '10px',
        fontWeight: '600',
        padding: '3px 8px',
        borderRadius: '6px',
        background: 'rgba(0, 212, 255, 0.15)',
        color: COLORS.cyan,
        border: '1px solid rgba(0, 212, 255, 0.3)',
      }}>
        {badge}
      </span>
    )}
  </div>
));

// Format large numbers
const formatNumber = (num, decimals = 0) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(1)}T`;
  if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
  if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
  return `$${num.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
};

// Format percentage
const formatPercent = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '—';
  return `${(num * 100).toFixed(1)}%`;
};

// Format multiple
const formatMultiple = (num) => {
  if (num === null || num === undefined || isNaN(num) || !isFinite(num)) return '—';
  if (num < 0) return '—';
  return `${num.toFixed(1)}x`;
};

// Color for margin (green = good, red = poor)
const getMarginColor = (margin, thresholds = { good: 0.2, ok: 0.1 }) => {
  if (margin === null || margin === undefined || isNaN(margin)) return 'rgba(255,255,255,0.4)';
  if (margin >= thresholds.good) return COLORS.green;
  if (margin >= thresholds.ok) return COLORS.orange;
  return COLORS.red;
};

// Color for multiple (lower = better for value)
const getMultipleColor = (multiple, thresholds = { cheap: 15, fair: 25 }) => {
  if (multiple === null || multiple === undefined || isNaN(multiple) || !isFinite(multiple)) return 'rgba(255,255,255,0.4)';
  if (multiple < 0) return 'rgba(255,255,255,0.4)';
  if (multiple <= thresholds.cheap) return COLORS.green;
  if (multiple <= thresholds.fair) return COLORS.orange;
  return COLORS.red;
};

const ConsensusTab = memo(({
  positions,
  styles: externalStyles,
}) => {
  // API key state
  const [apiKey, setApiKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [keyError, setKeyError] = useState(null);

  // Data state
  const [consensusData, setConsensusData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Sorting state
  const [sortBy, setSortBy] = useState('ticker');
  const [sortDir, setSortDir] = useState('asc');

  // Load API key on mount
  useEffect(() => {
    const savedKey = getApiKey();
    if (savedKey) {
      setApiKey(savedKey);
      setApiKeyInput(savedKey);
    }
  }, []);

  // Get unique tickers from positions
  const tickers = [...new Set(
    positions
      .map(p => p.ticker?.toUpperCase())
      .filter(t => t && t.length > 0)
  )];

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
        setKeyError('Invalid API key. Please check and try again.');
      }
    } catch (err) {
      setKeyError('Failed to validate API key');
    }

    setIsValidatingKey(false);
  };

  // Fetch consensus data for all positions
  const handleFetchData = useCallback(async () => {
    console.log('[ConsensusTab] handleFetchData called', { apiKey: apiKey ? 'SET' : 'MISSING', tickers });

    if (!apiKey) {
      setError('API key is missing. Please enter your FMP API key.');
      return;
    }
    if (tickers.length === 0) {
      setError('No positions to fetch data for.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setLoadingProgress({ current: 0, total: tickers.length });

    console.log('[ConsensusTab] Starting fetch for', tickers.length, 'tickers');

    try {
      const data = await batchFetchConsensusData(
        tickers,
        apiKey,
        (current, total) => setLoadingProgress({ current, total })
      );
      console.log('[ConsensusTab] Fetch complete, received data for', Object.keys(data).length, 'tickers');
      setConsensusData(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('[ConsensusTab] Fetch error:', err);
      setError(err.message || 'Failed to fetch data');
    }

    setIsLoading(false);
  }, [apiKey, tickers]);

  // Sort data
  const sortedData = [...tickers]
    .map(ticker => consensusData[ticker])
    .filter(Boolean)
    .sort((a, b) => {
      let aVal, bVal;

      switch (sortBy) {
        case 'ticker':
          aVal = a.ticker;
          bVal = b.ticker;
          break;
        case 'price':
          aVal = a.price || 0;
          bVal = b.price || 0;
          break;
        case 'fy1Revenue':
          aVal = a.fy1?.revenue || 0;
          bVal = b.fy1?.revenue || 0;
          break;
        case 'fy1Eps':
          aVal = a.fy1?.eps || 0;
          bVal = b.fy1?.eps || 0;
          break;
        case 'forwardPE':
          aVal = a.multiples?.forwardPE || Infinity;
          bVal = b.multiples?.forwardPE || Infinity;
          break;
        case 'grossMargin':
          aVal = a.fy1?.grossMargin || 0;
          bVal = b.fy1?.grossMargin || 0;
          break;
        case 'netMargin':
          aVal = a.fy1?.netMargin || 0;
          bVal = b.fy1?.netMargin || 0;
          break;
        default:
          aVal = a.ticker;
          bVal = b.ticker;
      }

      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

  // Toggle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
  };

  // Render sort indicator
  const SortIndicator = ({ column }) => {
    if (sortBy !== column) return null;
    return <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // No API key - show setup
  if (!apiKey) {
    return (
      <div style={{
        padding: '24px',
        fontFamily: FONT_FAMILY,
        color: '#fff',
        minHeight: '100%',
      }}>
        <Card gradient>
          <CardTitle icon="📊" title="Forward Consensus Estimates" />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px 20px',
            gap: '20px',
          }}>
            <span style={{ fontSize: '48px' }}>🔑</span>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
              FMP API Key Required
            </h3>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(255,255,255,0.6)',
              textAlign: 'center',
              maxWidth: '400px',
            }}>
              This feature uses Financial Modeling Prep for analyst estimates.
              Get a free API key at{' '}
              <a
                href="https://financialmodelingprep.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: COLORS.cyan }}
              >
                financialmodelingprep.com
              </a>
            </p>

            <div style={{
              display: 'flex',
              gap: '8px',
              width: '100%',
              maxWidth: '400px',
            }}>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Enter your FMP API key..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  fontSize: '13px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  color: '#fff',
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              />
              <button
                onClick={handleSaveApiKey}
                disabled={isValidatingKey}
                style={{
                  padding: '12px 24px',
                  fontSize: '13px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: isValidatingKey ? 'wait' : 'pointer',
                  opacity: isValidatingKey ? 0.7 : 1,
                }}
              >
                {isValidatingKey ? 'Validating...' : 'Save'}
              </button>
            </div>

            {keyError && (
              <p style={{
                margin: 0,
                fontSize: '12px',
                color: COLORS.red,
              }}>
                {keyError}
              </p>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // No positions - show empty state
  if (tickers.length === 0) {
    return (
      <div style={{
        padding: '24px',
        fontFamily: FONT_FAMILY,
        color: '#fff',
        minHeight: '100%',
      }}>
        <Card gradient>
          <CardTitle icon="📊" title="Forward Consensus Estimates" />

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '60px 20px',
            gap: '16px',
          }}>
            <span style={{ fontSize: '48px', opacity: 0.5 }}>📋</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              No Positions
            </h3>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(255,255,255,0.5)',
            }}>
              Add positions in the Positions tab to see analyst estimates
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      padding: '24px',
      fontFamily: FONT_FAMILY,
      color: '#fff',
      minHeight: '100%',
    }}>
      {/* Header Card */}
      <Card gradient style={{ marginBottom: '20px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📊</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                Forward Consensus Estimates
              </h2>
              <p style={{
                margin: '4px 0 0',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
              }}>
                {tickers.length} position{tickers.length !== 1 ? 's' : ''} •{' '}
                {Object.keys(consensusData).length} with data
                {lastUpdated && (
                  <> • Updated {lastUpdated.toLocaleTimeString()}</>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={handleFetchData}
            disabled={isLoading}
            style={{
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: '600',
              background: isLoading
                ? 'rgba(255,255,255,0.1)'
                : 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              cursor: isLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {isLoading ? (
              <>
                <span style={{
                  width: '14px',
                  height: '14px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}></span>
                Loading {loadingProgress.current}/{loadingProgress.total}...
              </>
            ) : (
              <>
                <span>📡</span>
                {Object.keys(consensusData).length > 0 ? 'Refresh' : 'Load'} Estimates
              </>
            )}
          </button>
        </div>
      </Card>

      {/* Error message */}
      {error && (
        <Card style={{
          marginBottom: '20px',
          background: 'rgba(231, 76, 60, 0.1)',
          border: '1px solid rgba(231, 76, 60, 0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <div>
              <p style={{ margin: 0, fontSize: '13px', color: COLORS.red }}>
                {error}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Data Table */}
      {Object.keys(consensusData).length > 0 && (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
            }}>
              <thead>
                <tr style={{
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <th
                    onClick={() => handleSort('ticker')}
                    style={thStyle}
                  >
                    Ticker<SortIndicator column="ticker" />
                  </th>
                  <th
                    onClick={() => handleSort('price')}
                    style={{ ...thStyle, textAlign: 'right' }}
                  >
                    Price<SortIndicator column="price" />
                  </th>
                  <th
                    onClick={() => handleSort('fy1Revenue')}
                    style={{ ...thStyle, textAlign: 'right' }}
                  >
                    FY1 Rev<SortIndicator column="fy1Revenue" />
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>FY2 Rev</th>
                  <th
                    onClick={() => handleSort('grossMargin')}
                    style={{ ...thStyle, textAlign: 'right' }}
                  >
                    Gross%<SortIndicator column="grossMargin" />
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>EBIT%</th>
                  <th
                    onClick={() => handleSort('netMargin')}
                    style={{ ...thStyle, textAlign: 'right' }}
                  >
                    Net%<SortIndicator column="netMargin" />
                  </th>
                  <th
                    onClick={() => handleSort('fy1Eps')}
                    style={{ ...thStyle, textAlign: 'right' }}
                  >
                    FY1 EPS<SortIndicator column="fy1Eps" />
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>FY2 EPS</th>
                  <th
                    onClick={() => handleSort('forwardPE')}
                    style={{ ...thStyle, textAlign: 'right' }}
                  >
                    Fwd P/E<SortIndicator column="forwardPE" />
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>EV/EBITDA</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>P/S</th>
                </tr>
              </thead>
              <tbody>
                {sortedData.map(row => (
                  <tr
                    key={row.ticker}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: '600', color: COLORS.cyan }}>
                          {row.ticker}
                        </span>
                        <span style={{
                          fontSize: '10px',
                          color: 'rgba(255,255,255,0.4)',
                          maxWidth: '120px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {row.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{
                        color: row.changesPercentage >= 0 ? COLORS.green : COLORS.red,
                      }}>
                        ${row.price?.toFixed(2) || '—'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {formatNumber(row.fy1?.revenue)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      {formatNumber(row.fy2?.revenue)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{ color: getMarginColor(row.fy1?.grossMargin, { good: 0.4, ok: 0.2 }) }}>
                        {formatPercent(row.fy1?.grossMargin)}
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
                      ${row.fy1?.eps?.toFixed(2) || '—'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      ${row.fy2?.eps?.toFixed(2) || '—'}
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
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <span style={{ color: getMultipleColor(row.multiples?.priceToSales, { cheap: 3, fair: 8 }) }}>
                        {formatMultiple(row.multiples?.priceToSales)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            gap: '20px',
            flexWrap: 'wrap',
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
          }}>
            <span>FY1/FY2 = Next fiscal year estimates</span>
            <span>
              <span style={{ color: COLORS.green }}>Green</span> = Strong |{' '}
              <span style={{ color: COLORS.orange }}>Orange</span> = Fair |{' '}
              <span style={{ color: COLORS.red }}>Red</span> = Weak
            </span>
          </div>
        </Card>
      )}

      {/* Empty state after loading */}
      {!isLoading && Object.keys(consensusData).length === 0 && (
        <Card>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '60px 20px',
            gap: '16px',
          }}>
            <span style={{ fontSize: '48px', opacity: 0.5 }}>📈</span>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
              Ready to Load Estimates
            </h3>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: 'rgba(255,255,255,0.5)',
              textAlign: 'center',
            }}>
              Click "Load Estimates" to fetch forward consensus data for your {tickers.length} position{tickers.length !== 1 ? 's' : ''}
            </p>
          </div>
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

// Table header style
const thStyle = {
  padding: '12px 8px',
  textAlign: 'left',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.5)',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
};

// Table cell style
const tdStyle = {
  padding: '12px 8px',
  color: '#fff',
  whiteSpace: 'nowrap',
};

export default ConsensusTab;
