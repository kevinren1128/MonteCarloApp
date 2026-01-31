/**
 * Portfolio Sync Hook
 *
 * @module hooks/usePortfolioSync
 * @description Handles synchronization between local portfolio state and Supabase.
 *
 * Sync Strategy:
 * 1. On login: Fetch all data from server and restore state
 * 2. On position changes: Debounced save to server
 * 3. After analysis runs: Save results to server
 * 4. Offline: Keep localStorage, sync when back online
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchAllData,
  savePositions,
  saveCorrelation,
  saveSimulationResults,
  saveFactorResults,
  saveOptimizationResults,
  saveSettings,
  isSyncAvailable,
  saveCorrelationGroups,
  loadCorrelationGroups,
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
 * @param {Object} options - Sync options
 * @param {number} options.debounceMs - Debounce delay for saves (default: 2000)
 * @param {boolean} options.autoSync - Enable automatic syncing (default: true)
 * @returns {{
 *   syncState: SyncState,
 *   loadFromServer: Function,
 *   savePositionsToServer: Function,
 *   saveCorrelationToServer: Function,
 *   saveSimulationToServer: Function,
 *   saveFactorsToServer: Function,
 *   saveOptimizationToServer: Function,
 *   saveSettingsToServer: Function,
 * }}
 */
