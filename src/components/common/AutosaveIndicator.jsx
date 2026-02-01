/**
 * Autosave Indicator Component
 *
 * @module components/common/AutosaveIndicator
 * @description Shows autosave status (saving/saved/error) in the UI.
 */

import React, { memo, useMemo } from 'react';
import { AutosaveStatus } from '../../hooks/useAutosave';

const AutosaveIndicator = memo(({
  status,
  lastSaved,
  error,
  style = {},
  compact = false, // When true, show only icon (for narrow sidebar)
}) => {
  // Format last saved time
  const formattedTime = useMemo(() => {
    if (!lastSaved) return null;

    const now = new Date();
    const diff = now - lastSaved;

    if (diff < 5000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;

    return lastSaved.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [lastSaved]);

  // Get status display
  const statusDisplay = useMemo(() => {
    switch (status) {
      case AutosaveStatus.SAVING:
        return {
          icon: '⏳',
          text: 'Saving...',
          color: '#ff9f43',
          animate: true,
        };

      case AutosaveStatus.SAVED:
        return {
          icon: '✓',
          text: formattedTime ? `Saved ${formattedTime}` : 'Saved',
          color: '#2ecc71',
          animate: false,
        };

      case AutosaveStatus.ERROR:
        return {
          icon: '⚠',
          text: 'Save failed',
          color: '#e74c3c',
          animate: false,
        };

      case AutosaveStatus.IDLE:
      default:
        return formattedTime
          ? {
              icon: '💾',
              text: `Last saved ${formattedTime}`,
              color: '#666',
              animate: false,
            }
          : null;
    }
  }, [status, formattedTime]);

  // Don't render if nothing to show
  if (!statusDisplay) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? '0' : '6px',
        padding: compact ? '4px 6px' : '4px 10px',
        borderRadius: '6px',
        background: `${statusDisplay.color}15`,
        border: `1px solid ${statusDisplay.color}30`,
        fontSize: '11px',
        color: statusDisplay.color,
        transition: 'all 0.2s ease',
        ...style,
      }}
      title={compact ? statusDisplay.text : (error ? `Error: ${error.message}` : undefined)}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          animation: statusDisplay.animate ? 'autosave-pulse 1s infinite' : 'none',
        }}
      >
        {statusDisplay.icon}
      </span>
      {!compact && <span style={{ fontWeight: 500 }}>{statusDisplay.text}</span>}

      {/* CSS animation for saving state */}
      <style>
        {`
          @keyframes autosave-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
});

AutosaveIndicator.displayName = 'AutosaveIndicator';

export default AutosaveIndicator;
