/**
 * Interactive Histogram Component
 *
 * @module components/charts/InteractiveHistogram
 * @description Enhanced histogram with zoom, highlight, and comparison overlay.
 */

import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import ChartControls from './ChartControls';
import { useChartInteraction } from '../../hooks/useChartInteraction';

// Monospace font stack
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const InteractiveHistogram = memo(({
  data,
  comparisonData = null,
  dataKey = 'pct',
  labelKey = 'label',
  valueKey = 'value',
  title,
  subtitle,
  height = 200,
  colorPositive = '#2ecc71',
  colorNegative = '#e74c3c',
  colorComparison = 'rgba(0, 212, 255, 0.3)',
  meanLine = null,
  showControls = true,
  onBarClick,
  animationKey = null,
}) => {
  // Interaction state
  const {
    zoomDomain,
    highlightedIndex,
    selectedBar,
    showComparison,
    hasZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    handleBarHover,
    clearHighlight,
    handleBarClick,
    toggleComparison,
  } = useChartInteraction({
    data,
    dataKey: valueKey,
    enableZoom: true,
    enableHighlight: true,
  });

  // Animation state for data transitions
  const [isAnimating, setIsAnimating] = useState(false);

  // Brush selection state for drag-to-zoom
  const [refAreaLeft, setRefAreaLeft] = useState(null);
  const [refAreaRight, setRefAreaRight] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Trigger animation when data changes
  useEffect(() => {
    if (animationKey !== null) {
      setIsAnimating(true);
      const timeout = setTimeout(() => setIsAnimating(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [animationKey]);

  // Filtered/zoomed data
  const displayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!zoomDomain) return data;

    // Filter data within zoom domain
    return data.filter(d => {
      const value = d[valueKey];
      return value >= zoomDomain.min && value <= zoomDomain.max;
    });
  }, [data, valueKey, zoomDomain]);

  // Handle mouse down - start selection
  const handleMouseDown = useCallback((e) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setRefAreaRight(e.activeLabel);
      setIsSelecting(true);
    }
  }, []);

  // Handle mouse move - update selection
  const handleMouseMove = useCallback((e) => {
    if (isSelecting && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  }, [isSelecting]);

  // Handle mouse up - apply zoom
  const handleMouseUp = useCallback(() => {
    if (isSelecting && refAreaLeft && refAreaRight && refAreaLeft !== refAreaRight) {
      // Find the data points corresponding to the labels
      const leftData = displayData.find(d => d[labelKey] === refAreaLeft);
      const rightData = displayData.find(d => d[labelKey] === refAreaRight);

      if (leftData && rightData) {
        const leftValue = leftData[valueKey];
        const rightValue = rightData[valueKey];
        const minVal = Math.min(leftValue, rightValue);
        const maxVal = Math.max(leftValue, rightValue);

        // Apply zoom by updating the domain
        // We need to expose setZoomDomain from useChartInteraction
        // For now, filter the data directly
        if (minVal !== maxVal) {
          // Call the zoom function with the selected range
          zoomToRange(minVal, maxVal);
        }
      }
    }

    setRefAreaLeft(null);
    setRefAreaRight(null);
    setIsSelecting(false);
  }, [isSelecting, refAreaLeft, refAreaRight, displayData, labelKey, valueKey]);

  // Zoom to a specific range - need to add this to useChartInteraction
  const [localZoomDomain, setLocalZoomDomain] = useState(null);

  const zoomToRange = useCallback((min, max) => {
    setLocalZoomDomain({ min, max });
  }, []);

  const resetLocalZoom = useCallback(() => {
    setLocalZoomDomain(null);
  }, []);

  // Combined zoom domain (from hook or local)
  const effectiveZoomDomain = localZoomDomain || zoomDomain;

  // Re-filter data with effective zoom domain
  const effectiveDisplayData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (!effectiveZoomDomain) return data;

    return data.filter(d => {
      const value = d[valueKey];
      return value >= effectiveZoomDomain.min && value <= effectiveZoomDomain.max;
    });
  }, [data, valueKey, effectiveZoomDomain]);

  // Get bar color based on value
  const getBarColor = useCallback((entry, index) => {
    const value = entry[valueKey];
    const isHighlighted = highlightedIndex === index;
    const isSelected = selectedBar?.index === index;

    let baseColor = value >= 0 ? colorPositive : colorNegative;
    let opacity = 0.8;

    if (isSelected) {
      opacity = 1;
    } else if (isHighlighted) {
      opacity = 0.95;
    } else if (highlightedIndex !== null || selectedBar !== null) {
      opacity = 0.5;
    }

    return { fill: baseColor, opacity };
  }, [valueKey, colorPositive, colorNegative, highlightedIndex, selectedBar]);

  // Custom tooltip
  const CustomTooltip = useCallback(({ active, payload }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const value = d[valueKey];

      return (
        <div
          style={{
            background: 'rgba(26, 26, 46, 0.95)',
            border: '1px solid #2a2a4a',
            padding: '10px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: FONT_FAMILY,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div
            style={{
              color: value >= 0 ? colorPositive : colorNegative,
              fontWeight: 'bold',
              marginBottom: '4px',
            }}
          >
            {d[labelKey]}
          </div>
          <div style={{ color: '#aaa' }}>
            Probability: {d[dataKey].toFixed(2)}%
          </div>
        </div>
      );
    }
    return null;
  }, [dataKey, labelKey, valueKey, colorPositive, colorNegative]);

  // Handle bar click
  const onClickBar = useCallback((entry, index) => {
    handleBarClick(index, entry);
    if (onBarClick) {
      onBarClick(entry, index);
    }
  }, [handleBarClick, onBarClick]);

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '13px',
          fontFamily: FONT_FAMILY,
        }}
      >
        No data available
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      {/* Header with title and controls */}
      {(title || showControls) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            marginBottom: '8px',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          {(title || subtitle) && (
            <div style={{ flex: 1, minWidth: 0 }}>
              {title && (
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: '#fff',
                    fontFamily: FONT_FAMILY,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </div>
              )}
              {subtitle && (
                <div
                  style={{
                    fontSize: '11px',
                    color: '#666',
                    fontFamily: FONT_FAMILY,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {subtitle}
                </div>
              )}
            </div>
          )}
          {showControls && (
            <ChartControls
              onZoomIn={zoomIn}
              onZoomOut={zoomOut}
              onReset={() => { resetZoom(); resetLocalZoom(); }}
              onToggleComparison={toggleComparison}
              hasZoom={hasZoom || !!localZoomDomain}
              showComparison={showComparison}
              hasComparisonData={!!comparisonData}
            />
          )}
        </div>
      )}

      {/* Chart */}
      <div
        style={{
          height,
          transition: isAnimating ? 'opacity 0.3s ease' : 'none',
          opacity: isAnimating ? 0.7 : 1,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={effectiveDisplayData}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              clearHighlight();
              if (isSelecting) {
                setRefAreaLeft(null);
                setRefAreaRight(null);
                setIsSelecting(false);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a4a" />
            <XAxis
              dataKey={labelKey}
              tick={{
                fontSize: 9,
                fill: '#888',
                fontFamily: FONT_FAMILY,
              }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{
                fontSize: 9,
                fill: '#888',
                fontFamily: FONT_FAMILY,
              }}
              tickFormatter={(v) => `${v.toFixed(0)}%`}
              width={35}
            />
            <Tooltip content={CustomTooltip} />

            {/* Selection area for drag-to-zoom */}
            {isSelecting && refAreaLeft && refAreaRight && (
              <ReferenceArea
                x1={refAreaLeft}
                x2={refAreaRight}
                strokeOpacity={0.3}
                fill="#00d4ff"
                fillOpacity={0.2}
              />
            )}

            {/* Mean reference line */}
            {meanLine !== undefined && meanLine !== null && (
              <ReferenceLine
                x={`${(meanLine * 100).toFixed(0)}%`}
                stroke="#00d4ff"
                strokeDasharray="5 5"
                strokeWidth={2}
              />
            )}

            {/* Comparison overlay bars */}
            {showComparison && comparisonData && (
              <Bar
                dataKey={dataKey}
                data={comparisonData}
                fill={colorComparison}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            )}

            {/* Main bars */}
            <Bar
              dataKey={dataKey}
              radius={[2, 2, 0, 0]}
              isAnimationActive={isAnimating}
              animationDuration={300}
              animationEasing="ease-out"
            >
              {effectiveDisplayData.map((entry, index) => {
                const { fill, opacity } = getBarColor(entry, index);
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={fill}
                    fillOpacity={opacity}
                    style={{ cursor: isSelecting ? 'crosshair' : 'pointer' }}
                    onMouseEnter={() => handleBarHover(index)}
                    onClick={() => onClickBar(entry, index)}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Selected bar detail */}
      {selectedBar && (
        <div
          style={{
            marginTop: '8px',
            padding: '10px 14px',
            background: 'rgba(0, 212, 255, 0.1)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: FONT_FAMILY,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={{ color: '#888' }}>Selected: </span>
            <span
              style={{
                color:
                  selectedBar.data[valueKey] >= 0 ? colorPositive : colorNegative,
                fontWeight: 600,
              }}
            >
              {selectedBar.data[labelKey]}
            </span>
            <span style={{ color: '#666', marginLeft: '12px' }}>
              ({selectedBar.data[dataKey].toFixed(2)}% of paths)
            </span>
          </div>
          <button
            onClick={() => handleBarClick(selectedBar.index, selectedBar.data)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 6px',
            }}
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>
      )}

      {/* Zoom hint */}
      {showControls && !localZoomDomain && !hasZoom && (
        <div
          style={{
            fontSize: '10px',
            color: '#555',
            textAlign: 'center',
            marginTop: '4px',
            fontFamily: FONT_FAMILY,
          }}
        >
          Drag on chart to zoom • Click bar to select
        </div>
      )}

      {/* Animation keyframes */}
      <style>
        {`
          @keyframes histogram-fade-in {
            from {
              opacity: 0;
              transform: scaleY(0.8);
            }
            to {
              opacity: 1;
              transform: scaleY(1);
            }
          }
        `}
      </style>
    </div>
  );
});

InteractiveHistogram.displayName = 'InteractiveHistogram';

export default InteractiveHistogram;
