/**
 * LoadingProgress Component
 * 
 * @module components/common/LoadingProgress
 * @description Animated progress bar with per-item status display.
 * Shows loading progress during data fetching operations.
 */

import React from 'react';

/**
 * Animated loading progress bar
 * @param {Object} props
 * @param {number} props.current - Current progress count
 * @param {number} props.total - Total items to process
 * @param {string} props.currentItem - Name of currently processing item
 * @param {string} props.phase - Current phase description
 * @param {string} props.color - Theme color (default: cyan)
 */
const LoadingProgress = ({ 
  current, 
  total, 
  currentItem, 
  phase = 'Loading',
  color = '#00d4ff' 
}) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const scaleX = total > 0 ? current / total : 0;
  
  return (
    <div style={{
      background: '#1a1a2e',
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      {/* Header with phase and count */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '8px',
        color: '#e0e0e0',
        fontSize: '14px',
      }}>
        <span>{phase}</span>
        <span>{current} / {total}</span>
      </div>
      
      {/* Progress bar container */}
      <div style={{
        background: '#0a0a15',
        borderRadius: '4px',
        height: '8px',
        overflow: 'hidden',
        marginBottom: '8px',
      }}>
        {/* GPU-accelerated progress fill using transform: scaleX */}
        <div style={{
          width: '100%',
          height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          borderRadius: '4px',
          transform: `scaleX(${scaleX})`,
          transformOrigin: 'left',
          transition: 'transform 0.3s ease-out',
          willChange: 'transform',
          position: 'relative',
        }}>
          {/* Shimmer animation - GPU accelerated with translateX */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
            animation: 'shimmer 1.5s infinite',
            willChange: 'transform',
          }} />
        </div>
      </div>
      
      {/* Current item being processed */}
      {currentItem && (
        <div style={{ 
          color: color, 
          fontSize: '12px',
          textAlign: 'center',
          fontFamily: 'monospace',
        }}>
          {currentItem}
        </div>
      )}
      
      {/* Percentage */}
      <div style={{
        textAlign: 'center',
        color: '#888',
        fontSize: '12px',
        marginTop: '4px',
      }}>
        {percentage}%
      </div>
      
      {/* Inline keyframes for shimmer animation - uses transform for GPU */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

/**
 * Simple inline loading spinner
 * @param {Object} props
 * @param {number} props.size - Spinner size in pixels
 * @param {string} props.color - Spinner color
 */
export const LoadingSpinner = ({ size = 20, color = '#00d4ff' }) => (
  <div style={{
    width: size,
    height: size,
    border: `2px solid ${color}33`,
    borderTopColor: color,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    display: 'inline-block',
    willChange: 'transform',
  }}>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

/**
 * Loading overlay for sections
 * @param {Object} props
 * @param {string} props.message - Loading message to display
 */
export const LoadingOverlay = ({ message = 'Loading...' }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    color: '#888',
  }}>
    <LoadingSpinner size={32} />
    <div style={{ marginTop: '16px' }}>{message}</div>
  </div>
);

export default LoadingProgress;
