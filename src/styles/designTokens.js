/**
 * Design Tokens
 *
 * @module styles/designTokens
 * @description Shared design system tokens for visual consistency across all tabs.
 * Based on OptimizeTab's visual language (the reference standard).
 */

// ============================================
// COLORS
// ============================================
export const COLORS = {
  // Primary accent
  cyan: '#00d4ff',
  cyanLight: 'rgba(0, 212, 255, 0.15)',
  cyanMuted: 'rgba(0, 212, 255, 0.08)',

  // Semantic colors
  green: '#2ecc71',
  greenLight: 'rgba(46, 204, 113, 0.15)',
  red: '#e74c3c',
  redLight: 'rgba(231, 76, 60, 0.15)',
  orange: '#ff9f43',
  orangeLight: 'rgba(255, 159, 67, 0.15)',

  // Secondary accents
  purple: '#9b59b6',
  purpleLight: 'rgba(123, 47, 247, 0.08)',
  blue: '#3498db',

  // Text colors
  textPrimary: '#fff',
  textSecondary: '#bbb',
  textMuted: '#888',
  textDim: '#666',

  // Background colors
  bgCard: 'rgba(22, 27, 44, 0.7)',
  bgCardHover: 'rgba(22, 27, 44, 0.85)',
  bgPremium: 'linear-gradient(135deg, rgba(22, 27, 44, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)',
  bgEmpty: 'linear-gradient(135deg, rgba(22, 27, 44, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)',
  bgInput: 'rgba(0, 0, 0, 0.25)',
  bgTableRow: 'rgba(0, 212, 255, 0.04)',
  bgHeaderGradient: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.08) 100%)',

  // Border colors
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.1)',
  borderAccent: 'rgba(0, 212, 255, 0.12)',
  borderAccentMuted: 'rgba(0, 212, 255, 0.08)',
};

// ============================================
// TYPOGRAPHY
// ============================================
export const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

export const TYPOGRAPHY = {
  // Headers
  h1: { fontSize: '18px', fontWeight: '700', color: COLORS.textPrimary },
  h2: { fontSize: '15px', fontWeight: '600', color: COLORS.textPrimary },
  h3: { fontSize: '14px', fontWeight: '600', color: COLORS.textPrimary },

  // Body text
  body: { fontSize: '12px', fontWeight: '400', color: COLORS.textSecondary },
  bodySmall: { fontSize: '11px', fontWeight: '400', color: COLORS.textMuted },

  // Labels
  label: {
    fontSize: '10px',
    fontWeight: '500',
    color: COLORS.textDim,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  labelSmall: {
    fontSize: '9px',
    fontWeight: '500',
    color: COLORS.textDim,
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },

  // Metrics/Values
  metric: { fontSize: '24px', fontWeight: '700', fontFamily: FONT_FAMILY },
  metricLarge: { fontSize: '28px', fontWeight: '700', fontFamily: FONT_FAMILY },
  metricSmall: { fontSize: '20px', fontWeight: '700', fontFamily: FONT_FAMILY },
};

// ============================================
// SPACING
// ============================================
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  xxl: '24px',
};

// ============================================
// CARD STYLES
// ============================================
export const CARD_STYLES = {
  // Standard card (most common)
  standard: {
    background: COLORS.bgCard,
    borderRadius: '14px',
    border: `1px solid ${COLORS.borderSubtle}`,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    fontFamily: FONT_FAMILY,
  },

  // Premium/Header card (for settings panels, key sections)
  premium: {
    background: COLORS.bgPremium,
    borderRadius: '16px',
    border: `1px solid ${COLORS.borderAccent}`,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    fontFamily: FONT_FAMILY,
    overflow: 'hidden',
  },

  // Empty state card
  empty: {
    background: COLORS.bgEmpty,
    borderRadius: '16px',
    border: `1px solid ${COLORS.borderAccentMuted}`,
    padding: '50px 24px',
    marginBottom: SPACING.lg,
    textAlign: 'center',
    fontFamily: FONT_FAMILY,
  },

  // Compact/inline card (for nested elements)
  compact: {
    background: COLORS.bgInput,
    borderRadius: '10px',
    border: `1px solid ${COLORS.borderSubtle}`,
    padding: SPACING.md,
    fontFamily: FONT_FAMILY,
  },
};

// ============================================
// HEADER STYLES
// ============================================
export const HEADER_STYLES = {
  // Card header with title and actions
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottom: `1px solid ${COLORS.borderSubtle}`,
  },

  // Card title
  cardTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: SPACING.sm,
    ...TYPOGRAPHY.h3,
  },

  // Section title (smaller)
  sectionTitle: {
    ...TYPOGRAPHY.label,
    marginBottom: SPACING.sm,
  },
};

