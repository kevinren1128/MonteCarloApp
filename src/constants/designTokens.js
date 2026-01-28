/**
 * Design Tokens
 * 
 * @module constants/designTokens
 * @description Centralized design system tokens for consistent styling.
 * Use these values throughout the app instead of hardcoding colors, spacing, etc.
 */

// ===================
// SPACING
// ===================
export const spacing = {
  /** 4px */
  xs: '4px',
  /** 8px */
  sm: '8px',
  /** 12px */
  md: '12px',
  /** 16px */
  lg: '16px',
  /** 24px */
  xl: '24px',
  /** 32px */
  xxl: '32px',
  /** 48px */
  xxxl: '48px',
};

// ===================
// COLORS
// ===================
export const colors = {
  // Background layers (darker to lighter for elevation)
  bg: {
    /** #0a0a0f - Page background */
    base: '#0a0a0f',
    /** #12121f - Raised surface (cards level 1) */
    raised: '#12121f',
    /** #1a1a2e - Surface (cards level 2) */
    surface: '#1a1a2e',
    /** #242438 - Overlay (modals, dropdowns) */
    overlay: '#242438',
    /** #2a2a4a - Hover state */
    hover: '#2a2a4a',
  },
  
  // Borders
  border: {
    /** #1a1a2e - Subtle borders */
    subtle: '#1a1a2e',
    /** #2a2a4a - Default borders */
    default: '#2a2a4a',
    /** #3a3a6a - Strong/focused borders */
    strong: '#3a3a6a',
    /** rgba(0, 212, 255, 0.2) - Accent borders */
    accent: 'rgba(0, 212, 255, 0.2)',
  },
  
  // Text
  text: {
    /** #f0f0f0 - Primary text */
    primary: '#f0f0f0',
    /** #a0a0a0 - Secondary text */
    secondary: '#a0a0a0',
    /** #666666 - Muted text */
    muted: '#666666',
    /** #444444 - Disabled text */
    disabled: '#444444',
  },
  
  // Accent colors
  accent: {
    /** #00d4ff - Primary accent (cyan) */
    primary: '#00d4ff',
    /** #7b2ff7 - Secondary accent (purple) */
    secondary: '#7b2ff7',
    /** Gradient from cyan to purple */
    gradient: 'linear-gradient(135deg, #00d4ff, #7b2ff7)',
  },
  
  // Semantic colors
  /** #2ecc71 - Success green */
  success: '#2ecc71',
  /** #f39c12 - Warning orange */
  warning: '#f39c12',
  /** #e74c3c - Danger red */
  danger: '#e74c3c',
  /** #3498db - Info blue */
  info: '#3498db',
  
  // Percentile colors (for financial data)
  percentile: {
    /** #ef4444 - P5 (worst case) */
    p5: '#ef4444',
    /** #f97316 - P25 (below median) */
    p25: '#f97316',
    /** #eab308 - P50 (median) */
    p50: '#eab308',
    /** #84cc16 - P75 (above median) */
    p75: '#84cc16',
    /** #22c55e - P95 (best case) */
    p95: '#22c55e',
  },
  
  // Chart palette (for multi-series)
  chart: [
    '#00d4ff', // Cyan
    '#7b2ff7', // Purple
    '#2ecc71', // Green
    '#e74c3c', // Red
    '#f39c12', // Orange
    '#f1c40f', // Yellow
    '#9b59b6', // Violet
    '#1abc9c', // Teal
    '#e91e63', // Pink
    '#00bcd4', // Light cyan
    '#8bc34a', // Light green
    '#ff5722', // Deep orange
  ],
};

