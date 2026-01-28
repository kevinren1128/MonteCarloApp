/**
 * PDFReport.jsx - v5.0 Premium Visual Export
 * 
 * Matches the premium UI design from OptimizeTab:
 * - Linear gradients for card backgrounds
 * - Color-coded stat cells with rgba backgrounds
 * - Premium typography and spacing
 * - Icon headers with subtitles
 * - Visual bars and charts with proper colors
 */

import React from 'react';
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  Svg,
  Rect,
  Line,
  G,
} from '@react-pdf/renderer';

// ============================================
// FONT CONFIGURATION
// ============================================

// Register Twemoji for emoji support
Font.registerEmojiSource({
  format: 'png',
  url: 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/',
});

// Disable hyphenation
Font.registerHyphenationCallback(word => [word]);

// ============================================
// DESIGN SYSTEM (matching OptimizeTab exactly)
// ============================================
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

const C = {
  // Backgrounds (matching OptimizeTab)
  bg: '#0c0e18',
  cardBg: 'rgba(22, 27, 44, 0.95)', // Card background
  cardBgAlt: '#161b2c',
  headerBg: '#101828',
  darkOverlay: 'rgba(0, 0, 0, 0.25)',
  
  // Text
  white: '#ffffff',
  text: '#e8e8ec',
  muted: '#888888',
  subtle: '#555555',
  dim: '#666666',
  
  // Borders
  border: '#2a2a3a',
  borderLight: 'rgba(255, 255, 255, 0.06)',
  
  // Accents
  ...COLORS,
};

// RGBA helper for PDF (can't use rgba, use hex with opacity simulation)
const withAlpha = (hex, alpha) => {
  // For PDF we'll use solid colors with lightened/darkened versions
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // Blend with dark background
  const bg = { r: 22, g: 27, b: 44 };
  return `rgb(${Math.round(bg.r + (r - bg.r) * alpha)}, ${Math.round(bg.g + (g - bg.g) * alpha)}, ${Math.round(bg.b + (b - bg.b) * alpha)})`;
};

// ============================================
// STYLES
// ============================================
const s = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    padding: 24,
    fontFamily: 'Courier',
    fontSize: 9,
    color: C.text,
  },
  
  // Premium Card (matching OptimizeTab)
  card: {
    backgroundColor: C.cardBgAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardBody: {
    padding: 14,
  },
  
  // Card Header (gradient effect simulated)
  cardHeader: {
    backgroundColor: '#1a2235',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  cardHeaderAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  cardTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  cardSubtitle: {
    fontSize: 7,
    color: C.subtle,
    marginTop: 2,
  },
  
  // Stats Grid (matching OptimizeTab 3x2 grid)
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statCell: {
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  statLabel: {
    fontSize: 8,
    color: C.muted,
    marginTop: 2,
  },
  statSub: {
    fontSize: 6,
    color: C.subtle,
    marginTop: 1,
  },
  
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0f1420',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#1a1a2a',
  },
  th: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.dim,
  },
  td: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 8,
  },
  
  // Utility
  row: { flexDirection: 'row' },
  flex1: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  mb4: { marginBottom: 4 },
  mb8: { marginBottom: 8 },
  mb12: { marginBottom: 12 },
  mt8: { marginTop: 8 },
  
  // Footer
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 24,
    right: 24,
    textAlign: 'center',
    fontSize: 7,
    color: C.muted,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 6,
  },
});

// ============================================
// UTILITIES
// ============================================
const fmt = {
  cur: (v) => {
    if (v == null || isNaN(v)) return '—';
    const abs = Math.abs(v);
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${Math.round(v).toLocaleString()}`;
  },
  pct: (v, d = 1) => {
    if (v == null || isNaN(v)) return '—';
    return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(d)}%`;
  },
  pctPlain: (v, d = 1) => {
    if (v == null || isNaN(v)) return '—';
    return `${(v * 100).toFixed(d)}%`;
  },
  num: (v, d = 2) => {
    if (v == null || isNaN(v)) return '—';
    return v.toFixed(d);
  },
};

const getStatBg = (color) => {
  // Create subtle colored backgrounds like OptimizeTab
  const colors = {
    [C.green]: '#1a2e24',
    [C.red]: '#2e1a1a',
    [C.cyan]: '#1a2a2e',
    [C.orange]: '#2e2a1a',
    [C.purple]: '#261a2e',
    [C.blue]: '#1a222e',
    [C.gold]: '#2e2a1a',
  };
  return colors[color] || '#1a2235';
};

const computeHistogram = (dist, bins = 20) => {
  if (!dist || dist.length === 0) return [];
  const min = Math.min(...dist);
  const max = Math.max(...dist);
  const width = (max - min) / bins || 0.01;
  const counts = Array(bins).fill(0);
  dist.forEach(v => {
    const i = Math.min(Math.floor((v - min) / width), bins - 1);
    counts[i]++;
  });
  return counts.map((c, i) => ({
    value: min + (i + 0.5) * width,
    pct: (c / dist.length) * 100,
  }));
};

// ============================================
// REUSABLE COMPONENTS
// ============================================

const PageHeader = ({ title, subtitle }) => (
  <View style={{ marginBottom: 16 }}>
    <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: C.cyan, paddingBottom: 8 }]}>
      <View>
        <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.cyan }}>
          MONTE CARLO PORTFOLIO ANALYSIS
        </Text>
        {title && <Text style={{ fontSize: 8, color: C.muted, marginTop: 2 }}>{title}</Text>}
      </View>
      <Text style={{ fontSize: 7, color: C.muted }}>
        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
      </Text>
    </View>
  </View>
);

const Footer = ({ page, total }) => (
  <View style={s.footer}>
    <Text>Page {page} of {total} • Monte Carlo Simulator</Text>
  </View>
);