// ============================================
// BUTTON STYLES
// ============================================
export const BUTTON_STYLES = {
  // Primary action button
  primary: {
    background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    padding: '12px 24px',
    fontSize: '12px',
    fontWeight: '600',
    fontFamily: FONT_FAMILY,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 15px rgba(0, 212, 255, 0.25)',
  },

  // Secondary button
  secondary: {
    background: 'transparent',
    color: COLORS.textMuted,
    border: `1px solid ${COLORS.borderLight}`,
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: '500',
    fontFamily: FONT_FAMILY,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // Small/compact button
  compact: {
    background: 'transparent',
    color: COLORS.textMuted,
    border: `1px solid ${COLORS.borderSubtle}`,
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '10px',
    fontWeight: '500',
    fontFamily: FONT_FAMILY,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  // Disabled state
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
};

// ============================================
// TABLE STYLES
// ============================================
export const TABLE_STYLES = {
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: FONT_FAMILY,
  },

  th: {
    textAlign: 'left',
    padding: `${SPACING.md} ${SPACING.sm}`,
    borderBottom: `1px solid ${COLORS.borderSubtle}`,
    ...TYPOGRAPHY.label,
  },

  td: {
    padding: `${SPACING.md} ${SPACING.sm}`,
    borderBottom: `1px solid rgba(255, 255, 255, 0.03)`,
    ...TYPOGRAPHY.body,
  },

  rowHover: {
    background: COLORS.bgTableRow,
  },
};

// ============================================
// INPUT STYLES
// ============================================
export const INPUT_STYLES = {
  standard: {
    background: 'rgba(0, 0, 0, 0.3)',
    border: `1px solid ${COLORS.borderSubtle}`,
    borderRadius: '8px',
    padding: '10px 14px',
    color: COLORS.textPrimary,
    fontSize: '12px',
    fontFamily: FONT_FAMILY,
    width: '100%',
    transition: 'all 0.2s ease',
    outline: 'none',
  },

  small: {
    padding: '6px 10px',
    fontSize: '11px',
    borderRadius: '6px',
  },

  focus: {
    borderColor: COLORS.cyan,
    boxShadow: `0 0 0 2px ${COLORS.cyanMuted}`,
  },
};

// ============================================
// EMPTY STATE STYLES
// ============================================
export const EMPTY_STATE_STYLES = {
  container: {
    ...CARD_STYLES.empty,
  },

  iconContainer: {
    width: '80px',
    height: '80px',
    borderRadius: '20px',
    background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.15) 100%)',
    border: `1px solid ${COLORS.borderAccentMuted}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },

  icon: {
    fontSize: '32px',
  },

  title: {
    ...TYPOGRAPHY.h1,
    marginBottom: SPACING.sm,
  },

  subtitle: {
    ...TYPOGRAPHY.body,
    marginBottom: SPACING.xl,
    maxWidth: '400px',
    margin: '0 auto',
    lineHeight: '1.6',
  },
};

// ============================================
// TRANSITIONS
// ============================================
export const TRANSITIONS = {
  fast: 'all 0.15s ease',
  standard: 'all 0.2s ease',
  slow: 'all 0.3s ease',
};

// ============================================
// SHADOWS
// ============================================
export const SHADOWS = {
  none: 'none',
  subtle: '0 2px 8px rgba(0, 0, 0, 0.15)',
  standard: '0 4px 16px rgba(0, 0, 0, 0.2)',
  elevated: '0 8px 32px rgba(0, 0, 0, 0.3)',
  glow: '0 0 20px rgba(0, 212, 255, 0.2)',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get color based on value (positive = green, negative = red)
 */
export const getValueColor = (value, neutral = COLORS.textMuted) => {
  if (value > 0) return COLORS.green;
  if (value < 0) return COLORS.red;
  return neutral;
};

/**
 * Format percentage with sign
 */
export const formatPctWithSign = (value, decimals = 1) => {
  if (value == null || !isFinite(value)) return '-';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(decimals)}%`;
};

/**
 * Get heatmap color based on value intensity
 */
export const getHeatmapColor = (value, max = 0.1) => {
  if (value === 0) return 'transparent';
  const intensity = Math.min(1, Math.abs(value) / max);
  return value > 0
    ? `rgba(46, 204, 113, ${0.15 + intensity * 0.5})`
    : `rgba(231, 76, 60, ${0.15 + intensity * 0.5})`;
};

export default {
  COLORS,
  FONT_FAMILY,
  TYPOGRAPHY,
  SPACING,
  CARD_STYLES,
  HEADER_STYLES,
  BUTTON_STYLES,
  TABLE_STYLES,
  INPUT_STYLES,
  EMPTY_STATE_STYLES,
  TRANSITIONS,
  SHADOWS,
  getValueColor,
  formatPctWithSign,
  getHeatmapColor,
};
