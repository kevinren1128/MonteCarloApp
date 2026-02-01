/**
 * Sidebar Component
 *
 * @module components/common/Sidebar
 * @description Collapsible sidebar with vertical navigation tabs.
 * Width is adjustable via click-and-drag on the right edge.
 */

import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { AnimatedPortfolioValue } from './AnimatedCounter';

// Monospace font stack
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// ============================================
// SNAP-TO-WIDTH CONFIGURATION
// ============================================

// Snap point widths
const SNAP_WIDTHS = {
  narrow: 56,   // Icons only
  medium: 180,  // Icons + short labels
  wide: 280,    // Full labels + shortcuts
};

// Threshold midpoints for snap calculation
const SNAP_THRESHOLDS = {
  narrowToMedium: 118,  // (56 + 180) / 2
  mediumToWide: 230,    // (180 + 280) / 2
};

// Legacy constants (for backwards compatibility)
const MIN_COLLAPSED_WIDTH = SNAP_WIDTHS.narrow;
const MAX_EXPANDED_WIDTH = SNAP_WIDTHS.wide;

// LocalStorage keys
const MODE_STORAGE_KEY = 'sidebar-mode';

// Snap animation timing
const SNAP_TRANSITION = 'width 180ms cubic-bezier(0.2, 0.0, 0.0, 1), min-width 180ms cubic-bezier(0.2, 0.0, 0.0, 1)';

// Calculate nearest snap mode from width
function calculateNearestSnap(width) {
  if (width <= SNAP_THRESHOLDS.narrowToMedium) return 'narrow';
  if (width <= SNAP_THRESHOLDS.mediumToWide) return 'medium';
  return 'wide';
}

// Calculate distance to nearest snap point
function getSnapDistance(width) {
  const nearest = calculateNearestSnap(width);
  return Math.abs(width - SNAP_WIDTHS[nearest]);
}

