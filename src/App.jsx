import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine, AreaChart, Area } from 'recharts';

// UI Components
import {
  ToastProvider, useToast, setGlobalToastRef, toast,
  ConfirmDialog, EmptyState, KeyboardShortcuts, UserGuide,
  AnimatedPortfolioValue, InfoTooltip, AddPositionsModal, ScreenshotImportModal,
  CommandPalette, AutosaveIndicator, RecoveryDialog,
  Sidebar,
} from './components/common';

// Hooks for autosave, undo/redo, simulation, and sync
import { useAutosave, AutosaveStatus, useUndoRedo, useSimulation, usePortfolioSync } from './hooks';

// Auth components
import { UserMenu } from './components/auth';
import { useAuth } from './contexts/AuthContext';

// Crash recovery utilities
import {
  checkRecoveryNeeded,
  clearRecoveryState,
  markOperationStart,
  markOperationComplete,
  OperationType,
  createPositionsSnapshot,
} from './utils/crashRecovery';

// Tab components (extracted for performance)
import { CorrelationTab, SimulationTab, OptimizeTab, PositionsTab, FactorsTab, ExportTab, DistributionsTab, ConsensusTab } from './components/tabs';

// Styles (extracted to reduce file size)
import { styles } from './styles/appStyles';

// Yahoo Finance API service - routes through Cloudflare Worker with CORS proxy fallback
import { fetchYahooQuote, fetchYahooHistory, fetchYahooProfile, fetchExchangeRate, fetchYahooData } from './services/yahooFinance';

// Market data service - derived metrics from Cloudflare Worker
import { fetchMetrics, fetchAllDerivedMetrics, isWorkerAvailable } from './services/marketService';

// Position price cache for persistent storage
import {
  loadPositionPriceCache,
  updatePositionPriceCache,
  getCachedPrices,
  clearPositionPriceCache,
} from './services/positionPriceCache';

// FMP API service for consensus data
import { batchFetchConsensusData, getApiKey as getFmpApiKey } from './services/fmpService';

// Portfolio optimization utilities
import {
  buildCovarianceMatrix,
  computePortfolioVolatility,
  computePortfolioReturn,
  computeSharpeRatio,
  computeMCTR,
  computeRiskContribution,
  computeIncrementalSharpe,
  computeOptimalityRatio,
  computeRiskParityWeights,
} from './utils/portfolioOptimization';

// Cache management utilities
import {
  STORAGE_KEY,
  saveToStorage,
  loadFromStorage,
  UNIFIED_CACHE_KEY,
  UNIFIED_CACHE_MAX_AGE,
  FACTOR_CACHE_KEY,
  FACTOR_CACHE_MAX_AGE,
} from './services/cacheManager';

// Factor definitions
import {
  STANDARD_FACTOR_ETFS,
  FACTOR_SPREAD_DEFINITIONS,
  THEMATIC_ETFS,
  ALL_FACTOR_ETFS,
} from './utils/factorDefinitions';

// Market data helpers
import {
  inferETFSector,
  getCalendarYearReturns,
  computeDailyReturns,
  computeBetaAndCorrelation,
  computeReturns,
  computeVolatility,
  bootstrapAnnualReturns,
  processTickerData,
  rehydrateTickerData,
  prepareForStorage,
} from './utils/marketDataHelpers';

// Distribution parameter utilities
import {
  getPercentilesFromParams,
  getParamsFromPercentiles,
} from './utils/distributionParams';

// ============================================
// MONTE CARLO PORTFOLIO SIMULATOR
// Using Correlation Matrix as Primary Input
// ============================================

// Yahoo Finance API functions are now imported from services/yahooFinance.js
// They route through Cloudflare Worker (with KV cache) when available,
// with fallback to direct Yahoo API via CORS proxies.
// See: services/marketService.js for the Worker integration

// Percentile Input Component - only commits on blur or Enter
const PercentileInput = ({ value, onChange, color, min = -100, max = 100 }) => {
  const [localValue, setLocalValue] = useState(Math.round(value * 100).toString());
  
  // Update local value when prop changes (e.g., from slider or estimate)
  useEffect(() => {
    setLocalValue(Math.round(value * 100).toString());
  }, [value]);
  
  const commitValue = () => {
    let numValue = parseFloat(localValue) || 0;
    // Clamp to valid range (floor at -100%, no more than 100% loss)
    numValue = Math.max(min, Math.min(max, numValue));
    setLocalValue(Math.round(numValue).toString());
    onChange(numValue / 100);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };
  
  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitValue}
      onKeyDown={handleKeyDown}
      style={{ 
        background: '#1a1a2e',
        border: `1px solid ${color}40`,
        borderRadius: '4px',
        padding: '6px',
        color: color,
        width: '50px', 
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
      }}
    />
  );
};

// Input component that only updates on blur (for quantity/price)
const BlurInput = ({ value, onChange, type = 'number', style, ...props }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '');
  
  useEffect(() => {
    setLocalValue(value?.toString() || '');
  }, [value]);
  
  const commitValue = () => {
    const parsed = type === 'number' ? parseFloat(localValue) || 0 : localValue;
    onChange(parsed);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };
  
  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitValue}
      onKeyDown={handleKeyDown}
      style={style}
      {...props}
    />
  );
};

// Slider that only commits value on release (no lag during drag)
// Shows preview value in real-time above the slider
// onPreview callback reports the current drag value for external display
const PercentileSlider = ({ value, onChange, min, max, color, constraintMin, constraintMax, sliderStyle, showValue = false, onPreview }) => {
  const [localValue, setLocalValue] = useState(Math.round(value * 100));
  const [isDragging, setIsDragging] = useState(false);
  
  // Update local value when prop changes (but not during drag)
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(Math.round(value * 100));
    }
  }, [value, isDragging]);
  
  // Report preview value when dragging
  useEffect(() => {
    if (onPreview) {
      onPreview(isDragging ? localValue : null);
    }
  }, [localValue, isDragging, onPreview]);
  
  // Effective constraints (dynamic based on adjacent percentiles)
  const effectiveMin = constraintMin !== undefined ? Math.round(constraintMin * 100) : min;
  const effectiveMax = constraintMax !== undefined ? Math.round(constraintMax * 100) : max;
  
  const commitValue = () => {
    // Clamp to constraints
    let clamped = Math.max(effectiveMin, Math.min(effectiveMax, localValue));
    setLocalValue(clamped);
    onChange(clamped / 100);
    setIsDragging(false);
  };
  
  const handleChange = (e) => {
    setLocalValue(parseInt(e.target.value));
  };
  
  const formatLabel = (v) => {
    return v >= 0 ? `+${v}%` : `${v}%`;
  };
  
  // Display value (shows local value during drag for real-time preview)
  const displayValue = isDragging ? localValue : Math.round(value * 100);
  
  return (
    <div>
      {showValue && (
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <span style={{ 
            color: color, 
            fontSize: '14px', 
            fontWeight: 'bold',
            transition: isDragging ? 'none' : 'color 0.2s',
          }}>
            {displayValue >= 0 ? '+' : ''}{displayValue}%
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={localValue}
        onChange={handleChange}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={commitValue}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={commitValue}
        style={{ ...sliderStyle, width: '100%' }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: '#666', marginTop: '2px' }}>
        <span style={{ color: effectiveMin > min ? color : '#666' }}>
          {formatLabel(effectiveMin)}
        </span>
        <span style={{ color: effectiveMax < max ? color : '#666' }}>
          {formatLabel(effectiveMax)}
        </span>
      </div>
    </div>
  );
};

