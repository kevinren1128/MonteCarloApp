/**
 * Portfolio Sync Hook
 *
 * @module hooks/usePortfolioSync
 * @description Handles synchronization between local portfolio state and Supabase.
 *
 * Sync Strategy:
 * 1. On login: Fetch portfolio from server, compare revisions
 * 2. Server revision > local: Use server data
 * 3. Local revision > server or local is newer: Push to server
 * 4. On save: Debounced sync to server if online
 * 5. Offline: Keep localStorage, sync when back online
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchPortfolio,
  savePortfolio,
  getRevision,
  isOnline as checkOnline,
} from '../services/portfolioService';

// ============================================
// TYPES
// ============================================

/**
 * @typedef {'idle'|'syncing'|'synced'|'error'|'offline'} SyncStatus
 */

/**
 * @typedef {Object} SyncState
 * @property {SyncStatus} status - Current sync status
 * @property {Date|null} lastSynced - Last successful sync time
 * @property {Error|null} error - Last sync error
 * @property {boolean} hasUnsyncedChanges - Whether there are local changes not yet synced
 */

// ============================================
// HOOK
// ============================================

/**
 * Hook to sync portfolio with Supabase
 * @param {Object} localPortfolio - Current portfolio from app state
 * @param {Function} setPortfolio - Function to update portfolio in app state
 * @param {Object} options - Sync options
 * @param {number} options.debounceMs - Debounce delay for saves (default: 2000)
 * @param {boolean} options.autoSync - Enable automatic syncing (default: true)
 * @returns {{
 *   syncState: SyncState,
 *   syncToServer: Function,
 *   syncFromServer: Function,
 *   forceSync: Function,
 * }}
 */
