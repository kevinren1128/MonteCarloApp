# UI Quality of Life Improvements - Professional Grade

> Comprehensive analysis and recommendations for elevating the Monte Carlo Portfolio Simulator to professional-grade UI/UX.

## Table of Contents

1. [Visual Design System](#1-visual-design-system)
2. [Navigation & Information Architecture](#2-navigation--information-architecture)
3. [User Feedback & States](#3-user-feedback--states)
4. [Input & Form Patterns](#4-input--form-patterns)
5. [Data Visualization](#5-data-visualization)
6. [Accessibility](#6-accessibility)
7. [Micro-interactions & Animation](#7-micro-interactions--animation)
8. [Error Handling](#8-error-handling)
9. [Help & Onboarding](#9-help--onboarding)
10. [Responsive Design](#10-responsive-design)
11. [Performance UX](#11-performance-ux)
12. [Keyboard Navigation](#12-keyboard-navigation)
13. [Quick Wins (Low Effort, High Impact)](#13-quick-wins)
14. [Implementation Priority](#14-implementation-priority)

---

## 1. Visual Design System

### Current Issues
- Inconsistent spacing (some gaps are 8px, 12px, 16px, 20px randomly)
- Color palette not fully systematic
- Typography hierarchy could be clearer
- Dark theme is good but lacks visual hierarchy depth

### Recommendations

#### 1.1 Establish Design Tokens

```javascript
// src/constants/designTokens.js

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
  xxxl: '48px',
};

export const colors = {
  // Backgrounds (layered for depth)
  bg: {
    base: '#0a0a0f',
    raised: '#12121f',
    surface: '#1a1a2e',
    overlay: '#242438',
    hover: '#2a2a4a',
  },
  
  // Borders
  border: {
    subtle: '#1a1a2e',
    default: '#2a2a4a',
    strong: '#3a3a6a',
    accent: '#00d4ff33',
  },
  
  // Text
  text: {
    primary: '#f0f0f0',
    secondary: '#a0a0a0',
    muted: '#666666',
    disabled: '#444444',
  },
  
  // Semantic
  accent: {
    primary: '#00d4ff',
    secondary: '#7b2ff7',
    gradient: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
  },
  
  success: '#2ecc71',
  warning: '#f39c12',
  danger: '#e74c3c',
  info: '#3498db',
  
  // Percentile colors (semantic for finance)
  percentile: {
    p5: '#ef4444',   // Worst case - red
    p25: '#f97316',  // Below median - orange
    p50: '#eab308',  // Median - yellow
    p75: '#84cc16',  // Above median - lime
    p95: '#22c55e',  // Best case - green
  },
};

export const typography = {
  fontFamily: {
    mono: "'JetBrains Mono', 'Fira Code', monospace",
    sans: "'Inter', -apple-system, sans-serif",
  },
  
  fontSize: {
    xs: '10px',
    sm: '12px',
    md: '13px',
    lg: '14px',
    xl: '16px',
    xxl: '20px',
    xxxl: '28px',
    display: '36px',
  },
  
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 4px 6px rgba(0, 0, 0, 0.4)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.5)',
  glow: '0 0 20px rgba(0, 212, 255, 0.3)',
  glowStrong: '0 0 30px rgba(0, 212, 255, 0.5)',
};

export const borderRadius = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  full: '9999px',
};

export const transitions = {
  fast: '0.1s ease',
  normal: '0.2s ease',
  slow: '0.3s ease-out',
  spring: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
};
```

#### 1.2 Card Depth System

```javascript
// Three levels of card elevation
const cardStyles = {
  level1: {
    background: colors.bg.raised,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: borderRadius.lg,
    boxShadow: 'none',
  },
  level2: {
    background: colors.bg.surface,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.xl,
    boxShadow: shadows.sm,
  },
  level3: {
    background: colors.bg.overlay,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: borderRadius.xl,
    boxShadow: shadows.md,
  },
};
```

#### 1.3 Typography Hierarchy

```
Page Title:     28px, bold, gradient text
Section Title:  16px, semibold, white
Card Title:     14px, semibold, white
Label:          12px, medium, secondary color, UPPERCASE
Body:           13px, normal, primary color
Caption:        11px, normal, muted color
Data Value:     13px, monospace, accent color
```

---

## 2. Navigation & Information Architecture

### Current Issues
- 7 tabs may be overwhelming for new users
- No indication of which tabs require data loading first
- No breadcrumbs or workflow indicators
- Tab switching doesn't preserve scroll position

### Recommendations

#### 2.1 Tab Organization with Workflow Hints

```jsx
// Group tabs into logical workflow stages
const tabGroups = [
  {
    label: 'Setup',
    tabs: [
      { id: 'positions', label: 'Positions', icon: '📊', requiresData: false },
      { id: 'distributions', label: 'Distributions', icon: '📈', requiresData: true },
    ],
  },
  {
    label: 'Analysis',
    tabs: [
      { id: 'correlation', label: 'Correlation', icon: '🔗', requiresData: true },
      { id: 'factors', label: 'Factors', icon: '🧬', requiresData: true },
    ],
  },
  {
    label: 'Results',
    tabs: [
      { id: 'simulation', label: 'Simulation', icon: '🎲', requiresData: true },
      { id: 'optimize', label: 'Optimize', icon: '🎯', requiresData: true },
    ],
  },
  {
    label: 'Output',
    tabs: [
      { id: 'export', label: 'Export', icon: '📄', requiresData: false },
    ],
  },
];
```

#### 2.2 Tab Status Indicators

```jsx
// Show status badges on tabs
const TabButton = ({ tab, isActive, hasData, hasResults }) => (
  <button style={isActive ? styles.activeTab : styles.tab}>
    <span>{tab.icon}</span>
    <span>{tab.label}</span>
    
    {/* Status indicators */}
    {tab.requiresData && !hasData && (
      <span style={styles.tabBadgeWarning} title="Load data first">
        ⚠️
      </span>
    )}
    {hasResults && (
      <span style={styles.tabBadgeSuccess} title="Results available">
        ✓
      </span>
    )}
  </button>
);
```

#### 2.3 Workflow Progress Indicator

```jsx
// Show progress through workflow
const WorkflowProgress = ({ currentStep }) => (
  <div style={styles.workflowProgress}>
    {['Add Positions', 'Load Data', 'Set Distributions', 'Run Simulation'].map((step, i) => (
      <div key={step} style={{
        ...styles.workflowStep,
        opacity: i <= currentStep ? 1 : 0.4,
        color: i < currentStep ? colors.success : (i === currentStep ? colors.accent.primary : colors.text.muted),
      }}>
        <div style={styles.workflowNumber}>{i < currentStep ? '✓' : i + 1}</div>
        <div style={styles.workflowLabel}>{step}</div>
        {i < 3 && <div style={styles.workflowConnector} />}
      </div>
    ))}
  </div>
);
```

#### 2.4 Sticky Section Headers

```jsx
// For long scrolling content, sticky headers help orientation
<div style={{ position: 'sticky', top: 0, zIndex: 10, background: colors.bg.base }}>
  <h2>Position Details</h2>
</div>
```

---

## 3. User Feedback & States

### Current Issues
- No skeleton loaders during data fetch
- Empty states are minimal
- Success messages use browser `alert()`
- No toast notifications
- Loading spinners inconsistent

### Recommendations

#### 3.1 Toast Notification System

```jsx
// src/components/common/Toast.jsx
const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);
  
  return (
    <div style={styles.toastContainer}>
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          style={{
            ...styles.toast,
            ...styles[`toast${toast.type}`], // toastSuccess, toastError, etc.
          }}
        >
          <span style={styles.toastIcon}>{toast.icon}</span>
          <span>{toast.message}</span>
          <button onClick={() => dismissToast(toast.id)}>✕</button>
        </div>
      ))}
    </div>
  );
};

// Usage
showToast({ type: 'success', message: 'Portfolio exported successfully', duration: 3000 });
showToast({ type: 'error', message: 'Failed to load AAPL data', duration: 5000 });
```

#### 3.2 Skeleton Loaders

```jsx
// src/components/common/Skeleton.jsx
const SkeletonRow = () => (
  <tr>
    <td><div style={styles.skeletonText} /></td>
    <td><div style={styles.skeletonText} /></td>
    <td><div style={styles.skeletonNumber} /></td>
    <td><div style={styles.skeletonNumber} /></td>
    <td><div style={styles.skeletonChart} /></td>
  </tr>
);

const styles = {
  skeleton: {
    background: 'linear-gradient(90deg, #1a1a2e 25%, #2a2a4a 50%, #1a1a2e 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.5s infinite',
    borderRadius: '4px',
  },
  skeletonText: { width: '80%', height: '14px' },
  skeletonNumber: { width: '60px', height: '14px' },
  skeletonChart: { width: '50px', height: '20px' },
};
```

#### 3.3 Rich Empty States

```jsx
// Instead of just "No positions"
const EmptyPositions = () => (
  <div style={styles.emptyState}>
    <div style={styles.emptyIcon}>📊</div>
    <h3 style={styles.emptyTitle}>No positions yet</h3>
    <p style={styles.emptyDescription}>
      Add your first position to start building your portfolio.
      Enter a ticker symbol below to get started.
    </p>
    <div style={styles.emptyActions}>
      <input 
        placeholder="Enter ticker (e.g., AAPL)" 
        style={styles.input}
        autoFocus
      />
      <button style={styles.button}>Add Position</button>
    </div>
    <div style={styles.emptyHint}>
      💡 Tip: You can add stocks, ETFs, and international securities
    </div>
  </div>
);

const EmptySimulation = () => (
  <div style={styles.emptyState}>
    <div style={styles.emptyIcon}>🎲</div>
    <h3 style={styles.emptyTitle}>Ready to simulate</h3>
    <p style={styles.emptyDescription}>
      Run a Monte Carlo simulation to see potential portfolio outcomes.
    </p>
    <div style={styles.emptyChecklist}>
      <div style={{ color: positions.length > 0 ? colors.success : colors.text.muted }}>
        {positions.length > 0 ? '✓' : '○'} Add at least one position
      </div>
      <div style={{ color: hasCorrelation ? colors.success : colors.text.muted }}>
        {hasCorrelation ? '✓' : '○'} Compute correlation matrix
      </div>
    </div>
    {canSimulate && (
      <button style={styles.button} onClick={runSimulation}>
        🎲 Run Simulation
      </button>
    )}
  </div>
);
```

#### 3.4 Progress States with Details

```jsx
// Rich progress display during long operations
const SimulationProgress = ({ progress }) => (
  <div style={styles.progressCard}>
    <div style={styles.progressHeader}>
      <span style={styles.progressPhase}>{progress.phase}</span>
      <span style={styles.progressPercent}>{progress.percent}%</span>
    </div>
    
    <div style={styles.progressBar}>
      <div style={{ ...styles.progressFill, width: `${progress.percent}%` }} />
    </div>
    
    <div style={styles.progressDetails}>
      <div>
        <span style={styles.progressLabel}>Paths Completed</span>
        <span style={styles.progressValue}>{progress.completed.toLocaleString()}</span>
      </div>
      <div>
        <span style={styles.progressLabel}>Est. Time Remaining</span>
        <span style={styles.progressValue}>{progress.eta}</span>
      </div>
      <div>
        <span style={styles.progressLabel}>Paths/Second</span>
        <span style={styles.progressValue}>{progress.pathsPerSecond.toLocaleString()}</span>
      </div>
    </div>
    
    <button style={styles.buttonSecondary} onClick={cancelSimulation}>
      Cancel
    </button>
  </div>
);
```

---

## 4. Input & Form Patterns

### Current Issues
- Number inputs don't have clear boundaries
- No input validation feedback
- Currency/percentage formatting happens only on blur
- No input masks for percentages

### Recommendations

#### 4.1 Enhanced Number Input

```jsx
const NumberInput = ({ 
  value, 
  onChange, 
  min, 
  max, 
  step,
  prefix,
  suffix,
  format = 'number', // 'number', 'currency', 'percent'
  error,
  hint,
}) => {
  const [focused, setFocused] = useState(false);
  const [localValue, setLocalValue] = useState(formatValue(value));
  
  return (
    <div style={styles.inputWrapper}>
      {prefix && <span style={styles.inputPrefix}>{prefix}</span>}
      
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          commitValue();
        }}
        style={{
          ...styles.input,
          ...(focused && styles.inputFocused),
          ...(error && styles.inputError),
          paddingLeft: prefix ? '28px' : '12px',
          paddingRight: suffix ? '28px' : '12px',
        }}
      />
      
      {suffix && <span style={styles.inputSuffix}>{suffix}</span>}
      
      {/* Step buttons */}
      <div style={styles.inputSteppers}>
        <button onClick={() => onChange(value + step)}>▲</button>
        <button onClick={() => onChange(value - step)}>▼</button>
      </div>
      
      {error && <div style={styles.inputErrorText}>{error}</div>}
      {hint && !error && <div style={styles.inputHint}>{hint}</div>}
    </div>
  );
};

// Usage
<NumberInput
  value={shares}
  onChange={setShares}
  min={0}
  step={1}
  hint="Enter number of shares"
/>

<NumberInput
  value={price}
  onChange={setPrice}
  min={0}
  step={0.01}
  prefix="$"
  format="currency"
/>

<NumberInput
  value={expectedReturn}
  onChange={setExpectedReturn}
  min={-100}
  max={500}
  step={1}
  suffix="%"
  format="percent"
/>
```

#### 4.2 Inline Validation

```jsx
// Real-time validation with clear feedback
const TickerInput = ({ value, onChange, onValidate }) => {
  const [status, setStatus] = useState('idle'); // idle, loading, valid, invalid
  const [message, setMessage] = useState('');
  
  const validate = async (ticker) => {
    setStatus('loading');
    try {
      const result = await validateTicker(ticker);
      if (result.valid) {
        setStatus('valid');
        setMessage(`${result.name} • ${result.type}`);
      } else {
        setStatus('invalid');
        setMessage(result.error);
      }
    } catch {
      setStatus('invalid');
      setMessage('Unable to validate ticker');
    }
  };
  
  return (
    <div style={styles.inputWithValidation}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        onBlur={() => value && validate(value)}
        style={{
          ...styles.input,
          borderColor: status === 'valid' ? colors.success : 
                       status === 'invalid' ? colors.danger : 
                       colors.border.default,
        }}
        placeholder="Ticker symbol"
      />
      
      <div style={styles.validationStatus}>
        {status === 'loading' && <LoadingSpinner size={14} />}
        {status === 'valid' && <span style={{ color: colors.success }}>✓</span>}
        {status === 'invalid' && <span style={{ color: colors.danger }}>✕</span>}
      </div>
      
      {message && (
        <div style={{
          ...styles.validationMessage,
          color: status === 'invalid' ? colors.danger : colors.text.secondary,
        }}>
          {message}
        </div>
      )}
    </div>
  );
};
```

#### 4.3 Slider with Live Preview

```jsx
// Current slider is good, enhance with:
const PercentileSlider = ({ value, onChange, label, color }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [previewValue, setPreviewValue] = useState(value);
  
  return (
    <div style={styles.sliderContainer}>
      <div style={styles.sliderHeader}>
        <span style={{ ...styles.sliderLabel, color }}>{label}</span>
        <span style={{ 
          ...styles.sliderValue, 
          color,
          // Pulse animation when dragging
          animation: isDragging ? 'pulse 0.5s ease infinite' : 'none',
        }}>
          {formatPercent(isDragging ? previewValue : value)}
        </span>
      </div>
      
      <div style={styles.sliderTrack}>
        {/* Show tick marks at key percentiles */}
        {[-50, -25, 0, 25, 50, 75, 100].map(tick => (
          <div 
            key={tick}
            style={{
              ...styles.sliderTick,
              left: `${(tick + 50) / 150 * 100}%`,
            }}
          />
        ))}
        
        <input
          type="range"
          min={-100}
          max={200}
          value={isDragging ? previewValue : value}
          onChange={(e) => setPreviewValue(parseFloat(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => {
            setIsDragging(false);
            onChange(previewValue);
          }}
          style={{
            ...styles.slider,
            // Custom track color based on value
            background: `linear-gradient(to right, ${color}40 0%, ${color} ${(value + 100) / 3}%, ${color}40 100%)`,
          }}
        />
      </div>
      
      {/* Quick preset buttons */}
      <div style={styles.sliderPresets}>
        {['-20%', '0%', '+10%', '+25%', '+50%'].map(preset => (
          <button
            key={preset}
            style={styles.sliderPresetButton}
            onClick={() => onChange(parseFloat(preset))}
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
};
```

#### 4.4 Correlation Cell with Visual Feedback

```jsx
// Enhanced correlation cell input
const CorrelationCell = ({ value, onChange, row, col }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  
  // Color based on correlation strength
  const bgColor = getCorrelationColor(value);
  const textColor = Math.abs(value) > 0.5 ? '#fff' : colors.text.primary;
  
  return (
    <td 
      style={{
        ...styles.correlationCell,
        background: bgColor,
        color: textColor,
      }}
      onClick={() => !isEditing && setIsEditing(true)}
    >
      {isEditing ? (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={() => {
            const num = parseFloat(localValue);
            if (!isNaN(num) && num >= -1 && num <= 1) {
              onChange(num);
            }
            setIsEditing(false);
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
          autoFocus
          style={styles.correlationInput}
        />
      ) : (
        <div style={styles.correlationValue}>
          {value.toFixed(2)}
          <div style={styles.correlationHoverHint}>Click to edit</div>
        </div>
      )}
    </td>
  );
};

// Color scale function
const getCorrelationColor = (value) => {
  const intensity = Math.abs(value);
  if (value > 0) {
    // Positive: blue gradient
    return `rgba(59, 130, 246, ${intensity * 0.6})`;
  } else {
    // Negative: red gradient  
    return `rgba(239, 68, 68, ${intensity * 0.6})`;
  }
};
```

---

## 5. Data Visualization

### Current Issues
- Charts lack interactivity tooltips
- No zoom/pan on dense charts
- Legend placement sometimes awkward
- Missing axis labels on some charts

### Recommendations

#### 5.1 Enhanced Chart Tooltips

```jsx
// Rich tooltip for return distribution chart
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div style={styles.tooltip}>
      <div style={styles.tooltipHeader}>{label}</div>
      
      {payload.map((entry, i) => (
        <div key={i} style={styles.tooltipRow}>
          <span style={{ ...styles.tooltipDot, background: entry.color }} />
          <span style={styles.tooltipLabel}>{entry.name}</span>
          <span style={styles.tooltipValue}>
            {formatPercent(entry.value)}
          </span>
        </div>
      ))}
      
      {/* Add contextual info */}
      <div style={styles.tooltipFooter}>
        <div>Dollar Impact: {formatCurrency(payload[0].value * portfolioValue)}</div>
      </div>
    </div>
  );
};

const styles = {
  tooltip: {
    background: colors.bg.overlay,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    boxShadow: shadows.lg,
    minWidth: '200px',
  },
  tooltipHeader: {
    fontWeight: 600,
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottom: `1px solid ${colors.border.default}`,
  },
  tooltipRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    padding: `${spacing.xs} 0`,
  },
  tooltipDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  tooltipLabel: {
    flex: 1,
    color: colors.text.secondary,
  },
  tooltipValue: {
    fontFamily: typography.fontFamily.mono,
    fontWeight: 600,
  },
  tooltipFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTop: `1px solid ${colors.border.default}`,
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
  },
};
```

#### 5.2 Interactive Percentile Distribution

```jsx
// Allow clicking on percentile bars to see details
const PercentileChart = ({ results }) => {
  const [selectedPercentile, setSelectedPercentile] = useState(null);
  
  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <Bar 
            dataKey="return"
            onClick={(data) => setSelectedPercentile(data.percentile)}
          >
            {chartData.map((entry, i) => (
              <Cell 
                key={i}
                fill={entry.percentile === selectedPercentile 
                  ? colors.accent.primary 
                  : percentileColors[entry.percentile]}
                style={{ cursor: 'pointer' }}
              />
            ))}
          </Bar>
          <ReferenceLine y={0} stroke={colors.border.strong} />
          <Tooltip content={<CustomTooltip />} />
        </BarChart>
      </ResponsiveContainer>
      
      {/* Detail panel when percentile selected */}
      {selectedPercentile && (
        <div style={styles.percentileDetail}>
          <h4>P{selectedPercentile} Scenario Details</h4>
          <div style={styles.detailGrid}>
            <div>
              <span>Portfolio Return</span>
              <span>{formatPercent(results.percentiles[`p${selectedPercentile}`])}</span>
            </div>
            <div>
              <span>Dollar Change</span>
              <span>{formatCurrency(results.percentiles[`p${selectedPercentile}`] * portfolioValue)}</span>
            </div>
            <div>
              <span>Ending Value</span>
              <span>{formatCurrency(portfolioValue * (1 + results.percentiles[`p${selectedPercentile}`]))}</span>
            </div>
          </div>
          
          {/* Position breakdown at this percentile */}
          <h5>Position Contributions</h5>
          <table style={styles.table}>
            {/* Show each position's contribution at this percentile */}
          </table>
        </div>
      )}
    </div>
  );
};
```

#### 5.3 Correlation Matrix Heatmap Enhancements

```jsx
// Enhanced correlation matrix with:
// - Row/column highlighting on hover
// - Click to see correlation time series
// - Cluster visualization

const CorrelationMatrix = ({ matrix, tickers }) => {
  const [hoveredCell, setHoveredCell] = useState(null);
  const [selectedPair, setSelectedPair] = useState(null);
  
  return (
    <div>
      <table style={styles.correlationMatrix}>
        <thead>
          <tr>
            <th></th>
            {tickers.map((ticker, i) => (
              <th 
                key={ticker}
                style={{
                  ...styles.correlationHeader,
                  background: hoveredCell?.col === i ? colors.bg.hover : 'transparent',
                }}
              >
                {ticker}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((rowTicker, i) => (
            <tr key={rowTicker}>
              <td style={{
                ...styles.correlationRowHeader,
                background: hoveredCell?.row === i ? colors.bg.hover : 'transparent',
              }}>
                {rowTicker}
              </td>
              {matrix[i].map((value, j) => (
                <CorrelationCell
                  key={j}
                  value={value}
                  isHovered={hoveredCell?.row === i || hoveredCell?.col === j}
                  onHover={() => setHoveredCell({ row: i, col: j })}
                  onClick={() => setSelectedPair({ ticker1: rowTicker, ticker2: tickers[j] })}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Correlation detail modal */}
      {selectedPair && (
        <Modal onClose={() => setSelectedPair(null)}>
          <CorrelationDetail 
            ticker1={selectedPair.ticker1}
            ticker2={selectedPair.ticker2}
            marketData={marketData}
          />
        </Modal>
      )}
    </div>
  );
};
```

#### 5.4 Mini Sparkline Enhancements

```jsx
// Enhanced sparkline with hover details
const Sparkline = ({ data, width = 60, height = 24, ticker }) => {
  const [hovered, setHovered] = useState(false);
  
  if (!data || data.length < 2) {
    return <span style={styles.noData}>—</span>;
  }
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const isUp = data[data.length - 1] >= data[0];
  const change = ((data[data.length - 1] - data[0]) / data[0]) * 100;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <div 
      style={styles.sparklineContainer}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width={width} height={height}>
        {/* Gradient fill */}
        <defs>
          <linearGradient id={`grad-${ticker}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={isUp ? colors.success : colors.danger} stopOpacity="0.3" />
            <stop offset="100%" stopColor={isUp ? colors.success : colors.danger} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Area fill */}
        <polygon 
          points={`0,${height} ${points} ${width},${height}`}
          fill={`url(#grad-${ticker})`}
        />
        
        {/* Line */}
        <polyline 
          points={points} 
          fill="none" 
          stroke={isUp ? colors.success : colors.danger} 
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* End dot */}
        <circle 
          cx={width} 
          cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
          r="2"
          fill={isUp ? colors.success : colors.danger}
        />
      </svg>
      
      {/* Tooltip on hover */}
      {hovered && (
        <div style={styles.sparklineTooltip}>
          <div>{formatCurrency(data[data.length - 1])}</div>
          <div style={{ color: isUp ? colors.success : colors.danger }}>
            {isUp ? '+' : ''}{change.toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## 6. Accessibility

### Current Issues
- No focus indicators on many interactive elements
- Color-only status indicators (colorblind unfriendly)
- No aria-labels on icon buttons
- No skip navigation
- Contrast issues on some muted text

### Recommendations

#### 6.1 Focus Indicators

```css
/* Global focus styles */
*:focus {
  outline: none;
}

*:focus-visible {
  outline: 2px solid #00d4ff;
  outline-offset: 2px;
}

/* Button focus */
button:focus-visible {
  box-shadow: 0 0 0 2px #0a0a0f, 0 0 0 4px #00d4ff;
}

/* Input focus */
input:focus-visible {
  border-color: #00d4ff;
  box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.2);
}
```

#### 6.2 Screen Reader Support

```jsx
// Add aria labels and descriptions
<button 
  aria-label="Delete position"
  aria-describedby={`delete-help-${ticker}`}
  onClick={() => deletePosition(index)}
>
  🗑️
</button>
<span id={`delete-help-${ticker}`} className="sr-only">
  Remove {ticker} from portfolio
</span>

// Progress announcements
<div 
  role="progressbar" 
  aria-valuenow={progress} 
  aria-valuemin={0} 
  aria-valuemax={100}
  aria-label="Simulation progress"
>
  {progress}%
</div>

// Live regions for updates
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {statusMessage}
</div>
```

#### 6.3 Colorblind-Friendly Indicators

```jsx
// Add patterns/shapes in addition to colors
const StatusIndicator = ({ status }) => (
  <span style={styles.statusIndicator}>
    {/* Icon provides meaning beyond color */}
    {status === 'success' && <span style={{ color: colors.success }}>✓</span>}
    {status === 'warning' && <span style={{ color: colors.warning }}>⚠</span>}
    {status === 'error' && <span style={{ color: colors.danger }}>✕</span>}
    {status === 'loading' && <LoadingSpinner />}
    
    {/* Text label for screen readers */}
    <span className="sr-only">{status}</span>
  </span>
);

// In charts, use patterns
<Bar fill="url(#stripe-pattern)" /> // For negative values
<Bar fill={colors.success} /> // For positive values
```

#### 6.4 Keyboard Navigation

```jsx
// Make correlation matrix keyboard navigable
const CorrelationMatrix = () => {
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 });
  
  const handleKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowUp':
        setFocusedCell(prev => ({ ...prev, row: Math.max(0, prev.row - 1) }));
        break;
      case 'ArrowDown':
        setFocusedCell(prev => ({ ...prev, row: Math.min(n - 1, prev.row + 1) }));
        break;
      case 'ArrowLeft':
        setFocusedCell(prev => ({ ...prev, col: Math.max(0, prev.col - 1) }));
        break;
      case 'ArrowRight':
        setFocusedCell(prev => ({ ...prev, col: Math.min(n - 1, prev.col + 1) }));
        break;
      case 'Enter':
        startEditing(focusedCell);
        break;
    }
  };
  
  return (
    <div 
      role="grid" 
      aria-label="Correlation matrix"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* ... */}
    </div>
  );
};
```

---

## 7. Micro-interactions & Animation

### Current Issues
- Some transitions are jarring
- No feedback on button clicks
- Loading states could be more engaging
- Tab switching has no transition

### Recommendations

#### 7.1 Button Interactions

```jsx
const Button = ({ children, onClick, variant = 'primary', ...props }) => {
  const [isPressed, setIsPressed] = useState(false);
  
  return (
    <button
      style={{
        ...styles.button,
        ...styles[`button${variant}`],
        transform: isPressed ? 'scale(0.98)' : 'scale(1)',
        transition: 'transform 0.1s ease, box-shadow 0.2s ease',
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};
```

#### 7.2 Tab Transition

```jsx
// Animate tab content changes
const TabContent = ({ activeTab }) => {
  const [displayedTab, setDisplayedTab] = useState(activeTab);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  useEffect(() => {
    if (activeTab !== displayedTab) {
      setIsTransitioning(true);
      setTimeout(() => {
        setDisplayedTab(activeTab);
        setIsTransitioning(false);
      }, 150);
    }
  }, [activeTab]);
  
  return (
    <div style={{
      opacity: isTransitioning ? 0 : 1,
      transform: isTransitioning ? 'translateY(10px)' : 'translateY(0)',
      transition: 'opacity 0.15s ease, transform 0.15s ease',
    }}>
      {renderTab(displayedTab)}
    </div>
  );
};
```

#### 7.3 Success Animation

```jsx
// Checkmark animation on successful action
const SuccessCheckmark = () => (
  <svg width="40" height="40" viewBox="0 0 40 40">
    <circle 
      cx="20" cy="20" r="18" 
      fill="none" 
      stroke={colors.success}
      strokeWidth="2"
      style={{
        strokeDasharray: 113,
        strokeDashoffset: 113,
        animation: 'drawCircle 0.4s ease forwards',
      }}
    />
    <path 
      d="M12 20 L18 26 L28 14"
      fill="none"
      stroke={colors.success}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        strokeDasharray: 30,
        strokeDashoffset: 30,
        animation: 'drawCheck 0.3s ease forwards 0.4s',
      }}
    />
  </svg>
);

// CSS
@keyframes drawCircle {
  to { stroke-dashoffset: 0; }
}
@keyframes drawCheck {
  to { stroke-dashoffset: 0; }
}
```

#### 7.4 Number Counter Animation

```jsx
// Animate value changes
const AnimatedValue = ({ value, format = 'currency' }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  
  useEffect(() => {
    if (value !== prevValue.current) {
      const diff = value - prevValue.current;
      const duration = 500;
      const steps = 20;
      const stepValue = diff / steps;
      let step = 0;
      
      const timer = setInterval(() => {
        step++;
        setDisplayValue(prev => prev + stepValue);
        if (step >= steps) {
          clearInterval(timer);
          setDisplayValue(value);
        }
      }, duration / steps);
      
      prevValue.current = value;
      return () => clearInterval(timer);
    }
  }, [value]);
  
  return (
    <span style={{
      transition: 'color 0.3s ease',
      color: value > prevValue.current ? colors.success : 
             value < prevValue.current ? colors.danger : 
             colors.text.primary,
    }}>
      {formatValue(displayValue, format)}
    </span>
  );
};
```

---

## 8. Error Handling

### Current Issues
- API errors shown via console.log only
- No retry mechanisms visible to user
- Error messages are technical
- No error boundaries

### Recommendations

#### 8.1 User-Friendly Error Messages

```jsx
const errorMessages = {
  TICKER_NOT_FOUND: (ticker) => ({
    title: 'Ticker Not Found',
    message: `We couldn't find "${ticker}". Please check the symbol and try again.`,
    suggestions: [
      'Make sure you entered the correct ticker symbol',
      'International stocks may need exchange suffix (e.g., BESI.AS)',
    ],
  }),
  
  NETWORK_ERROR: () => ({
    title: 'Connection Issue',
    message: 'Unable to reach market data servers.',
    suggestions: [
      'Check your internet connection',
      'Try again in a few moments',
    ],
    action: { label: 'Retry', onClick: () => retryFetch() },
  }),
  
  RATE_LIMITED: () => ({
    title: 'Too Many Requests',
    message: 'We\'re fetching data too quickly. Please wait a moment.',
    suggestions: [
      'Wait 30 seconds before trying again',
    ],
    countdown: 30,
  }),
  
  CORRELATION_FAILED: () => ({
    title: 'Correlation Calculation Failed',
    message: 'Unable to compute correlation matrix.',
    suggestions: [
      'Make sure all positions have historical data',
      'Try reducing the history timeline',
    ],
  }),
};
```

#### 8.2 Error Display Component

```jsx
const ErrorDisplay = ({ error, onDismiss, onRetry }) => (
  <div style={styles.errorCard}>
    <div style={styles.errorHeader}>
      <span style={styles.errorIcon}>⚠️</span>
      <span style={styles.errorTitle}>{error.title}</span>
      {onDismiss && (
        <button style={styles.errorDismiss} onClick={onDismiss}>✕</button>
      )}
    </div>
    
    <p style={styles.errorMessage}>{error.message}</p>
    
    {error.suggestions?.length > 0 && (
      <ul style={styles.errorSuggestions}>
        {error.suggestions.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    )}
    
    {error.action && (
      <button style={styles.errorAction} onClick={error.action.onClick}>
        {error.action.label}
      </button>
    )}
    
    {error.countdown && (
      <CountdownTimer 
        seconds={error.countdown} 
        onComplete={() => setCanRetry(true)}
      />
    )}
  </div>
);
```

#### 8.3 Error Boundary

```jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Could send to error tracking service
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.errorBoundary}>
          <h2>Something went wrong</h2>
          <p>We're sorry, but something unexpected happened.</p>
          <button onClick={() => window.location.reload()}>
            Reload Application
          </button>
          <details style={styles.errorDetails}>
            <summary>Technical Details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

---

## 9. Help & Onboarding

### Current Issues
- No first-time user guidance
- Methodology explanation is a single modal
- No contextual help
- No tooltips on complex features

### Recommendations

#### 9.1 First-Time User Tour

```jsx
const OnboardingTour = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      target: '.positions-table',
      title: 'Add Your Positions',
      content: 'Start by entering your stock and ETF holdings. Enter ticker symbols and quantities.',
      placement: 'bottom',
    },
    {
      target: '.load-data-button',
      title: 'Load Market Data',
      content: 'Click here to fetch current prices, historical data, and calculate correlations.',
      placement: 'bottom',
    },
    {
      target: '.distribution-editor',
      title: 'Set Return Expectations',
      content: 'Adjust expected returns for each position, or use historical estimates.',
      placement: 'right',
    },
    {
      target: '.run-simulation-button',
      title: 'Run Simulation',
      content: 'Monte Carlo simulation will show you the range of potential outcomes.',
      placement: 'left',
    },
  ];
  
  return (
    <TourOverlay>
      <TourSpotlight target={steps[step].target}>
        <TourPopover 
          title={steps[step].title}
          content={steps[step].content}
          placement={steps[step].placement}
          currentStep={step + 1}
          totalSteps={steps.length}
          onNext={() => setStep(s => s + 1)}
          onPrev={() => setStep(s => s - 1)}
          onSkip={onComplete}
        />
      </TourSpotlight>
    </TourOverlay>
  );
};
```

#### 9.2 Contextual Help Tooltips

```jsx
// InfoTooltip component for explaining features
const InfoTooltip = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <span style={styles.infoTooltipTrigger}>
      <button 
        style={styles.infoButton}
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Help for ${title}`}
      >
        ℹ️
      </button>
      
      {isOpen && (
        <div style={styles.infoTooltip}>
          <div style={styles.infoTooltipTitle}>{title}</div>
          <div style={styles.infoTooltipContent}>{children}</div>
        </div>
      )}
    </span>
  );
};

// Usage
<div style={styles.cardTitle}>
  Correlation Matrix
  <InfoTooltip title="About Correlation">
    <p>The correlation matrix shows how assets move together.</p>
    <p>Values range from -1 (opposite) to +1 (same direction).</p>
    <ul>
      <li><strong>+1.0:</strong> Perfect positive correlation</li>
      <li><strong>0.0:</strong> No correlation</li>
      <li><strong>-1.0:</strong> Perfect negative correlation</li>
    </ul>
  </InfoTooltip>
</div>
```

#### 9.3 Feature Hints

```jsx
// Show hints for unused features
const FeatureHint = ({ feature, children }) => {
  const [dismissed, setDismissed] = useLocalStorage(`hint-${feature}`, false);
  
  if (dismissed) return null;
  
  return (
    <div style={styles.featureHint}>
      <div style={styles.featureHintIcon}>💡</div>
      <div style={styles.featureHintContent}>{children}</div>
      <button 
        style={styles.featureHintDismiss}
        onClick={() => setDismissed(true)}
      >
        Got it
      </button>
    </div>
  );
};

// Usage in Correlation tab
{!hasRunSimulation && (
  <FeatureHint feature="ewma-correlation">
    <strong>Tip:</strong> Enable "Recency Weighted" to give more importance 
    to recent market behavior. This is especially useful during volatile periods.
  </FeatureHint>
)}
```

#### 9.4 Inline Documentation

```jsx
// Expandable explanation sections
const LearnMore = ({ title, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div style={styles.learnMore}>
      <button 
        style={styles.learnMoreToggle}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span>{isExpanded ? '▼' : '▶'}</span>
        <span>{title}</span>
      </button>
      
      {isExpanded && (
        <div style={styles.learnMoreContent}>
          {children}
        </div>
      )}
    </div>
  );
};

// Usage
<LearnMore title="How is correlation calculated?">
  <p>We use the Ledoit-Wolf shrinkage estimator by default, which blends 
  the sample correlation with a structured target to reduce estimation error.</p>
  
  <h4>Methods Available</h4>
  <ul>
    <li><strong>Sample:</strong> Traditional Pearson correlation</li>
    <li><strong>EWMA:</strong> Recent observations weighted more heavily</li>
    <li><strong>Shrinkage:</strong> Regularized estimation (recommended)</li>
  </ul>
</LearnMore>
```

---

## 10. Responsive Design

### Current Issues
- Fixed widths on some elements
- Tab bar doesn't adapt to small screens
- Tables need horizontal scroll
- Header gets cramped on mobile

### Recommendations

#### 10.1 Responsive Breakpoints

```javascript
const breakpoints = {
  sm: '640px',   // Mobile
  md: '768px',   // Tablet
  lg: '1024px',  // Desktop
  xl: '1280px',  // Wide desktop
};

// Media query helper
const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    
    const listener = () => setMatches(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  
  return matches;
};

// Usage
const isMobile = useMediaQuery('(max-width: 768px)');
```

#### 10.2 Mobile Tab Navigation

```jsx
// Scrollable tabs on mobile, dropdown on very small screens
const TabNavigation = ({ tabs, activeTab, onChange }) => {
  const isMobile = useMediaQuery('(max-width: 640px)');
  
  if (isMobile) {
    return (
      <select 
        value={activeTab}
        onChange={(e) => onChange(e.target.value)}
        style={styles.mobileTabSelect}
      >
        {tabs.map(tab => (
          <option key={tab.id} value={tab.id}>
            {tab.icon} {tab.label}
          </option>
        ))}
      </select>
    );
  }
  
  return (
    <div style={styles.tabScrollContainer}>
      <div style={styles.tabs}>
        {tabs.map(tab => (
          <TabButton key={tab.id} tab={tab} isActive={activeTab === tab.id} />
        ))}
      </div>
    </div>
  );
};
```

#### 10.3 Responsive Table

```jsx
// Card-based layout on mobile
const ResponsiveTable = ({ columns, data, renderMobileCard }) => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  if (isMobile) {
    return (
      <div style={styles.mobileCardList}>
        {data.map((row, i) => (
          <div key={i} style={styles.mobileCard}>
            {renderMobileCard(row)}
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div style={styles.tableScrollContainer}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} style={styles.th}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {columns.map(col => (
                <td key={col.key} style={styles.td}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

#### 10.4 Responsive Header

```jsx
const Header = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [menuOpen, setMenuOpen] = useState(false);
  
  return (
    <header style={styles.header}>
      <div style={styles.headerLeft}>
        <h1 style={styles.title}>
          {isMobile ? 'MC Simulator' : 'Monte Carlo Portfolio Simulator'}
        </h1>
      </div>
      
      {isMobile ? (
        <>
          <div style={styles.portfolioValueCompact}>
            ${(portfolioValue / 1000).toFixed(0)}K
          </div>
          <button 
            style={styles.menuButton}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            ☰
          </button>
          
          {menuOpen && (
            <div style={styles.mobileMenu}>
              <button onClick={loadData}>🚀 Load Data</button>
              <button onClick={exportPortfolio}>📤 Export</button>
              <button onClick={clearCache}>🗑️ Clear Cache</button>
            </div>
          )}
        </>
      ) : (
        <div style={styles.headerActions}>
          {/* Full action buttons */}
        </div>
      )}
    </header>
  );
};
```

---

## 11. Performance UX

### Current Issues
- Large tables can feel sluggish
- No virtualization for long lists
- Simulation progress not granular enough

### Recommendations

#### 11.1 Virtual Scrolling for Long Lists

```jsx
import { FixedSizeList } from 'react-window';

const VirtualPositionList = ({ positions, rowHeight = 48 }) => (
  <FixedSizeList
    height={400}
    width="100%"
    itemCount={positions.length}
    itemSize={rowHeight}
  >
    {({ index, style }) => (
      <div style={style}>
        <PositionRow position={positions[index]} />
      </div>
    )}
  </FixedSizeList>
);
```

#### 11.2 Debounced Search

```jsx
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
};

// Usage
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

// Filter uses debouncedSearch
const filteredPositions = useMemo(() => 
  positions.filter(p => p.ticker.includes(debouncedSearch.toUpperCase())),
  [positions, debouncedSearch]
);
```

#### 11.3 Optimistic Updates

```jsx
// Show immediate feedback while actual operation completes
const updatePosition = async (index, updates) => {
  // Optimistic update
  setPositions(prev => {
    const next = [...prev];
    next[index] = { ...next[index], ...updates };
    return next;
  });
  
  try {
    // Actual persistence
    await saveToStorage(positions);
  } catch (error) {
    // Revert on failure
    setPositions(prev => {
      const next = [...prev];
      next[index] = originalPosition;
      return next;
    });
    showToast({ type: 'error', message: 'Failed to save changes' });
  }
};
```

---

## 12. Keyboard Navigation

### Current Issues
- Can't navigate table with arrow keys
- No keyboard shortcuts for common actions
- Tab order not always logical

### Recommendations

#### 12.1 Keyboard Shortcuts

```jsx
const KeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      // Cmd/Ctrl + key shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            savePortfolio();
            break;
          case 'r':
            e.preventDefault();
            runSimulation();
            break;
          case 'e':
            e.preventDefault();
            exportPortfolio();
            break;
        }
      }
      
      // Number keys for tab switching
      if (e.key >= '1' && e.key <= '7' && !e.metaKey && !e.ctrlKey) {
        const tabIndex = parseInt(e.key) - 1;
        if (tabs[tabIndex]) {
          setActiveTab(tabs[tabIndex].id);
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  return null;
};
```

#### 12.2 Keyboard Shortcuts Help

```jsx
const ShortcutsModal = () => (
  <Modal>
    <h2>Keyboard Shortcuts</h2>
    <table style={styles.shortcutsTable}>
      <tbody>
        <tr><td><kbd>1</kbd>-<kbd>7</kbd></td><td>Switch tabs</td></tr>
        <tr><td><kbd>⌘</kbd>+<kbd>S</kbd></td><td>Save portfolio</td></tr>
        <tr><td><kbd>⌘</kbd>+<kbd>R</kbd></td><td>Run simulation</td></tr>
        <tr><td><kbd>⌘</kbd>+<kbd>E</kbd></td><td>Export</td></tr>
        <tr><td><kbd>?</kbd></td><td>Show this help</td></tr>
        <tr><td><kbd>Esc</kbd></td><td>Close modal/cancel</td></tr>
      </tbody>
    </table>
  </Modal>
);
```

---

## 13. Quick Wins (Low Effort, High Impact)

These can be implemented quickly for immediate improvement:

### 13.1 Add Loading Spinners to All Buttons
```jsx
// Currently: {isFetching ? '⏳ Loading...' : '🚀 Load'}
// Better: Add consistent spinner component
<Button loading={isFetching}>
  {isFetching ? <Spinner /> : null}
  {isFetching ? 'Loading...' : 'Load Data'}
</Button>
```

### 13.2 Add Hover States to All Interactive Elements
```css
button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 212, 255, 0.2);
}

tr:hover {
  background: rgba(0, 212, 255, 0.05);
}

.tab:hover:not(.active) {
  background: rgba(255, 255, 255, 0.05);
}
```

### 13.3 Replace alert() with Toast
```jsx
// Before
alert('Cache cleared!');

// After
showToast({ type: 'success', message: 'Cache cleared successfully' });
```

### 13.4 Add Confirmation for Destructive Actions
```jsx
// Before
onClick={() => deletePosition(index)}

// After
onClick={() => {
  if (window.confirm(`Delete ${ticker}?`)) {
    deletePosition(index);
  }
}}

// Even better: Custom confirmation modal
onClick={() => openConfirmModal({
  title: `Delete ${ticker}?`,
  message: 'This will remove the position from your portfolio.',
  confirmLabel: 'Delete',
  onConfirm: () => deletePosition(index),
})}
```

### 13.5 Add Units to All Numbers
```jsx
// Before: 0.25
// After: 0.25 (25%)

// Before: 150
// After: $150.00

// Before: 10000
// After: 10,000 paths
```

### 13.6 Add Footer Version Link
```jsx
<footer>
  Monte Carlo Simulator v6.0 • 
  <a href="#" onClick={() => setShowChangelog(true)}>What's new</a>
</footer>
```

---

## 14. Implementation Priority

### Phase 1: Foundation (Week 1)
1. ✅ Establish design tokens
2. Toast notification system
3. Replace all `alert()` calls
4. Add consistent loading states
5. Error boundary

### Phase 2: Core UX (Week 2)
1. Enhanced empty states
2. Skeleton loaders
3. Input validation feedback
4. Confirmation dialogs
5. Keyboard shortcuts

### Phase 3: Polish (Week 3)
1. Micro-interactions
2. Accessibility audit fixes
3. Responsive improvements
4. Contextual help tooltips
5. Progress state enhancements

### Phase 4: Delight (Week 4)
1. Onboarding tour
2. Chart interactivity
3. Number animations
4. Feature hints
5. Keyboard shortcut help

---

## Files to Create

Based on this analysis, these new files should be created:

```
src/
├── components/
│   ├── common/
│   │   ├── Toast.jsx           # Toast notification system
│   │   ├── Modal.jsx           # Reusable modal
│   │   ├── Skeleton.jsx        # Skeleton loaders
│   │   ├── Button.jsx          # Enhanced button
│   │   ├── Input.jsx           # Enhanced input
│   │   ├── Tooltip.jsx         # Info tooltips
│   │   ├── ConfirmDialog.jsx   # Confirmation modal
│   │   ├── EmptyState.jsx      # Empty state component
│   │   └── ErrorDisplay.jsx    # Error display component
│   └── feedback/
│       ├── ToastProvider.jsx   # Toast context
│       └── ErrorBoundary.jsx   # Error boundary
├── constants/
│   └── designTokens.js         # Design system tokens
└── hooks/
    ├── useToast.js             # Toast hook
    ├── useMediaQuery.js        # Responsive hook
    ├── useDebounce.js          # Debounce hook
    └── useKeyboardShortcuts.js # Keyboard shortcuts
```

---

*Document created: January 2026*
*This document should be reviewed and updated as improvements are implemented.*
