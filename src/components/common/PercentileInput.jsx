/**
 * PercentileInput Component
 * 
 * @module components/common/PercentileInput
 * @description Numeric input for percentile values that commits on blur.
 * Displays and accepts values as percentages (e.g., "15" for 15%).
 */

import React, { useState, useEffect } from 'react';

/**
 * Percentile input that shows percentage values
 * 
 * @param {Object} props
 * @param {number} props.value - Value as decimal (0.15 = 15%)
 * @param {Function} props.onChange - Callback with decimal value
 * @param {string} props.color - Border and text color
 * @param {number} props.min - Minimum percentage (default: -100)
 * @param {number} props.max - Maximum percentage (default: 100)
 */
const PercentileInput = ({ value, onChange, color, min = -100, max = 100 }) => {
  const [localValue, setLocalValue] = useState(Math.round(value * 100).toString());
  
  // Update local value when prop changes (e.g., from slider or estimate)
  useEffect(() => {
    setLocalValue(Math.round(value * 100).toString());
  }, [value]);
  
  const commitValue = () => {
    let numValue = parseFloat(localValue) || 0;
    // Clamp to valid range
    numValue = Math.max(min, Math.min(max, numValue));
    setLocalValue(Math.round(numValue).toString());
    onChange(numValue / 100);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };
  
  return (
    <input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitValue}
      onKeyDown={handleKeyDown}
      style={{ 
        background: '#1a1a2e',
        border: `1px solid ${color}40`,
        borderRadius: '4px',
        padding: '6px',
        color: color,
        width: '50px', 
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: 'bold',
      }}
    />
  );
};

export default PercentileInput;