// Tab configuration with icons and short labels for medium mode
const TABS = [
  { id: 'positions', label: 'Positions', shortLabel: 'Positions', icon: '📊', shortcut: '1' },
  { id: 'consensus', label: 'Consensus', shortLabel: 'Consensus', icon: '📋', shortcut: '2' },
  { id: 'distributions', label: 'Distributions', shortLabel: 'Distribs', icon: '📈', shortcut: '3' },
  { id: 'correlation', label: 'Correlation', shortLabel: 'Correlate', icon: '🔗', shortcut: '4' },
  { id: 'simulation', label: 'Simulation', shortLabel: 'Simulate', icon: '🎲', shortcut: '5' },
  { id: 'factors', label: 'Factors', shortLabel: 'Factors', icon: '⚡', shortcut: '6' },
  { id: 'optimize', label: 'Optimize', shortLabel: 'Optimize', icon: '🎯', shortcut: '7' },
  { id: 'export', label: 'Export', shortLabel: 'Export', icon: '📄', shortcut: '8' },
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
  marketDataProgress,
  // Status indicators for tabs
  tabStatus = {},
  // Auth
  UserMenu,
  syncState,
}) => {
  // Load saved mode from localStorage
  const [sidebarMode, setSidebarMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(MODE_STORAGE_KEY);
      if (saved && ['narrow', 'medium', 'wide'].includes(saved)) {
        return saved;
      }
    }
    return isExpanded ? 'wide' : 'narrow';
  });

  // Current width (snapped or during drag)
  const [currentWidth, setCurrentWidth] = useState(SNAP_WIDTHS[sidebarMode]);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [nearestSnap, setNearestSnap] = useState(sidebarMode);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Save mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(MODE_STORAGE_KEY, sidebarMode);
    // Also update the parent's isExpanded state
    const shouldBeExpanded = sidebarMode !== 'narrow';
    if (shouldBeExpanded !== isExpanded) {
      onToggle();
    }
  }, [sidebarMode]);

  // Sync currentWidth when not dragging
  useEffect(() => {
    if (!isDragging) {
      setCurrentWidth(SNAP_WIDTHS[sidebarMode]);
    }
  }, [sidebarMode, isDragging]);

  // Handle drag start
  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = currentWidth;
    setNearestSnap(sidebarMode);
  }, [currentWidth, sidebarMode]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const delta = e.clientX - dragStartX.current;
      const rawWidth = dragStartWidth.current + delta;

      // Clamp to valid range
      const newWidth = Math.min(
        MAX_EXPANDED_WIDTH + 50, // Allow slight overshoot for feel
        Math.max(MIN_COLLAPSED_WIDTH - 10, rawWidth)
      );
      setCurrentWidth(newWidth);

      // Calculate nearest snap for visual feedback
      const nearest = calculateNearestSnap(newWidth);
      setNearestSnap(nearest);
    };

    const handleMouseUp = () => {
      // Calculate final snap mode
      const finalMode = calculateNearestSnap(currentWidth);

      // Apply snap with animation
      setSidebarMode(finalMode);
      setCurrentWidth(SNAP_WIDTHS[finalMode]);
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Change cursor while dragging
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, currentWidth]);

  // Computed values for rendering
  const sidebarWidth = currentWidth;
  const isNarrow = sidebarMode === 'narrow';
  const isMedium = sidebarMode === 'medium';
  const isWide = sidebarMode === 'wide';
  const showLabels = !isNarrow; // Show labels in medium and wide
  const showShortcuts = showLabels; // Show shortcuts in medium and wide (we have space)

  const styles = {
    sidebar: {
      width: sidebarWidth,
      minWidth: sidebarWidth,
      height: '100vh',
      background: 'linear-gradient(180deg, rgba(12, 12, 22, 0.98) 0%, rgba(8, 8, 16, 0.98) 100%)',
      borderRight: '1px solid rgba(42, 42, 74, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      // Snappy transition on release, none during drag
      transition: isDragging ? 'none' : SNAP_TRANSITION,
      position: 'relative',
      zIndex: 100,
      fontFamily: FONT_FAMILY,
      overflow: 'hidden',
    },
    header: {
      padding: showLabels ? '16px' : '16px 8px',
      borderBottom: '1px solid rgba(42, 42, 74, 0.4)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      overflow: 'hidden',
      flex: 1,
    },
    logoIcon: {
      fontSize: '20px',
      flexShrink: 0,
    },
    logoText: {
      fontSize: isMedium ? '11px' : '13px',
      fontWeight: '600',
      background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      whiteSpace: 'nowrap',
      opacity: showLabels ? 1 : 0,
      transition: showLabels ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
      letterSpacing: '0.5px',
    },
    portfolioValue: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      padding: showLabels ? (isMedium ? '8px 10px' : '10px 12px') : '0',
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.05) 100%)',
      borderRadius: '8px',
      border: showLabels ? '1px solid rgba(0, 212, 255, 0.2)' : '1px solid transparent',
      opacity: showLabels ? 1 : 0,
      maxHeight: showLabels ? '80px' : '0',
      overflow: 'hidden',
      transition: showLabels
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
      gap: showLabels ? (isMedium ? '8px' : '12px') : 0,
      padding: showLabels ? (isMedium ? '8px 10px' : '10px 12px') : '10px',
      justifyContent: showLabels ? 'flex-start' : 'center',
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
      fontSize: isMedium ? '11px' : '12px',
      fontWeight: '500',
      whiteSpace: 'nowrap',
      opacity: showLabels ? 1 : 0,
      transition: showLabels ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
      overflow: 'hidden',
    },
    tabShortcut: {
      marginLeft: 'auto',
      fontSize: '10px',
      padding: showShortcuts ? '2px 6px' : 0,
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: '4px',
      opacity: showShortcuts ? 0.6 : 0,
      width: showShortcuts ? 'auto' : 0,
      overflow: 'hidden',
      transition: showShortcuts ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
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
      minHeight: '28px', // Fixed height to prevent layout shift
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

  // Resize handle styles
  const resizeHandleStyle = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '6px',
    height: '100%',
    cursor: 'col-resize',
    background: isDragging ? 'rgba(0, 212, 255, 0.3)' : 'transparent',
    transition: isDragging ? 'none' : 'background 0.15s ease',
    zIndex: 101,
    boxShadow: isDragging && getSnapDistance(currentWidth) < 15
      ? '0 0 12px rgba(0, 212, 255, 0.5)'
      : 'none',
  };

  // Ghost line showing target snap position
  const targetSnapWidth = SNAP_WIDTHS[nearestSnap];
  const ghostLineStyle = {
    position: 'absolute',
    top: 0,
    left: targetSnapWidth - 1,
    width: '2px',
    height: '100%',
    background: getSnapDistance(currentWidth) < 15
      ? 'rgba(0, 212, 255, 0.5)'
      : 'rgba(0, 212, 255, 0.2)',
    zIndex: 99,
    pointerEvents: 'none',
    opacity: isDragging ? 1 : 0,
    transition: 'opacity 0.15s ease, background 0.15s ease',
  };

  // Floating label showing target mode
  const snapLabels = { narrow: 'Narrow', medium: 'Medium', wide: 'Wide' };
  const floatingLabelStyle = {
    position: 'absolute',
    top: '50%',
    left: targetSnapWidth + 12,
    transform: 'translateY(-50%)',
    padding: '4px 10px',
    background: 'rgba(0, 212, 255, 0.15)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    color: '#00d4ff',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    zIndex: 102,
    pointerEvents: 'none',
    opacity: isDragging && getSnapDistance(currentWidth) < 25 ? 1 : 0,
    transition: 'opacity 0.15s ease',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  };

  // Three-dot zone indicator - rendered in-flow below nav, above user section
  const ZoneIndicator = () => (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '8px 0',
      pointerEvents: 'none',
      opacity: isDragging ? 1 : 0,
      maxHeight: isDragging ? '40px' : '0',
      overflow: 'hidden',
      transition: 'opacity 0.15s ease, max-height 0.15s ease',
    }}>
      <div style={{
        display: 'flex',
        gap: '6px',
        padding: '6px 10px',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}>
        {['narrow', 'medium', 'wide'].map((mode) => (
          <div
            key={mode}
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: nearestSnap === mode
                ? 'linear-gradient(135deg, #00d4ff, #7b2ff7)'
                : 'rgba(255, 255, 255, 0.2)',
              boxShadow: nearestSnap === mode
                ? '0 0 8px rgba(0, 212, 255, 0.5)'
                : 'none',
              transition: 'all 0.15s ease',
            }}
            title={mode.charAt(0).toUpperCase() + mode.slice(1)}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div style={styles.sidebar}>
      {/* Ghost line showing target snap position */}
      <div style={ghostLineStyle} />

      {/* Floating label showing target mode */}
      <div style={floatingLabelStyle}>
        {snapLabels[nearestSnap]}
      </div>

      {/* Resize Handle - available in all modes */}
      <div
        style={resizeHandleStyle}
        onMouseDown={handleDragStart}
        onDoubleClick={() => {
          // Double-click cycles through modes: narrow → medium → wide → narrow
          const modeOrder = ['narrow', 'medium', 'wide'];
          const currentIndex = modeOrder.indexOf(sidebarMode);
          const nextIndex = (currentIndex + 1) % modeOrder.length;
          setSidebarMode(modeOrder[nextIndex]);
        }}
        onMouseEnter={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isDragging) {
            e.currentTarget.style.background = 'transparent';
          }
        }}
        title="Drag to resize (double-click to cycle modes)"
      />
      {/* Header with logo and portfolio value */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <div style={styles.logo}>
            <span style={styles.logoIcon}>📈</span>
            <span style={styles.logoText}>factorsim.xyz</span>
          </div>
        </div>

        {/* Portfolio Value - Expanded (medium/wide mode) */}
        <div style={styles.portfolioValue}>
          <span style={{
            ...styles.valueLabel,
            opacity: showLabels ? 1 : 0,
            transition: showLabels ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
          }}>{isMedium ? 'Value' : 'Portfolio Value'}</span>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '2px',
            opacity: showLabels ? 1 : 0,
            transition: showLabels ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
            minHeight: '24px', // Fixed height to prevent layout shift
            contain: 'layout', // Prevent reflows from affecting other elements
          }}>
            <AnimatedPortfolioValue
              value={portfolioValue || 0}
              isLoading={isLoading}
              style={{
                fontSize: isMedium ? '14px' : '16px',
                fontWeight: '700',
                color: '#00d4ff',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>
        </div>

        {/* Portfolio Value - Collapsed (narrow mode - compact value display) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: showLabels ? '0' : '6px 4px',
            opacity: showLabels ? 0 : 1,
            maxHeight: showLabels ? '0' : '50px',
            overflow: 'visible',
            transition: showLabels
              ? 'opacity 0.1s ease, max-height 0.25s ease, padding 0.25s ease'
              : 'opacity 0.15s ease 0.15s, max-height 0.25s ease, padding 0.25s ease',
          }}
          title={`Portfolio: ${formatCurrency(portfolioValue)}`}
        >
          <div
            style={{
              padding: '5px 6px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.1) 100%)',
              border: '1px solid rgba(0, 212, 255, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              fontSize: '9px',
              fontWeight: '700',
              color: isLoading ? 'rgba(0, 212, 255, 0.6)' : '#00d4ff',
              fontFamily: FONT_FAMILY,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
              minWidth: '36px', // Fixed minimum width to prevent layout shift
              transition: 'color 0.2s ease',
            }}
          >
            {isLoading ? '⏳' : (
              portfolioValue >= 1e9 ? `$${(portfolioValue / 1e9).toFixed(1)}B` :
              portfolioValue >= 1e6 ? `$${(portfolioValue / 1e6).toFixed(1)}M` :
              portfolioValue >= 1e3 ? `$${Math.round(portfolioValue / 1e3)}K` :
              portfolioValue > 0 ? `$${Math.round(portfolioValue)}` : '$0'
            )}
          </div>
        </div>
      </div>

      {/* Navigation tabs */}
      <nav style={styles.nav}>
        {TABS.map((tab) => {
          const status = tabStatus[tab.id];
          const hasNewContent = status?.hasNewContent;
          const isProcessing = status?.isProcessing;
          const isStale = status?.isStale;
          const tabStatusType = status?.status; // 'fresh' | 'stale' | 'blocked' | 'never'
          const isBlocked = tabStatusType === 'blocked';
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              style={{
                ...getTabStyle(tab.id),
                position: 'relative',
              }}
              onClick={() => onTabChange(tab.id)}
              title={isNarrow ? `${tab.label} (${tab.shortcut})${hasNewContent ? ' • New' : isProcessing ? ' • Processing' : isBlocked ? ' • Blocked' : isStale ? ' • Stale' : ''}` : undefined}
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
                width: showLabels ? 'auto' : 0,
                transition: showLabels ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
              }}>{isMedium ? tab.shortLabel : tab.label}</span>
              <span style={{
                ...styles.tabShortcut,
                transition: showShortcuts ? 'opacity 0.15s ease 0.15s' : 'opacity 0.1s ease',
                flexShrink: 0,
              }}>{tab.shortcut}</span>
              {/* Status indicator dots - Priority: Processing > Stale > Blocked > New Content */}
              {/* Orange pulsing dot for processing */}
              {!isActive && isProcessing && (
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
                  title="Processing..."
                />
              )}
              {/* Red dot for stale data - inputs have changed since last run (highest priority after processing) */}
              {!isActive && isStale && !isProcessing && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                    boxShadow: '0 0 6px rgba(231, 76, 60, 0.5)',
                  }}
                  title="Data is stale - inputs have changed"
                />
              )}
              {/* Yellow dot for blocked - upstream needs update first */}
              {!isActive && isBlocked && !isStale && !isProcessing && (
                <span
                  style={{
                    position: 'absolute',
                    top: '6px',
                    right: '6px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f1c40f, #f39c12)',
                    boxShadow: '0 0 6px rgba(241, 196, 15, 0.5)',
                  }}
                  title="Blocked - update upstream tabs first"
                />
              )}
              {/* Green dot for new content (lowest priority - only when not stale/blocked/processing) */}
              {!isActive && hasNewContent && !isStale && !isBlocked && !isProcessing && (
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
                  title="New content available"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Three-dot zone indicator - shown while dragging, centered below tabs */}
      <ZoneIndicator />

      {/* User Account Section with Autosave Indicator */}
      {(UserMenu || AutosaveIndicator) && (
        <div style={{
          padding: '12px 8px',
          borderTop: '1px solid rgba(42, 42, 74, 0.4)',
          display: 'flex',
          flexDirection: isNarrow ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: isNarrow ? 'center' : (showLabels ? 'space-between' : 'center'),
          gap: isNarrow ? '6px' : '8px',
          flexShrink: 0,
        }}>
          {/* In narrow mode: autosave indicator above, then user avatar centered */}
          {/* In wide mode: user avatar left, autosave indicator right */}
          {isNarrow && AutosaveIndicator && (
            <div style={{ flexShrink: 0 }}>
              <AutosaveIndicator status={autosaveStatus} compact={true} />
            </div>
          )}
          {UserMenu && <UserMenu syncState={syncState} isNarrow={isNarrow} />}
          {/* Autosave indicator - right justified next to user avatar (only in wide mode) */}
          {AutosaveIndicator && isWide && (
            <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
              <AutosaveIndicator status={autosaveStatus} compact={true} />
            </div>
          )}
        </div>
      )}

      {/* Actions Section */}
      <div style={{
        padding: '12px 8px',
        borderTop: UserMenu ? 'none' : '1px solid rgba(42, 42, 74, 0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        flexShrink: 0, // Prevent shrinking
        contain: 'layout', // Isolate from layout changes above
      }}>
        {/* Load All Button */}
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: showLabels ? 'flex-start' : 'center',
            gap: showLabels ? (isMedium ? '8px' : '10px') : 0,
            padding: showLabels ? (isMedium ? '8px 10px' : '8px 12px') : '8px',
            background: isLoading
              ? 'rgba(26, 58, 42, 0.8)'
              : 'linear-gradient(135deg, rgba(42, 106, 74, 0.8) 0%, rgba(26, 74, 58, 0.8) 100%)',
            border: '1px solid #3a8a5a',
            borderRadius: '6px',
            color: '#fff',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: isMedium ? '10px' : '11px',
            fontWeight: '600',
            fontFamily: FONT_FAMILY,
            opacity: isLoading ? 0.7 : 1,
            transition: 'all 0.25s ease',
            overflow: 'hidden',
          }}
          onClick={onLoadAll}
          disabled={isLoading}
          title={isNarrow ? 'Load All (⌘L)' : ''}
        >
          <span style={{ fontSize: '14px', flexShrink: 0 }}>{isLoading ? '⏳' : '🚀'}</span>
          <span style={{
            opacity: showLabels ? 1 : 0,
            width: showLabels ? 'auto' : 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: showLabels ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
          }}>{isLoading ? 'Loading...' : 'Load All'}</span>
          {!isLoading && showShortcuts && (
            <kbd style={{
              marginLeft: 'auto',
              padding: '1px 4px',
              fontSize: '8px',
              background: 'rgba(255,255,255,0.15)',
              borderRadius: '3px',
              border: '1px solid rgba(255,255,255,0.2)',
              opacity: 1,
              transition: 'opacity 0.15s ease 0.15s',
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
              {(() => {
                // Calculate progress: use market data progress for step 1, otherwise use step progress
                let progress = 0;
                if (loadProgress.total > 0) {
                  if (loadProgress.step === 1 && marketDataProgress?.total > 0) {
                    // During market data loading (step 1), show granular progress
                    const stepProgress = (marketDataProgress.current / marketDataProgress.total);
                    progress = (stepProgress / loadProgress.total) * 100;
                  } else {
                    progress = (loadProgress.step / loadProgress.total) * 100;
                  }
                }
                return (
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: 'linear-gradient(90deg, #00d4ff, #7b2ff7)',
                      borderRadius: '2px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                );
              })()}
            </div>
            {/* Progress text - only when showing labels (medium/wide mode) */}
            {showLabels && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                alignItems: 'center',
              }}>
                <div style={{
                  fontSize: isMedium ? '8px' : '9px',
                  color: '#00d4ff',
                  textAlign: 'center',
                }}>
                  {isMedium
                    ? `${loadProgress.step}/${loadProgress.total}`
                    : `${loadProgress.step}/${loadProgress.total} - ${loadProgress.phase}`}
                </div>
                {/* Show market data progress during step 1 or standalone market data loading */}
                {marketDataProgress?.total > 0 && isWide && (
                  <div style={{
                    fontSize: '8px',
                    color: '#7b2ff7',
                    textAlign: 'center',
                  }}>
                    {marketDataProgress.current}/{marketDataProgress.total} tickers loaded
                  </div>
                )}
                {/* Show loading ticker name - only in wide mode */}
                {marketDataProgress?.message && marketDataProgress.current < marketDataProgress.total && isWide && (
                  <div style={{
                    fontSize: '8px',
                    color: '#666',
                    textAlign: 'center',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    Loading {marketDataProgress.message}...
                  </div>
                )}
                {/* Show other phase details - only in wide mode */}
                {loadProgress.detail && (!marketDataProgress?.total || marketDataProgress.total === 0) && isWide && (
                  <div style={{
                    fontSize: '8px',
                    color: '#888',
                    textAlign: 'center',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {loadProgress.detail}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Export/Import/Reset - only show when not loading */}
        {!isLoading && (
          <div style={{
            display: 'flex',
            gap: '4px',
            flexDirection: showLabels ? 'row' : 'column',
            width: '100%',
            overflow: 'hidden',
          }}>
            <button
              style={{
                flex: showLabels ? 1 : 'none',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: showLabels ? '4px' : 0,
                padding: showLabels ? '6px 8px' : '6px',
                background: 'rgba(50, 50, 80, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: isMedium ? '8px' : '9px',
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
                opacity: showLabels ? 1 : 0,
                width: showLabels ? 'auto' : 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: showLabels ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
              }}>Export</span>
            </button>

            <label
              style={{
                flex: showLabels ? 1 : 'none',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: showLabels ? '4px' : 0,
                padding: showLabels ? '6px 8px' : '6px',
                background: 'rgba(50, 50, 80, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '5px',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: isMedium ? '8px' : '9px',
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
                opacity: showLabels ? 1 : 0,
                width: showLabels ? 'auto' : 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: showLabels ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
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
                flex: showLabels ? 1 : 'none',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: showLabels ? '4px' : 0,
                padding: showLabels ? '6px 8px' : '6px',
                background: 'rgba(90, 60, 50, 0.5)',
                border: '1px solid rgba(200, 100, 80, 0.3)',
                borderRadius: '5px',
                color: '#cc9988',
                cursor: 'pointer',
                fontSize: isMedium ? '8px' : '9px',
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
                opacity: showLabels ? 1 : 0,
                width: showLabels ? 'auto' : 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                transition: showLabels ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
              }}>Reset</span>
            </button>
          </div>
        )}
      </div>

      {/* Footer with mode toggle */}
      <div style={styles.footer}>
        <button
          style={{
            ...styles.toggleButton,
            gap: showLabels ? '8px' : 0,
            overflow: 'hidden',
          }}
          onClick={() => {
            // Cycle through modes: narrow → medium → wide → narrow
            const modeOrder = ['narrow', 'medium', 'wide'];
            const currentIndex = modeOrder.indexOf(sidebarMode);
            const nextIndex = (currentIndex + 1) % modeOrder.length;
            setSidebarMode(modeOrder[nextIndex]);
          }}
          title={`Switch to ${isNarrow ? 'medium' : isMedium ? 'wide' : 'narrow'} (Cmd+B)`}
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
            {isNarrow ? '▶' : isMedium ? '▶▶' : '◀'}
          </span>
          <span style={{
            opacity: showLabels ? 1 : 0,
            width: showLabels ? 'auto' : 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            transition: showLabels ? 'opacity 0.15s ease 0.15s, width 0.25s ease' : 'opacity 0.1s ease, width 0.25s ease',
          }}>{isMedium ? 'Expand' : 'Collapse'}</span>
        </button>
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