export function usePortfolioSync(options = {}) {
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
  const isSyncingRef = useRef(false);

  // ============================================
  // LOAD FROM SERVER (on login)
  // ============================================

  /**
   * Load all user data from server
   * Call this on login to restore full state
   * @returns {Promise<{data: Object|null, error: Error|null}>}
   */
  const loadFromServer = useCallback(async () => {
    if (!isAuthenticated || !isAuthAvailable) {
      return { data: null, error: null };
    }

    isSyncingRef.current = true;
    setSyncState(prev => ({ ...prev, status: 'syncing', error: null }));

    try {
      const { data, error } = await fetchAllData();

      if (error) {
        console.error('[usePortfolioSync] Load error:', error);
        setSyncState(prev => ({ ...prev, status: 'error', error }));
        return { data: null, error };
      }

      setSyncState({
        status: 'synced',
        lastSynced: new Date(),
        error: null,
        hasUnsyncedChanges: false,
      });

      console.log('[usePortfolioSync] Loaded data from server:', data ? 'success' : 'no data');
      return { data, error: null };
    } catch (error) {
      console.error('[usePortfolioSync] Load exception:', error);
      setSyncState(prev => ({ ...prev, status: 'error', error }));
      return { data: null, error };
    } finally {
      isSyncingRef.current = false;
    }
  }, [isAuthenticated, isAuthAvailable]);

  // ============================================
  // SAVE POSITIONS (debounced)
  // ============================================

  /**
   * Save positions to server
   * @param {Array} positions - Array of position objects
   * @param {number} cashBalance - Cash balance
   * @param {boolean} immediate - Skip debounce if true
   */
  const savePositionsToServer = useCallback(async (positions, cashBalance = 0, immediate = false) => {
    if (!isAuthenticated || !isAuthAvailable) {
      return { success: false, error: null };
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    const doSave = async () => {
      if (isSyncingRef.current) return { success: false, error: null };

      isSyncingRef.current = true;
      setSyncState(prev => ({ ...prev, status: 'syncing' }));

      try {
        const { success, error } = await savePositions(positions, cashBalance);

        if (error) {
          setSyncState(prev => ({ ...prev, status: 'error', error, hasUnsyncedChanges: true }));
          return { success: false, error };
        }

        setSyncState({
          status: 'synced',
          lastSynced: new Date(),
          error: null,
          hasUnsyncedChanges: false,
        });

        return { success: true, error: null };
      } catch (error) {
        console.error('[usePortfolioSync] Save positions error:', error);
        setSyncState(prev => ({ ...prev, status: 'error', error, hasUnsyncedChanges: true }));
        return { success: false, error };
      } finally {
        isSyncingRef.current = false;
      }
    };

    if (immediate) {
      return doSave();
    }

    // Mark as having unsynced changes
    setSyncState(prev => ({ ...prev, hasUnsyncedChanges: true }));

    // Debounced save
    return new Promise((resolve) => {
      saveTimeoutRef.current = setTimeout(async () => {
        const result = await doSave();
        resolve(result);
      }, debounceMs);
    });
  }, [isAuthenticated, isAuthAvailable, debounceMs]);

  // ============================================
  // SAVE CORRELATION MATRIX
  // ============================================

  const saveCorrelationToServer = useCallback(async (correlationMatrix, method, tickers) => {
    if (!isAuthenticated || !isAuthAvailable || !correlationMatrix) {
      return { success: false, error: null };
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      const { success, error } = await saveCorrelation(correlationMatrix, method, tickers);

      if (error) {
        setSyncState(prev => ({ ...prev, status: 'error', error }));
        return { success: false, error };
      }

      setSyncState(prev => ({
        ...prev,
        status: 'synced',
        lastSynced: new Date(),
      }));

      return { success: true, error: null };
    } catch (error) {
      console.error('[usePortfolioSync] Save correlation error:', error);
      setSyncState(prev => ({ ...prev, status: 'error', error }));
      return { success: false, error };
    }
  }, [isAuthenticated, isAuthAvailable]);

  // ============================================
  // SAVE SIMULATION RESULTS
  // ============================================

  const saveSimulationToServer = useCallback(async (results) => {
    if (!isAuthenticated || !isAuthAvailable || !results) {
      return { success: false, error: null };
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      const { success, error } = await saveSimulationResults(results);

      if (error) {
        setSyncState(prev => ({ ...prev, status: 'error', error }));
        return { success: false, error };
      }

      setSyncState(prev => ({
        ...prev,
        status: 'synced',
        lastSynced: new Date(),
      }));

      return { success: true, error: null };
    } catch (error) {
      console.error('[usePortfolioSync] Save simulation error:', error);
      setSyncState(prev => ({ ...prev, status: 'error', error }));
      return { success: false, error };
    }
  }, [isAuthenticated, isAuthAvailable]);

  // ============================================
  // SAVE FACTOR RESULTS
  // ============================================

  const saveFactorsToServer = useCallback(async (results) => {
    if (!isAuthenticated || !isAuthAvailable || !results) {
      return { success: false, error: null };
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      const { success, error } = await saveFactorResults(results);

      if (error) {
        setSyncState(prev => ({ ...prev, status: 'error', error }));
        return { success: false, error };
      }

      setSyncState(prev => ({
        ...prev,
        status: 'synced',
        lastSynced: new Date(),
      }));

      return { success: true, error: null };
    } catch (error) {
      console.error('[usePortfolioSync] Save factors error:', error);
      setSyncState(prev => ({ ...prev, status: 'error', error }));
      return { success: false, error };
    }
  }, [isAuthenticated, isAuthAvailable]);

  // ============================================
  // SAVE OPTIMIZATION RESULTS
  // ============================================

  const saveOptimizationToServer = useCallback(async (results) => {
    if (!isAuthenticated || !isAuthAvailable || !results) {
      return { success: false, error: null };
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));

    try {
      const { success, error } = await saveOptimizationResults(results);

      if (error) {
        setSyncState(prev => ({ ...prev, status: 'error', error }));
        return { success: false, error };
      }

      setSyncState(prev => ({
        ...prev,
        status: 'synced',
        lastSynced: new Date(),
      }));

      return { success: true, error: null };
    } catch (error) {
      console.error('[usePortfolioSync] Save optimization error:', error);
      setSyncState(prev => ({ ...prev, status: 'error', error }));
      return { success: false, error };
    }
  }, [isAuthenticated, isAuthAvailable]);

  // ============================================
  // SAVE SETTINGS
  // ============================================

  const saveSettingsToServer = useCallback(async (settings) => {
    if (!isAuthenticated || !isAuthAvailable || !settings) {
      return { success: false, error: null };
    }

    try {
      const { success, error } = await saveSettings(settings);
      return { success, error };
    } catch (error) {
      console.error('[usePortfolioSync] Save settings error:', error);
      return { success: false, error };
    }
  }, [isAuthenticated, isAuthAvailable]);

  // ============================================
  // CORRELATION GROUPS
  // ============================================

  const saveCorrelationGroupsToServer = useCallback(async (groups, groupType = 'sector', source = 'auto') => {
    if (!isAuthenticated || !isAuthAvailable || !groups) {
      return { success: false, error: null };
    }

    try {
      const { success, error } = await saveCorrelationGroups(groups, groupType, source);
      if (success) {
        setSyncState(prev => ({
          ...prev,
          status: 'synced',
          lastSynced: new Date(),
        }));
      }
      return { success, error };
    } catch (error) {
      console.error('[usePortfolioSync] Save correlation groups error:', error);
      return { success: false, error };
    }
  }, [isAuthenticated, isAuthAvailable]);

  const loadCorrelationGroupsFromServer = useCallback(async () => {
    if (!isAuthenticated || !isAuthAvailable) {
      return { groups: null, tickerToGroup: null, error: null };
    }

    try {
      const { groups, tickerToGroup, error } = await loadCorrelationGroups();
      return { groups, tickerToGroup, error };
    } catch (error) {
      console.error('[usePortfolioSync] Load correlation groups error:', error);
      return { groups: null, tickerToGroup: null, error };
    }
  }, [isAuthenticated, isAuthAvailable]);

  // ============================================
  // CLEANUP
  // ============================================

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ============================================
  // ONLINE/OFFLINE DETECTION
  // ============================================

  useEffect(() => {
    const handleOnline = () => {
      if (syncState.status === 'offline') {
        setSyncState(prev => ({ ...prev, status: 'idle' }));
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
  }, [syncState.status]);

  return {
    syncState,
    loadFromServer,
    savePositionsToServer,
    saveCorrelationToServer,
    saveSimulationToServer,
    saveFactorsToServer,
    saveOptimizationToServer,
    saveSettingsToServer,
    saveCorrelationGroupsToServer,
    loadCorrelationGroupsFromServer,
  };
}

export default usePortfolioSync;
