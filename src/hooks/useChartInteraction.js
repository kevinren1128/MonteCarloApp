/**
 * useChartInteraction Hook
 *
 * @module hooks/useChartInteraction
 * @description Shared state and logic for chart zoom, highlight, and comparison features.
 */

import { useState, useCallback, useMemo } from 'react';

/**
 * Hook for managing chart interaction state including zoom, selection, and comparison.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.data - Chart data array
 * @param {string} options.dataKey - Key for the main data value
 * @param {boolean} options.enableZoom - Enable zoom functionality (default: true)
 * @param {boolean} options.enableHighlight - Enable bar highlight (default: true)
 * @returns {Object} Interaction state and handlers
 */
export function useChartInteraction(options = {}) {
  const {
    data = [],
    dataKey = 'value',
    enableZoom = true,
    enableHighlight = true,
  } = options;

  // Zoom state
  const [zoomDomain, setZoomDomain] = useState(null);
  const [isZooming, setIsZooming] = useState(false);
  const [zoomStart, setZoomStart] = useState(null);

  // Selection/highlight state
  const [highlightedIndex, setHighlightedIndex] = useState(null);
  const [selectedBar, setSelectedBar] = useState(null);

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);

  // Animation state
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate data bounds
  const dataBounds = useMemo(() => {
    if (!data || data.length === 0) {
      return { min: 0, max: 100, range: 100 };
    }

    const values = data.map(d => d[dataKey]).filter(v => v !== undefined && !isNaN(v));
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      min,
      max,
      range: max - min,
    };
  }, [data, dataKey]);

  // Zoomed data
  const zoomedData = useMemo(() => {
    if (!zoomDomain || !data) return data;

    return data.filter(d => {
      const value = d[dataKey];
      return value >= zoomDomain.min && value <= zoomDomain.max;
    });
  }, [data, dataKey, zoomDomain]);

  // Zoom in (narrows range by 25%)
  const zoomIn = useCallback(() => {
    if (!enableZoom) return;

    const current = zoomDomain || dataBounds;
    const range = current.max - current.min;
    const shrink = range * 0.125;

    setZoomDomain({
      min: current.min + shrink,
      max: current.max - shrink,
    });
  }, [enableZoom, zoomDomain, dataBounds]);

  // Zoom out (expands range by 25%)
  const zoomOut = useCallback(() => {
    if (!enableZoom) return;

    const current = zoomDomain || dataBounds;
    const range = current.max - current.min;
    const expand = range * 0.167;

    setZoomDomain({
      min: Math.max(dataBounds.min, current.min - expand),
      max: Math.min(dataBounds.max, current.max + expand),
    });
  }, [enableZoom, zoomDomain, dataBounds]);

  // Reset zoom to full range
  const resetZoom = useCallback(() => {
    setZoomDomain(null);
  }, []);

  // Start brush selection
  const handleBrushStart = useCallback((startX) => {
    if (!enableZoom) return;
    setIsZooming(true);
    setZoomStart(startX);
  }, [enableZoom]);

  // End brush selection
  const handleBrushEnd = useCallback((endX) => {
    if (!enableZoom || !isZooming || zoomStart === null) {
      setIsZooming(false);
      setZoomStart(null);
      return;
    }

    const minX = Math.min(zoomStart, endX);
    const maxX = Math.max(zoomStart, endX);

    // Only zoom if selection is meaningful
    if (maxX - minX > 5) {
      setZoomDomain({
        min: minX,
        max: maxX,
      });
    }

    setIsZooming(false);
    setZoomStart(null);
  }, [enableZoom, isZooming, zoomStart]);

  // Highlight bar on hover
  const handleBarHover = useCallback((index) => {
    if (!enableHighlight) return;
    setHighlightedIndex(index);
  }, [enableHighlight]);

  // Clear highlight
  const clearHighlight = useCallback(() => {
    setHighlightedIndex(null);
  }, []);

  // Select bar on click
  const handleBarClick = useCallback((index, barData) => {
    if (selectedBar?.index === index) {
      setSelectedBar(null);
    } else {
      setSelectedBar({ index, data: barData });
    }
  }, [selectedBar]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedBar(null);
  }, []);

  // Toggle comparison overlay
  const toggleComparison = useCallback(() => {
    setShowComparison(prev => !prev);
  }, []);

  // Trigger animation
  const triggerAnimation = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
  }, []);

  return {
    // State
    zoomDomain,
    isZooming,
    highlightedIndex,
    selectedBar,
    showComparison,
    isAnimating,
    zoomedData,
    dataBounds,

    // Zoom handlers
    zoomIn,
    zoomOut,
    resetZoom,
    handleBrushStart,
    handleBrushEnd,
    hasZoom: zoomDomain !== null,

    // Highlight handlers
    handleBarHover,
    clearHighlight,

    // Selection handlers
    handleBarClick,
    clearSelection,

    // Comparison handlers
    toggleComparison,

    // Animation
    triggerAnimation,
  };
}

export default useChartInteraction;
