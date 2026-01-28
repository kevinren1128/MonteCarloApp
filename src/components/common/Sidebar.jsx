/**
 * Sidebar Component
 *
 * @module components/common/Sidebar
 * @description Collapsible sidebar with vertical navigation tabs.
 */

import React, { memo } from 'react';
import { AnimatedPortfolioValue } from './AnimatedCounter';

// Monospace font stack
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// Tab configuration with icons
const TABS = [
  { id: 'positions', label: 'Positions', icon: '📊', shortcut: '1' },
  { id: 'distributions', label: 'Distributions', icon: '📈', shortcut: '2' },
  { id: 'correlation', label: 'Correlation', icon: '🔗', shortcut: '3' },
  { id: 'factors', label: 'Factors', icon: '⚡', shortcut: '4' },
  { id: 'simulation', label: 'Simulation', icon: '🎲', shortcut: '5' },
  { id: 'optimize', label: 'Optimize', icon: '🎯', shortcut: '6' },
  { id: 'export', label: 'Export', icon: '📄', shortcut: '7' },
];

const Sidebar = memo(({
  isExpanded,
  onToggle,
  activeTab,
  onTabChange,
  portfolioValue,
  autosaveStatus,
  AutosaveIndicator,
  // Action handlers
  onLoadAll,
  onExport,
  onImport,
  onReset,
  isLoading,
  loadProgress,
  // Status indicators for tabs
  tabStatus = {},
}) => {
  const sidebarWidth = isExpanded ? 220 : 56;

  const styles = {
    sidebar: {
      width: sidebarWidth,
      minWidth: sidebarWidth,
      height: '100vh',
      background: 'linear-gradient(180deg, rgba(12, 12, 22, 0.98) 0%, rgba(8, 8, 16, 0.98) 100%)',
      borderRight: '1px solid rgba(42, 42, 74, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s ease, min-width 0.25s ease',
      position: 'relative',
      zIndex: 100,
      fontFamily: FONT_FAMILY,
      overflow: 'hidden',
    },
    header: {
      padding: isExpanded ? '16px' : '16px 8px',
      borderBottom: '1px solid rgba(42, 42, 74, 0.4)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      overflow: 'hidden',
    },
    logoIcon: {
      fontSize: '24px',
      flexShrink: 0,
    },
    logoText: {
      fontSize: '14px',
      fontWeight: '700',
      background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      whiteSpace: 'nowrap',
      opacity: isExpanded ? 1 : 0,
      transition: isExpanded ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
    },
    portfolioValue: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      padding: isExpanded ? '10px 12px' : '0',
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.05) 100%)',
      borderRadius: '8px',
      border: isExpanded ? '1px solid rgba(0, 212, 255, 0.2)' : '1px solid transparent',
      opacity: isExpanded ? 1 : 0,
      maxHeight: isExpanded ? '80px' : '0',
      overflow: 'hidden',
      transition: isExpanded
        ? 'opacity 0.2s ease 0.1s, max-height 0.25s ease, padding 0.25s ease, border-color 0.25s ease'
        : 'opacity 0.1s ease, max-height 0.25s ease, padding 0.25s ease, border-color 0.25s ease',
    },
    valueLabel: {
      fontSize: '9px',
      color: '#666',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    valueAmount: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#00d4ff',
    },
    nav: {
      flex: 1,
      padding: '12px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      overflowY: 'auto',
      overflowX: 'hidden',
    },
    tabButton: {
      display: 'flex',
      alignItems: 'center',
      gap: isExpanded ? '12px' : 0,
      padding: isExpanded ? '10px 12px' : '10px',
      justifyContent: isExpanded ? 'flex-start' : 'center',
      background: 'transparent',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.25s ease',
      fontFamily: FONT_FAMILY,
      width: '100%',
      textAlign: 'left',
      position: 'relative',
      overflow: 'hidden',
    },
    tabIcon: {
      fontSize: '18px',
      flexShrink: 0,
    },
    tabLabel: {
      fontSize: '12px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      opacity: isExpanded ? 1 : 0,
      transition: isExpanded ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
      overflow: 'hidden',
    },
    tabShortcut: {
      marginLeft: 'auto',
      fontSize: '10px',
      padding: isExpanded ? '2px 6px' : 0,
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      opacity: isExpanded ? 0.6 : 0,
      width: isExpanded ? 'auto' : 0,
      overflow: 'hidden',
      transition: isExpanded ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
    },
    footer: {
      padding: '12px 8px',
      borderTop: '1px solid rgba(42, 42, 74, 0.4)',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    toggleButton: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      padding: '8px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '6px',
      cursor: 'pointer',
      transition: 'all 0.25s ease',
      fontFamily: FONT_FAMILY,
      color: '#888',
      fontSize: '12px',
    },
    autosaveContainer: {
      display: 'flex',
      justifyContent: 'center',
      padding: '4px 0',
    },
  };

  const getTabStyle = (tabId) => ({
    ...styles.tabButton,
    background: activeTab === tabId
      ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.1) 100%)'
      : 'transparent',
    color: activeTab === tabId ? '#fff' : '#888',
    border: activeTab === tabId
      ? '1px solid rgba(0, 212, 255, 0.3)'
      : '1px solid transparent',
    boxShadow: activeTab === tabId
      ? '0 2px 8px rgba(0, 212, 255, 0.15)'
      : 'none',
  });

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div style={styles.sidebar}>
      {/* Header with logo and portfolio value */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🎲</span>
          <span style={styles.logoText}>Monte Carlo</span>
        </div>

        {/* Portfolio Value - Expanded */}
        <div style={styles.portfolioValue}>
          <span style={{
            ...styles.valueLabel,
            opacity: isExpanded ? 1 : 0,
            transition: isExpanded ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
          }}>Portfolio Value</span>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2px',
            opacity: isExpanded ? 1 : 0,
            transition: isExpanded ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
          }}>
            <AnimatedPortfolioValue
              value={portfolioValue || 0}
              style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#00d4ff',
              }}
            />
          </div>
        </div>

        {/* Portfolio Value - Collapsed (compact display) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: isExpanded ? '0' : '8px 0',
            opacity: isExpanded ? 0 : 1,
            maxHeight: isExpanded ? '0' : '50px',
            overflow: 'hidden',
            transition: isExpanded
              ? 'opacity 0.1s ease, max-height 0.25s ease, padding 0.25s ease'
              : 'opacity 0.15s ease 0.15s, max-height 0.25s ease, padding 0.25s ease',
          }}
          title={`Portfolio: ${formatCurrency(portfolioValue)}`}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.1) 100%)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              position: 'relative',
            }}
          >
            💰
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav style={styles.nav}>
        {TABS.map((tab) => {
          const status = tabStatus[tab.id];
          const hasContent = status?.hasContent;
          const needsAction = status?.needsAction;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              style={{
                ...getTabStyle(tab.id),
                position: 'relative',
              }}
              onClick={() => onTabChange(tab.id)}
              title={!isExpanded ? `${tab.label} (${tab.shortcut})${hasContent ? ' ✓' : needsAction ? ' !' : ''}` : undefined}
              onMouseOver={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = '#bbb';
                }
              }}
              onMouseOut={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#888';
                }
              }}
            >
              <span style={{ ...styles.tabIcon, flexShrink: 0 }}>{tab.icon}</span>
              <span style={{
                ...styles.tabLabel,
                width: isExpanded ? 'auto' : 0,
                transition: isExpanded ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
              }}>{tab.label}</span>
              <span style={{
                ...styles.tabShortcut,
                transition: isExpanded ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
                flexShrink: 0,
              }}>{tab.shortcut}</span>
              {/* Status indicator dot */}
              {!isActive && hasContent && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                    boxShadow: '0 0 6px rgba(46, 204, 113, 0.5)',
                  }}
                  title="Complete"
                />
              )}
              {!isActive && needsAction && !hasContent && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #ff9f43, #f39c12)',
                    boxShadow: '0 0 6px rgba(255, 159, 67, 0.5)',
                    animation: 'pulse 2s infinite',
                  }}
                  title="Action needed"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Actions Section */}
      <div style={{
        padding: '12px 8px',
        borderTop: '1px solid rgba(42, 42, 74, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}>
        {/* Load All Button */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isExpanded ? 'flex-start' : 'center',
            gap: isExpanded ? '10px' : 0,
            padding: isExpanded ? '8px 12px' : '8px',
            background: isLoading
              ? 'rgba(26, 58, 42, 0.8)'
              : 'linear-gradient(135deg, rgba(42, 106, 74, 0.8) 0%, rgba(26, 74, 58, 0.8) 100%)',
            border: '1px solid #3a8a5a',
            borderRadius: '6px',
            color: '#fff',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: '11px',
            fontWeight: '600',
            fontFamily: FONT_FAMILY,
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.25s ease',
            overflow: 'hidden',
          }}
          onClick={onLoadAll}
          disabled={isLoading}
          title={isExpanded ? '' : 'Load All (⌘L)'}
        >
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{isLoading ? '⏳' : '🚀'}</span>
          <span style={{
            opacity: isExpanded ? 1 : 0,
            width: isExpanded ? 'auto' : 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: isExpanded ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
          }}>{isLoading ? 'Loading...' : 'Load All'}</span>
          {!isLoading && (
            <kbd style={{
              marginLeft: 'auto',
              padding: '1px 4px',
              fontSize: '8px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '3px',
              border: '1px solid rgba(255,255,255,0.2)',
              opacity: isExpanded ? 1 : 0,
              transition: isExpanded ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
              flexShrink: 0,
            }}>⌘L</kbd>
          )}
        </button>

        {/* Loading Progress */}
        {isLoading && loadProgress && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '4px',
          }}>
            {/* Progress bar */}
            <div style={{
              height: '3px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div
                style={{
                  height: '100%',
                  width: `${(loadProgress.step / loadProgress.total) * 100}%`,
                  background: 'linear-gradient(90deg, #00d4ff, #7b2ff7)',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
            {/* Progress text - only when expanded */}
            {isExpanded && (
              <div style={{
                fontSize: '9px',
                color: '#00d4ff',
                textAlign: 'center',
              }}>
                {loadProgress.step}/{loadProgress.total} - {loadProgress.phase}
              </div>
            )}
          </div>
        )}

        {/* Export/Import/Reset - only show when not loading */}
        {!isLoading && (
          <div style={{
            display: 'flex',
            gap: '4px',
            flexDirection: isExpanded ? 'row' : 'column',
            width: '100%',
            overflow: 'hidden',
          }}>
            <button
              style={{
                flex: isExpanded ? 1 : 'none',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isExpanded ? '4px' : 0,
                padding: isExpanded ? '6px 8px' : '6px',
                background: 'rgba(50, 50, 80, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '9px',
                fontFamily: FONT_FAMILY,
                transition: 'all 0.25s ease',
                overflow: 'hidden',
              }}
              onClick={onExport}
              title="Export portfolio (⌘S)"
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(60, 60, 100, 0.8)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(50, 50, 80, 0.6)';
                e.currentTarget.style.color = '#aaa';
              }}
            >
              <span style={{ flexShrink: 0, fontSize: '12px' }}>📤</span>
              <span style={{
                opacity: isExpanded ? 1 : 0,
                width: isExpanded ? 'auto' : 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: isExpanded ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
              }}>Export</span>
            </button>

            <label
              style={{
                flex: isExpanded ? 1 : 'none',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isExpanded ? '4px' : 0,
                padding: isExpanded ? '6px 8px' : '6px',
                background: 'rgba(50, 50, 80, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '9px',
                fontFamily: FONT_FAMILY,
                transition: 'all 0.25s ease',
                overflow: 'hidden',
              }}
              title="Import portfolio"
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(60, 60, 100, 0.8)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(50, 50, 80, 0.6)';
                e.currentTarget.style.color = '#aaa';
              }}
            >
              <span style={{ flexShrink: 0, fontSize: '12px' }}>📥</span>
              <span style={{
                opacity: isExpanded ? 1 : 0,
                width: isExpanded ? 'auto' : 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: isExpanded ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
              }}>Import</span>
              <input
                type="file"
                accept=".json"
                onChange={onImport}
                style={{ display: 'none' }}
              />
            </label>

            <button
              style={{
                flex: isExpanded ? 1 : 'none',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isExpanded ? '4px' : 0,
                padding: isExpanded ? '6px 8px' : '6px',
                background: 'rgba(90, 60, 50, 0.5)',
                border: '1px solid rgba(200, 100, 80, 0.3)',
                borderRadius: '5px',
                color: '#cc9988',
                cursor: 'pointer',
                fontSize: '9px',
                fontFamily: FONT_FAMILY,
                transition: 'all 0.25s ease',
                overflow: 'hidden',
              }}
              onClick={onReset}
              title="Reset all data"
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(120, 70, 60, 0.7)';
                e.currentTarget.style.color = '#ffaa99';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(90, 60, 50, 0.5)';
                e.currentTarget.style.color = '#cc9988';
              }}
            >
              <span style={{ flexShrink: 0, fontSize: '12px' }}>🔄</span>
              <span style={{
                opacity: isExpanded ? 1 : 0,
                width: isExpanded ? 'auto' : 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: isExpanded ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
              }}>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer with toggle and autosave */}
      <div style={styles.footer}>
        {AutosaveIndicator && (
          <div style={styles.autosaveContainer}>
            <AutosaveIndicator status={autosaveStatus} compact={!isExpanded} />
          </div>
        )}

        <button
          style={{
            ...styles.toggleButton,
            gap: isExpanded ? '8px' : 0,
            overflow: 'hidden',
          }}
          onClick={onToggle}
          title={isExpanded ? 'Collapse sidebar (Cmd+B)' : 'Expand sidebar (Cmd+B)'}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          <span style={{ fontSize: '14px', flexShrink: 0 }}>
            {isExpanded ? '◀' : '▶'}
          </span>
          <span style={{
            opacity: isExpanded ? 1 : 0,
            width: isExpanded ? 'auto' : 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: isExpanded ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
          }}>Collapse</span>
        </button>
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
