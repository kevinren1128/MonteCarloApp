/**
 * useDocumentTitle Hook
 *
 * @module hooks/useDocumentTitle
 * @description Updates browser tab title based on app state.
 * Shows current tab, loading status, and portfolio value.
 */

import { useEffect } from 'react';

// Tab label mappings with emojis
const TAB_LABELS = {
  positions: { emoji: '📊', label: 'Positions' },
  consensus: { emoji: '📋', label: 'Consensus' },
  distributions: { emoji: '📈', label: 'Distributions' },
  correlation: { emoji: '🔗', label: 'Correlation' },
  simulation: { emoji: '🎲', label: 'Simulation' },
  factors: { emoji: '⚡', label: 'Factors' },
  optimize: { emoji: '🎯', label: 'Optimize' },
  export: { emoji: '📄', label: 'Export' },
};

// Format currency value for display (e.g., 120000 -> "$120K")
function formatCompactValue(value) {
  if (!value || value === 0) return null;

  const absValue = Math.abs(value);
  if (absValue >= 1e9) {
    return `$${(value / 1e9).toFixed(1)}B`;
  } else if (absValue >= 1e6) {
    return `$${(value / 1e6).toFixed(1)}M`;
  } else if (absValue >= 1e3) {
    return `$${(value / 1e3).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Hook to update document title based on app state
 *
 * @param {Object} options - Configuration options
 * @param {string} options.activeTab - Currently active tab ID
 * @param {boolean} options.isLoading - Whether the app is in a loading state
 * @param {number} options.portfolioValue - Current portfolio value in USD
 * @returns {void}
 *
 * @example
 * useDocumentTitle({
 *   activeTab: 'positions',
 *   isLoading: false,
 *   portfolioValue: 125000
 * });
 * // Title becomes: "📊 Positions ($125K) | factorsim"
 */
export function useDocumentTitle({ activeTab, isLoading, portfolioValue }) {
  useEffect(() => {
    const BASE_TITLE = 'factorsim';

    // Loading state takes precedence
    if (isLoading) {
      document.title = `⏳ Loading... | ${BASE_TITLE}`;
      return;
    }

    // Build title based on active tab
    const tabConfig = TAB_LABELS[activeTab];
    if (!tabConfig) {
      document.title = BASE_TITLE;
      return;
    }

    const { label } = tabConfig;

    // Format portfolio value if available and on positions tab
    let valueSuffix = '';
    if (activeTab === 'positions' && portfolioValue && portfolioValue > 0) {
      const formattedValue = formatCompactValue(portfolioValue);
      if (formattedValue) {
        valueSuffix = ` (${formattedValue})`;
      }
    }

    document.title = `${label}${valueSuffix} | factorsim`;
  }, [activeTab, isLoading, portfolioValue]);
}

export default useDocumentTitle;
