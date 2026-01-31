import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleSignIn } from './GoogleSignIn';

/**
 * User Menu Component
 * Shows user avatar and dropdown with account options when logged in,
 * or a sign-in button when logged out.
 *
 * @param {Object} props
 * @param {Object} props.syncState - Sync status object
 * @param {boolean} props.inlineSync - Show sync icon inline beside avatar (default: true)
 */
export function UserMenu({ syncState = { status: 'idle' }, inlineSync = true }) {
  const { state, logout } = useAuth();
  const { isAuthenticated, isAvailable, displayInfo, isLoading } = state;
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Extract sync status from syncState object
  const syncStatus = syncState?.status || 'idle';
  const lastSynced = syncState?.lastSynced;
  const hasUnsyncedChanges = syncState?.hasUnsyncedChanges;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Don't render anything if auth isn't available
  if (!isAvailable) {
    return null;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingDot} />
      </div>
    );
  }

  // Show sign-in button if not authenticated
  if (!isAuthenticated) {
    return (
      <div style={styles.container}>
        <GoogleSignIn compact />
      </div>
    );
  }

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  // Only show badge for active sync states (syncing = spinner, synced = checkmark)
  // Don't show badge for idle/error/offline - less alarming, details in dropdown
  const getSyncStatusIcon = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
            <path fill="#4285f4" d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
        );
      case 'synced':
        return (
          <svg width="12" height="12" viewBox="0 0 24 24">
            <path fill="#34A853" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
        );
      default:
        // Don't show badge for idle, error, or offline
        return null;
    }
  };

  const getLastSyncedText = () => {
    if (!lastSynced) return null;
    const now = new Date();
    const diff = now - new Date(lastSynced);
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return lastSynced.toLocaleDateString();
  };

  return (
    <div style={styles.container} ref={menuRef}>
      <div style={styles.avatarRow}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={styles.avatarButton}
          aria-label="User menu"
          aria-expanded={isOpen}
        >
          {displayInfo.avatar ? (
            <img
              src={displayInfo.avatar}
              alt={displayInfo.name}
              style={styles.avatar}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div style={styles.avatarFallback}>
              {displayInfo.name.charAt(0).toUpperCase()}
            </div>
          )}
          {/* Overlay sync indicator (legacy mode) */}
          {!inlineSync && (syncStatus === 'syncing' || syncStatus === 'synced') && (
            <span style={styles.syncIndicatorOverlay}>
              {getSyncStatusIcon()}
            </span>
          )}
        </button>
        {/* Inline sync indicator (new default) */}
        {inlineSync && (syncStatus === 'syncing' || syncStatus === 'synced') && (
          <span style={styles.syncIndicatorInline}>
            {getSyncStatusIcon()}
          </span>
        )}
      </div>

      {isOpen && (
        <div style={styles.dropdown}>
          <div style={styles.userInfo}>
            <div style={styles.userName}>{displayInfo.name}</div>
            <div style={styles.userEmail}>{displayInfo.email}</div>
          </div>

          <div style={styles.divider} />

          {/* Sync status */}
          <div style={styles.syncStatus}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill={syncStatus === 'synced' ? '#34A853' : syncStatus === 'error' ? '#EA4335' : '#5f6368'} d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              <span>
                {syncStatus === 'syncing' ? 'Syncing...' :
                 syncStatus === 'synced' ? 'Synced' :
                 syncStatus === 'error' ? 'Sync error' :
                 syncStatus === 'offline' ? 'Offline' :
                 'Cloud sync'}
              </span>
            </div>
            {lastSynced && syncStatus === 'synced' && (
              <div style={{ fontSize: '11px', color: '#9aa0a6', marginTop: '2px', marginLeft: '24px' }}>
                {getLastSyncedText()}
              </div>
            )}
            {hasUnsyncedChanges && syncStatus !== 'syncing' && (
              <div style={{ fontSize: '11px', color: '#FBBC04', marginTop: '2px', marginLeft: '24px' }}>
                Changes pending...
              </div>
            )}
          </div>

          <div style={styles.divider} />

          <button onClick={handleLogout} style={styles.menuItem}>
            <svg width="16" height="16" viewBox="0 0 24 24" style={{ marginRight: '8px' }}>
              <path fill="currentColor" d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  avatarRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  loadingDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#e0e0e0',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  avatarButton: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    padding: '4px',
    cursor: 'pointer',
    borderRadius: '50%',
    transition: 'background 0.15s ease',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: '#4285f4',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '500',
  },
  syncIndicatorOverlay: {
    position: 'absolute',
    bottom: '0',
    right: '0',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
  syncIndicatorInline: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: '0',
    marginBottom: '8px',
    minWidth: '220px',
    background: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    border: '1px solid #e0e0e0',
    zIndex: 1000,
    overflow: 'hidden',
  },
  userInfo: {
    padding: '16px',
  },
  userName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#202124',
    marginBottom: '2px',
  },
  userEmail: {
    fontSize: '12px',
    color: '#5f6368',
  },
  divider: {
    height: '1px',
    background: '#e0e0e0',
    margin: '0',
  },
  syncStatus: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#5f6368',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#3c4043',
    textAlign: 'left',
    transition: 'background 0.15s ease',
  },
};

// Add hover styles via CSS injection
if (typeof document !== 'undefined') {
  const styleId = 'user-menu-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
}

export default UserMenu;
