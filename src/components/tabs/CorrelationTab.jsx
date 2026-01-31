import React, { useState, useMemo, memo, useEffect } from 'react';
import CorrelationCellInput from '../correlation/CorrelationCellInput';

/**
 * CorrelationTab - Correlation Matrix Tab Component
 * 
 * Displays and manages the correlation matrix with features like:
 * - Correlation matrix visualization (heatmap)
 * - Lag analysis for international stocks
 * - Sector/Industry-based correlation groups
 * - Multiple view modes (correlation, beta, volatility, summary)
 */

// ============================================
// DESIGN TOKENS
// ============================================
const COLORS = {
  cyan: '#00d4ff',
  purple: '#9b59b6',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#ff9f43',
  yellow: '#f1c40f',
  blue: '#3498db',
  darkBg: 'rgba(22, 27, 44, 0.7)',
  cardBg: 'linear-gradient(135deg, rgba(25, 28, 45, 0.95) 0%, rgba(15, 18, 30, 0.95) 100%)',
};

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// ============================================
// VIEW MODE DEFINITIONS
// ============================================
const VIEW_MODES = [
  { 
    id: 'summary', 
    label: 'Summary', 
    icon: '🎯',
    shortcut: 'S',
    description: 'Portfolio correlation overview',
    longDescription: 'How each position correlates with the rest of your portfolio, weighted by position size',
    color: COLORS.cyan,
  },
  { 
    id: 'correlation', 
    label: 'Correlation', 
    icon: '📊',
    shortcut: 'C',
    description: 'Pairwise correlations',
    longDescription: 'How closely assets move together (-1 to +1). Editable in lower triangle.',
    color: COLORS.purple,
  },
  { 
    id: 'beta', 
    label: 'Beta/Torque', 
    icon: '⚡',
    shortcut: 'B',
    description: 'Relative sensitivity',
    longDescription: 'When Column moves 1%, how much does Row move? β = ρ × (σ_row / σ_col)',
    color: COLORS.orange,
  },
  { 
    id: 'volatility', 
    label: 'Volatility', 
    icon: '📈',
    shortcut: 'V',
    description: 'Risk comparison',
    longDescription: 'Annualized standard deviation for each position and relative volatility ratios',
    color: COLORS.green,
  },
];

// ============================================
// PREMIUM VIEW MODE SELECTOR
// ============================================
const ViewModeSelector = memo(({ activeMode, onModeChange, onKeyboardShortcut }) => {
  const [hoveredMode, setHoveredMode] = useState(null);
  
  // Register keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle if not in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      
      const key = e.key.toUpperCase();
      const mode = VIEW_MODES.find(m => m.shortcut === key);
      if (mode && onKeyboardShortcut) {
        e.preventDefault();
        onModeChange(mode.id);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onModeChange, onKeyboardShortcut]);
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      marginTop: '20px',
      marginBottom: '16px',
    }}>
      {/* Segmented Control */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '5px',
        background: 'linear-gradient(135deg, rgba(15, 18, 30, 0.9) 0%, rgba(20, 24, 40, 0.9) 100%)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.02)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {VIEW_MODES.map((mode, index) => {
          const isActive = activeMode === mode.id;
          const isHovered = hoveredMode === mode.id;
          
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              onMouseEnter={() => setHoveredMode(mode.id)}
              onMouseLeave={() => setHoveredMode(null)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                border: isActive ? `1px solid ${mode.color}40` : '1px solid transparent',
                borderRadius: '10px',
                background: isActive 
                  ? `linear-gradient(135deg, ${mode.color}20 0%, ${mode.color}10 100%)`
                  : isHovered 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                fontFamily: FONT_FAMILY,
                outline: 'none',
              }}
            >
              {/* Icon */}
              <span style={{ 
                fontSize: '15px',
                filter: isActive ? 'none' : 'grayscale(50%)',
                transition: 'filter 0.2s ease',
              }}>
                {mode.icon}
              </span>
              
              {/* Label */}
              <span style={{
                fontSize: '11px',
                fontWeight: isActive ? '600' : '500',
                color: isActive ? '#fff' : '#888',
                letterSpacing: '-0.01em',
                transition: 'color 0.2s ease',
              }}>
                {mode.label}
              </span>
              
              {/* Keyboard shortcut */}
              <span style={{
                fontSize: '9px',
                fontWeight: '600',
                color: isActive ? mode.color : '#555',
                background: isActive ? `${mode.color}20` : 'rgba(255, 255, 255, 0.05)',
                padding: '2px 6px',
                borderRadius: '4px',
                border: `1px solid ${isActive ? `${mode.color}40` : 'rgba(255, 255, 255, 0.08)'}`,
                fontFamily: 'monospace',
                transition: 'all 0.2s ease',
              }}>
                {mode.shortcut}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Description Card */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        background: `linear-gradient(135deg, ${VIEW_MODES.find(m => m.id === activeMode)?.color}08 0%, transparent 100%)`,
        borderRadius: '10px',
        border: `1px solid ${VIEW_MODES.find(m => m.id === activeMode)?.color}20`,
        transition: 'all 0.3s ease',
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${VIEW_MODES.find(m => m.id === activeMode)?.color}15`,
          borderRadius: '8px',
          fontSize: '18px',
        }}>
          {VIEW_MODES.find(m => m.id === activeMode)?.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: '600', 
            color: VIEW_MODES.find(m => m.id === activeMode)?.color,
            marginBottom: '2px',
          }}>
            {VIEW_MODES.find(m => m.id === activeMode)?.label} View
          </div>
          <div style={{ fontSize: '11px', color: '#888' }}>
            {VIEW_MODES.find(m => m.id === activeMode)?.longDescription}
          </div>
        </div>
      </div>
    </div>
  );
});

// ============================================
// VIEW HEADER COMPONENT
// ============================================
const ViewHeader = memo(({ title, subtitle, icon, color, children }) => (
  <div style={{
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
    padding: '16px',
    background: `linear-gradient(135deg, ${color}08 0%, transparent 50%)`,
    borderRadius: '12px',
    border: `1px solid ${color}15`,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{
        width: '40px',
        height: '40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${color}15`,
        borderRadius: '10px',
        fontSize: '20px',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{title}</div>
        <div style={{ fontSize: '11px', color: '#888' }}>{subtitle}</div>
      </div>
    </div>
    {children}
  </div>
));

// ============================================
// METRIC CARD COMPONENT
// ============================================
const MetricCard = memo(({ label, value, subtext, color, icon, size = 'normal' }) => (
  <div style={{
    padding: size === 'large' ? '16px 20px' : '12px 16px',
    background: `linear-gradient(135deg, ${color}12 0%, ${color}05 100%)`,
    borderRadius: '10px',
    border: `1px solid ${color}25`,
    minWidth: size === 'large' ? '140px' : '100px',
  }}>
    <div style={{ 
      fontSize: '10px', 
      color: '#888', 
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      marginBottom: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      {icon && <span>{icon}</span>}
      {label}
    </div>
    <div style={{ 
      fontSize: size === 'large' ? '26px' : '18px', 
      fontWeight: '700', 
      color: color,
      fontFamily: 'monospace',
      letterSpacing: '-0.5px',
    }}>
      {value}
    </div>
    {subtext && (
      <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>
        {subtext}
      </div>
    )}
  </div>
));

// ============================================
// CORRELATION LEGEND COMPONENT
// ============================================
const CorrelationLegend = memo(() => {
  const legendItems = [
    { range: '< -0.3', label: 'Hedge', color: '#6f42c1', bg: 'rgba(111, 66, 193, 0.7)' },
    { range: '-0.3 to -0.1', label: 'Low−', color: '#3498db', bg: 'rgba(52, 152, 219, 0.55)' },
    { range: '±0.1', label: 'Zero', color: '#28a745', bg: 'rgba(40, 167, 69, 0.55)', highlight: true },
    { range: '0.1 to 0.3', label: 'Low+', color: '#b4c832', bg: 'rgba(180, 200, 50, 0.45)' },
    { range: '0.3 to 0.5', label: 'Moderate', color: '#ffc107', bg: 'rgba(255, 193, 7, 0.5)' },
    { range: '0.5 to 0.7', label: 'High', color: '#fd7e14', bg: 'rgba(253, 126, 20, 0.55)' },
    { range: '> 0.7', label: 'Concentrated', color: '#dc3545', bg: 'rgba(220, 53, 69, 0.7)' },
  ];
  
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '10px 14px',
      background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.2) 100%)',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      flexWrap: 'wrap',
      marginBottom: '12px',
    }}>
      <span style={{ fontSize: '10px', color: '#666', fontWeight: '600', marginRight: '8px' }}>
        SCALE:
      </span>
      {legendItems.map((item, idx) => (
        <div 
          key={idx}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            padding: '4px 8px',
            background: item.highlight ? 'rgba(40, 167, 69, 0.1)' : 'transparent',
            borderRadius: '6px',
            border: item.highlight ? '1px solid rgba(40, 167, 69, 0.3)' : 'none',
          }}
        >
          <div style={{ 
            width: '12px', 
            height: '12px', 
            borderRadius: '3px', 
            background: item.bg,
            boxShadow: `0 0 6px ${item.bg}`,
          }} />
          <span style={{ 
            fontSize: '9px', 
            color: item.color,
            fontWeight: item.highlight ? '600' : '500',
          }}>
            {item.range}
          </span>
        </div>
      ))}
    </div>
  );
});

