/**
 * BlurInput Component
 * 
 * @module components/common/BlurInput
 * @description Input that only commits value on blur or Enter key.
 * Prevents excessive re-renders during typing.
 */

import React, { useState, useEffect } from 'react';

/**
 * Input component that only updates parent state on blur
 * 
 * @param {Object} props
 * @param {string|number} props.value - Current value
 * @param {Function} props.onChange - Callback when value is committed
 * @param {string} props.type - 'number' or 'text'
 * @param {Object} props.style - Style object
 */
const BlurInput = ({ value, onChange, type = 'number', style, ...props }) => {
  const [localValue, setLocalValue] = useState(value?.toString() || '');
  
  // Sync local value when prop changes (e.g., from external update)
  useEffect(() => {
    setLocalValue(value?.toString() || '');
  }, [value]);
  
  const commitValue = () => {
    const parsed = type === 'number' ? parseFloat(localValue) || 0 : localValue;
    onChange(parsed);
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
      style={style}
      {...props}
    />
  );
};

export default BlurInput;
