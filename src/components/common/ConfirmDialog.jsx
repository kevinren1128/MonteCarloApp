/**
 * Confirm Dialog Component
 * 
 * @module components/common/ConfirmDialog
 * @description Modal confirmation dialog to replace window.confirm().
 * 
 * Usage:
 * ```jsx
 * const [confirmState, setConfirmState] = useState(null);
 * 
 * // To show dialog
 * setConfirmState({
 *   title: 'Delete Position?',
 *   message: 'This will remove AAPL from your portfolio.',
 *   confirmLabel: 'Delete',
 *   confirmVariant: 'danger',
 *   onConfirm: () => deletePosition(index),
 * });
 * 
 * // In render
 * {confirmState && (
 *   <ConfirmDialog 
 *     {...confirmState} 
 *     onCancel={() => setConfirmState(null)}
 *   />
 * )}
 * ```
 */

import React, { useEffect, useRef } from 'react';
import { colors, spacing, borderRadius, shadows, transitions, zIndex, typography } from '../../constants/designTokens';

/**
 * Confirm Dialog
 * @param {Object} props
 * @param {string} props.title - Dialog title
 * @param {string} props.message - Dialog message/description
 * @param {string} props.confirmLabel - Label for confirm button (default: 'Confirm')
 * @param {string} props.cancelLabel - Label for cancel button (default: 'Cancel')
 * @param {string} props.confirmVariant - Button variant: 'primary' | 'danger' (default: 'primary')
 * @param {Function} props.onConfirm - Callback when confirmed
 * @param {Function} props.onCancel - Callback when cancelled
 * @param {React.ReactNode} props.children - Optional additional content
 */
const ConfirmDialog = ({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  children,
}) => {
  const dialogRef = useRef(null);
  const confirmButtonRef = useRef(null);
  
  // Focus confirm button on mount
  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);
  
  // Handle keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter' && !e.target.matches('button')) {
        onConfirm();
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onConfirm, onCancel]);
  
  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };
  
  const confirmButtonStyle = confirmVariant === 'danger' 
    ? styles.buttonDanger 
    : styles.buttonPrimary;
  
  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div 
        ref={dialogRef}
        style={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
      >
        {/* Title */}
        <h2 id="dialog-title" style={styles.title}>
          {title}
        </h2>
        
        {/* Message */}
        {message && (
          <p id="dialog-description" style={styles.message}>
            {message}
          </p>
        )}
        
        {/* Optional additional content */}
        {children && (
          <div style={styles.content}>
            {children}
          </div>
        )}
        
        {/* Actions */}
        <div style={styles.actions}>
          <button 
            style={styles.buttonSecondary}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button 
            ref={confirmButtonRef}
            style={confirmButtonStyle}
            onClick={() => {
              onConfirm();
              onCancel();
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: zIndex.modal,
    padding: spacing.lg,
    animation: 'fadeIn 0.15s ease',
  },
  
  dialog: {
    background: colors.bg.overlay,
    border: `1px solid ${colors.border.strong}`,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    maxWidth: '400px',
    width: '100%',
    boxShadow: shadows.xl,
    animation: 'slideUp 0.2s ease',
  },
  
  title: {
    margin: 0,
    marginBottom: spacing.md,
    fontSize: typography.fontSize.xxl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
  },
  
  message: {
    margin: 0,
    marginBottom: spacing.lg,
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
    lineHeight: typography.lineHeight.relaxed,
  },
  
  content: {
    marginBottom: spacing.lg,
  },
  
  actions: {
    display: 'flex',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  
  buttonBase: {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.mono,
    cursor: 'pointer',
    transition: transitions.fast,
    border: 'none',
  },
  
  buttonSecondary: {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.medium,
    fontFamily: typography.fontFamily.mono,
    cursor: 'pointer',
    transition: transitions.fast,
    background: colors.bg.hover,
    border: `1px solid ${colors.border.strong}`,
    color: colors.text.primary,
  },
  
  buttonPrimary: {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.mono,
    cursor: 'pointer',
    transition: transitions.fast,
    background: colors.accent.gradient,
    border: 'none',
    color: '#fff',
  },
  
  buttonDanger: {
    padding: `${spacing.sm} ${spacing.lg}`,
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: typography.fontFamily.mono,
    cursor: 'pointer',
    transition: transitions.fast,
    background: colors.danger,
    border: 'none',
    color: '#fff',
  },
};

// Add keyframes to document
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(20px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
if (typeof document !== 'undefined' && !document.querySelector('[data-confirm-dialog-styles]')) {
  styleSheet.setAttribute('data-confirm-dialog-styles', 'true');
  document.head.appendChild(styleSheet);
}

export default ConfirmDialog;
