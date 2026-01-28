/**
 * Animated Counter Component
 * 
 * @module components/common/AnimatedCounter
 * @description Smoothly animates number changes with easing
 */

import React, { useState, useEffect, useRef } from 'react';

/**
 * Animated number counter with smooth transitions
 * @param {Object} props
 * @param {number} props.value - Target value to display
 * @param {number} props.duration - Animation duration in ms (default: 600)
 * @param {string} props.format - 'currency', 'percent', 'number' (default: 'number')
 * @param {number} props.decimals - Number of decimal places
 * @param {string} props.prefix - String to show before number
 * @param {string} props.suffix - String to show after number
 * @param {Object} props.style - Additional styles
 */
const AnimatedCounter = ({ 
  value, 
  duration = 600,
  format = 'number',
  decimals = 0,
  prefix = '',
  suffix = '',
  style = {},
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValue = useRef(value);
  const animationRef = useRef(null);
  
  useEffect(() => {
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();
    
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Easing function (ease-out cubic)
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutCubic(progress);
      
      const currentValue = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        previousValue.current = endValue;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);
  
  const formatValue = (val) => {
    if (!isFinite(val)) return '—';
    
    switch (format) {
      case 'currency':
        return val.toLocaleString(undefined, { 
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      case 'percent':
        return (val * 100).toFixed(decimals);
      default:
        return val.toLocaleString(undefined, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
    }
  };
  
  return (
    <span style={style} className={className}>
      {prefix}{formatValue(displayValue)}{suffix}
    </span>
  );
};

/**
 * Animated currency display (pre-configured for USD)
 */
export const AnimatedCurrency = ({ value, style = {}, showSign = false }) => {
  const isNegative = value < 0;
  const sign = showSign ? (value >= 0 ? '+' : '') : '';
  
  return (
    <AnimatedCounter
      value={Math.abs(value)}
      format="currency"
      decimals={0}
      prefix={`${sign}${isNegative ? '-' : ''}$`}
      style={style}
    />
  );
};

/**
 * Animated percentage display
 */
export const AnimatedPercent = ({ value, style = {}, decimals = 1, showSign = true }) => {
  const sign = showSign && value > 0 ? '+' : '';
  
  return (
    <AnimatedCounter
      value={value * 100}
      format="number"
      decimals={decimals}
      prefix={sign}
      suffix="%"
      style={style}
    />
  );
};

/**
 * Portfolio value display with animation and color coding
 */
export const AnimatedPortfolioValue = ({ value, previousValue, style = {}, compact = false }) => {
  const [flash, setFlash] = useState(null);
  const [changeAmount, setChangeAmount] = useState(0);
  const prevVal = useRef(value);

  useEffect(() => {
    if (prevVal.current !== value && prevVal.current !== 0) {
      const diff = value - prevVal.current;
      const increased = diff > 0;
      setFlash(increased ? 'up' : 'down');
      setChangeAmount(diff);
      const timer = setTimeout(() => {
        setFlash(null);
        setChangeAmount(0);
      }, 2000);
      prevVal.current = value;
      return () => clearTimeout(timer);
    } else {
      prevVal.current = value;
    }
  }, [value]);

  const flashColor = flash === 'up'
    ? 'rgba(46, 204, 113, 0.6)'
    : flash === 'down'
    ? 'rgba(231, 76, 60, 0.6)'
    : 'transparent';

  const arrowColor = flash === 'up' ? '#2ecc71' : '#e74c3c';
  const arrow = flash === 'up' ? '↑' : flash === 'down' ? '↓' : null;

  return (
    <span style={{
      ...style,
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
    }}>
      <span style={{
        textShadow: flash ? `0 0 20px ${flashColor}, 0 0 40px ${flashColor}` : 'none',
        transition: 'text-shadow 0.4s ease, color 0.3s ease',
        color: flash === 'up' ? '#2ecc71' : flash === 'down' ? '#e74c3c' : (style.color || '#00d4ff'),
      }}>
        <AnimatedCurrency value={value} />
      </span>
      {/* Change indicator */}
      {flash && !compact && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px',
          fontSize: '10px',
          fontWeight: '600',
          color: arrowColor,
          opacity: 1,
          animation: 'fadeInOut 2s ease forwards',
          whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '12px' }}>{arrow}</span>
          <span>${Math.abs(changeAmount).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </span>
      )}
      {/* Compact arrow only */}
      {flash && compact && (
        <span style={{
          fontSize: '14px',
          color: arrowColor,
          animation: 'fadeInOut 2s ease forwards',
        }}>
          {arrow}
        </span>
      )}
    </span>
  );
};

export default AnimatedCounter;