// ===================
// TYPOGRAPHY
// ===================
export const typography = {
  fontFamily: {
    /** Monospace for code/data */
    mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace",
    /** Sans-serif for UI */
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  
  fontSize: {
    /** 10px */
    xs: '10px',
    /** 11px */
    sm: '11px',
    /** 12px */
    md: '12px',
    /** 13px */
    lg: '13px',
    /** 14px */
    xl: '14px',
    /** 16px */
    xxl: '16px',
    /** 20px */
    xxxl: '20px',
    /** 24px */
    display: '24px',
    /** 28px */
    hero: '28px',
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

// ===================
// SHADOWS
// ===================
export const shadows = {
  /** Subtle shadow */
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  /** Medium shadow */
  md: '0 4px 6px rgba(0, 0, 0, 0.4)',
  /** Large shadow */
  lg: '0 8px 16px rgba(0, 0, 0, 0.5)',
  /** Extra large shadow */
  xl: '0 12px 24px rgba(0, 0, 0, 0.6)',
  /** Glow effect */
  glow: '0 0 20px rgba(0, 212, 255, 0.3)',
  /** Strong glow effect */
  glowStrong: '0 0 30px rgba(0, 212, 255, 0.5)',
  /** Inner shadow */
  inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
};

// ===================
// BORDER RADIUS
// ===================
export const borderRadius = {
  /** 4px */
  sm: '4px',
  /** 6px */
  md: '6px',
  /** 8px */
  lg: '8px',
  /** 12px */
  xl: '12px',
  /** 16px */
  xxl: '16px',
  /** Full circle */
  full: '9999px',
};

// ===================
// TRANSITIONS
// ===================
export const transitions = {
  /** 0.1s - Fast interactions */
  fast: '0.1s ease',
  /** 0.2s - Normal interactions */
  normal: '0.2s ease',
  /** 0.3s - Slower transitions */
  slow: '0.3s ease-out',
  /** Spring animation */
  spring: '0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
  /** Smooth slide */
  slide: '0.25s cubic-bezier(0.4, 0, 0.2, 1)',
};

// ===================
// Z-INDEX SCALE
// ===================
export const zIndex = {
  /** Behind content */
  behind: -1,
  /** Base content */
  base: 0,
  /** Sticky elements */
  sticky: 100,
  /** Dropdowns */
  dropdown: 200,
  /** Modals */
  modal: 300,
  /** Tooltips */
  tooltip: 400,
  /** Toast notifications */
  toast: 500,
};

// ===================
// BREAKPOINTS
// ===================
export const breakpoints = {
  /** 640px - Mobile */
  sm: '640px',
  /** 768px - Tablet */
  md: '768px',
  /** 1024px - Desktop */
  lg: '1024px',
  /** 1280px - Wide */
  xl: '1280px',
  /** 1536px - Extra wide */
  xxl: '1536px',
};

// ===================
// COMPONENT STYLES
// ===================

/**
 * Card elevation styles
 */
export const cardStyles = {
  level1: {
    background: colors.bg.raised,
    border: `1px solid ${colors.border.subtle}`,
    borderRadius: borderRadius.lg,
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

/**
 * Button styles
 */
export const buttonStyles = {
  base: {
    borderRadius: borderRadius.md,
    padding: `${spacing.sm} ${spacing.lg}`,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.mono,
    cursor: 'pointer',
    transition: transitions.normal,
    border: 'none',
  },
  primary: {
    background: colors.accent.gradient,
    color: '#fff',
  },
  secondary: {
    background: colors.bg.hover,
    border: `1px solid ${colors.border.strong}`,
    color: colors.text.primary,
  },
  danger: {
    background: 'transparent',
    color: colors.danger,
  },
  ghost: {
    background: 'transparent',
    color: colors.text.secondary,
  },
};

/**
 * Input styles
 */
export const inputStyles = {
  base: {
    background: colors.bg.base,
    border: `1px solid ${colors.border.default}`,
    borderRadius: borderRadius.sm,
    padding: `${spacing.sm} ${spacing.md}`,
    color: colors.text.primary,
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.mono,
    transition: transitions.fast,
    outline: 'none',
  },
  focus: {
    borderColor: colors.accent.primary,
    boxShadow: `0 0 0 3px ${colors.border.accent}`,
  },
  error: {
    borderColor: colors.danger,
    boxShadow: `0 0 0 3px rgba(231, 76, 60, 0.2)`,
  },
};

// ===================
// HELPER FUNCTIONS
// ===================

/**
 * Get correlation color based on value
 * @param {number} value - Correlation value (-1 to 1)
 * @returns {string} CSS color
 */
export const getCorrelationColor = (value) => {
  const intensity = Math.abs(value);
  if (value > 0) {
    return `rgba(59, 130, 246, ${intensity * 0.6 + 0.1})`; // Blue
  } else if (value < 0) {
    return `rgba(239, 68, 68, ${Math.abs(intensity) * 0.6 + 0.1})`; // Red
  }
  return 'transparent';
};

/**
 * Get return color (green for positive, red for negative)
 * @param {number} value - Return value
 * @returns {string} CSS color
 */
export const getReturnColor = (value) => {
  if (value > 0.001) return colors.success;
  if (value < -0.001) return colors.danger;
  return colors.text.muted;
};

/**
 * Get percentile color
 * @param {number} percentile - Percentile (5, 25, 50, 75, 95)
 * @returns {string} CSS color
 */
export const getPercentileColor = (percentile) => {
  const key = `p${percentile}`;
  return colors.percentile[key] || colors.text.primary;
};

export default {
  spacing,
  colors,
  typography,
  shadows,
  borderRadius,
  transitions,
  zIndex,
  breakpoints,
  cardStyles,
  buttonStyles,
  inputStyles,
  getCorrelationColor,
  getReturnColor,
  getPercentileColor,
};
