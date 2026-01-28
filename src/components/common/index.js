/**
 * Common Components Index
 * 
 * @module components/common
 * @description Reusable UI components shared across the application.
 */

// Input components
export { default as BlurInput } from './BlurInput';
export { default as PercentileInput } from './PercentileInput';
export { default as PercentileSlider } from './PercentileSlider';

// Loading/progress components
export { default as LoadingProgress, LoadingSpinner, LoadingOverlay } from './LoadingProgress';

// Skeleton loaders
export { 
  default as Skeleton,
  SkeletonText,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonCard,
  SkeletonStats,
  SkeletonChart,
  SkeletonPositionRow,
} from './Skeleton';

// Animated components
export {
  default as AnimatedCounter,
  AnimatedCurrency,
  AnimatedPercent,
  AnimatedPortfolioValue,
} from './AnimatedCounter';

// Toast notifications
export { ToastProvider, useToast, toast, setGlobalToastRef } from './Toast';

// Dialogs
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as KeyboardShortcuts } from './KeyboardShortcuts';
export { default as UserGuide } from './UserGuide';
export { default as AddPositionsModal } from './AddPositionsModal';
export { default as ScreenshotImportModal } from './ScreenshotImportModal';
export { default as CommandPalette } from './CommandPalette';
export { default as CommandItem } from './CommandItem';
export { default as RecoveryDialog } from './RecoveryDialog';

// Status indicators
export { default as AutosaveIndicator } from './AutosaveIndicator';

// Layout components
export { default as Sidebar } from './Sidebar';

// Tooltips
export { 
  default as Tooltip,
  InfoTooltip,
  HelpTooltip,
  WarningTooltip,
} from './Tooltip';

// Empty states
export { 
  default as EmptyState,
  EmptyPositions,
  EmptyCorrelation,
  EmptySimulation,
  EmptyFactors,
  NoResults,
  LoadingState,
} from './EmptyState';
