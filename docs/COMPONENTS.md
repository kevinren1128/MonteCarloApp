# Components Reference

> API reference for all React components in the Monte Carlo Portfolio Simulator.

## Table of Contents

- [Common Components](#common-components)
- [Position Components](#position-components)
- [Correlation Components](#correlation-components)
- [Simulation Components](#simulation-components)
- [Layout Components](#layout-components)

---

## Common Components

Reusable UI components shared across the application.

Location: `src/components/common/`

### BlurInput

An input that only commits its value on blur or Enter key press.

```jsx
import { BlurInput } from '../components/common';

<BlurInput
  value={100}
  onChange={(val) => console.log('New value:', val)}
  type="number"
  style={{ width: '80px' }}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string \| number` | required | Current value |
| `onChange` | `(value) => void` | required | Callback when value is committed |
| `type` | `'number' \| 'text'` | `'number'` | Input type for parsing |
| `style` | `object` | `{}` | CSS styles |

---

### PercentileInput

Specialized input for percentile values (displayed as percentages).

```jsx
import { PercentileInput } from '../components/common';

<PercentileInput
  value={0.15}  // 15%
  onChange={(val) => setPercent(val)}
  color="#22c55e"
  min={-100}
  max={200}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | required | Value as decimal (0.15 = 15%) |
| `onChange` | `(value) => void` | required | Callback with decimal value |
| `color` | `string` | `'#fff'` | Theme color |
| `min` | `number` | `-100` | Minimum percentage |
| `max` | `number` | `100` | Maximum percentage |

---

### PercentileSlider

A slider that shows real-time preview during drag but only commits on release.

```jsx
import { PercentileSlider } from '../components/common';

<PercentileSlider
  value={0.08}
  onChange={(val) => setReturn(val)}
  min={-50}
  max={100}
  color="#eab308"
  constraintMin={0.02}  // Dynamic constraint
  constraintMax={0.25}
  showValue={true}
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `number` | required | Value as decimal |
| `onChange` | `(value) => void` | required | Callback on release |
| `min` | `number` | required | Slider minimum (percentage integer) |
| `max` | `number` | required | Slider maximum (percentage integer) |
| `color` | `string` | `'#fff'` | Theme color |
| `constraintMin` | `number` | - | Dynamic min constraint (decimal) |
| `constraintMax` | `number` | - | Dynamic max constraint (decimal) |
| `showValue` | `boolean` | `false` | Show value above slider |
| `onPreview` | `(value) => void` | - | Callback during drag |

---

### LoadingProgress

Animated progress bar with current item display.

```jsx
import { LoadingProgress } from '../components/common';

<LoadingProgress
  current={5}
  total={10}
  currentItem="AAPL"
  phase="Loading market data"
  color="#00d4ff"
/>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `current` | `number` | required | Items completed |
| `total` | `number` | required | Total items |
| `currentItem` | `string` | - | Currently processing item |
| `phase` | `string` | `'Loading'` | Current phase description |
| `color` | `string` | `'#00d4ff'` | Progress bar color |

---

### LoadingSpinner

Simple inline loading spinner.

```jsx
import { LoadingSpinner } from '../components/common';

<LoadingSpinner size={24} color="#00d4ff" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `size` | `number` | `20` | Spinner diameter in pixels |
| `color` | `string` | `'#00d4ff'` | Spinner color |

---

### LoadingOverlay

Full loading overlay with spinner and message.

```jsx
import { LoadingOverlay } from '../components/common';

{isLoading && <LoadingOverlay message="Running simulation..." />}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | `string` | `'Loading...'` | Message to display |

---

## Position Components

Components for the Positions tab.

Location: `src/components/positions/`

### PositionsTable

Main table displaying all portfolio positions.

```jsx
<PositionsTable
  positions={positions}
  onUpdatePosition={(index, updates) => {...}}
  onDeletePosition={(index) => {...}}
  marketData={marketData}
  totalValue={portfolioValue}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `positions` | `Position[]` | Array of position objects |
| `onUpdatePosition` | `(index, updates) => void` | Update callback |
| `onDeletePosition` | `(index) => void` | Delete callback |
| `marketData` | `object` | Market data by ticker |
| `totalValue` | `number` | Total portfolio value |

---

### DistributionEditor

Editor for a single position's return distribution.

```jsx
<DistributionEditor
  position={position}
  onUpdate={(updates) => {...}}
  percentileColors={PERCENTILE_COLORS}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `position` | `Position` | Position object |
| `onUpdate` | `(updates) => void` | Callback with distribution updates |
| `percentileColors` | `object` | Color mapping for percentiles |

---

### DistributionGrid

2x2 grid showing distribution charts for all positions.

```jsx
<DistributionGrid
  positions={positions}
  selectedIndex={0}
  onSelect={(index) => setSelected(index)}
/>
```

---

## Correlation Components

Components for the Correlation tab.

Location: `src/components/correlation/`

### CorrelationMatrix

Interactive correlation matrix with editable cells.

```jsx
<CorrelationMatrix
  positions={positions}
  matrix={correlationMatrix}
  editedMatrix={editedCorrelation}
  onCellChange={(i, j, value) => {...}}
  positionMetadata={metadata}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `positions` | `Position[]` | Positions (for labels) |
| `matrix` | `number[][]` | Original correlation matrix |
| `editedMatrix` | `number[][]` | User-edited matrix |
| `onCellChange` | `(i, j, value) => void` | Cell edit callback |
| `positionMetadata` | `object` | Sector info for coloring |

---

### CorrelationCellInput

Click-to-edit cell for correlation values.

```jsx
<CorrelationCellInput
  value={0.75}
  onChange={(val) => updateCell(i, j, val)}
  style={{ color: getCorrelationColor(0.75) }}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `value` | `number` | Correlation value (-1 to 1) |
| `onChange` | `(value) => void` | Callback when edited |
| `style` | `object` | CSS styles |

---

### CorrelationTimeline

Shows how correlation evolved over different time periods.

```jsx
<CorrelationTimeline
  ticker1="AAPL"
  ticker2="MSFT"
  marketData={marketData}
  timePeriods={['3mo', '6mo', '1y', '2y']}
/>
```

---

## Simulation Components

Components for the Simulation tab.

Location: `src/components/simulation/`

### SimulationTab

Main simulation tab with controls and results.

```jsx
<SimulationTab
  positions={positions}
  correlationMatrix={editedCorrelation}
  results={simulationResults}
  onRunSimulation={(config) => {...}}
  isRunning={isSimulating}
  progress={progress}
/>
```

---

### ResultsChart

Histogram showing return distribution from simulation.

```jsx
<ResultsChart
  results={simulationResults}
  percentiles={[5, 25, 50, 75, 95]}
  colors={PERCENTILE_COLORS}
  showVaR={true}
/>
```

---

### ContributionChart

Bar chart showing per-position risk/return contribution.

```jsx
<ContributionChart
  contributions={simulationResults.contributions}
  totalValue={portfolioValue}
  sortBy="risk"  // 'risk' | 'return' | 'weight'
/>
```

---

## Layout Components

Structural layout components.

Location: `src/components/layout/`

### Header

Application header with title and load button.

```jsx
<Header
  title="Monte Carlo Portfolio Simulator"
  onLoadData={() => {...}}
  isLoading={isLoading}
  progress={loadingProgress}
/>
```

---

### TabBar

Tab navigation bar.

```jsx
<TabBar
  tabs={[
    { id: 'positions', label: '📊 Positions' },
    { id: 'correlation', label: '🔗 Correlation' },
    { id: 'simulation', label: '🎲 Simulation' },
  ]}
  activeTab={activeTab}
  onTabChange={(tabId) => setActiveTab(tabId)}
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `tabs` | `{id, label}[]` | Tab definitions |
| `activeTab` | `string` | Currently active tab ID |
| `onTabChange` | `(tabId) => void` | Tab change callback |

---

## Data Types

### Position

```typescript
interface Position {
  ticker: string;
  shares: number;
  price: number;
  distribution: {
    mu: number;      // Expected return
    sigma: number;   // Volatility
    skew: number;    // Skewness
    tailDf: number;  // Student-t degrees of freedom
  };
}
```

### SimulationResults

```typescript
interface SimulationResults {
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  expectedReturn: number;
  volatility: number;
  var95: number;
  var99: number;
  cvar95: number;
  contributions: Array<{
    ticker: string;
    weight: number;
    riskContrib: number;
    returnContrib: number;
  }>;
  returnDistribution: number[];
  numPaths: number;
  computeTime: number;
}
```

---

*Last updated: January 2026*
