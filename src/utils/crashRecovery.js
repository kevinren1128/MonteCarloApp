/**
 * Crash Recovery Utility
 *
 * @module utils/crashRecovery
 * @description Handles crash detection and recovery for incomplete operations.
 */

const RECOVERY_KEY = 'monte-carlo-recovery';
const OPERATION_TIMEOUT = 30000; // 30 seconds

/**
 * Operation types that can be recovered
 */
export const OperationType = {
  SIMULATION: 'simulation',
  OPTIMIZATION: 'optimization',
  DATA_LOAD: 'dataLoad',
  CORRELATION: 'correlation',
};

/**
 * Mark the start of an operation with a snapshot.
 *
 * @param {string} operationType - Type of operation
 * @param {any} snapshot - State snapshot to restore on recovery
 * @param {Object} metadata - Additional metadata (optional)
 */
export function markOperationStart(operationType, snapshot, metadata = {}) {
  try {
    const recoveryData = {
      operationType,
      snapshot,
      metadata,
      startedAt: Date.now(),
      completed: false,
    };
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(recoveryData));
    console.log(`[Recovery] Marked operation start: ${operationType}`);
  } catch (e) {
    console.warn('[Recovery] Failed to mark operation start:', e);
  }
}

/**
 * Mark the current operation as complete.
 * This clears the recovery state.
 */
export function markOperationComplete() {
  try {
    const stored = localStorage.getItem(RECOVERY_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      data.completed = true;
      data.completedAt = Date.now();
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(data));
      console.log(`[Recovery] Marked operation complete: ${data.operationType}`);

      // Clear after a short delay
      setTimeout(() => {
        clearRecoveryState();
      }, 5000);
    }
  } catch (e) {
    console.warn('[Recovery] Failed to mark operation complete:', e);
  }
}

/**
 * Clear the recovery state.
 */
export function clearRecoveryState() {
  try {
    localStorage.removeItem(RECOVERY_KEY);
    console.log('[Recovery] Cleared recovery state');
  } catch (e) {
    console.warn('[Recovery] Failed to clear recovery state:', e);
  }
}

/**
 * Check if there's an incomplete operation that needs recovery.
 *
 * @returns {Object|null} Recovery data if recovery is needed, null otherwise
 */
export function checkRecoveryNeeded() {
  try {
    const stored = localStorage.getItem(RECOVERY_KEY);
    if (!stored) return null;

    const data = JSON.parse(stored);

    // Already completed
    if (data.completed) {
      clearRecoveryState();
      return null;
    }

    // Check if operation timed out (was incomplete for too long)
    const elapsed = Date.now() - data.startedAt;
    if (elapsed > OPERATION_TIMEOUT) {
      console.log(`[Recovery] Found incomplete operation: ${data.operationType} (${(elapsed / 1000).toFixed(1)}s ago)`);
      return {
        operationType: data.operationType,
        snapshot: data.snapshot,
        metadata: data.metadata,
        startedAt: data.startedAt,
        elapsed,
      };
    }

    // Operation still potentially running, don't interfere
    return null;
  } catch (e) {
    console.warn('[Recovery] Failed to check recovery state:', e);
    clearRecoveryState();
    return null;
  }
}

/**
 * Get human-readable description of the incomplete operation.
 *
 * @param {string} operationType - Type of operation
 * @returns {string} Description
 */
export function getOperationDescription(operationType) {
  switch (operationType) {
    case OperationType.SIMULATION:
      return 'Monte Carlo simulation';
    case OperationType.OPTIMIZATION:
      return 'Portfolio optimization';
    case OperationType.DATA_LOAD:
      return 'Market data loading';
    case OperationType.CORRELATION:
      return 'Correlation computation';
    default:
      return 'Operation';
  }
}

/**
 * Create a simple state snapshot for positions.
 * Only stores essential data to keep storage small.
 *
 * @param {Array} positions - Positions array
 * @returns {Array} Simplified snapshot
 */
export function createPositionsSnapshot(positions) {
  return positions.map(p => ({
    id: p.id,
    ticker: p.ticker,
    quantity: p.quantity,
    price: p.price,
    p5: p.p5,
    p25: p.p25,
    p50: p.p50,
    p75: p.p75,
    p95: p.p95,
  }));
}

/**
 * Restore positions from a snapshot.
 * Merges snapshot data with defaults for any missing fields.
 *
 * @param {Array} snapshot - Positions snapshot
 * @param {Object} defaults - Default values for a position
 * @returns {Array} Restored positions
 */
export function restorePositionsFromSnapshot(snapshot, defaults = {}) {
  return snapshot.map(p => ({
    ...defaults,
    ...p,
  }));
}

export default {
  OperationType,
  markOperationStart,
  markOperationComplete,
  clearRecoveryState,
  checkRecoveryNeeded,
  getOperationDescription,
  createPositionsSnapshot,
  restorePositionsFromSnapshot,
};
