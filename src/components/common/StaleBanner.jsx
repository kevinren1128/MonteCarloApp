/**
 * Stale Banner Component
 *
 * Displays a warning banner when tab results are stale or blocked.
 * Shows different styles and messages based on status.
 */

import React from 'react';

const StaleBanner = ({
  status,       // 'fresh' | 'stale' | 'blocked' | 'never'
  reason,       // Human-readable reason
  tabName,      // Display name of current tab
  onRerun,      // Function to re-run this tab's analysis
  rerunLabel,   // Label for re-run button (e.g., "Run Simulation")
  blockedTab,   // Name of blocking upstream tab
  onNavigate,   // Function to navigate to blocking tab
  styles,       // App styles object
}) => {
  // Don't show banner if fresh
  if (status === 'fresh') return null;

  const isBlocked = status === 'blocked';
  const isNever = status === 'never';
  const isStale = status === 'stale';

  // Colors based on status
  const colors = {
    stale: {
      bg: 'rgba(231, 76, 60, 0.12)',
      border: 'rgba(231, 76, 60, 0.3)',
      text: '#e74c3c',
      icon: '⚠️',
    },
    blocked: {
      bg: 'rgba(241, 196, 15, 0.12)',
      border: 'rgba(241, 196, 15, 0.3)',
      text: '#f1c40f',
      icon: '🔒',
    },
    never: {
      bg: 'rgba(100, 100, 100, 0.12)',
      border: 'rgba(150, 150, 150, 0.3)',
      text: '#888',
      icon: '📋',
    },
  };

  const color = colors[status] || colors.never;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      marginBottom: '16px',
      background: color.bg,
      border: `1px solid ${color.border}`,
      borderRadius: '8px',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
        <span style={{ fontSize: '18px' }}>{color.icon}</span>
        <div>
          <div style={{ fontWeight: 600, color: color.text, fontSize: '13px' }}>
            {isBlocked ? 'Blocked' : isStale ? 'Results are stale' : 'Not yet run'}
          </div>
          <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
            {reason || (isNever ? `Run ${tabName} to see results.` : 'Inputs have changed since last run.')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        {isBlocked && blockedTab && onNavigate && (
          <button
            onClick={() => onNavigate(blockedTab)}
            style={{
              ...styles?.button,
              ...styles?.buttonSecondary,
              padding: '8px 14px',
              fontSize: '12px',
            }}
          >
            Go to {blockedTab.charAt(0).toUpperCase() + blockedTab.slice(1)}
          </button>
        )}

        {(isStale || isNever) && onRerun && (
          <button
            onClick={onRerun}
            style={{
              ...styles?.button,
              padding: '8px 14px',
              fontSize: '12px',
              background: isStale ? 'linear-gradient(135deg, #e74c3c, #c0392b)' : undefined,
            }}
          >
            {rerunLabel || `Run ${tabName}`}
          </button>
        )}
      </div>
    </div>
  );
};

export default StaleBanner;