// ============================================
// COVARIANCE MATRIX CARD COMPONENT
// ============================================
const CovarianceMatrixCard = memo(({ tickers, positions, editedCorrelation, getDistributionParams, styles }) => {
  // Dynamic table sizing based on ticker count
  // Use larger minimum widths to prevent ticker names from being cut off
  const n = tickers.length;
  const baseCellWidth = n <= 5 ? 80 : n <= 8 ? 72 : n <= 12 ? 65 : 58;
  const tableMinWidth = (n + 1) * baseCellWidth;

  // Calculate covariance matrix and stats
  const { covMatrix, stats } = useMemo(() => {
    const vols = positions.map(pos => {
      const params = getDistributionParams(pos);
      return params.sigma || 0.2;
    });
    
    const matrix = [];
    let maxCov = -Infinity;
    let minCov = Infinity;
    let maxPositive = 0;
    let minNegative = 0;
    let avgCov = 0;
    let count = 0;
    const allCovs = [];
    
    for (let i = 0; i < tickers.length; i++) {
      const row = [];
      const sigmaI = vols[i];
      for (let j = 0; j < tickers.length; j++) {
        const sigmaJ = vols[j];
        const corr = editedCorrelation[i]?.[j] ?? 0;
        const cov = corr * sigmaI * sigmaJ;
        row.push(cov);
        
        if (i !== j) {
          allCovs.push(cov);
          maxCov = Math.max(maxCov, cov);
          minCov = Math.min(minCov, cov);
          if (cov > 0) maxPositive = Math.max(maxPositive, cov);
          if (cov < 0) minNegative = Math.min(minNegative, cov);
          avgCov += cov;
          count++;
        }
      }
      matrix.push(row);
    }
    
    // Calculate percentiles for better color distribution
    const sortedCovs = [...allCovs].sort((a, b) => a - b);
    const p25 = sortedCovs[Math.floor(sortedCovs.length * 0.25)] || 0;
    const p75 = sortedCovs[Math.floor(sortedCovs.length * 0.75)] || 0;
    
    return {
      covMatrix: matrix,
      stats: {
        maxCov,
        minCov,
        maxPositive,
        minNegative,
        avgCov: count > 0 ? avgCov / count : 0,
        p25,
        p75,
        vols,
      }
    };
  }, [tickers, positions, editedCorrelation, getDistributionParams]);
  
  // More generous color function using percentile-aware scaling
  const getCovColor = (cov, isVariance) => {
    if (isVariance) return 'rgba(0, 212, 255, 0.2)';
    
    if (cov > 0) {
      // Positive covariance: use graduated red/orange scale
      // Use percentile-based scaling for better differentiation
      const maxRef = stats.maxPositive > 0 ? stats.maxPositive : 0.1;
      const normalized = Math.min(1, cov / maxRef);
      
      // Create 5 tiers for positive
      if (normalized >= 0.8) return 'rgba(231, 76, 60, 0.6)';    // High - bright red
      if (normalized >= 0.6) return 'rgba(231, 76, 60, 0.45)';   // Medium-high
      if (normalized >= 0.4) return 'rgba(253, 126, 20, 0.4)';   // Medium - orange
      if (normalized >= 0.2) return 'rgba(255, 193, 7, 0.35)';   // Low-medium - yellow
      return 'rgba(255, 220, 100, 0.2)';                         // Low - light yellow
      
    } else if (cov < 0) {
      // Negative covariance: use graduated green/cyan scale
      const minRef = stats.minNegative < 0 ? Math.abs(stats.minNegative) : 0.1;
      const normalized = Math.min(1, Math.abs(cov) / minRef);
      
      // Create 5 tiers for negative
      if (normalized >= 0.8) return 'rgba(46, 204, 113, 0.55)';  // Strong hedge - bright green
      if (normalized >= 0.6) return 'rgba(46, 204, 113, 0.4)';   // Medium hedge
      if (normalized >= 0.4) return 'rgba(52, 152, 219, 0.35)';  // Mild hedge - blue
      if (normalized >= 0.2) return 'rgba(0, 212, 255, 0.25)';   // Light hedge - cyan
      return 'rgba(100, 200, 220, 0.15)';                        // Very light
    }
    
    return 'rgba(255, 255, 255, 0.05)'; // Near zero
  };
  
  return (
    <div style={{
      background: COLORS.cardBg,
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '20px',
      marginTop: '16px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(155, 89, 182, 0.15)',
            borderRadius: '10px',
            fontSize: '18px',
          }}>
            📋
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>
              Implied Covariance Matrix
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>
              Cov(i,j) = ρ(i,j) × σᵢ × σⱼ — Annualized
            </div>
          </div>
        </div>
        
        {/* Stats badges */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{
            padding: '6px 12px',
            background: 'rgba(231, 76, 60, 0.1)',
            border: '1px solid rgba(231, 76, 60, 0.2)',
            borderRadius: '8px',
            fontSize: '10px',
          }}>
            <span style={{ color: '#888' }}>Max: </span>
            <span style={{ color: COLORS.red, fontWeight: '600', fontFamily: 'monospace' }}>
              {(stats.maxCov * 100).toFixed(2)}%
            </span>
          </div>
          <div style={{
            padding: '6px 12px',
            background: 'rgba(46, 204, 113, 0.1)',
            border: '1px solid rgba(46, 204, 113, 0.2)',
            borderRadius: '8px',
            fontSize: '10px',
          }}>
            <span style={{ color: '#888' }}>Min: </span>
            <span style={{ color: COLORS.green, fontWeight: '600', fontFamily: 'monospace' }}>
              {(stats.minCov * 100).toFixed(2)}%
            </span>
          </div>
          <div style={{
            padding: '6px 12px',
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '8px',
            fontSize: '10px',
          }}>
            <span style={{ color: '#888' }}>Avg: </span>
            <span style={{ color: COLORS.cyan, fontWeight: '600', fontFamily: 'monospace' }}>
              {(stats.avgCov * 100).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Matrix Table */}
      <div className="styled-scrollbar" style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <table style={{
          borderCollapse: 'separate',
          borderSpacing: '2px',
          width: '100%',
          minWidth: `${tableMinWidth}px`,
          fontFamily: FONT_FAMILY,
        }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 12px',
                textAlign: 'left',
                fontSize: '10px',
                color: '#666',
                fontWeight: '600',
                minWidth: `${baseCellWidth}px`,
              }}>
                σᵢσⱼρ
              </th>
              {tickers.map((t, i) => (
                <th key={i} style={{
                  padding: '8px 12px',
                  textAlign: 'center',
                  minWidth: `${baseCellWidth}px`,
                  fontSize: '10px',
                  color: '#888',
                  fontWeight: '600',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                }}>
                  {t}
                  <div style={{ fontSize: '8px', color: '#666', fontWeight: '500', marginTop: '2px' }}>
                    σ={Math.round(stats.vols[i] * 100)}%
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((rowTicker, i) => (
              <tr key={i}>
                <td style={{ 
                  padding: '8px 12px',
                  fontWeight: '600',
                  fontSize: '11px',
                  color: '#aaa',
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '6px',
                }}>
                  {rowTicker}
                </td>
                {tickers.map((_, j) => {
                  const cov = covMatrix[i][j];
                  const isVariance = i === j;
                  return (
                    <td 
                      key={j} 
                      style={{ 
                        padding: '8px 12px',
                        textAlign: 'center',
                        background: getCovColor(cov, isVariance),
                        borderRadius: '6px',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <span style={{ 
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: isVariance ? COLORS.cyan : cov > 0 ? '#f1a9a0' : cov < 0 ? '#a8e6cf' : '#888',
                        fontWeight: isVariance ? '600' : '500',
                      }}>
                        {(cov * 100).toFixed(2)}%
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer note */}
      <div style={{
        marginTop: '12px',
        padding: '10px 12px',
        background: 'rgba(155, 89, 182, 0.08)',
        borderRadius: '8px',
        border: '1px solid rgba(155, 89, 182, 0.15)',
        fontSize: '10px',
        color: '#888',
      }}>
        <strong style={{ color: COLORS.purple }}>Note:</strong> Diagonal entries are variances (σ²). 
        Off-diagonal entries show how assets co-vary. 
        <span style={{ color: COLORS.red }}> Red = positive covariance (move together)</span>, 
        <span style={{ color: COLORS.green }}> Green = negative covariance (hedge)</span>.
      </div>
    </div>
  );
});
const CorrelationTab = ({
  // Core data
  positions,
  historicalData,
  unifiedMarketData,
  
  // Correlation state
  correlationMatrix,
  editedCorrelation,
  correlationMethod,
  setCorrelationMethod,
  useEwma,
  setUseEwma,
  gldAsCash,
  setGldAsCash,
  
  // Timeline
  historyTimeline,
  setHistoryTimeline,
  
  // Data source info
  dataSource,
  fetchErrors,
  isFetchingData,
  
  // Correlation groups
  correlationGroups,
  setCorrelationGroups,
  positionMetadata,
  isFetchingMetadata,
  
  // Lag analysis
  lagAnalysis,
  setLagAnalysis,
  isAnalyzingLag,
  useLagAdjusted,
  setUseLagAdjusted,
  
  // View mode
  matrixViewMode,
  setMatrixViewMode,
  
  // Callbacks
  fetchAndComputeCorrelation,
  updateCorrelationCell,
  applyEdits,
  resetCorrelation,
  runLagAnalysis,
  applyLagAdjustedCorrelations,
  fetchAllMetadata,
  applyCorrelationFloors,
  getDistributionParams,
  getCorrelationColor,
  showToast,
  
  // Styles
  styles,
}) => {
  const tickers = positions.map(p => p.ticker).filter(t => t);
  
  // Calculate data quality info
  const dataInfo = tickers.map(t => {
    const data = historicalData[t.toUpperCase()];
    return {
      ticker: t,
      source: data?.source || 'none',
      days: data?.returns?.length || 0,
    };
  }).sort((a, b) => a.days - b.days);
  
  // Find minimum and limiting ticker
  const minDays = dataInfo.length > 0 ? dataInfo[0].days : 0;
  const limitingTicker = dataInfo.length > 0 ? dataInfo[0].ticker : null;
  const targetDays = {
    '6mo': 126,
    '1y': 252,
    '2y': 504,
    '3y': 756,
  }[historyTimeline] || 252;

  // Dynamic table sizing based on ticker count (similar to Swap heatmap)
  // Use larger minimum widths to prevent ticker names from being cut off
  const n = tickers.length;
  const baseCellWidth = n <= 5 ? 80 : n <= 8 ? 72 : n <= 12 ? 65 : 58;
  const tableMinWidth = (n + 2) * baseCellWidth; // +2 for row headers and potential summary col

  // Helper to get position display name (handles duplicates)
  const getPositionDisplayName = (posId) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return 'Unknown';
    
    const ticker = pos.ticker?.toUpperCase();
    const duplicates = positions.filter(p => p.ticker?.toUpperCase() === ticker);
    
    if (duplicates.length > 1) {
      const idx = duplicates.findIndex(p => p.id === posId) + 1;
      return `${pos.ticker} #${idx}`;
    }
    return pos.ticker || 'Unknown';
  };
  
  // Render the correlation summary view
  const renderSummaryView = () => {
    // Calculate value-weighted average correlation for each position
    const positionValues = positions.map(p => p.quantity * p.price);
    const totalValue = positionValues.reduce((a, b) => a + Math.abs(b), 0);
    const weights = positionValues.map(v => Math.abs(v) / (totalValue || 1));
    
    // For each position, calculate weighted avg correlation with rest of portfolio
    const summaryData = positions.map((pos, i) => {
      const ticker = pos.ticker || `Pos ${i+1}`;
      const value = positionValues[i];
      const weight = weights[i];
      
      // Sum of weighted correlations with all OTHER positions
      let weightedCorrSum = 0;
      let totalOtherWeight = 0;
      let maxCorr = { value: -Infinity, ticker: '' };
      let minCorr = { value: Infinity, ticker: '' };
      
      for (let j = 0; j < positions.length; j++) {
        if (i === j) continue;
        const corr = editedCorrelation[i]?.[j] ?? 0;
        const otherWeight = weights[j];
        weightedCorrSum += corr * otherWeight;
        totalOtherWeight += otherWeight;
        
        if (corr > maxCorr.value) {
          maxCorr = { value: corr, ticker: positions[j].ticker || `Pos ${j+1}` };
        }
        if (corr < minCorr.value) {
          minCorr = { value: corr, ticker: positions[j].ticker || `Pos ${j+1}` };
        }
      }
      
      const avgCorr = totalOtherWeight > 0 ? weightedCorrSum / totalOtherWeight : 0;
      
      // Simple average (unweighted) for comparison
      let simpleSum = 0;
      let count = 0;
      for (let j = 0; j < positions.length; j++) {
        if (i === j) continue;
        simpleSum += editedCorrelation[i]?.[j] ?? 0;
        count++;
      }
      const simpleAvgCorr = count > 0 ? simpleSum / count : 0;
      
      return {
        ticker,
        value,
        weight,
        avgCorr,
        simpleAvgCorr,
        maxCorr,
        minCorr,
      };
    });
    
    // Sort by weighted avg correlation (most correlated first)
    const sorted = [...summaryData].sort((a, b) => b.avgCorr - a.avgCorr);
    
    // Portfolio-level weighted average correlation
    let portfolioAvgCorr = 0;
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const corr = editedCorrelation[i]?.[j] ?? 0;
        const pairWeight = weights[i] * weights[j] * 2;
        portfolioAvgCorr += corr * pairWeight;
      }
    }
    
    const getCorrColor = (corr) => {
      if (corr >= 0.7) return COLORS.red;
      if (corr >= 0.5) return COLORS.orange;
      if (corr >= 0.3) return COLORS.yellow;
      if (corr >= 0) return COLORS.green;
      return COLORS.cyan;
    };
    
    const getCorrBg = (corr) => {
      if (corr >= 0.7) return 'rgba(231, 76, 60, 0.15)';
      if (corr >= 0.5) return 'rgba(255, 159, 67, 0.15)';
      if (corr >= 0.3) return 'rgba(241, 196, 15, 0.15)';
      if (corr >= 0) return 'rgba(46, 204, 113, 0.15)';
      return 'rgba(0, 212, 255, 0.15)';
    };
    
    const getInterpretation = (corr) => {
      if (corr >= 0.7) return { icon: '⚠️', text: 'Highly concentrated', desc: 'Positions move together' };
      if (corr >= 0.5) return { icon: '📊', text: 'Moderately correlated', desc: 'Some diversification' };
      if (corr >= 0.3) return { icon: '✓', text: 'Well diversified', desc: 'Good mix' };
      if (corr >= 0) return { icon: '🎯', text: 'Highly diversified', desc: 'Low correlation' };
      return { icon: '🔄', text: 'Negative correlation', desc: 'Natural hedge' };
    };
    
    const interpretation = getInterpretation(portfolioAvgCorr);
    
    // Find most and least diversifying positions
    const mostDiversifying = sorted[sorted.length - 1];
    const leastDiversifying = sorted[0];
    
    return (
      <div>
        {/* Portfolio-level summary - Premium Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '20px',
        }}>
          {/* Main Portfolio Correlation Card */}
          <div style={{
            gridColumn: 'span 2',
            padding: '20px',
            background: `linear-gradient(135deg, ${getCorrBg(portfolioAvgCorr).replace('0.15', '0.2')} 0%, rgba(0,0,0,0.3) 100%)`,
            borderRadius: '14px',
            border: `1px solid ${getCorrColor(portfolioAvgCorr)}30`,
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `${getCorrColor(portfolioAvgCorr)}15`,
              borderRadius: '50%',
              border: `3px solid ${getCorrColor(portfolioAvgCorr)}40`,
            }}>
              <span style={{ 
                fontSize: '28px', 
                fontWeight: 'bold', 
                color: getCorrColor(portfolioAvgCorr),
                fontFamily: 'monospace',
              }}>
                {portfolioAvgCorr.toFixed(2)}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>
                Portfolio Average Correlation
              </div>
              <div style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                color: getCorrColor(portfolioAvgCorr),
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <span>{interpretation.icon}</span>
                <span>{interpretation.text}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                {interpretation.desc} — Value-weighted pairwise average
              </div>
            </div>
          </div>
          
          {/* Most Diversifying Card */}
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(46, 204, 113, 0.2)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              🏆 Most Diversifying
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>
              {mostDiversifying?.ticker}
            </div>
            <div style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: COLORS.green,
              fontFamily: 'monospace',
            }}>
              {mostDiversifying?.avgCorr >= 0 ? '+' : ''}{mostDiversifying?.avgCorr.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>
              avg correlation to portfolio
            </div>
          </div>
          
          {/* Least Diversifying Card */}
          <div style={{
            padding: '16px',
            background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(231, 76, 60, 0.2)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              ⚠️ Most Correlated
            </div>
            <div style={{ fontSize: '16px', fontWeight: '600', color: '#fff' }}>
              {leastDiversifying?.ticker}
            </div>
            <div style={{ 
              fontSize: '20px', 
              fontWeight: '700', 
              color: COLORS.red,
              fontFamily: 'monospace',
            }}>
              {leastDiversifying?.avgCorr >= 0 ? '+' : ''}{leastDiversifying?.avgCorr.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>
              avg correlation to portfolio
            </div>
          </div>
        </div>
        
        {/* Per-position breakdown - Premium Table */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'rgba(0, 0, 0, 0.3)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Position</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', color: '#888', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Weight</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#888', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Weighted Avg ρ</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', color: '#888', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Simple Avg</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Highest With</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#888', fontWeight: '600', fontSize: '10px', textTransform: 'uppercase' }}>Lowest With</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item, idx) => (
                <tr 
                  key={idx} 
                  style={{ 
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0, 212, 255, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: getCorrBg(item.avgCorr),
                        borderRadius: '6px',
                        fontSize: '10px',
                        fontWeight: '600',
                        color: getCorrColor(item.avgCorr),
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: '600', color: '#fff' }}>{item.ticker}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#888', fontFamily: 'monospace' }}>
                    {(item.weight * 100).toFixed(1)}%
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{ 
                      display: 'inline-block',
                      padding: '4px 10px',
                      background: getCorrBg(item.avgCorr),
                      borderRadius: '6px',
                      color: getCorrColor(item.avgCorr), 
                      fontWeight: '600',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}>
                      {item.avgCorr >= 0 ? '+' : ''}{item.avgCorr.toFixed(2)}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: '#666', fontFamily: 'monospace', fontSize: '11px' }}>
                    {item.simpleAvgCorr >= 0 ? '+' : ''}{item.simpleAvgCorr.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '11px' }}>
                    <span style={{ color: getCorrColor(item.maxCorr.value), fontWeight: '500' }}>
                      {item.maxCorr.ticker}
                    </span>
                    <span style={{ color: '#555', fontFamily: 'monospace', marginLeft: '4px' }}>
                      ({item.maxCorr.value >= 0 ? '+' : ''}{item.maxCorr.value.toFixed(2)})
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '11px' }}>
                    <span style={{ color: getCorrColor(item.minCorr.value), fontWeight: '500' }}>
                      {item.minCorr.ticker}
                    </span>
                    <span style={{ color: '#555', fontFamily: 'monospace', marginLeft: '4px' }}>
                      ({item.minCorr.value >= 0 ? '+' : ''}{item.minCorr.value.toFixed(2)})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer note */}
        <div style={{ 
          marginTop: '12px', 
          padding: '10px 14px',
          background: 'rgba(0, 212, 255, 0.05)',
          borderRadius: '8px',
          border: '1px solid rgba(0, 212, 255, 0.1)',
          fontSize: '10px', 
          color: '#666',
          display: 'flex',
          gap: '16px',
        }}>
          <span>
            <strong style={{ color: COLORS.cyan }}>Weighted Avg ρ:</strong> Correlation weighted by other positions' sizes
          </span>
          <span>
            <strong style={{ color: '#888' }}>Simple Avg:</strong> Unweighted average (each position equal)
          </span>
        </div>
      </div>
    );
  };
  
  // Render the beta view
  const renderBetaView = () => {
    // Calculate annualized volatilities for each position
    const vols = positions.map(pos => {
      const params = getDistributionParams(pos);
      return params.sigma || 0.2;
    });
    
    // Calculate stats for summary
    const betaStats = (() => {
      let maxBeta = { value: -Infinity, from: '', to: '' };
      let minBeta = { value: Infinity, from: '', to: '' };
      let highLeverageCount = 0;
      
      for (let i = 0; i < tickers.length; i++) {
        for (let j = 0; j < tickers.length; j++) {
          if (i === j) continue;
          const corr = editedCorrelation[i]?.[j] ?? 0;
          const beta = vols[j] > 0 ? corr * (vols[i] / vols[j]) : 0;
          
          if (beta > maxBeta.value) {
            maxBeta = { value: beta, from: tickers[j], to: tickers[i] };
          }
          if (beta < minBeta.value) {
            minBeta = { value: beta, from: tickers[j], to: tickers[i] };
          }
          if (Math.abs(beta) >= 2.0) highLeverageCount++;
        }
      }
      
      return { maxBeta, minBeta, highLeverageCount };
    })();
    
    const getBetaColor = (beta) => {
      const absBeta = Math.abs(beta);
      if (absBeta >= 2.5) return { bg: 'rgba(155, 89, 182, 0.6)', text: '#d8b4fe' };
      if (absBeta >= 2.0) return { bg: 'rgba(231, 76, 60, 0.5)', text: '#fca5a5' };
      if (absBeta >= 1.5) return { bg: 'rgba(253, 126, 20, 0.45)', text: '#fdba74' };
      if (absBeta >= 1.0) return { bg: 'rgba(255, 193, 7, 0.4)', text: '#fde047' };
      if (absBeta >= 0.5) return { bg: 'rgba(52, 152, 219, 0.35)', text: '#93c5fd' };
      return { bg: 'rgba(46, 204, 113, 0.3)', text: '#86efac' };
    };
    
    return (
      <div>
        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(155, 89, 182, 0.25)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              🚀 Highest Beta
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.purple, fontFamily: 'monospace' }}>
              {betaStats.maxBeta.value >= 0 ? '+' : ''}{betaStats.maxBeta.value.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#888' }}>
              {betaStats.maxBeta.to} to {betaStats.maxBeta.from}
            </div>
          </div>
          
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(0, 212, 255, 0.25)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              🛡️ Lowest Beta
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.cyan, fontFamily: 'monospace' }}>
              {betaStats.minBeta.value >= 0 ? '+' : ''}{betaStats.minBeta.value.toFixed(2)}
            </div>
            <div style={{ fontSize: '10px', color: '#888' }}>
              {betaStats.minBeta.to} to {betaStats.minBeta.from}
            </div>
          </div>
          
          <div style={{
            padding: '14px 16px',
            background: betaStats.highLeverageCount > 0 
              ? 'linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)'
              : 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: `1px solid ${betaStats.highLeverageCount > 0 ? 'rgba(231, 76, 60, 0.25)' : 'rgba(46, 204, 113, 0.25)'}`,
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              ⚠️ High Leverage (|β|≥2)
            </div>
            <div style={{ 
              fontSize: '22px', 
              fontWeight: '700', 
              color: betaStats.highLeverageCount > 0 ? COLORS.red : COLORS.green, 
              fontFamily: 'monospace' 
            }}>
              {betaStats.highLeverageCount}
            </div>
            <div style={{ fontSize: '10px', color: '#888' }}>
              pairs with extreme sensitivity
            </div>
          </div>
        </div>
        
        {/* Beta Matrix */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }}>
          <table style={{
            borderCollapse: 'separate',
            borderSpacing: '2px',
            width: '100%',
            minWidth: `${tableMinWidth}px`,
            fontFamily: FONT_FAMILY,
            margin: '8px',
          }}>
            <thead>
              <tr>
                <th style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '10px',
                  color: '#888',
                  fontWeight: '600',
                  minWidth: `${baseCellWidth}px`,
                }}>
                  β to →
                </th>
                {tickers.map((t, i) => (
                  <th key={i} style={{
                    padding: '10px 12px',
                    textAlign: 'center',
                    minWidth: `${baseCellWidth}px`,
                    fontSize: '10px',
                    color: '#aaa',
                    fontWeight: '600',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                  }}>
                    {t}
                    <div style={{ fontSize: '8px', color: '#666', fontWeight: '500', marginTop: '2px' }}>
                      σ={Math.round(vols[i] * 100)}%
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickers.map((rowTicker, i) => (
                <tr key={i}>
                  <td style={{ 
                    padding: '10px 12px',
                    fontWeight: '600',
                    fontSize: '11px',
                    color: '#aaa',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                  }}>
                    {rowTicker}
                    <span style={{ fontSize: '8px', color: '#666', marginLeft: '4px' }}>
                      (σ={Math.round(vols[i] * 100)}%)
                    </span>
                  </td>
                  {tickers.map((_, j) => {
                    if (i === j) {
                      return (
                        <td key={j} style={{ 
                          padding: '10px 12px',
                          textAlign: 'center',
                          background: 'rgba(255,255,255,0.08)', 
                          borderRadius: '6px',
                        }}>
                          <span style={{ color: '#666', fontFamily: 'monospace', fontSize: '11px' }}>1.00</span>
                        </td>
                      );
                    }
                    
                    const corr = editedCorrelation[i]?.[j] ?? 0;
                    const beta = vols[j] > 0 ? corr * (vols[i] / vols[j]) : 0;
                    const colors = getBetaColor(beta);
                    
                    return (
                      <td 
                        key={j} 
                        style={{ 
                          padding: '10px 12px',
                          textAlign: 'center',
                          background: colors.bg,
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                          cursor: 'help',
                        }}
                        title={`When ${tickers[j]} moves 1%, ${rowTicker} moves ${beta.toFixed(2)}%`}
                      >
                        <span style={{ 
                          color: colors.text,
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          fontWeight: Math.abs(beta) >= 1.5 ? '600' : '500',
                        }}>
                          {beta >= 0 ? '+' : ''}{beta.toFixed(2)}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Legend */}
        <div style={{
          marginTop: '12px',
          padding: '12px 14px',
          background: 'rgba(255, 159, 67, 0.08)',
          borderRadius: '10px',
          border: '1px solid rgba(255, 159, 67, 0.15)',
          fontSize: '10px',
          color: '#888',
        }}>
          <strong style={{ color: COLORS.orange }}>Reading:</strong> Each cell = how much <em>Row</em> moves when <em>Column</em> moves 1%. 
          β = ρ × (σ<sub>row</sub> / σ<sub>col</sub>). 
          <span style={{ color: '#d8b4fe', marginLeft: '8px' }}>■ Purple (≥2.5)</span>
          <span style={{ color: '#fca5a5', marginLeft: '8px' }}>■ Red (≥2.0)</span>
          <span style={{ color: '#fdba74', marginLeft: '8px' }}>■ Orange (≥1.5)</span>
          = high leverage
        </div>
      </div>
    );
  };
  
  // Render volatility comparison view
  const renderVolatilityView = () => {
    const vols = positions.map(pos => {
      const params = getDistributionParams(pos);
      return params.sigma || 0.2;
    });
    
    const maxVol = Math.max(...vols);
    const minVol = Math.min(...vols);
    const avgVol = vols.reduce((a, b) => a + b, 0) / vols.length;
    
    // Find most and least volatile
    const maxVolIdx = vols.indexOf(maxVol);
    const minVolIdx = vols.indexOf(minVol);
    
    const getVolColor = (vol) => {
      const normalized = (vol - minVol) / (maxVol - minVol || 1);
      if (normalized >= 0.8) return COLORS.red;
      if (normalized >= 0.6) return COLORS.orange;
      if (normalized >= 0.4) return COLORS.yellow;
      if (normalized >= 0.2) return COLORS.cyan;
      return COLORS.green;
    };
    
    return (
      <div>
        {/* Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(231, 76, 60, 0.25)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              🔥 Highest σ
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.red, fontFamily: 'monospace' }}>
              {Math.round(maxVol * 100)}%
            </div>
            <div style={{ fontSize: '11px', color: '#fff', fontWeight: '500' }}>
              {tickers[maxVolIdx]}
            </div>
          </div>
          
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(46, 204, 113, 0.25)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              🛡️ Lowest σ
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.green, fontFamily: 'monospace' }}>
              {Math.round(minVol * 100)}%
            </div>
            <div style={{ fontSize: '11px', color: '#fff', fontWeight: '500' }}>
              {tickers[minVolIdx]}
            </div>
          </div>
          
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(0, 212, 255, 0.25)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              📊 Average σ
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.cyan, fontFamily: 'monospace' }}>
              {Math.round(avgVol * 100)}%
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>
              across {tickers.length} positions
            </div>
          </div>
          
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)',
            borderRadius: '12px',
            border: '1px solid rgba(155, 89, 182, 0.25)',
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '6px' }}>
              📈 Vol Spread
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.purple, fontFamily: 'monospace' }}>
              {(maxVol / minVol).toFixed(1)}x
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>
              highest / lowest
            </div>
          </div>
        </div>
        
        {/* Volatility Bar Chart */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '16px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '12px', fontWeight: '600' }}>
            ANNUALIZED VOLATILITY BY POSITION (RANKED)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Sort by volatility descending */}
            {tickers
              .map((ticker, i) => ({ ticker, vol: vols[i], idx: i }))
              .sort((a, b) => b.vol - a.vol)
              .map(({ ticker, vol, idx }, rank) => {
              const width = maxVol > 0 ? (vol / maxVol) * 100 : 0;
              const color = getVolColor(vol);
              
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ 
                    width: '20px',
                    fontSize: '10px',
                    fontWeight: '600',
                    color: rank === 0 ? COLORS.red : rank === tickers.length - 1 ? COLORS.green : '#666',
                    textAlign: 'right',
                  }}>
                    #{rank + 1}
                  </div>
                  <div style={{ 
                    width: '50px', 
                    fontSize: '11px', 
                    fontWeight: '500', 
                    color: '#aaa',
                    textAlign: 'right',
                  }}>
                    {ticker}
                  </div>
                  <div style={{ 
                    flex: 1, 
                    height: '24px', 
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <div style={{
                      width: `${width}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${color}60, ${color})`,
                      borderRadius: '6px',
                      transition: 'width 0.5s ease',
                    }} />
                    <div style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '10px',
                      fontWeight: '600',
                      color: '#fff',
                      fontFamily: 'monospace',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    }}>
                      {Math.round(vol * 100)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Volatility Ratio Matrix */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }}>
          <div style={{ 
            padding: '12px 16px', 
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '11px',
            color: '#888',
            fontWeight: '600',
          }}>
            VOLATILITY RATIOS (σ_row / σ_col)
          </div>
          <table style={{
            borderCollapse: 'separate',
            borderSpacing: '2px',
            width: '100%',
            minWidth: `${tableMinWidth}px`,
            fontFamily: FONT_FAMILY,
            margin: '8px',
          }}>
            <thead>
              <tr>
                <th style={{
                  padding: '10px 12px',
                  textAlign: 'left',
                  fontSize: '10px',
                  color: '#888',
                  fontWeight: '600',
                  minWidth: `${baseCellWidth}px`,
                }}>
                  σ vs →
                </th>
                {tickers.map((t, i) => (
                  <th key={i} style={{
                    padding: '10px 12px',
                    textAlign: 'center',
                    minWidth: `${baseCellWidth}px`,
                    fontSize: '10px',
                    color: '#aaa',
                    fontWeight: '600',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                  }}>
                    {t}
                    <div style={{ fontSize: '8px', color: '#666', fontWeight: '500', marginTop: '2px' }}>
                      σ={Math.round(vols[i] * 100)}%
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickers.map((rowTicker, i) => (
                <tr key={i}>
                  <td style={{ 
                    padding: '10px 12px',
                    fontWeight: '600',
                    fontSize: '11px',
                    color: '#aaa',
                    background: 'rgba(0, 0, 0, 0.3)',
                    borderRadius: '6px',
                  }}>
                    {rowTicker}
                    <span style={{ fontSize: '8px', color: '#666', marginLeft: '4px' }}>
                      (σ={Math.round(vols[i] * 100)}%)
                    </span>
                  </td>
                  {tickers.map((_, j) => {
                    if (i === j) {
                      return (
                        <td key={j} style={{ 
                          padding: '10px 12px',
                          textAlign: 'center',
                          background: 'rgba(0, 212, 255, 0.15)', 
                          borderRadius: '6px',
                        }}>
                          <span style={{ color: COLORS.cyan, fontWeight: 'bold', fontFamily: 'monospace', fontSize: '12px' }}>
                            {Math.round(vols[i] * 100)}%
                          </span>
                        </td>
                      );
                    }
                    
                    const ratio = vols[j] > 0 ? vols[i] / vols[j] : 1;
                    const ratioColor = ratio >= 2 ? COLORS.red : 
                                       ratio >= 1.5 ? COLORS.orange : 
                                       ratio >= 1 ? COLORS.yellow : 
                                       ratio >= 0.67 ? COLORS.green : COLORS.cyan;
                    const ratioBg = ratio > 1 
                      ? `rgba(231, 76, 60, ${Math.min(0.4, (ratio - 1) * 0.2)})`
                      : `rgba(46, 204, 113, ${Math.min(0.4, (1 - ratio) * 0.3)})`;
                    
                    return (
                      <td 
                        key={j} 
                        style={{ 
                          padding: '10px 12px',
                          textAlign: 'center',
                          background: ratioBg,
                          borderRadius: '6px',
                          transition: 'background 0.2s ease',
                          cursor: 'help',
                        }}
                        title={`${rowTicker} volatility is ${ratio.toFixed(2)}x ${tickers[j]}'s volatility`}
                      >
                        <span style={{ color: ratioColor, fontFamily: 'monospace', fontSize: '11px', fontWeight: '500' }}>
                          {ratio.toFixed(2)}x
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Footer note */}
        <div style={{
          marginTop: '12px',
          padding: '10px 14px',
          background: 'rgba(46, 204, 113, 0.08)',
          borderRadius: '10px',
          border: '1px solid rgba(46, 204, 113, 0.15)',
          fontSize: '10px',
          color: '#888',
        }}>
          <strong style={{ color: COLORS.green }}>Tip:</strong> Higher volatility = more torque when combined with correlation. 
          A 2x volatility ratio means the row asset moves 2x as much as the column asset in absolute terms.
        </div>
      </div>
    );
  };
  
  return (
    <div>
      <div style={styles.card}>
        <div style={{ ...styles.flexRow, justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={styles.cardTitle}>
            <span>🔗</span> Correlation Matrix
          </div>
          <div style={styles.flexRow}>
            <select
              style={styles.select}
              value={correlationMethod}
              onChange={(e) => setCorrelationMethod(e.target.value)}
            >
              <option value="sample">Sample Correlation</option>
              <option value="shrinkage">Ledoit-Wolf Shrinkage</option>
            </select>
            
            {/* EWMA Recency Toggle */}
            <label style={styles.toggle}>
              <div 
                style={{
                  ...styles.toggleSwitch,
                  ...(useEwma ? styles.toggleSwitchActive : {})
                }}
                onClick={() => setUseEwma(!useEwma)}
                title={useEwma ? `EWMA enabled: weights recent data more heavily (auto-scaled to ${historyTimeline})` : 'Enable EWMA to emphasize recent correlations'}
              >
                <div style={{
                  ...styles.toggleKnob,
                  ...(useEwma ? styles.toggleKnobActive : {})
                }} />
              </div>
              <span style={{ fontSize: '12px' }}>Recency Weighted</span>
            </label>
            
            <label style={styles.toggle}>
              <div 
                style={{
                  ...styles.toggleSwitch,
                  ...(gldAsCash ? styles.toggleSwitchActive : {})
                }}
                onClick={() => setGldAsCash(!gldAsCash)}
              >
                <div style={{
                  ...styles.toggleKnob,
                  ...(gldAsCash ? styles.toggleKnobActive : {})
                }} />
              </div>
              GLD as Cash
            </label>
          </div>
        </div>
        
        <div style={styles.infoBox}>
          <strong>Compute Correlations:</strong> Uses data loaded via "🚀 Load All Data" in the header.
          Select a history period below and click "Compute Correlation" to generate the matrix.
        </div>
        
        <div style={{ ...styles.flexRow, marginBottom: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#888' }}>History Period:</span>
          {[
            { id: '6mo', label: '6 Months' },
            { id: '1y', label: '1 Year' },
            { id: '2y', label: '2 Years' },
            { id: '3y', label: '3 Years' },
          ].map(period => (
            <button
              key={period.id}
              onClick={() => {
                setHistoryTimeline(period.id);
                setLagAnalysis(null);
                setUseLagAdjusted(false);
              }}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                borderRadius: '6px',
                border: historyTimeline === period.id 
                  ? '1px solid rgba(0, 212, 255, 0.5)' 
                  : '1px solid rgba(255,255,255,0.1)',
                background: historyTimeline === period.id 
                  ? 'rgba(0, 212, 255, 0.15)' 
                  : 'rgba(255,255,255,0.05)',
                color: historyTimeline === period.id ? '#00d4ff' : '#888',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
        
        <div style={styles.flexRow}>
          <button
            style={{ ...styles.button, opacity: isFetchingData ? 0.7 : 1 }}
            onClick={() => fetchAndComputeCorrelation()}
            disabled={isFetchingData || Object.keys(unifiedMarketData).length === 0}
            title={Object.keys(unifiedMarketData).length === 0 ? 'Click "Load All Data" first' : 'Press Enter to compute correlation'}
          >
            {isFetchingData ? '⏳ Computing...' : (
              <>
                🔗 Compute {historyTimeline === '6mo' ? '6mo' : historyTimeline === '3y' ? '3yr' : historyTimeline === '2y' ? '2yr' : '1yr'} Correlation
                <kbd style={{ 
                  marginLeft: '8px', 
                  padding: '2px 6px', 
                  fontSize: '9px', 
                  background: 'rgba(255,255,255,0.15)', 
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontFamily: 'inherit',
                }}>Enter</kbd>
              </>
            )}
          </button>
          {Object.keys(unifiedMarketData).length === 0 && (
            <span style={{ fontSize: '11px', color: '#ff9f43', marginLeft: '8px' }}>
              ⚠️ Click "🚀 Load All Data" first
            </span>
          )}
          <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={applyEdits}>
            ✓ Validate Matrix (PSD Fix)
          </button>
          <button style={{ ...styles.button, ...styles.buttonSecondary }} onClick={resetCorrelation}>
            ↺ Reset
          </button>
        </div>
        
        {/* Data source indicator */}
        {dataSource !== 'none' && (
          <div style={{
            marginTop: '16px',
            padding: '12px',
            background: dataSource === 'worker' ? 'rgba(0, 212, 255, 0.1)' :
                        dataSource === 'yahoo' ? 'rgba(46, 204, 113, 0.1)' :
                        dataSource === 'mixed' ? 'rgba(255, 159, 67, 0.1)' :
                        'rgba(231, 76, 60, 0.1)',
            border: `1px solid ${dataSource === 'worker' ? 'rgba(0, 212, 255, 0.3)' :
                                 dataSource === 'yahoo' ? 'rgba(46, 204, 113, 0.3)' :
                                 dataSource === 'mixed' ? 'rgba(255, 159, 67, 0.3)' :
                                 'rgba(231, 76, 60, 0.3)'}`,
            borderRadius: '8px',
            fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                fontSize: '16px',
                color: dataSource === 'worker' ? '#00d4ff' :
                       dataSource === 'yahoo' ? '#2ecc71' :
                       dataSource === 'mixed' ? '#ff9f43' : '#e74c3c'
              }}>
                {dataSource === 'worker' ? '⚡' : dataSource === 'yahoo' ? '✓' : dataSource === 'mixed' ? '⚠' : '✗'}
              </span>
              <strong style={{
                color: dataSource === 'worker' ? '#00d4ff' :
                       dataSource === 'yahoo' ? '#2ecc71' :
                       dataSource === 'mixed' ? '#ff9f43' : '#e74c3c'
              }}>
                {dataSource === 'worker' ? 'Cached from Cloudflare Worker (Simple Pearson)' :
                 dataSource === 'yahoo' ? 'Live Yahoo Finance Data (Pairwise Max Overlap)' :
                 dataSource === 'mixed' ? 'Mixed Data Sources' :
                 'Mock/Synthetic Data'}
              </strong>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {dataInfo.map(d => {
                const isLimited = d.days < targetDays;
                return (
                  <span key={d.ticker} style={{ 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    background: d.source === 'yahoo' ? 'rgba(46, 204, 113, 0.2)' : 
                                d.source === 'mock' ? 'rgba(255, 159, 67, 0.2)' : 
                                'rgba(231, 76, 60, 0.2)',
                    color: d.source === 'yahoo' ? '#2ecc71' : 
                           d.source === 'mock' ? '#ff9f43' : '#e74c3c',
                    border: isLimited ? '1px solid rgba(255, 159, 67, 0.5)' : 'none',
                  }}>
                    {d.ticker}: {d.days} days{isLimited ? ` (< ${targetDays})` : ''}
                  </span>
                );
              })}
            </div>
            {minDays > 0 && minDays < targetDays && (
              <div style={{ 
                marginTop: '8px', 
                padding: '8px', 
                background: 'rgba(0, 212, 255, 0.1)', 
                borderRadius: '4px',
                fontSize: '11px',
                color: '#00d4ff',
              }}>
                ℹ️ <strong>Pairwise Max Overlap:</strong> {limitingTicker} has only {minDays} days of data.
                Correlations involving {limitingTicker} use {minDays} days, while pairs of longer-history tickers use up to {targetDays} days.
              </div>
            )}
          </div>
        )}
        
        {/* Fetch errors */}
        {fetchErrors.length > 0 && (
          <div style={{ 
            marginTop: '12px', 
            padding: '8px 12px', 
            background: 'rgba(255, 159, 67, 0.1)',
            border: '1px solid rgba(255, 159, 67, 0.3)',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#ff9f43',
          }}>
            {fetchErrors.map((err, i) => (
              <div key={i}>⚠ {err}</div>
            ))}
          </div>
        )}
        
        {/* Timezone/Lag Analysis Section */}
        <div style={{ 
          marginTop: '20px', 
          padding: '16px', 
          background: 'rgba(155, 89, 182, 0.05)',
          border: '1px solid rgba(155, 89, 182, 0.2)',
          borderRadius: '8px',
        }}>
          <div style={{ ...styles.cardTitle, fontSize: '14px', marginBottom: '12px' }}>
            🕐 Timezone Lag Analysis (International Stocks)
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            International stocks (e.g., 6525.T from Tokyo) close at different times than US stocks.
            This can cause <strong>underestimated correlations</strong> when comparing "same day" returns.
            Lag analysis computes correlations at -1, 0, and +1 day offsets to find the true maximum.
          </div>
          
          <div style={{ ...styles.flexRow, marginBottom: '16px', gap: '12px' }}>
            <button
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                opacity: isAnalyzingLag ? 0.7 : 1,
                background: 'rgba(155, 89, 182, 0.2)',
                borderColor: 'rgba(155, 89, 182, 0.5)',
              }}
              onClick={() => runLagAnalysis()}
              disabled={isAnalyzingLag || !Object.keys(historicalData).length}
            >
              {isAnalyzingLag ? '⏳ Analyzing...' : '🔍 Run Lag Analysis'}
            </button>

            {lagAnalysis && lagAnalysis.significantCount > 0 && (
              <button
                style={{
                  ...styles.button,
                  background: useLagAdjusted ? 'rgba(46, 204, 113, 0.3)' : 'rgba(155, 89, 182, 0.3)',
                  borderColor: useLagAdjusted ? 'rgba(46, 204, 113, 0.5)' : 'rgba(155, 89, 182, 0.5)',
                }}
                onClick={() => applyLagAdjustedCorrelations()}
                disabled={useLagAdjusted}
              >
                {useLagAdjusted ? '✓ Lag Adjustment Applied' : '⚡ Apply Lag-Adjusted Correlations'}
              </button>
            )}
          </div>
          
          {/* Lag Analysis Results */}
          {lagAnalysis && (
            <div>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                marginBottom: '12px',
                padding: '8px 12px',
                background: lagAnalysis.significantCount > 0 
                  ? 'rgba(255, 159, 67, 0.1)' 
                  : 'rgba(46, 204, 113, 0.1)',
                borderRadius: '6px',
                fontSize: '12px',
              }}>
                <span style={{ fontSize: '16px' }}>
                  {lagAnalysis.significantCount > 0 ? '⚠️' : '✅'}
                </span>
                <div>
                  <strong style={{ color: lagAnalysis.significantCount > 0 ? '#ff9f43' : '#2ecc71' }}>
                    {lagAnalysis.significantCount > 0 
                      ? `${lagAnalysis.significantCount} pairs with significant timezone effects detected`
                      : 'No significant timezone effects detected'}
                  </strong>
                  <div style={{ color: '#888', fontSize: '11px' }}>
                    {lagAnalysis.results.length} total pairs analyzed • 
                    Analyzed {new Date(lagAnalysis.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              
              {/* Results table */}
              {lagAnalysis.results.length > 0 && (
                <div 
                  className="lag-analysis-scrollbar"
                  style={{ 
                    overflowX: 'auto', 
                    maxHeight: '250px', 
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  <style>{`
                    .lag-analysis-scrollbar::-webkit-scrollbar {
                      width: 8px;
                      height: 8px;
                    }
                    .lag-analysis-scrollbar::-webkit-scrollbar-track {
                      background: #1a1a2e;
                      border-radius: 4px;
                    }
                    .lag-analysis-scrollbar::-webkit-scrollbar-thumb {
                      background: #3a3a5a;
                      border-radius: 4px;
                    }
                    .lag-analysis-scrollbar::-webkit-scrollbar-thumb:hover {
                      background: #4a4a6a;
                    }
                  `}</style>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(155, 89, 182, 0.3)' }}>
                        <th style={{ padding: '8px', textAlign: 'left', position: 'sticky', top: 0, background: '#0a0a15' }}>Pair</th>
                        <th style={{ padding: '8px', textAlign: 'right', position: 'sticky', top: 0, background: '#0a0a15' }}>Lag -1</th>
                        <th style={{ padding: '8px', textAlign: 'right', position: 'sticky', top: 0, background: '#0a0a15' }}>Lag 0 (Current)</th>
                        <th style={{ padding: '8px', textAlign: 'right', position: 'sticky', top: 0, background: '#0a0a15' }}>Lag +1</th>
                        <th style={{ padding: '8px', textAlign: 'center', position: 'sticky', top: 0, background: '#0a0a15' }}>Best Lag</th>
                        <th style={{ padding: '8px', textAlign: 'right', position: 'sticky', top: 0, background: '#0a0a15' }}>Improvement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lagAnalysis.results.slice(0, 20).map((r, i) => (
                        <tr 
                          key={i} 
                          style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: r.significant ? 'rgba(255, 159, 67, 0.05)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '6px 8px', fontWeight: 'bold' }}>
                            {r.ticker1} ↔ {r.ticker2}
                          </td>
                          <td style={{ 
                            padding: '6px 8px', 
                            textAlign: 'right',
                            color: r.bestLag === -1 ? '#9b59b6' : '#888',
                            fontWeight: r.bestLag === -1 ? 'bold' : 'normal',
                          }}>
                            {(r.corrMinus1 * 100).toFixed(1)}%
                          </td>
                          <td style={{ 
                            padding: '6px 8px', 
                            textAlign: 'right',
                            color: r.bestLag === 0 ? '#00d4ff' : '#888',
                            fontWeight: r.bestLag === 0 ? 'bold' : 'normal',
                          }}>
                            {(r.corr0 * 100).toFixed(1)}%
                          </td>
                          <td style={{ 
                            padding: '6px 8px', 
                            textAlign: 'right',
                            color: r.bestLag === 1 ? '#9b59b6' : '#888',
                            fontWeight: r.bestLag === 1 ? 'bold' : 'normal',
                          }}>
                            {(r.corrPlus1 * 100).toFixed(1)}%
                          </td>
                          <td style={{ 
                            padding: '6px 8px', 
                            textAlign: 'center',
                            color: r.bestLag !== 0 ? '#ff9f43' : '#2ecc71',
                            fontWeight: 'bold',
                          }}>
                            {r.bestLag === 0 ? '✓ Same Day' : r.bestLag === -1 ? '←1 Day' : '→1 Day'}
                          </td>
                          <td style={{ 
                            padding: '6px 8px', 
                            textAlign: 'right',
                            color: r.significant ? '#ff9f43' : '#888',
                            fontWeight: r.significant ? 'bold' : 'normal',
                          }}>
                            {r.improvement > 0 ? '+' : ''}{(r.improvement * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {lagAnalysis.results.length > 20 && (
                    <div style={{ fontSize: '11px', color: '#666', padding: '8px', textAlign: 'center' }}>
                      Showing top 20 of {lagAnalysis.results.length} pairs with lag effects
                    </div>
                  )}
                </div>
              )}
              
              {lagAnalysis.results.length === 0 && (
                <div style={{ fontSize: '11px', color: '#666', padding: '8px' }}>
                  All pairs have coincident (lag=0) as the best correlation. No timezone adjustments needed.
                </div>
              )}
            </div>
          )}
          
          {!Object.keys(historicalData).length && (
            <div style={{ fontSize: '11px', color: '#666' }}>
              ℹ️ First compute the correlation matrix using "Compute Correlation" above to run lag analysis.
            </div>
          )}
        </div>
        
        {/* Auto Correlation Adjustment Section */}
        <div style={{ 
          marginTop: '20px', 
          padding: '16px', 
          background: 'rgba(0, 212, 255, 0.05)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
        }}>
          <div style={{ ...styles.cardTitle, fontSize: '14px', marginBottom: '12px' }}>
            🤖 Auto-Adjust Correlations by Sector/Industry
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            {Object.keys(positionMetadata).length > 0 || correlationGroups
              ? 'Sector/industry data is saved locally. Click "Refresh" to update from Yahoo Finance.'
              : 'Fetch sector & industry data from Yahoo Finance, then apply correlation floors for assets in the same group.'}
          </div>
          
          <div style={{ ...styles.flexRow, marginBottom: '16px' }}>
            <button 
              style={{ ...styles.button, ...styles.buttonSecondary, opacity: isFetchingMetadata ? 0.7 : 1 }} 
              onClick={fetchAllMetadata}
              disabled={isFetchingMetadata}
            >
              {isFetchingMetadata 
                ? '⏳ Fetching Metadata...' 
                : Object.keys(positionMetadata).length > 0 
                  ? '🔄 Refresh Sector/Industry Data'
                  : '🔍 Fetch Sector/Industry Data'}
            </button>
            
            {(Object.keys(positionMetadata).length > 0 || correlationGroups) && (
              <button 
                style={styles.button} 
                onClick={() => {
                  const { adjustments } = applyCorrelationFloors(0.55);
                  setUseLagAdjusted(false);
                  if (adjustments && adjustments.length > 0) {
                    const summary = adjustments.slice(0, 3).map(a => 
                      `${a.ticker1}↔${a.ticker2}: ${(a.from*100).toFixed(0)}%→${(a.to*100).toFixed(0)}%`
                    ).join(', ');
                    showToast({ 
                      type: 'success', 
                      title: `Applied ${adjustments.length} Adjustments`,
                      message: summary + (adjustments.length > 3 ? ` ...+${adjustments.length - 3} more` : ''),
                      duration: 6000,
                    });
                  } else {
                    showToast({ type: 'info', message: 'No adjustments needed - correlations already meet floors.' });
                  }
                }}
              >
                ⚡ Apply Correlation Floors
              </button>
            )}
          </div>
          
          {/* Show position metadata */}
          {Object.keys(positionMetadata).length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#00d4ff', marginBottom: '8px' }}>
                Position Classifications:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {positions.map(pos => {
                  const meta = positionMetadata[pos.ticker?.toUpperCase()];
                  if (!meta) return null;
                  return (
                    <div key={pos.id} style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: meta.source === 'yahoo' ? 'rgba(46, 204, 113, 0.15)' : 
                                  meta.source === 'etf-mapping' ? 'rgba(0, 212, 255, 0.15)' : 
                                  'rgba(255, 159, 67, 0.15)',
                      border: `1px solid ${meta.source === 'yahoo' ? 'rgba(46, 204, 113, 0.3)' : 
                                           meta.source === 'etf-mapping' ? 'rgba(0, 212, 255, 0.3)' : 
                                           'rgba(255, 159, 67, 0.3)'}`,
                      fontSize: '11px',
                    }}>
                      <span style={{ fontWeight: 'bold', color: '#fff' }}>{pos.ticker}</span>
                      <span style={{ color: '#888' }}> • </span>
                      <span style={{ color: meta.industry !== 'Unknown' ? '#2ecc71' : '#ff9f43' }}>
                        {meta.industry || meta.sector || 'Unknown'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Show detected groups */}
          {correlationGroups && Object.keys(correlationGroups).length > 0 && (() => {
            const allGroupedPosIds = Object.values(correlationGroups).flat();
            
            return (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#00d4ff', marginBottom: '8px' }}>
                Correlation Groups (click ✕ to remove, use dropdown to add):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(correlationGroups).map(([group, groupPosIds]) => {
                  const availableToAdd = positions.filter(p => !allGroupedPosIds.includes(p.id));
                  
                  return (
                  <div key={group} style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'rgba(46, 204, 113, 0.1)',
                    border: '1px solid rgba(46, 204, 113, 0.2)',
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      color: '#2ecc71', 
                      marginBottom: '8px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <span>📁 {group}</span>
                      <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal' }}>
                        {groupPosIds.length} positions • 55% correlation floor
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                      {groupPosIds.map(posId => {
                        const pos = positions.find(p => p.id === posId);
                        if (!pos) return null;
                        
                        const displayName = getPositionDisplayName(posId);
                        
                        return (
                        <div 
                          key={posId} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'rgba(0, 212, 255, 0.15)',
                            border: '1px solid rgba(0, 212, 255, 0.3)',
                            fontSize: '11px',
                          }}
                        >
                          <span style={{ color: '#fff', fontWeight: 'bold' }}>{displayName}</span>
                          <button
                            onClick={() => {
                              setCorrelationGroups(prev => {
                                const newGroups = { ...prev };
                                newGroups[group] = newGroups[group].filter(id => id !== posId);
                                if (newGroups[group].length <= 1) {
                                  delete newGroups[group];
                                }
                                return newGroups;
                              });
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#e74c3c',
                              cursor: 'pointer',
                              padding: '0 2px',
                              fontSize: '14px',
                              lineHeight: '1',
                              opacity: 0.7,
                            }}
                            onMouseOver={(e) => e.target.style.opacity = 1}
                            onMouseOut={(e) => e.target.style.opacity = 0.7}
                            title={`Remove ${displayName} from ${group} group`}
                          >
                            ✕
                          </button>
                        </div>
                      )})}
                      {/* Add position dropdown */}
                      {availableToAdd.length > 0 && (
                        <select
                          style={{
                            ...styles.select,
                            padding: '4px 6px',
                            fontSize: '10px',
                            background: 'rgba(46, 204, 113, 0.2)',
                            border: '1px dashed rgba(46, 204, 113, 0.5)',
                            color: '#2ecc71',
                            cursor: 'pointer',
                          }}
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              setCorrelationGroups(prev => ({
                                ...prev,
                                [group]: [...prev[group], e.target.value]
                              }));
                            }
                          }}
                        >
                          <option value="">+ Add...</option>
                          {availableToAdd.map(pos => {
                            const displayName = getPositionDisplayName(pos.id);
                            return (
                              <option key={pos.id} value={pos.id}>{displayName}</option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  </div>
                )})}
              </div>
              
              {/* Show ungrouped positions with add-to-group dropdown */}
              {(() => {
                const ungroupedPositions = positions.filter(p => !allGroupedPosIds.includes(p.id));
                
                if (ungroupedPositions.length === 0) return null;
                
                const groupNames = Object.keys(correlationGroups);
                
                return (
                  <div style={{ 
                    marginTop: '12px', 
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: 'rgba(255, 159, 67, 0.1)',
                    border: '1px solid rgba(255, 159, 67, 0.2)',
                  }}>
                    <div style={{ fontSize: '11px', color: '#ff9f43', marginBottom: '8px' }}>
                      <strong>Ungrouped positions</strong> (click arrow to add to a group):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {ungroupedPositions.map(pos => {
                        const displayName = getPositionDisplayName(pos.id);
                          
                        return (
                        <div 
                          key={pos.id} 
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            background: 'rgba(255, 159, 67, 0.15)',
                            border: '1px solid rgba(255, 159, 67, 0.3)',
                            fontSize: '11px',
                          }}
                        >
                          <span style={{ color: '#fff' }}>{displayName}</span>
                          {groupNames.length > 0 && (
                            <select
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ff9f43',
                                fontSize: '10px',
                                cursor: 'pointer',
                                padding: '0',
                              }}
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  setCorrelationGroups(prev => ({
                                    ...prev,
                                    [e.target.value]: [...(prev[e.target.value] || []), pos.id]
                                  }));
                                }
                              }}
                            >
                              <option value="">→</option>
                              {groupNames.map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )})}
                    </div>
                  </div>
                );
              })()}
              
              {/* Create new group button */}
              <div style={{ marginTop: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    const name = prompt('Enter new group name:');
                    if (name && name.trim()) {
                      setCorrelationGroups(prev => ({
                        ...prev,
                        [name.trim()]: []
                      }));
                    }
                  }}
                  style={{
                    ...styles.button,
                    ...styles.buttonSecondary,
                    padding: '6px 12px',
                    fontSize: '11px',
                  }}
                >
                  + Create New Group
                </button>
                <span style={{ fontSize: '10px', color: '#666' }}>
                  💡 Create custom groups, then add positions from the ungrouped section
                </span>
              </div>
            </div>
          );})()}
          
          {Object.keys(positionMetadata).length === 0 && (!correlationGroups || Object.keys(correlationGroups).length === 0) && (
            <div style={{ fontSize: '11px', color: '#666' }}>
              Click "Fetch Sector/Industry Data" to automatically classify your positions and detect correlation groups.
            </div>
          )}
        </div>
        
        {editedCorrelation && tickers.length > 0 && (
          <>
          {/* View mode toggle - Premium */}
          <ViewModeSelector 
            activeMode={matrixViewMode} 
            onModeChange={setMatrixViewMode}
            onKeyboardShortcut={true}
          />
          
          {/* Scrollable matrix container */}
          <div 
            style={{ 
              overflowX: 'auto', 
              overflowY: 'visible',
              paddingBottom: '8px',
            }}
            className="styled-scrollbar"
          >
            <style>{`
              .styled-scrollbar::-webkit-scrollbar {
                height: 8px;
              }
              .styled-scrollbar::-webkit-scrollbar-track {
                background: rgba(42, 42, 74, 0.5);
                border-radius: 4px;
              }
              .styled-scrollbar::-webkit-scrollbar-thumb {
                background: linear-gradient(90deg, #00d4ff, #7b2ff7);
                border-radius: 4px;
              }
              .styled-scrollbar::-webkit-scrollbar-thumb:hover {
                background: linear-gradient(90deg, #00e5ff, #8b3ff7);
              }
            `}</style>
            
            {matrixViewMode === 'summary' && renderSummaryView()}
            
            {matrixViewMode === 'correlation' && (
              <>
                {/* Color Legend - Premium */}
                <CorrelationLegend />
                
                {/* Editable indicator */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  marginBottom: '12px',
                  padding: '8px 12px',
                  background: 'rgba(0, 212, 255, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(0, 212, 255, 0.1)',
                  fontSize: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      background: 'rgba(0, 212, 255, 0.15)',
                      border: '2px dashed rgba(0, 212, 255, 0.5)',
                    }} />
                    <span style={{ color: COLORS.cyan }}>Editable (click to modify)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.1)',
                    }} />
                    <span style={{ color: '#888' }}>Mirror (auto-synced)</span>
                  </div>
                </div>
                
                {/* Premium Correlation Matrix Table */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  overflow: 'hidden',
                }}>
                  <table
                    key={`corr-matrix-${editedCorrelation?.flat().slice(0, 10).map(v => v?.toFixed(2)).join('-') || 'empty'}`}
                    style={{
                      borderCollapse: 'separate',
                      borderSpacing: '2px',
                      width: '100%',
                      minWidth: `${tableMinWidth}px`,
                      fontFamily: FONT_FAMILY,
                      margin: '8px',
                    }}
                  >
                  <thead>
                    <tr>
                      <th style={{
                        padding: '10px 12px',
                        textAlign: 'left',
                        fontSize: '10px',
                        color: '#888',
                        fontWeight: '600',
                        minWidth: `${baseCellWidth}px`,
                      }}>ρ</th>
                      {tickers.map((t, i) => (
                        <th key={i} style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          minWidth: `${baseCellWidth}px`,
                          fontSize: '10px',
                          color: '#aaa',
                          fontWeight: '600',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '6px',
                        }}>{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickers.map((rowTicker, i) => (
                      <tr key={i}>
                        <td style={{ 
                          padding: '10px 12px',
                          fontWeight: '600',
                          fontSize: '11px',
                          color: '#aaa',
                          background: 'rgba(0, 0, 0, 0.3)',
                          borderRadius: '6px',
                        }}>{rowTicker}</td>
                        {tickers.map((_, j) => {
                          const val = editedCorrelation[i]?.[j] ?? 0;
                          const isDiagonal = i === j;
                          const isLowerDiagonal = i > j;
                          
                          // Editable cell styling
                          const editableBorder = isLowerDiagonal 
                            ? '2px dashed rgba(0, 212, 255, 0.4)' 
                            : 'none';
                          const editableGlow = isLowerDiagonal 
                            ? 'inset 0 0 8px rgba(0, 212, 255, 0.1)' 
                            : 'none';
                          
                          return (
                            <td 
                              key={j} 
                              style={{ 
                                padding: isLowerDiagonal ? '6px 8px' : '10px 12px',
                                textAlign: 'center',
                                background: isDiagonal 
                                  ? 'rgba(255,255,255,0.08)' 
                                  : getCorrelationColor(val),
                                borderRadius: '6px',
                                border: editableBorder,
                                boxShadow: editableGlow,
                                transition: 'all 0.2s ease',
                                cursor: isLowerDiagonal ? 'pointer' : 'default',
                              }}
                              title={isLowerDiagonal ? 'Click to edit correlation' : isDiagonal ? 'Diagonal (always 1.0)' : 'Mirror of lower triangle'}
                            >
                              {isDiagonal ? (
                                <span style={{ color: '#666', fontFamily: 'monospace', fontSize: '11px' }}>1.00</span>
                              ) : isLowerDiagonal ? (
                                <CorrelationCellInput
                                  value={val}
                                  onChange={(newVal) => updateCorrelationCell(i, j, newVal)}
                                  style={{ 
                                    color: '#fff', 
                                    fontSize: '12px',
                                    fontWeight: '600',
                                  }}
                                />
                              ) : (
                                <span style={{ color: '#888', fontSize: '11px', fontFamily: 'monospace' }}>
                                  {val.toFixed(2)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
            
            {matrixViewMode === 'beta' && renderBetaView()}
            
            {matrixViewMode === 'volatility' && renderVolatilityView()}
          </div>
          </>
        )}
        
        {!editedCorrelation && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            Click "Compute Correlation" to generate the correlation matrix from historical data
          </div>
        )}
      </div>
      
      {editedCorrelation && tickers.length > 0 && (
        <CovarianceMatrixCard 
          tickers={tickers}
          positions={positions}
          editedCorrelation={editedCorrelation}
          getDistributionParams={getDistributionParams}
          styles={styles}
        />
      )}
    </div>
  );
};

export default CorrelationTab;
