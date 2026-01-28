import React, { useState, useEffect, useRef } from 'react';

/**
 * Correlation cell input with click-to-edit modal behavior
 * Used in the correlation matrix to allow editing individual cells
 */
const CorrelationCellInput = ({ value, onChange, style }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value.toFixed(2));
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value.toFixed(2));
    }
  }, [value, isEditing]);
  
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const commitValue = () => {
    let numValue = parseFloat(localValue);
    if (isNaN(numValue)) numValue = 0;
    numValue = Math.max(-0.99, Math.min(0.99, numValue));
    onChange(numValue);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitValue();
    } else if (e.key === 'Escape') {
      setLocalValue(value.toFixed(2));
      setIsEditing(false);
    }
  };
  
  if (!isEditing) {
    return (
      <div 
        onClick={() => setIsEditing(true)}
        style={{ 
          ...style, 
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '3px',
          transition: 'background 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(0,212,255,0.2)'}
        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
        title="Click to edit"
      >
        {value.toFixed(2)}
      </div>
    );
  }
  
  return (
    <input
      ref={inputRef}
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={commitValue}
      onKeyDown={handleKeyDown}
      style={{
        ...style,
        width: '50px',
        textAlign: 'center',
        background: '#0a0a15',
        border: '1px solid #00d4ff',
        borderRadius: '3px',
        color: '#fff',
        padding: '2px 4px',
        fontSize: '12px',
      }}
    />
  );
};

export default CorrelationCellInput;