export function usePortfolioSync(localPortfolio, setPortfolio, options = {}) {
  const { debounceMs = 2000, autoSync = true } = options;
  const { state: authState } = useAuth();
  const { user, isAuthenticated, isAvailable: isAuthAvailable } = authState;

  const [syncState, setSyncState] = useState({
    status: 'idle',
    lastSynced: null,
    error: null,
    hasUnsyncedChanges: false,
  });

  // Refs for debouncing and tracking
  const saveTimeoutRef = useRef(null);
  const lastLocalRevisionRef = useRef(localPortfolio?.revision || 0);
  const isSyncingRef = useRef(false);

  // ============================================
  // SYNC TO SERVER
  // ============================================

  /**
   * Push local portfolio to server
   */
  const syncToServer = useCallback(async (portfolio = localPortfolio) => {
    if (!isAuthenticated || !isAuthAvailable || isSyncingRef.current) {
      return { success: false, error: null };
    }

    isSyncingRef.current = true;
    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      // Check if we're online
      const online = await checkOnline();
      if (!online) {
        setSyncState(prev => ({
          ...prev,
          status: 'offline',
          hasUnsyncedChanges: true,
        }));
        return { success: false, error: new Error('Offline') };
      }

      const { portfolio: savedPortfolio, error } = await savePortfolio(portfolio);

      if (error) {
        setSyncState(prev => ({
          ...prev,
          status: 'error',
          error,
          hasUnsyncedChanges: true,
        }));
        return { success: false, error };
      }

      // Update local portfolio with server-generated ID and revision
      if (savedPortfolio && setPortfolio) {
        setPortfolio(prev => ({
          ...prev,
          id: savedPortfolio.id,
          revision: savedPortfolio.revision,
        }));
      }

      setSyncState({
        status: 'synced',
        lastSynced: new Date(),
        error: null,
        hasUnsyncedChanges: false,
      });

      return { success: true, error: null };
    } catch (error) {
      console.error('Sync to server failed:', error);
      setSyncState(prev => ({
        ...prev,
        status: 'error',
        error,
        hasUnsyncedChanges: true,
      }));
      return { success: false, error };
    } finally {
      isSyncingRef.current = false;
    }
  }, [localPortfolio, isAuthenticated, isAuthAvailable, setPortfolio]);

  // ============================================
  // SYNC FROM SERVER
  // ============================================

  /**
   * Pull portfolio from server
   */
  const syncFromServer = useCallback(async () => {
    if (!isAuthenticated || !isAuthAvailable || isSyncingRef.current) {
      return { success: false, portfolio: null, error: null };
    }

    isSyncingRef.current = true;
    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      const online = await checkOnline();
      if (!online) {
        setSyncState(prev => ({ ...prev, status: 'offline' }));
        return { success: false, portfolio: null, error: new Error('Offline') };
      }

      const { portfolio, error } = await fetchPortfolio();

      if (error) {
        setSyncState(prev => ({ ...prev, status: 'error', error }));
        return { success: false, portfolio: null, error };
      }

      if (portfolio) {
        // Update local state with server data
        if (setPortfolio) {
          setPortfolio(portfolio);
        }
        lastLocalRevisionRef.current = portfolio.revision;
      }

      setSyncState({
        status: 'synced',
        lastSynced: new Date(),
        error: null,
        hasUnsyncedChanges: false,
      });

      return { success: true, portfolio, error: null };
    } catch (error) {
      console.error('Sync from server failed:', error);
      setSyncState(prev => ({ ...prev, status: 'error', error }));
      return { success: false, portfolio: null, error };
    } finally {
      isSyncingRef.current = false;
    }
  }, [isAuthenticated, isAuthAvailable, setPortfolio]);

  // ============================================
  // FORCE SYNC (with conflict resolution)
  // ============================================

  /**
   * Force sync with conflict resolution
   * Compares revisions and decides which version to keep
   */
  const forceSync = useCallback(async () => {
    if (!isAuthenticated || !isAuthAvailable) {
      return { success: false, action: 'none', error: null };
    }

    try {
      // Fetch server portfolio
      const { portfolio: serverPortfolio, error: fetchError } = await fetchPortfolio();

      if (fetchError) {
        return { success: false, action: 'none', error: fetchError };
      }

      // If no server portfolio, push local
      if (!serverPortfolio) {
        if (localPortfolio && (localPortfolio.positions?.length > 0 || localPortfolio.cash > 0)) {
          const { success, error } = await syncToServer(localPortfolio);
          return { success, action: 'pushed', error };
        }
        return { success: true, action: 'none', error: null };
      }

      // Compare revisions
      const serverRevision = serverPortfolio.revision || 0;
      const localRevision = localPortfolio?.revision || 0;

      if (serverRevision > localRevision) {
        // Server wins - use server data
        if (setPortfolio) {
          setPortfolio(serverPortfolio);
        }
        lastLocalRevisionRef.current = serverRevision;
        setSyncState({
          status: 'synced',
          lastSynced: new Date(),
          error: null,
          hasUnsyncedChanges: false,
        });
        return { success: true, action: 'pulled', error: null };
      } else if (localRevision > serverRevision || hasLocalChanges(localPortfolio, serverPortfolio)) {
        // Local wins - push to server
        const { success, error } = await syncToServer(localPortfolio);
        return { success, action: 'pushed', error };
      }

      // Already in sync
      setSyncState(prev => ({
        ...prev,
        status: 'synced',
        lastSynced: new Date(),
        hasUnsyncedChanges: false,
      }));
      return { success: true, action: 'none', error: null };
    } catch (error) {
      console.error('Force sync failed:', error);
      return { success: false, action: 'none', error };
    }
  }, [isAuthenticated, isAuthAvailable, localPortfolio, setPortfolio, syncToServer]);

  // ============================================
  // AUTO-SYNC ON LOGIN
  // ============================================

  useEffect(() => {
    if (!autoSync || !isAuthenticated || !isAuthAvailable) {
      return;
    }

    // Sync on login
    forceSync();
  }, [isAuthenticated, isAuthAvailable, autoSync]); // Note: forceSync excluded to avoid loop

  // ============================================
  // DEBOUNCED AUTO-SAVE
  // ============================================

  useEffect(() => {
    if (!autoSync || !isAuthenticated || !isAuthAvailable || !localPortfolio) {
      return;
    }

    // Detect changes by comparing to last known revision
    const currentRevision = localPortfolio.revision || 0;
    if (currentRevision === lastLocalRevisionRef.current) {
      return;
    }

    // Mark as having unsynced changes
    setSyncState(prev => ({ ...prev, hasUnsyncedChanges: true }));

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounced save
    saveTimeoutRef.current = setTimeout(() => {
      syncToServer(localPortfolio);
      lastLocalRevisionRef.current = currentRevision;
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [localPortfolio, isAuthenticated, isAuthAvailable, autoSync, debounceMs, syncToServer]);

  // ============================================
  // ONLINE/OFFLINE DETECTION
  // ============================================

  useEffect(() => {
    const handleOnline = async () => {
      if (syncState.hasUnsyncedChanges && localPortfolio) {
        await syncToServer(localPortfolio);
      }
    };

    const handleOffline = () => {
      setSyncState(prev => ({ ...prev, status: 'offline' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncState.hasUnsyncedChanges, localPortfolio, syncToServer]);

  return {
    syncState,
    syncToServer,
    syncFromServer,
    forceSync,
  };
}

// ============================================
// HELPERS
// ============================================

/**
 * Compare two portfolios to detect meaningful changes
 */
function hasLocalChanges(local, server) {
  if (!local || !server) return false;

  // Compare cash balance
  if (local.cash !== server.cash) return true;

  // Compare positions count
  const localPositions = local.positions || [];
  const serverPositions = server.positions || [];

  if (localPositions.length !== serverPositions.length) return true;

  // Compare each position
  const serverMap = new Map(serverPositions.map(p => [p.symbol, p]));
  for (const localPos of localPositions) {
    const serverPos = serverMap.get(localPos.symbol);
    if (!serverPos) return true;
    if (localPos.shares !== serverPos.shares) return true;
    if (localPos.avgCost !== serverPos.avgCost) return true;
  }

  return false;
}

export default usePortfolioSync;
