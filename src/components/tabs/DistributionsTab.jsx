/**
 * DistributionsTab - Return Distributions Configuration
 *
 * @module components/tabs/DistributionsTab
 * @description Allows users to set expected return distributions for each position.
 * Features percentile sliders, distribution preview charts, and batch operations.
 */

import React, { useMemo, memo, useCallback, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

// Monospace font stack
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// Return level presets (affects P50 / expected return)
const RETURN_PRESETS = {
  low: { p50: 0.04, label: 'Low', color: '#ff9f43' },
  medium: { p50: 0.08, label: 'Med', color: '#ffffff' },
  high: { p50: 0.15, label: 'High', color: '#2ecc71' },
};

// Range presets (affects spread around P50)
const RANGE_PRESETS = {
  narrow: { spread: 0.20, label: 'Narrow', color: '#3498db' },  // P5 to P95 spread multiplier
  medium: { spread: 0.35, label: 'Med', color: '#9b59b6' },
  wide: { spread: 0.55, label: 'Wide', color: '#e74c3c' },
};

// Helper to compute percentiles from P50 and spread
const computePercentilesFromSpread = (p50, spreadMultiplier) => {
  // Spread multiplier determines the distance from p50 to p5/p95
  const halfSpread = spreadMultiplier;
  return {
    p5: p50 - halfSpread * 1.2,  // P5 is further below
    p25: p50 - halfSpread * 0.4,
    p50,
    p75: p50 + halfSpread * 0.5,
    p95: p50 + halfSpread * 1.0,
  };
};

/**
 * Portfolio Summary Card - Shows weighted average distribution metrics
 */
const PortfolioSummaryCard = memo(({ positions, portfolioValue, getDistributionParams, styles }) => {
  const summary = useMemo(() => {
    if (!positions || positions.length === 0 || !portfolioValue) {
      return { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0, avgVol: 0 };
    }

    let weightedP5 = 0, weightedP25 = 0, weightedP50 = 0, weightedP75 = 0, weightedP95 = 0;
    let totalWeight = 0;
    let weightedVol = 0;

    positions.forEach(pos => {
      const value = (pos.quantity || 0) * (pos.price || 0);
      const weight = Math.abs(value) / Math.abs(portfolioValue);
      if (weight > 0) {
        const { mu, sigma } = getDistributionParams(pos);
        const p5 = pos.p5 ?? (mu - 1.645 * sigma);
        const p25 = pos.p25 ?? (mu - 0.675 * sigma);
        const p50 = pos.p50 ?? mu;
        const p75 = pos.p75 ?? (mu + 0.675 * sigma);
        const p95 = pos.p95 ?? (mu + 1.645 * sigma);

        weightedP5 += p5 * weight;
        weightedP25 += p25 * weight;
        weightedP50 += p50 * weight;
        weightedP75 += p75 * weight;
        weightedP95 += p95 * weight;
        weightedVol += sigma * weight;
        totalWeight += weight;
      }
    });

    return {
      p5: totalWeight > 0 ? weightedP5 / totalWeight : 0,
      p25: totalWeight > 0 ? weightedP25 / totalWeight : 0,
      p50: totalWeight > 0 ? weightedP50 / totalWeight : 0,
      p75: totalWeight > 0 ? weightedP75 / totalWeight : 0,
      p95: totalWeight > 0 ? weightedP95 / totalWeight : 0,
      avgVol: totalWeight > 0 ? weightedVol / totalWeight : 0,
    };
  }, [positions, portfolioValue, getDistributionParams]);

  const formatPct = (v) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

  return (
    <div style={{
      ...styles.card,
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.05) 100%)',
      border: '1px solid rgba(0, 212, 255, 0.2)',
      marginBottom: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={styles.cardTitle}>
          <span>🎯</span> Portfolio Distribution Summary
        </div>
        <div style={{ fontSize: '11px', color: '#888' }}>
          Weighted by position value • {positions.length} positions
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
        {[
          { label: 'P5 (Bad)', value: summary.p5, color: '#e74c3c' },
          { label: 'P25', value: summary.p25, color: '#ff9f43' },
          { label: 'P50 (Median)', value: summary.p50, color: '#fff' },
          { label: 'P75', value: summary.p75, color: '#3498db' },
          { label: 'P95 (Great)', value: summary.p95, color: '#2ecc71' },
          { label: 'Avg Vol (σ)', value: summary.avgVol, color: '#00d4ff' },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: '18px',
              fontWeight: '700',
              color: stat.color,
              fontFamily: FONT_FAMILY,
            }}>
              {formatPct(stat.value)}
            </div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * Quick Preset Buttons for a single position (2D: Return Level + Range)
 */
const PresetButtons = memo(({ posId, updatePosition, currentP50, currentP5, currentP95 }) => {
  // Determine which presets are currently active
  const getActiveReturn = () => {
    const tolerance = 0.02;
    for (const [name, p] of Object.entries(RETURN_PRESETS)) {
      if (Math.abs(currentP50 - p.p50) < tolerance) return name;
    }
    return null;
  };

  const getActiveRange = () => {
    if (currentP50 === undefined || currentP5 === undefined || currentP95 === undefined) return null;
    const spread = ((currentP95 - currentP50) + (currentP50 - currentP5)) / 2;
    const tolerance = 0.08;
    for (const [name, r] of Object.entries(RANGE_PRESETS)) {
      if (Math.abs(spread - r.spread) < tolerance) return name;
    }
    return null;
  };

  const activeReturn = getActiveReturn();
  const activeRange = getActiveRange();

  const applyPreset = useCallback((returnLevel, rangeLevel) => {
    const ret = RETURN_PRESETS[returnLevel] || RETURN_PRESETS.medium;
    const range = RANGE_PRESETS[rangeLevel] || RANGE_PRESETS.medium;
    const percentiles = computePercentilesFromSpread(ret.p50, range.spread);

    updatePosition(posId, 'p5', percentiles.p5);
    updatePosition(posId, 'p25', percentiles.p25);
    updatePosition(posId, 'p50', percentiles.p50);
    updatePosition(posId, 'p75', percentiles.p75);
    updatePosition(posId, 'p95', percentiles.p95);
  }, [posId, updatePosition]);

  const buttonStyle = (isActive, color) => ({
    padding: '3px 6px',
    fontSize: '9px',
    borderRadius: '4px',
    border: isActive ? `1px solid ${color}` : '1px solid #333',
    background: isActive ? `${color}22` : 'rgba(255, 255, 255, 0.03)',
    color: isActive ? color : '#777',
    cursor: 'pointer',
    fontFamily: FONT_FAMILY,
    transition: 'all 0.15s ease',
    minWidth: '32px',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {/* Return Level Row */}
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        <span style={{ fontSize: '8px', color: '#555', width: '38px' }}>Return:</span>
        {Object.entries(RETURN_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            style={buttonStyle(activeReturn === key, preset.color)}
            onClick={() => applyPreset(key, activeRange || 'medium')}
            title={`P50: ${(preset.p50 * 100).toFixed(0)}%`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      {/* Range Row */}
      <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
        <span style={{ fontSize: '8px', color: '#555', width: '38px' }}>Range:</span>
        {Object.entries(RANGE_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            style={buttonStyle(activeRange === key, preset.color)}
            onClick={() => applyPreset(activeReturn || 'medium', key)}
            title={`Spread: ±${(preset.spread * 100).toFixed(0)}%`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
});

/**
 * Percentile Editor Component
 */
const PercentileEditor = memo(({
  value,
  onChange,
  color,
  label,
  min,
  max,
  constraintMin,
  constraintMax,
  sliderMin,
  sliderMax,
  sliderStyle,
}) => {
  const [localValue, setLocalValue] = useState(null);
  const displayValue = localValue !== null ? localValue : (value * 100).toFixed(1);

  const handleInputChange = (e) => {
    setLocalValue(e.target.value);
  };

  const handleInputBlur = () => {
    const parsed = parseFloat(localValue) / 100;
    if (!isNaN(parsed)) {
      const clamped = Math.max(constraintMin, Math.min(constraintMax, parsed));
      onChange(clamped);
    }
    setLocalValue(null);
  };

  const handleSliderChange = (e) => {
    const newVal = parseFloat(e.target.value) / 100;
    const clamped = Math.max(constraintMin, Math.min(constraintMax, newVal));
    onChange(clamped);
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>{label}</div>
      <input
        type="text"
        value={localValue !== null ? localValue : `${(value * 100).toFixed(1)}%`}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onFocus={(e) => {
          setLocalValue((value * 100).toFixed(1));
          e.target.select();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.target.blur();
        }}
        style={{
          width: '70px',
          padding: '6px 8px',
          fontSize: '14px',
          fontWeight: '600',
          color,
          background: 'rgba(0, 0, 0, 0.3)',
          border: `1px solid ${color}40`,
          borderRadius: '6px',
          textAlign: 'center',
          fontFamily: FONT_FAMILY,
        }}
      />
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        value={Math.round(value * 100)}
        onChange={handleSliderChange}
        style={{
          ...sliderStyle,
          width: '100%',
          marginTop: '8px',
          accentColor: color,
        }}
      />
    </div>
  );
});

/**
 * Position Distribution Card
 */
const PositionDistributionCard = memo(({
  pos,
  updatePosition,
  getDistributionParams,
  estimateDistributionFromHistory,
  calendarYearReturns,
  generateDistributionPreview,
  styles,
}) => {
  const { mu, sigma, skew, tailDf } = getDistributionParams(pos);
  const p5 = pos.p5 ?? (mu - 1.645 * sigma);
  const p25 = pos.p25 ?? (mu - 0.675 * sigma);
  const p50 = pos.p50 ?? mu;
  const p75 = pos.p75 ?? (mu + 0.675 * sigma);
  const p95 = pos.p95 ?? (mu + 1.645 * sigma);

  const ticker = pos.ticker?.toUpperCase();
  const yearReturns = ticker ? (calendarYearReturns[ticker] || {}) : {};
  const years = [2026, 2025, 2024, 2023];
  const hasAnyData = years.some(y => yearReturns[y] !== undefined);

  return (
    <div style={{
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '10px',
      marginBottom: '16px',
      overflow: 'hidden',
      background: 'rgba(10, 10, 21, 0.5)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.1) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <strong style={{ fontSize: '20px', color: '#00d4ff' }}>{pos.ticker || '—'}</strong>
          <span style={{ fontSize: '11px', color: '#666' }}>
            μ={((mu || 0) * 100).toFixed(1)}% | σ={((sigma || 0.2) * 100).toFixed(0)}%
          </span>
          {/* Historical Returns */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingLeft: '12px',
            borderLeft: '1px solid rgba(255, 255, 255, 0.06)',
          }}>
            {years.map(year => {
              const ret = yearReturns[year];
              const hasData = ret !== undefined;
              const isYTD = year === 2026;
              return (
                <span key={year} style={{
                  fontSize: '9px',
                  color: hasData ? (ret >= 0 ? '#2ecc71' : '#e74c3c') : '#444',
                  background: hasData ? 'rgba(255,255,255,0.05)' : 'transparent',
                  padding: '2px 5px',
                  borderRadius: '4px',
                }}>
                  {isYTD ? 'YTD' : `'${String(year).slice(-2)}`}: {hasData ? `${ret >= 0 ? '+' : ''}${(ret * 100).toFixed(0)}%` : '—'}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <PresetButtons posId={pos.id} updatePosition={updatePosition} currentP50={p50} currentP5={p5} currentP95={p95} />
          {pos.ticker && (
            <button
              style={{
                ...styles.button,
                ...styles.buttonSecondary,
                padding: '5px 10px',
                fontSize: '10px',
              }}
              onClick={() => estimateDistributionFromHistory(pos.id)}
              title="Estimate from historical data"
            >
              📊 Estimate
            </button>
          )}
        </div>
      </div>

      {/* Percentile Sliders */}
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '16px' }}>
          <PercentileEditor
            value={p5}
            onChange={(v) => updatePosition(pos.id, 'p5', v)}
            color="#e74c3c"
            label="P5 (Bad Year)"
            constraintMin={-1}
            constraintMax={p25 - 0.01}
            sliderMin={-80}
            sliderMax={Math.max(-10, Math.round((p25 - 0.01) * 100))}
            sliderStyle={styles.slider}
          />
          <PercentileEditor
            value={p25}
            onChange={(v) => updatePosition(pos.id, 'p25', v)}
            color="#ff9f43"
            label="P25"
            constraintMin={p5 + 0.01}
            constraintMax={p50 - 0.01}
            sliderMin={Math.min(-50, Math.round((p5 + 0.01) * 100))}
            sliderMax={Math.max(30, Math.round((p50 - 0.01) * 100))}
            sliderStyle={styles.slider}
          />
          <PercentileEditor
            value={p50}
            onChange={(v) => updatePosition(pos.id, 'p50', v)}
            color="#ffffff"
            label="P50 (Median)"
            constraintMin={p25 + 0.01}
            constraintMax={p75 - 0.01}
            sliderMin={Math.min(-20, Math.round((p25 + 0.01) * 100))}
            sliderMax={Math.max(60, Math.round((p75 - 0.01) * 100))}
            sliderStyle={styles.slider}
          />
          <PercentileEditor
            value={p75}
            onChange={(v) => updatePosition(pos.id, 'p75', v)}
            color="#3498db"
            label="P75"
            constraintMin={p50 + 0.01}
            constraintMax={p95 - 0.01}
            sliderMin={Math.min(0, Math.round((p50 + 0.01) * 100))}
            sliderMax={Math.max(100, Math.round((p95 - 0.01) * 100))}
            sliderStyle={styles.slider}
          />
          <PercentileEditor
            value={p95}
            onChange={(v) => updatePosition(pos.id, 'p95', v)}
            color="#2ecc71"
            label="P95 (Great Year)"
            constraintMin={p75 + 0.01}
            constraintMax={5}
            sliderMin={Math.min(20, Math.round((p75 + 0.01) * 100))}
            sliderMax={Math.max(150, Math.round(p95 * 100) + 50)}
            sliderStyle={styles.slider}
          />
        </div>

        {/* Distribution Chart */}
        <div style={{
          fontSize: '10px',
          color: '#666',
          marginBottom: '8px',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>
            {skew < -0.2 ? '📉 Left-skewed' : skew > 0.2 ? '📈 Right-skewed' : '⚖️ Symmetric'}
            {' • '}
            {tailDf < 10 ? '⚠️ Fat tails' : tailDf < 20 ? 'Moderate tails' : 'Normal tails'}
          </span>
          <span>
            IQR: <strong style={{ color: '#aaa' }}>{((p75 - p25) * 100).toFixed(0)}%</strong>
            {' | '}
            90% Range: <strong style={{ color: '#aaa' }}>{((p95 - p5) * 100).toFixed(0)}%</strong>
          </span>
        </div>
        <div style={{ height: '160px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={generateDistributionPreview(skew, tailDf, mu, sigma, 80, p5, p25, p50, p75, p95)}
              margin={{ top: 24, right: 20, bottom: 20, left: 40 }}
            >
              <defs>
                {/* Main distribution gradient - cyan to purple */}
                <linearGradient id={`distGrad${pos.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.6} />
                  <stop offset="50%" stopColor="#7b2ff7" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#7b2ff7" stopOpacity={0.05} />
                </linearGradient>
                {/* Glow filter for the line */}
                <filter id={`glow${pos.id}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.04)" vertical={false} />
              <XAxis
                dataKey="returnPct"
                tick={{ fontSize: 9, fill: '#888', fontFamily: FONT_FAMILY }}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}%`}
                domain={[
                  Math.min(p5 * 100, (mu - 3.5 * sigma) * 100) - 5,
                  Math.max(p95 * 100, (mu + 3.5 * sigma) * 100) + 5
                ]}
                tickCount={11}
                type="number"
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                tickLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#666', fontFamily: FONT_FAMILY }}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                domain={[0, 'auto']}
                width={35}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(15, 15, 25, 0.95)',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  borderRadius: '8px',
                  fontSize: '10px',
                  fontFamily: FONT_FAMILY,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                }}
                formatter={(value) => [`${(value * 100).toFixed(1)}%`, 'Probability']}
                labelFormatter={(label) => `Return: ${label > 0 ? '+' : ''}${label.toFixed(1)}%`}
              />
              {/* Zero line - subtle reference */}
              <ReferenceLine x={0} stroke="rgba(255, 255, 255, 0.15)" strokeDasharray="4 4" />
              {/* P5 - Bad outcome (red) */}
              <ReferenceLine x={p5 * 100} stroke="#e74c3c" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'P5', position: 'top', fill: '#e74c3c', fontSize: 9, fontWeight: 600 }} />
              {/* P25 - Below median (orange) */}
              <ReferenceLine x={p25 * 100} stroke="#ff9f43" strokeDasharray="2 2" strokeWidth={1} label={{ value: 'P25', position: 'top', fill: '#ff9f43', fontSize: 8, dy: -2 }} />
              {/* P50 - Median (white) */}
              <ReferenceLine x={p50 * 100} stroke="#ffffff" strokeDasharray="3 3" strokeWidth={2} label={{ value: 'P50', position: 'top', fill: '#ffffff', fontSize: 9, fontWeight: 700 }} />
              {/* P75 - Above median (blue) */}
              <ReferenceLine x={p75 * 100} stroke="#3498db" strokeDasharray="2 2" strokeWidth={1} label={{ value: 'P75', position: 'top', fill: '#3498db', fontSize: 8, dy: -2 }} />
              {/* P95 - Great outcome (green) */}
              <ReferenceLine x={p95 * 100} stroke="#2ecc71" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'P95', position: 'top', fill: '#2ecc71', fontSize: 9, fontWeight: 600 }} />
              {/* Distribution curve with glow effect */}
              <Area
                type="monotone"
                dataKey="probability"
                stroke="#00d4ff"
                strokeWidth={2}
                fill={`url(#distGrad${pos.id})`}
                filter={`url(#glow${pos.id})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

/**
 * Return Ranking Charts - Shows P5/P50/P95 rankings side by side
 */
const ReturnRankingCharts = memo(({ positions, getDistributionParams, styles }) => {
  const rankings = useMemo(() => {
    const getPercentiles = (pos) => {
      const { mu, sigma } = getDistributionParams(pos);
      return {
        ticker: pos.ticker || 'Unknown',
        p5: pos.p5 ?? (mu - 1.645 * sigma),
        p50: pos.p50 ?? mu,
        p95: pos.p95 ?? (mu + 1.645 * sigma),
      };
    };

    const data = positions.map(getPercentiles);
    return {
      p5: [...data].sort((a, b) => b.p5 - a.p5),
      p50: [...data].sort((a, b) => b.p50 - a.p50),
      p95: [...data].sort((a, b) => b.p95 - a.p95),
    };
  }, [positions, getDistributionParams]);

  const RankingColumn = ({ title, icon, data, valueKey, color }) => (
    <div>
      <div style={{
        fontSize: '13px',
        fontWeight: 'bold',
        color,
        marginBottom: '12px',
        textAlign: 'center',
      }}>
        {icon} {title}
      </div>
      {data.map((p, i) => {
        const value = p[valueKey];
        const isPositive = value >= 0;
        const barWidth = Math.min(100, Math.abs(value * 100) / (valueKey === 'p95' ? 2 : 1));
        return (
          <div key={i} style={{ marginBottom: '8px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              marginBottom: '2px',
            }}>
              <span style={{ color: '#fff' }}>{i + 1}. {p.ticker}</span>
              <span style={{
                color: isPositive ? '#2ecc71' : '#e74c3c',
                fontWeight: 'bold',
              }}>
                {value >= 0 ? '+' : ''}{(value * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{
              height: '6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${barWidth}%`,
                height: '100%',
                background: isPositive ? '#2ecc71' : '#e74c3c',
                borderRadius: '3px',
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>
        <span>📊</span> Expected Returns by Security (Ranked)
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '24px',
        marginTop: '16px',
      }}>
        <RankingColumn
          title="P5 (Bad Year)"
          icon="🔻"
          data={rankings.p5}
          valueKey="p5"
          color="#e74c3c"
        />
        <RankingColumn
          title="P50 (Median)"
          icon="⚖️"
          data={rankings.p50}
          valueKey="p50"
          color="#fff"
        />
        <RankingColumn
          title="P95 (Great Year)"
          icon="🔺"
          data={rankings.p95}
          valueKey="p95"
          color="#2ecc71"
        />
      </div>
    </div>
  );
});

/**
 * Main DistributionsTab Component
 */
const DistributionsTab = ({
  positions,
  portfolioValue,
  updatePosition,
  getDistributionParams,
  estimateDistributionFromHistory,
  estimateAllDistributions,
  fetchCalendarYearReturns,
  calendarYearReturns,
  generateDistributionPreview,
  isFetchingData,
  isFetchingYearReturns,
  styles,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [batchReturn, setBatchReturn] = useState('medium');
  const [batchRange, setBatchRange] = useState('medium');

  const filteredPositions = useMemo(() => {
    if (!searchFilter) return positions;
    const search = searchFilter.toLowerCase();
    return positions.filter(pos => pos.ticker?.toLowerCase().includes(search));
  }, [positions, searchFilter]);

  // Apply preset to all positions using 2D system
  const applyPresetToAll = useCallback((returnLevel, rangeLevel) => {
    const ret = RETURN_PRESETS[returnLevel] || RETURN_PRESETS.medium;
    const range = RANGE_PRESETS[rangeLevel] || RANGE_PRESETS.medium;
    const percentiles = computePercentilesFromSpread(ret.p50, range.spread);

    positions.forEach(pos => {
      updatePosition(pos.id, 'p5', percentiles.p5);
      updatePosition(pos.id, 'p25', percentiles.p25);
      updatePosition(pos.id, 'p50', percentiles.p50);
      updatePosition(pos.id, 'p75', percentiles.p75);
      updatePosition(pos.id, 'p95', percentiles.p95);
    });
  }, [positions, updatePosition]);

  return (
    <div>
      {/* Portfolio Summary Card */}
      <PortfolioSummaryCard
        positions={positions}
        portfolioValue={portfolioValue}
        getDistributionParams={getDistributionParams}
        styles={styles}
      />

      {/* Main Card */}
      <div style={styles.card}>
        {/* Header with Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={styles.cardTitle}>
            <span>📈</span> Return Distributions (Annual)
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="🔍 Filter..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                style={{
                  ...styles.input,
                  width: '120px',
                  paddingRight: searchFilter ? '28px' : '12px',
                  fontSize: '11px',
                }}
              />
              {searchFilter && (
                <button
                  onClick={() => setSearchFilter('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '0',
                  }}
                >
                  ×
                </button>
              )}
            </div>

            {/* Batch Preset Buttons - 2D Grid */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              padding: '6px 10px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: '#666', width: '50px' }}>All Return:</span>
                {Object.entries(RETURN_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setBatchReturn(key);
                      applyPresetToAll(key, batchRange);
                    }}
                    style={{
                      padding: '2px 5px',
                      fontSize: '8px',
                      borderRadius: '3px',
                      border: batchReturn === key ? `1px solid ${preset.color}` : '1px solid #333',
                      background: batchReturn === key ? `${preset.color}22` : 'rgba(255, 255, 255, 0.03)',
                      color: batchReturn === key ? preset.color : '#777',
                      cursor: 'pointer',
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <span style={{ fontSize: '8px', color: '#666', width: '50px' }}>All Range:</span>
                {Object.entries(RANGE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setBatchRange(key);
                      applyPresetToAll(batchReturn, key);
                    }}
                    style={{
                      padding: '2px 5px',
                      fontSize: '8px',
                      borderRadius: '3px',
                      border: batchRange === key ? `1px solid ${preset.color}` : '1px solid #333',
                      background: batchRange === key ? `${preset.color}22` : 'rgba(255, 255, 255, 0.03)',
                      color: batchRange === key ? preset.color : '#777',
                      cursor: 'pointer',
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              style={{ ...styles.button, ...styles.buttonSecondary, opacity: isFetchingYearReturns ? 0.7 : 1, fontSize: '11px' }}
              onClick={fetchCalendarYearReturns}
              disabled={isFetchingYearReturns}
            >
              {isFetchingYearReturns ? '⏳...' : '📅 Year Returns'}
            </button>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary, opacity: isFetchingData ? 0.7 : 1, fontSize: '11px' }}
              onClick={estimateAllDistributions}
              disabled={isFetchingData}
            >
              {isFetchingData ? '⏳...' : '📊 Estimate All'}
            </button>
          </div>
        </div>

        {/* Filter Status */}
        {searchFilter && (
          <div style={{ fontSize: '11px', color: '#666', marginBottom: '12px' }}>
            Showing {filteredPositions.length} of {positions.length} positions
            {filteredPositions.length === 0 && <span style={{ color: '#ff9f43' }}> — No matches</span>}
          </div>
        )}

        {/* Info Box */}
        <div style={{
          ...styles.infoBox,
          marginBottom: '16px',
          fontSize: '11px',
        }}>
          <strong>Set your beliefs:</strong> Adjust P5/P50/P95 for each position, or use Quick presets.
          Click "Estimate All" to bootstrap from historical data.
        </div>

        {/* Position Cards */}
        {filteredPositions.map(pos => (
          <PositionDistributionCard
            key={pos.id}
            pos={pos}
            updatePosition={updatePosition}
            getDistributionParams={getDistributionParams}
            estimateDistributionFromHistory={estimateDistributionFromHistory}
            calendarYearReturns={calendarYearReturns}
            generateDistributionPreview={generateDistributionPreview}
            styles={styles}
          />
        ))}
      </div>

      {/* Return Ranking Charts */}
      <ReturnRankingCharts
        positions={positions}
        getDistributionParams={getDistributionParams}
        styles={styles}
      />
    </div>
  );
};

export default DistributionsTab;
