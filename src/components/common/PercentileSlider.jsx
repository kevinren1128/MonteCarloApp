/**
 * PercentileSlider Component
 * 
 * @module components/common/PercentileSlider
 * @description A slider that only commits value on release, showing real-time preview during drag.
 * Used for adjusting distribution percentiles without causing lag.
 */

import React, { useState, useEffect } from 'react';

/**
 * Slider that commits value only on mouse/touch release
 * @param {Object} props
 * @param {number} props.value - Current value (as decimal, e.g., 0.15 for 15%)
 * @param {Function} props.onChange - Callback when value is committed
 * @param {number} props.min - Minimum slider value (as percentage integer)
 * @param {number} props.max - Maximum slider value (as percentage integer)
 * @param {string} props.color - Theme color for the slider
 * @param {number} props.constraintMin - Dynamic minimum constraint (decimal)
 * @param {number} props.constraintMax - Dynamic maximum constraint (decimal)
 * @param {Object} props.sliderStyle - Additional CSS styles for slider
 * @param {boolean} props.showValue - Show value above slider
 * @param {Function} props.onPreview - Callback for preview value during drag
 */
const PercentileSlider = ({ 
  value, 
  onChange, 
  min, 
  max, 
  color, 
  constraintMin, 
  constraintMax, 
  sliderStyle, 
  showValue = false, 
  onPreview 
}) => {
  const [localValue, setLocalValue] = useState(Math.round(value * 100));
  const [isDragging, setIsDragging] = useState(false);
  
  // Update local value when prop changes (but not during drag)
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(Math.round(value * 100));
    }
  }, [value, isDragging]);
  
  // Report preview value when dragging
  useEffect(() => {
    if (onPreview) {
      onPreview(isDragging ? localValue : null);
    }
  }, [localValue, isDragging, onPreview]);
  
  // Effective constraints (dynamic based on adjacent percentiles)
  const effectiveMin = constraintMin !== undefined ? Math.round(constraintMin * 100) : min;
  const effectiveMax = constraintMax !== undefined ? Math.round(constraintMax * 100) : max;
  
  const commitValue = () => {
    // Clamp to constraints
    let clamped = Math.max(effectiveMin, Math.min(effectiveMax, localValue));
    setLocalValue(clamped);
    onChange(clamped / 100);
    setIsDragging(false);
  };
  
  const handleChange = (e) => {
    setLocalValue(parseInt(e.target.value));
  };
  
  const formatLabel = (v) => {
    return v >= 0 ? `+${v}%` : `${v}%`;
  };
  
  // Display value (shows local value during drag for real-time preview)
  const displayValue = isDragging ? localValue : Math.round(value * 100);
  
  return (
    <div>
      {showValue && (
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <span style={{ 
            color: color, 
            fontSize: '14px', 
            fontWeight: 'bold',
            transition: isDragging ? 'none' : 'color 0.2s',
          }}>
            {displayValue >= 0 ? '+' : ''}{displayValue}%
          </span>
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step="1"
        value={localValue}
        onChange={handleChange}
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={commitValue}
        onTouchStart={() => setIsDragging(true)}
        onTouchEnd={commitValue}
        style={{ ...sliderStyle, width: '100%' }}
      />
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        fontSize: '8px', 
        color: '#666', 
        marginTop: '2px' 
      }}>
        <span style={{ color: effectiveMin > min ? color : '#666' }}>
          {formatLabel(effectiveMin)}
        </span>
        <span style={{ color: effectiveMax < max ? color : '#666' }}>
          {formatLabel(effectiveMax)}
        </span>
      </div>
    </div>
  );
};

export default PercentileSlider;
