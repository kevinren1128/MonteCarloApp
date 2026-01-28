/**
 * Tooltip Component
 * 
 * @module components/common/Tooltip
 * @description Contextual help tooltips with info icons
 */

import React, { useState } from 'react';

/**
 * Info tooltip that appears on hover
 */
const Tooltip = ({ 
  content, 
  children,
  position = 'top', // top, bottom, left, right
  maxWidth = '400px',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  const positionStyles = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: '8px',
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: '8px',
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: '8px',
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: '8px',
    },
  };
  
  const arrowStyles = {
    top: {
      bottom: '-4px',
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    bottom: {
      top: '-4px',
      left: '50%',
      transform: 'translateX(-50%) rotate(45deg)',
    },
    left: {
      right: '-4px',
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
    right: {
      left: '-4px',
      top: '50%',
      transform: 'translateY(-50%) rotate(45deg)',
    },
  };
  
  return (
    <div 
      style={styles.container}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      
      {isVisible && (
        <div style={{
          ...styles.tooltip,
          ...positionStyles[position],
          maxWidth,
        }}>
          {/* Arrow */}
          <div style={{
            ...styles.arrow,
            ...arrowStyles[position],
          }} />
          
          {content}
        </div>
      )}
    </div>
  );
};

/**
 * Info icon with tooltip
 */
export const InfoTooltip = ({ 
  content, 
  size = 14,
  position = 'top',
  style = {},
}) => (
  <Tooltip content={content} position={position}>
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size + 4,
      height: size + 4,
      borderRadius: '50%',
      background: 'rgba(0, 212, 255, 0.1)',
      border: '1px solid rgba(0, 212, 255, 0.3)',
      cursor: 'help',
      fontSize: size - 2,
      fontWeight: 600,
      fontStyle: 'italic',
      color: '#00d4ff',
      ...style,
    }}>
      i
    </span>
  </Tooltip>
);

/**
 * Help icon with tooltip (question mark style)
 */
export const HelpTooltip = ({ 
  content, 
  size = 14,
  position = 'top',
  style = {},
}) => (
  <Tooltip content={content} position={position}>
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size + 4,
      height: size + 4,
      borderRadius: '50%',
      background: 'rgba(155, 89, 182, 0.1)',
      border: '1px solid rgba(155, 89, 182, 0.3)',
      cursor: 'help',
      fontSize: size - 2,
      fontWeight: 600,
      color: '#9b59b6',
      ...style,
    }}>
      ?
    </span>
  </Tooltip>
);

/**
 * Warning tooltip
 */
export const WarningTooltip = ({ 
  content, 
  size = 14,
  position = 'top',
  style = {},
}) => (
  <Tooltip content={content} position={position}>
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: size + 4,
      height: size + 4,
      borderRadius: '50%',
      background: 'rgba(243, 156, 18, 0.1)',
      border: '1px solid rgba(243, 156, 18, 0.3)',
      cursor: 'help',
      fontSize: size - 2,
      fontWeight: 600,
      color: '#f39c12',
      ...style,
    }}>
      !
    </span>
  </Tooltip>
);

const styles = {
  container: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  
  tooltip: {
    position: 'absolute',
    zIndex: 1000,
    padding: '6px 10px',
    background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98) 0%, rgba(20, 20, 35, 0.98) 100%)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: '6px',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    fontSize: '10px',
    lineHeight: 1.4,
    color: 'rgba(255, 255, 255, 0.9)',
    whiteSpace: 'nowrap',
    textTransform: 'none',
    letterSpacing: 'normal',
    fontWeight: '400',
    pointerEvents: 'none',
  },
  
  arrow: {
    position: 'absolute',
    width: '8px',
    height: '8px',
    background: 'linear-gradient(135deg, rgba(30, 30, 50, 0.98) 0%, rgba(20, 20, 35, 0.98) 100%)',
    borderRight: '1px solid rgba(0, 212, 255, 0.2)',
    borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
  },
};

export default Tooltip;
