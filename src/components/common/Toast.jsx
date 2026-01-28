/**
 * Toast Notification System
 * 
 * @module components/common/Toast
 * @description Clean toast notifications matching the app's info box aesthetic.
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// Toast Context
const ToastContext = createContext(null);

// Unique ID generator
let toastId = 0;
const generateId = () => ++toastId;

// Default duration in ms
const DEFAULT_DURATION = 5000;

/**
 * Toast Provider - Wrap your app with this
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  const showToast = useCallback(({ 
    type = 'info', 
    message, 
    title,
    duration = DEFAULT_DURATION,
    action,
  }) => {
    const id = generateId();
    
    const toast = {
      id,
      type,
      message,
      title,
      action,
      duration,
      createdAt: Date.now(),
    };
    
    setToasts(prev => [...prev, toast]);
    
    return id;
  }, []);
  
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);
  
  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);
  
  return (
    <ToastContext.Provider value={{ showToast, dismissToast, dismissAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};

/**
 * Hook to access toast functions
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Toast Container - Renders all active toasts
 */
const ToastContainer = ({ toasts, onDismiss }) => {
  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes toastSlideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
        @keyframes toastProgress {
          from {
            transform: scaleX(1);
            transform-origin: left;
          }
          to {
            transform: scaleX(0);
            transform-origin: left;
          }
        }
      `}</style>
      <div style={styles.container}>
        {toasts.map((toast, index) => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onDismiss={() => onDismiss(toast.id)}
            index={index}
          />
        ))}
      </div>
    </>
  );
};

// Type configurations matching app info boxes
const typeConfig = {
  success: {
    icon: '✓',
    borderColor: '#2ecc71',
    bgColor: 'rgba(20, 35, 28, 0.95)',
    textColor: '#2ecc71',
    iconBg: 'rgba(46, 204, 113, 0.25)',
  },
  error: {
    icon: '✕',
    borderColor: '#e74c3c',
    bgColor: 'rgba(40, 22, 22, 0.95)',
    textColor: '#e74c3c',
    iconBg: 'rgba(231, 76, 60, 0.25)',
  },
  warning: {
    icon: '!',
    borderColor: '#f39c12',
    bgColor: 'rgba(40, 32, 18, 0.95)',
    textColor: '#f39c12',
    iconBg: 'rgba(243, 156, 18, 0.25)',
  },
  info: {
    icon: 'i',
    borderColor: '#00d4ff',
    bgColor: 'rgba(15, 30, 40, 0.95)',
    textColor: '#00d4ff',
    iconBg: 'rgba(0, 212, 255, 0.25)',
  },
};

/**
 * Individual Toast component - matches app info box style
 * Uses CSS animations for smooth progress bar (GPU-accelerated, won't stutter during computation)
 */
const ToastItem = ({ toast, onDismiss, index }) => {
  const [isExiting, setIsExiting] = useState(false);
  const exitingRef = useRef(false);
  const dismissTimeoutRef = useRef(null);
  const onDismissRef = useRef(onDismiss);
  
  // Keep onDismiss ref updated without triggering effects
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);
  
  const duration = toast.duration || DEFAULT_DURATION;
  const config = typeConfig[toast.type] || typeConfig.info;
  
  // Calculate elapsed time ONCE on mount to avoid recalculation on re-renders
  const createdAt = toast.createdAt || Date.now();
  const initialElapsedRef = useRef(null);
  if (initialElapsedRef.current === null) {
    initialElapsedRef.current = Date.now() - createdAt;
  }
  const progressStartOffset = initialElapsedRef.current;
  
  // Handle dismiss with animation
  const handleDismiss = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setIsExiting(true);
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }
    setTimeout(() => onDismissRef.current(), 250);
  }, []); // No dependencies - uses refs
  
  // Auto-dismiss timer - uses absolute timestamp to avoid reset issues
  useEffect(() => {
    const elapsed = Date.now() - createdAt;
    const timeRemaining = Math.max(0, duration - elapsed);
    
    if (timeRemaining <= 0) {
      // Already expired
      handleDismiss();
      return;
    }
    
    dismissTimeoutRef.current = setTimeout(() => {
      if (!exitingRef.current) {
        handleDismiss();
      }
    }, timeRemaining);
    
    return () => {
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
      }
    };
  }, [toast.id, createdAt, duration, handleDismiss]); // Only re-run if toast identity changes
  
  return (
    <div 
      style={{
        ...styles.toastWrapper,
        animation: isExiting 
          ? 'toastSlideOut 0.25s ease-in forwards'
          : 'toastSlideIn 0.3s ease-out forwards',
        animationDelay: isExiting ? '0s' : `${index * 0.05}s`,
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Main toast body - styled like app info boxes */}
      <div style={{
        ...styles.toast,
        background: config.bgColor,
        borderColor: config.borderColor,
      }}>
        {/* Icon */}
        <div style={{ 
          ...styles.iconWrapper,
          background: config.iconBg,
          color: config.textColor,
          borderColor: config.borderColor,
        }}>
          <span style={styles.icon}>{config.icon}</span>
        </div>
        
        {/* Content */}
        <div style={styles.content}>
          {toast.title && (
            <div style={{ ...styles.title, color: config.textColor }}>
              {toast.title}
            </div>
          )}
          <div style={styles.message}>
            {toast.message}
          </div>
          
          {/* Action button if provided */}
          {toast.action && (
            <button 
              style={{ ...styles.action, color: config.textColor }}
              onClick={() => {
                toast.action.onClick();
                handleDismiss();
              }}
            >
              {toast.action.label} →
            </button>
          )}
        </div>
        
        {/* Dismiss button */}
        <button 
          style={{ ...styles.dismiss, color: config.textColor }}
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        >
          ×
        </button>
        
        {/* Progress bar - uses CSS animation (GPU-accelerated, won't stutter) 
            Animation delay is negative to start at the correct position based on elapsed time */}
        <div style={styles.progressTrack}>
          <div style={{
            ...styles.progressBar,
            width: '100%',
            background: config.borderColor,
            animation: `toastProgress ${duration}ms linear forwards`,
            animationDelay: `-${progressStartOffset}ms`, // Negative delay = start partway through
            animationPlayState: isExiting ? 'paused' : 'running',
          }} />
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column-reverse',
    gap: '10px',
    maxWidth: '360px',
    width: 'calc(100vw - 40px)',
    pointerEvents: 'none',
  },
  
  toastWrapper: {
    pointerEvents: 'auto',
  },
  
  toast: {
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '14px 16px',
    paddingRight: '36px',
    borderRadius: '8px',
    border: '1px solid',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
    overflow: 'hidden',
  },
  
  iconWrapper: {
    flexShrink: 0,
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    border: '1px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  icon: {
    fontSize: '14px',
    fontWeight: 'bold',
    fontStyle: 'normal',
  },
  
  content: {
    flex: 1,
    minWidth: 0,
    paddingTop: '2px',
  },
  
  title: {
    fontWeight: 600,
    fontSize: '12px',
    marginBottom: '3px',
    letterSpacing: '0.01em',
  },
  
  message: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  
  action: {
    background: 'none',
    border: 'none',
    padding: 0,
    marginTop: '8px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: 0.9,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
  
  dismiss: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'none',
    border: 'none',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    opacity: 0.5,
    fontSize: '18px',
    fontWeight: '300',
    padding: 0,
    transition: 'opacity 0.15s ease',
  },
  
  progressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '2px',
    background: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  
  progressBar: {
    height: '100%',
    willChange: 'transform', // Hint to browser for GPU acceleration
  },
};

// Export ToastConnector for use in App
export const ToastConnector = () => {
  const { showToast } = useToast();
  
  useEffect(() => {
    window.__showToast = showToast;
    return () => {
      delete window.__showToast;
    };
  }, [showToast]);
  
  return null;
};

// Global toast reference for use outside React components
let globalToastRef = null;

export const setGlobalToastRef = (ref) => {
  globalToastRef = ref;
};

// Convenience function for imperative toast calls
export const toast = {
  success: (message, options = {}) => globalToastRef?.({ type: 'success', message, ...options }),
  error: (message, options = {}) => globalToastRef?.({ type: 'error', message, ...options }),
  warning: (message, options = {}) => globalToastRef?.({ type: 'warning', message, ...options }),
  info: (message, options = {}) => globalToastRef?.({ type: 'info', message, ...options }),
};

export default ToastProvider;
