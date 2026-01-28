# Contributing to Monte Carlo Portfolio Simulator

## Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Code Organization

### Current Structure
The application is primarily contained in `src/App.jsx` (~8,500 lines). Components are being gradually extracted to `src/components/`.

### Extracted Modules

```
src/
├── components/
│   ├── common/           # Shared UI (Toast, AnimatedCounter, Tooltip, etc.)
│   ├── tabs/             # Tab content (PositionsTab, SimulationTab, etc.)
│   ├── pdf/              # PDF report generation
│   └── correlation/      # Correlation matrix components
├── services/
│   └── yahooFinance.js   # Yahoo Finance API client
├── utils/
│   ├── statistics.js     # Mathematical functions
│   ├── correlation.js    # Correlation calculations
│   ├── distribution.js   # Distribution fitting
│   ├── matrix.js         # Matrix operations
│   ├── chartUtils.js     # Chart data generation
│   └── formatting.js     # Display formatting
├── constants/
│   ├── factors.js        # Fama-French factor definitions
│   ├── thematic.js       # Sector/thematic ETF mappings
│   ├── storage.js        # LocalStorage configuration
│   ├── defaults.js       # Default values
│   └── designTokens.js   # Design system tokens
├── hooks/
│   └── useLocalStorage.js # LocalStorage hook
├── contexts/
│   └── AppContext.js     # Application context
├── styles/
│   └── appStyles.js      # Extracted style definitions
└── workers/
    ├── simulationWorker.js    # Standard Monte Carlo
    └── qmcSimulationWorker.js # Quasi-Monte Carlo
```

## Making Changes

### 1. Read the Changelog
Before making changes, review `CHANGELOG.md` to understand:
- What features exist
- Why decisions were made
- Known issues and limitations

### 2. Understand the Data Flow
See `docs/ARCHITECTURE.md` for:
- State management patterns
- Simulation algorithm details
- Key data structures

### 3. Testing Changes
Currently no automated tests. Manual testing checklist:

**Portfolio Management:**
- [ ] Add/remove positions
- [ ] Edit quantities (positive and negative)
- [ ] Currency conversion works
- [ ] Price fetch works

**Distribution Inputs:**
- [ ] Sliders update in real-time
- [ ] Percentile constraints enforced (P5 < P25 < P50 < P75 < P95)
- [ ] "Estimate from History" works
- [ ] Distribution preview chart updates

**Correlation:**
- [ ] Matrix loads from Yahoo Finance
- [ ] Click-to-edit works
- [ ] Shrinkage toggle works
- [ ] Groups/sectors display correctly

**Simulation:**
- [ ] Run completes without NaN errors
- [ ] Results persist after refresh
- [ ] Contribution analysis makes sense (shorts negative in good outcomes)
- [ ] Charts render correctly

**Export:**
- [ ] PDF generates and downloads
- [ ] PDF styling matches app theme
- [ ] JSON export contains all data

### 4. Version Bumping
Update in 3 places:
1. `package.json` - "version" field
2. `src/App.jsx` - footer text (search for "Professional Edition")
3. `CHANGELOG.md` - add new entry at top

Format:
```json
// package.json
"version": "X.Y.Z"
```

```jsx
// App.jsx footer
Monte Carlo Simulator vX.Y • Professional Edition
```

### 5. Changelog Entry
Every change should be documented in `CHANGELOG.md`:

```markdown
## [X.Y] - YYYY-MM-DD

### Added/Changed/Fixed/Removed
**Feature Name**
Brief description of what and why.

**Implementation details** (if complex):
- Technical approach
- Trade-offs considered
```

## Code Style

### General
- Use functional components with hooks
- Prefer `useMemo` and `useCallback` for expensive operations
- Inline styles (no CSS files)

### State Management
```javascript
// Good: Colocate related state
const [simulationResults, setSimulationResults] = useState(null);
const [isSimulating, setIsSimulating] = useState(false);

// Good: Derive values with useMemo
const portfolioValue = useMemo(() => {
  return positions.reduce((sum, p) => sum + p.quantity * p.price, 0);
}, [positions]);
```

### Error Handling
```javascript
// Good: Comprehensive safeguards
const result = someCalculation();
if (!isFinite(result)) {
  console.warn('Invalid result, using fallback');
  return fallbackValue;
}
return result;
```

### Performance
```javascript
// Good: Memoize heavy computations
const histogramData = useMemo(() => {
  return generateHistogram(simulationResults);
}, [simulationResults]);

// Good: Use BlurInput for lag-free editing
<BlurInput
  value={position.price}
  onChange={(v) => updatePrice(position.id, v)}
/>
```

## Common Issues

### NaN in Simulation
Usually caused by:
1. Division by zero (check weights, portfolio value)
2. Invalid correlation matrix (ensure positive definite)
3. Extreme percentile inputs

**Solution:** Add `isFinite()` checks and fallbacks.

### CORS Errors
Yahoo Finance blocks browser requests.

**Solution:** All requests go through proxies in `CORS_PROXIES` array. If all fail, add a new proxy.

### localStorage Quota
Large simulation results can exceed ~5MB limit.

**Solution:** `trimDistribution()` function samples arrays to max 1000 points.

## Future Improvements

### High Priority
1. **Unit Tests** - Add Jest tests for statistics.js functions
2. **Component Extraction** - Continue splitting App.jsx into smaller components

### Medium Priority
1. **State Management** - Consider Zustand for cleaner state
2. **Scenario Analysis** - Add stress testing capabilities
3. **Multi-period Simulation** - Rebalancing support

### Low Priority
1. **Server Persistence** - Cloud save/load
2. **Options Support** - Derivatives modeling
3. **Real-time Data** - WebSocket price updates

## Questions?

Review the conversation history in `/mnt/transcripts/` for context on past decisions.
