# Monte Carlo Portfolio Simulator

A professional-grade Monte Carlo simulation tool for portfolio risk analysis, built with React.

![Version](https://img.shields.io/badge/version-6.3.0-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

## 🚀 Quick Start

```bash
cd monte-carlo-app
npm install
npm run dev
# Open http://localhost:5173
```

## 📚 Documentation

> **New to the codebase?** Start with [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - it's the source of truth.

| Document | Description |
|----------|-------------|
| [**ARCHITECTURE.md**](./docs/ARCHITECTURE.md) | System overview, navigation guide, key concepts |
| [DATA_FLOW.md](./docs/DATA_FLOW.md) | How data flows through the application |
| [DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Development setup and guidelines |
| [CHANGELOG.md](./CHANGELOG.md) | Complete version history |

## Features

### Portfolio Management
- **Long & Short Positions** - Full support for short selling and leverage
- **Multi-Currency** - Automatic USD conversion for international securities
- **Real-Time Prices** - Yahoo Finance integration with CORS proxy handling
- **Exposure Analysis** - Gross/net exposure charts and breakdowns

### Distribution Modeling
- **Intuitive Percentile Inputs** - Set P5, P25, P50, P75, P95 return expectations
- **Skewed Fat-Tailed Distributions** - Realistic modeling beyond normal distributions
- **Historical Estimation** - Bootstrap P5-P95 from actual market data
- **Calendar Year Returns** - View actual 2023/2024/2025 performance

### Simulation Engine
- **Correlated Returns** - Cholesky decomposition for realistic co-movement
- **Configurable Paths** - 1,000 to 100,000+ simulation paths
- **Web Worker Parallelization** - Multi-core acceleration (3-4x faster)
- **Quasi-Monte Carlo** - Low-discrepancy sequences for better accuracy
- **Contribution Attribution** - Analytical conditional expectation method
- **Drawdown Analysis** - Maximum drawdown distribution at multiple percentiles

### Portfolio Optimization (NEW in v5.3) 🎯
- **Risk Decomposition** - Marginal Contribution to Risk (MCTR) per position
- **Incremental Sharpe Analysis** - Identifies which positions help vs. hurt Sharpe ratio
- **Swap Recommendations** - Best 1% trades to improve risk-adjusted returns
- **Monte Carlo Validation** - 30,000 path validation for each recommended trade
- **Risk Parity Target** - Shows weights for equal risk contribution

### Visualization & Export
- **Interactive Charts** - Recharts-powered histograms and distributions
- **PDF Reports** - Professional multi-page reports matching dark theme
- **JSON Export** - Full data export for external analysis
- **Persistent State** - LocalStorage saves everything including simulation results

## Quick Start

```bash
# Clone or extract the project
cd monte-carlo-app

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

## Usage

### 1. Add Positions
Enter ticker symbols, quantities, and prices. Negative quantities = short positions.

### 2. Set Return Expectations
For each security, set your forward-looking return expectations:
- **P5 (Bad Year)**: "5% of outcomes worse than this" (e.g., -45%)
- **P50 (Median)**: "Expected typical outcome" (e.g., +8%)
- **P95 (Great Year)**: "5% of outcomes better than this" (e.g., +50%)

Or click **"Estimate from History"** to bootstrap from actual returns.

### 3. Review Correlations
The correlation matrix auto-populates from historical data. Edit cells directly if needed.

### 4. Run Simulation
Click **"Run Simulation"** to generate Monte Carlo paths. Results show:
- Terminal return distribution (P5 to P95)
- Dollar value projections
- Maximum drawdown risk
- Loss probabilities
- Position contribution analysis

### 5. Optimize Portfolio (NEW)
Navigate to the **"🎯 Optimize"** tab to find the best incremental trades:
- View risk decomposition (which positions contribute most to volatility)
- See Incremental Sharpe (iSharpe) showing which positions are accretive
- Get recommended 1% swaps validated with Monte Carlo simulation
- Compare against risk parity allocation
- Analysis takes ~1 minute with progress bar

### 6. Export Results
Generate a professional PDF report or download raw JSON data.

## Project Structure

```
monte-carlo-app/
├── docs/                        # 📚 Documentation (start here!)
│   ├── ARCHITECTURE.md          # System overview & navigation
│   ├── DATA_FLOW.md             # Data flow diagrams
│   └── DEVELOPMENT.md           # Development guidelines
│
├── src/
│   ├── components/              # 🧩 React Components
│   │   ├── common/              # Shared UI (BlurInput, LoadingProgress, etc.)
│   │   ├── positions/           # Position management tab
│   │   ├── correlation/         # Correlation matrix tab
│   │   ├── factors/             # Factor analysis tab
│   │   ├── simulation/          # Monte Carlo simulation tab
│   │   └── optimization/        # Portfolio optimization tab
│   │
│   ├── hooks/                   # 🎣 Custom React Hooks
│   │   ├── usePortfolio.js      # Portfolio state management
│   │   ├── useMarketData.js     # Data fetching & caching
│   │   └── useSimulation.js     # Simulation runner
│   │
│   ├── services/                # 🌐 External APIs
│   │   └── yahooFinance.js      # Yahoo Finance client
│   │
│   ├── utils/                   # 🔧 Pure Utility Functions
│   │   ├── statistics.js        # Statistical calculations
│   │   ├── quasiMonteCarlo.js   # Sobol sequences
│   │   ├── correlation.js       # Correlation matrix ops
│   │   ├── distribution.js      # Distribution functions
│   │   ├── matrix.js            # Matrix operations
│   │   └── formatting.js        # Display formatting
│   │
│   ├── constants/               # 📋 Configuration
│   │   ├── factors.js           # Fama-French factor definitions
│   │   ├── thematic.js          # Sector/thematic ETFs
│   │   ├── storage.js           # LocalStorage config
│   │   └── defaults.js          # Default values
│   │
│   ├── workers/                 # ⚡ Web Workers
│   │   ├── simulationWorker.js  # Standard Monte Carlo
│   │   └── qmcSimulationWorker.js # Quasi-Monte Carlo
│   │
│   ├── App.jsx                  # Main application component
│   └── main.jsx                 # Entry point
│
├── CHANGELOG.md                 # Version history
├── CONTRIBUTING.md              # Contribution guidelines
└── README.md                    # This file
```

## Documentation

- **[CHANGELOG.md](./CHANGELOG.md)** - Detailed version history with rationale for all changes
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Technical architecture and algorithms

## Key Dependencies

| Package | Purpose |
|---------|---------|
| react | UI framework |
| recharts | Chart visualization |
| jspdf | PDF generation |
| jspdf-autotable | PDF tables |
| vite | Build tooling |

## Mathematical Background

### Return Generation
Returns are modeled using a skewed t-distribution to capture:
- **Asymmetric outcomes** (negative skew for equities)
- **Fat tails** (extreme events more likely than normal distribution)

### Correlation Structure
Asset co-movement modeled via Cholesky decomposition:
```
R = L × Z
```
Where L is the lower triangular Cholesky factor and Z is independent standard normals.

### Contribution Attribution
Position contributions use conditional expectation:
```
E[r_i | r_portfolio = x] = μ_i + β_i × (x - E[r_portfolio])
```
Where β_i = Cov(r_i, r_portfolio) / Var(r_portfolio).

This ensures short positions show progressively negative contributions as portfolio outcomes improve (matching economic intuition).

## Browser Compatibility

Tested on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Limitations

1. **Yahoo Finance CORS** - Requires proxy; may fail if proxies are down
2. **Large Main File** - App.jsx is ~8,500 lines (refactoring in progress)
3. **No Server Persistence** - Data stored in browser localStorage only
4. **PDF Font Limitations** - Uses built-in jsPDF fonts

## Contributing

See [CHANGELOG.md](./CHANGELOG.md) for development history and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for technical details.

## Version History

Current version: **6.3.0**

Key milestones:
- v1.0: Initial Monte Carlo simulation
- v1.8: Percentile-based input (P5/P50/P95)
- v2.0: Cash/margin support, historical estimation
- v3.0: Blur-update UI, click-to-edit correlations
- v3.7: Separate distributions tab, exposure charts
- v4.0: Dynamic slider ranges, reference lines
- v4.4: PDF report export
- v4.6: Analytical contribution attribution
- v4.9: Performance optimization (50%+ faster)
- v5.0: Web Worker parallel simulation (3-4x faster)
- v5.2: Quasi-Monte Carlo with Sobol sequences
- v5.3: Portfolio optimization analysis tab
- v5.4: 2x2 distribution grid, Loss Scenario Analysis
- v6.0: Major architecture refactoring, documentation
- v6.1: Premium UI/UX, toast notifications, animations
- v6.2: Compact header, currency conversion fixes
- v6.3: International currency support, Quick Add Row fixes

See [CHANGELOG.md](./CHANGELOG.md) for complete history.

## License

MIT License - feel free to use and modify.
