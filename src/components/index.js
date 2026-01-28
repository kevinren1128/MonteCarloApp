/**
 * Components Index
 * 
 * @module components
 * @description Central export for all React components.
 * 
 * Usage:
 * ```javascript
 * import { BlurInput, LoadingProgress } from '../components';
 * ```
 */

// Common/shared components
export * from './common';

// Chart components
export * from './charts';

// Feature-specific components (export as available)
// export * from './positions';
export * from './correlation';
export * from './tabs';
// export * from './factors';
// export * from './simulation';
// export * from './optimization';
// export * from './layout';

/**
 * COMPONENT ORGANIZATION
 * ======================
 * 
 * Components are organized by feature/tab:
 * 
 * common/          - Shared UI components (BlurInput, LoadingProgress, etc.)
 * positions/       - Position table, distribution editors
 * correlation/     - Correlation matrix, cell inputs, timeline
 * factors/         - Factor analysis tab
 * simulation/      - Monte Carlo results, charts
 * optimization/    - Portfolio optimization
 * layout/          - Header, TabBar, navigation
 * 
 * Each directory should have:
 * - ComponentName.jsx - Main component
 * - index.js - Barrel export
 * - Related sub-components
 * 
 * COMPONENT GUIDELINES:
 * 1. Functional components with hooks only
 * 2. Props documented with JSDoc
 * 3. Inline styles (no CSS files)
 * 4. Memoize with React.memo if rendering is expensive
 */
