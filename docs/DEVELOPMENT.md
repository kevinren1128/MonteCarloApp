# Development Guide

> This document provides guidelines for developing and extending the Monte Carlo Portfolio Simulator.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Project Setup](#project-setup)
3. [Development Workflow](#development-workflow)
4. [Code Style](#code-style)
5. [Adding Features](#adding-features)
6. [Testing](#testing)
7. [Performance](#performance)
8. [Debugging](#debugging)

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 1.22+
- Modern browser (Chrome, Firefox, Safari, Edge)

### Quick Start

```bash
# Clone repository
git clone <repo-url>
cd monte-carlo-app

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

---

## Project Setup

### Directory Structure

```
monte-carlo-app/
├── docs/                    # Documentation (start here!)
│   ├── ARCHITECTURE.md      # System overview
│   ├── DATA_FLOW.md         # Data flow diagrams
│   └── DEVELOPMENT.md       # This file
│
├── src/
│   ├── components/          # React components
│   │   ├── common/          # Shared UI components
│   │   ├── positions/       # Position management
│   │   ├── correlation/     # Correlation matrix
│   │   ├── factors/         # Factor analysis
│   │   ├── simulation/      # Monte Carlo simulation
│   │   └── optimization/    # Portfolio optimization
│   │
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API clients
│   ├── utils/               # Pure utility functions
│   ├── constants/           # Configuration & constants
│   ├── contexts/            # React contexts
│   ├── workers/             # Web Workers
│   │
│   ├── App.jsx              # Main application
│   └── main.jsx             # Entry point
│
├── public/                  # Static assets
├── package.json
└── vite.config.js
```

### Key Files

| File | Purpose |
|------|---------|
| `docs/ARCHITECTURE.md` | **Read this first** - system overview |
| `src/App.jsx` | Main application component |
| `src/constants/index.js` | Central configuration |
| `src/services/yahooFinance.js` | Market data API |
| `src/workers/qmcSimulationWorker.js` | Simulation engine |

---

## Development Workflow

### Branch Strategy

```
main              ← Production-ready code
  └── develop     ← Integration branch
       ├── feature/xxx    ← New features
       ├── fix/xxx        ← Bug fixes
       └── refactor/xxx   ← Code improvements
```

### Commit Messages

Follow conventional commits:

```
feat: add factor momentum calculation
fix: correct EWMA correlation for negative lambda
refactor: extract correlation utilities to separate module
docs: update architecture documentation
perf: optimize Cholesky decomposition
```

### Pull Request Process

1. Create feature branch from `develop`
2. Make changes, commit frequently
3. Update documentation if needed
4. Run tests locally
5. Create PR with clear description
6. Request review
7. Address feedback
8. Merge when approved

---

## Code Style

### JavaScript/React Style

```javascript
// ✅ Good: Functional components with hooks
const PositionRow = ({ position, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  
  const handleSave = useCallback(() => {
    // ...
  }, [position]);
  
  return (
    <div className="position-row">
      {/* ... */}
    </div>
  );
};

// ✅ Good: Named exports for utilities
export const computeCorrelation = (x, y) => {
  // ...
};

// ❌ Bad: Class components (unless necessary)
class PositionRow extends Component { /* ... */ }
```

### File Naming

```
components/
  ├── PositionTable.jsx      # PascalCase for components
  └── index.js               # Barrel exports

utils/
  ├── correlation.js         # camelCase for utilities
  └── index.js

constants/
  └── factors.js             # camelCase for config
```

### Inline Styles

This project uses inline styles rather than CSS files. Follow these patterns:

```javascript
// ✅ Good: Style objects for complex styles
const cardStyle = {
  background: '#1a1a2e',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
};

// ✅ Good: Conditional styles
<div style={{ 
  ...cardStyle, 
  border: isSelected ? '1px solid #00d4ff' : 'none' 
}}>

// ❌ Bad: Magic numbers without explanation
<div style={{ marginLeft: 47 }}>
```

---

## Adding Features

### Adding a New Tab

1. **Create component** in `src/components/[tab-name]/`:

```javascript
// src/components/backtest/BacktestTab.jsx
import React, { useState } from 'react';

const BacktestTab = ({ positions, marketData }) => {
  // Implementation
  return (
    <div>
      {/* Tab content */}
    </div>
  );
};

export default BacktestTab;
```

2. **Add to App.jsx**:

```javascript
// Import
import BacktestTab from './components/backtest/BacktestTab';

// Add tab button
<TabButton active={activeTab === 'backtest'} onClick={() => setActiveTab('backtest')}>
  📊 Backtest
</TabButton>

// Add tab content
{activeTab === 'backtest' && (
  <BacktestTab positions={positions} marketData={marketData} />
)}
```

3. **Update ARCHITECTURE.md** to document new tab

### Adding a New Factor

1. **Update constants** in `src/constants/factors.js`:

```javascript
export const FACTOR_SPREAD_DEFINITIONS = {
  // ... existing factors
  CARRY: { 
    long: 'HIGH_YIELD_ETF', 
    short: 'SPY', 
    name: 'Carry', 
    description: 'High yield premium' 
  },
};
```

2. **Add ETF to fetch list** in `src/constants/index.js`

3. **Update factor analysis** computation in relevant hooks

4. **Add to UI** in Factor Analysis tab

### Adding a New Data Source

1. **Create service** in `src/services/`:

```javascript
// src/services/alphaVantage.js
export const fetchAlphaVantageQuote = async (symbol) => {
  // Implementation
};
```

2. **Integrate into data layer** in `useMarketData` hook

3. **Add fallback logic** if primary source fails

---

## Testing

### Unit Tests

```javascript
// src/utils/__tests__/correlation.test.js
import { computeCorrelation } from '../correlation';

describe('computeCorrelation', () => {
  it('returns 1 for identical series', () => {
    const x = [1, 2, 3, 4, 5];
    expect(computeCorrelation(x, x)).toBeCloseTo(1.0);
  });
  
  it('returns -1 for perfectly inverse series', () => {
    const x = [1, 2, 3, 4, 5];
    const y = [5, 4, 3, 2, 1];
    expect(computeCorrelation(x, y)).toBeCloseTo(-1.0);
  });
  
  it('handles empty arrays', () => {
    expect(computeCorrelation([], [])).toBe(0);
  });
});
```

### Integration Tests

```javascript
// src/hooks/__tests__/useSimulation.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useSimulation } from '../useSimulation';

describe('useSimulation', () => {
  it('runs simulation and returns results', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useSimulation());
    
    act(() => {
      result.current.runSimulation({
        positions: mockPositions,
        correlationMatrix: mockCorrelation,
      });
    });
    
    await waitForNextUpdate();
    
    expect(result.current.results).toBeDefined();
    expect(result.current.results.percentiles.p50).toBeDefined();
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific file
npm test -- correlation.test.js

# Watch mode
npm test -- --watch
```

---

## Performance

### Web Workers

Heavy computations run in Web Workers to avoid blocking the UI:

```javascript
// Creating a worker
const worker = new Worker(
  new URL('../workers/simulationWorker.js', import.meta.url),
  { type: 'module' }
);

// Sending work
worker.postMessage({
  type: 'RUN_SIMULATION',
  positions,
  correlationMatrix,
  numPaths: 10000,
});

// Receiving results
worker.onmessage = (e) => {
  if (e.data.type === 'PROGRESS') {
    setProgress(e.data.completed / e.data.total);
  } else if (e.data.type === 'COMPLETE') {
    setResults(e.data.results);
  }
};
```

### Memoization

Use `useMemo` and `useCallback` for expensive computations:

```javascript
// ✅ Good: Memoize expensive calculations
const portfolioStats = useMemo(() => {
  return computePortfolioStatistics(positions, correlationMatrix);
}, [positions, correlationMatrix]);

// ✅ Good: Memoize callbacks passed to children
const handleUpdate = useCallback((index, updates) => {
  setPositions(prev => {
    const next = [...prev];
    next[index] = { ...next[index], ...updates };
    return next;
  });
}, []);
```

### Lazy Loading

Load heavy components only when needed:

```javascript
const FactorAnalysisTab = React.lazy(() => 
  import('./components/factors/FactorAnalysisTab')
);

// Usage with Suspense
<Suspense fallback={<LoadingSpinner />}>
  {activeTab === 'factors' && <FactorAnalysisTab />}
</Suspense>
```

---

## Debugging

### Console Logging

```javascript
// Development-only logging
if (process.env.NODE_ENV === 'development') {
  console.log('Correlation matrix:', correlationMatrix);
}

// Structured logging for complex data
console.log('Factor analysis:', JSON.stringify(factorData, null, 2));
```

### React DevTools

1. Install React DevTools browser extension
2. Use Components tab to inspect state
3. Use Profiler to identify slow renders

### Worker Debugging

```javascript
// In worker file
self.addEventListener('message', (e) => {
  console.log('[Worker] Received:', e.data.type);
  
  try {
    // ... processing
    console.log('[Worker] Progress:', completed, '/', total);
  } catch (error) {
    console.error('[Worker] Error:', error);
    self.postMessage({ type: 'ERROR', error: error.message });
  }
});
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Correlation matrix not PSD | Check `makeValidCorrelation()` is called |
| Yahoo API 429 errors | Reduce request frequency, use caching |
| Worker not responding | Check for infinite loops, memory leaks |
| State not updating | Ensure immutable updates with spread operator |
| localStorage full | Implement `prepareForStorage()` slim format |

---

## Environment Variables

```bash
# .env.local (not committed)
VITE_ALPHA_VANTAGE_KEY=your_api_key
VITE_DEBUG_MODE=true
```

```javascript
// Usage
const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_KEY;
const isDebug = import.meta.env.VITE_DEBUG_MODE === 'true';
```

---

## Deployment

### Build for Production

```bash
# Create optimized build
npm run build

# Preview production build locally
npm run preview
```

### Build Output

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js      # Main bundle
│   ├── index-[hash].css     # Styles (if any)
│   └── worker-[hash].js     # Web worker
```

### Deployment Checklist

- [ ] Run tests: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] No console errors in production build
- [ ] localStorage works correctly
- [ ] Workers load and run
- [ ] CORS proxies working

---

*Last updated: January 2026*
