import React, { memo, useCallback, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * ExportTab v6.0 - Comprehensive PDF Export
 * 
 * Features:
 * - Histogram charts for all distributions
 * - Enhanced positions with beta, vol, YTD, 1Y
 * - Portfolio risk metrics panel
 * - Methodology pipeline visualization
 * - Full swap matrix heatmap
 * - Improved correlation heatmap with better colors
 * - Fixed exposure calculations
 * - Full-width risk contribution chart
 */

const COLORS = {
  cyan: '#00d4ff',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#ff9f43',
  purple: '#9b59b6',
  blue: '#3498db',
  gold: '#f1c40f',
  teal: '#1abc9c',
};

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatCurrency = (value) => {
  if (value == null || !isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

const formatPct = (value, decimals = 1, showSign = false) => {
  if (value == null || !isFinite(value)) return '—';
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(decimals)}%`;
};

// Compute histogram from distribution
const computeHistogram = (dist, bins = 25) => {
  if (!dist || dist.length === 0) return [];
  const min = Math.min(...dist);
  const max = Math.max(...dist);
  const binWidth = (max - min) / bins || 0.01;
  
  const histogram = Array(bins).fill(0);
  dist.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    histogram[idx]++;
  });
  
  return histogram.map((count, i) => ({
    value: min + (i + 0.5) * binWidth,
    pct: (count / dist.length) * 100,
  }));
};

// ============================================
// PDF PAGE COMPONENTS
// ============================================

// Reusable page header
const PageHeader = memo(({ title, subtitle }) => (
  <div style={{ borderBottom: '3px solid #00d4ff', paddingBottom: '12px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '12px', color: '#00d4ff', fontWeight: '600' }}>MONTE CARLO PORTFOLIO ANALYSIS</div>
      <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{subtitle}</div>
    </div>
    <div style={{ fontSize: '10px', color: '#666' }}>
      {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
    </div>
  </div>
));

// Reusable page footer
const PageFooter = memo(({ pageNum }) => (
  <div style={{
    position: 'absolute',
    bottom: '30px',
    left: '40px',
    right: '40px',
    textAlign: 'center',
    borderTop: '1px solid #2a2a3a',
    paddingTop: '12px',
  }}>
    <div style={{ fontSize: '10px', color: '#666' }}>Page {pageNum} • Monte Carlo Simulator</div>
  </div>
));

// Histogram Chart Component - with threshold coloring
const HistogramChart = memo(({ data, height = 100, color = '#00d4ff', thresholdValue = null, showThreshold = false }) => {
  if (!data || data.length === 0) return null;
  
  const maxPct = Math.max(...data.map(d => d.pct), 1);
  
  return (
    <div style={{ height: `${height}px`, display: 'flex', alignItems: 'flex-end', gap: '1px', padding: '0 2px' }}>
      {data.map((bar, i) => {
        const barHeight = (bar.pct / maxPct) * 100;
        // Determine bar color based on threshold
        let barColor = color;
        if (thresholdValue !== null && thresholdValue !== undefined) {
          // For return distributions: green >= 0, red < 0
          // For dollar distributions: green >= startingValue, red < startingValue
          barColor = bar.value >= thresholdValue ? COLORS.green : COLORS.red;
        }
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${barHeight}%`,
              background: barColor,
              borderRadius: '2px 2px 0 0',
              minHeight: bar.pct > 0 ? '2px' : '0',
            }}
          />
        );
      })}
    </div>
  );
});

// Histogram X-Axis Labels Component - aligned with histogram bars
const HistogramXAxisLabels = memo(({ data, formatter = (v) => v, labelCount = 7 }) => {
  if (!data || data.length === 0) return null;
  
  // Get evenly spaced indices that correspond to bar positions
  const indices = [];
  for (let i = 0; i < labelCount; i++) {
    indices.push(Math.floor((i / (labelCount - 1)) * (data.length - 1)));
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      marginTop: '8px', 
      padding: '0 2px', // Match histogram padding
      fontSize: '9px', 
      color: '#888', 
      fontWeight: '500' 
    }}>
      {indices.map((idx, i) => (
        <span key={i} style={{ 
          textAlign: i === 0 ? 'left' : i === labelCount - 1 ? 'right' : 'center',
          flex: i === 0 || i === labelCount - 1 ? 'none' : 1,
          minWidth: '40px',
        }}>
          {data[idx] ? formatter(data[idx].value) : ''}
        </span>
      ))}
    </div>
  );
});

// ============================================
// COVER PAGE
// ============================================

