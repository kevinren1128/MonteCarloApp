/**
 * Command Palette Commands
 *
 * @module constants/commands
 * @description Defines all available commands for the Cmd+K command palette.
 */

export const COMMAND_CATEGORIES = {
  NAVIGATION: 'Navigation',
  ACTIONS: 'Actions',
  EXPORT: 'Export',
  SETTINGS: 'Settings',
  HELP: 'Help',
};

/**
 * Command definitions for the command palette.
 * Each command has:
 * - id: unique identifier
 * - label: display name
 * - category: grouping category
 * - shortcut: keyboard shortcut (optional)
 * - icon: emoji/icon to display
 * - action: action identifier to execute
 * - description: brief description (for fuzzy search matching)
 */
export const COMMANDS = [
  // Navigation commands
  {
    id: 'nav-positions',
    label: 'Go to Positions',
    category: COMMAND_CATEGORIES.NAVIGATION,
    shortcut: '1',
    icon: '📋',
    action: 'navigate',
    payload: 'positions',
    description: 'Switch to positions tab view portfolio holdings',
  },
  {
    id: 'nav-distributions',
    label: 'Go to Distributions',
    category: COMMAND_CATEGORIES.NAVIGATION,
    shortcut: '2',
    icon: '📊',
    action: 'navigate',
    payload: 'distributions',
    description: 'Switch to distributions tab return expectations',
  },
  {
    id: 'nav-correlation',
    label: 'Go to Correlation',
    category: COMMAND_CATEGORIES.NAVIGATION,
    shortcut: '3',
    icon: '🔗',
    action: 'navigate',
    payload: 'correlation',
    description: 'Switch to correlation matrix tab',
  },
  {
    id: 'nav-simulation',
    label: 'Go to Simulation',
    category: COMMAND_CATEGORIES.NAVIGATION,
    shortcut: '4',
    icon: '🎲',
    action: 'navigate',
    payload: 'simulation',
    description: 'Switch to Monte Carlo simulation tab',
  },
  {
    id: 'nav-factors',
    label: 'Go to Factors',
    category: COMMAND_CATEGORIES.NAVIGATION,
    shortcut: '5',
    icon: '🧬',
    action: 'navigate',
    payload: 'factors',
    description: 'Switch to factor analysis tab',
  },
  {
    id: 'nav-optimize',
    label: 'Go to Optimize',
    category: COMMAND_CATEGORIES.NAVIGATION,
    shortcut: '6',
    icon: '⚡',
    action: 'navigate',
    payload: 'optimize',
    description: 'Switch to portfolio optimization tab',
  },
  {
    id: 'nav-export',
    label: 'Go to Export',
    category: COMMAND_CATEGORIES.NAVIGATION,
    shortcut: '7',
    icon: '📤',
    action: 'navigate',
    payload: 'export',
    description: 'Switch to export tab',
  },

  // Action commands
  {
    id: 'action-run-simulation',
    label: 'Run Simulation',
    category: COMMAND_CATEGORIES.ACTIONS,
    shortcut: '⌘R',
    icon: '▶',
    action: 'runSimulation',
    description: 'Run Monte Carlo simulation with current settings',
  },
  {
    id: 'action-load-all',
    label: 'Load All Market Data',
    category: COMMAND_CATEGORIES.ACTIONS,
    shortcut: '⌘L',
    icon: '🚀',
    action: 'loadAllData',
    description: 'Fetch all market data betas correlations distributions',
  },
  {
    id: 'action-add-position',
    label: 'Add Position',
    category: COMMAND_CATEGORIES.ACTIONS,
    icon: '➕',
    action: 'addPosition',
    description: 'Add a new position to portfolio',
  },
  {
    id: 'action-estimate-distributions',
    label: 'Estimate Distributions',
    category: COMMAND_CATEGORIES.ACTIONS,
    icon: '📈',
    action: 'estimateDistributions',
    description: 'Estimate return distributions from historical data',
  },
  {
    id: 'action-compute-correlation',
    label: 'Compute Correlation',
    category: COMMAND_CATEGORIES.ACTIONS,
    icon: '🔗',
    action: 'computeCorrelation',
    description: 'Calculate correlation matrix from price history',
  },
  {
    id: 'action-run-optimization',
    label: 'Run Optimization',
    category: COMMAND_CATEGORIES.ACTIONS,
    icon: '⚡',
    action: 'runOptimization',
    description: 'Optimize portfolio weights for Sharpe ratio',
  },

  // Export commands
  {
    id: 'export-json',
    label: 'Export to JSON',
    category: COMMAND_CATEGORIES.EXPORT,
    shortcut: '⌘S',
    icon: '💾',
    action: 'exportJson',
    description: 'Export portfolio to JSON file download',
  },
  {
    id: 'export-pdf',
    label: 'Generate PDF Report',
    category: COMMAND_CATEGORIES.EXPORT,
    icon: '📄',
    action: 'exportPdf',
    description: 'Generate PDF report of simulation results',
  },

  // Settings commands
  {
    id: 'settings-toggle-qmc',
    label: 'Toggle Quasi-Monte Carlo',
    category: COMMAND_CATEGORIES.SETTINGS,
    icon: '⊡',
    action: 'toggleQmc',
    description: 'Toggle quasi-random Sobol sequence sampling',
  },
  {
    id: 'settings-toggle-ewma',
    label: 'Toggle EWMA Weighting',
    category: COMMAND_CATEGORIES.SETTINGS,
    icon: '📉',
    action: 'toggleEwma',
    description: 'Toggle exponential weighted moving average',
  },
  {
    id: 'settings-fat-tail-studentt',
    label: 'Use Student-t Fat Tails',
    category: COMMAND_CATEGORIES.SETTINGS,
    icon: 'ν',
    action: 'setFatTail',
    payload: 'multivariateTStudent',
    description: 'Use multivariate Student-t distribution for fat tails',
  },
  {
    id: 'settings-fat-tail-copula',
    label: 'Use Gaussian Copula',
    category: COMMAND_CATEGORIES.SETTINGS,
    icon: '∑',
    action: 'setFatTail',
    payload: 'gaussianCopula',
    description: 'Use Gaussian copula with marginal fat tails',
  },

  // Help commands
  {
    id: 'help-shortcuts',
    label: 'Keyboard Shortcuts',
    category: COMMAND_CATEGORIES.HELP,
    shortcut: '?',
    icon: '⌨',
    action: 'showShortcuts',
    description: 'Show all keyboard shortcuts help',
  },
  {
    id: 'help-guide',
    label: 'User Guide',
    category: COMMAND_CATEGORIES.HELP,
    icon: '📖',
    action: 'showGuide',
    description: 'Open user guide documentation',
  },
];

export default COMMANDS;
