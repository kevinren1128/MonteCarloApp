/**
 * Empty State Component
 * 
 * @module components/common/EmptyState
 * @description Displays helpful empty states when there's no data.
 * Much better than just showing a blank area or "No data".
 * 
 * Usage:
 * ```jsx
 * {positions.length === 0 && (
 *   <EmptyState
 *     icon="📊"
 *     title="No positions yet"
 *     description="Add your first position to start building your portfolio."
 *     action={{
 *       label: "Add Position",
 *       onClick: () => setShowAddModal(true),
 *     }}
 *     hint="Tip: You can add stocks, ETFs, and international securities"
 *   />
 * )}
 * ```
 */

import React from 'react';
import { colors, spacing, borderRadius, typography } from '../../constants/designTokens';

/**
 * Empty State
 * @param {Object} props
 * @param {string} props.icon - Emoji or icon to display
 * @param {string} props.title - Main title
 * @param {string} props.description - Descriptive text
 * @param {Object} props.action - Optional action button { label, onClick }
 * @param {string} props.hint - Optional tip/hint text
 * @param {Array} props.checklist - Optional checklist items [{ label, completed }]
 * @param {React.ReactNode} props.children - Optional custom content
 */
const EmptyState = ({
  icon,
  title,
  description,
  action,
  hint,
  checklist,
  children,
}) => {
  return (
    <div style={styles.container}>
      {/* Icon */}
      {icon && (
        <div style={styles.icon}>
          {icon}
        </div>
      )}
      
      {/* Title */}
      {title && (
        <h3 style={styles.title}>
          {title}
        </h3>
      )}
      
      {/* Description */}
      {description && (
        <p style={styles.description}>
          {description}
        </p>
      )}
      
      {/* Checklist */}
      {checklist && checklist.length > 0 && (
        <div style={styles.checklist}>
          {checklist.map((item, index) => (
            <div 
              key={index} 
              style={{
                ...styles.checklistItem,
                color: item.completed ? colors.success : colors.text.muted,
              }}
            >
              <span style={styles.checklistIcon}>
                {item.completed ? '✓' : '○'}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Custom content */}
      {children && (
        <div style={styles.content}>
          {children}
        </div>
      )}
      
      {/* Action button */}
      {action && (
        <button 
          style={styles.button}
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      
      {/* Hint */}
      {hint && (
        <div style={styles.hint}>
          💡 {hint}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
    textAlign: 'center',
    minHeight: '200px',
  },
  
  icon: {
    fontSize: '48px',
    marginBottom: spacing.lg,
    opacity: 0.8,
  },
  
  title: {
    margin: 0,
    marginBottom: spacing.sm,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  
  description: {
    margin: 0,
    marginBottom: spacing.lg,
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    maxWidth: '400px',
    lineHeight: typography.lineHeight.relaxed,
  },
  
  checklist: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    textAlign: 'left',
  },
  
  checklistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.sm,
    fontSize: typography.fontSize.lg,
  },
  
  checklistIcon: {
    width: '20px',
    textAlign: 'center',
  },
  
  content: {
    marginBottom: spacing.lg,
    width: '100%',
    maxWidth: '300px',
  },
  
  button: {
    padding: `${spacing.sm} ${spacing.xl}`,
    borderRadius: borderRadius.md,
    background: colors.accent.gradient,
    border: 'none',
    color: '#fff',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.mono,
    cursor: 'pointer',
    marginBottom: spacing.lg,
  },
  
  hint: {
    fontSize: typography.fontSize.sm,
    color: colors.text.muted,
    padding: `${spacing.sm} ${spacing.lg}`,
    background: colors.bg.hover,
    borderRadius: borderRadius.md,
    maxWidth: '400px',
  },
};

// Pre-built empty states for common scenarios
export const EmptyPositions = ({ onAddPosition }) => (
  <EmptyState
    icon="📊"
    title="No positions yet"
    description="Add your first position to start building your portfolio. Enter ticker symbols and quantities."
    action={onAddPosition ? { label: "Add Position", onClick: onAddPosition } : null}
    hint="You can add stocks, ETFs, and international securities"
  />
);

export const EmptyCorrelation = ({ onCompute, hasPositions }) => (
  <EmptyState
    icon="🔗"
    title="Correlation matrix not computed"
    description="Calculate the correlation matrix to see how your positions move together."
    checklist={[
      { label: 'Add at least 2 positions', completed: hasPositions },
      { label: 'Load market data', completed: false },
    ]}
    action={hasPositions ? { label: "Compute Correlation", onClick: onCompute } : null}
  />
);

export const EmptySimulation = ({ onRun, hasPositions, hasCorrelation }) => (
  <EmptyState
    icon="🎲"
    title="Ready to simulate"
    description="Run a Monte Carlo simulation to see the range of potential portfolio outcomes."
    checklist={[
      { label: 'Add positions', completed: hasPositions },
      { label: 'Compute correlation matrix', completed: hasCorrelation },
    ]}
    action={hasPositions && hasCorrelation ? { label: "Run Simulation", onClick: onRun } : null}
  />
);

export const EmptyFactors = ({ onAnalyze, hasPositions, hasData }) => (
  <EmptyState
    icon="🧬"
    title="Factor analysis not run"
    description="Decompose your portfolio returns into systematic factors to understand your exposures."
    checklist={[
      { label: 'Add positions', completed: hasPositions },
      { label: 'Load market data', completed: hasData },
    ]}
    action={hasPositions && hasData ? { label: "Run Factor Analysis", onClick: onAnalyze } : null}
  />
);

export const NoResults = ({ message = "No results found" }) => (
  <EmptyState
    icon="🔍"
    title={message}
    description="Try adjusting your search or filters."
  />
);

export const LoadingState = ({ message = "Loading..." }) => (
  <div style={styles.container}>
    <div style={{
      width: '40px',
      height: '40px',
      border: `3px solid ${colors.border.default}`,
      borderTopColor: colors.accent.primary,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      willChange: 'transform',
    }} />
    <p style={{ ...styles.description, marginTop: spacing.lg }}>
      {message}
    </p>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export default EmptyState;