const CardHeader = ({ icon, title, subtitle, accentColor = C.cyan }) => (
  <View style={s.cardHeader}>
    <View style={[s.cardHeaderAccent, { backgroundColor: accentColor }]} />
    <View style={[s.row, { alignItems: 'center' }]}>
      {icon && <Text style={{ fontSize: 12, marginRight: 8 }}>{icon}</Text>}
      <View>
        <Text style={s.cardTitle}>{title}</Text>
        {subtitle && <Text style={s.cardSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  </View>
);

const StatCell = ({ label, value, sub, color = C.cyan, width = '30%' }) => (
  <View style={[s.statCell, { backgroundColor: getStatBg(color), width }]}>
    <Text style={[s.statValue, { color }]}>{value}</Text>
    <Text style={s.statLabel}>{label}</Text>
    {sub && <Text style={s.statSub}>{sub}</Text>}
  </View>
);

const StatsRow = ({ stats }) => (
  <View style={[s.statsGrid, { marginBottom: 8 }]}>
    {stats.map((stat, i) => (
      <StatCell key={i} {...stat} width={`${Math.floor(100 / stats.length) - 2}%`} />
    ))}
  </View>
);

// Premium Histogram with colored bars and axis labels
const Histogram = ({ data, width = 240, height = 80, threshold = 0, posColor = C.cyan, negColor = C.red, showLabels = true }) => {
  if (!data || data.length === 0) {
    return (
      <View style={{ width, height, backgroundColor: '#1a2235', borderRadius: 6, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 7, color: C.muted }}>No distribution data</Text>
      </View>
    );
  }

  const maxPct = Math.max(...data.map(d => d.pct), 0.1);
  const labelHeight = showLabels ? 18 : 0;
  const chartH = height - 10 - labelHeight;
  const barW = Math.max(5, (width - 24) / data.length - 1);
  const chartLeft = 12;

  // Get min/max values for axis labels
  const minVal = Math.min(...data.map(d => d.value));
  const maxVal = Math.max(...data.map(d => d.value));

  return (
    <Svg width={width} height={height}>
      <Rect x="0" y="0" width={width} height={height} fill="#1a2235" rx="6" />

      {/* Bars */}
      {data.map((d, i) => {
        const barH = Math.max(2, (d.pct / maxPct) * chartH);
        const x = chartLeft + i * (barW + 1);
        const y = chartH - barH + 5;
        const color = d.value >= threshold ? posColor : negColor;
        return (
          <Rect key={i} x={x} y={y} width={barW} height={barH} fill={color} rx="1" />
        );
      })}

      {/* X-axis labels */}
      {showLabels && (
        <>
          {/* Zero line indicator if threshold is in range */}
          {threshold >= minVal && threshold <= maxVal && (
            <Line
              x1={chartLeft + ((threshold - minVal) / (maxVal - minVal)) * (width - 24)}
              y1={chartH + 5}
              x2={chartLeft + ((threshold - minVal) / (maxVal - minVal)) * (width - 24)}
              y2={chartH + 10}
              stroke={C.cyan}
              strokeWidth="1"
            />
          )}
          {/* Min label */}
          <Text x={chartLeft} y={height - 4} style={{ fontSize: 6 }} fill={C.muted}>
            {(minVal * 100).toFixed(0)}%
          </Text>
          {/* Max label */}
          <Text x={width - 8} y={height - 4} style={{ fontSize: 6 }} fill={C.muted} textAnchor="end">
            {(maxVal * 100).toFixed(0)}%
          </Text>
          {/* Center label (zero or midpoint) */}
          {threshold >= minVal && threshold <= maxVal ? (
            <Text x={chartLeft + ((threshold - minVal) / (maxVal - minVal)) * (width - 24)} y={height - 4} style={{ fontSize: 6 }} fill={C.cyan} textAnchor="middle">
              0%
            </Text>
          ) : (
            <Text x={width / 2} y={height - 4} style={{ fontSize: 6 }} fill={C.muted} textAnchor="middle">
              {(((minVal + maxVal) / 2) * 100).toFixed(0)}%
            </Text>
          )}
        </>
      )}
    </Svg>
  );
};

// Table of Contents component
const TableOfContents = ({ sections }) => (
  <View style={[s.card, { marginTop: 12 }]}>
    <CardHeader icon="📑" title="Contents" accentColor={C.cyan} />
    <View style={s.cardBody}>
      {sections.map((section, i) => (
        <View key={i} style={[s.row, { marginBottom: 6, alignItems: 'center' }]}>
          <Text style={{ fontSize: 8, color: C.cyan, width: 18 }}>{section.page}</Text>
          <Text style={{ fontSize: 8, color: C.text, flex: 1 }}>{section.title}</Text>
          <View style={{ flex: 1, height: 1, borderBottomWidth: 0.5, borderBottomColor: '#2a2a3a', marginHorizontal: 8 }} />
          <Text style={{ fontSize: 7, color: C.muted }}>{section.subtitle || ''}</Text>
        </View>
      ))}
    </View>
  </View>
);

// Comprehensive Percentile Table
const PercentileTable = ({ label, percentiles, formatFn = fmt.pct, unit = '' }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={{ fontSize: 7, color: C.subtle, marginBottom: 4, textTransform: 'uppercase' }}>{label}</Text>
    <View style={[s.row, { backgroundColor: '#1a2235', borderRadius: 6, padding: 8 }]}>
      {Object.entries(percentiles).map(([key, value], i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', borderRightWidth: i < Object.keys(percentiles).length - 1 ? 0.5 : 0, borderRightColor: '#2a2a3a' }}>
          <Text style={{ fontSize: 6, color: C.muted }}>{key}</Text>
          <Text style={{
            fontSize: 9,
            fontFamily: 'Courier',
            color: key.includes('5') || key.includes('10') ? C.red : key.includes('90') || key.includes('95') ? C.green : C.text,
            marginTop: 2
          }}>
            {formatFn(value)}
          </Text>
        </View>
      ))}
    </View>
  </View>
);

// Horizontal Bar Chart (matching OptimizeTab risk bar style)
const HorizontalBars = ({ data, width = 500, maxItems = 14 }) => {
  const items = data.slice(0, maxItems);
  if (items.length === 0) return null;
  
  const maxAbs = Math.max(...items.map(d => Math.abs(d.value)), 0.01);
  const barH = 12;
  const gap = 4;
  const totalH = items.length * (barH + gap) + 14;
  const labelW = 55;
  const valueW = 55;
  const chartW = width - labelW - valueW - 10;
  const centerX = labelW + chartW / 2;
  
  return (
    <Svg width={width} height={totalH}>
      <Rect x="0" y="0" width={width} height={totalH} fill="#1a2235" rx="6" />
      {/* Center line */}
      <Line x1={centerX} y1="8" x2={centerX} y2={totalH - 6} stroke={C.subtle} strokeWidth="0.5" />
      {items.map((d, i) => {
        const y = 10 + i * (barH + gap);
        const isPos = d.value >= 0;
        const barW = Math.max(4, (Math.abs(d.value) / maxAbs) * (chartW / 2 - 10));
        const color = isPos ? C.green : C.red;
        
        return (
          <G key={i}>
            {/* Label */}
            <Text x="8" y={y + barH - 3} style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} fill={C.text}>
              {d.label}
            </Text>
            {/* Bar */}
            <Rect 
              x={isPos ? centerX + 2 : centerX - barW - 2} 
              y={y} 
              width={barW} 
              height={barH} 
              fill={color} 
              rx="2" 
            />
            {/* Value */}
            <Text 
              x={width - 8} 
              y={y + barH - 3} 
              style={{ fontSize: 7, fontFamily: 'Courier' }} 
              fill={color} 
              textAnchor="end"
            >
              {d.value >= 0 ? '+' : ''}{d.value.toFixed(2)}%
            </Text>
          </G>
        );
      })}
    </Svg>
  );
};

// Stacked Risk Bar (like OptimizeTab risk contribution)
const RiskBar = ({ positions, width = 500 }) => {
  const barColors = [C.cyan, C.green, C.orange, C.red, C.purple, C.blue, C.teal, C.gold];
  const filtered = positions.filter(p => (p.riskContribution || 0) > 0.005).slice(0, 10);
  
  if (filtered.length === 0) return null;
  
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 7, color: C.subtle, marginBottom: 4, textTransform: 'uppercase' }}>
        Risk Contribution by Position
      </Text>
      <Svg width={width} height={28}>
        <Rect x="0" y="0" width={width} height={28} fill="#1a2235" rx="4" />
        {filtered.reduce((acc, pos, i) => {
          const barW = (pos.riskContribution || 0) * (width - 8);
          const x = acc.x + 4;
          acc.bars.push(
            <G key={i}>
              <Rect 
                x={x} 
                y="4" 
                width={Math.max(2, barW)} 
                height="20" 
                fill={barColors[i % barColors.length]} 
                rx="2"
              />
              {barW > 30 && (
                <Text 
                  x={x + barW / 2} 
                  y="17" 
                  style={{ fontSize: 6, fontFamily: 'Helvetica-Bold' }} 
                  fill={C.white} 
                  textAnchor="middle"
                >
                  {pos.ticker}
                </Text>
              )}
            </G>
          );
          acc.x = x + barW;
          return acc;
        }, { x: 0, bars: [] }).bars}
      </Svg>
      {/* Legend */}
      <View style={[s.row, { flexWrap: 'wrap', marginTop: 6 }]}>
        {filtered.map((pos, i) => (
          <View key={i} style={[s.row, { alignItems: 'center', marginRight: 10, marginBottom: 3 }]}>
            <View style={{ width: 8, height: 8, backgroundColor: barColors[i % barColors.length], borderRadius: 2, marginRight: 4 }} />
            <Text style={{ fontSize: 7, color: C.muted }}>{pos.ticker}</Text>
            <Text style={{ fontSize: 7, color: C.subtle, marginLeft: 3 }}>{fmt.pctPlain(pos.riskContribution)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// Volatility Bar Chart
const VolatilityBars = ({ data, width = 500, maxItems = 16 }) => {
  if (!data || data.length === 0) return null;
  
  const items = data.slice(0, maxItems);
  const maxVal = Math.max(...items.map(d => d.value), 0.01);
  const barH = 12;
  const gap = 3;
  const totalH = items.length * (barH + gap) + 12;
  
  const getColor = (val) => {
    const norm = val / maxVal;
    if (norm >= 0.8) return C.red;
    if (norm >= 0.6) return C.orange;
    if (norm >= 0.4) return C.gold;
    return C.green;
  };
  
  return (
    <Svg width={width} height={totalH}>
      <Rect x="0" y="0" width={width} height={totalH} fill="#1a2235" rx="6" />
      {items.map((d, i) => {
        const y = 8 + i * (barH + gap);
        const barW = Math.max(8, (d.value / maxVal) * (width - 120));
        const color = getColor(d.value);
        
        return (
          <G key={i}>
            <Text x="8" y={y + barH - 3} style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} fill={C.text}>
              {d.label}
            </Text>
            <Rect x="50" y={y} width={barW} height={barH} fill={color} rx="2" />
            <Text 
              x={width - 8} 
              y={y + barH - 3} 
              style={{ fontSize: 7, fontFamily: 'Courier' }} 
              fill={color} 
              textAnchor="end"
            >
              {fmt.pctPlain(d.value)}
            </Text>
          </G>
        );
      })}
    </Svg>
  );
};

// Correlation Heatmap (premium styling)
const CorrelationHeatmap = ({ tickers, matrix, width = 480 }) => {
  if (!matrix || matrix.length === 0) return null;
  
  const n = tickers.length;
  const cellSize = Math.min(20, (width - 50) / (n + 1));
  const labelOff = 45;
  const totalH = labelOff + n * cellSize + 10;
  
  const getColor = (val, isDiag) => {
    if (isDiag) return '#2a2a3a';
    if (val > 0.6) return '#27ae60';
    if (val > 0.3) return '#1e6e42';
    if (val > 0.1) return '#1a3a2a';
    if (val > -0.1) return '#1a2235';
    if (val > -0.3) return '#3a1a1a';
    return '#c0392b';
  };
  
  return (
    <Svg width={width} height={totalH}>
      <Rect x="0" y="0" width={width} height={totalH} fill="#1a2235" rx="6" />
      {/* Column headers */}
      {tickers.map((t, i) => (
        <Text 
          key={`h${i}`} 
          x={labelOff + i * cellSize + cellSize / 2} 
          y="12" 
          style={{ fontSize: 5, fontFamily: 'Helvetica-Bold' }} 
          fill={C.cyan} 
          textAnchor="middle"
        >
          {t.substring(0, 4)}
        </Text>
      ))}
      {/* Rows */}
      {tickers.map((ticker, row) => (
        <G key={`r${row}`}>
          <Text 
            x="6" 
            y={labelOff + row * cellSize + cellSize * 0.6 - 6} 
            style={{ fontSize: 5, fontFamily: 'Helvetica-Bold' }} 
            fill={C.cyan}
          >
            {ticker.substring(0, 5)}
          </Text>
          {matrix[row].map((val, col) => (
            <Rect 
              key={`c${row}-${col}`}
              x={labelOff + col * cellSize} 
              y={labelOff + row * cellSize - 10} 
              width={cellSize - 2} 
              height={cellSize - 2} 
              fill={getColor(val, row === col)} 
              rx="2" 
            />
          ))}
        </G>
      ))}
    </Svg>
  );
};

// Table component
const Table = ({ headers, rows, widths }) => (
  <View>
    <View style={s.tableHeader}>
      {headers.map((h, i) => (
        <Text key={i} style={[s.th, { width: widths[i], textAlign: h.align || 'left' }]}>
          {h.label}
        </Text>
      ))}
    </View>
    {rows.map((row, ri) => (
      <View key={ri} style={[s.tableRow, ri % 2 === 1 && { backgroundColor: '#12161f' }]}>
        {row.map((cell, ci) => (
          <Text 
            key={ci} 
            style={[
              s.td, 
              { 
                width: widths[ci], 
                textAlign: headers[ci]?.align || 'left',
                color: cell.color || C.text,
                fontFamily: cell.bold ? 'Helvetica-Bold' : cell.mono ? 'Courier' : 'Helvetica',
              }
            ]}
          >
            {cell.value !== undefined ? cell.value : cell}
          </Text>
        ))}
      </View>
    ))}
  </View>
);

// ============================================
// PAGE 1: COVER
// ============================================
const CoverPage = ({ data, totalPages, tocSections }) => {
  const { portfolioValue, positions, numPaths, simulationResults, correlationMethod, fatTailMethod } = data;
  const t = simulationResults?.terminal;
  const previewHist = t?.distribution ? computeHistogram(t.distribution, 24) : [];

  return (
    <Page size="A4" style={s.page}>
      {/* Hero */}
      <View style={[s.card, { marginTop: 20 }]}>
        <View style={[s.cardBody, { paddingVertical: 20 }]}>
          <View style={[s.cardHeaderAccent, { backgroundColor: C.cyan, height: '100%' }]} />
          <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.cyan, marginBottom: 4 }}>
            Monte Carlo
          </Text>
          <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.cyan, marginBottom: 8 }}>
            Portfolio Analysis
          </Text>
          <Text style={{ fontSize: 10, color: C.text }}>
            Forward simulation with correlated returns
          </Text>
        </View>
      </View>

      {/* Portfolio Value + Config Row */}
      <View style={[s.row, { marginTop: 10, gap: 8 }]}>
        {/* Portfolio Value */}
        <View style={[s.card, { flex: 1 }]}>
          <View style={[s.cardBody, { alignItems: 'center', paddingVertical: 16 }]}>
            <Text style={{ fontSize: 7, color: C.muted, textTransform: 'uppercase', letterSpacing: 1 }}>
              Portfolio Value
            </Text>
            <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: C.green, marginTop: 4 }}>
              {fmt.cur(portfolioValue)}
            </Text>
          </View>
        </View>

        {/* Config */}
        <View style={[s.card, { flex: 1 }]}>
          <CardHeader icon="📋" title="Configuration" accentColor={C.blue} />
          <View style={[s.cardBody, { paddingVertical: 8 }]}>
            {[
              ['Positions', positions.length],
              ['Paths', (numPaths || 10000).toLocaleString()],
              ['Correlation', correlationMethod === 'sample' ? 'Sample' : 'Ledoit-Wolf'],
              ['Distribution', fatTailMethod === 'multivariateTStudent' ? 't-dist' : 'Gaussian'],
            ].map(([label, value], i) => (
              <View key={i} style={[s.row, { marginBottom: 4 }]}>
                <Text style={{ fontSize: 7, color: C.muted, width: 65 }}>{label}:</Text>
                <Text style={{ fontSize: 7, color: C.text, fontFamily: 'Helvetica-Bold' }}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Key Results */}
      {t && (
        <View style={[s.card, { marginTop: 10 }]}>
          <CardHeader icon="🎯" title="Key Results" accentColor={C.green} />
          <View style={s.cardBody}>
            <StatsRow stats={[
              { label: 'P5 (Bad)', value: fmt.pct(t.p5), color: C.red },
              { label: 'Median', value: fmt.pct(t.p50), color: C.text },
              { label: 'P95 (Good)', value: fmt.pct(t.p95), color: C.green },
              { label: 'P(Loss)', value: fmt.pctPlain(simulationResults?.probLoss?.probBreakeven), color: C.orange },
            ]} />
          </View>
        </View>
      )}

      {/* Table of Contents */}
      <TableOfContents sections={tocSections} />

      <View style={{ flex: 1 }} />
      <Text style={{ textAlign: 'center', fontSize: 7, color: C.muted }}>
        Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </Text>
      <Footer page={1} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 2: EXECUTIVE SUMMARY
// ============================================
const ExecutiveSummaryPage = ({ data, totalPages }) => {
  const { portfolioValue, positions, simulationResults, factorAnalysis, optimizationResults } = data;
  const grossLong = positions.filter(p => p.quantity > 0).reduce((s, p) => s + p.quantity * p.price, 0);
  const grossShort = Math.abs(positions.filter(p => p.quantity < 0).reduce((s, p) => s + p.quantity * p.price, 0));
  const nlv = Math.abs(portfolioValue) || 1;
  const t = simulationResults?.terminal;
  const dd = simulationResults?.drawdown;
  const pl = simulationResults?.probLoss;
  
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Executive Summary" />
      
      {/* Key Metrics */}
      {t && (
        <View style={s.card}>
          <CardHeader icon="📊" title="Portfolio Metrics" subtitle="Current portfolio performance indicators" accentColor={C.cyan} />
          <View style={s.cardBody}>
            <StatsRow stats={[
              { label: 'Portfolio Value', value: fmt.cur(portfolioValue), color: C.cyan },
              { label: 'P5 Return', value: fmt.pct(t.p5), color: C.red },
              { label: 'Median Return', value: fmt.pct(t.p50), color: (t.p50) >= 0 ? C.green : C.red },
              { label: 'P95 Return', value: fmt.pct(t.p95), color: C.green },
            ]} />
          </View>
        </View>
      )}
      
      {/* Risk Metrics */}
      {dd && pl && (
        <View style={s.card}>
          <CardHeader icon="⚠️" title="Risk Analysis" subtitle="Downside risk and loss probability" accentColor={C.red} />
          <View style={s.cardBody}>
            <View style={s.row}>
              {/* Drawdown */}
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 8 }}>Max Drawdown</Text>
                {[['P50', dd.p50], ['P75', dd.p75], ['P95', dd.p95]].map(([l, v], i) => (
                  <View key={i} style={[s.row, { alignItems: 'center', marginBottom: 6 }]}>
                    <Text style={{ fontSize: 7, color: C.muted, width: 28 }}>{l}</Text>
                    <View style={{ width: 80, height: 6, backgroundColor: '#2a2a3a', borderRadius: 3, marginRight: 8 }}>
                      <View style={{ width: `${Math.min((v || 0) / 0.5, 1) * 100}%`, height: 6, backgroundColor: C.red, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 8, fontFamily: 'Courier', color: C.red }}>
                      -{((v || 0) * 100).toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
              
              {/* Loss Probability */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.white, marginBottom: 8 }}>Loss Probability</Text>
                {[['Any Loss', pl.probBreakeven], ['>10%', pl.prob10], ['>20%', pl.prob20]].map(([l, v], i) => (
                  <View key={i} style={[s.row, { alignItems: 'center', marginBottom: 6 }]}>
                    <Text style={{ fontSize: 7, color: C.muted, width: 45 }}>{l}</Text>
                    <View style={{ width: 65, height: 6, backgroundColor: '#2a2a3a', borderRadius: 3, marginRight: 8 }}>
                      <View style={{ width: `${Math.min(v || 0, 1) * 100}%`, height: 6, backgroundColor: C.orange, borderRadius: 3 }} />
                    </View>
                    <Text style={{ fontSize: 8, fontFamily: 'Courier', color: C.orange }}>
                      {((v || 0) * 100).toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
      )}
      
      {/* Exposure */}
      <View style={s.card}>
        <CardHeader icon="📈" title="Exposure Analysis" accentColor={C.green} />
        <View style={s.cardBody}>
          {/* Visual bar */}
          <View style={{ marginBottom: 10 }}>
            <Svg width={500} height={20}>
              <Rect x="0" y="0" width={500} height={20} fill="#1a2235" rx="4" />
              <Rect 
                x="4" y="4" 
                width={Math.max(4, (grossLong / (grossLong + grossShort)) * 492)} 
                height="12" 
                fill={C.green} 
                rx="2" 
              />
              <Rect 
                x={4 + (grossLong / (grossLong + grossShort)) * 492} y="4" 
                width={Math.max(4, (grossShort / (grossLong + grossShort)) * 492)} 
                height="12" 
                fill={C.red} 
                rx="2" 
              />
            </Svg>
          </View>
          <StatsRow stats={[
            { label: 'Gross Long', value: fmt.cur(grossLong), sub: `${(grossLong / nlv * 100).toFixed(0)}% NLV`, color: C.green },
            { label: 'Gross Short', value: fmt.cur(grossShort), sub: `${(grossShort / nlv * 100).toFixed(0)}% NLV`, color: C.red },
            { label: 'Net Exposure', value: fmt.cur(grossLong - grossShort), sub: `${((grossLong - grossShort) / nlv * 100).toFixed(0)}% NLV`, color: C.cyan },
          ]} />
        </View>
      </View>
      
      {/* Factor Exposures */}
      {factorAnalysis?.portfolioFactorBetas && (
        <View style={s.card}>
          <CardHeader icon="🧬" title="Factor Exposures" subtitle="Fama-French factor loadings" accentColor={C.purple} />
          <View style={s.cardBody}>
            <StatsRow stats={[
              { label: 'Market β', value: fmt.num(factorAnalysis.portfolioFactorBetas.MKT), color: C.cyan },
              { label: 'Size (SMB)', value: fmt.num(factorAnalysis.portfolioFactorBetas.SMB), color: C.green },
              { label: 'Value (HML)', value: fmt.num(factorAnalysis.portfolioFactorBetas.HML), color: C.gold },
              { label: 'Momentum', value: fmt.num(factorAnalysis.portfolioFactorBetas.MOM), color: C.orange },
            ]} />
          </View>
        </View>
      )}
      
      <Footer page={2} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 3: POSITIONS TABLE
// ============================================
const PositionsPage = ({ data, totalPages }) => {
  const { positions, portfolioValue, positionMetadata } = data;
  
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Portfolio Holdings" />
      
      <View style={s.card}>
        <CardHeader icon="📋" title={`Holdings (${positions.length} positions)`} accentColor={C.cyan} />
        <View style={s.cardBody}>
          <Table
            headers={[
              { label: 'Ticker' },
              { label: 'Type' },
              { label: 'Qty', align: 'right' },
              { label: 'Price', align: 'right' },
              { label: 'Value', align: 'right' },
              { label: 'Weight', align: 'right' },
            ]}
            widths={['16%', '14%', '15%', '15%', '20%', '14%']}
            rows={positions.map(p => {
              const val = p.quantity * p.price;
              const wt = portfolioValue !== 0 ? val / portfolioValue : 0;
              return [
                { value: p.ticker, color: C.cyan, bold: true },
                { value: positionMetadata?.[p.ticker?.toUpperCase()]?.type || 'Equity', color: C.muted },
                { value: p.quantity.toLocaleString(), mono: true },
                { value: `$${p.price.toFixed(2)}`, mono: true },
                { value: fmt.cur(val), mono: true },
                { value: fmt.pct(wt), color: wt >= 0 ? C.green : C.red, bold: true },
              ];
            })}
          />
        </View>
      </View>
      
      <Footer page={3} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 4: EXPOSURE ANALYSIS
// ============================================
const ExposurePage = ({ data, totalPages, pageNum }) => {
  const { positions, portfolioValue } = data;
  const nlv = Math.abs(portfolioValue) || 1;
  
  const longs = positions.filter(p => p.quantity > 0)
    .map(p => ({ ticker: p.ticker, value: p.quantity * p.price }))
    .sort((a, b) => b.value - a.value);
  
  const shorts = positions.filter(p => p.quantity < 0)
    .map(p => ({ ticker: p.ticker, value: Math.abs(p.quantity * p.price) }))
    .sort((a, b) => b.value - a.value);
  
  const ExposureBars = ({ items, color, title }) => {
    if (items.length === 0) return <Text style={{ fontSize: 7, color: C.muted }}>No {title}</Text>;
    
    const maxVal = Math.max(...items.map(d => d.value), 1);
    const displayItems = items.slice(0, 10);
    const barH = 11;
    const gap = 4;
    const totalH = displayItems.length * (barH + gap) + 12;
    
    return (
      <Svg width={210} height={totalH}>
        <Rect x="0" y="0" width={210} height={totalH} fill="#1a2235" rx="6" />
        {displayItems.map((d, i) => {
          const y = 8 + i * (barH + gap);
          const pct = (d.value / nlv) * 100;
          const barW = Math.max(8, (d.value / maxVal) * 100);
          return (
            <G key={i}>
              <Text x="8" y={y + barH - 3} style={{ fontSize: 7, fontFamily: 'Helvetica-Bold' }} fill={C.text}>
                {(d.ticker || '?').substring(0, 5)}
              </Text>
              <Rect x="48" y={y} width={barW} height={barH} fill={color} rx="2" />
              <Text x="202" y={y + barH - 3} style={{ fontSize: 7, fontFamily: 'Courier' }} fill={C.muted} textAnchor="end">
                {pct.toFixed(1)}%
              </Text>
            </G>
          );
        })}
      </Svg>
    );
  };
  
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Exposure Analysis" />
      
      <View style={[s.row, { gap: 10 }]}>
        <View style={[s.card, { flex: 1 }]}>
          <CardHeader icon="📈" title={`Long Positions (${longs.length})`} accentColor={C.green} />
          <View style={s.cardBody}>
            <ExposureBars items={longs} color={C.green} title="longs" />
            <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#2a2a3a' }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.green }}>
                Total: {fmt.cur(longs.reduce((s, p) => s + p.value, 0))}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={[s.card, { flex: 1 }]}>
          <CardHeader icon="📉" title={`Short Positions (${shorts.length})`} accentColor={C.red} />
          <View style={s.cardBody}>
            <ExposureBars items={shorts} color={C.red} title="shorts" />
            <View style={{ marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: '#2a2a3a' }}>
              <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.red }}>
                Total: {fmt.cur(shorts.reduce((s, p) => s + p.value, 0))}
              </Text>
            </View>
          </View>
        </View>
      </View>
      
      <Footer page={pageNum} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 5: SIMULATION RESULTS
// ============================================
const SimulationResultsPage = ({ data, totalPages, pageNum }) => {
  const { simulationResults, portfolioValue, numPaths } = data;
  if (!simulationResults) return null;

  const t = simulationResults.terminal || {};
  const td = simulationResults.terminalDollars || {};
  const dd = simulationResults.drawdown || {};
  const pl = simulationResults.probLoss || {};

  const retHist = computeHistogram(t.distribution, 22);
  const ddHist = computeHistogram(dd.distribution, 18);

  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Simulation Results" />

      {/* Comprehensive Percentile Tables */}
      <View style={s.card}>
        <CardHeader icon="📊" title="Complete Distribution Statistics" subtitle={`${(numPaths || 10000).toLocaleString()} Monte Carlo paths`} accentColor={C.cyan} />
        <View style={s.cardBody}>
          <PercentileTable
            label="1-Year Return Percentiles"
            percentiles={{
              'P1': t.p1 || t.p5 * 1.3,
              'P5': t.p5,
              'P10': t.p10 || (t.p5 + t.p25) / 2,
              'P25': t.p25,
              'P50': t.p50,
              'P75': t.p75,
              'P90': t.p90 || (t.p75 + t.p95) / 2,
              'P95': t.p95,
              'P99': t.p99 || t.p95 * 1.3,
            }}
            formatFn={fmt.pct}
          />
          <PercentileTable
            label="Portfolio Value Percentiles"
            percentiles={{
              'P5': td.p5,
              'P25': td.p25,
              'P50': td.p50,
              'P75': td.p75,
              'P95': td.p95,
            }}
            formatFn={fmt.cur}
          />
          <PercentileTable
            label="Max Drawdown Percentiles"
            percentiles={{
              'P50': dd.p50,
              'P75': dd.p75,
              'P90': dd.p90,
              'P95': dd.p95,
              'P99': dd.p99,
            }}
            formatFn={(v) => `-${((v || 0) * 100).toFixed(1)}%`}
          />
        </View>
      </View>

      <View style={[s.row, { gap: 10 }]}>
        {/* Returns Histogram */}
        <View style={[s.card, { flex: 1 }]}>
          <CardHeader icon="📈" title="Return Distribution" accentColor={C.cyan} />
          <View style={s.cardBody}>
            <Histogram data={retHist} width={220} height={70} threshold={0} showLabels={true} />
          </View>
        </View>

        {/* Drawdown Histogram */}
        <View style={[s.card, { flex: 1 }]}>
          <CardHeader icon="📉" title="Drawdown Distribution" accentColor={C.red} />
          <View style={s.cardBody}>
            <Histogram data={ddHist} width={220} height={70} posColor={C.red} negColor={C.red} showLabels={true} />
          </View>
        </View>
      </View>

      {/* Loss Probability Summary */}
      <View style={s.card}>
        <CardHeader icon="⚠️" title="Loss Probability Analysis" accentColor={C.orange} />
        <View style={s.cardBody}>
          <View style={[s.row, { gap: 8 }]}>
            {[
              { label: 'Any Loss', value: pl.probBreakeven, color: C.orange },
              { label: 'Loss > 5%', value: pl.prob5, color: C.orange },
              { label: 'Loss > 10%', value: pl.prob10, color: C.red },
              { label: 'Loss > 20%', value: pl.prob20, color: C.red },
              { label: 'Loss > 30%', value: pl.prob30, color: C.red },
            ].map((item, i) => (
              <View key={i} style={{ flex: 1, backgroundColor: '#1a2235', borderRadius: 6, padding: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 6, color: C.muted }}>{item.label}</Text>
                <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: item.color, marginTop: 2 }}>
                  {fmt.pctPlain(item.value)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Footer page={pageNum} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 6: CONTRIBUTION ANALYSIS
// ============================================
const ContributionPage = ({ data, totalPages, pageNum }) => {
  const { simulationResults } = data;
  if (!simulationResults?.contributions) return null;
  
  const tickers = simulationResults.contributions.tickers || [];
  const p50vals = simulationResults.contributions.p50 || [];
  
  const counts = {};
  tickers.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  const seen = {};
  const labels = tickers.map(t => {
    seen[t] = (seen[t] || 0) + 1;
    return counts[t] > 1 ? `${t}#${seen[t]}` : t;
  });
  
  const contribData = labels.map((l, i) => ({
    label: l,
    value: (p50vals[i] || 0) * 100,
  })).sort((a, b) => b.value - a.value);
  
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Contribution Analysis" />
      
      <View style={s.card}>
        <CardHeader icon="📊" title="Position Contributions" subtitle="Contribution to portfolio median return" accentColor={C.cyan} />
        <View style={s.cardBody}>
          <HorizontalBars data={contribData} width={500} maxItems={18} />
        </View>
      </View>
      
      <Footer page={pageNum} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 7: CORRELATION
// ============================================
const CorrelationPage = ({ data, totalPages, pageNum }) => {
  const { tickers, editedCorrelation, correlationMethod, useEwma } = data;
  if (!editedCorrelation || editedCorrelation.length === 0) return null;
  
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Correlation Matrix" />
      
      <View style={s.card}>
        <CardHeader 
          icon="🔗" 
          title="Correlation Heatmap" 
          subtitle={`${tickers.length}×${tickers.length} matrix • ${correlationMethod === 'sample' ? 'Sample' : 'Ledoit-Wolf'}${useEwma ? ' + EWMA' : ''}`}
          accentColor={C.purple} 
        />
        <View style={[s.cardBody, { alignItems: 'center' }]}>
          <CorrelationHeatmap tickers={tickers} matrix={editedCorrelation} width={Math.min(480, 50 + tickers.length * 22)} />
        </View>
        
        {/* Legend */}
        <View style={[s.row, { padding: 10, backgroundColor: '#12161f', justifyContent: 'center', gap: 16 }]}>
          {[
            { c: '#27ae60', l: '> 0.6' },
            { c: '#1e6e42', l: '0.3-0.6' },
            { c: '#1a2235', l: '±0.1' },
            { c: '#3a1a1a', l: '-0.1 to -0.3' },
            { c: '#c0392b', l: '< -0.3' },
          ].map((x, i) => (
            <View key={i} style={[s.row, { alignItems: 'center' }]}>
              <View style={{ width: 10, height: 10, backgroundColor: x.c, borderRadius: 2, marginRight: 4 }} />
              <Text style={{ fontSize: 6, color: C.text }}>{x.l}</Text>
            </View>
          ))}
        </View>
      </View>
      
      <Footer page={pageNum} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 8: VOLATILITY
// ============================================
const VolatilityPage = ({ data, totalPages, pageNum }) => {
  const { positions, getDistributionParams } = data;
  
  const vols = positions.map(p => ({
    ticker: p.ticker,
    vol: getDistributionParams(p).sigma || 0.2,
  })).sort((a, b) => b.vol - a.vol);
  
  const maxVol = Math.max(...vols.map(v => v.vol));
  const minVol = Math.min(...vols.map(v => v.vol));
  const avgVol = vols.reduce((s, v) => s + v.vol, 0) / vols.length;
  
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Volatility Analysis" />
      
      <View style={s.card}>
        <CardHeader icon="📊" title="Volatility Overview" accentColor={C.orange} />
        <View style={s.cardBody}>
          <StatsRow stats={[
            { label: 'Highest σ', value: `${Math.round(maxVol * 100)}%`, sub: vols[0]?.ticker, color: C.red },
            { label: 'Lowest σ', value: `${Math.round(minVol * 100)}%`, sub: vols[vols.length - 1]?.ticker, color: C.green },
            { label: 'Average σ', value: `${Math.round(avgVol * 100)}%`, sub: `${vols.length} positions`, color: C.cyan },
            { label: 'Spread', value: `${(maxVol / minVol).toFixed(1)}x`, sub: 'high/low', color: C.purple },
          ]} />
        </View>
      </View>
      
      <View style={s.card}>
        <CardHeader icon="📈" title="Volatility by Position" subtitle="Ranked from highest to lowest" accentColor={C.orange} />
        <View style={s.cardBody}>
          <VolatilityBars data={vols.slice(0, 16).map(v => ({ label: v.ticker, value: v.vol }))} width={500} />
        </View>
      </View>
      
      <Footer page={pageNum} total={totalPages} />
    </Page>
  );
};

// ============================================
// PAGE 9: OPTIMIZATION
// ============================================
const OptimizationPage = ({ data, totalPages, pageNum }) => {
  const { optimizationResults, simulationResults } = data;
  if (!optimizationResults?.current) return null;
  
  const c = optimizationResults.current;
  const mc = c.mcResults;
  
  return (
    <Page size="A4" style={s.page}>
      <PageHeader title="Portfolio Optimization" />
      
      {/* Portfolio Metrics - matching OptimizeTab PortfolioSummaryCard exactly */}
      <View style={s.card}>
        <CardHeader icon="📊" title="Current Portfolio" subtitle="Analytical + Monte Carlo metrics" accentColor={C.cyan} />
        <View style={s.cardBody}>
          <View style={[s.statsGrid]}>
            {[
              { label: 'Expected Return', value: fmt.pct(c.portfolioReturn || c.return), sub: 'annualized μ', color: (c.portfolioReturn || 0) >= 0 ? C.green : C.red },
              { label: 'Volatility', value: fmt.pct(c.portfolioVol || c.volatility), sub: 'annualized σ', color: C.orange },
              { label: 'Sharpe Ratio', value: (c.sharpe || 0).toFixed(3), sub: '(μ - Rf) / σ', color: C.cyan },
              { label: 'P(Loss) 1Y', value: fmt.pctPlain(mc?.pLoss || simulationResults?.probLoss?.probBreakeven), sub: 'MC simulated', color: C.red },
              { label: 'VaR 5%', value: fmt.pct(mc?.var5 || (simulationResults?.terminal?.p5 ? simulationResults.terminal.p5 : 0)), sub: 'worst 5% MC', color: C.red },
              { label: 'CVaR 5%', value: mc?.cvar5 ? fmt.pct(mc.cvar5) : '—', sub: 'expected shortfall', color: C.red },
            ].map((stat, i) => (
              <StatCell key={i} {...stat} width="31%" />
            ))}
          </View>
        </View>
      </View>
      
      {/* Top Swaps */}
      {(optimizationResults.topSwaps?.length || 0) > 0 && (
        <View style={s.card}>
          <CardHeader icon="💡" title="Recommended Swaps" subtitle="MC-validated trade recommendations" accentColor={C.green} />
          <View style={s.cardBody}>
            {/* Best swap hero */}
            {optimizationResults.topSwaps[0] && (
              <View style={{ 
                padding: 12, 
                backgroundColor: '#1a2e24', 
                borderRadius: 8, 
                borderWidth: 1, 
                borderColor: '#2e6e42',
                marginBottom: 12,
              }}>
                <View style={[s.row, { alignItems: 'center' }]}>
                  <Text style={{ fontSize: 18, marginRight: 10 }}>🏆</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 8, color: C.green, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' }}>#1 Best Trade</Text>
                    <Text style={{ fontSize: 12, color: C.white, fontFamily: 'Helvetica-Bold', marginTop: 2 }}>
                      Sell <Text style={{ color: C.red }}>{optimizationResults.topSwaps[0].sellTicker}</Text>
                      <Text style={{ color: C.muted }}> → </Text>
                      Buy <Text style={{ color: C.green }}>{optimizationResults.topSwaps[0].buyTicker}</Text>
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: C.green }}>
                      +{((optimizationResults.topSwaps[0].deltaMetrics?.deltaMCSharpe || 0) * 100).toFixed(2)}%
                    </Text>
                    <Text style={{ fontSize: 7, color: C.muted }}>ΔSharpe (MC)</Text>
                  </View>
                </View>
              </View>
            )}
            
            {/* Swap list */}
            <HorizontalBars 
              data={optimizationResults.topSwaps.slice(0, 10).map(sw => ({
                label: `${sw.sellTicker}→${sw.buyTicker}`,
                value: (sw.deltaMetrics?.deltaMCSharpe || 0) * 100,
              }))} 
              width={500} 
              maxItems={10} 
            />
          </View>
        </View>
      )}
      
      {/* Risk Contribution */}
      {optimizationResults.positions?.length > 0 && (
        <View style={s.card}>
          <CardHeader icon="📈" title="Risk Contribution" accentColor={C.orange} />
          <View style={s.cardBody}>
            <RiskBar positions={optimizationResults.positions} width={500} />
          </View>
        </View>
      )}
      
      <Footer page={pageNum} total={totalPages} />
    </Page>
  );
};

// ============================================
// MAIN DOCUMENT
// ============================================
const PDFReport = ({ data }) => {
  const { positions, simulationResults, editedCorrelation, factorAnalysis, optimizationResults } = data;
  const tickers = positions.map(p => p.ticker).filter(Boolean);

  const hasCorr = editedCorrelation?.length > 0;
  const hasSim = !!simulationResults;
  const hasContrib = hasSim && !!simulationResults.contributions;
  const hasOpt = !!optimizationResults?.current;

  // Build TOC sections dynamically
  const tocSections = [
    { page: 1, title: 'Cover & Summary', subtitle: 'Key metrics' },
    { page: 2, title: 'Executive Summary', subtitle: 'Risk analysis' },
    { page: 3, title: 'Portfolio Holdings', subtitle: `${positions.length} positions` },
    { page: 4, title: 'Exposure Analysis', subtitle: 'Long/short breakdown' },
  ];

  let pageNum = 5;
  if (hasSim) {
    tocSections.push({ page: pageNum, title: 'Simulation Results', subtitle: 'Distribution analysis' });
    pageNum++;
    if (hasContrib) {
      tocSections.push({ page: pageNum, title: 'Contribution Analysis', subtitle: 'Position attribution' });
      pageNum++;
    }
  }
  if (hasCorr) {
    tocSections.push({ page: pageNum, title: 'Correlation Matrix', subtitle: 'Asset correlations' });
    pageNum++;
    tocSections.push({ page: pageNum, title: 'Volatility Analysis', subtitle: 'Position risk' });
    pageNum++;
  }
  if (hasOpt) {
    tocSections.push({ page: pageNum, title: 'Portfolio Optimization', subtitle: 'Trade recommendations' });
    pageNum++;
  }

  const totalPages = pageNum - 1;
  const enriched = { ...data, tickers };

  // Track page numbers for each section
  let simPage = 5;
  let contribPage = hasSim ? 6 : 5;
  let corrPage = hasSim ? (hasContrib ? 7 : 6) : 5;
  let volPage = corrPage + 1;
  let optPage = hasCorr ? volPage + 1 : corrPage;

  return (
    <Document>
      <CoverPage data={enriched} totalPages={totalPages} tocSections={tocSections} />
      <ExecutiveSummaryPage data={enriched} totalPages={totalPages} />
      <PositionsPage data={enriched} totalPages={totalPages} />
      <ExposurePage data={enriched} totalPages={totalPages} pageNum={4} />

      {hasSim && (
        <>
          <SimulationResultsPage data={enriched} totalPages={totalPages} pageNum={simPage} />
          {hasContrib && (
            <ContributionPage data={enriched} totalPages={totalPages} pageNum={contribPage} />
          )}
        </>
      )}

      {hasCorr && (
        <>
          <CorrelationPage data={enriched} totalPages={totalPages} pageNum={corrPage} />
          <VolatilityPage data={enriched} totalPages={totalPages} pageNum={volPage} />
        </>
      )}

      {hasOpt && (
        <OptimizationPage data={enriched} totalPages={totalPages} pageNum={optPage} />
      )}
    </Document>
  );
};

export default PDFReport;
