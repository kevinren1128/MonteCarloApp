/**
 * Chart Controls Component
 *
 * @module components/charts/ChartControls
 * @description Toolbar for chart interactions: zoom in/out, reset, comparison toggle.
 */

import React, { memo } from 'react';

const ChartControls = memo(({
  onZoomIn,
  onZoomOut,
  onReset,
  onToggleComparison,
  hasZoom = false,
  showComparison = false,
  hasComparisonData = false,
  disabled = false,
  style = {},
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Zoom controls */}
      <div style={styles.buttonGroup}>
        <button
          onClick={onZoomIn}
          disabled={disabled}
          style={styles.button}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <span style={styles.icon}>+</span>
        </button>
        <button
          onClick={onZoomOut}
          disabled={disabled}
          style={styles.button}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <span style={styles.icon}>−</span>
        </button>
        <button
          onClick={onReset}
          disabled={disabled || !hasZoom}
          style={{
            ...styles.button,
            opacity: hasZoom ? 1 : 0.5,
          }}
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          <span style={styles.icon}>⟲</span>
        </button>
      </div>

      {/* Comparison toggle */}
      {hasComparisonData && (
        <>
          <div style={styles.separator} />
          <button
            onClick={onToggleComparison}
            disabled={disabled}
            style={{
              ...styles.button,
              ...styles.toggleButton,
              background: showComparison
                ? 'rgba(0, 212, 255, 0.2)'
                : 'rgba(255, 255, 255, 0.05)',
              borderColor: showComparison
                ? 'rgba(0, 212, 255, 0.4)'
                : 'rgba(255, 255, 255, 0.1)',
              color: showComparison ? '#00d4ff' : '#888',
            }}
            title={showComparison ? 'Hide comparison' : 'Show comparison'}
            aria-label={showComparison ? 'Hide comparison' : 'Show comparison'}
            aria-pressed={showComparison}
          >
            <span style={styles.icon}>◧</span>
            <span style={styles.label}>Compare</span>
          </button>
        </>
      )}
    </div>
  );
});

const styles = {
  buttonGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '6px',
    padding: '2px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
  },

  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    padding: 0,
    border: '1px solid transparent',
    borderRadius: '4px',
    background: 'transparent',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    fontSize: '14px',
    fontFamily: 'inherit',
  },

  toggleButton: {
    width: 'auto',
    paddingLeft: '8px',
    paddingRight: '10px',
    gap: '4px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },

  icon: {
    fontSize: '14px',
    fontWeight: 'bold',
    lineHeight: 1,
  },

  label: {
    fontSize: '10px',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.3px',
  },

  separator: {
    width: '1px',
    height: '20px',
    background: 'rgba(255, 255, 255, 0.1)',
    marginLeft: '4px',
    marginRight: '4px',
  },
};

ChartControls.displayName = 'ChartControls';

export default ChartControls;