const CoverPageContent = memo(({ portfolioValue, positions, simulationResults, numPaths, correlationMethod, fatTailMethod, useQmc }) => {
  const t = simulationResults?.terminal;
  const histData = t?.distribution ? computeHistogram(t.distribution, 30) : [];
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: 'linear-gradient(180deg, #0c0e18 0%, #101828 100%)',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ borderBottom: '3px solid #00d4ff', paddingBottom: '20px', marginBottom: '30px' }}>
        <div style={{ fontSize: '14px', color: '#00d4ff', fontWeight: '600', letterSpacing: '2px' }}>
          MONTE CARLO PORTFOLIO ANALYSIS
        </div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>
      
      {/* Hero Title */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(123, 47, 247, 0.1) 100%)',
        borderRadius: '16px',
        padding: '30px',
        marginBottom: '24px',
        borderLeft: '4px solid #00d4ff',
      }}>
        <div style={{ fontSize: '36px', fontWeight: '700', color: '#00d4ff' }}>
          Monte Carlo Portfolio Analysis
        </div>
        <div style={{ fontSize: '13px', color: '#888', marginTop: '12px' }}>
          Forward simulation with correlated returns • {positions.length} positions
        </div>
      </div>
      
      {/* Portfolio Value */}
      <div style={{
        background: 'rgba(46, 204, 113, 0.1)',
        borderRadius: '14px',
        padding: '24px',
        textAlign: 'center',
        marginBottom: '24px',
        border: '1px solid rgba(46, 204, 113, 0.2)',
      }}>
        <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '2px' }}>
          Portfolio Value
        </div>
        <div style={{ fontSize: '48px', fontWeight: '700', color: '#2ecc71', marginTop: '6px' }}>
          {formatCurrency(portfolioValue)}
        </div>
      </div>
      
      {/* Config + Results Row */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
        {/* Configuration */}
        <div style={{
          flex: 1,
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚙️</span> Configuration
          </div>
          {[
            ['Positions', positions.length],
            ['Simulation Paths', (numPaths || 10000).toLocaleString()],
            ['Time Horizon', '1 Year'],
            ['Correlation', correlationMethod === 'sample' ? 'Sample' : 'Ledoit-Wolf'],
            ['Distribution', fatTailMethod === 'multivariateTStudent' ? 'Student-t (df=5)' : 'Gaussian'],
            ['Sampling', useQmc ? 'Quasi-MC (Sobol)' : 'Pseudo-Random'],
          ].map(([label, value], i) => (
            <div key={i} style={{ display: 'flex', marginBottom: '8px' }}>
              <span style={{ fontSize: '11px', color: '#666', width: '110px' }}>{label}:</span>
              <span style={{ fontSize: '11px', color: '#fff', fontWeight: '600' }}>{value}</span>
            </div>
          ))}
        </div>
        
        {/* Key Results */}
        {t && (
          <div style={{
            flex: 1,
            background: 'rgba(22, 27, 44, 0.8)',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎯</span> Key Results (1-Year)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {[
                { label: 'P5 (Bad Case)', value: formatPct(t.p5), color: '#e74c3c' },
                { label: 'Median Return', value: formatPct(t.p50, 1, true), color: '#fff' },
                { label: 'P95 (Good Case)', value: formatPct(t.p95, 1, true), color: '#2ecc71' },
                { label: 'P(Loss)', value: formatPct(simulationResults?.probLoss?.probBreakeven), color: '#ff9f43' },
              ].map((stat, i) => (
                <div key={i} style={{
                  padding: '10px',
                  background: `${stat.color}12`,
                  borderRadius: '8px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: '9px', color: '#888', marginTop: '3px' }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Return Distribution Histogram */}
      {histData.length > 0 && (
        <div style={{
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span> 1-Year Return Distribution
          </div>
          <HistogramChart data={histData} height={120} thresholdValue={0} />
          <HistogramXAxisLabels data={histData} formatter={(v) => formatPct(v)} labelCount={7} />
        </div>
      )}
      
      <PageFooter pageNum={1} />
    </div>
  );
});

// ============================================
// POSITIONS TABLE PAGE (Enhanced)
// ============================================

const PositionsTableContent = memo(({ positions, portfolioValue, positionMetadata, positionBetas, getDistributionParams, pageNum }) => {
  // Calculate portfolio-level metrics
  // Portfolio beta: weighted by signed position value (shorts reduce beta)
  let portfolioBeta = 0;
  let sumAbsWeights = 0;
  let sumWeightedVol = 0;
  
  // Calculate gross positions value for weighting
  const grossPositionsValue = positions.reduce((sum, p) => sum + Math.abs(p.quantity * p.price), 0);
  
  positions.forEach(p => {
    const val = p.quantity * p.price;
    const sign = p.quantity >= 0 ? 1 : -1;
    // Weight by absolute value but apply sign for directional exposure
    const absWeight = grossPositionsValue !== 0 ? Math.abs(val) / grossPositionsValue : 0;
    const beta = positionBetas?.[p.ticker?.toUpperCase()]?.beta;
    const vol = positionBetas?.[p.ticker?.toUpperCase()]?.volatility; // Use actual volatility from data
    
    if (beta != null) {
      portfolioBeta += sign * beta * absWeight;
      sumAbsWeights += absWeight;
    }
    if (vol != null) {
      sumWeightedVol += vol * absWeight; // Volatility is always positive
    }
  });
  
  // Daily risk from weighted average annual volatility (simplified - doesn't account for correlation)
  const annualVol = sumWeightedVol / 100; // vol is stored as percentage, convert to decimal
  const dailyRisk = annualVol / Math.sqrt(252);
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader title="Portfolio Holdings" subtitle="Portfolio Holdings" />
      
      {/* Portfolio Summary Metrics */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(155, 89, 182, 0.08) 100%)',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '16px',
        border: '1px solid rgba(0, 212, 255, 0.15)',
        display: 'flex',
        gap: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(0, 212, 255, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: '700', color: COLORS.cyan,
            fontFamily: 'Georgia, serif',
          }}>β</div>
          <div>
            <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Portfolio Beta</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: portfolioBeta > 1.2 ? COLORS.red : portfolioBeta < 0.8 ? COLORS.green : COLORS.cyan }}>
              {portfolioBeta.toFixed(2)}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(255, 159, 67, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', fontWeight: '700', color: COLORS.orange,
            fontFamily: 'Georgia, serif',
          }}>σ</div>
          <div>
            <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Daily Risk</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: COLORS.orange }}>
              ±{(dailyRisk * 100).toFixed(2)}%
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(46, 204, 113, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '700', color: COLORS.green,
          }}>$</div>
          <div>
            <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Portfolio Value</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: COLORS.green }}>
              {formatCurrency(portfolioValue)}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'rgba(155, 89, 182, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '700', color: COLORS.purple,
          }}>#</div>
          <div>
            <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase' }}>Positions</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: COLORS.purple }}>
              {positions.length}
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Table */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
      }}>
        {/* Table Header */}
        <div style={{ display: 'flex', padding: '10px 16px', background: 'rgba(0, 0, 0, 0.3)', borderBottom: '1px solid #2a2a3a' }}>
          {[
            { label: 'Ticker', width: '60px' },
            { label: 'Name', width: '120px' },
            { label: 'Qty', width: '55px', align: 'right' },
            { label: 'Price', width: '65px', align: 'right' },
            { label: 'Value', width: '70px', align: 'right' },
            { label: 'Wt%', width: '50px', align: 'right' },
            { label: 'β', width: '40px', align: 'center' },
            { label: 'σ', width: '45px', align: 'center' },
            { label: 'YTD', width: '50px', align: 'right' },
            { label: '1Y', width: '50px', align: 'right' },
          ].map((col, i) => (
            <div key={i} style={{
              width: col.width,
              fontSize: '9px',
              fontWeight: '600',
              color: '#666',
              textAlign: col.align || 'left',
              flexShrink: 0,
            }}>
              {col.label}
            </div>
          ))}
        </div>
        
        {/* Table Rows */}
        {positions.slice(0, 22).map((p, i) => {
          const val = p.quantity * p.price;
          const wt = portfolioValue !== 0 ? (val / portfolioValue) * 100 : 0;
          const meta = positionMetadata?.[p.ticker?.toUpperCase()];
          const betaData = positionBetas?.[p.ticker?.toUpperCase()];
          const vol = getDistributionParams?.(p)?.sigma;
          const isLong = p.quantity >= 0;
          
          return (
            <div key={i} style={{
              display: 'flex',
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              background: i % 2 === 1 ? 'rgba(0, 0, 0, 0.15)' : 'transparent',
            }}>
              <div style={{ width: '60px', fontSize: '10px', fontWeight: '600', color: COLORS.cyan, flexShrink: 0 }}>{p.ticker}</div>
              <div style={{ width: '120px', fontSize: '9px', color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {meta?.name || '—'}
              </div>
              <div style={{ width: '55px', fontSize: '10px', color: isLong ? COLORS.green : COLORS.red, textAlign: 'right', fontWeight: '600', flexShrink: 0 }}>
                {p.quantity.toLocaleString()}
              </div>
              <div style={{ width: '65px', fontSize: '10px', color: '#fff', textAlign: 'right', flexShrink: 0 }}>
                ${p.price.toFixed(2)}
              </div>
              <div style={{ width: '70px', fontSize: '10px', color: isLong ? COLORS.green : COLORS.red, textAlign: 'right', fontWeight: '600', flexShrink: 0 }}>
                {formatCurrency(val)}
              </div>
              <div style={{ width: '50px', fontSize: '10px', color: isLong ? COLORS.green : COLORS.red, textAlign: 'right', fontWeight: '600', flexShrink: 0 }}>
                {wt.toFixed(1)}%
              </div>
              <div style={{ width: '40px', fontSize: '10px', color: betaData?.beta > 1.5 ? COLORS.red : betaData?.beta < 0.7 ? COLORS.green : '#fff', textAlign: 'center', flexShrink: 0 }}>
                {betaData?.beta?.toFixed(2) || '—'}
              </div>
              <div style={{ width: '45px', fontSize: '10px', color: vol > 0.4 ? COLORS.red : vol < 0.2 ? COLORS.green : COLORS.orange, textAlign: 'center', flexShrink: 0 }}>
                {vol ? `${(vol * 100).toFixed(0)}%` : '—'}
              </div>
              <div style={{ width: '50px', fontSize: '10px', color: (betaData?.ytdReturn || 0) >= 0 ? COLORS.green : COLORS.red, textAlign: 'right', flexShrink: 0 }}>
                {betaData?.ytdReturn != null ? `${(betaData.ytdReturn * 100).toFixed(0)}%` : '—'}
              </div>
              <div style={{ width: '50px', fontSize: '10px', color: (betaData?.oneYearReturn || 0) >= 0 ? COLORS.green : COLORS.red, textAlign: 'right', flexShrink: 0 }}>
                {betaData?.oneYearReturn != null ? `${(betaData.oneYearReturn * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
          );
        })}
        
        {positions.length > 22 && (
          <div style={{ padding: '10px 16px', fontSize: '10px', color: '#666', textAlign: 'center', background: 'rgba(0,0,0,0.2)' }}>
            ... and {positions.length - 22} more positions
          </div>
        )}
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// EXPOSURE ANALYSIS PAGE (Fixed calculations)
// ============================================

const ExposureAnalysisContent = memo(({ positions, portfolioValue, pageNum }) => {
  const nlv = Math.abs(portfolioValue) || 1;
  
  const longs = positions.filter(p => p.quantity > 0)
    .map(p => ({ ticker: p.ticker, value: p.quantity * p.price }))
    .sort((a, b) => b.value - a.value);
  
  const shorts = positions.filter(p => p.quantity < 0)
    .map(p => ({ ticker: p.ticker, value: Math.abs(p.quantity * p.price) }))
    .sort((a, b) => b.value - a.value);
  
  const grossLong = longs.reduce((s, p) => s + p.value, 0);
  const grossShort = shorts.reduce((s, p) => s + p.value, 0);
  const netExposure = grossLong - grossShort;
  const grossExposure = grossLong + grossShort;
  
  const ExposureBars = ({ items, color, maxVal }) => (
    <div>
      {items.slice(0, 14).map((item, i) => {
        const pct = (item.value / nlv) * 100;
        const barWidth = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: COLORS.cyan, width: '50px' }}>{item.ticker}</span>
            <div style={{ flex: 1, height: '12px', background: '#1a2235', borderRadius: '3px', marginRight: '8px' }}>
              <div style={{
                width: `${Math.min(barWidth, 100)}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${color}aa 0%, ${color} 100%)`,
                borderRadius: '3px',
              }} />
            </div>
            <span style={{ fontSize: '10px', fontWeight: '600', color, width: '45px', textAlign: 'right' }}>
              {pct.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Exposure Analysis" />
      
      {/* Exposure Summary */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '20px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Exposure Summary</div>
        </div>
        
        {/* Visual exposure bar */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', height: '36px', borderRadius: '8px', overflow: 'hidden' }}>
            {grossLong > 0 && (
              <div style={{
                width: `${grossExposure > 0 ? (grossLong / grossExposure) * 100 : 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2ecc71 0%, #27ae60 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>
                  Long {(grossLong / nlv * 100).toFixed(0)}%
                </span>
              </div>
            )}
            {grossShort > 0 && (
              <div style={{
                width: `${grossExposure > 0 ? (grossShort / grossExposure) * 100 : 0}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #c0392b 0%, #e74c3c 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: '#fff' }}>
                  Short {(grossShort / nlv * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Gross Long', value: formatCurrency(grossLong), sub: `${(grossLong / nlv * 100).toFixed(0)}% NLV`, color: COLORS.green },
            { label: 'Gross Short', value: formatCurrency(grossShort), sub: `${(grossShort / nlv * 100).toFixed(0)}% NLV`, color: COLORS.red },
            { label: 'Net Exposure', value: formatCurrency(netExposure), sub: `${(netExposure / nlv * 100).toFixed(0)}% NLV`, color: COLORS.cyan },
            { label: 'Gross Exposure', value: formatCurrency(grossExposure), sub: `${(grossExposure / nlv * 100).toFixed(0)}% NLV`, color: COLORS.orange },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '14px',
              background: `${stat.color}12`,
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '16px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '4px' }}>{stat.label}</div>
              <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Long/Short Positions */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{
          flex: 1,
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '16px' }}>📈</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Long Positions ({longs.length})</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Total: {formatCurrency(grossLong)}</div>
            </div>
          </div>
          <ExposureBars items={longs} color={COLORS.green} maxVal={Math.max(...longs.map(l => l.value), 1)} />
        </div>
        
        <div style={{
          flex: 1,
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <span style={{ fontSize: '16px' }}>📉</span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Short Positions ({shorts.length})</div>
              <div style={{ fontSize: '10px', color: '#666' }}>Total: {formatCurrency(grossShort)}</div>
            </div>
          </div>
          {shorts.length > 0 ? (
            <ExposureBars items={shorts} color={COLORS.red} maxVal={Math.max(...shorts.map(s => s.value), 1)} />
          ) : (
            <div style={{ color: '#555', fontSize: '11px', textAlign: 'center', padding: '30px' }}>No short positions</div>
          )}
        </div>
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// SIMULATION RESULTS PAGE (with histograms)
// ============================================

const SimulationResultsContent = memo(({ simulationResults, portfolioValue, numPaths, fatTailMethod, useQmc, pageNum }) => {
  const t = simulationResults?.terminal || {};
  const td = simulationResults?.terminalDollars || {};
  const dd = simulationResults?.drawdown || {};
  const pl = simulationResults?.probLoss || {};
  
  // Compute histograms
  const returnHist = t.distribution ? computeHistogram(t.distribution, 30) : [];
  const dollarHist = td.distribution ? computeHistogram(td.distribution, 25) : [];
  const ddHist = dd.distribution ? computeHistogram(dd.distribution, 20) : [];
  
  // Calculate VaR and CVaR from distribution
  const calcVaRCVaR = (dist, level = 0.05) => {
    if (!dist || dist.length === 0) return { var: 0, cvar: 0 };
    const sorted = [...dist].sort((a, b) => a - b);
    const varIdx = Math.floor(sorted.length * level);
    const var5 = sorted[varIdx] || 0;
    const worstN = sorted.slice(0, varIdx);
    const cvar5 = worstN.length > 0 ? worstN.reduce((a, b) => a + b, 0) / worstN.length : var5;
    return { var: var5, cvar: cvar5 };
  };
  
  const { var: var5, cvar: cvar5 } = calcVaRCVaR(t.distribution, 0.05);
  const dollarVar5 = var5 * portfolioValue;
  const dollarCVar5 = cvar5 * portfolioValue;
  
  // Calculate Sharpe-like ratio (mean / std)
  const mean = t.mean || 0;
  const std = t.distribution ? Math.sqrt(t.distribution.reduce((s, v) => s + (v - mean) ** 2, 0) / t.distribution.length) : 0.2;
  const sharpeApprox = std > 0 ? (mean - 0.05) / std : 0; // Assume 5% risk-free
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Simulation Results" />
      
      {/* Methodology Pipeline - Enhanced with explanations */}
      <div style={{
        background: 'rgba(0, 212, 255, 0.05)',
        borderRadius: '10px',
        padding: '14px 16px',
        marginBottom: '14px',
        border: '1px solid rgba(0, 212, 255, 0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff' }}>
            🔬 Simulation Methodology
          </div>
          <div style={{ fontSize: '8px', color: '#666' }}>
            {(numPaths || 10000).toLocaleString()} Monte Carlo paths • 252 trading days
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {[
            { label: 'Moments', icon: '∫', color: COLORS.cyan, desc: 'μ, σ, skew' },
            { label: 'Covariance', icon: 'Σ', color: COLORS.purple, desc: 'correlation matrix' },
            { label: 'Cholesky', icon: 'L', color: COLORS.green, desc: 'decomposition' },
            { label: useQmc ? 'Sobol' : 'PRNG', icon: useQmc ? '⊡' : '⊙', color: COLORS.purple, desc: useQmc ? 'low-discrepancy' : 'pseudo-random' },
            { label: fatTailMethod === 'multivariateTStudent' ? 't-dist' : 'Normal', icon: 'ν', color: COLORS.orange, desc: fatTailMethod === 'multivariateTStudent' ? 'df=5 fat tails' : 'Gaussian' },
            { label: 'Skew', icon: '≋', color: COLORS.red, desc: 'asymmetry adj.' },
            { label: 'Terminal', icon: '$', color: COLORS.green, desc: 'compound returns' },
          ].map((step, i) => (
            <React.Fragment key={i}>
              <div style={{
                padding: '5px 8px',
                background: `${step.color}15`,
                borderRadius: '6px',
                border: `1px solid ${step.color}30`,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: step.color, fontFamily: 'Georgia, serif' }}>{step.icon}</span>
                <span style={{ fontSize: '8px', color: step.color, fontWeight: '500' }}>{step.label}</span>
              </div>
              {i < 6 && <span style={{ color: '#444', fontSize: '10px' }}>→</span>}
            </React.Fragment>
          ))}
        </div>
        {/* Plain English explanation */}
        <div style={{ fontSize: '9px', color: '#777', lineHeight: '1.5', padding: '8px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
          <strong style={{ color: '#aaa' }}>How it works:</strong> Historical return moments (mean, volatility, skew) are computed for each position. 
          A covariance matrix captures correlations between assets. Cholesky decomposition transforms independent random draws into correlated returns. 
          {fatTailMethod === 'multivariateTStudent' ? ' Student-t distribution (df=5) models fat tails for realistic crash scenarios.' : ' Returns follow a Gaussian distribution.'}
          {useQmc ? ' Sobol sequences ensure better coverage of probability space than pure random sampling.' : ''}
          {' '}Daily returns compound over 252 trading days to produce terminal portfolio values.
        </div>
      </div>
      
      {/* Return Distribution with Histogram */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>📊</span>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>1-Year Return Distribution</div>
          <span style={{ fontSize: '9px', color: '#666', marginLeft: 'auto' }}>{(numPaths || 10000).toLocaleString()} paths</span>
        </div>
        
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', width: '180px', flexShrink: 0 }}>
            {[
              { label: 'P5', value: formatPct(t.p5), color: COLORS.red },
              { label: 'P25', value: formatPct(t.p25), color: COLORS.orange },
              { label: 'Median', value: formatPct(t.p50), color: '#fff' },
              { label: 'Mean', value: formatPct(t.mean), color: COLORS.cyan },
              { label: 'P75', value: formatPct(t.p75, 1, true), color: COLORS.green },
              { label: 'P95', value: formatPct(t.p95, 1, true), color: COLORS.green },
            ].map((s, i) => (
              <div key={i} style={{ padding: '8px', background: `${s.color}10`, borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '8px', color: '#888' }}>{s.label}</div>
              </div>
            ))}
          </div>
          
          {/* Histogram */}
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '10px' }}>
            <HistogramChart data={returnHist} height={100} thresholdValue={0} />
            <HistogramXAxisLabels data={returnHist} formatter={(v) => formatPct(v)} labelCount={7} />
          </div>
        </div>
      </div>
      
      {/* Terminal Value + Drawdown Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        {/* Terminal Value */}
        <div style={{
          flex: 1,
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>💰</span> Terminal Value
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
            {[
              { label: 'P5', value: formatCurrency(td.p5), color: COLORS.red },
              { label: 'Median', value: formatCurrency(td.p50), color: COLORS.green },
              { label: 'P95', value: formatCurrency(td.p95), color: COLORS.green },
            ].map((s, i) => (
              <div key={i} style={{ padding: '8px', background: `${s.color}10`, borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '8px', color: '#888' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px' }}>
            <HistogramChart data={dollarHist} height={60} color={COLORS.green} thresholdValue={portfolioValue} />
            <HistogramXAxisLabels data={dollarHist} formatter={(v) => formatCurrency(v)} labelCount={5} />
          </div>
        </div>
        
        {/* Drawdown */}
        <div style={{
          flex: 1,
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📉</span> Max Drawdown
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
            {[
              { label: 'P50', value: `-${((dd.p50 || 0) * 100).toFixed(1)}%`, color: COLORS.orange },
              { label: 'P75', value: `-${((dd.p75 || 0) * 100).toFixed(1)}%`, color: COLORS.red },
              { label: 'P95', value: `-${((dd.p95 || 0) * 100).toFixed(1)}%`, color: COLORS.red },
            ].map((s, i) => (
              <div key={i} style={{ padding: '8px', background: `${s.color}10`, borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '8px', color: '#888' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '8px' }}>
            <HistogramChart data={ddHist} height={60} color={COLORS.red} thresholdValue={null} />
            <HistogramXAxisLabels data={ddHist} formatter={(v) => `-${(v * 100).toFixed(0)}%`} labelCount={5} />
          </div>
        </div>
      </div>
      
      {/* Risk Metrics Row - VaR, CVaR, Sharpe */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '10px',
        marginBottom: '12px',
      }}>
        {[
          { label: 'VaR 5%', value: formatPct(var5), sub: formatCurrency(Math.abs(dollarVar5)), color: COLORS.red, icon: '📉' },
          { label: 'CVaR 5%', value: formatPct(cvar5), sub: 'Expected Shortfall', color: COLORS.red, icon: '⚠️' },
          { label: 'Volatility', value: formatPct(std), sub: 'annualized σ', color: COLORS.orange, icon: '📊' },
          { label: 'Sharpe', value: sharpeApprox.toFixed(2), sub: '(μ-rf)/σ', color: sharpeApprox > 0.5 ? COLORS.green : COLORS.orange, icon: '⚡' },
          { label: 'P(Loss)', value: formatPct(pl.probBreakeven), sub: 'any loss', color: pl.probBreakeven < 0.3 ? COLORS.green : COLORS.orange, icon: '🎯' },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '10px',
            background: `${stat.color}10`,
            borderRadius: '8px',
            border: `1px solid ${stat.color}20`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '10px', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>{stat.label}</div>
            <div style={{ fontSize: '7px', color: '#555', marginTop: '1px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>
      
      {/* Loss Probability */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '14px',
      }}>
        <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>📋</span> Loss Probability Thresholds
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            { label: 'Any Loss', value: pl.probBreakeven, color: COLORS.orange },
            { label: '>10% Loss', value: pl.prob10, color: COLORS.orange },
            { label: '>20% Loss', value: pl.prob20, color: COLORS.red },
            { label: '>30% Loss', value: pl.prob30, color: COLORS.red },
          ].map((item, i) => (
            <div key={i}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '9px', color: '#888' }}>{item.label}</span>
                <span style={{ fontSize: '9px', fontWeight: '600', color: item.color }}>{formatPct(item.value)}</span>
              </div>
              <div style={{ height: '6px', background: '#1a2235', borderRadius: '3px' }}>
                <div style={{
                  width: `${Math.min((item.value || 0) * 100, 100)}%`,
                  height: '100%',
                  background: item.color,
                  borderRadius: '3px',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// KEY TAKEAWAYS PAGE (Plain English Summary)
// ============================================

const KeyTakeawaysContent = memo(({ simulationResults, portfolioValue, positions, positionMetadata, pageNum }) => {
  const t = simulationResults?.terminal || {};
  const td = simulationResults?.terminalDollars || {};
  const dd = simulationResults?.drawdown || {};
  const pl = simulationResults?.probLoss || {};
  
  // Calculate sector breakdown
  const sectorData = {};
  let totalSectorValue = 0;
  
  positions.forEach(p => {
    const val = Math.abs(p.quantity * p.price); // Use absolute value for sector allocation
    const meta = positionMetadata?.[p.ticker?.toUpperCase()];
    // Use sector from metadata, but clean up ETF names that have "Unknown" sector
    let sector = meta?.sector;
    const ticker = p.ticker?.toUpperCase();
    
    // First check ETFs and override any sector
    if (['SOXL', 'SOXX', 'SMH', 'XSD', 'KDEF', 'BESI.AS', '6525.T', 'ASML', 'TSM', 'CAMT'].includes(ticker)) {
      sector = 'Technology';
    } else if (['KRE'].includes(ticker)) {
      sector = 'Financials';
    } else if (['IWM', 'SPY', 'QQQ', 'VTI'].includes(ticker)) {
      sector = 'Broad Market';
    } else if (['PSCC', 'XLP', 'VDC'].includes(ticker)) {
      sector = 'Consumer';
    } else if (['IGV', 'WCLD', 'SKYY'].includes(ticker)) {
      sector = 'Technology';
    } else if (['EWY', 'EEM', 'VWO', 'IEMG'].includes(ticker)) {
      sector = 'Emerging Markets';
    } else if (['GDXU', 'GDX', 'GDXJ', 'GLD'].includes(ticker)) {
      sector = 'Materials';
    } else if (!sector || sector === 'Unknown' || sector === '') {
      sector = meta?.industry || 'Other';
    }
    
    // Normalize sector names
    if (sector === 'Regional Banks' || sector === 'Banks—Regional') sector = 'Financials';
    if (sector === 'Software—Application' || sector === 'Software—Infrastructure' || sector === 'Semiconductors') sector = 'Technology';
    if (sector === 'South Korea' || sector === 'China') sector = 'Emerging Markets';
    if (sector?.includes('Consumer')) sector = 'Consumer';
    if (sector?.includes('Gold') || sector?.includes('Mining')) sector = 'Materials';
    
    if (!sectorData[sector]) {
      sectorData[sector] = { value: 0, count: 0 };
    }
    sectorData[sector].value += val;
    sectorData[sector].count += 1;
    totalSectorValue += val;
  });
  
  // Use totalSectorValue (gross exposure) for percentage calculation
  const baseValue = totalSectorValue > 0 ? totalSectorValue : 1;
  
  const sortedSectors = Object.entries(sectorData)
    .map(([name, data]) => ({ 
      name, 
      value: data.value, 
      count: data.count,
      pct: (data.value / baseValue) * 100
    }))
    .filter(s => s.pct >= 1) // Only show sectors with at least 1%
    .sort((a, b) => b.value - a.value);
  
  const sectorColors = {
    'Technology': COLORS.cyan,
    'Healthcare': '#2ecc71',
    'Financial Services': COLORS.gold,
    'Financials': COLORS.gold,
    'Consumer Cyclical': COLORS.orange,
    'Consumer Defensive': COLORS.purple,
    'Consumer Staples': COLORS.purple,
    'Consumer': '#9b59b6',
    'Communication Services': '#3498db',
    'Industrials': COLORS.teal,
    'Energy': COLORS.red,
    'Utilities': '#8e44ad',
    'Real Estate': '#16a085',
    'Basic Materials': '#d35400',
    'Materials': '#e67e22',
    'Broad Market': '#3498db',
    'Emerging Markets': '#1abc9c',
    'Other': '#7f8c8d',
    'Unknown': '#555',
  };
  
  // Generate key takeaways
  const takeaways = [];
  
  // Return outlook
  if (t.p50 != null) {
    if (t.p50 > 0.15) takeaways.push({ icon: '🚀', text: `Strong upside potential: median return of ${(t.p50 * 100).toFixed(0)}% expected`, color: COLORS.green });
    else if (t.p50 > 0.05) takeaways.push({ icon: '📈', text: `Positive outlook: median return of ${(t.p50 * 100).toFixed(0)}% expected`, color: COLORS.green });
    else if (t.p50 > -0.05) takeaways.push({ icon: '➡️', text: `Moderate outlook: median return near ${(t.p50 * 100).toFixed(0)}%`, color: COLORS.orange });
    else takeaways.push({ icon: '⚠️', text: `Challenging outlook: median return of ${(t.p50 * 100).toFixed(0)}%`, color: COLORS.red });
  }
  
  // Loss probability
  if (pl.probBreakeven != null) {
    if (pl.probBreakeven < 0.3) takeaways.push({ icon: '🛡️', text: `Low loss probability: only ${(pl.probBreakeven * 100).toFixed(0)}% chance of losing money`, color: COLORS.green });
    else if (pl.probBreakeven < 0.5) takeaways.push({ icon: '⚖️', text: `Moderate risk: ${(pl.probBreakeven * 100).toFixed(0)}% chance of loss over 1 year`, color: COLORS.orange });
    else takeaways.push({ icon: '⚠️', text: `Higher risk profile: ${(pl.probBreakeven * 100).toFixed(0)}% probability of loss`, color: COLORS.red });
  }
  
  // Worst case scenario
  if (t.p5 != null && td.p5 != null) {
    const dollarLoss = portfolioValue - td.p5;
    takeaways.push({ 
      icon: '📉', 
      text: `Bad year (P5): could lose up to ${formatCurrency(dollarLoss)} (${(Math.abs(t.p5) * 100).toFixed(0)}%)`, 
      color: COLORS.red 
    });
  }
  
  // Best case scenario
  if (t.p95 != null && td.p95 != null) {
    const dollarGain = td.p95 - portfolioValue;
    takeaways.push({ 
      icon: '🎯', 
      text: `Good year (P95): could gain up to ${formatCurrency(dollarGain)} (+${(t.p95 * 100).toFixed(0)}%)`, 
      color: COLORS.green 
    });
  }
  
  // Drawdown warning
  if (dd.p50 != null) {
    if (dd.p50 > 0.25) takeaways.push({ icon: '🎢', text: `Expect significant volatility: typical drawdown of ${(dd.p50 * 100).toFixed(0)}%`, color: COLORS.orange });
    else if (dd.p50 > 0.15) takeaways.push({ icon: '📊', text: `Moderate volatility expected: typical drawdown around ${(dd.p50 * 100).toFixed(0)}%`, color: COLORS.orange });
  }
  
  // Concentration warning
  const topSector = sortedSectors[0];
  if (topSector && topSector.pct > 40) {
    takeaways.push({ 
      icon: '🎯', 
      text: `Concentrated in ${topSector.name} (${topSector.pct.toFixed(0)}%) - consider diversifying`, 
      color: COLORS.orange 
    });
  }
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Key Takeaways" />
      
      {/* Executive Summary */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.08) 100%)',
        borderRadius: '14px',
        padding: '20px',
        marginBottom: '16px',
        border: '1px solid rgba(0, 212, 255, 0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '24px' }}>📋</span>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#fff' }}>Executive Summary</div>
            <div style={{ fontSize: '10px', color: '#666' }}>Plain-English interpretation of Monte Carlo simulation results</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {takeaways.map((t, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              background: `${t.color}10`,
              borderRadius: '10px',
              border: `1px solid ${t.color}25`,
            }}>
              <span style={{ fontSize: '20px' }}>{t.icon}</span>
              <span style={{ fontSize: '12px', color: '#ddd', lineHeight: '1.4' }}>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Dollar Outcomes */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>💵</span> What This Means in Dollars
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
          {[
            { 
              label: 'Starting Value', 
              value: formatCurrency(portfolioValue), 
              sub: 'Current portfolio', 
              color: COLORS.cyan 
            },
            { 
              label: 'Bad Year (P5)', 
              value: formatCurrency(td.p5), 
              sub: `${formatCurrency(td.p5 - portfolioValue)} change`, 
              color: COLORS.red 
            },
            { 
              label: 'Expected (Median)', 
              value: formatCurrency(td.p50), 
              sub: `${td.p50 > portfolioValue ? '+' : ''}${formatCurrency(td.p50 - portfolioValue)} change`, 
              color: COLORS.green 
            },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '16px',
              background: `${stat.color}10`,
              borderRadius: '10px',
              textAlign: 'center',
              border: `1px solid ${stat.color}20`,
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>{stat.label}</div>
              <div style={{ fontSize: '9px', color: stat.color === COLORS.red ? COLORS.red : COLORS.green, marginTop: '2px' }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Sector Breakdown */}
      {sortedSectors.length > 0 && sortedSectors[0].name !== 'Unknown' && (
        <div style={{
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '16px',
        }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🏭</span> Sector Allocation
          </div>
          
          {/* Stacked bar - clean visual without text */}
          <div style={{ display: 'flex', height: '40px', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px', background: '#1a2235' }}>
            {sortedSectors.map((sector, i) => (
              <div
                key={i}
                style={{
                  width: `${sector.pct}%`,
                  height: '100%',
                  background: sectorColors[sector.name] || COLORS.purple,
                  minWidth: sector.pct > 2 ? '2px' : '0',
                  borderRight: i < sortedSectors.length - 1 ? '1px solid rgba(0,0,0,0.5)' : 'none',
                }}
                title={`${sector.name}: ${sector.pct.toFixed(1)}%`}
              />
            ))}
          </div>
          
          {/* Legend - 2 columns with full names */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 20px' }}>
            {sortedSectors.slice(0, 8).map((sector, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '16px', 
                  height: '16px', 
                  borderRadius: '4px', 
                  background: sectorColors[sector.name] || COLORS.purple,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: '11px', color: '#ccc', flex: 1 }}>
                  {sector.name}
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>
                  {sector.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// CONTRIBUTION ANALYSIS PAGE
// ============================================

const ContributionAnalysisContent = memo(({ simulationResults, pageNum }) => {
  if (!simulationResults?.contributions) return null;
  
  const { tickers, p5, p25, p50, p75, p95 } = simulationResults.contributions;
  
  // Handle duplicate tickers
  const counts = {};
  tickers.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const seen = {};
  const labels = tickers.map(t => {
    seen[t] = (seen[t] || 0) + 1;
    return counts[t] > 1 ? `${t}#${seen[t]}` : t;
  });
  
  // Sort by P50 contribution
  const data = labels.map((label, i) => ({
    label,
    ticker: tickers[i],
    p5: (p5[i] || 0) * 100,
    p25: (p25[i] || 0) * 100,
    p50: (p50[i] || 0) * 100,
    p75: (p75[i] || 0) * 100,
    p95: (p95[i] || 0) * 100,
  })).sort((a, b) => b.p50 - a.p50);
  
  const maxAbs = Math.max(...data.map(d => Math.max(Math.abs(d.p5), Math.abs(d.p95))), 1);
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Contribution Analysis" />
      
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '14px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{ fontSize: '18px' }}>📊</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Position Contributions to Portfolio Return</div>
            <div style={{ fontSize: '10px', color: '#666' }}>Showing median (P50) contribution with P5-P95 range</div>
          </div>
        </div>
        
        {/* Chart */}
        <div style={{ marginBottom: '16px' }}>
          {data.slice(0, 20).map((item, i) => {
            const centerPct = 50;
            const p50Width = (Math.abs(item.p50) / maxAbs) * 45;
            
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: '600', color: COLORS.cyan, width: '55px', flexShrink: 0 }}>{item.label}</span>
                
                {/* Bar container */}
                <div style={{ flex: 1, height: '16px', background: '#1a2235', borderRadius: '4px', position: 'relative', margin: '0 8px' }}>
                  {/* Center line */}
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    background: '#444',
                  }} />
                  
                  {/* P50 bar */}
                  <div style={{
                    position: 'absolute',
                    top: '2px',
                    height: '12px',
                    background: item.p50 >= 0 ? COLORS.green : COLORS.red,
                    borderRadius: '2px',
                    left: item.p50 >= 0 ? '50%' : `${50 - p50Width}%`,
                    width: `${p50Width}%`,
                  }} />
                  
                  {/* P5-P95 range indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '6px',
                    height: '4px',
                    background: 'rgba(255,255,255,0.3)',
                    borderRadius: '2px',
                    left: `${50 + (item.p5 / maxAbs) * 45}%`,
                    width: `${((item.p95 - item.p5) / maxAbs) * 45}%`,
                  }} />
                </div>
                
                <span style={{ fontSize: '9px', color: COLORS.red, width: '40px', textAlign: 'right', flexShrink: 0 }}>
                  {item.p5.toFixed(1)}%
                </span>
                <span style={{ fontSize: '10px', fontWeight: '700', color: item.p50 >= 0 ? COLORS.green : COLORS.red, width: '45px', textAlign: 'right', flexShrink: 0 }}>
                  {item.p50 >= 0 ? '+' : ''}{item.p50.toFixed(1)}%
                </span>
                <span style={{ fontSize: '9px', color: COLORS.green, width: '40px', textAlign: 'right', flexShrink: 0 }}>
                  {item.p95 >= 0 ? '+' : ''}{item.p95.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', paddingTop: '12px', borderTop: '1px solid #2a2a3a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '12px', background: COLORS.green, borderRadius: '2px' }} />
            <span style={{ fontSize: '9px', color: '#888' }}>Positive contribution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '12px', background: COLORS.red, borderRadius: '2px' }} />
            <span style={{ fontSize: '9px', color: '#888' }}>Negative contribution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '16px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px' }} />
            <span style={{ fontSize: '9px', color: '#888' }}>P5-P95 range</span>
          </div>
        </div>
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// CORRELATION MATRIX PAGE (Improved colors & scaling)
// ============================================

const CorrelationMatrixContent = memo(({ tickers, editedCorrelation, correlationMethod, useEwma, pageNum }) => {
  if (!editedCorrelation || editedCorrelation.length === 0) return null;
  
  const n = tickers.length;
  // Scale cell size based on number of tickers - fill the available width (720px)
  const maxCellSize = 32;
  const minCellSize = 14;
  const cellSize = Math.max(minCellSize, Math.min(maxCellSize, Math.floor(680 / (n + 1))));
  
  // Improved color function - blue for negative, red for positive (like a proper heatmap)
  const getColor = (val, isDiag) => {
    if (isDiag) return '#2a3a4a';
    
    // Use a diverging color scale: blue (negative) -> white (zero) -> red (positive)
    if (val > 0.8) return '#c0392b';      // Strong positive - dark red
    if (val > 0.6) return '#e74c3c';      // Positive - red
    if (val > 0.4) return '#ec7063';      // Moderate positive - light red
    if (val > 0.2) return '#f5b7b1';      // Weak positive - very light red
    if (val > 0.05) return '#fadbd8';     // Near zero positive
    if (val > -0.05) return '#2a3a4a';    // Near zero - neutral
    if (val > -0.2) return '#d4e6f1';     // Near zero negative
    if (val > -0.4) return '#85c1e9';     // Weak negative - light blue
    if (val > -0.6) return '#5dade2';     // Moderate negative - blue
    if (val > -0.8) return '#3498db';     // Negative - darker blue
    return '#2471a3';                      // Strong negative - dark blue
  };
  
  // Compute portfolio average correlation
  let totalCorr = 0, count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      totalCorr += editedCorrelation[i][j];
      count++;
    }
  }
  const avgCorr = count > 0 ? totalCorr / count : 0;
  
  // Find highest and lowest correlations
  let maxCorr = -1, minCorr = 1, maxPair = '', minPair = '';
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (editedCorrelation[i][j] > maxCorr) {
        maxCorr = editedCorrelation[i][j];
        maxPair = `${tickers[i]}-${tickers[j]}`;
      }
      if (editedCorrelation[i][j] < minCorr) {
        minCorr = editedCorrelation[i][j];
        minPair = `${tickers[i]}-${tickers[j]}`;
      }
    }
  }
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Correlation Matrix" />
      
      {/* Summary Stats */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Avg Correlation', value: avgCorr.toFixed(2), color: avgCorr > 0.5 ? COLORS.red : avgCorr > 0.3 ? COLORS.orange : COLORS.green },
            { label: 'Highest', value: `${maxCorr.toFixed(2)}`, sub: maxPair, color: COLORS.red },
            { label: 'Lowest', value: `${minCorr.toFixed(2)}`, sub: minPair, color: COLORS.blue },
            { label: 'Method', value: correlationMethod === 'sample' ? 'Sample' : 'Ledoit-Wolf', sub: useEwma ? '+ EWMA' : '', color: COLORS.purple },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '12px',
              background: `${stat.color}12`,
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{stat.label}</div>
              {stat.sub && <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>{stat.sub}</div>}
            </div>
          ))}
        </div>
      </div>
      
      {/* Correlation Heatmap */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>🔗</span>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Correlation Heatmap ({n}×{n})</div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'inline-block' }}>
            {/* Column headers */}
            <div style={{ display: 'flex', marginLeft: `${cellSize + 2}px` }}>
              {tickers.map((t, i) => (
                <div key={i} style={{
                  width: `${cellSize}px`,
                  height: '18px',
                  fontSize: Math.min(8, cellSize / 4),
                  fontWeight: '600',
                  color: COLORS.cyan,
                  textAlign: 'center',
                  overflow: 'hidden',
                  writingMode: n > 15 ? 'vertical-rl' : 'horizontal-tb',
                  transform: n > 15 ? 'rotate(180deg)' : 'none',
                }}>
                  {t.substring(0, Math.max(3, Math.floor(cellSize / 6)))}
                </div>
              ))}
            </div>
            
            {/* Rows */}
            {tickers.map((rowTicker, row) => (
              <div key={row} style={{ display: 'flex', alignItems: 'center' }}>
                {/* Row label */}
                <div style={{
                  width: `${cellSize}px`,
                  fontSize: Math.min(8, cellSize / 4),
                  fontWeight: '600',
                  color: COLORS.cyan,
                  textAlign: 'right',
                  paddingRight: '2px',
                  overflow: 'hidden',
                }}>
                  {rowTicker.substring(0, Math.max(4, Math.floor(cellSize / 5)))}
                </div>
                
                {/* Cells */}
                {editedCorrelation[row].map((val, col) => (
                  <div key={col} style={{
                    width: `${cellSize - 2}px`,
                    height: `${cellSize - 2}px`,
                    margin: '1px',
                    background: getColor(val, row === col),
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.min(7, cellSize / 4),
                    fontWeight: '600',
                    color: row === col ? '#555' : (Math.abs(val) > 0.4 ? '#fff' : (val > 0 ? '#7b241c' : '#1a5276')),
                  }}>
                    {cellSize >= 18 ? (row === col ? '' : val.toFixed(1)) : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* Color Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '16px' }}>
          <span style={{ fontSize: '8px', color: '#888', marginRight: '4px' }}>-1.0</span>
          {['#2471a3', '#3498db', '#85c1e9', '#d4e6f1', '#2a3a4a', '#fadbd8', '#f5b7b1', '#e74c3c', '#c0392b'].map((c, i) => (
            <div key={i} style={{ width: '24px', height: '12px', background: c, borderRadius: '2px' }} />
          ))}
          <span style={{ fontSize: '8px', color: '#888', marginLeft: '4px' }}>+1.0</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: '8px', color: '#666', marginTop: '4px' }}>
          Blue = Negative correlation • Gray = Uncorrelated • Red = Positive correlation
        </div>
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// VOLATILITY ANALYSIS PAGE
// ============================================

const VolatilityAnalysisContent = memo(({ positions, getDistributionParams, pageNum }) => {
  const vols = positions.map(p => ({
    ticker: p.ticker,
    vol: getDistributionParams?.(p)?.sigma || 0.2,
    mu: getDistributionParams?.(p)?.mu || 0,
  })).sort((a, b) => b.vol - a.vol);
  
  const volValues = vols.map(v => v.vol);
  const maxVol = volValues.length > 0 ? Math.max(...volValues) : 0.2;
  const minVol = volValues.length > 0 ? Math.min(...volValues) : 0.2;
  const avgVol = volValues.length > 0 ? volValues.reduce((s, v) => s + v, 0) / volValues.length : 0.2;
  
  const getVolColor = (vol) => {
    const pct = vol / maxVol;
    if (pct >= 0.8) return COLORS.red;
    if (pct >= 0.6) return COLORS.orange;
    if (pct >= 0.4) return COLORS.gold;
    return COLORS.green;
  };
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Volatility Analysis" />
      
      {/* Summary Stats */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Highest σ', value: `${(maxVol * 100).toFixed(0)}%`, sub: vols[0]?.ticker, color: COLORS.red },
            { label: 'Lowest σ', value: `${(minVol * 100).toFixed(0)}%`, sub: vols[vols.length - 1]?.ticker, color: COLORS.green },
            { label: 'Average σ', value: `${(avgVol * 100).toFixed(0)}%`, sub: `${vols.length} positions`, color: COLORS.cyan },
            { label: 'Vol Spread', value: `${(maxVol / minVol).toFixed(1)}x`, sub: 'high / low', color: COLORS.purple },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '12px',
              background: `${stat.color}12`,
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '8px', color: '#555', marginTop: '2px' }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Volatility Bars */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '16px' }}>📊</span>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Volatility by Position (Annualized σ)</div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {vols.slice(0, 28).map((item, i) => {
            const barWidth = (item.vol / maxVol) * 100;
            const color = getVolColor(item.vol);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: '9px', fontWeight: '600', color: COLORS.cyan, width: '45px', flexShrink: 0 }}>{item.ticker}</span>
                <div style={{ flex: 1, height: '12px', background: '#1a2235', borderRadius: '3px', marginRight: '6px' }}>
                  <div style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${color}99 0%, ${color} 100%)`,
                    borderRadius: '3px',
                  }} />
                </div>
                <span style={{ fontSize: '9px', fontWeight: '600', color, width: '38px', textAlign: 'right', flexShrink: 0 }}>
                  {(item.vol * 100).toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #2a2a3a' }}>
          {[
            { color: COLORS.green, label: 'Low (<20%)' },
            { color: COLORS.gold, label: 'Medium (20-40%)' },
            { color: COLORS.orange, label: 'High (40-60%)' },
            { color: COLORS.red, label: 'Very High (>60%)' },
          ].map((tier, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', background: tier.color, borderRadius: '2px' }} />
              <span style={{ fontSize: '8px', color: '#888' }}>{tier.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Volatility Insights */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginTop: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={{ fontSize: '16px' }}>💡</span>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Volatility Insights</div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {/* Volatility Distribution - improved visual */}
          <div style={{ padding: '14px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#aaa', marginBottom: '10px', fontWeight: '500' }}>Position Count by Volatility</div>
            {(() => {
              const buckets = [
                { label: '<20%', count: vols.filter(v => v.vol < 0.2).length, color: COLORS.green },
                { label: '20-40%', count: vols.filter(v => v.vol >= 0.2 && v.vol < 0.4).length, color: COLORS.gold },
                { label: '40-60%', count: vols.filter(v => v.vol >= 0.4 && v.vol < 0.6).length, color: COLORS.orange },
                { label: '>60%', count: vols.filter(v => v.vol >= 0.6).length, color: COLORS.red },
              ];
              const maxCount = Math.max(...buckets.map(b => b.count), 1);
              
              return (
                <>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '70px' }}>
                    {buckets.map((bucket, i) => {
                      const barHeight = bucket.count > 0 ? Math.max((bucket.count / maxCount) * 100, 20) : 10;
                      return (
                        <div 
                          key={i} 
                          style={{ 
                            flex: 1, 
                            height: `${barHeight}%`,
                            background: bucket.count > 0 
                              ? `linear-gradient(180deg, ${bucket.color} 0%, ${bucket.color}80 100%)`
                              : 'rgba(255,255,255,0.05)',
                            borderRadius: '4px 4px 0 0',
                            minHeight: bucket.count > 0 ? '24px' : '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: bucket.count > 0 ? `0 0 10px ${bucket.color}30` : 'none',
                          }}
                        >
                          <span style={{ 
                            fontSize: '12px', 
                            fontWeight: '700', 
                            color: bucket.count > 0 ? '#fff' : '#444',
                            textShadow: bucket.count > 0 ? '0 1px 2px rgba(0,0,0,0.5)' : 'none',
                          }}>
                            {bucket.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Bucket labels */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                    {buckets.map((bucket, i) => (
                      <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '9px', color: bucket.color, fontWeight: '600' }}>{bucket.label}</div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
          
          {/* Key Observations */}
          <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>Key Observations</div>
            <div style={{ fontSize: '9px', color: '#aaa', lineHeight: '1.6' }}>
              {avgVol > 0.5 && <div>• High average volatility ({(avgVol * 100).toFixed(0)}%) indicates aggressive positioning</div>}
              {avgVol <= 0.5 && avgVol > 0.3 && <div>• Moderate volatility profile ({(avgVol * 100).toFixed(0)}%)</div>}
              {avgVol <= 0.3 && <div>• Conservative volatility profile ({(avgVol * 100).toFixed(0)}%)</div>}
              {maxVol / minVol > 5 && <div>• Wide volatility spread ({(maxVol / minVol).toFixed(1)}x) - diverse risk levels</div>}
              {vols.filter(v => v.vol > 0.6).length > 0 && <div>• {vols.filter(v => v.vol > 0.6).length} very high volatility position(s)</div>}
              {vols.filter(v => v.vol < 0.2).length > vols.length / 2 && <div>• Majority of positions have low volatility</div>}
            </div>
          </div>
        </div>
        
        {/* Top 3 Most/Least Volatile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '12px' }}>
          <div style={{ padding: '10px', background: `${COLORS.red}10`, borderRadius: '8px', border: `1px solid ${COLORS.red}20` }}>
            <div style={{ fontSize: '9px', color: COLORS.red, fontWeight: '600', marginBottom: '6px' }}>🔥 Most Volatile</div>
            {vols.slice(0, 3).map((v, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#aaa', marginBottom: '2px' }}>
                <span>{v.ticker}</span>
                <span style={{ color: COLORS.red }}>{(v.vol * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '10px', background: `${COLORS.green}10`, borderRadius: '8px', border: `1px solid ${COLORS.green}20` }}>
            <div style={{ fontSize: '9px', color: COLORS.green, fontWeight: '600', marginBottom: '6px' }}>🛡️ Least Volatile</div>
            {vols.slice(-3).reverse().map((v, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#aaa', marginBottom: '2px' }}>
                <span>{v.ticker}</span>
                <span style={{ color: COLORS.green }}>{(v.vol * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// EXPECTED RETURNS BY SECURITY PAGE
// ============================================

const ExpectedReturnsContent = memo(({ positions, getDistributionParams, positionBetas, pageNum }) => {
  // Build data with distribution params
  const data = positions.map(p => {
    const params = getDistributionParams?.(p) || {};
    const beta = positionBetas?.[p.ticker?.toUpperCase()];
    return {
      ticker: p.ticker,
      quantity: p.quantity,
      value: Math.abs(p.quantity * p.price),
      mu: params.mu || 0,
      sigma: params.sigma || 0.2,
      skew: params.skew || 0,
      ytd: beta?.ytdReturn,
      oneYear: beta?.oneYearReturn,
      beta: beta?.beta,
    };
  }).sort((a, b) => b.value - a.value);
  
  // Calculate portfolio-weighted expected return
  const totalValue = data.reduce((s, d) => s + d.value, 0);
  const portfolioMu = totalValue > 0 ? data.reduce((s, d) => s + d.mu * d.value, 0) / totalValue : 0;
  const portfolioSigma = totalValue > 0 ? Math.sqrt(data.reduce((s, d) => s + (d.sigma ** 2) * ((d.value / totalValue) ** 2), 0)) : 0;
  
  // Get return tiers for color coding
  const getReturnColor = (mu) => {
    if (mu > 0.3) return COLORS.green;
    if (mu > 0.1) return '#2ecc71';
    if (mu > 0) return COLORS.gold;
    if (mu > -0.1) return COLORS.orange;
    return COLORS.red;
  };
  
  const getVolColor = (sigma) => {
    if (sigma < 0.2) return COLORS.green;
    if (sigma < 0.4) return COLORS.gold;
    if (sigma < 0.6) return COLORS.orange;
    return COLORS.red;
  };

  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Expected Returns by Security" />
      
      {/* Portfolio Summary */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        borderRadius: '12px',
        border: '1px solid rgba(0, 212, 255, 0.2)',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📊</span> Portfolio Expected Return Summary
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'Expected Return (μ)', value: `${(portfolioMu * 100).toFixed(1)}%`, sub: 'value-weighted', color: getReturnColor(portfolioMu) },
            { label: 'Portfolio Volatility (σ)', value: `${(portfolioSigma * 100).toFixed(1)}%`, sub: 'diversified', color: getVolColor(portfolioSigma) },
            { label: 'Risk-Adj Return', value: portfolioSigma > 0 ? (portfolioMu / portfolioSigma).toFixed(2) : 'N/A', sub: 'μ/σ ratio', color: COLORS.purple },
            { label: 'Positions', value: data.length, sub: 'total securities', color: COLORS.cyan },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '12px',
              background: `${stat.color}10`,
              borderRadius: '8px',
              textAlign: 'center',
              border: `1px solid ${stat.color}20`,
            }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{stat.label}</div>
              <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Distribution Parameters Table */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📈</span> Distribution Parameters by Security
        </div>
        
        {/* Table Header - styled to match Page 2 */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '65px 150px 55px 55px 55px 55px 65px',
          gap: '8px',
          padding: '10px 12px',
          background: 'rgba(0,0,0,0.4)',
          borderRadius: '6px',
          marginBottom: '2px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ticker</span>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exp. Return (μ)</span>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>σ</span>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skew</span>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sharpe</span>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>YTD</span>
          <span style={{ fontSize: '9px', color: '#666', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1Y</span>
        </div>
        
        {/* Table Rows - show all positions with consistent bold styling */}
        <div style={{ maxHeight: '520px', overflow: 'hidden' }}>
          {data.slice(0, 18).map((row, i) => {
            const sharpe = row.sigma > 0 ? ((row.mu - 0.05) / row.sigma).toFixed(2) : 'N/A';
            const sharpeVal = parseFloat(sharpe);
            return (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '65px 150px 55px 55px 55px 55px 65px',
                  gap: '8px',
                  padding: '7px 12px',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: '700', color: COLORS.cyan }}>{row.ticker}</span>
                
                {/* Expected Return with improved bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ 
                    width: '80px', 
                    height: '10px', 
                    background: '#1a2235', 
                    borderRadius: '5px',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    {row.mu >= 0 ? (
                      <div style={{
                        position: 'absolute',
                        left: '50%',
                        width: `${Math.min(Math.abs(row.mu) * 80, 50)}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${COLORS.green}99, ${COLORS.green})`,
                        borderRadius: '0 5px 5px 0',
                      }} />
                    ) : (
                      <div style={{
                        position: 'absolute',
                        right: '50%',
                        width: `${Math.min(Math.abs(row.mu) * 80, 50)}%`,
                        height: '100%',
                        background: `linear-gradient(270deg, ${COLORS.red}99, ${COLORS.red})`,
                        borderRadius: '5px 0 0 5px',
                      }} />
                    )}
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      top: '0',
                      width: '1px',
                      height: '100%',
                      background: '#555',
                    }} />
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: '700', color: getReturnColor(row.mu), minWidth: '48px' }}>
                    {row.mu >= 0 ? '+' : ''}{(row.mu * 100).toFixed(1)}%
                  </span>
                </div>
                
                {/* Volatility - BOLD like Page 2 */}
                <span style={{ fontSize: '10px', fontWeight: '700', color: getVolColor(row.sigma) }}>
                  {(row.sigma * 100).toFixed(0)}%
                </span>
                
                {/* Skew */}
                <span style={{ fontSize: '10px', fontWeight: '700', color: row.skew > 0 ? COLORS.green : row.skew < -0.2 ? COLORS.red : '#888' }}>
                  {row.skew.toFixed(2)}
                </span>
                
                {/* Sharpe */}
                <span style={{ fontSize: '10px', fontWeight: '700', color: sharpeVal > 0.5 ? COLORS.green : sharpeVal < 0 ? COLORS.red : COLORS.gold }}>
                  {sharpe}
                </span>
                
                {/* YTD - BOLD like Page 2 */}
                <span style={{ fontSize: '10px', fontWeight: '700', color: row.ytd > 0 ? COLORS.green : row.ytd < 0 ? COLORS.red : '#666' }}>
                  {row.ytd != null ? `${row.ytd > 0 ? '+' : ''}${(row.ytd * 100).toFixed(0)}%` : '-'}
                </span>
                
                {/* 1Y - BOLD like Page 2 */}
                <span style={{ fontSize: '10px', fontWeight: '700', color: row.oneYear > 0 ? COLORS.green : row.oneYear < 0 ? COLORS.red : '#666' }}>
                  {row.oneYear != null ? `${row.oneYear > 0 ? '+' : ''}${(row.oneYear * 100).toFixed(0)}%` : '-'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Return Distribution Overview */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🎯</span> Return Expectations Summary
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { label: 'High Return (>30%)', count: data.filter(d => d.mu > 0.3).length, color: COLORS.green, tickers: data.filter(d => d.mu > 0.3).slice(0, 3).map(d => d.ticker).join(', ') },
            { label: 'Moderate (10-30%)', count: data.filter(d => d.mu > 0.1 && d.mu <= 0.3).length, color: '#2ecc71', tickers: data.filter(d => d.mu > 0.1 && d.mu <= 0.3).slice(0, 3).map(d => d.ticker).join(', ') },
            { label: 'Low (0-10%)', count: data.filter(d => d.mu >= 0 && d.mu <= 0.1).length, color: COLORS.gold, tickers: data.filter(d => d.mu >= 0 && d.mu <= 0.1).slice(0, 3).map(d => d.ticker).join(', ') },
            { label: 'Negative (<0%)', count: data.filter(d => d.mu < 0).length, color: COLORS.red, tickers: data.filter(d => d.mu < 0).slice(0, 3).map(d => d.ticker).join(', ') },
          ].map((tier, i) => (
            <div key={i} style={{
              padding: '12px',
              background: `${tier.color}10`,
              borderRadius: '8px',
              border: `1px solid ${tier.color}20`,
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: tier.color }}>{tier.count}</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{tier.label}</div>
              {tier.tickers && <div style={{ fontSize: '8px', color: tier.color, marginTop: '4px', opacity: 0.8 }}>{tier.tickers || 'None'}</div>}
            </div>
          ))}
        </div>
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// FACTOR ANALYSIS PAGE (Enhanced)
// ============================================

const FactorAnalysisContent = memo(({ factorAnalysis, positions, portfolioValue, pageNum }) => {
  if (!factorAnalysis?.portfolioFactorBetas) return null;
  
  const betas = factorAnalysis.portfolioFactorBetas;
  const positionBetas = factorAnalysis.positionFactorBetas || [];
  const riskDecomp = factorAnalysis.riskDecomposition || {};
  const thematicGroups = factorAnalysis.thematicGroups || [];
  const attribution = factorAnalysis.attribution || {};
  const factorReturns = factorAnalysis.factorReturns || {};
  
  const factors = [
    { key: 'MKT', name: 'Market (β)', desc: 'Equity market exposure', color: COLORS.cyan, icon: '📈' },
    { key: 'SMB', name: 'Size', desc: 'Small vs Large cap', color: COLORS.purple, icon: '📊' },
    { key: 'HML', name: 'Value', desc: 'Value vs Growth', color: COLORS.gold, icon: '💎' },
    { key: 'MOM', name: 'Momentum', desc: 'Winners vs Losers', color: COLORS.green, icon: '🚀' },
  ];
  
  // Generate interpretation
  const getInterpretation = () => {
    const parts = [];
    if (betas.MKT > 1.1) parts.push('Above-market β (more volatile than market)');
    else if (betas.MKT < 0.9) parts.push('Below-market β (defensive posture)');
    else parts.push('Market-neutral β exposure');
    
    if (betas.SMB > 0.15) parts.push('Small-cap tilt');
    else if (betas.SMB < -0.15) parts.push('Large-cap tilt');
    
    if (betas.HML > 0.15) parts.push('Value tilt');
    else if (betas.HML < -0.15) parts.push('Growth tilt');
    
    if (betas.MOM > 0.2) parts.push('Positive momentum exposure');
    else if (betas.MOM < -0.2) parts.push('Contrarian/negative momentum');
    
    return parts.length > 0 ? parts.join(' • ') : 'Factor exposures are close to market-neutral';
  };
  
  const factorPct = ((riskDecomp.factorRisk || 0) * 100).toFixed(0);
  const idioPct = ((riskDecomp.idiosyncraticRisk || 0) * 100).toFixed(0);
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Factor Analysis" />
      
      {/* Portfolio Factor Exposures - Enhanced cards */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
          <span style={{ fontSize: '18px' }}>🧬</span>
          <div>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Portfolio Factor Exposures</div>
            <div style={{ fontSize: '10px', color: '#666' }}>Fama-French factor model (weighted by position value)</div>
          </div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '12px' }}>
          {factors.map((f, i) => {
            const beta = betas[f.key] || 0;
            const barWidth = Math.min(100, Math.abs(beta) * (f.key === 'MKT' ? 50 : 100));
            return (
              <div key={i} style={{
                padding: '12px',
                background: `linear-gradient(135deg, ${f.color}12 0%, ${f.color}05 100%)`,
                borderRadius: '10px',
                border: `1px solid ${f.color}25`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12px' }}>{f.icon}</span>
                  <span style={{ fontSize: '9px', color: '#888' }}>{f.name}</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: '700', color: f.color, marginBottom: '4px' }}>
                  {beta >= 0 ? '+' : ''}{beta.toFixed(2)}
                </div>
                <div style={{ fontSize: '8px', color: '#555', marginBottom: '8px' }}>{f.desc}</div>
                
                {/* Visual bar */}
                <div style={{ height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${barWidth}%`,
                    background: beta >= 0 
                      ? `linear-gradient(90deg, ${COLORS.green}, ${COLORS.green}80)`
                      : `linear-gradient(90deg, ${COLORS.red}80, ${COLORS.red})`,
                    borderRadius: '3px',
                    marginLeft: beta < 0 ? 'auto' : 0,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Interpretation */}
        <div style={{ 
          padding: '10px 12px', 
          background: 'rgba(0, 212, 255, 0.06)', 
          borderRadius: '8px', 
          fontSize: '10px', 
          color: '#aaa',
          border: '1px solid rgba(0, 212, 255, 0.1)',
        }}>
          <span style={{ color: COLORS.cyan, fontWeight: '600' }}>💡 Interpretation: </span>
          {getInterpretation()}
        </div>
      </div>
      
      {/* Risk Decomposition + Return Attribution Row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        {/* Risk Decomposition */}
        <div style={{
          flex: 1,
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '14px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚖️</span> Risk Decomposition
          </div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <div style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(0, 212, 255, 0.08)',
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid rgba(0, 212, 255, 0.15)',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.cyan }}>{factorPct}%</div>
              <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>Factor (Systematic)</div>
            </div>
            <div style={{
              flex: 1,
              padding: '12px',
              background: 'rgba(123, 47, 247, 0.08)',
              borderRadius: '8px',
              textAlign: 'center',
              border: '1px solid rgba(123, 47, 247, 0.15)',
            }}>
              <div style={{ fontSize: '22px', fontWeight: '700', color: COLORS.purple }}>{idioPct}%</div>
              <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>Idiosyncratic</div>
            </div>
          </div>
          
          {/* Stacked bar */}
          <div style={{ height: '16px', background: 'rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden', display: 'flex' }}>
            <div style={{
              width: `${factorPct}%`,
              background: `linear-gradient(90deg, ${COLORS.cyan}, #0099cc)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px',
              fontWeight: '600',
              color: '#fff',
            }}>
              {parseInt(factorPct) > 20 ? 'Factor' : ''}
            </div>
            <div style={{
              width: `${idioPct}%`,
              background: `linear-gradient(90deg, ${COLORS.purple}, #5a1fd6)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '8px',
              fontWeight: '600',
              color: '#fff',
            }}>
              {parseInt(idioPct) > 20 ? 'Stock' : ''}
            </div>
          </div>
          
          <div style={{ fontSize: '8px', color: '#666', marginTop: '8px', textAlign: 'center' }}>
            {(riskDecomp.factorRisk || 0) > 0.7 
              ? '⚠️ High systematic risk from market factors'
              : (riskDecomp.idiosyncraticRisk || 0) > 0.5
              ? '✅ Stock-specific bets drive returns'
              : '📊 Balanced systematic/idiosyncratic mix'}
          </div>
        </div>
        
        {/* Return Attribution */}
        <div style={{
          flex: 1,
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '14px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📊</span> Historical Attribution
          </div>
          
          {factors.map((f, i) => {
            const factorRet = factorReturns[f.key] || 0;
            const beta = betas[f.key] || 0;
            const contrib = attribution[f.key] || 0;
            return (
              <div key={i} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '6px 0',
                borderBottom: i < factors.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <span style={{ fontSize: '10px', color: '#888', width: '60px' }}>{f.name.split(' ')[0]}</span>
                <span style={{ fontSize: '9px', color: '#666', width: '50px', textAlign: 'right' }}>
                  {factorRet >= 0 ? '+' : ''}{(factorRet * 100).toFixed(1)}%
                </span>
                <span style={{ fontSize: '9px', color: '#555', width: '16px', textAlign: 'center' }}>×</span>
                <span style={{ fontSize: '9px', color: f.color, width: '40px', textAlign: 'right' }}>
                  {beta.toFixed(2)}
                </span>
                <span style={{ fontSize: '9px', color: '#555', width: '16px', textAlign: 'center' }}>=</span>
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: '600', 
                  color: contrib >= 0 ? COLORS.green : COLORS.red,
                  width: '50px',
                  textAlign: 'right',
                }}>
                  {contrib >= 0 ? '+' : ''}{(contrib * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
          
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginTop: '8px', 
            paddingTop: '8px',
            borderTop: '2px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{ fontSize: '10px', fontWeight: '600', color: '#fff' }}>Total Factor Attribution</span>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: '700', 
              color: Object.values(attribution).reduce((a, b) => a + b, 0) >= 0 ? COLORS.green : COLORS.red 
            }}>
              {Object.values(attribution).reduce((a, b) => a + b, 0) >= 0 ? '+' : ''}
              {(Object.values(attribution).reduce((a, b) => a + b, 0) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Thematic Concentrations (if any) */}
      {thematicGroups.length > 0 && (
        <div style={{
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '14px',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ fontSize: '16px' }}>🎯</span>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>Thematic Concentrations</div>
            <span style={{ 
              fontSize: '9px', 
              padding: '2px 8px', 
              background: 'rgba(255, 159, 67, 0.15)',
              border: '1px solid rgba(255, 159, 67, 0.25)',
              borderRadius: '10px',
              color: COLORS.orange,
            }}>
              {thematicGroups.length} detected
            </span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
            {thematicGroups.slice(0, 4).map((group, i) => {
              const severity = group.totalWeight > 0.25 ? 'high' : group.totalWeight > 0.15 ? 'medium' : 'low';
              const config = {
                high: { color: COLORS.red, icon: '🔴' },
                medium: { color: COLORS.orange, icon: '🟠' },
                low: { color: COLORS.cyan, icon: '🟡' },
              }[severity];
              
              return (
                <div key={i} style={{
                  padding: '10px',
                  background: `${config.color}08`,
                  borderRadius: '8px',
                  border: `1px solid ${config.color}20`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px' }}>{config.icon}</span>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: '#fff' }}>{group.name}</span>
                      <span style={{ fontSize: '8px', color: '#555' }}>({group.etf})</span>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: config.color }}>
                      {(group.totalWeight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(group.totalWeight * 100, 100)}%`,
                      height: '100%',
                      background: config.color,
                      borderRadius: '2px',
                    }} />
                  </div>
                  <div style={{ fontSize: '8px', color: '#666', marginTop: '6px' }}>
                    📉 If {group.etf} drops 20% → ~{(group.avgBeta * group.totalWeight * 0.20 * 100).toFixed(1)}% portfolio impact
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Position Factor Betas Table */}
      {positionBetas.length > 0 && (
        <div style={{
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px' }}>📋</span>
            <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff' }}>Position Factor Loadings</div>
          </div>
          
          {/* Table Header */}
          <div style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid #2a2a3a', marginBottom: '4px' }}>
            <div style={{ width: '60px', fontSize: '8px', fontWeight: '600', color: '#666' }}>Ticker</div>
            {factors.map((f, i) => (
              <div key={i} style={{ flex: 1, fontSize: '8px', fontWeight: '600', color: f.color, textAlign: 'center' }}>
                {f.name.split(' ')[0]}
              </div>
            ))}
          </div>
          
          {/* Table Rows - more compact */}
          {positionBetas.slice(0, thematicGroups.length > 0 ? 10 : 16).map((pb, i) => (
            <div key={i} style={{
              display: 'flex',
              padding: '4px 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              background: i % 2 === 1 ? 'rgba(0,0,0,0.1)' : 'transparent',
            }}>
              <div style={{ width: '60px', fontSize: '9px', fontWeight: '600', color: COLORS.cyan }}>{pb.ticker}</div>
              {factors.map((f, j) => {
                const val = pb[f.key] || 0;
                return (
                  <div key={j} style={{
                    flex: 1,
                    fontSize: '9px',
                    fontWeight: '600',
                    color: Math.abs(val) > 0.5 ? f.color : '#888',
                    textAlign: 'center',
                  }}>
                    {val >= 0 ? '+' : ''}{val.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
          
          {positionBetas.length > (thematicGroups.length > 0 ? 10 : 16) && (
            <div style={{ fontSize: '8px', color: '#555', textAlign: 'center', padding: '6px 0' }}>
              ... and {positionBetas.length - (thematicGroups.length > 0 ? 10 : 16)} more positions
            </div>
          )}
        </div>
      )}
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// OPTIMIZATION RESULTS PAGE (with swap matrix & full-width risk chart)
// ============================================

const OptimizationResultsContent = memo(({ optimizationResults, simulationResults, analyticalSwapMatrix, pageNum }) => {
  const c = optimizationResults?.current;
  const mc = c?.mcResults;
  const topSwaps = optimizationResults?.topSwaps || [];
  const positions = optimizationResults?.positions || [];
  
  if (!c) return null;
  
  // Colors for risk contribution
  const barColors = [COLORS.cyan, COLORS.green, COLORS.orange, COLORS.red, COLORS.purple, COLORS.blue, COLORS.teal, COLORS.gold];
  
  // Sort positions by risk contribution for display
  const sortedPositions = [...positions].sort((a, b) => (b.riskContribution || 0) - (a.riskContribution || 0));
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Portfolio Optimization" />
      
      {/* Portfolio Metrics Card */}
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
        marginBottom: '14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>📊</span>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Current Portfolio Metrics</div>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
          {[
            { label: 'Exp Return', value: formatPct(c.portfolioReturn, 1, true), sub: 'annualized μ', color: (c.portfolioReturn || 0) >= 0 ? COLORS.green : COLORS.red },
            { label: 'Volatility', value: formatPct(c.portfolioVol), sub: 'annualized σ', color: COLORS.orange },
            { label: 'Sharpe', value: (c.sharpe || 0).toFixed(3), sub: '(μ - Rf) / σ', color: COLORS.cyan },
            { label: 'P(Loss)', value: formatPct(mc?.pLoss || simulationResults?.probLoss?.probBreakeven), sub: 'MC simulated', color: COLORS.red },
            { label: 'VaR 5%', value: formatPct(mc?.var5), sub: 'worst 5%', color: COLORS.red },
            { label: 'CVaR 5%', value: mc?.cvar5 ? formatPct(mc.cvar5) : '—', sub: 'exp shortfall', color: COLORS.red },
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '10px 8px',
              background: `${stat.color}10`,
              borderRadius: '8px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: '8px', color: '#888', marginTop: '3px' }}>{stat.label}</div>
              <div style={{ fontSize: '7px', color: '#555', marginTop: '1px' }}>{stat.sub}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Best Swap Hero */}
      {topSwaps.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.12) 0%, rgba(0, 212, 255, 0.08) 100%)',
          borderRadius: '12px',
          border: '1px solid rgba(46, 204, 113, 0.25)',
          padding: '16px',
          marginBottom: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px', height: '48px', borderRadius: '10px',
              background: 'rgba(46, 204, 113, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '24px',
            }}>
              🏆
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', fontWeight: '600', color: COLORS.green, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                #1 Best Trade
              </div>
              <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600', marginTop: '4px' }}>
                Sell <span style={{ color: COLORS.red }}>{topSwaps[0].sellTicker}</span>
                <span style={{ color: '#555', margin: '0 8px' }}>→</span>
                Buy <span style={{ color: COLORS.green }}>{topSwaps[0].buyTicker}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.green }}>
                +{((topSwaps[0].deltaMetrics?.deltaMCSharpe || 0) * 100).toFixed(2)}%
              </div>
              <div style={{ fontSize: '9px', color: '#888' }}>ΔSharpe (MC)</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Top Swaps Grid */}
      {topSwaps.length > 1 && (
        <div style={{
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '14px',
          marginBottom: '14px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px' }}>Top Swap Recommendations</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {topSwaps.slice(1, 9).map((swap, i) => {
              const delta = (swap.deltaMetrics?.deltaMCSharpe || 0) * 100;
              const isGood = delta > 0;
              return (
                <div key={i} style={{
                  padding: '10px',
                  background: isGood ? 'rgba(46, 204, 113, 0.08)' : 'rgba(231, 76, 60, 0.08)',
                  borderRadius: '8px',
                  border: `1px solid ${isGood ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)'}`,
                }}>
                  <div style={{ fontSize: '9px', color: isGood ? COLORS.green : COLORS.red, fontWeight: '600', marginBottom: '4px' }}>
                    #{i + 2}
                  </div>
                  <div style={{ fontSize: '10px', color: '#fff', marginBottom: '6px' }}>
                    <span style={{ color: COLORS.red }}>{swap.sellTicker}</span>
                    <span style={{ color: '#555' }}> → </span>
                    <span style={{ color: COLORS.green }}>{swap.buyTicker}</span>
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: isGood ? COLORS.green : COLORS.red }}>
                    {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Risk Contribution - Full Width */}
      {sortedPositions.length > 0 && (
        <div style={{
          background: 'rgba(22, 27, 44, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '14px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: '600', color: '#fff', marginBottom: '10px' }}>Risk Contribution by Position</div>
          
          {/* Full-width stacked bar */}
          <div style={{ display: 'flex', height: '28px', borderRadius: '6px', overflow: 'hidden', marginBottom: '10px' }}>
            {sortedPositions.filter(p => (p.riskContribution || 0) > 0.001).map((pos, i) => {
              const pct = (pos.riskContribution || 0) * 100;
              return (
                <div
                  key={i}
                  style={{
                    width: `${pct}%`,
                    height: '100%',
                    background: barColors[i % barColors.length],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    fontWeight: 'bold',
                    color: '#fff',
                    minWidth: pct > 5 ? '20px' : '0',
                    overflow: 'hidden',
                  }}
                  title={`${pos.ticker}: ${pct.toFixed(1)}%`}
                >
                  {pct > 6 ? pos.ticker : ''}
                </div>
              );
            })}
          </div>
          
          {/* Legend - wrap to multiple rows */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {sortedPositions.filter(p => (p.riskContribution || 0) > 0.001).map((pos, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: barColors[i % barColors.length] }} />
                <span style={{ fontSize: '8px', color: '#888' }}>{pos.ticker}</span>
                <span style={{ fontSize: '8px', color: '#555' }}>{((pos.riskContribution || 0) * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// Swap Matrix Heatmap Page
const SwapMatrixContent = memo(({ optimizationResults, analyticalSwapMatrix, pageNum }) => {
  if (!analyticalSwapMatrix || !analyticalSwapMatrix.matrix) return null;
  
  const { tickers, matrix } = analyticalSwapMatrix;
  const n = tickers.length;
  
  if (n < 2) return null;
  
  // Scale cell size
  const cellSize = Math.max(14, Math.min(28, Math.floor(650 / (n + 1))));
  
  // Find max absolute value for color scaling
  let maxAbs = 0;
  matrix.forEach(row => {
    row.forEach(val => {
      if (val != null && isFinite(val)) maxAbs = Math.max(maxAbs, Math.abs(val));
    });
  });
  maxAbs = maxAbs || 0.01;
  
  const getColor = (val) => {
    if (val == null || !isFinite(val)) return '#1a2235';
    const intensity = Math.min(1, Math.abs(val) / maxAbs);
    if (val > 0) {
      // Green for positive
      const g = Math.floor(100 + intensity * 155);
      return `rgb(${Math.floor(46 * intensity)}, ${g}, ${Math.floor(80 * intensity)})`;
    } else {
      // Red for negative
      const r = Math.floor(100 + intensity * 155);
      return `rgb(${r}, ${Math.floor(60 * intensity)}, ${Math.floor(60 * intensity)})`;
    }
  };
  
  return (
    <div style={{
      width: '800px',
      height: '1130px',
      background: '#0c0e18',
      padding: '40px',
      fontFamily: FONT_FAMILY,
      color: '#e8e8ec',
      position: 'relative',
    }}>
      <PageHeader subtitle="Swap Matrix Heatmap" />
      
      <div style={{
        background: 'rgba(22, 27, 44, 0.8)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <span style={{ fontSize: '16px' }}>🔄</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Sharpe Improvement Matrix</div>
            <div style={{ fontSize: '10px', color: '#666' }}>Rows = Sell, Columns = Buy • Green = Improve, Red = Worsen</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'inline-block' }}>
            {/* Column headers - "Buy" */}
            <div style={{ display: 'flex', marginLeft: `${cellSize + 4}px` }}>
              {tickers.map((t, i) => (
                <div key={i} style={{
                  width: `${cellSize}px`,
                  height: '20px',
                  fontSize: Math.min(7, cellSize / 4),
                  fontWeight: '600',
                  color: COLORS.green,
                  textAlign: 'center',
                  overflow: 'hidden',
                  writingMode: n > 12 ? 'vertical-rl' : 'horizontal-tb',
                  transform: n > 12 ? 'rotate(180deg)' : 'none',
                }}>
                  {t.substring(0, 4)}
                </div>
              ))}
            </div>
            
            {/* Rows - "Sell" */}
            {tickers.map((sellTicker, row) => (
              <div key={row} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: `${cellSize}px`,
                  fontSize: Math.min(7, cellSize / 4),
                  fontWeight: '600',
                  color: COLORS.red,
                  textAlign: 'right',
                  paddingRight: '4px',
                }}>
                  {sellTicker.substring(0, 4)}
                </div>
                
                {matrix[row].map((val, col) => (
                  <div key={col} style={{
                    width: `${cellSize - 2}px`,
                    height: `${cellSize - 2}px`,
                    margin: '1px',
                    background: row === col ? '#1a2235' : getColor(val),
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: Math.min(6, cellSize / 5),
                    fontWeight: '600',
                    color: row === col ? '#444' : (Math.abs(val || 0) > maxAbs * 0.3 ? '#fff' : '#aaa'),
                  }}>
                    {cellSize >= 20 && row !== col ? (val ? `${(val * 100).toFixed(0)}` : '') : ''}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', marginTop: '14px' }}>
          <span style={{ fontSize: '8px', color: COLORS.red, marginRight: '4px' }}>Worsen</span>
          {[0.9, 0.6, 0.3, 0, -0.3, -0.6, -0.9].map((v, i) => (
            <div key={i} style={{ 
              width: '20px', 
              height: '12px', 
              background: v === 0 ? '#1a2235' : getColor(v * maxAbs), 
              borderRadius: '2px' 
            }} />
          ))}
          <span style={{ fontSize: '8px', color: COLORS.green, marginLeft: '4px' }}>Improve</span>
        </div>
      </div>
      
      <PageFooter pageNum={pageNum} />
    </div>
  );
});

// ============================================
// UI COMPONENTS
// ============================================

const Card = memo(({ children, style = {}, gradient = false, noPadding = false }) => (
  <div style={{
    background: gradient 
      ? 'linear-gradient(135deg, rgba(22, 27, 44, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)'
      : 'rgba(22, 27, 44, 0.7)',
    borderRadius: '14px',
    border: gradient ? '1px solid rgba(0, 212, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.06)',
    padding: noPadding ? 0 : '20px',
    marginBottom: '16px',
    fontFamily: FONT_FAMILY,
    ...style,
  }}>
    {children}
  </div>
));

const CardTitle = memo(({ icon, children, badge, subtitle }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: '600', color: '#fff' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        {children}
      </div>
      {badge}
    </div>
    {subtitle && <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', marginLeft: '28px' }}>{subtitle}</div>}
  </div>
));

const StatusPill = memo(({ active, label, color = COLORS.green }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px',
    fontSize: '10px', fontWeight: '500',
    background: active ? `${color}15` : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
    color: active ? color : '#555',
  }}>
    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: active ? color : '#444' }} />
    {label}
  </div>
));

// ============================================
// MAIN EXPORT COMPONENT
// ============================================

const ExportTab = memo(({
  positions, portfolioValue, numPaths, correlationMethod, useEwma, gldAsCash, fatTailMethod, useQmc,
  editedCorrelation, simulationResults, getDistributionParams, showToast, styles,
  factorAnalysis, optimizationResults, positionMetadata, positionBetas, contributionChartMemo,
  analyticalSwapMatrix,
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [progress, setProgress] = useState('');
  
  const hasPositions = positions.length > 0;
  const hasCorrelation = editedCorrelation && editedCorrelation.length > 0;
  const hasSimulation = simulationResults && !simulationResults.error;
  const hasFactors = factorAnalysis && factorAnalysis.portfolioFactorBetas;
  const hasOptimization = optimizationResults && optimizationResults.current;
  const hasContributions = simulationResults?.contributions;
  const hasSwapMatrix = analyticalSwapMatrix && analyticalSwapMatrix.matrix;
  
  const pageCount = useMemo(() => {
    let count = 3; // Cover + Positions + Exposure
    if (hasSimulation) count += 2; // Simulation + Key Takeaways
    if (hasContributions) count++; // Contributions
    if (hasCorrelation) count += 3; // Correlation + Volatility + Expected Returns
    if (hasFactors) count++; // Factors
    if (hasOptimization) count++; // Optimization
    if (hasSwapMatrix && positions.length <= 25) count++; // Swap Matrix (only if not too big)
    return count;
  }, [hasSimulation, hasContributions, hasCorrelation, hasFactors, hasOptimization, hasSwapMatrix, positions.length]);
  
  const generatePDF = useCallback(async () => {
    setIsGeneratingPDF(true);
    setProgress('Loading libraries...');
    
    try {
      const [html2canvasModule, jsPDFModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const html2canvas = html2canvasModule.default;
      const { jsPDF } = jsPDFModule;
      
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = 210;
      const pageHeight = 297;
      
      const renderPageToPDF = async (Component, props, isFirstPage = false) => {
        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        document.body.appendChild(container);
        
        const root = createRoot(container);
        root.render(<Component {...props} />);
        
        await new Promise(resolve => setTimeout(resolve, 150));
        
        const canvas = await html2canvas(container.firstChild, {
          scale: 2.75, // Higher scale for crisp text
          useCORS: true,
          backgroundColor: '#0c0e18',
          logging: false,
        });
        
        if (!isFirstPage) pdf.addPage();
        
        // Use JPEG with 0.96 quality for excellent clarity
        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
        
        root.unmount();
        document.body.removeChild(container);
      };
      
      let currentPage = 1;
      const tickers = positions.map(p => p.ticker).filter(Boolean);
      
      // Page 1: Cover
      setProgress(`Rendering page ${currentPage}/${pageCount}...`);
      await renderPageToPDF(CoverPageContent, {
        portfolioValue, positions, simulationResults, numPaths, correlationMethod, fatTailMethod, useQmc,
      }, true);
      currentPage++;
      
      // Page 2: Positions
      setProgress(`Rendering page ${currentPage}/${pageCount}...`);
      await renderPageToPDF(PositionsTableContent, {
        positions, portfolioValue, positionMetadata, positionBetas, getDistributionParams, pageNum: currentPage,
      });
      currentPage++;
      
      // Page 3: Exposure
      setProgress(`Rendering page ${currentPage}/${pageCount}...`);
      await renderPageToPDF(ExposureAnalysisContent, {
        positions, portfolioValue, pageNum: currentPage,
      });
      currentPage++;
      
      // Simulation Results
      if (hasSimulation) {
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(SimulationResultsContent, {
          simulationResults, portfolioValue, numPaths, fatTailMethod, useQmc, pageNum: currentPage,
        });
        currentPage++;
        
        // Key Takeaways
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(KeyTakeawaysContent, {
          simulationResults, portfolioValue, positions, positionMetadata, pageNum: currentPage,
        });
        currentPage++;
      }
      
      // Contribution Analysis
      if (hasContributions) {
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(ContributionAnalysisContent, {
          simulationResults, pageNum: currentPage,
        });
        currentPage++;
      }
      
      // Correlation Matrix
      if (hasCorrelation) {
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(CorrelationMatrixContent, {
          tickers, editedCorrelation, correlationMethod, useEwma, pageNum: currentPage,
        });
        currentPage++;
        
        // Volatility Analysis
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(VolatilityAnalysisContent, {
          positions, getDistributionParams, pageNum: currentPage,
        });
        currentPage++;
        
        // Expected Returns by Security
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(ExpectedReturnsContent, {
          positions, getDistributionParams, positionBetas, pageNum: currentPage,
        });
        currentPage++;
      }
      
      // Factor Analysis
      if (hasFactors) {
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(FactorAnalysisContent, {
          factorAnalysis, positions, portfolioValue, pageNum: currentPage,
        });
        currentPage++;
      }
      
      // Optimization
      if (hasOptimization) {
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(OptimizationResultsContent, {
          optimizationResults, simulationResults, analyticalSwapMatrix, pageNum: currentPage,
        });
        currentPage++;
      }
      
      // Swap Matrix (only if reasonable size)
      if (hasSwapMatrix && positions.length <= 25) {
        setProgress(`Rendering page ${currentPage}/${pageCount}...`);
        await renderPageToPDF(SwapMatrixContent, {
          optimizationResults, analyticalSwapMatrix, pageNum: currentPage,
        });
        currentPage++;
      }
      
      setProgress('Saving PDF...');
      pdf.save('monte-carlo-portfolio-report.pdf');
      
      showToast({
        type: 'success',
        title: 'PDF Generated',
        message: `${pageCount}-page comprehensive report saved`,
        duration: 4000,
      });
      
    } catch (error) {
      console.error('PDF Generation Error:', error);
      showToast({
        type: 'error',
        title: 'PDF Generation Failed',
        message: error.message || 'Unknown error occurred',
        duration: 5000,
      });
    } finally {
      setIsGeneratingPDF(false);
      setProgress('');
    }
  }, [
    positions, portfolioValue, numPaths, correlationMethod, fatTailMethod, useQmc, useEwma,
    editedCorrelation, simulationResults, factorAnalysis, optimizationResults, analyticalSwapMatrix,
    positionMetadata, positionBetas, getDistributionParams, showToast, pageCount,
    hasSimulation, hasContributions, hasCorrelation, hasFactors, hasOptimization, hasSwapMatrix,
  ]);
  
  const handleJSONDownload = useCallback(() => {
    const jsonData = {
      title: 'Monte Carlo Portfolio Analysis',
      date: new Date().toISOString(),
      portfolioValue,
      positions: positions.map(p => ({
        ticker: p.ticker, quantity: p.quantity, price: p.price, value: p.quantity * p.price,
      })),
      simulationResults: simulationResults ? {
        terminal: simulationResults.terminal,
        drawdown: simulationResults.drawdown,
        probLoss: simulationResults.probLoss,
      } : null,
    };
    
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portfolio-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast({ type: 'success', title: 'JSON Downloaded', duration: 2500 });
  }, [positions, portfolioValue, simulationResults, showToast]);
  
  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      <Card gradient noPadding>
        <div style={{
          background: 'linear-gradient(90deg, rgba(231, 76, 60, 0.12) 0%, rgba(155, 89, 182, 0.08) 100%)',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(231, 76, 60, 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>📄</span>
              Export Professional Report
              <span style={{ fontSize: '9px', padding: '3px 8px', background: 'rgba(46, 204, 113, 0.2)', borderRadius: '10px', color: COLORS.green, fontWeight: '600' }}>
                v6.0
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
              Comprehensive {pageCount}-page PDF with charts, histograms & heatmaps
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={generatePDF}
              disabled={!hasSimulation || isGeneratingPDF}
              style={{
                padding: '10px 20px',
                fontSize: '12px',
                fontWeight: '600',
                borderRadius: '8px',
                border: 'none',
                background: isGeneratingPDF ? '#444' : hasSimulation ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : '#2a2a3a',
                color: '#fff',
                cursor: !hasSimulation || isGeneratingPDF ? 'not-allowed' : 'pointer',
                opacity: !hasSimulation ? 0.5 : 1,
                boxShadow: hasSimulation && !isGeneratingPDF ? '0 4px 15px rgba(231, 76, 60, 0.25)' : 'none',
                fontFamily: FONT_FAMILY,
                minWidth: '160px',
              }}
            >
              {isGeneratingPDF ? (progress || 'Generating...') : 'Generate PDF'}
            </button>
            
            <button
              onClick={handleJSONDownload}
              disabled={!hasPositions}
              style={{
                padding: '10px 16px',
                fontSize: '12px',
                fontWeight: '500',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: hasPositions ? '#888' : '#444',
                cursor: hasPositions ? 'pointer' : 'not-allowed',
                fontFamily: FONT_FAMILY,
              }}
            >
              JSON
            </button>
          </div>
        </div>
        
        <div style={{ padding: '12px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusPill active={hasPositions} label={`Positions (${positions.length})`} color={COLORS.cyan} />
          <StatusPill active={hasCorrelation} label="Correlation" color={COLORS.purple} />
          <StatusPill active={hasSimulation} label="Simulation" color={COLORS.green} />
          <StatusPill active={hasFactors} label="Factors" color={COLORS.orange} />
          <StatusPill active={hasOptimization} label="Optimization" color={COLORS.blue} />
          
          {!hasSimulation && (
            <span style={{ fontSize: '10px', color: COLORS.orange, marginLeft: 'auto' }}>
              Run simulation to enable PDF export
            </span>
          )}
        </div>
      </Card>
      
      <Card>
        <CardTitle icon="✨" subtitle="html2canvas + jsPDF with enhanced visualizations">
          PDF Features (v6.0)
        </CardTitle>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {[
            { icon: '📊', title: 'Histogram Charts', desc: 'Returns, drawdown, terminal value' },
            { icon: '🔗', title: 'Correlation Heatmap', desc: 'Full matrix with diverging colors' },
            { icon: '🔄', title: 'Swap Matrix', desc: 'N×N Sharpe improvement grid' },
            { icon: '📈', title: 'Risk Metrics', desc: 'Beta, vol, VaR, CVaR, factors' },
          ].map((feature, i) => (
            <div key={i} style={{
              padding: '14px',
              background: 'rgba(0, 212, 255, 0.05)',
              borderRadius: '10px',
              border: '1px solid rgba(0, 212, 255, 0.1)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{feature.icon}</div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>{feature.title}</div>
              <div style={{ fontSize: '9px', color: '#666' }}>{feature.desc}</div>
            </div>
          ))}
        </div>
      </Card>
      
      {hasSimulation && (
        <Card>
          <CardTitle icon="📊" subtitle="Key metrics that will appear in your report">Export Preview</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
            {[
              { label: 'Portfolio', value: formatCurrency(portfolioValue), color: COLORS.cyan },
              { label: 'P5 Return', value: formatPct(simulationResults.terminal?.p5), color: COLORS.red },
              { label: 'Median', value: formatPct(simulationResults.terminal?.p50, 1, true), color: '#fff' },
              { label: 'P95 Return', value: formatPct(simulationResults.terminal?.p95, 1, true), color: COLORS.green },
              { label: 'P(Loss)', value: formatPct(simulationResults.probLoss?.probBreakeven), color: COLORS.orange },
            ].map((stat, i) => (
              <div key={i} style={{
                padding: '14px 12px',
                background: `${stat.color}08`,
                borderRadius: '10px',
                border: `1px solid ${stat.color}20`,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '18px', fontWeight: '700', color: stat.color, marginBottom: '4px' }}>{stat.value}</div>
                <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
      
      <Card>
        <CardTitle 
          icon="📋" 
          subtitle="High-fidelity capture with histograms & heatmaps"
          badge={<span style={{ fontSize: '10px', padding: '4px 10px', background: 'rgba(231, 76, 60, 0.15)', borderRadius: '20px', color: COLORS.red }}>{pageCount} pages</span>}
        >
          Report Contents
        </CardTitle>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {[
            { num: 1, title: 'Cover & Summary', desc: 'Key results, config, distribution preview', color: COLORS.cyan, always: true },
            { num: 2, title: 'Holdings Table', desc: 'β, σ, YTD, 1Y, portfolio metrics', color: COLORS.green, always: true },
            { num: 3, title: 'Exposure Analysis', desc: 'Long/short breakdown, net exposure', color: COLORS.blue, always: true },
            { num: 4, title: 'Simulation Results', desc: 'Histograms, pipeline, risk metrics', color: COLORS.orange, active: hasSimulation },
            { num: 5, title: 'Contributions', desc: 'Position P&L with P5-P95 range', color: COLORS.purple, active: hasContributions },
            { num: 6, title: 'Correlation Matrix', desc: 'Heatmap with diverging colors', color: COLORS.red, active: hasCorrelation },
            { num: 7, title: 'Volatility Analysis', desc: 'Ranked vol bars by position', color: COLORS.orange, active: hasCorrelation },
            { num: 8, title: 'Factor Analysis', desc: 'MKT, SMB, HML, MOM loadings', color: COLORS.gold, active: hasFactors },
            { num: 9, title: 'Optimization', desc: 'Swaps, full-width risk chart', color: COLORS.cyan, active: hasOptimization },
            { num: 10, title: 'Swap Matrix', desc: 'N×N Sharpe heatmap', color: COLORS.purple, active: hasSwapMatrix && positions.length <= 25 },
          ].filter(p => p.always || p.active).map((page, i) => (
            <div key={page.num} style={{
              padding: '12px',
              background: `${page.color}08`,
              borderRadius: '10px',
              border: `1px solid ${page.color}25`,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '6px',
                background: `${page.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700', color: page.color, flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: page.color }}>{page.title}</div>
                <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>{page.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
});

export default ExportTab;
