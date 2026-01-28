/**
 * Recovery Dialog Component
 *
 * @module components/common/RecoveryDialog
 * @description Prompts user to recover from an incomplete operation.
 */

import React, { memo, useMemo } from 'react';
import { getOperationDescription } from '../../utils/crashRecovery';

const RecoveryDialog = memo(({
  isOpen,
  recoveryData,
  onRecover,
  onDiscard,
}) => {
  // Format elapsed time
  const timeDescription = useMemo(() => {
    if (!recoveryData?.startedAt) return '';

    const elapsed = Date.now() - recoveryData.startedAt;
    if (elapsed < 60000) return 'less than a minute ago';
    if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)} minutes ago`;
    if (elapsed < 86400000) return `${Math.floor(elapsed / 3600000)} hours ago`;
    return `${Math.floor(elapsed / 86400000)} days ago`;
  }, [recoveryData?.startedAt]);

  const operationName = useMemo(() => {
    return recoveryData?.operationType
      ? getOperationDescription(recoveryData.operationType)
      : 'an operation';
  }, [recoveryData?.operationType]);

  if (!isOpen || !recoveryData) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.dialog}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.iconWrapper}>
            <span style={styles.icon}>⚠️</span>
          </div>
          <h2 style={styles.title}>Unsaved Changes Detected</h2>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <p style={styles.message}>
            It looks like <strong>{operationName}</strong> was interrupted {timeDescription}.
            Would you like to recover your previous state?
          </p>

          {/* Recovery info */}
          <div style={styles.infoBox}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Operation:</span>
              <span style={styles.infoValue}>{operationName}</span>
            </div>
            {recoveryData.metadata?.positionCount && (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Positions:</span>
                <span style={styles.infoValue}>{recoveryData.metadata.positionCount}</span>
              </div>
            )}
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Time:</span>
              <span style={styles.infoValue}>
                {new Date(recoveryData.startedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <p style={styles.warning}>
            If you choose to discard, the recovered data will be permanently lost.
          </p>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button
            onClick={onDiscard}
            style={styles.discardButton}
          >
            Discard Changes
          </button>
          <button
            onClick={onRecover}
            style={styles.recoverButton}
          >
            Recover State
          </button>
        </div>
      </div>
    </div>
  );
});

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10003,
    padding: '20px',
  },

  dialog: {
    background: 'linear-gradient(180deg, rgba(35, 35, 55, 0.98) 0%, rgba(25, 25, 40, 0.98) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 159, 67, 0.3)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 159, 67, 0.1)',
    maxWidth: '440px',
    width: '100%',
    overflow: 'hidden',
  },

  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '24px 24px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(255, 159, 67, 0.05)',
  },

  iconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, rgba(255, 159, 67, 0.2) 0%, rgba(255, 107, 107, 0.2) 100%)',
    border: '1px solid rgba(255, 159, 67, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '12px',
  },

  icon: {
    fontSize: '28px',
  },

  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
  },

  content: {
    padding: '20px 24px',
  },

  message: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    lineHeight: 1.6,
    color: '#bbb',
  },

  infoBox: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },

  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
  },

  infoLabel: {
    fontSize: '12px',
    color: '#888',
  },

  infoValue: {
    fontSize: '12px',
    color: '#ddd',
    fontWeight: 500,
  },

  warning: {
    margin: 0,
    fontSize: '12px',
    color: '#e74c3c',
    fontStyle: 'italic',
  },

  actions: {
    display: 'flex',
    gap: '12px',
    padding: '16px 24px 24px',
    justifyContent: 'flex-end',
  },

  discardButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'transparent',
    color: '#888',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
  },

  recoverButton: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #ff9f43 0%, #ff6b6b 100%)',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    boxShadow: '0 4px 12px rgba(255, 159, 67, 0.3)',
    transition: 'all 0.2s ease',
  },
};

RecoveryDialog.displayName = 'RecoveryDialog';

export default RecoveryDialog;