// Combined percentile editor with preview value and text input
const PercentileEditor = ({ value, onChange, color, min, max, constraintMin, constraintMax, sliderMin, sliderMax, sliderStyle, label }) => {
  const [previewValue, setPreviewValue] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(Math.round(value * 100).toString());
  const inputRef = useRef(null);
  
  // Update edit value when not editing
  useEffect(() => {
    if (!isEditing) {
      setEditValue(Math.round(value * 100).toString());
    }
  }, [value, isEditing]);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const commitEdit = () => {
    let numValue = parseFloat(editValue) || 0;
    numValue = Math.max(min, Math.min(max, numValue));
    setEditValue(Math.round(numValue).toString());
    onChange(numValue / 100);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditValue(Math.round(value * 100).toString());
      setIsEditing(false);
    }
  };
  
  // Display value: preview during drag, else committed value
  const displayValue = previewValue !== null ? previewValue : Math.round(value * 100);
  
  return (
    <div>
      <div style={{ fontSize: '10px', color: color, marginBottom: '4px', textAlign: 'center', fontWeight: 'bold' }}>
        {label}
      </div>
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            style={{ 
              background: '#0a0a15',
              border: `1px solid ${color}`,
              borderRadius: '4px',
              padding: '6px',
              color: color,
              width: '50px', 
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          />
        ) : (
          <span 
            onClick={() => setIsEditing(true)}
            style={{ 
              color: color, 
              fontSize: '14px', 
              fontWeight: 'bold',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
              background: 'rgba(255,255,255,0.05)',
              display: 'inline-block',
              minWidth: '50px',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            title="Click to edit"
          >
            {displayValue >= 0 ? '+' : ''}{displayValue}%
          </span>
        )}
      </div>
      <PercentileSlider
        value={value}
        onChange={onChange}
        min={sliderMin}
        max={sliderMax}
        color={color}
        constraintMin={constraintMin}
        constraintMax={constraintMax}
        sliderStyle={sliderStyle}
        onPreview={setPreviewValue}
      />
    </div>
  );
};

// Draggable Distribution Editor Component
const DraggableDistributionEditor = ({ position, onUpdate }) => {
  const [dragging, setDragging] = useState(null);
  const [localPercentiles, setLocalPercentiles] = useState(null);
  
  // Calculate current percentiles from position params
  const percentiles = useMemo(() => {
    if (localPercentiles) return localPercentiles;
    return getPercentilesFromParams(position.mu, position.sigma, position.skew, position.tailDf);
  }, [position.mu, position.sigma, position.skew, position.tailDf, localPercentiles]);
  
  // SVG dimensions
  const width = 600;
  const height = 200;
  const padding = { left: 50, right: 30, top: 20, bottom: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // X scale (return values)
  const xMin = Math.min(percentiles.p5, position.mu - 3 * position.sigma) - 0.05;
  const xMax = Math.max(percentiles.p95, position.mu + 3 * position.sigma) + 0.05;
  const xScale = (val) => padding.left + ((val - xMin) / (xMax - xMin)) * chartWidth;
  const xInverse = (px) => xMin + ((px - padding.left) / chartWidth) * (xMax - xMin);
  
  // Y scale (density - fixed)
  const yScale = (val) => padding.top + chartHeight - val * chartHeight;
  
  // Generate curve points
  const curvePoints = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 100; i++) {
      const x = xMin + (i / 100) * (xMax - xMin);
      const z = (x - position.mu) / position.sigma;
      let y = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
      
      // Apply skew
      const skewFactor = 1 + position.skew * z * 0.3;
      y *= Math.max(0.1, skewFactor);
      
      // Apply fat tails
      if (position.tailDf < 30) {
        const tailBoost = 1 + (30 - position.tailDf) / 30 * Math.pow(Math.abs(z) / 2, 2) * 0.3;
        y *= tailBoost;
      }
      
      points.push({ x, y: Math.min(y, 1) });
    }
    // Normalize
    const maxY = Math.max(...points.map(p => p.y));
    return points.map(p => ({ x: p.x, y: p.y / maxY * 0.9 }));
  }, [position.mu, position.sigma, position.skew, position.tailDf, xMin, xMax]);
  
  // Path for the curve
  const curvePath = curvePoints.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${xScale(p.x)} ${yScale(p.y)}`
  ).join(' ') + ` L ${xScale(xMax)} ${yScale(0)} L ${xScale(xMin)} ${yScale(0)} Z`;
  
  // Control points
  const controlPoints = [
    { key: 'p5', label: 'P5', value: percentiles.p5, color: '#e74c3c' },
    { key: 'p25', label: 'P25', value: percentiles.p25, color: '#ff9f43' },
    { key: 'p50', label: 'P50', value: percentiles.p50, color: '#fff' },
    { key: 'p75', label: 'P75', value: percentiles.p75, color: '#9fe288' },
    { key: 'p95', label: 'P95', value: percentiles.p95, color: '#2ecc71' },
  ];
  
  // Handle drag
  const handleMouseDown = (key) => (e) => {
    e.preventDefault();
    setDragging(key);
    setLocalPercentiles({ ...percentiles });
  };
  
  const handleMouseMove = useCallback((e) => {
    if (!dragging || !localPercentiles) return;
    
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newValue = xInverse(x);
    
    // Update the dragged percentile with constraints
    const updated = { ...localPercentiles };
    
    // Enforce ordering: p5 < p25 < p50 < p75 < p95
    switch (dragging) {
      case 'p5':
        updated.p5 = Math.min(newValue, updated.p25 - 0.01);
        break;
      case 'p25':
        updated.p25 = Math.max(updated.p5 + 0.01, Math.min(newValue, updated.p50 - 0.01));
        break;
      case 'p50':
        updated.p50 = Math.max(updated.p25 + 0.01, Math.min(newValue, updated.p75 - 0.01));
        break;
      case 'p75':
        updated.p75 = Math.max(updated.p50 + 0.01, Math.min(newValue, updated.p95 - 0.01));
        break;
      case 'p95':
        updated.p95 = Math.max(newValue, updated.p75 + 0.01);
        break;
    }
    
    setLocalPercentiles(updated);
  }, [dragging, localPercentiles, xInverse]);
  
  const handleMouseUp = useCallback(() => {
    if (dragging && localPercentiles) {
      // Back-calculate parameters from new percentiles
      const newParams = getParamsFromPercentiles(
        localPercentiles.p5,
        localPercentiles.p25,
        localPercentiles.p50,
        localPercentiles.p75,
        localPercentiles.p95
      );
      onUpdate(newParams);
    }
    setDragging(null);
    setLocalPercentiles(null);
  }, [dragging, localPercentiles, onUpdate]);
  
  // Get Y position for control point (find curve height at that x)
  const getYForX = (xVal) => {
    const z = (xVal - position.mu) / position.sigma;
    let y = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
    const skewFactor = 1 + position.skew * z * 0.3;
    y *= Math.max(0.1, skewFactor);
    if (position.tailDf < 30) {
      const tailBoost = 1 + (30 - position.tailDf) / 30 * Math.pow(Math.abs(z) / 2, 2) * 0.3;
      y *= tailBoost;
    }
    const maxY = 0.4 / position.sigma; // Approximate max density
    return Math.min(y / maxY * 0.9, 0.9);
  };

  return (
    <div style={{ width: '100%', maxWidth: '800px' }}>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Drag the colored points to shape the distribution</span>
        <span>
          Skew: <strong style={{ color: position.skew > 0 ? '#2ecc71' : position.skew < 0 ? '#e74c3c' : '#888' }}>{position.skew.toFixed(2)}</strong> | 
          Tails: <strong style={{ color: position.tailDf < 15 ? '#ff9f43' : '#888' }}>df={position.tailDf}</strong>
        </span>
      </div>
      <svg 
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: dragging ? 'grabbing' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
      {/* Background */}
      <rect x={0} y={0} width={width} height={height} fill="#0a0a15" rx={8} />
      
      {/* Grid */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map(v => (
        v >= xMin && v <= xMax && (
          <line 
            key={v} 
            x1={xScale(v)} 
            y1={padding.top} 
            x2={xScale(v)} 
            y2={height - padding.bottom}
            stroke={v === 0 ? '#ffffff40' : '#2a2a4a'}
            strokeDasharray={v === 0 ? '4,4' : '2,2'}
          />
        )
      ))}
      
      {/* Curve fill */}
      <path 
        d={curvePath} 
        fill="url(#distGradient)" 
        stroke="#00d4ff" 
        strokeWidth={2}
      />
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="distGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#7b2ff7" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      
      {/* X axis */}
      <line 
        x1={padding.left} 
        y1={height - padding.bottom} 
        x2={width - padding.right} 
        y2={height - padding.bottom}
        stroke="#666"
      />
      
      {/* X axis labels */}
      {[xMin, xMin + (xMax-xMin)*0.25, xMin + (xMax-xMin)*0.5, xMin + (xMax-xMin)*0.75, xMax].map((v, i) => (
        <text 
          key={i}
          x={xScale(v)} 
          y={height - padding.bottom + 15}
          fill="#888"
          fontSize={10}
          textAnchor="middle"
        >
          {(v * 100).toFixed(0)}%
        </text>
      ))}
      
      {/* X axis title */}
      <text 
        x={width / 2} 
        y={height - 5}
        fill="#666"
        fontSize={10}
        textAnchor="middle"
      >
        1-Year Return
      </text>
      
      {/* Y axis label */}
      <text 
        x={15} 
        y={height / 2}
        fill="#666"
        fontSize={10}
        textAnchor="middle"
        transform={`rotate(-90, 15, ${height / 2})`}
      >
        Probability
      </text>
      
      {/* Control points */}
      {controlPoints.map(({ key, label, value, color }) => {
        const displayValue = localPercentiles ? localPercentiles[key] : value;
        const cx = xScale(displayValue);
        const cy = yScale(getYForX(displayValue));
        
        return (
          <g key={key}>
            {/* Vertical line from point to axis */}
            <line 
              x1={cx} 
              y1={cy} 
              x2={cx} 
              y2={height - padding.bottom}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="3,3"
              opacity={0.5}
            />
            
            {/* Draggable circle */}
            <circle
              cx={cx}
              cy={cy}
              r={dragging === key ? 10 : 8}
              fill={color}
              stroke="#fff"
              strokeWidth={2}
              style={{ cursor: 'grab' }}
              onMouseDown={handleMouseDown(key)}
            />
            
            {/* Label */}
            <text
              x={cx}
              y={cy - 15}
              fill={color}
              fontSize={10}
              fontWeight="bold"
              textAnchor="middle"
            >
              {label}
            </text>
            
            {/* Value label */}
            <text
              x={cx}
              y={height - padding.bottom + 28}
              fill={color}
              fontSize={9}
              fontWeight="bold"
              textAnchor="middle"
            >
              {(displayValue * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}
      
      {/* Instructions */}
      <text x={width - padding.right - 5} y={padding.top + 10} fill="#666" fontSize={9} textAnchor="end">
        Click &amp; drag points
      </text>
    </svg>
    </div>
  );
};

// Calculate log returns from price history objects
const calculateReturnsFromHistory = (priceHistory) => {
  if (!priceHistory || priceHistory.length < 2) return [];
  const returns = [];
  for (let i = 1; i < priceHistory.length; i++) {
    if (priceHistory[i].close > 0 && priceHistory[i-1].close > 0) {
      returns.push(Math.log(priceHistory[i].close / priceHistory[i-1].close));
    }
  }
  return returns;
};

// Calculate annualized volatility from daily returns
const calculateAnnualizedVol = (dailyReturns) => {
  if (!dailyReturns || dailyReturns.length < 10) return 0.20; // Default
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  return Math.sqrt(variance * 252);
};

// Utility functions for statistical distributions
const normalCDF = (x) => {
  // Clamp extreme values to avoid numerical issues
  if (x < -8) return 0.00001;
  if (x > 8) return 0.99999;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  const result = 0.5 * (1.0 + sign * y);
  // Ensure result is in valid range
  return Math.max(0.00001, Math.min(0.99999, result));
};

const normalInvCDF = (p) => {
  // Clamp to avoid infinity
  p = Math.max(0.00001, Math.min(0.99999, p));
  const a = [0, -3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [0, -5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [0, -7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [0, 7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r, result;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    result = (((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    result = (((((a[1] * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * r + a[6]) * q / (((((b[1] * r + b[2]) * r + b[3]) * r + b[4]) * r + b[5]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    result = -(((((c[1] * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) * q + c[6]) / ((((d[1] * q + d[2]) * q + d[3]) * q + d[4]) * q + 1);
  }
  // Clamp output to reasonable range
  return Math.max(-6, Math.min(6, result));
};

// Student-t inverse CDF approximation
const studentTInvCDF = (p, df) => {
  // Clamp input
  p = Math.max(0.00001, Math.min(0.99999, p));
  df = Math.max(3, df);
  if (df >= 30) return normalInvCDF(p);
  const x = normalInvCDF(p);
  const g1 = (x * x * x + x) / 4;
  const g2 = (5 * x * x * x * x * x + 16 * x * x * x + 3 * x) / 96;
  const result = x + g1 / df + g2 / (df * df);
  // Clamp output
  return Math.max(-8, Math.min(8, result));
};

// Box-Muller for normal random
const boxMuller = () => {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
};

// Box-Muller pair for chi-squared generation
const boxMullerPair = () => {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  const r = Math.sqrt(-2 * Math.log(u1));
  const theta = 2 * Math.PI * u2;
  return [r * Math.cos(theta), r * Math.sin(theta)];
};

// Generate chi-squared random variable for multivariate Student-t
const generateChiSquared = (df) => {
  if (df > 100) {
    const z = boxMuller();
    return Math.max(0.01, df + Math.sqrt(2 * df) * z);
  }
  let sum = 0;
  const fullPairs = Math.floor(df / 2);
  for (let i = 0; i < fullPairs; i++) {
    const [z1, z2] = boxMullerPair();
    sum += z1 * z1 + z2 * z2;
  }
  if (df % 2 === 1) {
    const z = boxMuller();
    sum += z * z;
  }
  return Math.max(0.01, sum);
};

// Cholesky decomposition
const choleskyDecomposition = (matrix) => {
  const n = matrix.length;
  const L = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        const val = matrix[i][i] - sum;
        L[i][j] = val > 0 ? Math.sqrt(val) : 0.0001;
      } else {
        L[i][j] = L[j][j] !== 0 ? (matrix[i][j] - sum) / L[j][j] : 0;
      }
    }
  }
  return L;
};

// Make correlation matrix valid (symmetric, PSD, diag=1)
const makeValidCorrelation = (matrix) => {
  const n = matrix.length;
  const result = matrix.map(row => [...row]);
  
  // Symmetrize
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const avg = (result[i][j] + result[j][i]) / 2;
      // Clamp to valid correlation range
      const clamped = Math.max(-0.999, Math.min(0.999, avg));
      result[i][j] = clamped;
      result[j][i] = clamped;
    }
  }
  
  // Ensure diagonal is 1
  for (let i = 0; i < n; i++) {
    result[i][i] = 1.0;
  }
  
  // Simple PSD fix: eigenvalue adjustment via nearest correlation matrix approximation
  // For simplicity, we use iterative projection (Higham's algorithm simplified)
  let maxIter = 50;
  for (let iter = 0; iter < maxIter; iter++) {
    // Check if Cholesky works (matrix is PSD)
    try {
      const L = choleskyDecomposition(result);
      // If we get here without issues, matrix is PSD
      let valid = true;
      for (let i = 0; i < n && valid; i++) {
        if (isNaN(L[i][i]) || L[i][i] <= 0) valid = false;
      }
      if (valid) break;
    } catch (e) {
      // Not PSD, continue fixing
    }
    
    // Shrink off-diagonal elements toward zero
    const shrink = 0.95;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          result[i][j] *= shrink;
        }
      }
    }
  }
  
  return result;
};

// Convert correlation to covariance using volatilities
const correlationToCovariance = (corr, vols) => {
  const n = corr.length;
  const cov = Array(n).fill(null).map(() => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      cov[i][j] = corr[i][j] * vols[i] * vols[j];
    }
  }
  return cov;
};

// Sample historical data (mock - in production would use yfinance)
const MOCK_HISTORICAL_DATA = {
  'SPY': { prices: Array(252).fill(0).map((_, i) => 450 * Math.exp(0.0004 * i + 0.01 * (Math.random() - 0.5))), vol: 0.18 },
  'QQQ': { prices: Array(252).fill(0).map((_, i) => 380 * Math.exp(0.0005 * i + 0.015 * (Math.random() - 0.5))), vol: 0.24 },
  'AAPL': { prices: Array(252).fill(0).map((_, i) => 175 * Math.exp(0.0003 * i + 0.018 * (Math.random() - 0.5))), vol: 0.28 },
  'MSFT': { prices: Array(252).fill(0).map((_, i) => 380 * Math.exp(0.0004 * i + 0.016 * (Math.random() - 0.5))), vol: 0.25 },
  'GOOGL': { prices: Array(252).fill(0).map((_, i) => 140 * Math.exp(0.0003 * i + 0.02 * (Math.random() - 0.5))), vol: 0.30 },
  'AMZN': { prices: Array(252).fill(0).map((_, i) => 180 * Math.exp(0.0005 * i + 0.022 * (Math.random() - 0.5))), vol: 0.32 },
  'NVDA': { prices: Array(252).fill(0).map((_, i) => 480 * Math.exp(0.001 * i + 0.03 * (Math.random() - 0.5))), vol: 0.50 },
  'TSLA': { prices: Array(252).fill(0).map((_, i) => 250 * Math.exp(0.0002 * i + 0.035 * (Math.random() - 0.5))), vol: 0.55 },
  'GLD': { prices: Array(252).fill(0).map((_, i) => 185 * Math.exp(0.0001 * i + 0.008 * (Math.random() - 0.5))), vol: 0.15 },
  'TLT': { prices: Array(252).fill(0).map((_, i) => 95 * Math.exp(-0.0001 * i + 0.012 * (Math.random() - 0.5))), vol: 0.18 },
  'VIX': { prices: Array(252).fill(0).map((_, i) => 18 + 5 * Math.sin(i / 30) + 3 * (Math.random() - 0.5)), vol: 0.80 },
};

// Calculate returns from prices
const calculateReturns = (prices) => {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  return returns;
};

// Calculate sample correlation matrix from returns
const calculateSampleCorrelation = (returnsMatrix) => {
  const n = returnsMatrix.length;
  const T = returnsMatrix[0]?.length || 0;
  if (T === 0) return Array(n).fill(null).map((_, i) => Array(n).fill(0).map((_, j) => i === j ? 1 : 0));
  
  const means = returnsMatrix.map(r => r.reduce((a, b) => a + b, 0) / T);
  const stds = returnsMatrix.map((r, i) => {
    const variance = r.reduce((sum, val) => sum + (val - means[i]) ** 2, 0) / (T - 1);
    return Math.sqrt(variance);
  });
  
  const corr = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      if (i === j) {
        corr[i][j] = 1.0;
      } else {
        let sum = 0;
        for (let t = 0; t < T; t++) {
          sum += (returnsMatrix[i][t] - means[i]) * (returnsMatrix[j][t] - means[j]);
        }
        const correlation = sum / ((T - 1) * stds[i] * stds[j]);
        corr[i][j] = Math.max(-0.999, Math.min(0.999, correlation));
        corr[j][i] = corr[i][j];
      }
    }
  }
  return corr;
};

// Main App Component
function MonteCarloSimulator() {
  // Auth state
  const { state: authState } = useAuth();

  // Portfolio sync hook for Supabase persistence
  const {
    syncState,
    loadFromServer,
    savePositionsToServer,
    saveCorrelationToServer,
    saveSimulationToServer,
    saveFactorsToServer,
    saveOptimizationToServer,
  } = usePortfolioSync({ debounceMs: 2000 });

  // Track if we've loaded from server on login
  const hasLoadedFromServerRef = React.useRef(false);

  // Load saved data on mount
  const savedData = useMemo(() => loadFromStorage(), []);
  
  // Toast function - uses global ref set by ToastConnector
  const showToast = useCallback((options) => {
    if (options.type === 'success') toast.success(options.message, options);
    else if (options.type === 'error') toast.error(options.message, options);
    else if (options.type === 'warning') toast.warning(options.message, options);
    else toast.info(options.message, options);
  }, []);
  
  // Portfolio state - now stores percentiles directly
  const [positions, setPositions] = useState(() => {
    const defaultPositions = [
      { id: 1, ticker: 'SPY', quantity: 100, type: 'ETF', price: 450,
        p5: -0.20, p25: 0.02, p50: 0.10, p75: 0.18, p95: 0.35 },
      { id: 2, ticker: 'QQQ', quantity: 50, type: 'ETF', price: 380,
        p5: -0.30, p25: -0.02, p50: 0.12, p75: 0.26, p95: 0.50 },
      { id: 3, ticker: 'GLD', quantity: 30, type: 'ETF', price: 185,
        p5: -0.10, p25: 0.00, p50: 0.05, p75: 0.10, p95: 0.20 },
    ];
    
    if (!savedData?.positions) return defaultPositions;
    
    // Migrate old format positions to new percentile format
    return savedData.positions.map(pos => {
      if (pos.p5 !== undefined) return pos; // Already has percentiles
      
      // Calculate percentiles from old mu/sigma format
      const mu = pos.mu || 0.10;
      const sigma = pos.sigma || 0.20;
      const skew = pos.skew || 0;
      const skewAdj = skew * 0.15;
      
      return {
        ...pos,
        p5: mu - 1.645 * sigma + skewAdj,
        p25: mu - 0.675 * sigma + skewAdj * 0.5,
        p50: mu + skewAdj * 0.2,
        p75: mu + 0.675 * sigma + skewAdj * 0.5,
        p95: mu + 1.645 * sigma + skewAdj,
      };
    });
  });
  
  // Compute derived distribution parameters from percentiles
  const getDistributionParams = useCallback((pos) => {
    // Handle missing percentile fields (migration from old format)
    const p5 = pos.p5 ?? (pos.mu ? pos.mu - 1.645 * (pos.sigma || 0.2) : -0.20);
    const p25 = pos.p25 ?? (pos.mu ? pos.mu - 0.675 * (pos.sigma || 0.2) : 0.02);
    const p50 = pos.p50 ?? (pos.mu || 0.10);
    const p75 = pos.p75 ?? (pos.mu ? pos.mu + 0.675 * (pos.sigma || 0.2) : 0.18);
    const p95 = pos.p95 ?? (pos.mu ? pos.mu + 1.645 * (pos.sigma || 0.2) : 0.35);
    
    // μ is approximately the median
    const mu = isFinite(p50) ? p50 : 0.10;
    
    // σ estimated from IQR (interquartile range)
    // For normal distribution, IQR ≈ 1.35σ
    const iqr = (p75 || 0.18) - (p25 || 0.02);
    const sigma = Math.max(0.01, Math.abs(iqr) / 1.35);
    
    // Skew from asymmetry of tails
    const upperTail = Math.max(0.01, (p95 || 0.35) - (p50 || 0.10));
    const lowerTail = Math.max(0.01, (p50 || 0.10) - (p5 || -0.20));
    const skewRaw = (upperTail - lowerTail) / (upperTail + lowerTail + 0.001);
    const skew = Math.max(-1, Math.min(1, isFinite(skewRaw) ? skewRaw * 1.5 : 0));
    
    // Tail heaviness from how far the extremes are
    const expectedSpread = 2 * 1.645 * sigma; // Normal P5-P95 spread
    const actualSpread = Math.abs((p95 || 0.35) - (p5 || -0.20));
    const tailRatio = actualSpread / (expectedSpread + 0.001);
    const tailDf = Math.max(3, Math.min(30, Math.round(30 / Math.max(0.8, tailRatio))));
    
    return { 
      mu: isFinite(mu) ? mu : 0.10, 
      sigma: isFinite(sigma) ? sigma : 0.20, 
      skew: isFinite(skew) ? skew : 0, 
      tailDf: isFinite(tailDf) ? tailDf : 30 
    };
  }, []);
  
  // Migrate old position format to new percentile format
  const migratePosition = (pos) => {
    if (pos.p5 !== undefined) return pos; // Already migrated
    
    // Calculate percentiles from old mu/sigma/skew format
    const mu = pos.mu || 0.10;
    const sigma = pos.sigma || 0.20;
    const skew = pos.skew || 0;
    
    // Adjust for skew
    const skewAdj = skew * 0.15;
    
    return {
      ...pos,
      p5: mu - 1.645 * sigma + skewAdj,
      p25: mu - 0.675 * sigma + skewAdj * 0.5,
      p50: mu + skewAdj * 0.2,
      p75: mu + 0.675 * sigma + skewAdj * 0.5,
      p95: mu + 1.645 * sigma + skewAdj,
    };
  };

  // ============================================
  // SIMULATION HOOK
  // Manages simulation state and provides runSimulation function
  // ============================================
  const {
    numPaths, setNumPaths,
    useQmc, setUseQmc,
    fatTailMethod, setFatTailMethod,
    drawdownThreshold, setDrawdownThreshold,
    gldAsCash, setGldAsCash,
    isSimulating,
    simulationResults, setSimulationResults,
    previousSimulationResults,
    runSimulation: runSimulationHook,
  } = useSimulation({
    initialState: {
      numPaths: savedData?.numPaths,
      useQmc: savedData?.useQmc,
      fatTailMethod: savedData?.fatTailMethod,
      drawdownThreshold: savedData?.drawdownThreshold,
      gldAsCash: savedData?.gldAsCash,
      simulationResults: savedData?.simulationResults,
    },
    showToast,
  });

  const [activeTab, setActiveTab] = useState('positions');

  // Track which tabs have been visited since new content was loaded
  // Key = tab id, Value = timestamp when tab was last visited
  const [tabVisitedAt, setTabVisitedAt] = useState({
    positions: Date.now(), // Start with positions visited
    consensus: 0,
    distributions: 0,
    correlation: 0,
    simulation: 0,
    factors: 0,
    optimize: 0,
    export: 0,
  });

  // Track when content was last updated for each tab
  // Key = tab id, Value = timestamp when content was last updated
  const [tabContentUpdatedAt, setTabContentUpdatedAt] = useState({
    positions: 0,
    consensus: 0,
    distributions: 0,
    correlation: 0,
    simulation: 0,
    factors: 0,
    optimize: 0,
    export: 0,
  });

  // Mark a tab as visited when user switches to it
  useEffect(() => {
    setTabVisitedAt(prev => ({
      ...prev,
      [activeTab]: Date.now(),
    }));
  }, [activeTab]);

  // Helper to mark content as updated for a tab
  const markTabContentUpdated = useCallback((tabId) => {
    setTabContentUpdatedAt(prev => ({
      ...prev,
      [tabId]: Date.now(),
    }));
  }, []);

  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebar-expanded');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  const [correlationMatrix, setCorrelationMatrix] = useState(savedData?.correlationMatrix || null);
  const [editedCorrelation, setEditedCorrelation] = useState(savedData?.editedCorrelation || null);
  const [correlationMethod, setCorrelationMethod] = useState(savedData?.correlationMethod || 'shrinkage');

  // EWMA (Exponentially Weighted Moving Average) correlation toggle
  // When enabled, automatically scales half-life based on history timeline
  const [useEwma, setUseEwma] = useState(savedData?.useEwma ?? true);
  const [showMethodologyExplainer, setShowMethodologyExplainer] = useState(false);
  
  // Cash balance (positive = cash, negative = margin/borrowing)
  const [cashBalance, setCashBalance] = useState(savedData?.cashBalance ?? 0);
  const [cashRate, setCashRate] = useState(savedData?.cashRate ?? 0.05); // 5% default (money market / margin rate)
  
  // Data fetching state
  const [historicalData, setHistoricalData] = useState({});
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [dataSource, setDataSource] = useState('none');
  const [fetchErrors, setFetchErrors] = useState([]);
  const [historyTimeline, setHistoryTimeline] = useState('1y'); // '6mo', '1y', '2y', '3y'
  
  // Calendar year returns (separate from historicalData for distributions)
  const [calendarYearReturns, setCalendarYearReturns] = useState(savedData?.calendarYearReturns || {});
  const [isFetchingYearReturns, setIsFetchingYearReturns] = useState(false);
  
  // Position metadata (sector, industry) for correlation adjustments
  const [positionMetadata, setPositionMetadata] = useState(savedData?.positionMetadata || {});
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [correlationGroups, setCorrelationGroups] = useState(savedData?.correlationGroups || null);
  
  // Lag analysis for international stocks (timezone effects)
  const [lagAnalysis, setLagAnalysis] = useState(null);
  const [isAnalyzingLag, setIsAnalyzingLag] = useState(false);
  const [useLagAdjusted, setUseLagAdjusted] = useState(false);
  
  // Factor Analysis state
  const [factorData, setFactorData] = useState(null); // ETF returns for factors
  const [factorAnalysis, setFactorAnalysis] = useState(null); // Computed factor betas and attribution
  const [isFetchingFactors, setIsFetchingFactors] = useState(false);
  const [thematicOverrides, setThematicOverrides] = useState({}); // User overrides: {positionId: 'SOXX'}
  
  // Matrix view mode: 'correlation', 'beta', 'volatility'
  const [matrixViewMode, setMatrixViewMode] = useState('correlation');
  
  // Track hovered scenario in contribution chart for dynamic legend
  const [hoveredScenario, setHoveredScenario] = useState(null);
  
  // Throttled hover handler for contribution chart (prevents excessive re-renders)
  const lastHoverUpdate = useRef(0);
  const handleContributionHover = useCallback((scenarioKey) => {
    const now = Date.now();
    if (now - lastHoverUpdate.current > 50) { // Throttle to max 20 updates/sec
      lastHoverUpdate.current = now;
      setHoveredScenario(scenarioKey);
    }
  }, []);
  
  // Memoized contribution chart data to prevent recalculation on hover
  const contributionChartMemo = useMemo(() => {
    if (!simulationResults?.contributions) return null;
    
    const contributions = simulationResults.contributions;
    
    // Create unique identifiers for each position to handle duplicates
    // Track how many times we've seen each ticker
    const tickerCounts = {};
    const uniqueIds = contributions.tickers.map((ticker, i) => {
      tickerCounts[ticker] = (tickerCounts[ticker] || 0) + 1;
      const count = tickerCounts[ticker];
      // Only add suffix if we've seen this ticker more than once
      return count > 1 ? `${ticker} #${count}` : ticker;
    });
    
    // Re-count to create proper labels (need to know total count upfront)
    const tickerTotals = {};
    contributions.tickers.forEach(ticker => {
      tickerTotals[ticker] = (tickerTotals[ticker] || 0) + 1;
    });
    
    // Create display labels with numbering for duplicates
    const tickerSeenCount = {};
    const displayLabels = contributions.tickers.map((ticker, i) => {
      tickerSeenCount[ticker] = (tickerSeenCount[ticker] || 0) + 1;
      if (tickerTotals[ticker] > 1) {
        return `${ticker} #${tickerSeenCount[ticker]}`;
      }
      return ticker;
    });
    
    // Sort positions by P50 contribution (descending)
    const sortedIndices = contributions.tickers
      .map((ticker, i) => ({ ticker, displayLabel: displayLabels[i], i, p50: contributions.p50?.[i] || 0 }))
      .sort((a, b) => b.p50 - a.p50)
      .map(item => item.i);
    
    const sortedDisplayLabels = sortedIndices.map(i => displayLabels[i]);
    
    // Color palette
    const colors = [
      '#00d4ff', '#7b2ff7', '#2ecc71', '#e74c3c', '#ff9f43', 
      '#f1c40f', '#9b59b6', '#1abc9c', '#e91e63', '#00bcd4',
      '#8bc34a', '#ff5722', '#607d8b', '#795548', '#ffc107',
      '#3f51b5', '#009688', '#cddc39', '#ff4081', '#536dfe',
    ];
    
    // Map position index to color (using index, not ticker name)
    const tickerColors = {};
    displayLabels.forEach((label, i) => {
      tickerColors[label] = colors[i % colors.length];
    });
    
    // Pre-compute chart data using display labels
    const scenarios = ['p5', 'p25', 'p50', 'p75', 'p95', 'mean'];
    const labels = ['P5 (Bad)', 'P25', 'P50 (Median)', 'P75', 'P95 (Good)', 'Mean'];
    const chartData = scenarios.map((scenario, idx) => {
      const dataPoint = { scenario: labels[idx], scenarioKey: scenario };
      
      sortedIndices.forEach((origIdx) => {
        const displayLabel = displayLabels[origIdx];
        const val = (contributions[scenario]?.[origIdx] || 0) * 100;
        if (val >= 0) {
          dataPoint[displayLabel + '_pos'] = val;
          dataPoint[displayLabel + '_neg'] = 0;
        } else {
          dataPoint[displayLabel + '_pos'] = 0;
          dataPoint[displayLabel + '_neg'] = val;
        }
        dataPoint[displayLabel] = val;
      });
      
      dataPoint.total = (contributions[scenario] || []).reduce((a, b) => a + b, 0) * 100;
      return dataPoint;
    });
    
    return {
      sortedIndices,
      sortedTickers: sortedDisplayLabels,
      tickerColors,
      chartData,
      contributions,
    };
  }, [simulationResults?.contributions]);
  
  // Positions tab: sorting, filtering, search
  const [positionSort, setPositionSort] = useState({ column: 'value', direction: 'desc' });
  const [positionFilter, setPositionFilter] = useState('all'); // 'all', 'long', 'short', 'etf', 'equity'
  const [positionSearch, setPositionSearch] = useState('');
  const [lastPriceRefresh, setLastPriceRefresh] = useState(0); // Timestamp to trigger re-sort after price refresh
  const [shouldRefreshAfterLogin, setShouldRefreshAfterLogin] = useState(false); // Flag to trigger price refresh after login

  // Beta calculations (vs SPY market proxy)
  const [positionBetas, setPositionBetas] = useState({});
  const [isFetchingBetas, setIsFetchingBetas] = useState(false);
  
  // ============================================
  // PORTFOLIO OPTIMIZATION TAB STATE
  // ============================================
  // Validate loaded optimization results - clear if missing critical fields
  const validatedOptResults = (() => {
    const saved = savedData?.optimizationResults;
    if (!saved) return null;
    // Check for critical fields
    if (!saved.current || !saved.positions || !Array.isArray(saved.positions)) {
      console.log('⚠️ Clearing invalid optimization results from localStorage');
      return null;
    }
    return saved;
  })();
  const [optimizationResults, setOptimizationResults] = useState(validatedOptResults);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState({ current: 0, total: 0, phase: '' });
  const [selectedSwap, setSelectedSwap] = useState(null); // { buyTicker, sellTicker }
  const [swapValidationResults, setSwapValidationResults] = useState(null);
  const [riskFreeRate, setRiskFreeRate] = useState(0.05); // 5% default
  const [swapSize, setSwapSize] = useState(savedData?.swapSize ?? 0.01); // 1% default swap size
  const [optimizationPaths, setOptimizationPaths] = useState(savedData?.optimizationPaths ?? 100000); // 100K default MC validation paths
  
  // Thematic ETF swap analysis results
  const [thematicSwapResults, setThematicSwapResults] = useState(null);
  const [isRunningThematicSwaps, setIsRunningThematicSwaps] = useState(false);
  const [thematicSwapProgress, setThematicSwapProgress] = useState({ current: 0, total: 0, phase: '' });
  
  // Full Load state - orchestrates complete initialization sequence
  const [isFullLoading, setIsFullLoading] = useState(false);
  const [fullLoadProgress, setFullLoadProgress] = useState({ step: 0, total: 8, phase: '', detail: '' });
  
  // Ref to hold runFullLoad function (defined later, used by keyboard handler)
  const runFullLoadRef = useRef(null);
  
  // ============================================
  // UI STATE: Confirmation Dialogs
  // ============================================
  const [confirmDialog, setConfirmDialog] = useState(null);
  
  // First-time user welcome banner
  const [showWelcome, setShowWelcome] = useState(() => {
    // Show welcome if user has never dismissed it
    return !localStorage.getItem('mc-welcome-dismissed');
  });
  
  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('mc-welcome-dismissed', 'true');
  };
  
  // Keyboard shortcuts help modal
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);

  // User guide modal
  const [showUserGuide, setShowUserGuide] = useState(false);

  // Add positions modal
  const [showAddPositionsModal, setShowAddPositionsModal] = useState(false);

  // Screenshot import modal
  const [showScreenshotImportModal, setShowScreenshotImportModal] = useState(false);

  // Command palette (Cmd+K)
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Recovery dialog state
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [recoveryData, setRecoveryData] = useState(null);

  // Undo/redo for positions
  const positionsHistoryRef = useRef([]);
  const positionsFutureRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Autosave status
  const [autosaveStatus, setAutosaveStatus] = useState(AutosaveStatus.IDLE);
  const [lastSaved, setLastSaved] = useState(null);

  // Debounce ref for ticker price fetch - prevents fetch while typing
  const tickerFetchTimeoutRef = useRef({});
  
  // ============================================
  // UNIFIED MARKET DATA
  // Single source of truth - fetched once, used everywhere
  // ============================================
  const [unifiedMarketData, setUnifiedMarketData] = useState({});
  const [isFetchingUnified, setIsFetchingUnified] = useState(false);
  const [unifiedFetchProgress, setUnifiedFetchProgress] = useState({ current: 0, total: 0, message: '' });
  
  // Load cached unified data on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(UNIFIED_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < UNIFIED_CACHE_MAX_AGE && data) {
          // Rehydrate data (compute derived fields that weren't stored)
          const rehydratedData = {};
          const spyData = data['SPY']; // Get SPY first for beta calculations
          
          // First pass: rehydrate SPY
          if (spyData) {
            rehydratedData['SPY'] = rehydrateTickerData(spyData, null);
          }
          
          // Second pass: rehydrate other tickers (using SPY for beta)
          for (const [ticker, d] of Object.entries(data)) {
            if (ticker !== 'SPY') {
              rehydratedData[ticker] = rehydrateTickerData(d, rehydratedData['SPY']);
            }
          }
          
          setUnifiedMarketData(rehydratedData);
          
          // Also populate legacy state from unified data
          const betas = {};
          const metadata = {};
          const yearReturns = {};
          Object.entries(rehydratedData).forEach(([ticker, d]) => {
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
              };
            }
            if (d.calendarYearReturns) {
              yearReturns[ticker] = d.calendarYearReturns;
            }
          });
          setPositionBetas(betas);
          setPositionMetadata(prev => ({ ...prev, ...metadata }));
          setCalendarYearReturns(prev => ({ ...prev, ...yearReturns }));
          
          const cacheSize = (cached.length / 1024).toFixed(1);
          console.log(`✅ Loaded unified cache: ${Object.keys(rehydratedData).length} tickers (${cacheSize}KB)`);
        }
      }
    } catch (e) {
      console.warn('Failed to load unified cache:', e);
    }
  }, []);

  // ============================================
  // SUPABASE SYNC - Load data on login
  // ============================================
  useEffect(() => {
    const loadServerData = async () => {
      if (!authState.isAuthenticated || hasLoadedFromServerRef.current) {
        return;
      }

      console.log('[App] User logged in, loading data from server...');
      hasLoadedFromServerRef.current = true;

      const { data, error } = await loadFromServer();

      if (error) {
        console.error('[App] Failed to load from server:', error);
        return;
      }

      if (data) {
        console.log('[App] Restoring state from server:', {
          positions: data.positions?.length || 0,
          hasCorrelation: !!data.editedCorrelation,
          hasSimulation: !!data.simulationResults,
          hasFactors: !!data.factorAnalysis,
          hasOptimization: !!data.optimizationResults,
        });

        // Restore positions
        if (data.positions && data.positions.length > 0) {
          setPositions(data.positions.map(p => ({
            id: p.id || Date.now() + Math.random(),
            ticker: p.ticker,
            quantity: p.quantity,
            price: p.price,
            avgCost: p.avgCost,
            type: p.type || 'Equity',
            p5: p.p5 ?? -0.25,
            p25: p.p25 ?? -0.05,
            p50: p.p50 ?? 0.08,
            p75: p.p75 ?? 0.20,
            p95: p.p95 ?? 0.40,
            // Currency fields for international stocks
            currency: p.currency || 'USD',
            domesticPrice: p.domesticPrice ?? null,
            exchangeRate: p.exchangeRate ?? 1,
          })));
        }

        // Restore cash balance
        if (data.cashBalance != null) {
          setCashBalance(data.cashBalance);
        }

        // Restore edited correlation
        if (data.editedCorrelation) {
          setEditedCorrelation(data.editedCorrelation);
          setCorrelationMethod(data.correlationMethod || 'shrinkage');
        }

        // Restore simulation results
        if (data.simulationResults) {
          setSimulationResults(data.simulationResults);
        }

        // Restore factor analysis
        if (data.factorAnalysis) {
          setFactorAnalysis(data.factorAnalysis);
        }

        // Restore optimization results
        if (data.optimizationResults) {
          setOptimizationResults(data.optimizationResults);
        }

        showToast({ type: 'success', message: 'Portfolio synced from cloud', duration: 3000 });

        // Auto-refresh prices after login to get current market data
        // Use a small delay to ensure positions state is updated first
        setTimeout(() => {
          console.log('[App] 🔄 Auto-refreshing prices after login...');
          // Set flag to trigger refresh in separate effect (refreshAllPrices defined later)
          setShouldRefreshAfterLogin(true);
        }, 500);
      }
    };

    loadServerData();
  }, [authState.isAuthenticated, loadFromServer, showToast]);

  // Track previous auth state to detect sign-out
  const wasAuthenticatedRef = useRef(authState.isAuthenticated);

  // Ref to track last saved positions (for deduping sync calls)
  const lastSavedPositionsRef = useRef(null);

  // Reset app state when user logs out
  useEffect(() => {
    const wasAuthenticated = wasAuthenticatedRef.current;
    const isAuthenticated = authState.isAuthenticated;

    // Update ref for next render
    wasAuthenticatedRef.current = isAuthenticated;

    // Only trigger reset on sign-out (was authenticated, now not)
    if (wasAuthenticated && !isAuthenticated) {
      console.log('[App] User signed out - resetting to default state');

      // Reset positions to default
      const defaultPositions = [
        { id: 1, ticker: 'SPY', quantity: 100, type: 'ETF', price: 450,
          p5: -0.20, p25: 0.02, p50: 0.10, p75: 0.18, p95: 0.35 },
        { id: 2, ticker: 'QQQ', quantity: 50, type: 'ETF', price: 380,
          p5: -0.30, p25: -0.02, p50: 0.12, p75: 0.26, p95: 0.50 },
        { id: 3, ticker: 'GLD', quantity: 30, type: 'ETF', price: 185,
          p5: -0.10, p25: 0.00, p50: 0.05, p75: 0.10, p95: 0.20 },
      ];
      setPositions(defaultPositions);

      // Reset cash balance
      setCashBalance(0);
      setCashRate(0.05);

      // Reset market data
      setHistoricalData({});
      setUnifiedMarketData({});
      setPositionBetas({});
      setPositionMetadata({});
      setCalendarYearReturns({});
      setFetchErrors([]);
      setDataSource('none');

      // Reset correlation
      setCorrelationMatrix(null);
      setEditedCorrelation(null);
      setCorrelationMethod('shrinkage');
      setCorrelationGroups(null);

      // Reset factor analysis
      setFactorData(null);
      setFactorAnalysis(null);
      setThematicOverrides({});

      // Reset simulation results
      setSimulationResults(null);

      // Reset optimization
      setOptimizationResults(null);
      setSelectedSwap(null);
      setSwapValidationResults(null);
      setThematicSwapResults(null);

      // Reset UI state
      setActiveTab('positions');
      setLagAnalysis(null);
      setUseLagAdjusted(false);

      // Reset server load flag
      hasLoadedFromServerRef.current = false;
      lastSavedPositionsRef.current = null;

      // Clear local storage for this app
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(UNIFIED_CACHE_KEY);
      localStorage.removeItem(FACTOR_CACHE_KEY);

      // Show toast notification
      showToast({
        type: 'info',
        message: 'Signed out successfully. Portfolio reset to defaults.',
        duration: 4000
      });
    }

    // Reset load flag when user logs out (original behavior)
    if (!isAuthenticated) {
      hasLoadedFromServerRef.current = false;
    }
  }, [authState.isAuthenticated, showToast]);

  // ============================================
  // SUPABASE SYNC - Save positions on change (debounced)
  // ============================================
  useEffect(() => {
    console.log('[App] Position sync effect triggered:', {
      isAuthenticated: authState.isAuthenticated,
      positionsCount: positions?.length || 0,
    });

    if (!authState.isAuthenticated || !positions || positions.length === 0) {
      console.log('[App] Skipping sync - not authenticated or no positions');
      return;
    }

    // Skip if positions haven't actually changed
    const positionsKey = JSON.stringify(positions.map(p => ({
      ticker: p.ticker, quantity: p.quantity, price: p.price,
      p5: p.p5, p25: p.p25, p50: p.p50, p75: p.p75, p95: p.p95,
      currency: p.currency, domesticPrice: p.domesticPrice, exchangeRate: p.exchangeRate
    })));

    if (positionsKey === lastSavedPositionsRef.current) {
      console.log('[App] Skipping sync - positions unchanged');
      return;
    }
    lastSavedPositionsRef.current = positionsKey;

    console.log('[App] 📤 Triggering position save to server...');
    // Debounced save
    savePositionsToServer(positions, cashBalance);
  }, [authState.isAuthenticated, positions, cashBalance, savePositionsToServer]);

  // ============================================
  // SUPABASE SYNC - Save correlation on change
  // ============================================
  useEffect(() => {
    if (!authState.isAuthenticated || !editedCorrelation) {
      return;
    }

    const tickers = positions.map(p => p.ticker);
    saveCorrelationToServer(editedCorrelation, correlationMethod, tickers);
  }, [authState.isAuthenticated, editedCorrelation, correlationMethod, positions, saveCorrelationToServer]);

  // ============================================
  // SUPABASE SYNC - Save simulation results on change
  // ============================================
  useEffect(() => {
    if (!authState.isAuthenticated || !simulationResults) {
      return;
    }

    // Only save if we have meaningful results
    if (simulationResults.mean != null || simulationResults.percentiles) {
      saveSimulationToServer(simulationResults);
    }
  }, [authState.isAuthenticated, simulationResults, saveSimulationToServer]);

  // ============================================
  // SUPABASE SYNC - Save factor results on change
  // ============================================
  useEffect(() => {
    if (!authState.isAuthenticated || !factorAnalysis) {
      return;
    }

    saveFactorsToServer(factorAnalysis);
  }, [authState.isAuthenticated, factorAnalysis, saveFactorsToServer]);

  // ============================================
  // SUPABASE SYNC - Save optimization results on change
  // ============================================
  useEffect(() => {
    if (!authState.isAuthenticated || !optimizationResults) {
      return;
    }

    saveOptimizationToServer(optimizationResults);
  }, [authState.isAuthenticated, optimizationResults, saveOptimizationToServer]);

  // Window resize listener for responsive header
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Responsive breakpoints
  const isCompact = windowWidth < 1400;
  const isNarrow = windowWidth < 1200;
  
  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input or if a modal is open
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
      }
      
      // Number keys 1-8 for tab switching
      if (e.key >= '1' && e.key <= '8' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const tabs = ['positions', 'consensus', 'distributions', 'correlation', 'simulation', 'factors', 'optimize', 'export'];
        const idx = parseInt(e.key) - 1;
        if (tabs[idx]) {
          e.preventDefault();
          setActiveTab(tabs[idx]);
          showToast({ type: 'info', message: `Switched to ${tabs[idx]} tab`, duration: 1500 });
        }
      }
      
      // ? for help (show shortcuts modal)
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowKeyboardShortcuts(true);
      }
      
      // Enter key for tab-specific primary action
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        
        switch (activeTab) {
          case 'positions':
            if (!isFetchingBetas && !isFetchingUnified && positions.length > 0) {
              calculateAllBetas();
              showToast({ type: 'info', message: '📈 Loading betas...', duration: 2000 });
            }
            break;
            
          case 'distributions':
            if (!isFetchingUnified && positions.length > 0) {
              // Trigger estimate all distributions
              fetchUnifiedMarketData(false);
              showToast({ type: 'info', message: '📊 Estimating distributions...', duration: 2000 });
            }
            break;
            
          case 'correlation':
            if (!isFetchingData && positions.length > 0) {
              // Trigger correlation computation
              fetchAndComputeCorrelation();
              showToast({ type: 'info', message: '🔗 Computing correlations...', duration: 2000 });
            }
            break;
            
          case 'simulation':
            if (editedCorrelation && !isSimulating) {
              runSimulation();
              showToast({ type: 'info', message: '🎲 Running simulation...', duration: 2000 });
            }
            break;
            
          case 'factors':
            if (factorData && !isFetchingFactors) {
              runFactorAnalysis(factorData);
              showToast({ type: 'info', message: '🧬 Running factor analysis...', duration: 2000 });
            }
            break;
            
          case 'optimize':
            if (!isOptimizing && positions.length >= 2) {
              runPortfolioOptimization();
              showToast({ type: 'info', message: '⚡ Running optimization...', duration: 2000 });
            }
            break;
            
          default:
            break;
        }
      }
      
      // Escape to close modals
      if (e.key === 'Escape') {
        if (showCommandPalette) {
          setShowCommandPalette(false);
        } else if (showKeyboardShortcuts) {
          setShowKeyboardShortcuts(false);
        }
      }

      // Cmd/Ctrl + key shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'k':
            e.preventDefault();
            setShowCommandPalette(true);
            break;
          case 's':
            e.preventDefault();
            exportPortfolio();
            break;
          case 'r':
            if (editedCorrelation && !isSimulating) {
              e.preventDefault();
              runSimulation();
            }
            break;
          case 'l':
            if (!isFetchingUnified && !isFullLoading && runFullLoadRef.current) {
              e.preventDefault();
              runFullLoadRef.current();
            }
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              // Redo
              handleRedo();
            } else {
              // Undo
              handleUndo();
            }
            break;
          case 'b':
            e.preventDefault();
            setSidebarExpanded(prev => {
              const newValue = !prev;
              localStorage.setItem('sidebar-expanded', JSON.stringify(newValue));
              return newValue;
            });
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  // Note: runFullLoad excluded to avoid circular dependency issues since it's defined later
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    editedCorrelation,
    isSimulating,
    isFetchingUnified,
    isFullLoading,
    isFetchingBetas,
    isFetchingFactors,
    isFetchingData,
    isOptimizing,
    positions.length,
    factorData,
    showKeyboardShortcuts,
    showCommandPalette,
    sidebarExpanded,
  ]);

  // ============================================
  // COMMAND PALETTE EXECUTION
  // Refs for functions defined later (to avoid stale closures)
  // ============================================
  const executeCommandRef = useRef(null);

  // ============================================
  // UNDO/REDO FOR POSITIONS
  // ============================================
  const recordPositionChange = useCallback((newPositions) => {
    // Add current positions to history
    positionsHistoryRef.current = [...positionsHistoryRef.current, positions];
    if (positionsHistoryRef.current.length > 50) {
      positionsHistoryRef.current = positionsHistoryRef.current.slice(-50);
    }
    // Clear future (new action invalidates redo)
    positionsFutureRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setPositions(newPositions);
  }, [positions]);

  const handleUndo = useCallback(() => {
    if (positionsHistoryRef.current.length === 0) return;
    const previous = positionsHistoryRef.current[positionsHistoryRef.current.length - 1];
    positionsHistoryRef.current = positionsHistoryRef.current.slice(0, -1);
    positionsFutureRef.current = [positions, ...positionsFutureRef.current];
    setPositions(previous);
    setCanUndo(positionsHistoryRef.current.length > 0);
    setCanRedo(true);
    showToast({ type: 'info', message: 'Undid last change', duration: 1500 });
  }, [positions, showToast]);

  const handleRedo = useCallback(() => {
    if (positionsFutureRef.current.length === 0) return;
    const next = positionsFutureRef.current[0];
    positionsFutureRef.current = positionsFutureRef.current.slice(1);
    positionsHistoryRef.current = [...positionsHistoryRef.current, positions];
    setPositions(next);
    setCanUndo(true);
    setCanRedo(positionsFutureRef.current.length > 0);
    showToast({ type: 'info', message: 'Redid last change', duration: 1500 });
  }, [positions, showToast]);

  // ============================================
  // AUTOSAVE
  // ============================================
  const autosaveTimeoutRef = useRef(null);

  useEffect(() => {
    // Debounced autosave on positions change
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    setAutosaveStatus(AutosaveStatus.IDLE);

    autosaveTimeoutRef.current = setTimeout(() => {
      setAutosaveStatus(AutosaveStatus.SAVING);
      try {
        saveToStorage({
          positions,
          correlationMethod,
          useEwma,
          useQmc,
          numPaths,
          fatTailMethod,
          cashBalance,
          cashRate,
          riskFreeRate,
          gldAsCash,
          simulationResults,
        });
        setLastSaved(new Date());
        setAutosaveStatus(AutosaveStatus.SAVED);
        setTimeout(() => setAutosaveStatus(AutosaveStatus.IDLE), 2000);
      } catch (e) {
        console.error('Autosave error:', e);
        setAutosaveStatus(AutosaveStatus.ERROR);
      }
    }, 1500);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [positions, correlationMethod, useEwma, useQmc, numPaths, fatTailMethod, cashBalance, cashRate, riskFreeRate, gldAsCash, simulationResults]);

  // ============================================
  // CRASH RECOVERY CHECK ON MOUNT
  // ============================================
  useEffect(() => {
    const recovery = checkRecoveryNeeded();
    if (recovery) {
      setRecoveryData(recovery);
      setShowRecoveryDialog(true);
    }
  }, []);

  const handleRecovery = useCallback(() => {
    if (recoveryData?.snapshot) {
      setPositions(recoveryData.snapshot);
      showToast({ type: 'success', message: 'Previous state recovered', duration: 3000 });
    }
    clearRecoveryState();
    setShowRecoveryDialog(false);
    setRecoveryData(null);
  }, [recoveryData, showToast]);

  const handleDiscardRecovery = useCallback(() => {
    clearRecoveryState();
    setShowRecoveryDialog(false);
    setRecoveryData(null);
    showToast({ type: 'info', message: 'Recovery data discarded', duration: 2000 });
  }, [showToast]);

  // MAIN UNIFIED FETCH - fetches everything in parallel
  const fetchUnifiedMarketData = async (forceRefresh = false) => {
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

    // ============================================
    // PHASE 0: FAST METRICS FETCH (Positions tab renders immediately)
    // ============================================
    // Fetch pre-computed metrics from Worker for position tickers only
    // This allows Positions tab to render while we fetch history for other tabs
    if (isWorkerAvailable() && tickers.length > 0) {
      setUnifiedFetchProgress({ current: 0, total: allTickers.length, message: 'Fetching metrics...' });
      try {
        const metricsStartTime = performance.now();
        const metrics = await fetchMetrics(tickers);

        if (metrics && Object.keys(metrics).length > 0) {
          console.log(`⚡ Metrics fetched in ${(performance.now() - metricsStartTime).toFixed(0)}ms for ${Object.keys(metrics).length} tickers`);

          // Set positionBetas immediately so Positions tab can render
          setPositionBetas(metrics);

          // Update position prices from latestPrice
          const priceUpdates = {};
          for (const [symbol, data] of Object.entries(metrics)) {
            if (data.latestPrice != null) {
              priceUpdates[symbol] = data.latestPrice;
            }
          }

          if (Object.keys(priceUpdates).length > 0) {
            setPositions(prev => prev.map(p => {
              const newPrice = priceUpdates[p.ticker?.toUpperCase()];
              if (newPrice != null && newPrice !== p.price) {
                return { ...p, price: newPrice };
              }
              return p;
            }));
            console.log(`💰 Updated prices for ${Object.keys(priceUpdates).length} positions from metrics`);
          }
        }
      } catch (err) {
        console.warn('[Metrics] Failed to fetch fast metrics, will compute locally:', err.message);
      }
    }
    // ============================================

    // Load persistent position price cache with fast parallel fetching
    // If cache exists, this only fetches new days (incremental) or new tickers
    // Parallel requests make this fast even with many positions
    let positionPriceCache = null;
    try {
      const { cache, updated, reason } = await updatePositionPriceCache(
        tickers,
        (current, total, ticker) => {
          setUnifiedFetchProgress({ current, total: tickers.length, message: `Updating prices: ${ticker}...` });
        }
      );
      positionPriceCache = cache;
      console.log(`💾 Position price cache: ${reason}${updated ? ' (updated)' : ''}`);
    } catch (err) {
      console.warn('[PositionCache] Failed to update cache:', err);
    }

    const newData = { ...unifiedMarketData };
    const errors = [];

    // Separate cached vs need-to-fetch
    const needsFetch = [];
    const cachedTickers = [];
    const historyResults = {};

    for (const ticker of allTickers) {
      const cached = newData[ticker];
      // Check in-memory cache first
      if (!forceRefresh && cached?.fetchedAt && Date.now() - cached.fetchedAt < UNIFIED_CACHE_MAX_AGE) {
        cachedTickers.push(ticker);
        // Map cached data to historyResults format, including FX metadata
        // cached.currency is the LOCAL currency, cached.closePrices are in LOCAL currency
        // cached.exchangeRate is the FX rate used for USD conversion
        const isNonUSD = cached.currency && cached.currency !== 'USD';
        historyResults[ticker] = {
          ticker,
          data: cached.closePrices,
          currency: cached.currency || 'USD',
          regularMarketPrice: cached.currentPrice,
          cached: true,
          // Include FX metadata so quickPriceUpdates uses the correct path
          ...(isNonUSD && {
            localCurrency: cached.currency,
            localPrices: cached.closePrices,
            fxRate: cached.exchangeRate || 1,
          }),
        };
      }
      // For position tickers, check persistent cache if not in memory
      else if (!forceRefresh && tickers.includes(ticker) && positionPriceCache) {
        const cachedPrices = getCachedPrices(positionPriceCache, ticker);
        if (cachedPrices && cachedPrices.length > 0) {
          cachedTickers.push(ticker);
          // Try to get currency from existing unified data if available
          const existingData = newData[ticker];
          const currency = existingData?.currency || 'USD';
          const isNonUSD = currency !== 'USD';
          historyResults[ticker] = {
            ticker,
            data: cachedPrices,
            currency,
            regularMarketPrice: existingData?.currentPrice,
            cached: true,
            fromPersistentCache: true,
            // Include FX metadata for non-USD tickers
            ...(isNonUSD && {
              localCurrency: currency,
              localPrices: cachedPrices,
              fxRate: existingData?.exchangeRate || 1,
            }),
          };
          console.log(`💾 Using persistent cache for ${ticker} (${cachedPrices.length} days, ${currency}${isNonUSD ? ` @${existingData?.exchangeRate}` : ''})`);
        } else {
          needsFetch.push(ticker);
        }
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
    
    // PARALLEL FETCH: Start BOTH history AND profile fetches simultaneously
    // This cuts total time nearly in half
    
    // Only need profiles for non-ETF tickers
    const tickersNeedingProfiles = allTickers
      .filter(t => !newData[t]?.name || forceRefresh)
      .filter(t => !inferETFSector(t, null)); // Skip known ETFs
    
    // Start profile fetches (don't await yet)
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
    
    // Fetch history with concurrency limiting (6 concurrent requests for optimal browser performance)
    const CONCURRENCY_LIMIT = 6;
    const historyFetchResults = [];
    const fetchQueue = [...needsFetch];

    const fetchWorker = async () => {
      while (fetchQueue.length > 0) {
        const ticker = fetchQueue.shift();
        if (!ticker) continue;

        try {
          // Request USD-converted prices from Worker (server handles FX conversion)
          const historyResult = await fetchYahooHistory(ticker, '5y', '1d', { currency: 'USD' });
          completedCount++;
          const daysCount = historyResult?.prices?.length || 0;
          setUnifiedFetchProgress({
            current: completedCount,
            total: allTickers.length,
            message: ticker,
            detail: `${daysCount} days`
          });
          historyFetchResults.push({
            ticker,
            data: historyResult?.prices || null,
            currency: historyResult?.currency || 'USD',
            regularMarketPrice: historyResult?.regularMarketPrice,
            // Worker-side FX conversion metadata
            localCurrency: historyResult?.localCurrency,
            localPrices: historyResult?.localPrices,
            fxRate: historyResult?.fxRate,
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

    // PHASE 1.5: Fetch exchange rates for non-USD currencies
    // Include currencies from BOTH newly fetched AND cached tickers
    const allCurrencies = new Set();

    // From newly fetched tickers
    historyFetchResults.forEach(r => {
      if (r.currency && r.currency !== 'USD') {
        allCurrencies.add(r.currency);
      }
    });

    // From cached tickers (check existing data or historyResults)
    Object.values(historyResults).forEach(r => {
      if (r.currency && r.currency !== 'USD') {
        allCurrencies.add(r.currency);
      }
    });

    // Also check in-memory cache for currencies
    Object.values(newData).forEach(d => {
      if (d.currency && d.currency !== 'USD') {
        allCurrencies.add(d.currency);
      }
    });

    const uniqueCurrencies = [...allCurrencies];

    const exchangeRates = { USD: 1 };
    if (uniqueCurrencies.length > 0) {
      console.log(`💱 Fetching exchange rates in parallel for: ${uniqueCurrencies.join(', ')}`);

      // Fetch all exchange rates in parallel
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

    // PHASE 1.6: EARLY PRICE UPDATE - Update positions immediately after FX rates
    // This gives users immediate feedback before heavy processing begins
    setUnifiedFetchProgress({
      current: allTickers.length,
      total: allTickers.length,
      message: 'Updating prices...'
    });

    // Build quick price map from history results (before full processing)
    // Worker now returns USD-converted prices with localCurrency/fxRate metadata
    const quickPriceUpdates = {};
    for (const ticker of tickers) { // Only position tickers, not factor ETFs
      const histResult = historyResults[ticker];
      if (histResult?.data?.length > 0) {
        const lastPrice = histResult.data[histResult.data.length - 1];
        const closePrice = typeof lastPrice === 'number' ? lastPrice : lastPrice?.close;

        // Worker provides USD-converted prices with metadata about original currency
        if (histResult.localCurrency && histResult.fxRate) {
          const localPrices = histResult.localPrices || [];
          const domesticPrice = localPrices.length > 0 ? localPrices[localPrices.length - 1] : closePrice;

          // For cached data: histResult.data contains LOCAL currency prices (closePrices)
          // For fresh Worker data: histResult.data contains USD-converted prices
          // Check if this is cached data by seeing if data matches localPrices
          const isCachedData = histResult.cached && localPrices.length > 0;
          const usdPrice = isCachedData
            ? domesticPrice * histResult.fxRate  // Convert local to USD
            : closePrice;  // Already in USD from Worker

          quickPriceUpdates[ticker] = {
            currentPrice: usdPrice,
            domesticPrice,
            currency: histResult.localCurrency, // Original currency for display
            exchangeRate: histResult.fxRate,
          };
        } else {
          // Fallback path: do client-side FX conversion if needed
          const currency = histResult.currency || 'USD';
          const rate = exchangeRates[currency] || 1;
          quickPriceUpdates[ticker] = {
            currentPrice: closePrice * rate,
            domesticPrice: closePrice,
            currency,
            exchangeRate: rate,
          };
        }
      } else if (newData[ticker]?.currentPrice) {
        // Use cached data if available
        const cached = newData[ticker];
        const currency = cached.currency || 'USD';
        const rate = exchangeRates[currency] || cached.exchangeRate || 1;
        // Recalculate USD price with fresh FX rate
        const domesticPrice = cached.domesticPrice || cached.currentPrice;
        quickPriceUpdates[ticker] = {
          currentPrice: domesticPrice * rate,
          domesticPrice,
          currency,
          exchangeRate: rate,
        };
      }
    }

    // Update positions with prices immediately
    if (Object.keys(quickPriceUpdates).length > 0) {
      setPositions(prevPositions => {
        return prevPositions.map(pos => {
          if (!pos.ticker) return pos;
          const update = quickPriceUpdates[pos.ticker.toUpperCase()];
          if (!update) return pos;

          console.log(`💱 Early update ${pos.ticker}: $${pos.price?.toFixed(2)} → $${update.currentPrice?.toFixed(2)} (${update.currency} ${update.domesticPrice?.toFixed(2)} @${update.exchangeRate?.toFixed(4)})`);
          return {
            ...pos,
            price: update.currentPrice,
            currency: update.currency,
            domesticPrice: update.domesticPrice,
            exchangeRate: update.exchangeRate,
          };
        });
      });
      console.log(`💰 Early price update: ${Object.keys(quickPriceUpdates).length} positions updated`);

      // Also update newData to keep it consistent with positions
      // This ensures refreshPricesFromUnified doesn't overwrite with stale cached data
      for (const [ticker, update] of Object.entries(quickPriceUpdates)) {
        if (newData[ticker]) {
          newData[ticker].currentPrice = update.currentPrice;
          newData[ticker].domesticPrice = update.domesticPrice;
          newData[ticker].currency = update.currency;
          newData[ticker].exchangeRate = update.exchangeRate;
        }
      }
    }

    // PHASE 2: Await profiles (should already be done or nearly done)
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
    
    // Add known ETF profiles
    allTickers.forEach(ticker => {
      if (!profiles[ticker]) {
        const known = inferETFSector(ticker, null);
        if (known) {
          profiles[ticker] = {
            sector: known.sector,
            industry: known.industry,
            longName: known.theme || ticker,
            quoteType: 'ETF',
          };
        }
      }
    });
    
    console.log(`📋 Profile fetch complete in ${(performance.now() - startTime).toFixed(0)}ms`);

    // PHASE 2.5: Fetch pre-computed derived metrics from Worker (if available)
    // This can significantly speed up processing by using cached beta/vol/distribution
    setUnifiedFetchProgress({
      current: allTickers.length,
      total: allTickers.length,
      message: 'Fetching pre-computed metrics from Worker...'
    });

    let workerDerivedMetrics = { betas: null, volatility: null, distributions: null, calendarReturns: null };
    if (isWorkerAvailable()) {
      try {
        workerDerivedMetrics = await fetchAllDerivedMetrics(allTickers);
        const workerHits = Object.values(workerDerivedMetrics).filter(v => v && Object.keys(v).length > 0).length;
        console.log(`⚡ Worker derived metrics: ${workerHits}/4 endpoints returned data`);
      } catch (err) {
        console.warn('Worker derived metrics fetch failed, will compute locally:', err.message);
      }
    }

    // PHASE 3: Process all data
    setUnifiedFetchProgress({
      current: allTickers.length,
      total: allTickers.length,
      message: 'Calculating betas & correlations...'
    });

    // First, get SPY data for beta calculation (with timestamps for international date alignment)
    const spyHistory = historyResults['SPY']?.data;
    const spyReturns = spyHistory ? computeDailyReturns(spyHistory) : [];
    const spyTimestamps = spyHistory ? spyHistory.slice(1).map(h => h.date?.getTime?.() || h.date) : [];
    const spyData = { returns: spyReturns, timestamps: spyTimestamps };

    // Log data summary
    console.log('📅 Data date ranges:');
    
    // Process each ticker with progress updates
    let processedCount = 0;
    const totalToProcess = allTickers.length;
    
    // Helper function to apply Worker metrics to processed data
    const applyWorkerMetrics = (processed, ticker) => {
      const workerBeta = workerDerivedMetrics.betas?.[ticker];
      const workerVol = workerDerivedMetrics.volatility?.[ticker];
      const workerDist = workerDerivedMetrics.distributions?.[ticker];
      const workerCalRet = workerDerivedMetrics.calendarReturns?.[ticker];

      if (workerBeta && workerBeta.beta != null) {
        processed.beta = workerBeta.beta;
        processed.correlation = workerBeta.correlation;
        processed.workerSource = true;
      }
      if (workerVol && workerVol.annualizedVol != null) {
        // Worker returns volatility as decimal (0.238), convert to percentage (23.8)
        processed.volatility = workerVol.annualizedVol * 100;
        processed.ytdReturn = workerVol.ytdReturn;
        processed.oneYearReturn = workerVol.oneYearReturn;
        processed.thirtyDayReturn = workerVol.thirtyDayReturn;
      }
      if (workerDist && workerDist.p50 != null) {
        processed.distribution = {
          p5: workerDist.p5,
          p25: workerDist.p25,
          p50: workerDist.p50,
          p75: workerDist.p75,
          p95: workerDist.p95,
        };
      }
      if (workerCalRet && workerCalRet.years) {
        processed.calendarYearReturns = workerCalRet.years;
      }
    };

    for (const ticker of allTickers) {
      const histResult = historyResults[ticker];

      // FIX: Even if history is cached, still apply Worker metrics (they may be fresher)
      if (histResult?.cached && newData[ticker]) {
        // Apply Worker metrics to existing cached data
        applyWorkerMetrics(newData[ticker], ticker);
        processedCount++;
        continue; // Skip re-processing, but Worker metrics are now applied
      }

      const history = histResult?.data;
      const profile = profiles[ticker] || newData[ticker] || {};

      // Worker returns prices already in USD with localCurrency/localPrices/fxRate metadata
      // Use the local currency info for proper display, fall back to old behavior if not available
      const hasWorkerFxData = histResult?.localCurrency && histResult?.fxRate;
      const currency = hasWorkerFxData ? histResult.localCurrency : (histResult?.currency || 'USD');
      const exchangeRate = hasWorkerFxData ? histResult.fxRate : (exchangeRates[currency] || 1);

      if (history && history.length > 10) {
        // Log date range for this ticker
        const startDate = history[0]?.date?.toLocaleDateString() || 'N/A';
        const endDate = history[history.length - 1]?.date?.toLocaleDateString() || 'N/A';
        const years = (history.length / 252).toFixed(1);
        const currencyNote = currency !== 'USD' ? ` [${currency}→USD @${exchangeRate.toFixed(4)}]` : '';
        console.log(`   ${ticker}: ${history.length} days (~${years}yr) from ${startDate} to ${endDate}${currencyNote}`);

        // If Worker converted to USD, we need to pass local prices for domesticPrice calculation
        // processTickerData expects history in local currency, so if Worker converted, use localPrices
        let historyForProcessing = history;
        if (hasWorkerFxData && histResult.localPrices?.length > 0) {
          // Create history array with local currency prices for processTickerData
          // This ensures domesticPrice is set correctly to the local currency value
          historyForProcessing = history.map((h, i) => ({
            ...h,
            close: histResult.localPrices[i] ?? h.close
          }));
        }

        const processed = processTickerData(ticker, historyForProcessing, profile, spyData, currency, exchangeRate);

        // Override with Worker-computed metrics if available (faster, pre-cached)
        applyWorkerMetrics(processed, ticker);

        newData[ticker] = processed;
      } else if (!newData[ticker]) {
        newData[ticker] = { ticker, error: 'No data available' };
        errors.push(`${ticker}: No historical data available`);
      }

      processedCount++;
      // Update progress during processing phase (throttled to every 10 tickers to reduce re-renders)
      if (processedCount % 10 === 0 || processedCount === totalToProcess) {
        setUnifiedFetchProgress({
          current: allTickers.length,
          total: allTickers.length,
          message: `Processing ${ticker}... (${processedCount}/${totalToProcess})`
        });
        // Allow UI to update
        await new Promise(r => setTimeout(r, 0));
      }
    }
    
    // Update all state from unified data
    const betas = {};
    const metadata = {};
    const yearReturns = {};
    
    Object.entries(newData).forEach(([ticker, d]) => {
      // FIX: Populate betas even when beta is null - volatility/returns/sparkline should still show
      // Only skip if there's truly no useful data at all
      const hasAnyMetric = d.beta != null || d.volatility != null || d.sparkline?.length > 0 || d.ytdReturn != null;
      if (hasAnyMetric) {
        betas[ticker] = {
          beta: d.beta,              // May be null for very new tickers
          correlation: d.correlation,
          volatility: d.volatility,
          ytdReturn: d.ytdReturn,
          oneYearReturn: d.oneYearReturn,
          sparklineData: d.sparkline,
          betaLag: d.betaLag,        // Track lag used for international stocks
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
    
    // PHASE 4: Compute factor spreads for factor analysis
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: 'Computing factor spreads...' 
    });
    
    const computedFactorData = {};
    const spy = newData['SPY']?.dailyReturns || [];
    
    if (spy.length > 50) {
      // Copy raw ETF returns
      ['SPY', 'IWM', 'IWD', 'IWF', 'MTUM', 'QUAL', 'SPLV', ...Object.keys(THEMATIC_ETFS)].forEach(etf => {
        if (newData[etf]?.dailyReturns?.length > 50) {
          computedFactorData[etf] = {
            returns: newData[etf].dailyReturns,
            timestamps: newData[etf].timestamps?.slice(1) || [], // timestamps align with returns (returns[0] is from day 1-2)
            totalReturn: newData[etf].oneYearReturn || 0,
          };
        }
      });
      
      // Compute factor spreads
      const iwm = newData['IWM']?.dailyReturns || [];
      const iwd = newData['IWD']?.dailyReturns || [];
      const iwf = newData['IWF']?.dailyReturns || [];
      const mtum = newData['MTUM']?.dailyReturns || [];
      const qual = newData['QUAL']?.dailyReturns || [];
      const splv = newData['SPLV']?.dailyReturns || [];
      
      // SMB = IWM - SPY (Size: Small minus Big)
      const spyTimestamps = newData['SPY']?.timestamps?.slice(1) || [];
      if (iwm.length === spy.length && iwm.length > 0) {
        const smbReturns = spy.map((s, i) => (iwm[i] || 0) - s);
        computedFactorData['SMB'] = {
          returns: smbReturns,
          timestamps: spyTimestamps, // Use SPY's timestamps
          totalReturn: (newData['IWM']?.oneYearReturn || 0) - (newData['SPY']?.oneYearReturn || 0),
          name: 'Size (Small-Big)',
        };
      }
      
      // HML = IWD - IWF (Value: High minus Low book-to-market)
      if (iwd.length === iwf.length && iwd.length > 0) {
        const hmlReturns = iwd.map((v, i) => v - (iwf[i] || 0));
        computedFactorData['HML'] = {
          returns: hmlReturns,
          timestamps: spyTimestamps, // Use SPY's timestamps
          totalReturn: (newData['IWD']?.oneYearReturn || 0) - (newData['IWF']?.oneYearReturn || 0),
          name: 'Value (High-Low)',
        };
      }
      
      // MOM = MTUM - SPY (Momentum)
      if (mtum.length === spy.length && mtum.length > 0) {
        const momReturns = spy.map((s, i) => (mtum[i] || 0) - s);
        computedFactorData['MOM'] = {
          returns: momReturns,
          timestamps: spyTimestamps, // Use SPY's timestamps
          totalReturn: (newData['MTUM']?.oneYearReturn || 0) - (newData['SPY']?.oneYearReturn || 0),
          name: 'Momentum',
        };
      }
      
      // QUAL excess (Quality)
      if (qual.length === spy.length && qual.length > 0) {
        computedFactorData['QUAL_FACTOR'] = {
          returns: spy.map((s, i) => (qual[i] || 0) - s),
          timestamps: spyTimestamps,
          totalReturn: (newData['QUAL']?.oneYearReturn || 0) - (newData['SPY']?.oneYearReturn || 0),
          name: 'Quality',
        };
      }
      
      // LVOL excess (Low Volatility)
      if (splv.length === spy.length && splv.length > 0) {
        computedFactorData['LVOL'] = {
          returns: spy.map((s, i) => (splv[i] || 0) - s),
          timestamps: spyTimestamps,
          totalReturn: (newData['SPLV']?.oneYearReturn || 0) - (newData['SPY']?.oneYearReturn || 0),
          name: 'Low Volatility',
        };
      }
      
      console.log(`📊 Computed ${Object.keys(computedFactorData).length} factor/ETF series for factor analysis`);
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
    
    // Set factor data if we computed it
    if (Object.keys(computedFactorData).length > 0) {
      setFactorData(computedFactorData);
    }
    
    if (errors.length > 0) {
      setFetchErrors(errors);
    }
    
    // Cache to localStorage (with slimmed data)
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: 'Saving to cache...' 
    });
    
    try {
      // Prepare slimmed data for storage (drops recomputable fields)
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
    
    // Brief pause to show completion before hiding
    setUnifiedFetchProgress({ 
      current: allTickers.length, 
      total: allTickers.length, 
      message: `✓ Complete! ${Object.keys(newData).length} tickers loaded in ${(elapsed/1000).toFixed(1)}s` 
    });
    await new Promise(r => setTimeout(r, 800));
    
    setUnifiedFetchProgress({ current: 0, total: 0, message: '' });
    setIsFetchingUnified(false);
    
    // Show success toast
    const loadedCount = Object.keys(newData).length;
    showToast({
      type: 'success',
      title: 'Data Loaded',
      message: `${loadedCount} tickers loaded in ${(elapsed/1000).toFixed(1)}s`,
      duration: 3000,
    });
    
    return newData;
  };
  
  // Update prices from unified data (faster than separate fetch)
  // Can accept data directly to avoid stale closure issues
  const refreshPricesFromUnified = (dataSource = null) => {
    const marketData = dataSource || unifiedMarketData;
    let updatedCount = 0;
    
    // Use functional update to ensure we have fresh positions
    setPositions(prevPositions => {
      return prevPositions.map(pos => {
        if (!pos.ticker) return pos;
        
        const data = marketData[pos.ticker.toUpperCase()];
        if (!data?.currentPrice) return pos;
        
        // Check if any data has changed
        const priceChanged = data.currentPrice !== pos.price;
        const currencyChanged = data.currency && data.currency !== pos.currency;
        const domesticChanged = data.domesticPrice && data.domesticPrice !== pos.domesticPrice;
        
        if (priceChanged || currencyChanged || domesticChanged) {
          updatedCount++;
          console.log(`💱 Updating ${pos.ticker}: $${pos.price?.toFixed(2)} → $${data.currentPrice?.toFixed(2)} (${data.currency} ${data.domesticPrice?.toFixed(2)} @${data.exchangeRate?.toFixed(4)})`);
          return {
            ...pos,
            price: data.currentPrice,
            currency: data.currency || 'USD',
            domesticPrice: data.domesticPrice || data.currentPrice,
            exchangeRate: data.exchangeRate || 1,
          };
        }
        return pos;
      });
    });
    
    return updatedCount;
  };
  
  // Apply distribution estimates from unified data to positions
  const applyDistributionsFromUnified = () => {
    let updated = 0;
    const spyData = unifiedMarketData['SPY'];
    const rehydratedUpdates = {};
    
    setPositions(prev => prev.map(pos => {
      if (!pos.ticker) return pos;
      let data = unifiedMarketData[pos.ticker.toUpperCase()];
      
      // Rehydrate if needed
      if (data && !data.distribution) {
        data = rehydrateTickerData(data, spyData);
        rehydratedUpdates[pos.ticker.toUpperCase()] = data;
      }
      
      if (data?.distribution) {
        updated++;
        return {
          ...pos,
          p5: data.distribution.p5,
          p25: data.distribution.p25,
          p50: data.distribution.p50,
          p75: data.distribution.p75,
          p95: data.distribution.p95,
        };
      }
      return pos;
    }));
    
    // Update unified data with any rehydrated tickers
    if (Object.keys(rehydratedUpdates).length > 0) {
      setUnifiedMarketData(prev => ({ ...prev, ...rehydratedUpdates }));
    }
    
    return updated;
  };
  
  // Fetch sector/industry metadata for all positions
  const fetchAllMetadata = async () => {
    setIsFetchingMetadata(true);
    const metadata = {};
    
    for (const pos of positions) {
      if (!pos.ticker) continue;
      const ticker = pos.ticker.toUpperCase();
      
      // First check our known stock/ETF mappings (more reliable for semicap, etc.)
      const knownMapping = inferETFSector(ticker, null);
      
      if (knownMapping) {
        metadata[ticker] = {
          sector: knownMapping.sector,
          industry: knownMapping.industry,
          subIndustry: knownMapping.subIndustry || knownMapping.theme,
          name: ticker,
          source: 'known-mapping',
        };
        console.log(`${ticker}: ${knownMapping.sector} / ${knownMapping.industry} (known)`);
        continue; // Skip Yahoo API call
      }
      
      // Add delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
      
      // Try to get profile from Yahoo
      const profile = await fetchYahooProfile(ticker);
      
      if (profile && profile.sector) {
        metadata[ticker] = {
          sector: profile.sector,
          industry: profile.industry,
          name: profile.longName || profile.shortName,
          source: 'yahoo',
        };
        console.log(`${ticker}: ${profile.sector} / ${profile.industry} (yahoo)`);
      } else {
        // Try to infer from name
        const quote = await fetchYahooQuote(ticker);
        const inferred = inferETFSector(ticker, quote?.name);
        
        if (inferred) {
          metadata[ticker] = {
            sector: inferred.sector,
            industry: inferred.industry,
            theme: inferred.theme,
            name: quote?.name,
            source: 'inferred',
          };
          console.log(`${ticker}: ${inferred.sector} / ${inferred.industry} (inferred)`);
        } else {
          metadata[ticker] = {
            sector: 'Unknown',
            industry: 'Unknown',
            name: quote?.name || ticker,
            source: 'unknown',
          };
          console.log(`${ticker}: Unknown sector/industry`);
        }
      }
    }
    
    setPositionMetadata(metadata);
    setIsFetchingMetadata(false);
    
    // Auto-detect groups
    detectCorrelationGroups(metadata);
    
    return metadata;
  };
  
  // Auto-detect correlation groups from metadata - uses position IDs not tickers
  // Group format: { groupName: [positionId1, positionId2, ...] }
  const detectCorrelationGroups = (metadata) => {
    const groups = {};
    
    // Group by industry (more specific) - using position IDs
    for (const pos of positions) {
      if (!pos.ticker) continue;
      const ticker = pos.ticker.toUpperCase();
      const data = metadata[ticker];
      if (!data) continue;
      
      const industry = data.industry || data.sector || 'Unknown';
      if (!groups[industry]) {
        groups[industry] = [];
      }
      groups[industry].push(pos.id); // Use position ID
    }
    
    // Filter out single-member groups and Unknown
    const meaningfulGroups = {};
    for (const [industry, posIds] of Object.entries(groups)) {
      if (posIds.length > 1 && industry !== 'Unknown') {
        meaningfulGroups[industry] = posIds;
      }
    }
    
    // Also create broader sector groups
    const sectorGroups = {};
    for (const pos of positions) {
      if (!pos.ticker) continue;
      const ticker = pos.ticker.toUpperCase();
      const data = metadata[ticker];
      if (!data) continue;
      
      const sector = data.sector || 'Unknown';
      if (!sectorGroups[sector]) {
        sectorGroups[sector] = [];
      }
      sectorGroups[sector].push(pos.id);
    }
    
    // Add sector groups that have multiple members not already covered by industry
    for (const [sector, posIds] of Object.entries(sectorGroups)) {
      if (posIds.length > 1 && sector !== 'Unknown') {
        const alreadyCovered = Object.values(meaningfulGroups).flat();
        const uncoveredInSector = posIds.filter(id => !alreadyCovered.includes(id));
        if (uncoveredInSector.length > 1) {
          meaningfulGroups[`${sector} (Other)`] = posIds;
        }
      }
    }
    
    setCorrelationGroups(meaningfulGroups);
    console.log('Detected correlation groups:', meaningfulGroups);
    
    return meaningfulGroups;
  };
  
  // Helper to get display name for a position (handles duplicates)
  const getPositionDisplayName = (posId) => {
    const pos = positions.find(p => p.id === posId);
    if (!pos) return 'Unknown';
    
    // Check if there are duplicate tickers
    const ticker = pos.ticker?.toUpperCase();
    const duplicates = positions.filter(p => p.ticker?.toUpperCase() === ticker);
    
    if (duplicates.length > 1) {
      const idx = duplicates.findIndex(p => p.id === posId) + 1;
      return `${pos.ticker} #${idx}`;
    }
    return pos.ticker || 'Unknown';
  };
  
  // Get position index in the positions array (for correlation matrix)
  const getPositionIndex = (posId) => {
    return positions.findIndex(p => p.id === posId);
  };
  
  // Apply correlation floors based on user-edited correlation groups (uses position IDs)
  // Optional groupsOverride parameter allows passing groups directly (for Load All flow)
  const applyCorrelationFloors = (groupFloor = 0.55, groupsOverride = null) => {
    const activeGroups = groupsOverride || correlationGroups;
    if (!editedCorrelation || !activeGroups) return { adjustments: [], matrix: null };

    const n = positions.length;
    const newCorr = editedCorrelation.map(row => [...row]);
    let adjustments = [];

    // Build a map of position ID -> groups it belongs to
    const posIdToGroups = {};
    for (const [group, posIds] of Object.entries(activeGroups)) {
      for (const posId of posIds) {
        if (!posIdToGroups[posId]) posIdToGroups[posId] = [];
        posIdToGroups[posId].push(group);
      }
    }
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const posId1 = positions[i]?.id;
        const posId2 = positions[j]?.id;
        
        // Check if they share any correlation group
        const groups1 = posIdToGroups[posId1] || [];
        const groups2 = posIdToGroups[posId2] || [];
        const sharedGroups = groups1.filter(g => groups2.includes(g));
        
        if (sharedGroups.length > 0) {
          // Apply floor if current correlation is below it
          if (newCorr[i][j] < groupFloor) {
            adjustments.push({
              ticker1: getPositionDisplayName(posId1),
              ticker2: getPositionDisplayName(posId2),
              from: newCorr[i][j],
              to: groupFloor,
              reason: `Same group: ${sharedGroups[0]}`,
            });
            newCorr[i][j] = groupFloor;
            newCorr[j][i] = groupFloor;
          }
        }
      }
    }
    
    if (adjustments.length > 0) {
      setEditedCorrelation(newCorr);
      console.log('Correlation adjustments:', adjustments);
    }
    
    // Return both adjustments and the modified matrix for immediate use
    return { adjustments, matrix: newCorr };
  };
  
  // Auto-save to localStorage when key data changes
  useEffect(() => {
    // Save simulation results - trim large distribution arrays to avoid localStorage limits
    const trimDistribution = (arr, maxLen = 1000) => {
      if (!arr || arr.length <= maxLen) return arr;
      // Sample evenly across the sorted array to preserve distribution shape
      const step = arr.length / maxLen;
      return Array.from({ length: maxLen }, (_, i) => arr[Math.floor(i * step)]);
    };
    
    const trimmedSimResults = simulationResults ? {
      terminal: {
        p5: simulationResults.terminal?.p5,
        p10: simulationResults.terminal?.p10,
        p25: simulationResults.terminal?.p25,
        p50: simulationResults.terminal?.p50,
        p75: simulationResults.terminal?.p75,
        p90: simulationResults.terminal?.p90,
        p95: simulationResults.terminal?.p95,
        mean: simulationResults.terminal?.mean,
        // Trim distribution for storage but keep enough for histogram
        distribution: trimDistribution(simulationResults.terminal?.distribution),
      },
      terminalDollars: {
        p5: simulationResults.terminalDollars?.p5,
        p10: simulationResults.terminalDollars?.p10,
        p25: simulationResults.terminalDollars?.p25,
        p50: simulationResults.terminalDollars?.p50,
        p75: simulationResults.terminalDollars?.p75,
        p90: simulationResults.terminalDollars?.p90,
        p95: simulationResults.terminalDollars?.p95,
        mean: simulationResults.terminalDollars?.mean,
        startingValue: simulationResults.terminalDollars?.startingValue,
        distribution: trimDistribution(simulationResults.terminalDollars?.distribution),
      },
      drawdown: {
        p50: simulationResults.drawdown?.p50,
        p75: simulationResults.drawdown?.p75,
        p90: simulationResults.drawdown?.p90,
        p95: simulationResults.drawdown?.p95,
        p99: simulationResults.drawdown?.p99,
        distribution: trimDistribution(simulationResults.drawdown?.distribution),
      },
      // Keep terminalReturns for loss scenario analysis (trimmed to 2000 samples)
      terminalReturns: trimDistribution(simulationResults.terminalReturns, 2000),
      probLoss: simulationResults.probLoss,
      expectedReturn: simulationResults.expectedReturn,
      expectedVol: simulationResults.expectedVol,
      portfolioValue: simulationResults.portfolioValue,
      contributions: simulationResults.contributions,
      savedAt: new Date().toISOString(),
    } : null;
    
    // Trim optimization results for storage (remove large arrays)
    const trimmedOptResults = optimizationResults ? {
      timestamp: optimizationResults.timestamp,
      computeTime: optimizationResults.computeTime,
      pathsPerScenario: optimizationResults.pathsPerScenario,
      useQmc: optimizationResults.useQmc,
      leverageRatio: optimizationResults.leverageRatio,
      effectiveCashWeight: optimizationResults.effectiveCashWeight,
      current: optimizationResults.current,
      positions: optimizationResults.positions,
      // Keep top swaps but trim to top 10
      topSwaps: optimizationResults.topSwaps?.slice(0, 10),
      baselineMC: optimizationResults.baselineMC,
      riskParity: optimizationResults.riskParity,
      // Don't save the full swap matrix - too large
    } : null;
    
    const dataToSave = {
      positions,
      correlationMatrix,
      editedCorrelation,
      numPaths,
      gldAsCash,
      correlationMethod,
      useEwma,
      fatTailMethod,
      useQmc,
      drawdownThreshold,
      cashBalance,
      cashRate,
      swapSize,
      optimizationPaths,
      positionMetadata,
      correlationGroups,
      simulationResults: trimmedSimResults,
      optimizationResults: trimmedOptResults,
      calendarYearReturns,
      savedAt: new Date().toISOString(),
    };
    saveToStorage(dataToSave);
  }, [positions, correlationMatrix, editedCorrelation, numPaths, gldAsCash, correlationMethod, useEwma, fatTailMethod, useQmc, drawdownThreshold, cashBalance, cashRate, swapSize, optimizationPaths, positionMetadata, correlationGroups, simulationResults, optimizationResults, calendarYearReturns]);
  
  // Export portfolio as JSON file
  const exportPortfolio = () => {
    // Ensure all position data including distributions is exported
    const exportPositions = positions.map(pos => {
      const derived = getDistributionParams(pos);
      return {
        // Basic info
        id: pos.id,
        ticker: pos.ticker,
        quantity: pos.quantity,
        price: pos.price,
        type: pos.type,
        // Return distribution (percentiles)
        p5: pos.p5,
        p25: pos.p25,
        p50: pos.p50,
        p75: pos.p75,
        p95: pos.p95,
        // Derived parameters (for reference)
        _derived: {
          mu: derived.mu,
          sigma: derived.sigma,
          skew: derived.skew,
          tailDf: derived.tailDf,
        },
      };
    });
    
    const data = {
      version: '5.2',
      exportedAt: new Date().toISOString(),
      positions: exportPositions,
      cash: {
        balance: cashBalance,
        rate: cashRate,
      },
      correlationMatrix,
      editedCorrelation,
      settings: {
        numPaths,
        gldAsCash,
        correlationMethod,
        useEwma,
        fatTailMethod,
        useQmc,
        drawdownThreshold,
      },
      // Include metadata for context (not required for simulation)
      _metadata: {
        positionMetadata,
        correlationGroups,
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast({
      type: 'success',
      title: 'Portfolio Exported',
      message: `${positions.length} positions saved to file`,
      duration: 3000,
    });
  };
  
  // Import portfolio from JSON file
  const importPortfolio = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        // Handle positions (strip _derived if present, it's just for reference)
        if (data.positions) {
          const importedPositions = data.positions.map(pos => {
            const { _derived, ...rest } = pos;
            return rest;
          });
          setPositions(importedPositions);
        }
        
        if (data.correlationMatrix) setCorrelationMatrix(data.correlationMatrix);
        if (data.editedCorrelation) setEditedCorrelation(data.editedCorrelation);
        
        // Handle cash
        if (data.cash) {
          if (data.cash.balance !== undefined) setCashBalance(data.cash.balance);
          if (data.cash.rate !== undefined) setCashRate(data.cash.rate);
        }
        
        // Handle settings (new format) or old flat format
        if (data.settings) {
          if (data.settings.numPaths) setNumPaths(data.settings.numPaths);
          if (data.settings.gldAsCash !== undefined) setGldAsCash(data.settings.gldAsCash);
          if (data.settings.correlationMethod) setCorrelationMethod(data.settings.correlationMethod);
          if (data.settings.useEwma !== undefined) setUseEwma(data.settings.useEwma);
          if (data.settings.fatTailMethod) setFatTailMethod(data.settings.fatTailMethod);
          if (data.settings.useQmc !== undefined) setUseQmc(data.settings.useQmc);
          if (data.settings.drawdownThreshold) setDrawdownThreshold(data.settings.drawdownThreshold);
        } else {
          // Old format compatibility
          if (data.numPaths) setNumPaths(data.numPaths);
          if (data.gldAsCash !== undefined) setGldAsCash(data.gldAsCash);
          if (data.correlationMethod) setCorrelationMethod(data.correlationMethod);
          if (data.useEwma !== undefined) setUseEwma(data.useEwma);
          if (data.fatTailMethod) setFatTailMethod(data.fatTailMethod);
          if (data.useQmc !== undefined) setUseQmc(data.useQmc);
          if (data.drawdownThreshold) setDrawdownThreshold(data.drawdownThreshold);
        }
        
        // Handle optional metadata (v5.2+)
        if (data._metadata) {
          if (data._metadata.positionMetadata) setPositionMetadata(data._metadata.positionMetadata);
          if (data._metadata.correlationGroups) setCorrelationGroups(data._metadata.correlationGroups);
        }
        
        showToast({ type: 'success', title: 'Import Successful', message: 'Portfolio imported successfully!' });
      } catch (err) {
        showToast({ type: 'error', title: 'Import Failed', message: err.message });
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be imported again
    event.target.value = '';
  };
  
  // Reset to defaults
  const resetPortfolio = () => {
    setPositions([
      { id: 1, ticker: 'SPY', quantity: 100, type: 'ETF', price: 450, p5: -0.20, p25: 0.02, p50: 0.10, p75: 0.18, p95: 0.35 },
      { id: 2, ticker: 'QQQ', quantity: 50, type: 'ETF', price: 380, p5: -0.30, p25: -0.02, p50: 0.12, p75: 0.26, p95: 0.50 },
      { id: 3, ticker: 'GLD', quantity: 30, type: 'ETF', price: 185, p5: -0.10, p25: 0.00, p50: 0.05, p75: 0.10, p95: 0.20 },
    ]);
    setCorrelationMatrix(null);
    setEditedCorrelation(null);
    setSimulationResults(null);
    setNumPaths(10000);
    setGldAsCash(false);
    setCorrelationMethod('shrinkage');
    setUseEwma(true);
    setDrawdownThreshold(20);
    setCashBalance(0);
    setCashRate(0.05);
  };
  
  // Calculate portfolio values
  // For portfolios with shorts, we need both net and gross exposure
  const { netPositionsValue, grossPositionsValue } = useMemo(() => {
    let net = 0;
    let gross = 0;
    for (const p of positions) {
      const val = p.quantity * p.price;
      net += val;
      gross += Math.abs(val);
    }
    return { netPositionsValue: net, grossPositionsValue: gross };
  }, [positions]);
  
  // For backwards compatibility
  const positionsValue = netPositionsValue;
  
  // Total portfolio value including cash (net asset value)
  const portfolioValue = useMemo(() => {
    return netPositionsValue + cashBalance;
  }, [netPositionsValue, cashBalance]);
  
  // Calculate weights using GROSS exposure to handle shorts properly
  // This ensures weights sum to ~1 for long-only, or can exceed 1 for leveraged portfolios
  const weights = useMemo(() => {
    if (grossPositionsValue === 0) return positions.map(() => 0);
    // Weights are relative to gross exposure, preserving sign for shorts
    return positions.map(p => (p.quantity * p.price) / grossPositionsValue);
  }, [positions, grossPositionsValue]);
  
  // Cash weight relative to portfolio NAV
  const cashWeight = useMemo(() => {
    if (portfolioValue === 0) return 0;
    return cashBalance / portfolioValue;
  }, [cashBalance, portfolioValue]);

  // Wrapper for simulation hook - passes current portfolio data
  const runSimulation = useCallback((correlationMatrix = null) => {
    // Handle case where this is called from onClick (receives MouseEvent) vs programmatically
    const corrMatrix = (Array.isArray(correlationMatrix) && correlationMatrix.length > 0)
      ? correlationMatrix
      : editedCorrelation;

    return runSimulationHook({
      correlationMatrix: corrMatrix,
      positions,
      weights,
      portfolioValue,
      grossPositionsValue,
      cashBalance,
      cashRate,
      getDistributionParams,
    });
  }, [runSimulationHook, editedCorrelation, positions, weights, portfolioValue, grossPositionsValue, cashBalance, cashRate, getDistributionParams]);

  // Add position
  const addPosition = () => {
    setPositions(prev => {
      const newId = Math.max(0, ...prev.map(p => p.id)) + 1;
      return [...prev, {
        id: newId,
        ticker: '',
        quantity: 0,
        type: 'Equity',
        price: 100,
        p5: -0.25,
        p25: -0.02,
        p50: 0.08,
        p75: 0.18,
        p95: 0.40,
      }];
    });
  };
  
  // Add multiple positions at once (from modal)
  // Includes currency info for international stocks
  const addPositionsBatch = useCallback((newPositions) => {
    if (!newPositions || newPositions.length === 0) return;
    
    setPositions(prev => {
      let nextId = Math.max(0, ...prev.map(p => p.id)) + 1;
      
      const positionsToAdd = newPositions.map(p => ({
        id: nextId++,
        ticker: p.ticker.toUpperCase(),
        quantity: p.quantity,
        type: 'Equity',
        price: p.price || 100,
        currency: p.currency || 'USD',
        domesticPrice: p.domesticPrice || p.price || 100,
        p5: -0.25,
        p25: -0.02,
        p50: 0.08,
        p75: 0.18,
        p95: 0.40,
      }));
      
      return [...prev, ...positionsToAdd];
    });
    
    // Show toast
    if (typeof toast === 'function') {
      toast.success(`Added ${newPositions.length} position${newPositions.length > 1 ? 's' : ''}`);
    }
  }, []);
  
  // Fetch price for a single ticker (used by AddPositionsModal)
  // Tries ticker variations for international stocks (e.g., BESI -> BESI.AS)
  // Returns price in USD, with currency info
  const fetchPriceForTicker = useCallback(async (ticker) => {
    try {
      // Try to get from unified market data first
      const upperTicker = ticker.toUpperCase();
      if (unifiedMarketData[upperTicker]?.currentPrice) {
        return { 
          price: unifiedMarketData[upperTicker].currentPrice, // Already in USD
          ticker: upperTicker,
          name: unifiedMarketData[upperTicker].name,
          currency: unifiedMarketData[upperTicker].currency || 'USD',
          domesticPrice: unifiedMarketData[upperTicker].domesticPrice,
          exchangeRate: unifiedMarketData[upperTicker].exchangeRate || 1,
        };
      }
      
      // Helper to convert quote to USD if needed
      const processQuote = async (quote, finalTicker) => {
        if (!quote?.price) return null;
        
        const currency = quote.currency || 'USD';
        let exchangeRate = 1;
        let usdPrice = quote.price;
        
        // Convert to USD if needed
        if (currency !== 'USD') {
          exchangeRate = await fetchExchangeRate(currency, 'USD');
          if (exchangeRate) {
            usdPrice = quote.price * exchangeRate;
            console.log(`💱 ${finalTicker}: ${currency} ${quote.price.toFixed(2)} → USD ${usdPrice.toFixed(2)} (@${exchangeRate.toFixed(4)})`);
          } else {
            console.warn(`⚠️ Could not get ${currency}/USD rate, using domestic price`);
          }
        }
        
        return {
          price: usdPrice,
          ticker: finalTicker,
          name: quote.name,
          currency,
          domesticPrice: quote.price,
          exchangeRate: exchangeRate || 1,
        };
      };
      
      // Try the ticker as-is first
      let quote = await fetchYahooQuote(upperTicker);
      if (quote?.price) {
        return await processQuote(quote, upperTicker);
      }
      
      // If ticker doesn't have a suffix, try common international exchanges
      if (!upperTicker.includes('.')) {
        const exchangeSuffixes = [
          '.AS',  // Amsterdam (Euronext)
          '.L',   // London
          '.DE',  // Germany (XETRA)
          '.PA',  // Paris
          '.MI',  // Milan
          '.SW',  // Swiss
          '.TO',  // Toronto
          '.AX',  // Australia
          '.HK',  // Hong Kong
          '.T',   // Tokyo
        ];
        
        for (const suffix of exchangeSuffixes) {
          const tryTicker = upperTicker + suffix;
          quote = await fetchYahooQuote(tryTicker);
          if (quote?.price) {
            return await processQuote(quote, tryTicker);
          }
        }
      }
      
      // Return null if nothing found
      return null;
    } catch (err) {
      console.error(`Failed to fetch price for ${ticker}:`, err);
      return null;
    }
  }, [unifiedMarketData]);
  
  // Remove position
  const removePosition = (id) => {
    console.log('[removePosition] Removing position with id:', id);
    setPositions(prev => {
      console.log('[removePosition] Previous positions:', prev.map(p => ({ id: p.id, ticker: p.ticker })));
      const filtered = prev.filter(p => p.id !== id);
      console.log('[removePosition] After filter:', filtered.map(p => ({ id: p.id, ticker: p.ticker })));
      return filtered;
    });
  };
  
  // Update position with percentile constraints
  const updatePosition = async (id, field, value) => {
    // Use functional update to avoid stale closure issues with rapid typing
    setPositions(prev => prev.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        
        // Enforce percentile ordering: p5 < p25 < p50 < p75 < p95
        // Also enforce floor of -100% (can't lose more than everything)
        if (['p5', 'p25', 'p50', 'p75', 'p95'].includes(field)) {
          const minGap = 0.01; // Minimum 1% gap between percentiles
          const floor = -1.0; // -100% is the absolute minimum
          
          switch (field) {
            case 'p5':
              updated.p5 = Math.max(floor, Math.min(value, updated.p25 - minGap));
              break;
            case 'p25':
              updated.p25 = Math.max(Math.max(floor, updated.p5 + minGap), Math.min(value, updated.p50 - minGap));
              break;
            case 'p50':
              updated.p50 = Math.max(Math.max(floor, updated.p25 + minGap), Math.min(value, updated.p75 - minGap));
              break;
            case 'p75':
              updated.p75 = Math.max(Math.max(floor, updated.p50 + minGap), Math.min(value, updated.p95 - minGap));
              break;
            case 'p95':
              updated.p95 = Math.max(Math.max(floor, updated.p75 + minGap), value);
              break;
          }
        }
        
        return updated;
      }
      return p;
    }));
    
    // If ticker changed, fetch live data (debounced to avoid fetching while typing)
    if (field === 'ticker' && value && value.length >= 2) {
      const ticker = value.toUpperCase();
      
      // Clear any existing timeout for this position
      if (tickerFetchTimeoutRef.current[id]) {
        clearTimeout(tickerFetchTimeoutRef.current[id]);
      }
      
      // Debounce: wait 600ms after user stops typing before fetching
      tickerFetchTimeoutRef.current[id] = setTimeout(async () => {
        // Try to fetch live quote
        const quote = await fetchYahooQuote(ticker);
        
        if (quote && quote.price) {
          // Check if currency conversion is needed
          const currency = quote.currency || 'USD';
          let usdPrice = quote.price;
          let exchangeRate = 1;
          
          if (currency !== 'USD') {
            // Fetch exchange rate
            exchangeRate = await fetchExchangeRate(currency, 'USD');
            if (exchangeRate) {
              usdPrice = quote.price * exchangeRate;
              console.log(`💱 ${ticker}: ${currency} ${quote.price.toFixed(2)} → USD ${usdPrice.toFixed(2)} (@${exchangeRate.toFixed(4)})`);
            } else {
              console.warn(`⚠️ Could not get ${currency}/USD rate for ${ticker}, using domestic price`);
              usdPrice = quote.price;
              exchangeRate = 1;
            }
          } else {
            console.log(`Fetched ${ticker}: $${quote.price.toFixed(2)}`);
          }
          
          setPositions(prev => prev.map(p => {
            if (p.id === id && p.ticker?.toUpperCase() === ticker) {
              return {
                ...p,
                price: usdPrice,
                currency: currency,
                domesticPrice: quote.price,
                type: quote.type || (['SPY', 'QQQ', 'GLD', 'TLT', 'IWM', 'EEM', 'VTI', 'VOO'].includes(ticker) ? 'ETF' : 'Equity'),
              };
            }
            return p;
          }));
        } else {
          // Fallback to mock data detection
          if (MOCK_HISTORICAL_DATA[ticker]) {
            const prices = MOCK_HISTORICAL_DATA[ticker].prices;
            setPositions(prev => prev.map(p => {
              if (p.id === id && p.ticker?.toUpperCase() === ticker) {
                return {
                  ...p,
                  price: prices[prices.length - 1],
                  currency: 'USD',
                  domesticPrice: prices[prices.length - 1],
                  type: ['SPY', 'QQQ', 'GLD', 'TLT', 'IWM', 'EEM'].includes(ticker) ? 'ETF' : 'Equity',
                };
              }
              return p;
            }));
          }
        }
        
        // Clean up timeout ref
        delete tickerFetchTimeoutRef.current[id];
      }, 600); // Wait 600ms after user stops typing
    }
  };
  
  // Refresh all prices from Yahoo Finance
  const refreshAllPrices = async () => {
    setIsFetchingData(true);
    setFetchErrors([]);

    // Use unified fetch which gets all data including current prices
    const newData = await fetchUnifiedMarketData(true); // force refresh

    // Update positions with prices from unified data (pass data directly to avoid stale state)
    const updatedCount = refreshPricesFromUnified(newData);
    console.log(`Updated ${updatedCount} prices from unified data`);

    setIsFetchingData(false);

    // Trigger re-sort by updating the timestamp
    setLastPriceRefresh(Date.now());
  };

  // Auto-refresh prices after login (triggered by flag set in login handler)
  useEffect(() => {
    if (shouldRefreshAfterLogin && positions.length > 0) {
      setShouldRefreshAfterLogin(false);
      refreshAllPrices();
    }
  }, [shouldRefreshAfterLogin, positions.length]);

  // Background price refresh - lightweight, doesn't block UI
  const isBackgroundRefreshingRef = useRef(false);
  const backgroundRefreshPrices = useCallback(async () => {
    // Skip if already refreshing or if another heavy operation is in progress
    if (isBackgroundRefreshingRef.current || isFetchingData || isFetchingUnified || isFullLoading) {
      return;
    }

    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    if (tickers.length === 0) return;

    isBackgroundRefreshingRef.current = true;

    try {
      // Fetch quotes sequentially with delays to avoid rate limiting
      const queue = [...new Set(tickers)]; // Unique tickers only
      const results = {};
      const DELAY_MS = 300; // Delay between requests to avoid 429 errors

      for (const ticker of queue) {
        try {
          const quote = await fetchYahooQuote(ticker);
          if (quote?.price) {
            results[ticker] = quote;
          }
        } catch (e) {
          // Silently ignore errors in background refresh
        }
        // Add delay between requests to avoid rate limiting
        if (queue.indexOf(ticker) < queue.length - 1) {
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
      }

      // Identify non-USD currencies that need exchange rates
      const nonUsdCurrencies = new Set();
      Object.values(results).forEach(quote => {
        const currency = quote.currency || 'USD';
        if (currency !== 'USD') {
          nonUsdCurrencies.add(currency);
        }
      });

      // Fetch exchange rates for non-USD currencies in parallel
      const exchangeRates = { USD: 1 };
      if (nonUsdCurrencies.size > 0) {
        const ratePromises = [...nonUsdCurrencies].map(async (currency) => {
          try {
            const rate = await fetchExchangeRate(currency, 'USD');
            return { currency, rate };
          } catch (e) {
            return { currency, rate: null };
          }
        });
        
        const rateResults = await Promise.all(ratePromises);
        rateResults.forEach(({ currency, rate }) => {
          if (rate) {
            exchangeRates[currency] = rate;
          }
        });
      }

      // Update positions with new prices (functional update to avoid stale state)
      let updatedCount = 0;
      setPositions(prevPositions => {
        return prevPositions.map(pos => {
          if (!pos.ticker) return pos;
          const quote = results[pos.ticker.toUpperCase()];
          if (!quote?.price) return pos;

          const currency = quote.currency || 'USD';
          const domesticPrice = quote.price;
          const exchangeRate = exchangeRates[currency] || 1;
          const usdPrice = domesticPrice * exchangeRate;

          // Skip if USD price hasn't changed significantly (within 0.01%)
          if (pos.price && Math.abs(usdPrice - pos.price) / pos.price < 0.0001) {
            return pos;
          }

          updatedCount++;
          return {
            ...pos,
            price: usdPrice,
            domesticPrice: domesticPrice,
            currency: currency,
            exchangeRate: exchangeRate,
          };
        });
      });

      if (updatedCount > 0) {
        console.log(`🔄 Background refresh: updated ${updatedCount} prices`);
      }
    } catch (e) {
      // Silently ignore errors in background refresh
      console.warn('Background price refresh failed:', e.message);
    } finally {
      isBackgroundRefreshingRef.current = false;
    }
  }, [positions, isFetchingData, isFetchingUnified, isFullLoading]);
  // Auto-refresh prices every 30 seconds
  useEffect(() => {
    const REFRESH_INTERVAL = 30 * 1000; // 30 seconds

    const intervalId = setInterval(() => {
      backgroundRefreshPrices();
    }, REFRESH_INTERVAL);

    return () => clearInterval(intervalId);
  }, [backgroundRefreshPrices]);
  
  // Estimate return distribution from unified data (single position)
  const estimateDistributionFromHistory = async (positionId) => {
    const pos = positions.find(p => p.id === positionId);
    if (!pos || !pos.ticker) return;
    
    const ticker = pos.ticker.toUpperCase();
    setFetchErrors([]);
    
    // Check if we have unified data for this ticker
    let data = unifiedMarketData[ticker];
    
    // If no data, fetch it
    if (!data) {
      await fetchUnifiedMarketData();
      data = unifiedMarketData[ticker];
    }
    
    // If we have data but no distribution, try to rehydrate it
    if (data && !data.distribution) {
      const spyData = unifiedMarketData['SPY'];
      data = rehydrateTickerData(data, spyData);
      // Update the unified data with rehydrated version
      setUnifiedMarketData(prev => ({ ...prev, [ticker]: data }));
    }
    
    if (data?.distribution) {
      const { p5, p25, p50, p75, p95 } = data.distribution;
      console.log(`${ticker} estimated distribution: P5=${(p5*100).toFixed(1)}%, P50=${(p50*100).toFixed(1)}%, P95=${(p95*100).toFixed(1)}%`);
      
      setPositions(prev => prev.map(p => 
        p.id === positionId 
          ? { ...p, p5, p25, p50, p75, p95 }
          : p
      ));
    } else {
      setFetchErrors([`${ticker}: Not enough historical data for distribution estimate`]);
    }
  };
  
  // Estimate all distributions from history - NOW USES UNIFIED DATA
  const estimateAllDistributions = async () => {
    setIsFetchingData(true);
    
    // Ensure we have unified data
    await fetchUnifiedMarketData();
    
    // Apply distributions from unified data
    const updated = applyDistributionsFromUnified();
    console.log(`Applied distributions to ${updated} positions`);
    
    setIsFetchingData(false);
  };
  
  // Calculate beta for all positions vs SPY (market proxy) - NOW USES UNIFIED DATA
  const calculateAllBetas = async () => {
    // Use unified fetch which handles everything
    setIsFetchingBetas(true);
    await fetchUnifiedMarketData();
    setIsFetchingBetas(false);
  };
  
  // Fetch calendar year returns - NOW USES UNIFIED DATA
  const fetchCalendarYearReturns = async () => {
    setIsFetchingYearReturns(true);
    
    // Check if we have unified data, if not fetch it
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(Boolean);
    const needsFetch = tickers.some(t => !unifiedMarketData[t]?.calendarYearReturns);
    
    if (needsFetch) {
      await fetchUnifiedMarketData();
    } else {
      // Just extract calendar year returns from existing unified data
      const newYearReturns = { ...calendarYearReturns };
      tickers.forEach(ticker => {
        const data = unifiedMarketData[ticker];
        if (data?.calendarYearReturns) {
          newYearReturns[ticker] = data.calendarYearReturns;
        }
      });
      setCalendarYearReturns(newYearReturns);
    }
    
    setIsFetchingYearReturns(false);
  };
  
  // Fetch data and compute correlation - NOW USES UNIFIED DATA
  // Can optionally pass marketData directly to avoid stale closure issues
  const fetchAndComputeCorrelation = useCallback(async (marketData = null) => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    if (tickers.length === 0) return;
    
    setIsFetchingData(true);
    setFetchErrors([]);
    // Reset lag analysis when computing new correlation
    setLagAnalysis(null);
    setUseLagAdjusted(false);
    
    // Use passed-in data or fall back to state (for manual calls)
    const data = marketData || unifiedMarketData;
    const missingTickers = tickers.filter(t => !data[t]?.dailyReturns?.length);
    
    if (missingTickers.length > 0) {
      console.warn(`⚠️ Missing data for: ${missingTickers.join(', ')}. Click "Load All" first.`);
      setFetchErrors([`Missing data for: ${missingTickers.join(', ')}. Click "🚀 Load All" in the header first.`]);
      setIsFetchingData(false);
      return;
    }
    
    console.log(`📊 Computing ${historyTimeline} correlation for ${tickers.length} tickers...`);
    
    // Build historical data structure from unified data
    const newHistoricalData = {};
    const errors = [];
    let usedYahoo = false;
    
    // Minimum data points based on timeline (trading days)
    const minDataPoints = {
      '6mo': 100,
      '1y': 200,
      '2y': 400,
      '3y': 600,
    }[historyTimeline] || 200;
    
    // Target trading days for each timeline
    const targetDays = {
      '6mo': 126,   // ~6 months
      '1y': 252,    // ~1 year
      '2y': 504,    // ~2 years
      '3y': 756,    // ~3 years
    }[historyTimeline] || 252;
    
    console.log(`📅 Timeline: ${historyTimeline}, Target days: ${targetDays}`);
    
    for (const ticker of tickers) {
      const tickerData = data?.[ticker];
      
      if (tickerData?.dailyReturns && tickerData.dailyReturns.length > minDataPoints / 4) {
        // Filter returns based on selected timeline
        const allReturns = tickerData.dailyReturns;
        // Take only the most recent N trading days based on timeline
        const returns = allReturns.slice(-targetDays);
        
        if (ticker === tickers[0]) {
          console.log(`📈 ${ticker}: ${allReturns.length} total returns → using last ${returns.length} for ${historyTimeline}`);
        }
        
        newHistoricalData[ticker] = {
          source: 'yahoo',
          prices: tickerData.closePrices || [],
          returns: returns,
        };
        usedYahoo = true;
      } else if (MOCK_HISTORICAL_DATA[ticker]) {
        const mockPrices = MOCK_HISTORICAL_DATA[ticker].prices;
        const mockReturns = calculateReturns(mockPrices);
        newHistoricalData[ticker] = {
          source: 'mock',
          prices: mockPrices.map(p => ({ close: p })),
          returns: mockReturns,
        };
        errors.push(`${ticker}: Using mock data`);
      } else {
        // Generate synthetic returns
        const pos = positions.find(p => p.ticker?.toUpperCase() === ticker);
        const derivedSigma = pos ? getDistributionParams(pos).sigma : 0.20;
        const dailyVol = derivedSigma / Math.sqrt(252);
        const syntheticReturns = Array(251).fill(0).map(() => boxMuller() * dailyVol);
        newHistoricalData[ticker] = {
          source: 'synthetic',
          prices: [],
          returns: syntheticReturns,
        };
        errors.push(`${ticker}: Using synthetic data`);
      }
    }
    
    setHistoricalData(newHistoricalData);
    setFetchErrors(errors);
    setDataSource(usedYahoo ? (errors.length > 0 ? 'mixed' : 'yahoo') : 'mock');
    
    // Get returns for correlation calculation
    const allReturns = tickers.map(ticker => newHistoricalData[ticker]?.returns || []);
    
    // Log data availability for each ticker
    const returnLengths = tickers.map((ticker, i) => ({ ticker, length: allReturns[i].length, idx: i }));
    returnLengths.sort((a, b) => a.length - b.length);
    
    console.log(`📊 Data availability for ${historyTimeline} correlation (pairwise max overlap):`);
    returnLengths.forEach(({ ticker, length }) => {
      const years = (length / 252).toFixed(1);
      const isLimited = length < targetDays;
      console.log(`   ${ticker}: ${length} days (~${years}yr)${isLimited ? ` (limited, wanted ${targetDays})` : ''}`);
    });
    
    // ==================== PAIRWISE CORRELATION WITH MAXIMUM OVERLAP ====================
    // For each pair of tickers, use as much overlapping data as available
    // This means AAPL-SPY can use 504 days even if KDEF only has 241 days
    const N = tickers.length;
    let corr = Array(N).fill(null).map(() => Array(N).fill(0));
    const overlapMatrix = Array(N).fill(null).map(() => Array(N).fill(0)); // Track overlap days
    
    // Helper to compute correlation between two return series
    // Supports EWMA (Exponentially Weighted Moving Average) when lambda < 1.0
    const computePairwiseCorrelation = (returns1, returns2, lambda = 1.0) => {
      // Use the shorter of the two (aligned from end - most recent data)
      const len = Math.min(returns1.length, returns2.length);
      if (len < 20) return { corr: 0, overlap: len }; // Need minimum data
      
      const r1 = returns1.slice(-len);
      const r2 = returns2.slice(-len);
      
      // If lambda = 1.0 (equal weight), use standard sample correlation
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
      
      // EWMA correlation: weight recent observations more heavily
      // Weight at time t (where t=len-1 is most recent): w_t = (1-λ) * λ^(len-1-t)
      // We compute weighted means, variances, and covariance
      
      // First compute weights (normalize so they sum to 1)
      const weights = new Array(len);
      let sumWeights = 0;
      for (let t = 0; t < len; t++) {
        // t=0 is oldest, t=len-1 is newest
        // Higher weight for newer observations
        weights[t] = Math.pow(lambda, len - 1 - t);
        sumWeights += weights[t];
      }
      // Normalize
      for (let t = 0; t < len; t++) {
        weights[t] /= sumWeights;
      }
      
      // Weighted means
      let mean1 = 0, mean2 = 0;
      for (let t = 0; t < len; t++) {
        mean1 += weights[t] * r1[t];
        mean2 += weights[t] * r2[t];
      }
      
      // Weighted covariance and variances
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
      
      // Compute effective sample size for EWMA (for info)
      // ESS ≈ (1 + λ) / (1 - λ) when λ < 1
      // const effectiveSampleSize = lambda < 0.9999 ? (1 + lambda) / (1 - lambda) : len;
      
      return { corr: Math.max(-1, Math.min(1, correlation)), overlap: len };
    };
    
    // Compute pairwise correlations (with optional EWMA weighting)
    // Auto-scale EWMA half-life based on timeline: ~1/2 of the period
    // This ensures older data is appropriately discounted while still contributing
    let ewmaLambda = 1.0; // Default: equal weight
    if (useEwma) {
      const halfLifeDays = {
        '6mo': 63,   // ~3 months half-life for 6 months (~1/2 of period)
        '1y': 126,   // ~6 months half-life for 1 year
        '2y': 252,   // ~1 year half-life for 2 years  
        '3y': 378,   // ~1.5 years half-life for 3 years
      }[historyTimeline] || 126;
      
      // λ = 2^(-1/half_life) = exp(-ln(2)/half_life)
      ewmaLambda = Math.exp(-Math.LN2 / halfLifeDays);
      console.log(`📊 Using EWMA correlation with auto-scaled half-life: ${halfLifeDays} days (λ=${ewmaLambda.toFixed(4)}) for ${historyTimeline}`);
    }
    
    for (let i = 0; i < N; i++) {
      corr[i][i] = 1; // Diagonal
      overlapMatrix[i][i] = allReturns[i].length;
      
      for (let j = i + 1; j < N; j++) {
        const { corr: pairCorr, overlap } = computePairwiseCorrelation(allReturns[i], allReturns[j], ewmaLambda);
        corr[i][j] = pairCorr;
        corr[j][i] = pairCorr; // Symmetric
        overlapMatrix[i][j] = overlap;
        overlapMatrix[j][i] = overlap;
      }
    }
    
    // Log some example pairwise overlaps
    const minOverlap = Math.min(...overlapMatrix.flat().filter(x => x > 0));
    const maxOverlap = Math.max(...overlapMatrix.flat());
    console.log(`📊 Pairwise overlap range: ${minOverlap} to ${maxOverlap} days`);
    
    // Log first correlation value as sanity check
    if (corr.length >= 2) {
      console.log(`📈 Sample correlation [0][1]: ${corr[0][1].toFixed(4)} (${historyTimeline}, ${overlapMatrix[0][1]} days overlap)`);
    }
    
    // Store overlap info for display
    setHistoricalData(prev => {
      const updated = { ...prev };
      tickers.forEach((ticker, i) => {
        if (updated[ticker.toUpperCase()]) {
          updated[ticker.toUpperCase()].overlapDays = overlapMatrix[i];
        }
      });
      return updated;
    });
    
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
    // Note: For pairwise correlations with varying overlap, we use simplified shrinkage
    if ((correlationMethod === 'shrinkage' || correlationMethod === 'ledoitWolf')) {
      // Compute average correlation for shrinkage target
      let sumCorr = 0, countCorr = 0;
      for (let i = 0; i < N - 1; i++) {
        for (let j = i + 1; j < N; j++) {
          sumCorr += corr[i][j];
          countCorr++;
        }
      }
      const rBar = countCorr > 0 ? sumCorr / countCorr : 0;
      
      // Weight shrinkage by overlap - less overlap = more shrinkage
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          if (i !== j) {
            const overlap = overlapMatrix[i][j];
            // More shrinkage for pairs with less data (shrinkage intensity inversely proportional to sqrt of overlap)
            const shrinkageIntensity = Math.min(0.5, Math.max(0.05, 50 / Math.sqrt(overlap)));
            corr[i][j] = (1 - shrinkageIntensity) * corr[i][j] + shrinkageIntensity * rBar;
          }
        }
      }
      console.log(`Applied adaptive shrinkage (intensity varies by overlap, avg target corr: ${rBar.toFixed(3)})`);
    }
    
    corr = makeValidCorrelation(corr);
    setCorrelationMatrix(corr);
    setEditedCorrelation(corr.map(row => [...row]));
    console.log(`✅ Correlation matrix computed for ${historyTimeline}${useEwma ? ' with EWMA recency weighting' : ''} (${corr.length}x${corr.length})`);
    setIsFetchingData(false);
    
    // Show success toast
    showToast({
      type: 'success',
      title: 'Correlation Computed',
      message: `${corr.length}×${corr.length} matrix for ${historyTimeline} period${useEwma ? ' (EWMA weighted)' : ''}`,
      duration: 3500,
    });
    
    // Return the correlation matrix for immediate use (avoids state timing issues)
    return corr;
  }, [positions, gldAsCash, correlationMethod, historyTimeline, useEwma, unifiedMarketData, getDistributionParams, showToast]);
  
  // Update correlation cell
  const updateCorrelationCell = (i, j, value) => {
    if (!editedCorrelation) return;
    const newCorr = editedCorrelation.map(row => [...row]);
    let numVal = parseFloat(value) || 0;
    // Clamp to valid correlation range
    numVal = Math.max(-0.999, Math.min(0.999, numVal));
    newCorr[i][j] = numVal;
    newCorr[j][i] = numVal; // Maintain symmetry
    // Keep diagonal at 1
    for (let k = 0; k < newCorr.length; k++) {
      newCorr[k][k] = 1.0;
    }
    setEditedCorrelation(newCorr);
  };
  
  // Apply correlation edits (validate PSD)
  const applyEdits = () => {
    if (editedCorrelation) {
      const valid = makeValidCorrelation(editedCorrelation);
      setEditedCorrelation(valid);
      showToast({ type: 'success', message: 'Matrix validated and fixed to be positive semi-definite', duration: 3000 });
    }
  };
  
  // Reset to original
  const resetCorrelation = () => {
    if (correlationMatrix) {
      setEditedCorrelation(correlationMatrix.map(row => [...row]));
      showToast({ type: 'info', message: 'Correlation matrix reset to original values', duration: 2500 });
    }
  };
  
  // ============================================
  // LAG ANALYSIS FOR INTERNATIONAL STOCKS
  // Computes correlations at different lags to detect timezone effects
  // ============================================
  const runLagAnalysis = useCallback(async (marketData = null) => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    if (tickers.length < 2) return null;
    
    setIsAnalyzingLag(true);
    console.log('🕐 Running lag analysis for timezone effects...');
    
    // Use passed-in data or fall back to state
    const data = marketData || unifiedMarketData;
    
    // Get returns from unified data or historical data
    const getReturns = (ticker) => {
      const unified = data[ticker];
      if (unified?.returns?.length > 0) return unified.returns;
      if (unified?.dailyReturns?.length > 0) return unified.dailyReturns;
      const hist = historicalData[ticker];
      if (hist?.returns?.length > 0) return hist.returns;
      return [];
    };
    
    const allReturns = tickers.map(t => getReturns(t));
    const N = tickers.length;
    
    // Calculate EWMA lambda if enabled (same logic as main correlation)
    let ewmaLambda = 1.0;
    if (useEwma) {
      const halfLifeDays = {
        '6mo': 63,
        '1y': 126,
        '2y': 252,
        '3y': 378,
      }[historyTimeline] || 126;
      ewmaLambda = Math.exp(-Math.LN2 / halfLifeDays);
      console.log(`📊 Lag analysis using EWMA with half-life: ${halfLifeDays} days`);
    }
    
    // Helper to compute correlation between two return series at a given lag
    // lag > 0: r1[t] vs r2[t-lag] (r1 leads r2)
    // lag < 0: r1[t] vs r2[t+|lag|] (r2 leads r1)
    // Supports EWMA weighting when lambda < 1.0
    const computeLaggedCorrelation = (returns1, returns2, lag, lambda = 1.0) => {
      const len1 = returns1.length;
      const len2 = returns2.length;
      
      let r1, r2;
      if (lag >= 0) {
        // r1[lag:] vs r2[:-lag] (or r2[:] if lag=0)
        const overlap = Math.min(len1 - lag, len2);
        if (overlap < 30) return null;
        r1 = returns1.slice(len1 - overlap);
        r2 = returns2.slice(len2 - overlap - lag, len2 - lag || undefined);
      } else {
        // r1[:-|lag|] vs r2[|lag|:]
        const absLag = Math.abs(lag);
        const overlap = Math.min(len1, len2 - absLag);
        if (overlap < 30) return null;
        r1 = returns1.slice(len1 - overlap - absLag, len1 - absLag || undefined);
        r2 = returns2.slice(len2 - overlap);
      }
      
      const len = Math.min(r1.length, r2.length);
      if (len < 30) return null;
      
      // Use only the last 'len' elements
      r1 = r1.slice(-len);
      r2 = r2.slice(-len);
      
      // If lambda = 1.0 (equal weight), use standard sample correlation
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
      
      // EWMA correlation: weight recent observations more heavily
      const weights = new Array(len);
      let sumWeights = 0;
      for (let t = 0; t < len; t++) {
        weights[t] = Math.pow(lambda, len - 1 - t);
        sumWeights += weights[t];
      }
      for (let t = 0; t < len; t++) {
        weights[t] /= sumWeights;
      }
      
      // Weighted means
      let mean1 = 0, mean2 = 0;
      for (let t = 0; t < len; t++) {
        mean1 += weights[t] * r1[t];
        mean2 += weights[t] * r2[t];
      }
      
      // Weighted covariance and variances
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
    };
    
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
        
        // Compute correlations at different lags
        // lag -1: ticker i today vs ticker j yesterday (j leads i)
        // lag 0: same day
        // lag +1: ticker i today vs ticker j tomorrow (i leads j)
        const corrMinus1 = computeLaggedCorrelation(r1, r2, -1, ewmaLambda) ?? 0;
        const corr0 = computeLaggedCorrelation(r1, r2, 0, ewmaLambda) ?? 0;
        const corrPlus1 = computeLaggedCorrelation(r1, r2, 1, ewmaLambda) ?? 0;
        
        // Find max absolute correlation (considering sign)
        const correlations = [
          { lag: -1, corr: corrMinus1, abs: Math.abs(corrMinus1) },
          { lag: 0, corr: corr0, abs: Math.abs(corr0) },
          { lag: +1, corr: corrPlus1, abs: Math.abs(corrPlus1) },
        ];
        const best = correlations.reduce((a, b) => a.abs > b.abs ? a : b);
        
        // Store in matrices
        lagMatrix.lagMinus1[i][j] = corrMinus1;
        lagMatrix.lagMinus1[j][i] = corrMinus1;
        lagMatrix.lag0[i][j] = corr0;
        lagMatrix.lag0[j][i] = corr0;
        lagMatrix.lagPlus1[i][j] = corrPlus1;
        lagMatrix.lagPlus1[j][i] = corrPlus1;
        lagMatrix.maxCorr[i][j] = best.corr;
        lagMatrix.maxCorr[j][i] = best.corr;
        lagMatrix.bestLag[i][j] = best.lag;
        lagMatrix.bestLag[j][i] = -best.lag; // Opposite direction for other ticker
        
        // Check if there's a significant lag effect (>0.05 difference)
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
    
    // Sort by improvement (most affected pairs first)
    lagResults.sort((a, b) => b.improvement - a.improvement);
    
    // Log summary
    const significantPairs = lagResults.filter(r => r.significant);
    console.log(`📊 Lag analysis complete:`);
    console.log(`   ${lagResults.length} pairs with lag effects detected`);
    console.log(`   ${significantPairs.length} pairs with significant (>5%) improvement from lag adjustment`);
    
    if (significantPairs.length > 0) {
      console.log('   Top affected pairs:');
      significantPairs.slice(0, 5).forEach(r => {
        console.log(`     ${r.ticker1}-${r.ticker2}: lag=${r.bestLag}, ${(r.corr0*100).toFixed(1)}% → ${(r.bestCorr*100).toFixed(1)}% (+${(r.improvement*100).toFixed(1)}%)`);
      });
    }
    
    const lagAnalysisData = {
      tickers,
      results: lagResults,
      matrix: lagMatrix,
      significantCount: significantPairs.length,
      timestamp: new Date().toISOString(),
    };
    
    setLagAnalysis(lagAnalysisData);
    
    setIsAnalyzingLag(false);
    
    // Return the data for immediate use (avoids state timing issues)
    return lagAnalysisData;
  }, [positions, unifiedMarketData, historicalData, useEwma, historyTimeline]);
  
  // Apply lag-adjusted correlations to the matrix
  // Can optionally pass lagData directly to avoid state timing issues
  const applyLagAdjustedCorrelations = useCallback((lagData = null) => {
    const analysis = lagData || lagAnalysis;
    if (!analysis?.matrix?.maxCorr || !editedCorrelation) {
      console.log('❌ Cannot apply: missing lagAnalysis or editedCorrelation');
      return;
    }
    
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    const lagTickers = analysis.tickers;
    
    console.log('🔧 Applying lag-adjusted correlations...');
    console.log('   Current matrix tickers:', tickers);
    console.log('   Lag analysis tickers:', lagTickers);
    
    // Create new correlation matrix
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
          
          // Apply if lag-adjusted has higher absolute correlation
          if (Math.abs(maxCorr) > Math.abs(currentCorr) + 0.01) { // 1% threshold
            adjustmentLog.push(`${tickers[i]}-${tickers[j]}: ${(currentCorr*100).toFixed(1)}% → ${(maxCorr*100).toFixed(1)}%`);
            newCorr[i][j] = maxCorr;
            newCorr[j][i] = maxCorr;
            adjustmentsMade++;
          }
        }
      }
    }
    
    console.log(`   Made ${adjustmentsMade} adjustments:`);
    adjustmentLog.forEach(log => console.log(`   ${log}`));
    
    // Do minimal validation (symmetrize, clamp, diagonal=1) but NOT aggressive PSD shrinkage
    const n = newCorr.length;
    for (let i = 0; i < n; i++) {
      newCorr[i][i] = 1.0; // Diagonal = 1
      for (let j = i + 1; j < n; j++) {
        const avg = (newCorr[i][j] + newCorr[j][i]) / 2;
        const clamped = Math.max(-0.999, Math.min(0.999, avg));
        newCorr[i][j] = clamped;
        newCorr[j][i] = clamped;
      }
    }
    
    // Check if PSD - if not, do gentle fix (max 5 iterations)
    let isPSD = false;
    for (let iter = 0; iter < 5 && !isPSD; iter++) {
      try {
        const L = choleskyDecomposition(newCorr);
        isPSD = L.every((row, i) => !isNaN(row[i]) && row[i] > 0);
      } catch (e) {
        isPSD = false;
      }
      
      if (!isPSD && iter < 4) {
        // Gentle shrinkage - only 2% per iteration
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
            if (i !== j) {
              newCorr[i][j] *= 0.98;
            }
          }
        }
      }
    }
    
    if (!isPSD) {
      console.warn('⚠️ Matrix may not be positive semi-definite. Click "Validate Matrix" to fix.');
    }
    
    // Log final values for verification
    console.log('📊 Final correlation sample values:');
    for (let i = 0; i < Math.min(3, tickers.length); i++) {
      for (let j = i + 1; j < Math.min(5, tickers.length); j++) {
        console.log(`   ${tickers[i]}-${tickers[j]}: ${(newCorr[i][j]*100).toFixed(1)}%`);
      }
    }
    
    setEditedCorrelation(newCorr);
    setUseLagAdjusted(true);
    console.log('✅ Applied lag-adjusted correlations');
    
    // Show user what was changed
    if (adjustmentsMade > 0) {
      const summary = adjustmentLog.slice(0, 3).map(s => `• ${s}`).join('\n');
      showToast({ 
        type: 'success', 
        title: `Applied ${adjustmentsMade} Lag Adjustments`,
        message: `${summary}${adjustmentsMade > 3 ? `\n...and ${adjustmentsMade - 3} more` : ''}`,
        duration: 6000,
      });
    } else {
      showToast({ type: 'info', message: 'No adjustments needed - correlations already optimal.' });
    }
    
    // Return the modified matrix for immediate use
    return newCorr;
  }, [lagAnalysis, editedCorrelation, positions, showToast]);
  
  // ============================================
  // FACTOR ANALYSIS
  // Correlation-based thematic detection and factor decomposition
  // ============================================
  
  // Fetch factor ETF data with 24-hour caching
  // Can optionally pass marketData directly to avoid stale closure issues
  const fetchFactorData = useCallback(async (marketData = null, forceRefresh = false) => {
    setIsFetchingFactors(true);

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      try {
        const cached = localStorage.getItem(FACTOR_CACHE_KEY);
        if (cached) {
          const { data: cachedFactorData, timestamp, timeline } = JSON.parse(cached);
          const isFresh = Date.now() - timestamp < FACTOR_CACHE_MAX_AGE;
          const sameTimeline = timeline === historyTimeline;

          if (isFresh && sameTimeline && cachedFactorData && Object.keys(cachedFactorData).length > 5) {
            console.log(`📊 Using cached factor data (${((Date.now() - timestamp) / 3600000).toFixed(1)}h old)`);
            setFactorData(cachedFactorData);
            // Still run factor analysis with cached data
            await runFactorAnalysis(cachedFactorData, marketData);
            setIsFetchingFactors(false);
            return;
          }
        }
      } catch (e) {
        console.warn('Factor cache read failed:', e);
      }
    }

    console.log('📊 Fetching factor ETF data (cache miss or expired)...');

    try {
      // Determine time period based on historyTimeline
      const targetDays = {
        '6mo': 126,
        '1y': 252,
        '2y': 504,
        '3y': 756,
      }[historyTimeline] || 252;

      // Fetch all factor ETFs in parallel with concurrency limit
      const FACTOR_CONCURRENCY = 4;
      const etfQueue = [...ALL_FACTOR_ETFS];
      const results = [];

      const fetchWorker = async () => {
        while (etfQueue.length > 0) {
          const ticker = etfQueue.shift();
          if (!ticker) continue;

          try {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=3y`;
            const data = await fetchYahooData(url);

            if (data?.chart?.result?.[0]) {
              const result = data.chart.result[0];
              const adjCloses = result.indicators?.adjclose?.[0]?.adjclose ||
                               result.indicators?.quote?.[0]?.close || [];
              const timestamps = result.timestamp || [];

              // Calculate returns and keep corresponding timestamps
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

              // Take last N days based on timeline
              const trimmedReturns = returns.slice(-targetDays);
              const trimmedTimestamps = returnTimestamps.slice(-targetDays);
              const totalReturn = trimmedReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;

              results.push({
                ticker,
                returns: trimmedReturns,
                timestamps: trimmedTimestamps,
                totalReturn,
                success: true
              });
            } else {
              results.push({ ticker, returns: [], timestamps: [], totalReturn: 0, success: false });
            }
          } catch (e) {
            console.warn(`Failed to fetch ${ticker}:`, e.message);
            results.push({ ticker, returns: [], timestamps: [], totalReturn: 0, success: false });
          }
        }
      };

      // Create worker pool
      const workers = Array(Math.min(FACTOR_CONCURRENCY, etfQueue.length))
        .fill(null)
        .map(() => fetchWorker());

      await Promise.all(workers);
      
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
      
      // Compute factor spreads (use SPY timestamps for all computed factors)
      const spy = newFactorData['SPY']?.returns || [];
      const spyTimestamps = newFactorData['SPY']?.timestamps || [];
      if (spy.length > 0) {
        // SMB = IWM - SPY
        const iwm = newFactorData['IWM']?.returns || [];
        if (iwm.length === spy.length) {
          newFactorData['SMB'] = {
            returns: spy.map((s, i) => (iwm[i] || 0) - s),
            timestamps: spyTimestamps,
            totalReturn: (newFactorData['IWM']?.totalReturn || 0) - (newFactorData['SPY']?.totalReturn || 0),
            name: 'Size (Small-Big)',
          };
        }
        
        // HML = IWD - IWF
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
        
        // MOM = MTUM - SPY
        const mtum = newFactorData['MTUM']?.returns || [];
        if (mtum.length === spy.length) {
          newFactorData['MOM'] = {
            returns: spy.map((s, i) => (mtum[i] || 0) - s),
            timestamps: spyTimestamps,
            totalReturn: (newFactorData['MTUM']?.totalReturn || 0) - (newFactorData['SPY']?.totalReturn || 0),
            name: 'Momentum',
          };
        }
        
        // QUAL excess
        const qual = newFactorData['QUAL']?.returns || [];
        if (qual.length === spy.length) {
          newFactorData['QUAL_FACTOR'] = {
            returns: spy.map((s, i) => (qual[i] || 0) - s),
            timestamps: spyTimestamps,
            totalReturn: (newFactorData['QUAL']?.totalReturn || 0) - (newFactorData['SPY']?.totalReturn || 0),
            name: 'Quality',
          };
        }
        
        // LVOL excess
        const splv = newFactorData['SPLV']?.returns || [];
        if (splv.length === spy.length) {
          newFactorData['LVOL'] = {
            returns: spy.map((s, i) => (splv[i] || 0) - s),
            timestamps: spyTimestamps,
            totalReturn: (newFactorData['SPLV']?.totalReturn || 0) - (newFactorData['SPY']?.totalReturn || 0),
            name: 'Low Volatility',
          };
        }
      }
      
      console.log(`✅ Fetched ${Object.keys(newFactorData).length} factor ETFs`);
      setFactorData(newFactorData);

      // Save to cache for 24-hour reuse
      try {
        const cachePayload = JSON.stringify({
          data: newFactorData,
          timestamp: Date.now(),
          timeline: historyTimeline,
        });
        localStorage.setItem(FACTOR_CACHE_KEY, cachePayload);
        console.log(`💾 Factor data cached (${(cachePayload.length / 1024).toFixed(1)}KB)`);
      } catch (e) {
        console.warn('Failed to cache factor data:', e);
      }

      // Now run the factor analysis (pass marketData to avoid stale closure)
      await runFactorAnalysis(newFactorData, marketData);

    } catch (e) {
      console.error('Factor data fetch failed:', e);
    } finally {
      setIsFetchingFactors(false);
    }
  }, [historyTimeline]);
  
  // Helper: Compute date-aligned correlation between two return series
  // Returns arrays aligned by calendar date, with optional lag
  const alignReturnsByDate = useCallback((posReturns, posTimestamps, etfReturns, etfTimestamps, lag = 0) => {
    if (!posTimestamps?.length || !etfTimestamps?.length) {
      return { posAligned: [], etfAligned: [], matchedDates: 0 };
    }
    
    // Build date map for ETF (date string -> return)
    const etfByDate = new Map();
    for (let i = 0; i < etfReturns.length && i < etfTimestamps.length; i++) {
      const dateKey = new Date(etfTimestamps[i]).toISOString().slice(0, 10);
      etfByDate.set(dateKey, etfReturns[i]);
    }
    
    const posAligned = [];
    const etfAligned = [];
    const posTimestampsAligned = [];  // Track which position timestamps matched
    
    for (let i = 0; i < posReturns.length && i < posTimestamps.length; i++) {
      const posDate = new Date(posTimestamps[i]);
      let targetDate = new Date(posDate);
      
      if (lag === -1) {
        // Position reacts to PRIOR day's ETF return
        targetDate.setDate(targetDate.getDate() - 1);
      } else if (lag === 1) {
        // Position leads ETF by 1 day
        targetDate.setDate(targetDate.getDate() + 1);
      }
      
      const targetKey = targetDate.toISOString().slice(0, 10);
      const etfReturn = etfByDate.get(targetKey);
      
      if (etfReturn !== undefined) {
        posAligned.push(posReturns[i]);
        etfAligned.push(etfReturn);
        posTimestampsAligned.push(posTimestamps[i]);  // Keep the matching timestamp
      }
    }
    
    return { posAligned, etfAligned, posTimestampsAligned, matchedDates: posAligned.length };
  }, []);
  
  // Compute correlation and beta from aligned return arrays
  const computeCorrelationFromAligned = useCallback((posAligned, etfAligned, ewmaLambda = 1.0) => {
    const n = posAligned.length;
    if (n < 30) {
      return { correlation: 0, beta: 0, rSquared: 0 };
    }
    
    // Compute EWMA weights if needed
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
    
    // Compute means
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
    
    // Compute covariance and variances
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
  
  // Run regression to compute factor betas (with optional EWMA weighting and date alignment)
  const computeFactorBetas = useCallback((positionReturns, posTimestamps, factorReturnsMap, ewmaLambda = 1.0, isInternational = false) => {
    // Get factor data
    const spyData = factorReturnsMap['SPY'];
    const smbData = factorReturnsMap['SMB'];
    const hmlData = factorReturnsMap['HML'];
    const momData = factorReturnsMap['MOM'];
    
    if (!spyData?.returns || spyData.returns.length < 30) {
      return { alpha: 0, betas: {}, rSquared: 0, residualVol: 0, lag: 0 };
    }
    
    // For international stocks with timestamps, use date alignment and test lags
    const hasSpyTimestamps = spyData.timestamps?.length > 0;
    const hasPosTimestamps = posTimestamps?.length > 0;

    if (isInternational && hasPosTimestamps && hasSpyTimestamps) {
      const lags = [-1, 0, 1];
      let bestResult = { rSquared: -1, lag: 0 };
      
      for (const lag of lags) {
        // Align position returns with SPY (market) by date
        const { posAligned: y, etfAligned: mkt, posTimestampsAligned, matchedDates } = alignReturnsByDate(
          positionReturns, posTimestamps, spyData.returns, spyData.timestamps, lag
        );
        
        if (y.length < 30) continue;
        
        const len = y.length;
        
        // Compute EWMA weights
        let weights = null;
        if (ewmaLambda < 0.9999) {
          weights = new Array(len);
          let sumW = 0;
          for (let t = 0; t < len; t++) {
            weights[t] = Math.pow(ewmaLambda, len - 1 - t);
            sumW += weights[t];
          }
          for (let t = 0; t < len; t++) weights[t] /= sumW;
        }
        
        // Helper functions
        const computeMean = (arr) => {
          if (weights) return arr.reduce((sum, val, i) => sum + weights[i] * val, 0);
          return arr.reduce((a, b) => a + b, 0) / len;
        };
        
        const computeCovVar = (arr1, mean1, arr2, mean2) => {
          let cov = 0;
          for (let i = 0; i < len; i++) {
            const d1 = arr1[i] - mean1;
            const d2 = arr2[i] - mean2;
            cov += weights ? weights[i] * d1 * d2 : d1 * d2;
          }
          return weights ? cov : cov / len;
        };
        
        // Compute market beta
        const meanY = computeMean(y);
        const meanMkt = computeMean(mkt);
        const covYMkt = computeCovVar(y, meanY, mkt, meanMkt);
        const varMkt = computeCovVar(mkt, meanMkt, mkt, meanMkt);
        const varY = computeCovVar(y, meanY, y, meanY);
        const betaMkt = varMkt > 0 ? covYMkt / varMkt : 0;
        
        // Compute R²
        let ssResid = 0;
        for (let i = 0; i < len; i++) {
          const predicted = betaMkt * mkt[i];
          const resid = y[i] - predicted;
          ssResid += weights ? weights[i] * resid * resid : resid * resid;
        }
        const totalVar = weights ? varY : varY * len;
        const rSquared = totalVar > 0 ? Math.max(0, Math.min(1, 1 - (ssResid / totalVar))) : 0;
        
        if (rSquared > bestResult.rSquared) {
          // Compute residuals and other factor betas
          const residualsAfterMkt = y.map((yi, i) => yi - betaMkt * mkt[i]);
          const meanResid = computeMean(residualsAfterMkt);
          const alpha = meanResid * 252;
          
          const betas = { MKT: betaMkt };
          
          // Compute SMB, HML, MOM betas using same date alignment
          // These factors use SPY's timestamps since they're US ETF spreads
          const computeBetaOnResiduals = (factorReturns, factorTimestamps, residuals, posTs) => {
            if (!factorReturns || factorReturns.length < 30 || !factorTimestamps) {
              return 0;
            }
            
            // Build date map for this factor
            const factorByDate = new Map();
            for (let i = 0; i < factorReturns.length && i < factorTimestamps.length; i++) {
              const dateKey = new Date(factorTimestamps[i]).toISOString().slice(0, 10);
              factorByDate.set(dateKey, factorReturns[i]);
            }
            
            // Align residuals with factor by date (using same lag as market)
            const alignedResid = [];
            const alignedFactor = [];
            for (let i = 0; i < residuals.length && i < posTs.length; i++) {
              const posDate = new Date(posTs[i]);
              let targetDate = new Date(posDate);
              if (lag === -1) targetDate.setDate(targetDate.getDate() - 1);
              else if (lag === 1) targetDate.setDate(targetDate.getDate() + 1);
              
              const targetKey = targetDate.toISOString().slice(0, 10);
              const factorReturn = factorByDate.get(targetKey);
              
              if (factorReturn !== undefined) {
                alignedResid.push(residuals[i]);
                alignedFactor.push(factorReturn);
              }
            }
            
            if (alignedResid.length < 30) return 0;
            
            // Compute beta
            const n = alignedResid.length;
            let meanR = 0, meanF = 0;
            for (let i = 0; i < n; i++) {
              meanR += alignedResid[i];
              meanF += alignedFactor[i];
            }
            meanR /= n;
            meanF /= n;
            
            let cov = 0, varF = 0;
            for (let i = 0; i < n; i++) {
              cov += (alignedResid[i] - meanR) * (alignedFactor[i] - meanF);
              varF += (alignedFactor[i] - meanF) ** 2;
            }
            
            return varF > 0 ? cov / varF : 0;
          };
          
          // Use SPY's timestamps for all factor spreads (they're computed from US ETFs)
          // IMPORTANT: Use posTimestampsAligned (matched timestamps) not original posTimestamps
          if (smbData?.returns && smbData?.timestamps) betas.SMB = computeBetaOnResiduals(smbData.returns, smbData.timestamps, residualsAfterMkt, posTimestampsAligned);
          if (hmlData?.returns && hmlData?.timestamps) betas.HML = computeBetaOnResiduals(hmlData.returns, hmlData.timestamps, residualsAfterMkt, posTimestampsAligned);
          if (momData?.returns && momData?.timestamps) betas.MOM = computeBetaOnResiduals(momData.returns, momData.timestamps, residualsAfterMkt, posTimestampsAligned);
          
          const residualVol = Math.sqrt(ssResid / (weights ? 1 : len)) * Math.sqrt(252);
          
          bestResult = {
            alpha,
            betas,
            rSquared,
            residualVol,
            lag,
            matchedDates,
          };
        }
      }
      
      if (bestResult.rSquared >= 0) {
        return bestResult;
      }
    }
    
    // Standard index-based alignment for US stocks
    const spy = spyData.returns;
    const smb = smbData?.returns || [];
    const hml = hmlData?.returns || [];
    const mom = momData?.returns || [];
    
    const len = Math.min(
      positionReturns.length,
      spy.length,
      smb.length > 0 ? smb.length : Infinity,
      hml.length > 0 ? hml.length : Infinity,
      mom.length > 0 ? mom.length : Infinity
    );
    
    if (len < 30) {
      return { alpha: 0, betas: {}, rSquared: 0, residualVol: 0, lag: 0 };
    }
    
    // Align from end (most recent data)
    const y = positionReturns.slice(-len);
    const mkt = spy.slice(-len);
    const smbAligned = smb.length > 0 ? smb.slice(-len) : null;
    const hmlAligned = hml.length > 0 ? hml.slice(-len) : null;
    const momAligned = mom.length > 0 ? mom.slice(-len) : null;
    
    // Compute EWMA weights if lambda < 1
    let weights = null;
    if (ewmaLambda < 0.9999) {
      weights = new Array(len);
      let sumWeights = 0;
      for (let t = 0; t < len; t++) {
        weights[t] = Math.pow(ewmaLambda, len - 1 - t);
        sumWeights += weights[t];
      }
      for (let t = 0; t < len; t++) {
        weights[t] /= sumWeights;
      }
    }
    
    // Helper for weighted or unweighted mean
    const computeMean = (arr) => {
      if (weights) {
        return arr.reduce((sum, val, i) => sum + weights[i] * val, 0);
      }
      return arr.reduce((a, b) => a + b, 0) / len;
    };
    
    // Helper for weighted or unweighted covariance/variance
    const computeCovVar = (arr1, mean1, arr2, mean2) => {
      let cov = 0;
      for (let i = 0; i < len; i++) {
        const d1 = arr1[i] - mean1;
        const d2 = arr2[i] - mean2;
        cov += weights ? weights[i] * d1 * d2 : d1 * d2;
      }
      return weights ? cov : cov / len;
    };
    
    // Compute market beta
    const meanY = computeMean(y);
    const meanMkt = computeMean(mkt);
    
    const covYMkt = computeCovVar(y, meanY, mkt, meanMkt);
    const varMkt = computeCovVar(mkt, meanMkt, mkt, meanMkt);
    const varY = computeCovVar(y, meanY, y, meanY);
    
    const betaMkt = varMkt > 0 ? covYMkt / varMkt : 0;
    
    // Compute residuals after removing market
    const residualsAfterMkt = y.map((yi, i) => yi - betaMkt * mkt[i]);
    const meanResid = computeMean(residualsAfterMkt);
    
    // Compute alpha (annualized)
    const alpha = meanResid * 252;
    
    // Compute betas for other factors on residuals
    const betas = { MKT: betaMkt };
    
    const computeBetaOnResiduals = (factorReturns, residuals) => {
      if (!factorReturns || factorReturns.length !== residuals.length) return 0;
      const meanF = computeMean(factorReturns);
      const meanR = computeMean(residuals);
      const cov = computeCovVar(factorReturns, meanF, residuals, meanR);
      const varF = computeCovVar(factorReturns, meanF, factorReturns, meanF);
      return varF > 0 ? cov / varF : 0;
    };
    
    if (smbAligned) betas.SMB = computeBetaOnResiduals(smbAligned, residualsAfterMkt);
    if (hmlAligned) betas.HML = computeBetaOnResiduals(hmlAligned, residualsAfterMkt);
    if (momAligned) betas.MOM = computeBetaOnResiduals(momAligned, residualsAfterMkt);
    
    // Compute R-squared (proportion of variance explained by market)
    let ssResid = 0;
    for (let i = 0; i < len; i++) {
      const predicted = betaMkt * mkt[i];
      const resid = y[i] - predicted;
      ssResid += weights ? weights[i] * resid * resid : resid * resid;
    }
    const totalVar = weights ? varY : varY * len;
    const rSquared = totalVar > 0 ? 1 - (ssResid / totalVar) : 0;
    
    // Residual volatility (annualized)
    const residualVol = Math.sqrt(ssResid / (weights ? 1 : len)) * Math.sqrt(252);
    
    return {
      alpha,
      betas,
      rSquared: Math.max(0, Math.min(1, rSquared)),
      residualVol,
      lag: 0,
    };
  }, [alignReturnsByDate]);
  
  // Detect best thematic match for a position (with optional EWMA weighting and date alignment)
  const detectThematicMatch = useCallback((positionReturns, posTimestamps, factorReturnsMap, excludeList = ['SPY'], ewmaLambda = 1.0, isInternational = false) => {
    // Test against all thematic ETFs
    const thematicETFTickers = Object.keys(THEMATIC_ETFS);

    let bestMatch = { ticker: null, beta: 0, rSquared: 0, name: 'None', lag: 0 };

    // OPTIMIZATION: Only test lags for international stocks (US stocks are same timezone)
    const lags = isInternational ? [-1, 0, 1] : [0];

    for (const etfTicker of thematicETFTickers) {
      if (excludeList.includes(etfTicker)) continue;

      const etfData = factorReturnsMap[etfTicker];
      if (!etfData?.returns || etfData.returns.length < 30) continue;

      const etfReturns = etfData.returns;
      const etfTimestamps = etfData.timestamps;

      let bestLagResult = { rSquared: 0, lag: 0, beta: 0, correlation: 0 };

      for (const lag of lags) {
        let result;

        if (isInternational && posTimestamps?.length > 0 && etfTimestamps?.length > 0) {
          // Use date alignment for international stocks
          const { posAligned, etfAligned } = alignReturnsByDate(
            positionReturns, posTimestamps, etfReturns, etfTimestamps, lag
          );
          result = computeCorrelationFromAligned(posAligned, etfAligned, ewmaLambda);
        } else {
          // Simple index alignment for US stocks (faster, no lag needed)
          const len = Math.min(positionReturns.length, etfReturns.length);
          const y = positionReturns.slice(-len);
          const x = etfReturns.slice(-len);
          result = computeCorrelationFromAligned(y, x, ewmaLambda);
        }

        if (result.rSquared > bestLagResult.rSquared) {
          bestLagResult = { ...result, lag };
        }
      }

      // Update best match if this ETF (at its optimal lag) has higher R²
      // Use 10% threshold to catch international stocks with some noise
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

        // OPTIMIZATION: Early exit if we found a very strong match (R² > 60%)
        if (bestMatch.rSquared > 0.60) break;
      }
    }

    return bestMatch;
  }, [alignReturnsByDate, computeCorrelationFromAligned]);
  
  // Main factor analysis function
  // Can optionally pass marketData directly to avoid stale closure issues
  const runFactorAnalysis = useCallback(async (factorDataInput, marketData = null) => {
    const fData = factorDataInput || factorData;
    if (!fData || !fData['SPY']) {
      console.warn('No factor data available');
      return;
    }
    
    // Use passed-in market data or fall back to state
    const mktData = marketData || unifiedMarketData;
    
    console.log('🔬 Running factor analysis...');
    
    // Debug: Check if factor data has timestamps
    console.log(`📊 Factor data SPY: returns=${fData['SPY']?.returns?.length || 0}, timestamps=${fData['SPY']?.timestamps?.length || 0}`);
    
    // Calculate EWMA lambda if enabled (same logic as correlation)
    let ewmaLambda = 1.0;
    if (useEwma) {
      const halfLifeDays = {
        '6mo': 63,
        '1y': 126,
        '2y': 252,
        '3y': 378,
      }[historyTimeline] || 126;
      ewmaLambda = Math.exp(-Math.LN2 / halfLifeDays);
      console.log(`📊 Factor analysis using EWMA with half-life: ${halfLifeDays} days (λ=${ewmaLambda.toFixed(4)})`);
    }
    
    // Get position returns from unified data or historical data
    const getPositionReturns = (ticker) => {
      const unified = mktData[ticker?.toUpperCase()];
      if (unified?.dailyReturns?.length > 0) return unified.dailyReturns;
      if (unified?.returns?.length > 0) return unified.returns;
      const hist = historicalData[ticker?.toUpperCase()];
      if (hist?.returns?.length > 0) return hist.returns;
      return [];
    };
    
    // Analyze each position
    const positionAnalysis = [];
    
    for (const pos of positions) {
      const ticker = pos.ticker?.toUpperCase();
      if (!ticker) continue;
      
      const returns = getPositionReturns(ticker);
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
      
      // Compute factor betas (with EWMA if enabled)
      // For international stocks, use date alignment and try multiple lags
      const isInternational = ticker.includes('.') && !ticker.endsWith('.US');
      const rawPosTimestamps = mktData[ticker]?.timestamps;
      const posTimestamps = rawPosTimestamps?.slice(1) || [];

      const factorBetas = computeFactorBetas(returns, posTimestamps, fData, ewmaLambda, isInternational);
      
      // Detect thematic match (use override if set)
      let thematicMatch;
      const override = thematicOverrides[pos.id];
      
      if (override && fData[override]) {
        // User override - compute beta to the specified ETF
        const etfReturns = fData[override].returns;
        const etfTimestamps = fData[override].timestamps;

        // OPTIMIZATION: Only test lags for international stocks
        const lagsToTry = isInternational ? [-1, 0, 1] : [0];
        let bestOverrideResult = { rSquared: -1, lag: 0, beta: 0, matchedDates: 0 };

        for (const testLag of lagsToTry) {
          let result;

          if (isInternational && posTimestamps.length > 0 && etfTimestamps?.length > 0) {
            // Use date alignment for international stocks
            const { posAligned, etfAligned, matchedDates } = alignReturnsByDate(
              returns, posTimestamps, etfReturns, etfTimestamps, testLag
            );
            result = computeCorrelationFromAligned(posAligned, etfAligned, ewmaLambda);
            result.matchedDates = matchedDates;
          } else {
            // Simple index alignment for US stocks (no lag needed)
            const len = Math.min(returns.length, etfReturns.length);
            const y = returns.slice(-len);
            const x = etfReturns.slice(-len);
            result = computeCorrelationFromAligned(y, x, ewmaLambda);
            result.matchedDates = y.length;
          }

          if (result.rSquared > bestOverrideResult.rSquared) {
            bestOverrideResult = { ...result, lag: testLag };
          }
        }

        thematicMatch = {
          ticker: override,
          beta: bestOverrideResult.beta,
          rSquared: bestOverrideResult.rSquared,
          lag: bestOverrideResult.lag,
          name: THEMATIC_ETFS[override]?.name || override,
          category: THEMATIC_ETFS[override]?.category || 'custom',
          isOverride: true,
        };
      } else {
        // Detect thematic match using date alignment for international stocks
        thematicMatch = detectThematicMatch(returns, posTimestamps, fData, ['SPY'], ewmaLambda, isInternational);
      }
      
      positionAnalysis.push({
        id: pos.id,
        ticker,
        weight: (pos.quantity * pos.price) / portfolioValue,
        factorBetas,
        thematicMatch,
        hasData: true,
      });
    }
    
    // Aggregate portfolio-level factor exposures
    const portfolioFactorBetas = {
      MKT: 0, SMB: 0, HML: 0, MOM: 0,
    };
    let portfolioAlpha = 0;
    let weightedRSquared = 0;
    
    for (const pa of positionAnalysis) {
      if (!pa.hasData) continue;
      const w = Math.abs(pa.weight); // Use absolute weight for aggregation
      const sign = pa.weight >= 0 ? 1 : -1;
      
      portfolioFactorBetas.MKT += pa.weight * (pa.factorBetas.betas.MKT || 0);
      portfolioFactorBetas.SMB += pa.weight * (pa.factorBetas.betas.SMB || 0);
      portfolioFactorBetas.HML += pa.weight * (pa.factorBetas.betas.HML || 0);
      portfolioFactorBetas.MOM += pa.weight * (pa.factorBetas.betas.MOM || 0);
      portfolioAlpha += pa.weight * pa.factorBetas.alpha;
      weightedRSquared += w * pa.factorBetas.rSquared;
    }
    
    // Detect thematic concentrations
    const thematicGroups = {};
    for (const pa of positionAnalysis) {
      if (!pa.thematicMatch?.ticker) continue;
      const etf = pa.thematicMatch.ticker;
      if (!thematicGroups[etf]) {
        thematicGroups[etf] = {
          etf,
          name: pa.thematicMatch.name,
          category: pa.thematicMatch.category,
          positions: [],
          totalWeight: 0,
          weightedBeta: 0,
        };
      }
      thematicGroups[etf].positions.push(pa);
      thematicGroups[etf].totalWeight += Math.abs(pa.weight);
      thematicGroups[etf].weightedBeta += pa.weight * pa.thematicMatch.beta;
    }
    
    // Calculate average beta for each group
    for (const group of Object.values(thematicGroups)) {
      if (group.totalWeight > 0) {
        group.avgBeta = group.weightedBeta / group.totalWeight;
      }
    }
    
    // Sort by weight descending
    const sortedThematicGroups = Object.values(thematicGroups)
      .filter(g => g.totalWeight >= 0.05) // At least 5% concentration
      .sort((a, b) => b.totalWeight - a.totalWeight);
    
    // Historical return attribution
    const factorReturns = {
      MKT: fData['SPY']?.totalReturn || 0,
      SMB: fData['SMB']?.totalReturn || 0,
      HML: fData['HML']?.totalReturn || 0,
      MOM: fData['MOM']?.totalReturn || 0,
    };
    
    const attribution = {
      MKT: portfolioFactorBetas.MKT * factorReturns.MKT,
      SMB: portfolioFactorBetas.SMB * factorReturns.SMB,
      HML: portfolioFactorBetas.HML * factorReturns.HML,
      MOM: portfolioFactorBetas.MOM * factorReturns.MOM,
    };
    
    // Compute thematic attribution
    const thematicAttribution = {};
    for (const group of sortedThematicGroups) {
      const etfReturn = fData[group.etf]?.totalReturn || 0;
      thematicAttribution[group.etf] = {
        name: group.name,
        contribution: group.avgBeta * group.totalWeight * etfReturn,
        etfReturn,
      };
    }
    
    const totalFactorAttribution = Object.values(attribution).reduce((a, b) => a + b, 0);
    
    // Risk decomposition (simplified)
    // Factor risk vs idiosyncratic risk based on weighted R²
    const totalWeights = positionAnalysis.reduce((sum, pa) => sum + Math.abs(pa.weight), 0);
    const avgRSquared = totalWeights > 0 ? weightedRSquared / totalWeights : 0;
    
    const analysis = {
      positions: positionAnalysis,
      portfolioFactorBetas,
      portfolioAlpha,
      thematicGroups: sortedThematicGroups,
      attribution,
      thematicAttribution,
      factorReturns,
      riskDecomposition: {
        factorRisk: avgRSquared,
        idiosyncraticRisk: 1 - avgRSquared,
      },
      timestamp: new Date().toISOString(),
    };
    
    console.log('✅ Factor analysis complete:', analysis);
    setFactorAnalysis(analysis);
    setIsFetchingFactors(false);
    
    // Show success toast
    const thematicCount = sortedThematicGroups.filter(g => g.positions.length > 0).length;
    showToast({
      type: 'success',
      title: 'Factor Analysis Complete',
      message: `${positionAnalysis.length} positions analyzed, ${thematicCount} thematic exposures found`,
      duration: 4000,
    });
    
  }, [factorData, positions, portfolioValue, unifiedMarketData, historicalData, computeFactorBetas, detectThematicMatch, thematicOverrides, useEwma, historyTimeline, showToast]);

  // ============================================
  // PORTFOLIO OPTIMIZATION 
  // ============================================
  // Core optimization functions imported from ./utils/portfolioOptimization.js
  
  // Analytical swap matrix - computed persistently for heatmap display
  // This is the same calculation used in optimization, but runs immediately on data changes
  const analyticalSwapMatrix = useMemo(() => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    if (tickers.length < 2 || !editedCorrelation || editedCorrelation.length < 2) {
      return null;
    }
    
    try {
      const n = positions.length;
      const rf = riskFreeRate;
      
      // Get distribution parameters
      const derivedParams = positions.map(p => getDistributionParams(p));
      const muArray = derivedParams.map(d => d.mu);
      const sigmaArray = derivedParams.map(d => d.sigma);
      
      // Build covariance matrix
      const covMatrix = buildCovarianceMatrix(editedCorrelation, sigmaArray);
      
      // Compute leverage ratio
      const leverageRatio = grossPositionsValue > 0 ? grossPositionsValue / portfolioValue : 1;
      
      // Compute adjusted weights
      const positionVals = positions.map(p => (p.quantity || 0) * (p.price || 0));
      const adjustedWeights = positionVals.map(v => v / (portfolioValue || 1));
      
      // Cash contribution
      const effectiveCashWeight = 1 - adjustedWeights.reduce((a, b) => a + b, 0);
      const cashContribution = effectiveCashWeight * (cashRate || 0);
      
      // Current portfolio metrics
      const currentPortfolioVol = computePortfolioVolatility(adjustedWeights, covMatrix);
      const currentPositionsReturn = computePortfolioReturn(adjustedWeights, muArray);
      const currentPortfolioReturn = currentPositionsReturn + cashContribution;
      const currentSharpe = computeSharpeRatio(currentPortfolioReturn, currentPortfolioVol, rf);
      
      // Compute swap matrix
      const swapDeltaSharpe = Array(n).fill(null).map(() => Array(n).fill(0));
      const swapDeltaVol = Array(n).fill(null).map(() => Array(n).fill(0));
      const swapDeltaReturn = Array(n).fill(null).map(() => Array(n).fill(0));
      const swapAmount = swapSize; // User-configurable swap size
      
      for (let sell = 0; sell < n; sell++) {
        for (let buy = 0; buy < n; buy++) {
          if (buy === sell) continue;
          
          // New adjusted weights after swap
          const newAdjustedWeights = adjustedWeights.map((w, i) => {
            if (i === sell) return w - swapAmount * leverageRatio;
            if (i === buy) return w + swapAmount * leverageRatio;
            return w;
          });
          
          const newVol = computePortfolioVolatility(newAdjustedWeights, covMatrix);
          const newPositionsReturn = computePortfolioReturn(newAdjustedWeights, muArray);
          const newReturn = newPositionsReturn + cashContribution;
          const newSharpe = computeSharpeRatio(newReturn, newVol, rf);
          
          swapDeltaSharpe[sell][buy] = newSharpe - currentSharpe;
          swapDeltaVol[sell][buy] = newVol - currentPortfolioVol;
          swapDeltaReturn[sell][buy] = newReturn - currentPortfolioReturn;
        }
      }
      
      return {
        tickers,
        deltaSharpe: swapDeltaSharpe,
        deltaVol: swapDeltaVol,
        deltaReturn: swapDeltaReturn,
        currentSharpe,
        currentVol: currentPortfolioVol,
        currentReturn: currentPortfolioReturn,
        leverageRatio,
      };
    } catch (e) {
      console.warn('Error computing analytical swap matrix:', e);
      return null;
    }
  }, [positions, editedCorrelation, riskFreeRate, grossPositionsValue, portfolioValue, cashRate, getDistributionParams]);

  // Run full portfolio optimization analysis
  const runPortfolioOptimization = useCallback(async (correlationMatrixParam = null) => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    // Use passed-in correlation or fall back to state (for manual calls)
    const correlationToUse = correlationMatrixParam || editedCorrelation;
    if (tickers.length < 2 || !correlationToUse || correlationToUse.length < 2) {
      showToast({
        type: 'warning',
        title: 'Cannot Run Optimization',
        message: 'Need at least 2 positions with a computed correlation matrix.',
        duration: 5000,
      });
      return;
    }
    
    setIsOptimizing(true);
    setOptimizationProgress({ current: 0, total: 100, phase: 'Computing risk decomposition...' });
    
    const startTime = performance.now();
    const n = positions.length;
    const rf = riskFreeRate;
    
    // Get distribution parameters
    const derivedParams = positions.map(p => getDistributionParams(p));
    const muArray = derivedParams.map(d => d.mu);
    const sigmaArray = derivedParams.map(d => d.sigma);
    const skewArray = derivedParams.map(d => d.skew);
    const dfArray = derivedParams.map(d => d.tailDf);
    
    // ==================== MATCH SIMULATION TAB METHODOLOGY ====================
    // Use adjusted weights (accounting for leverage) and include cash
    const totalValue = portfolioValue || 1;
    const leverageRatio = grossPositionsValue > 0 ? grossPositionsValue / totalValue : 1;
    const adjustedWeights = weights.map(w => (w || 0) * leverageRatio);
    const effectiveCashWeight = cashBalance / totalValue;
    const cashContribution = effectiveCashWeight * (cashRate || 0);
    
    console.log('📊 Optimization using:', {
      leverageRatio: leverageRatio.toFixed(3),
      effectiveCashWeight: (effectiveCashWeight * 100).toFixed(1) + '%',
      sumAdjustedWeights: adjustedWeights.reduce((a, b) => a + b, 0).toFixed(3),
    });
    
    // Build covariance matrix (using correlationToUse instead of editedCorrelation)
    const covMatrix = buildCovarianceMatrix(correlationToUse, sigmaArray);
    
    // Current portfolio metrics (using adjusted weights, matching simulation tab)
    const currentPortfolioVol = computePortfolioVolatility(adjustedWeights, covMatrix);
    const positionsReturn = computePortfolioReturn(adjustedWeights, muArray);
    const currentPortfolioReturn = positionsReturn + cashContribution;
    const currentSharpe = computeSharpeRatio(currentPortfolioReturn, currentPortfolioVol, rf);
    
    console.log('📊 Current portfolio metrics:', {
      positionsReturn: (positionsReturn * 100).toFixed(2) + '%',
      cashContribution: (cashContribution * 100).toFixed(2) + '%',
      totalReturn: (currentPortfolioReturn * 100).toFixed(2) + '%',
      volatility: (currentPortfolioVol * 100).toFixed(2) + '%',
      sharpe: currentSharpe.toFixed(3),
    });
    
    // Risk decomposition (using adjusted weights)
    const mctr = computeMCTR(adjustedWeights, covMatrix, currentPortfolioVol);
    const riskContribution = computeRiskContribution(adjustedWeights, mctr, currentPortfolioVol);
    const iSharpe = computeIncrementalSharpe(adjustedWeights, muArray, sigmaArray, covMatrix, rf, cashContribution);
    const optimalityRatio = computeOptimalityRatio(muArray, mctr, rf);
    
    // Risk parity target (using raw weights since it's a rebalancing target)
    const riskParityWeights = computeRiskParityWeights(sigmaArray, covMatrix);
    // Apply same leverage ratio to risk parity weights for comparison
    const adjustedRiskParityWeights = riskParityWeights.map(w => w * leverageRatio);
    const riskParityVol = computePortfolioVolatility(adjustedRiskParityWeights, covMatrix);
    const riskParityPositionsReturn = computePortfolioReturn(adjustedRiskParityWeights, muArray);
    const riskParityReturn = riskParityPositionsReturn + cashContribution;
    const riskParitySharpe = computeSharpeRatio(riskParityReturn, riskParityVol, rf);
    
    setOptimizationProgress({ current: 10, total: 100, phase: 'Computing swap matrix...' });
    await new Promise(r => setTimeout(r, 10)); // Allow UI update
    
    // Compute swap matrix (n x n) - delta Sharpe for each possible swap
    // Use adjusted weights for consistency
    const swapDeltaSharpe = Array(n).fill(null).map(() => Array(n).fill(0));
    const swapDeltaVol = Array(n).fill(null).map(() => Array(n).fill(0));
    const swapDeltaReturn = Array(n).fill(null).map(() => Array(n).fill(0));
    const swapAmount = swapSize; // User-configurable swap size
    
    for (let sell = 0; sell < n; sell++) {
      for (let buy = 0; buy < n; buy++) {
        if (buy === sell) continue;
        
        // New adjusted weights after swap (swap in terms of gross exposure)
        const newAdjustedWeights = adjustedWeights.map((w, i) => {
          if (i === sell) return w - swapAmount * leverageRatio;
          if (i === buy) return w + swapAmount * leverageRatio;
          return w;
        });
        
        const newVol = computePortfolioVolatility(newAdjustedWeights, covMatrix);
        const newPositionsReturn = computePortfolioReturn(newAdjustedWeights, muArray);
        const newReturn = newPositionsReturn + cashContribution; // Include cash
        const newSharpe = computeSharpeRatio(newReturn, newVol, rf);
        
        swapDeltaSharpe[sell][buy] = newSharpe - currentSharpe;
        swapDeltaVol[sell][buy] = newVol - currentPortfolioVol;
        swapDeltaReturn[sell][buy] = newReturn - currentPortfolioReturn;
      }
    }
    
    // Find top swaps
    const allSwaps = [];
    for (let sell = 0; sell < n; sell++) {
      for (let buy = 0; buy < n; buy++) {
        if (buy === sell) continue;
        allSwaps.push({
          sellIdx: sell,
          buyIdx: buy,
          sellTicker: tickers[sell],
          buyTicker: tickers[buy],
          deltaSharpe: swapDeltaSharpe[sell][buy],
          deltaVol: swapDeltaVol[sell][buy],
          deltaReturn: swapDeltaReturn[sell][buy],
        });
      }
    }
    allSwaps.sort((a, b) => b.deltaSharpe - a.deltaSharpe);
    const topSwaps = allSwaps.slice(0, 15);
    
    setOptimizationProgress({ current: 20, total: 100, phase: 'Running Monte Carlo validation...' });
    await new Promise(r => setTimeout(r, 10));
    
    // Monte Carlo validation for top swaps
    // User-configurable paths for accuracy vs speed tradeoff
    const pathsPerSwap = optimizationPaths;
    
    // Halton sequence for QMC (same as main simulation)
    const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73];
    const halton = (index, base) => {
      let f = 1, r = 0, i = index;
      while (i > 0) {
        f = f / base;
        r = r + f * (i % base);
        i = Math.floor(i / base);
      }
      return r;
    };
    const haltonPoint = (index, dimensions) => {
      const point = new Float64Array(dimensions);
      for (let d = 0; d < dimensions; d++) {
        const scrambledIndex = index + 1 + d * 100;
        point[d] = halton(scrambledIndex, PRIMES[d % PRIMES.length]);
      }
      return point;
    };
    
    // Normal inverse CDF for QMC
    const normalCDFInv = (p) => {
      if (p <= 0) return -6;
      if (p >= 1) return 6;
      if (p === 0.5) return 0;
      const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
      const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
      const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
      const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
      const pLow = 0.02425, pHigh = 1 - pLow;
      let q, r;
      if (p < pLow) {
        q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
      } else if (p <= pHigh) {
        q = p - 0.5; r = q * q;
        return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
      } else {
        q = Math.sqrt(-2 * Math.log(1 - p));
        return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
      }
    };
    
    // Chi-squared inverse CDF for QMC multivariate-t
    const chiSquaredInvCDF = (p, df) => {
      if (p <= 0) return 0.01;
      if (p >= 1) return df * 10;
      const z = normalCDFInv(p);
      const h = 2 / (9 * df);
      const x = df * Math.pow(1 - h + z * Math.sqrt(h), 3);
      return Math.max(0.01, x);
    };
    
    // Mini Monte Carlo function - takes ALREADY ADJUSTED weights
    // Now supports QMC when useQmc is enabled
    const runMiniMonteCarlo = async (testAdjustedWeights, label, qmcOffset = 0) => {
      const paths = pathsPerSwap;
      const constantCashReturn = effectiveCashWeight * (cashRate || 0);
      
      // Cholesky decomposition - use correlationToUse (passed param or state)
      const L = choleskyDecomposition(correlationToUse);
      const flatL = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) {
          flatL[i * n + j] = L[i]?.[j] || 0;
        }
      }
      
      const terminalReturns = new Float64Array(paths);
      const muArr = new Float64Array(muArray);
      const sigmaArr = new Float64Array(sigmaArray);
      const weightsArr = new Float64Array(testAdjustedWeights); // Already adjusted
      const skewArr = new Float64Array(skewArray);
      const dfArr = new Float64Array(dfArray);
      
      const validDfs = dfArray.filter(d => d > 0 && d < 100);
      const avgDf = validDfs.length > 0 ? Math.min(...validDfs) : 10;
      
      const z = new Float64Array(n);
      const correlatedZ = new Float64Array(n);
      
      // For QMC, we need n dimensions + 1 for chi-squared
      const qmcDims = n + 1;
      
      for (let path = 0; path < paths; path++) {
        // Generate correlated normals - either via Box-Muller or QMC inverse CDF
        if (useQmc) {
          // QMC: Use Halton sequence + inverse CDF
          const u = haltonPoint(qmcOffset + path, qmcDims);
          for (let i = 0; i < n; i++) {
            const ui = Math.max(0.0001, Math.min(0.9999, u[i]));
            z[i] = normalCDFInv(ui);
          }
        } else {
          // Standard MC: Box-Muller
          for (let i = 0; i < n; i++) z[i] = boxMuller();
        }
        
        // Apply Cholesky correlation
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let j = 0; j <= i; j++) sum += flatL[i * n + j] * z[j];
          correlatedZ[i] = sum || 0;
        }
        
        // Multivariate Student-t with QMC support
        let chiSquared;
        if (useQmc) {
          const u = haltonPoint(qmcOffset + path, qmcDims);
          const uChi = Math.max(0.0001, Math.min(0.9999, u[n]));
          chiSquared = chiSquaredInvCDF(uChi, avgDf);
        } else {
          chiSquared = generateChiSquared(avgDf);
        }
        const scaleFactor = Math.sqrt(avgDf / chiSquared);
        const varianceCorrection = avgDf > 2 ? Math.sqrt((avgDf - 2) / avgDf) : 1;
        
        let positionsReturn = 0;
        for (let i = 0; i < n; i++) {
          let transformed = correlatedZ[i] * scaleFactor * varianceCorrection;
          
          const skew = skewArr[i] || 0;
          if (Math.abs(skew) > 0.01) {
            const delta = skew / Math.sqrt(1 + skew * skew);
            transformed = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed) - delta * Math.sqrt(2 / Math.PI);
          }
          transformed = Math.max(-8, Math.min(8, transformed));
          
          const assetReturn = muArr[i] + transformed * sigmaArr[i];
          positionsReturn += weightsArr[i] * Math.max(-1, Math.min(10, assetReturn));
        }
        
        const portfolioReturn = Math.max(-1, Math.min(10, positionsReturn + constantCashReturn));
        terminalReturns[path] = isFinite(portfolioReturn) ? portfolioReturn : 0;
      }
      
      // Compute statistics
      const validReturns = Array.from(terminalReturns).filter(v => isFinite(v));
      const sorted = [...validReturns].sort((a, b) => a - b);
      const mean = validReturns.reduce((a, b) => a + b, 0) / validReturns.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const pLoss = validReturns.filter(v => v < 0).length / validReturns.length;
      const var5 = sorted[Math.floor(sorted.length * 0.05)];
      const cvar5Vals = sorted.slice(0, Math.floor(sorted.length * 0.05));
      const cvar5 = cvar5Vals.length > 0 ? cvar5Vals.reduce((a, b) => a + b, 0) / cvar5Vals.length : var5;
      const var1 = sorted[Math.floor(sorted.length * 0.01)];
      const stdDev = Math.sqrt(validReturns.reduce((sum, v) => sum + (v - mean) ** 2, 0) / validReturns.length);
      const sharpe = stdDev > 0 ? (mean - rf) / stdDev : 0;
      
      return { mean, median, pLoss, var5, cvar5, var1, stdDev, sharpe, label };
    };
    
    // Helper to format paths count (e.g., 50000 -> "50k")
    const formatPaths = (n) => n >= 1000 ? `${(n/1000).toFixed(0)}k` : n;
    
    // Run baseline with adjusted weights
    setOptimizationProgress({ current: 25, total: 100, phase: `Monte Carlo: Baseline portfolio (${formatPaths(pathsPerSwap)} paths${useQmc ? ', QMC' : ''})...` });
    await new Promise(r => setTimeout(r, 10));
    const baselineMC = await runMiniMonteCarlo(adjustedWeights, 'Baseline', 0);
    
    // Run for each top swap
    const swapMCResults = [];
    for (let i = 0; i < topSwaps.length; i++) {
      const swap = topSwaps[i];
      const progress = 30 + Math.round((i / topSwaps.length) * 65);
      setOptimizationProgress({ 
        current: progress, 
        total: 100, 
        phase: `Monte Carlo: Swap ${i + 1}/${topSwaps.length} (Sell ${swap.sellTicker} → Buy ${swap.buyTicker}, ${formatPaths(pathsPerSwap)} paths${useQmc ? ', QMC' : ''})...` 
      });
      await new Promise(r => setTimeout(r, 10));
      
      // Compute swap weights using adjusted weights
      const swapAdjustedWeights = adjustedWeights.map((w, idx) => {
        if (idx === swap.sellIdx) return w - swapAmount * leverageRatio;
        if (idx === swap.buyIdx) return w + swapAmount * leverageRatio;
        return w;
      });
      
      // Each swap gets a different QMC offset to use non-overlapping sequences
      const qmcOffset = (i + 1) * pathsPerSwap;
      const mcResult = await runMiniMonteCarlo(swapAdjustedWeights, `Sell ${swap.sellTicker} → Buy ${swap.buyTicker}`, qmcOffset);
      swapMCResults.push({
        ...swap,
        mc: mcResult,
        deltaMetrics: {
          deltaMean: mcResult.mean - baselineMC.mean,
          deltaMedian: mcResult.median - baselineMC.median,
          deltaPLoss: mcResult.pLoss - baselineMC.pLoss,
          deltaVaR5: mcResult.var5 - baselineMC.var5,
          deltaCVaR5: mcResult.cvar5 - baselineMC.cvar5,
          deltaMCSharpe: mcResult.sharpe - baselineMC.sharpe,
        }
      });
    }
    
    // Sort by MC Sharpe improvement
    swapMCResults.sort((a, b) => b.deltaMetrics.deltaMCSharpe - a.deltaMetrics.deltaMCSharpe);
    
    setOptimizationProgress({ current: 95, total: 100, phase: 'Finalizing results...' });
    await new Promise(r => setTimeout(r, 10));
    
    // Compile results
    const results = {
      timestamp: Date.now(),
      computeTime: performance.now() - startTime,
      pathsPerScenario: pathsPerSwap,
      useQmc: useQmc || false,
      leverageRatio,
      effectiveCashWeight,
      
      // Current portfolio
      current: {
        portfolioReturn: currentPortfolioReturn,
        portfolioVol: currentPortfolioVol,
        sharpe: currentSharpe,
        mcResults: baselineMC,
      },
      
      // Risk decomposition per position
      positions: tickers.map((ticker, i) => ({
        ticker,
        weight: weights[i], // Raw weight (gross exposure basis)
        adjustedWeight: adjustedWeights[i], // Leverage-adjusted weight
        mu: muArray[i],
        sigma: sigmaArray[i],
        mctr: mctr[i],
        riskContribution: riskContribution[i],
        iSharpe: iSharpe[i],
        optimalityRatio: optimalityRatio[i],
        assetSharpe: sigmaArray[i] > 0 ? (muArray[i] - rf) / sigmaArray[i] : 0,
      })),
      
      // Swap matrix
      swapMatrix: {
        tickers,
        deltaSharpe: swapDeltaSharpe,
        deltaVol: swapDeltaVol,
        deltaReturn: swapDeltaReturn,
      },
      
      // Top swaps with MC validation
      topSwaps: swapMCResults,
      baselineMC,
      
      // Risk parity comparison
      riskParity: {
        weights: riskParityWeights,
        portfolioReturn: riskParityReturn,
        portfolioVol: riskParityVol,
        sharpe: riskParitySharpe,
        deltaSharpe: riskParitySharpe - currentSharpe,
        weightChanges: tickers.map((ticker, i) => ({
          ticker,
          current: weights[i],
          target: riskParityWeights[i],
          change: riskParityWeights[i] - weights[i],
        })),
      },
    };
    
    const optTime = (results.computeTime / 1000).toFixed(1);
    console.log(`✅ Optimization complete in ${optTime}s`);
    
    setOptimizationResults(results);
    setOptimizationProgress({ current: 100, total: 100, phase: 'Complete!' });
    setIsOptimizing(false);
    
    // Show success toast
    showToast({
      type: 'success',
      title: 'Optimization Complete',
      message: `Analysis finished in ${optTime}s with ${results.positions?.length || 0} positions`,
      duration: 4000,
    });
  }, [positions, weights, editedCorrelation, riskFreeRate, swapSize, optimizationPaths, getDistributionParams,
      grossPositionsValue, portfolioValue, cashBalance, cashRate, useQmc, showToast]);

  // ============================================
  // THEMATIC ETF SWAP ANALYSIS
  // Sell 1% of any portfolio position, buy 1% of various thematic ETFs
  // Uses Monte Carlo with same methodology as Optimize tab
  // ============================================
  const runThematicSwapAnalysis = useCallback(async () => {
    if (!factorData || !editedCorrelation || positions.length < 1) {
      showToast({ 
        type: 'warning', 
        title: 'Cannot Run Analysis', 
        message: 'Need factor data loaded and at least one position with correlation matrix.',
        duration: 4000 
      });
      return;
    }
    
    const startTime = performance.now();
    setIsRunningThematicSwaps(true);
    setThematicSwapProgress({ current: 0, total: 100, phase: 'Preparing thematic ETF data...' });
    
    const rf = riskFreeRate;
    const pathsPerPair = 20000; // 20k QMC paths for speed
    
    // Get portfolio tickers and their data
    const portfolioTickers = positions.filter(p => p.ticker && p.quantity !== 0).map(p => p.ticker.toUpperCase());
    const n = portfolioTickers.length;
    
    if (n < 1) {
      setIsRunningThematicSwaps(false);
      showToast({ type: 'warning', title: 'No Positions', message: 'Add positions to analyze thematic swaps.' });
      return;
    }
    
    // Get thematic ETFs that have data in factorData
    const availableETFs = Object.keys(THEMATIC_ETFS).filter(etf => {
      const data = factorData[etf];
      return data?.returns?.length >= 50;
    });
    
    if (availableETFs.length === 0) {
      setIsRunningThematicSwaps(false);
      showToast({ type: 'warning', title: 'No ETF Data', message: 'Load factor data first (Run Factor Analysis or Load Data).' });
      return;
    }
    
    console.log(`📊 Thematic swap analysis: ${n} positions × ${availableETFs.length} ETFs = ${n * availableETFs.length} pairs`);
    
    // Compute ETF distribution parameters from historical returns
    const etfParams = {};
    for (const etf of availableETFs) {
      const returns = factorData[etf].returns;
      if (!returns || returns.length < 50) continue;
      
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
      const annualizedMu = mean * 252;
      const annualizedSigma = Math.sqrt(variance * 252);
      
      // Compute skew
      const stdDev = Math.sqrt(variance);
      const skewSum = returns.reduce((sum, r) => sum + Math.pow((r - mean) / stdDev, 3), 0);
      const skew = skewSum / returns.length;
      
      etfParams[etf] = {
        mu: annualizedMu,
        sigma: annualizedSigma,
        skew: Math.max(-2, Math.min(2, skew)),
        df: 8, // Default fat tail
        name: THEMATIC_ETFS[etf]?.name || etf,
        category: THEMATIC_ETFS[etf]?.category || 'thematic',
      };
    }
    
    // Compute correlations between ETFs and portfolio positions
    // Using unifiedMarketData for position returns
    const etfCorrelations = {}; // etfCorrelations[etf][positionTicker] = correlation
    
    for (const etf of availableETFs) {
      etfCorrelations[etf] = {};
      const etfReturns = factorData[etf].returns;
      
      for (const ticker of portfolioTickers) {
        const posData = unifiedMarketData[ticker];
        if (!posData?.dailyReturns) {
          etfCorrelations[etf][ticker] = 0.5; // Default moderate correlation
          continue;
        }
        
        const posReturns = posData.dailyReturns;
        const minLen = Math.min(etfReturns.length, posReturns.length);
        
        if (minLen < 30) {
          etfCorrelations[etf][ticker] = 0.5;
          continue;
        }
        
        // Align from end (most recent data)
        const etfSlice = etfReturns.slice(-minLen);
        const posSlice = posReturns.slice(-minLen);
        
        // Compute correlation
        const meanE = etfSlice.reduce((a, b) => a + b, 0) / minLen;
        const meanP = posSlice.reduce((a, b) => a + b, 0) / minLen;
        let cov = 0, varE = 0, varP = 0;
        for (let i = 0; i < minLen; i++) {
          const de = etfSlice[i] - meanE;
          const dp = posSlice[i] - meanP;
          cov += de * dp;
          varE += de * de;
          varP += dp * dp;
        }
        const corr = (varE > 0 && varP > 0) ? cov / Math.sqrt(varE * varP) : 0;
        etfCorrelations[etf][ticker] = Math.max(-0.99, Math.min(0.99, corr));
      }
    }
    
    await new Promise(r => setTimeout(r, 10));
    setThematicSwapProgress({ current: 5, total: 100, phase: 'Computing portfolio parameters...' });
    
    // Get portfolio distribution params
    const muArray = [];
    const sigmaArray = [];
    const skewArray = [];
    const dfArray = [];
    
    for (const ticker of portfolioTickers) {
      const pos = positions.find(p => p.ticker?.toUpperCase() === ticker);
      if (pos) {
        const params = getDistributionParams(pos);
        muArray.push(params.mu);
        sigmaArray.push(params.sigma);
        skewArray.push(params.skew || 0);
        dfArray.push(params.tailDf || 10);
      }
    }
    
    // Get portfolio weights (using gross exposure basis, normalized)
    const positionValues = portfolioTickers.map(ticker => {
      const pos = positions.find(p => p.ticker?.toUpperCase() === ticker);
      return pos ? Math.abs(pos.quantity * pos.price) : 0;
    });
    const grossValue = positionValues.reduce((a, b) => a + b, 0) || 1;
    const portfolioWeights = positionValues.map(v => v / grossValue);
    
    // Halton sequence for QMC
    const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73];
    const halton = (index, base) => {
      let f = 1, r = 0, i = index;
      while (i > 0) { f = f / base; r = r + f * (i % base); i = Math.floor(i / base); }
      return r;
    };
    const haltonPoint = (index, dimensions) => {
      const point = new Float64Array(dimensions);
      for (let d = 0; d < dimensions; d++) {
        point[d] = halton(index + 1 + d * 100, PRIMES[d % PRIMES.length]);
      }
      return point;
    };
    
    // Normal inverse CDF
    const normalCDFInv = (p) => {
      if (p <= 0) return -6; if (p >= 1) return 6; if (p === 0.5) return 0;
      const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
      const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
      const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
      const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
      const pLow = 0.02425, pHigh = 1 - pLow;
      let q, r;
      if (p < pLow) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
      if (p <= pHigh) { q = p - 0.5; r = q * q; return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
      q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    };
    
    // Chi-squared inverse CDF
    const chiSquaredInvCDF = (p, df) => {
      if (p <= 0) return 0.01; if (p >= 1) return df * 10;
      const z = normalCDFInv(p);
      const h = 2 / (9 * df);
      return Math.max(0.01, df * Math.pow(1 - h + z * Math.sqrt(h), 3));
    };
    
    // Cholesky decomposition helper
    const choleskyDecomp = (matrix) => {
      const size = matrix.length;
      const L = Array(size).fill(null).map(() => Array(size).fill(0));
      for (let i = 0; i < size; i++) {
        for (let j = 0; j <= i; j++) {
          let sum = 0;
          for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
          if (i === j) {
            L[i][j] = Math.sqrt(Math.max(0.0001, matrix[i][i] - sum));
          } else {
            L[i][j] = (matrix[i][j] - sum) / (L[j][j] || 1);
          }
        }
      }
      return L;
    };
    
    // Run Monte Carlo for a single swap scenario
    // extendedN = n portfolio positions + 1 ETF
    const runSwapMC = (sellIdx, etfTicker, qmcOffset) => {
      const etfP = etfParams[etfTicker];
      const extN = n + 1;
      const swapAmount = swapSize; // User-configurable swap size
      
      // Extended arrays: portfolio positions + 1 ETF
      const extMu = [...muArray, etfP.mu];
      const extSigma = [...sigmaArray, etfP.sigma];
      const extSkew = [...skewArray, etfP.skew];
      const extDf = [...dfArray, etfP.df];
      
      // Extended weights: sell 1% from position, buy 1% of ETF
      const extWeights = portfolioWeights.map((w, i) => i === sellIdx ? w - swapAmount : w);
      extWeights.push(swapAmount); // ETF weight
      
      // Build extended correlation matrix
      // editedCorrelation is a 2D array indexed by position order
      const extCorr = [];
      for (let i = 0; i < extN; i++) {
        extCorr[i] = [];
        for (let j = 0; j < extN; j++) {
          if (i === j) {
            extCorr[i][j] = 1;
          } else if (i < n && j < n) {
            // Portfolio-to-portfolio: use existing correlation matrix directly
            // editedCorrelation is indexed by position order (same as portfolioTickers)
            extCorr[i][j] = editedCorrelation?.[i]?.[j] ?? 0.3;
          } else if (i < n) {
            // Portfolio position to ETF
            extCorr[i][j] = etfCorrelations[etfTicker][portfolioTickers[i]] || 0.5;
          } else if (j < n) {
            // ETF to portfolio position
            extCorr[i][j] = etfCorrelations[etfTicker][portfolioTickers[j]] || 0.5;
          } else {
            // ETF to ETF (only one ETF, so this is diagonal = 1)
            extCorr[i][j] = 1;
          }
        }
      }
      
      // Cholesky decomposition
      const L = choleskyDecomp(extCorr);
      const flatL = new Float64Array(extN * extN);
      for (let i = 0; i < extN; i++) {
        for (let j = 0; j <= i; j++) flatL[i * extN + j] = L[i]?.[j] || 0;
      }
      
      const terminalReturns = new Float64Array(pathsPerPair);
      const avgDf = Math.min(...extDf.filter(d => d > 0 && d < 100)) || 8;
      
      const z = new Float64Array(extN);
      const correlatedZ = new Float64Array(extN);
      
      for (let path = 0; path < pathsPerPair; path++) {
        // QMC: Halton sequence
        const u = haltonPoint(qmcOffset + path, extN + 1);
        for (let i = 0; i < extN; i++) {
          z[i] = normalCDFInv(Math.max(0.0001, Math.min(0.9999, u[i])));
        }
        
        // Apply Cholesky correlation
        for (let i = 0; i < extN; i++) {
          let sum = 0;
          for (let j = 0; j <= i; j++) sum += flatL[i * extN + j] * z[j];
          correlatedZ[i] = sum || 0;
        }
        
        // Multivariate Student-t
        const chiSquared = chiSquaredInvCDF(Math.max(0.0001, Math.min(0.9999, u[extN])), avgDf);
        const scaleFactor = Math.sqrt(avgDf / chiSquared);
        const varianceCorrection = avgDf > 2 ? Math.sqrt((avgDf - 2) / avgDf) : 1;
        
        let portfolioReturn = 0;
        for (let i = 0; i < extN; i++) {
          let transformed = correlatedZ[i] * scaleFactor * varianceCorrection;
          const skew = extSkew[i] || 0;
          if (Math.abs(skew) > 0.01) {
            const delta = skew / Math.sqrt(1 + skew * skew);
            transformed = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed) - delta * Math.sqrt(2 / Math.PI);
          }
          transformed = Math.max(-8, Math.min(8, transformed));
          const assetReturn = extMu[i] + transformed * extSigma[i];
          portfolioReturn += extWeights[i] * Math.max(-1, Math.min(10, assetReturn));
        }
        
        terminalReturns[path] = isFinite(portfolioReturn) ? portfolioReturn : 0;
      }
      
      // Statistics - match Optimize tab methodology
      const valid = Array.from(terminalReturns).filter(v => isFinite(v));
      const sorted = [...valid].sort((a, b) => a - b);
      const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const stdDev = Math.sqrt(valid.reduce((sum, v) => sum + (v - mean) ** 2, 0) / valid.length);
      const sharpe = stdDev > 0 ? (mean - rf) / stdDev : 0;
      const pLoss = valid.filter(v => v < 0).length / valid.length;
      const var5 = sorted[Math.floor(sorted.length * 0.05)];
      const cvar5Vals = sorted.slice(0, Math.floor(sorted.length * 0.05));
      const cvar5 = cvar5Vals.length > 0 ? cvar5Vals.reduce((a, b) => a + b, 0) / cvar5Vals.length : var5;
      
      return { mean, median, stdDev, sharpe, pLoss, var5, cvar5 };
    };
    
    // Run baseline (current portfolio, no swap)
    setThematicSwapProgress({ current: 10, total: 100, phase: 'Running baseline Monte Carlo (20k QMC paths)...' });
    await new Promise(r => setTimeout(r, 10));
    
    // Baseline: just run with portfolio weights, no ETF
    // editedCorrelation is a 2D array indexed by position order
    const runBaselineMC = (qmcOffset) => {
      const L = choleskyDecomp(editedCorrelation);
      const flatL = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j <= i; j++) flatL[i * n + j] = L[i]?.[j] || 0;
      }
      
      const terminalReturns = new Float64Array(pathsPerPair);
      const avgDf = Math.min(...dfArray.filter(d => d > 0 && d < 100)) || 8;
      const z = new Float64Array(n);
      const correlatedZ = new Float64Array(n);
      
      for (let path = 0; path < pathsPerPair; path++) {
        const u = haltonPoint(qmcOffset + path, n + 1);
        for (let i = 0; i < n; i++) z[i] = normalCDFInv(Math.max(0.0001, Math.min(0.9999, u[i])));
        for (let i = 0; i < n; i++) {
          let sum = 0;
          for (let j = 0; j <= i; j++) sum += flatL[i * n + j] * z[j];
          correlatedZ[i] = sum || 0;
        }
        const chiSquared = chiSquaredInvCDF(Math.max(0.0001, Math.min(0.9999, u[n])), avgDf);
        const scaleFactor = Math.sqrt(avgDf / chiSquared);
        const varianceCorrection = avgDf > 2 ? Math.sqrt((avgDf - 2) / avgDf) : 1;
        
        let portfolioReturn = 0;
        for (let i = 0; i < n; i++) {
          let transformed = correlatedZ[i] * scaleFactor * varianceCorrection;
          const skew = skewArray[i] || 0;
          if (Math.abs(skew) > 0.01) {
            const delta = skew / Math.sqrt(1 + skew * skew);
            transformed = transformed * Math.sqrt(1 - delta * delta) + delta * Math.abs(transformed) - delta * Math.sqrt(2 / Math.PI);
          }
          transformed = Math.max(-8, Math.min(8, transformed));
          portfolioReturn += portfolioWeights[i] * Math.max(-1, Math.min(10, muArray[i] + transformed * sigmaArray[i]));
        }
        terminalReturns[path] = isFinite(portfolioReturn) ? portfolioReturn : 0;
      }
      
      const valid = Array.from(terminalReturns).filter(v => isFinite(v));
      const sorted = [...valid].sort((a, b) => a - b);
      const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const stdDev = Math.sqrt(valid.reduce((sum, v) => sum + (v - mean) ** 2, 0) / valid.length);
      const pLoss = valid.filter(v => v < 0).length / valid.length;
      const var5 = sorted[Math.floor(sorted.length * 0.05)];
      const cvar5Vals = sorted.slice(0, Math.floor(sorted.length * 0.05));
      const cvar5 = cvar5Vals.length > 0 ? cvar5Vals.reduce((a, b) => a + b, 0) / cvar5Vals.length : var5;
      return { mean, median, stdDev, sharpe: stdDev > 0 ? (mean - rf) / stdDev : 0, pLoss, var5, cvar5 };
    };
    
    const baseline = runBaselineMC(0);
    
    // Run for each (sell position, buy ETF) pair
    const totalPairs = n * availableETFs.length;
    const results = [];
    let pairIdx = 0;
    
    for (let sellIdx = 0; sellIdx < n; sellIdx++) {
      for (const etfTicker of availableETFs) {
        const progress = 15 + Math.round((pairIdx / totalPairs) * 80);
        if (pairIdx % 5 === 0) {
          setThematicSwapProgress({ 
            current: progress, 
            total: 100, 
            phase: `MC ${pairIdx + 1}/${totalPairs}: Sell ${portfolioTickers[sellIdx]} → Buy ${etfTicker}` 
          });
          await new Promise(r => setTimeout(r, 0)); // Allow UI update
        }
        
        const qmcOffset = (pairIdx + 1) * pathsPerPair;
        const mc = runSwapMC(sellIdx, etfTicker, qmcOffset);
        
        // Use same metric names as Optimize tab for consistency
        results.push({
          sellTicker: portfolioTickers[sellIdx],
          sellIdx,
          buyTicker: etfTicker,
          buyName: etfParams[etfTicker].name,
          buyCategory: etfParams[etfTicker].category,
          mc,
          deltaMetrics: {
            deltaMean: mc.mean - baseline.mean,
            deltaMedian: mc.median - baseline.median,
            deltaPLoss: mc.pLoss - baseline.pLoss,
            deltaVaR5: mc.var5 - baseline.var5,
            deltaCVaR5: mc.cvar5 - baseline.cvar5,
            deltaMCSharpe: mc.sharpe - baseline.sharpe,
          },
        });
        
        pairIdx++;
      }
    }
    
    // Sort by delta P(Loss) (lower is better, so ascending)
    results.sort((a, b) => a.deltaMetrics.deltaPLoss - b.deltaMetrics.deltaPLoss);
    
    // Aggregate by ETF (average delta when buying each ETF)
    const etfAggregates = {};
    for (const etf of availableETFs) {
      const etfResults = results.filter(r => r.buyTicker === etf);
      if (etfResults.length > 0) {
        etfAggregates[etf] = {
          ticker: etf,
          name: etfParams[etf].name,
          category: etfParams[etf].category,
          avgDeltaMCSharpe: etfResults.reduce((sum, r) => sum + r.deltaMetrics.deltaMCSharpe, 0) / etfResults.length,
          avgDeltaMean: etfResults.reduce((sum, r) => sum + r.deltaMetrics.deltaMean, 0) / etfResults.length,
          avgDeltaMedian: etfResults.reduce((sum, r) => sum + r.deltaMetrics.deltaMedian, 0) / etfResults.length,
          avgDeltaPLoss: etfResults.reduce((sum, r) => sum + r.deltaMetrics.deltaPLoss, 0) / etfResults.length,
          avgDeltaVaR5: etfResults.reduce((sum, r) => sum + r.deltaMetrics.deltaVaR5, 0) / etfResults.length,
          bestPair: etfResults.reduce((best, r) => r.deltaMetrics.deltaPLoss < best.deltaMetrics.deltaPLoss ? r : best, etfResults[0]),
        };
      }
    }
    
    // Sort ETF aggregates by avgDeltaPLoss (lower is better)
    const sortedETFAggregates = Object.values(etfAggregates).sort((a, b) => a.avgDeltaPLoss - b.avgDeltaPLoss);
    
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Thematic swap analysis complete in ${elapsed}s: ${totalPairs} pairs analyzed`);
    
    setThematicSwapResults({
      timestamp: Date.now(),
      computeTime: performance.now() - startTime,
      pathsPerPair,
      baseline,
      swaps: results,
      etfAggregates: sortedETFAggregates,
      portfolioTickers,
      availableETFs: availableETFs.map(etf => ({ ticker: etf, ...etfParams[etf] })),
    });
    
    setThematicSwapProgress({ current: 100, total: 100, phase: 'Complete!' });
    setIsRunningThematicSwaps(false);
    
    showToast({
      type: 'success',
      title: 'Thematic Analysis Complete',
      message: `Analyzed ${totalPairs} swap scenarios in ${elapsed}s`,
      duration: 4000,
    });
  }, [factorData, editedCorrelation, positions, unifiedMarketData, riskFreeRate, swapSize, getDistributionParams, showToast]);

  // ============================================
  // FULL LOAD - Master orchestration function
  // Runs all analysis steps in sequence
  // ============================================
  const runFullLoad = useCallback(async () => {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    
    if (tickers.length === 0) {
      showToast({ 
        type: 'warning', 
        title: 'No Positions', 
        message: 'Add positions before loading data.',
        duration: 3000 
      });
      return;
    }
    
    const startTime = performance.now();
    setIsFullLoading(true);
    
    const steps = [
      { name: 'Loading Market Data', icon: '📥' },
      { name: 'Computing Correlations', icon: '📊' },
      { name: 'Analyzing Lag Effects', icon: '🕐' },
      { name: 'Applying Lag Adjustments', icon: '🔧' },
      { name: 'Applying Correlation Floors', icon: '🏗️' },
      { name: 'Running Simulation', icon: '🎲' },
      { name: 'Running Factor Analysis', icon: '🧬' },
      { name: 'Running Optimization', icon: '🎯' },
      { name: 'Loading Consensus Data', icon: '📋' },
    ];
    
    try {
      // Step 1: Load all market data
      setFullLoadProgress({ step: 1, total: steps.length, phase: steps[0].name, detail: 'Fetching prices and returns...' });
      console.log(`\n${'='.repeat(50)}\n🚀 FULL LOAD: Step 1/${steps.length} - ${steps[0].name}\n${'='.repeat(50)}`);

      // Check if any position looks international but is missing currency info
      // This happens after login when positions come from Supabase without currency data
      const needsFreshFetch = positions.some(p => {
        if (!p.ticker) return false;
        const ticker = p.ticker.toUpperCase();
        // International ticker patterns: 6525.T, BESI.AS, VOD.L, etc.
        const looksInternational = /\.(T|HK|SS|SZ|TW|AS|PA|DE|L|MI|MC|SW|AX|TO|V)$/i.test(ticker) ||
                                   /^\d+\.(T|HK)$/.test(ticker);
        // Missing currency or marked as USD but looks international
        const missingCurrency = !p.currency || (p.currency === 'USD' && looksInternational);
        return looksInternational && missingCurrency;
      });

      if (needsFreshFetch) {
        console.log('🔄 Detected international tickers without currency info - forcing fresh fetch');
      }

      // Use smart caching unless positions need fresh FX data
      const loadedMarketData = await fetchUnifiedMarketData(needsFreshFetch);

      // Verify data was loaded
      const loadedTickers = Object.keys(loadedMarketData || {});
      if (loadedTickers.length === 0) {
        throw new Error('Failed to load market data');
      }
      console.log(`✅ Market data loaded for ${loadedTickers.length} tickers`);

      // Update position prices from the freshly loaded market data
      const priceUpdates = refreshPricesFromUnified(loadedMarketData);
      if (priceUpdates > 0) {
        console.log(`💰 Updated ${priceUpdates} position prices`);
        markTabContentUpdated('positions');
        // Trigger re-sort by value after price refresh
        setLastPriceRefresh(Date.now());
      }

      await new Promise(r => setTimeout(r, 300)); // Brief pause for UI
      
      // Step 2: Compute correlation matrix (pass market data directly to avoid stale closure)
      setFullLoadProgress({ step: 2, total: steps.length, phase: steps[1].name, detail: `Using ${historyTimeline} history${useEwma ? ' with EWMA' : ''}...` });
      console.log(`\n${'='.repeat(50)}\n📊 FULL LOAD: Step 2/${steps.length} - ${steps[1].name}\n${'='.repeat(50)}`);
      
      const computedCorrelation = await fetchAndComputeCorrelation(loadedMarketData);
      await new Promise(r => setTimeout(r, 300));
      
      // Step 3: Run lag analysis (pass market data directly)
      setFullLoadProgress({ step: 3, total: steps.length, phase: steps[2].name, detail: 'Testing timezone effects (-1, 0, +1 day lags)...' });
      console.log(`\n${'='.repeat(50)}\n🕐 FULL LOAD: Step 3/${steps.length} - ${steps[2].name}\n${'='.repeat(50)}`);
      
      const lagAnalysisResult = await runLagAnalysis(loadedMarketData);
      await new Promise(r => setTimeout(r, 300));
      
      // Step 4: Apply lag-adjusted correlations (if lag analysis found improvements)
      setFullLoadProgress({ step: 4, total: steps.length, phase: steps[3].name, detail: 'Applying timezone-adjusted correlations...' });
      console.log(`\n${'='.repeat(50)}\n🔧 FULL LOAD: Step 4/${steps.length} - ${steps[3].name}\n${'='.repeat(50)}`);
      
      // Use the returned lag analysis data directly to avoid async state race
      // Track the final correlation matrix (may be modified by lag adjustments and floors)
      let finalCorrelation = computedCorrelation;
      if (lagAnalysisResult?.matrix?.maxCorr) {
        const lagAdjusted = applyLagAdjustedCorrelations(lagAnalysisResult);
        if (lagAdjusted) {
          finalCorrelation = lagAdjusted;
        }
        setUseLagAdjusted(true);
        console.log(`Applied lag adjustments from ${lagAnalysisResult.significantCount || 0} significant pairs`);
      } else {
        console.log('No significant lag effects found');
      }
      await new Promise(r => setTimeout(r, 300));
      
      // Step 5: Apply correlation floors (if correlation groups are defined)
      setFullLoadProgress({ step: 5, total: steps.length, phase: steps[4].name, detail: 'Loading position classifications...' });
      console.log(`\n${'='.repeat(50)}\n🏗️ FULL LOAD: Step 5/${steps.length} - ${steps[4].name}\n${'='.repeat(50)}`);

      // Auto-detect correlation groups from cached position metadata
      // This ensures that previously classified positions are used even if groups weren't explicitly set
      let groupsToUse = correlationGroups;
      const hasExistingGroups = correlationGroups && Object.values(correlationGroups).some(arr => arr.length > 0);

      if (!hasExistingGroups && positionMetadata && Object.keys(positionMetadata).length > 0) {
        console.log('[LoadAll] Found cached position metadata, auto-detecting correlation groups...');
        setFullLoadProgress({ step: 5, total: steps.length, phase: steps[4].name, detail: 'Auto-detecting sector/industry groups...' });
        // detectCorrelationGroups returns the groups AND updates state
        const detectedGroups = detectCorrelationGroups(positionMetadata);
        if (detectedGroups && Object.keys(detectedGroups).length > 0) {
          groupsToUse = detectedGroups;
          console.log(`[LoadAll] Auto-detected ${Object.keys(detectedGroups).length} correlation groups from cached metadata:`, Object.keys(detectedGroups));
        }
      }

      setFullLoadProgress({ step: 5, total: steps.length, phase: steps[4].name, detail: 'Enforcing group correlation minimums...' });

      // Apply correlation floors using the groups (either existing or newly detected)
      if (groupsToUse && Object.values(groupsToUse).some(arr => arr.length > 0)) {
        // Pass groupsToUse directly to avoid closure issues with state
        const { adjustments, matrix } = applyCorrelationFloors(0.55, groupsToUse);
        if (matrix) {
          finalCorrelation = matrix;
        }
        console.log(`Applied ${adjustments?.length || 0} correlation floor adjustments`);
      } else {
        console.log('No correlation groups defined (no cached metadata), skipping floor adjustments');
      }
      markTabContentUpdated('correlation');
      await new Promise(r => setTimeout(r, 300));

      // Step 6: Run simulation (pass the final correlation matrix directly)
      setFullLoadProgress({ step: 6, total: steps.length, phase: steps[5].name, detail: `${numPaths.toLocaleString()} paths${useQmc ? ' (QMC)' : ''}...` });
      console.log(`\n${'='.repeat(50)}\n🎲 FULL LOAD: Step 6/${steps.length} - ${steps[5].name}\n${'='.repeat(50)}`);
      
      await runSimulation(finalCorrelation);
      markTabContentUpdated('simulation');
      await new Promise(r => setTimeout(r, 300));

      // Step 7: Run factor analysis (fetchFactorData fetches ETF data AND runs analysis)
      setFullLoadProgress({ step: 7, total: steps.length, phase: steps[6].name, detail: 'Fetching factor ETFs and computing exposures...' });
      console.log(`\n${'='.repeat(50)}\n🧬 FULL LOAD: Step 7/${steps.length} - ${steps[6].name}\n${'='.repeat(50)}`);
      
      await fetchFactorData(loadedMarketData);
      markTabContentUpdated('factors');
      await new Promise(r => setTimeout(r, 300));

      // Step 8: Run optimization (pass the final correlation matrix directly to avoid state timing issues)
      setFullLoadProgress({ step: 8, total: steps.length, phase: steps[7].name, detail: 'Analyzing swap opportunities...' });
      console.log(`\n${'='.repeat(50)}\n🎯 FULL LOAD: Step 8/${steps.length} - ${steps[7].name}\n${'='.repeat(50)}`);

      await runPortfolioOptimization(finalCorrelation);
      markTabContentUpdated('optimize');
      await new Promise(r => setTimeout(r, 300));

      // Step 9: Load consensus data from FMP API
      setFullLoadProgress({ step: 9, total: steps.length, phase: steps[8].name, detail: 'Fetching analyst estimates...' });
      console.log(`\n${'='.repeat(50)}\n📋 FULL LOAD: Step 9/${steps.length} - ${steps[8].name}\n${'='.repeat(50)}`);

      const fmpApiKey = getFmpApiKey();
      if (fmpApiKey) {
        try {
          const consensusData = await batchFetchConsensusData(tickers, fmpApiKey, (current, total, ticker) => {
            setFullLoadProgress({
              step: 9,
              total: steps.length,
              phase: steps[8].name,
              detail: `${current}/${total} tickers loaded...`
            });
          });

          // Save to localStorage with the same keys ConsensusTab uses
          if (consensusData && Object.keys(consensusData).length > 0) {
            localStorage.setItem('monte-carlo-consensus-data', JSON.stringify(consensusData));
            localStorage.setItem('monte-carlo-consensus-timestamp', Date.now().toString());
            console.log(`✅ Consensus data loaded for ${Object.keys(consensusData).length} tickers`);
            markTabContentUpdated('consensus');
          }
        } catch (consensusError) {
          console.warn('Consensus data fetch failed (non-critical):', consensusError.message);
        }
      } else {
        console.log('No FMP API key configured, skipping consensus data');
      }

      // Complete!
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      setFullLoadProgress({ step: steps.length, total: steps.length, phase: 'Complete!', detail: `All steps finished in ${elapsed}s` });
      console.log(`\n${'='.repeat(50)}\n✅ FULL LOAD COMPLETE in ${elapsed}s\n${'='.repeat(50)}\n`);
      
      showToast({
        type: 'success',
        title: 'Full Load Complete',
        message: `All analysis steps completed in ${elapsed}s`,
        duration: 5000,
      });
      
      // Brief pause to show completion
      await new Promise(r => setTimeout(r, 1500));
      
    } catch (error) {
      console.error('❌ Full load error:', error);
      showToast({
        type: 'error',
        title: 'Load Error',
        message: error.message || 'An error occurred during full load',
        duration: 5000,
      });
    } finally {
      setIsFullLoading(false);
      setFullLoadProgress({ step: 0, total: 0, phase: '', detail: '' });
    }
  // Note: We intentionally exclude function references that aren't memoized with useCallback
  // to avoid recreating this callback on every render. The functions are stable within the component.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, historyTimeline, useEwma, numPaths, useQmc, correlationGroups, showToast]);
  
  // Update ref so keyboard handler can access the latest version
  runFullLoadRef.current = runFullLoad;
  
  // Generate histogram data for terminal values
  const generateHistogramData = (values, bins = 50) => {
    if (!values || values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const binWidth = (max - min) / bins;
    const histogram = Array(bins).fill(0);
    
    values.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[idx]++;
    });
    
    return histogram.map((count, i) => ({
      value: min + (i + 0.5) * binWidth,
      count: count,
      return: ((min + (i + 0.5) * binWidth - 1) * 100).toFixed(1) + '%',
    }));
  };
  
  // Generate histogram data for returns (values are already percentages like 0.12 for 12%)
  const generateReturnHistogramData = useCallback((returns, bins = 50) => {
    if (!returns || returns.length === 0) return [];
    const min = Math.min(...returns);
    const max = Math.max(...returns);
    const binWidth = (max - min) / bins;
    const histogram = Array(bins).fill(0);
    const total = returns.length;
    
    returns.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[idx]++;
    });
    
    return histogram.map((count, i) => {
      const returnVal = min + (i + 0.5) * binWidth;
      const pct = (count / total) * 100; // Percentage of total runs
      return {
        value: returnVal,
        count: count,
        pct: pct,
        label: `${returnVal >= 0 ? '+' : ''}${(returnVal * 100).toFixed(0)}%`,
      };
    });
  }, []);
  
  // Generate histogram data for dollar values
  const generateDollarHistogramData = useCallback((dollars, bins = 40) => {
    if (!dollars || dollars.length === 0) return [];
    const min = Math.min(...dollars);
    const max = Math.max(...dollars);
    const binWidth = (max - min) / bins;
    const histogram = Array(bins).fill(0);
    const total = dollars.length;
    
    dollars.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[idx]++;
    });
    
    // Format dollar amounts nicely
    const formatDollars = (val) => {
      if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
      if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
      if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
      return `$${val.toFixed(0)}`;
    };
    
    return histogram.map((count, i) => {
      const dollarVal = min + (i + 0.5) * binWidth;
      const pct = (count / total) * 100;
      return {
        value: dollarVal,
        count: count,
        pct: pct,
        label: formatDollars(dollarVal),
      };
    });
  }, []);
  
  // Memoized histogram data to avoid recalculation on every render
  const returnHistogramData = useMemo(() => {
    if (!simulationResults?.terminal?.distribution) return [];
    return generateReturnHistogramData(simulationResults.terminal.distribution, 40);
  }, [simulationResults?.terminal?.distribution, generateReturnHistogramData]);
  
  const drawdownHistogramData = useMemo(() => {
    if (!simulationResults?.drawdown?.distribution) return [];
    return generateReturnHistogramData(simulationResults.drawdown.distribution.map(d => -d), 30);
  }, [simulationResults?.drawdown?.distribution, generateReturnHistogramData]);
  
  const dollarHistogramData = useMemo(() => {
    if (!simulationResults?.terminalDollars?.distribution) return [];
    return generateDollarHistogramData(simulationResults.terminalDollars.distribution, 40);
  }, [simulationResults?.terminalDollars?.distribution, generateDollarHistogramData]);
  
  // Format currency for display
  const formatCurrency = (val) => {
    if (!isFinite(val)) return '$--';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (absVal >= 1e9) return `${sign}$${(absVal / 1e9).toFixed(2)}B`;
    if (absVal >= 1e6) return `${sign}$${(absVal / 1e6).toFixed(2)}M`;
    if (absVal >= 1e3) return `${sign}$${(absVal / 1e3).toFixed(0)}K`;
    return `${sign}$${absVal.toFixed(0)}`;
  };
  
  // Generate PDF curve data for distribution preview with actual return values
  const generateDistributionPreview = (skew, tailDf, mu, sigma, points = 80, p5Val = null, p25Val = null, p50Val = null, p75Val = null, p95Val = null) => {
    const data = [];
    
    // Calculate the range to cover - must include all percentiles
    let minReturn = mu - 3.5 * sigma;
    let maxReturn = mu + 3.5 * sigma;
    
    // Extend range to include all percentiles if provided
    if (p5Val !== null) minReturn = Math.min(minReturn, p5Val - 0.05);
    if (p95Val !== null) maxReturn = Math.max(maxReturn, p95Val + 0.05);
    
    // Add padding
    const padding = (maxReturn - minReturn) * 0.05;
    minReturn -= padding;
    maxReturn += padding;
    
    const returnRange = maxReturn - minReturn;
    
    // Generate points across the full range
    for (let i = 0; i < points; i++) {
      const returnVal = minReturn + (returnRange * i / (points - 1));
      const returnPct = returnVal * 100; // Convert to percentage for display
      const zScore = sigma > 0 ? (returnVal - mu) / sigma : 0;
      
      // Base normal PDF
      let pdf = Math.exp(-0.5 * zScore * zScore) / Math.sqrt(2 * Math.PI);
      
      // Apply skew effect (approximate skew-normal)
      // Positive skew = right tail heavier, negative skew = left tail heavier
      const skewFactor = 1 + skew * zScore * 0.4;
      pdf *= Math.max(0.05, skewFactor);
      
      // Apply fat tail effect (heavier tails for lower df)
      // Student-t has fatter tails than normal
      if (tailDf < 30) {
        const tailBoost = 1 + (30 - tailDf) / 25 * Math.pow(Math.abs(zScore) / 2, 2) * 0.4;
        pdf *= tailBoost;
      }
      
      data.push({ 
        zScore,
        returnPct, 
        pdf,
      });
    }
    
    // Normalize to get probability (area under curve sums to ~1)
    const total = data.reduce((sum, d) => sum + d.pdf, 0);
    
    return data.map(d => ({ 
      returnPct: d.returnPct, 
      probability: d.pdf / total, // Normalized probability
    }));
  };
  
  // Color scale for correlation heatmap
  // Designed to highlight diversification value:
  // - High positive (0.7-1.0): Red - concentration risk
  // - Medium positive (0.3-0.7): Yellow/Amber - moderate correlation
  // - Low positive (0.1-0.3): Light cyan - good diversification
  // - Near zero (-0.1 to 0.1): BRIGHT WHITE/GOLD - excellent diversification ★
  // - Low negative (-0.3 to -0.1): Light blue - mild hedge
  // - Strong negative (-1 to -0.3): Purple - strong hedge
  const getCorrelationColor = (value) => {
    const v = Math.max(-1, Math.min(1, value));
    
    // Simple continuous gradient: Purple → Blue → Green (zero) → Yellow → Orange → Red
    if (v >= 0.7) {
      // High positive: Red (concentration risk)
      const intensity = (v - 0.7) / 0.3;
      return `rgba(220, 53, 69, ${0.55 + intensity * 0.35})`;
    } else if (v >= 0.5) {
      // Medium-high positive: Orange
      const intensity = (v - 0.5) / 0.2;
      return `rgba(253, 126, 20, ${0.45 + intensity * 0.2})`;
    } else if (v >= 0.3) {
      // Medium positive: Yellow
      const intensity = (v - 0.3) / 0.2;
      return `rgba(255, 193, 7, ${0.4 + intensity * 0.15})`;
    } else if (v >= 0.1) {
      // Low positive: Yellow-green
      const intensity = (v - 0.1) / 0.2;
      return `rgba(180, 200, 50, ${0.35 + intensity * 0.15})`;
    } else if (v >= -0.1) {
      // NEAR ZERO: Green (excellent diversification!)
      const distFromZero = Math.abs(v) / 0.1;
      return `rgba(40, 167, 69, ${0.55 - distFromZero * 0.15})`;
    } else if (v >= -0.3) {
      // Low negative: Blue-green / Teal
      const intensity = (Math.abs(v) - 0.1) / 0.2;
      return `rgba(23, 162, 184, ${0.4 + intensity * 0.15})`;
    } else if (v >= -0.5) {
      // Medium negative: Blue
      const intensity = (Math.abs(v) - 0.3) / 0.2;
      return `rgba(52, 152, 219, ${0.45 + intensity * 0.15})`;
    } else {
      // Strong negative: Purple (strong hedge)
      const intensity = (Math.abs(v) - 0.5) / 0.5;
      return `rgba(111, 66, 193, ${0.5 + intensity * 0.35})`;
    }
  };

  // ============================================
  // COMMAND PALETTE EXECUTION (defined after all dependencies)
  // ============================================
  const executeCommand = useCallback((command) => {
    switch (command.action) {
      // Navigation
      case 'navigate':
        setActiveTab(command.payload);
        showToast({ type: 'info', message: `Switched to ${command.payload} tab`, duration: 1500 });
        break;

      // Actions
      case 'runSimulation':
        if (editedCorrelation && !isSimulating) {
          runSimulation();
        } else if (!editedCorrelation) {
          showToast({ type: 'warning', message: 'Please compute correlation first', duration: 3000 });
        }
        break;

      case 'loadAllData':
        if (!isFetchingUnified && !isFullLoading && runFullLoadRef.current) {
          runFullLoadRef.current();
        }
        break;

      case 'addPosition':
        setShowAddPositionsModal(true);
        break;

      case 'estimateDistributions':
        setActiveTab('distributions');
        showToast({ type: 'info', message: 'Go to Distributions tab to estimate', duration: 2000 });
        break;

      case 'computeCorrelation':
        setActiveTab('correlation');
        showToast({ type: 'info', message: 'Go to Correlation tab to compute', duration: 2000 });
        break;

      case 'runOptimization':
        setActiveTab('optimize');
        showToast({ type: 'info', message: 'Go to Optimize tab to run optimization', duration: 2000 });
        break;

      // Export
      case 'exportJson':
        exportPortfolio();
        break;

      case 'exportPdf':
        setActiveTab('export');
        showToast({ type: 'info', message: 'Navigate to Export tab to generate PDF', duration: 2000 });
        break;

      // Settings
      case 'toggleQmc':
        setUseQmc(prev => !prev);
        showToast({ type: 'info', message: `Quasi-MC toggled`, duration: 2000 });
        break;

      case 'toggleEwma':
        setUseEwma(prev => !prev);
        showToast({ type: 'info', message: `EWMA toggled`, duration: 2000 });
        break;

      case 'setFatTail':
        setFatTailMethod(command.payload);
        showToast({ type: 'info', message: `Fat tail method: ${command.payload === 'multivariateTStudent' ? 'Student-t' : 'Copula'}`, duration: 2000 });
        break;

      // Help
      case 'showShortcuts':
        setShowKeyboardShortcuts(true);
        break;

      case 'showGuide':
        setShowUserGuide(true);
        break;

      default:
        console.warn('Unknown command action:', command.action);
    }
  }, [editedCorrelation, isSimulating, isFetchingUnified, isFullLoading, showToast, runSimulation, exportPortfolio]);

  // Update ref for use in keyboard handler
  executeCommandRef.current = executeCommand;


  // Toggle sidebar with localStorage persistence
  const toggleSidebar = useCallback(() => {
    setSidebarExpanded(prev => {
      const newValue = !prev;
      localStorage.setItem('sidebar-expanded', JSON.stringify(newValue));
      return newValue;
    });
  }, []);

  return (
    <div style={styles.appRoot}>
      {/* Sidebar Navigation */}
      <Sidebar
        isExpanded={sidebarExpanded}
        onToggle={toggleSidebar}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        portfolioValue={portfolioValue}
        autosaveStatus={autosaveStatus}
        AutosaveIndicator={AutosaveIndicator}
        onLoadAll={runFullLoad}
        onExport={exportPortfolio}
        onImport={importPortfolio}
        onReset={() => {
          setConfirmDialog({
            title: 'Reset All Data?',
            message: 'This will clear all settings, positions, and results.',
            confirmLabel: 'Reset',
            confirmVariant: 'danger',
            onConfirm: () => {
              localStorage.removeItem(STORAGE_KEY);
              localStorage.removeItem(UNIFIED_CACHE_KEY);
              localStorage.removeItem(FACTOR_CACHE_KEY);
              localStorage.removeItem('monte-carlo-factor-etf-prices-v1'); // Persistent factor cache
              localStorage.removeItem('monte-carlo-position-prices-v1'); // Persistent position cache
              window.location.reload();
            },
          });
        }}
        isLoading={isFetchingUnified || isFullLoading}
        loadProgress={fullLoadProgress}
        marketDataProgress={unifiedFetchProgress}
        tabStatus={{
          positions: {
            hasNewContent: tabContentUpdatedAt.positions > tabVisitedAt.positions,
            isProcessing: isFetchingUnified || isFetchingBetas,
          },
          consensus: {
            hasNewContent: tabContentUpdatedAt.consensus > tabVisitedAt.consensus,
            isProcessing: false, // Consensus loads with full load, tracked separately
          },
          distributions: {
            hasNewContent: tabContentUpdatedAt.distributions > tabVisitedAt.distributions,
            isProcessing: isFetchingYearReturns,
          },
          correlation: {
            hasNewContent: tabContentUpdatedAt.correlation > tabVisitedAt.correlation,
            isProcessing: isFetchingData || isAnalyzingLag,
          },
          factors: {
            hasNewContent: tabContentUpdatedAt.factors > tabVisitedAt.factors,
            isProcessing: isFetchingFactors,
          },
          simulation: {
            hasNewContent: tabContentUpdatedAt.simulation > tabVisitedAt.simulation,
            isProcessing: isSimulating,
          },
          optimize: {
            hasNewContent: tabContentUpdatedAt.optimize > tabVisitedAt.optimize,
            isProcessing: isOptimizing,
          },
          export: {
            hasNewContent: false,
            isProcessing: false,
          },
        }}
        UserMenu={UserMenu}
        syncState={syncState}
      />

      {/* Main Content Area */}
      <div style={styles.mainContent}>
      {/* Global styles for professional UI polish */}
      <style>{`
        /* ===== NUMBER INPUT SPINNERS ===== */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
        
        /* ===== FOCUS STATES ===== */
        *:focus {
          outline: none;
        }
        *:focus-visible {
          outline: 2px solid #00d4ff;
          outline-offset: 2px;
        }
        button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px #0a0a0f, 0 0 0 4px #00d4ff;
        }
        /* Tab buttons should NOT show focus ring - they have their own active state */
        [data-tab-button]:focus,
        [data-tab-button]:focus-visible {
          outline: none !important;
          box-shadow: none !important;
        }
        [data-tab-button][data-active="true"]:focus,
        [data-tab-button][data-active="true"]:focus-visible {
          box-shadow: 0 4px 16px rgba(0,212,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 3px rgba(0, 0, 0, 0.3) !important;
        }
        input:focus-visible, select:focus-visible, textarea:focus-visible {
          border-color: #00d4ff !important;
          box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.2) !important;
        }
        
        /* ===== HOVER STATES ===== */
        button:hover:not(:disabled) {
          filter: brightness(1.1);
        }
        [data-tab-button]:hover:not(:disabled) {
          filter: none;
          background: rgba(255, 255, 255, 0.05);
        }
        [data-tab-button][data-active="true"]:hover:not(:disabled) {
          filter: none;
          background: linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(123, 47, 247, 0.2) 100%);
        }
        tr:hover td {
          background: rgba(0, 212, 255, 0.03);
        }
        
        /* ===== TRANSITIONS ===== */
        button, input, select, textarea {
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, opacity 0.2s ease;
        }
        [data-tab-button] {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        
        /* ===== CARD HOVER ===== */
        [data-card]:hover {
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }
        
        /* ===== BUTTON PRESS ===== */
        button:active:not(:disabled) {
          transform: scale(0.98);
        }
        [data-tab-button]:active:not(:disabled) {
          transform: scale(0.97) translateY(0px);
        }
        
        /* ===== SCROLLBAR ===== */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #1a1a2e;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: #3a3a5a;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #4a4a6a;
        }
        
        /* Firefox scrollbar */
        * {
          scrollbar-width: thin;
          scrollbar-color: #3a3a5a #1a1a2e;
        }
        
        /* ===== SELECTION ===== */
        ::selection {
          background: rgba(0, 212, 255, 0.3);
          color: #fff;
        }
        
        /* ===== SCREEN READER ONLY ===== */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        
        /* ===== DISABLED STATE ===== */
        button:disabled, input:disabled, select:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* ===== TOOLTIP ANIMATION ===== */
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* ===== LOADING SHIMMER ===== */
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        /* ===== PULSE ANIMATION ===== */
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.95); }
        }
        
        /* ===== SPIN ANIMATION ===== */
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* First-time user welcome banner */}
      {showWelcome && positions.length <= 3 && (
        <div style={{
          marginBottom: '20px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.08) 100%)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '10px',
          position: 'relative',
        }}>
          <button 
            onClick={dismissWelcome}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px',
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', color: '#fff' }}>👋 Welcome!</span>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#888' }}>
              <span><span style={{ color: '#00d4ff' }}>1</span> Add positions</span>
              <span><span style={{ color: '#00d4ff' }}>2</span> Click "🚀 Load All" (runs everything!)</span>
            </div>
            <button
              onClick={dismissWelcome}
              style={{
                background: 'rgba(0, 212, 255, 0.15)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                borderRadius: '4px',
                padding: '4px 10px',
                color: '#00d4ff',
                fontSize: '10px',
                cursor: 'pointer',
                marginLeft: 'auto',
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
      
      {/* Tab Content with fade transition */}
      <div 
        key={activeTab}
        style={{
          animation: 'tabFadeIn 0.2s ease-out',
        }}
      >
        {activeTab === 'positions' && (
          <PositionsTab
            // Position data
            positions={positions}
            positionMetadata={positionMetadata}
            positionBetas={positionBetas}
            
            // Filtering/sorting state
            positionSearch={positionSearch}
            setPositionSearch={setPositionSearch}
            positionFilter={positionFilter}
            setPositionFilter={setPositionFilter}
            positionSort={positionSort}
            setPositionSort={setPositionSort}
            lastPriceRefresh={lastPriceRefresh}
            
            // Portfolio values
            portfolioValue={portfolioValue}
            grossPositionsValue={grossPositionsValue}
            cashBalance={cashBalance}
            setCashBalance={setCashBalance}
            cashRate={cashRate}
            setCashRate={setCashRate}
            cashWeight={cashWeight}
            
            // Loading states
            isFetchingData={isFetchingData}
            isFetchingBetas={isFetchingBetas}
            isFetchingUnified={isFetchingUnified}
            
            // Actions
            addPosition={addPosition}
            removePosition={removePosition}
            updatePosition={updatePosition}
            calculateAllBetas={calculateAllBetas}
            refreshAllPrices={refreshAllPrices}
            setConfirmDialog={setConfirmDialog}
            
            // Add positions modal
            onOpenAddModal={() => setShowAddPositionsModal(true)}
            onOpenScreenshotImport={() => setShowScreenshotImportModal(true)}

            // Styles
            styles={styles}
          />
        )}
        {activeTab === 'consensus' && (
          <ConsensusTab
            positions={positions}
            styles={styles}
          />
        )}
        {activeTab === 'distributions' && (
          <DistributionsTab
            positions={positions}
            portfolioValue={portfolioValue}
            updatePosition={updatePosition}
            getDistributionParams={getDistributionParams}
            estimateDistributionFromHistory={estimateDistributionFromHistory}
            estimateAllDistributions={estimateAllDistributions}
            fetchCalendarYearReturns={fetchCalendarYearReturns}
            calendarYearReturns={calendarYearReturns}
            generateDistributionPreview={generateDistributionPreview}
            isFetchingData={isFetchingData}
            isFetchingYearReturns={isFetchingYearReturns}
            styles={styles}
          />
        )}
        {activeTab === 'correlation' && (
          <CorrelationTab
            // Core data
            positions={positions}
            historicalData={historicalData}
            unifiedMarketData={unifiedMarketData}
            
            // Correlation state
            correlationMatrix={correlationMatrix}
            editedCorrelation={editedCorrelation}
            correlationMethod={correlationMethod}
            setCorrelationMethod={setCorrelationMethod}
            useEwma={useEwma}
            setUseEwma={setUseEwma}
            gldAsCash={gldAsCash}
            setGldAsCash={setGldAsCash}
            
            // Timeline
            historyTimeline={historyTimeline}
            setHistoryTimeline={setHistoryTimeline}
            
            // Data source info
            dataSource={dataSource}
            fetchErrors={fetchErrors}
            isFetchingData={isFetchingData}
            
            // Correlation groups
            correlationGroups={correlationGroups}
            setCorrelationGroups={setCorrelationGroups}
            positionMetadata={positionMetadata}
            isFetchingMetadata={isFetchingMetadata}
            
            // Lag analysis
            lagAnalysis={lagAnalysis}
            setLagAnalysis={setLagAnalysis}
            isAnalyzingLag={isAnalyzingLag}
            useLagAdjusted={useLagAdjusted}
            setUseLagAdjusted={setUseLagAdjusted}
            
            // View mode
            matrixViewMode={matrixViewMode}
            setMatrixViewMode={setMatrixViewMode}
            
            // Callbacks
            fetchAndComputeCorrelation={fetchAndComputeCorrelation}
            updateCorrelationCell={updateCorrelationCell}
            applyEdits={applyEdits}
            resetCorrelation={resetCorrelation}
            runLagAnalysis={runLagAnalysis}
            applyLagAdjustedCorrelations={applyLagAdjustedCorrelations}
            fetchAllMetadata={fetchAllMetadata}
            applyCorrelationFloors={applyCorrelationFloors}
            getDistributionParams={getDistributionParams}
            getCorrelationColor={getCorrelationColor}
            showToast={showToast}
            
            // Styles
            styles={styles}
          />
        )}
        {activeTab === 'simulation' && (
          <SimulationTab
            // Simulation parameters
            numPaths={numPaths}
            setNumPaths={setNumPaths}
            drawdownThreshold={drawdownThreshold}
            setDrawdownThreshold={setDrawdownThreshold}
            fatTailMethod={fatTailMethod}
            setFatTailMethod={setFatTailMethod}
            useQmc={useQmc}
            setUseQmc={setUseQmc}
            
            // Correlation data
            editedCorrelation={editedCorrelation}
            correlationMethod={correlationMethod}
            useEwma={useEwma}
            
            // Simulation state
            simulationResults={simulationResults}
            previousSimulationResults={previousSimulationResults}
            isSimulating={isSimulating}
            
            // Portfolio data
            positions={positions}
            
            // Methodology explainer
            showMethodologyExplainer={showMethodologyExplainer}
            setShowMethodologyExplainer={setShowMethodologyExplainer}
            
            // Contribution chart
            contributionChartMemo={contributionChartMemo}
            
            // Callbacks
            runSimulation={runSimulation}
            
            // Common components
            BlurInput={BlurInput}
            InfoTooltip={InfoTooltip}
            
            // Styles
            styles={styles}
          />
        )}
        {activeTab === 'factors' && (
          <FactorsTab
            positions={positions}
            factorData={factorData}
            unifiedMarketData={unifiedMarketData}
            useEwma={useEwma}
            isFetchingFactors={isFetchingFactors}
            setIsFetchingFactors={setIsFetchingFactors}
            runFactorAnalysis={runFactorAnalysis}
            factorAnalysis={factorAnalysis}
            historyTimeline={historyTimeline}
            thematicOverrides={thematicOverrides}
            setThematicOverrides={setThematicOverrides}
            // Thematic swap analysis
            thematicSwapResults={thematicSwapResults}
            thematicSwapProgress={thematicSwapProgress}
            isRunningThematicSwaps={isRunningThematicSwaps}
            runThematicSwapAnalysis={runThematicSwapAnalysis}
            styles={styles}
          />
        )}
        {activeTab === 'optimize' && (
          <OptimizeTab
            positions={positions}
            editedCorrelation={editedCorrelation}
            correlationGroups={correlationGroups}
            optimizationResults={optimizationResults}
            optimizationProgress={optimizationProgress}
            analyticalSwapMatrix={analyticalSwapMatrix}
            riskFreeRate={riskFreeRate}
            setRiskFreeRate={setRiskFreeRate}
            swapSize={swapSize}
            setSwapSize={setSwapSize}
            optimizationPaths={optimizationPaths}
            setOptimizationPaths={setOptimizationPaths}
            useQmc={useQmc}
            setUseQmc={setUseQmc}
            isOptimizing={isOptimizing}
            runPortfolioOptimization={runPortfolioOptimization}
            setOptimizationResults={setOptimizationResults}
            styles={styles}
          />
        )}
        {activeTab === 'export' && (
          <ExportTab
            positions={positions}
            portfolioValue={portfolioValue}
            numPaths={numPaths}
            correlationMethod={correlationMethod}
            useEwma={useEwma}
            gldAsCash={gldAsCash}
            fatTailMethod={fatTailMethod}
            useQmc={useQmc}
            editedCorrelation={editedCorrelation}
            simulationResults={simulationResults}
            getDistributionParams={getDistributionParams}
            showToast={showToast}
            styles={styles}
            // Additional props for enhanced PDF export
            factorAnalysis={factorAnalysis}
            optimizationResults={optimizationResults}
            positionMetadata={positionMetadata}
            positionBetas={positionBetas}
            contributionChartMemo={contributionChartMemo}
            analyticalSwapMatrix={analyticalSwapMatrix}
          />
        )}
      </div>
      
      {/* Tab fade-in animation */}
      <style>{`
        @keyframes tabFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      <div style={{ 
        marginTop: '40px', 
        padding: '16px', 
        borderTop: '1px solid #2a2a4a',
        fontSize: '11px',
        color: '#666',
        textAlign: 'center',
      }}>
        Monte Carlo Simulator v6.3 • Professional Edition
        <br />
        <span style={{ color: '#888' }}>
          Multi-core simulation • Parallel API fetching • 
          <button 
            onClick={() => setShowUserGuide(true)}
            style={{ 
              background: 'none',
              border: 'none',
              color: '#00d4ff',
              cursor: 'pointer',
              padding: 0,
              fontSize: '11px',
              fontFamily: 'inherit',
              marginRight: '4px',
            }}
          >
            <span style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              <span style={{
                background: 'rgba(0, 212, 255, 0.15)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                border: '1px solid rgba(0, 212, 255, 0.3)',
              }}>📖 Guide</span>
            </span>
          </button>
          •
          <button 
            onClick={() => setShowKeyboardShortcuts(true)}
            style={{ 
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: 0,
              fontSize: '11px',
              fontFamily: 'inherit',
              marginLeft: '4px',
            }}
          >
            Press <kbd style={{ 
              background: '#2a2a4a', 
              padding: '2px 6px', 
              borderRadius: '3px', 
              fontSize: '10px',
              border: '1px solid #3a3a6a',
              cursor: 'pointer',
            }}>?</kbd> for keyboard shortcuts
          </button>
        </span>
      </div>
      </div>{/* End Main Content */}
      
      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          confirmVariant={confirmDialog.confirmVariant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      
      {/* Command Palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onExecuteCommand={executeCommand}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcuts
        isOpen={showKeyboardShortcuts}
        onClose={() => setShowKeyboardShortcuts(false)}
      />
      
      {/* User Guide Modal */}
      <UserGuide 
        isOpen={showUserGuide} 
        onClose={() => setShowUserGuide(false)} 
      />
      
      {/* Add Positions Modal */}
      <AddPositionsModal
        isOpen={showAddPositionsModal}
        onClose={() => setShowAddPositionsModal(false)}
        onAddPositions={addPositionsBatch}
        existingTickers={positions.map(p => p.ticker?.toUpperCase()).filter(Boolean)}
        fetchPriceForTicker={fetchPriceForTicker}
      />

      {/* Screenshot Import Modal */}
      <ScreenshotImportModal
        isOpen={showScreenshotImportModal}
        onClose={() => setShowScreenshotImportModal(false)}
        onImportPositions={addPositionsBatch}
        existingTickers={positions.map(p => p.ticker?.toUpperCase()).filter(Boolean)}
        fetchPriceForTicker={fetchPriceForTicker}
      />

      {/* Recovery Dialog */}
      <RecoveryDialog
        isOpen={showRecoveryDialog}
        recoveryData={recoveryData}
        onRecover={handleRecovery}
        onDiscard={handleDiscardRecovery}
      />
    </div>
  );
}

// Wrapper component with Toast provider
function App() {
  return (
    <ToastProvider>
      <ToastConnector />
      <MonteCarloSimulator />
    </ToastProvider>
  );
}

// Component to connect toast ref to MonteCarloSimulator
function ToastConnector() {
  const { showToast } = useToast();
  
  useEffect(() => {
    // Set global toast function for MonteCarloSimulator to use
    setGlobalToastRef(showToast);
  }, [showToast]);
  
  return null;
}

export { App as default };
