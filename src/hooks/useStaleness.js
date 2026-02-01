/**
 * Staleness Tracking Hook
 *
 * Tracks whether analysis outputs are stale based on input changes.
 * Uses version counters to detect when inputs change and compare
 * against when each tab was last computed.
 *
 * Dependency Flow:
 * - Positions change → Distributions, Correlation stale → Simulation, Factors, Optimize stale
 * - Distributions change → Simulation, Optimize stale (NOT Correlation - uses historical data)
 * - Correlation change → Simulation, Optimize stale (NOT Factors - doesn't use correlation)
 *
 * Status Types:
 * - 'fresh': Tab is up-to-date with all inputs
 * - 'stale': Tab was run but inputs have changed since
 * - 'blocked': Can't run because upstream tab is stale
 * - 'never': Tab has never been run
 */

import { useMemo, useCallback } from 'react';

// Which input versions each tab depends on
export const DEPENDENCIES = {
  distributions: ['positions'],
  correlation: ['positions'],
  simulation: ['positions', 'distributions', 'correlation'],
  factors: ['positions'],
  optimize: ['positions', 'distributions', 'correlation'],
};

// Which upstream TABS must be fresh before this tab can run
// (not inputs, but the actual tab outputs)
export const BLOCKERS = {
  simulation: ['distributions', 'correlation'],
  optimize: ['simulation'],  // Can't optimize without fresh simulation
  // factors: [],  // No blockers - just needs positions
  // distributions: [],  // No blockers - just needs positions
  // correlation: [],  // No blockers - just needs positions
};

/**
 * Get the status of a single tab
 */
function getTabStatus(tab, inputVersions, tabComputedVersions, computedStatuses) {
  const computed = tabComputedVersions[tab];
  const deps = DEPENDENCIES[tab] || [];

  // Never run if computed versions are -1
  if (!computed || deps.some(dep => computed[dep] === undefined || computed[dep] < 0)) {
    return 'never';
  }

  // Stale if any input version is newer than what we computed with
  const isStale = deps.some(dep => {
    const inputVer = inputVersions[dep] ?? 0;
    const compVer = computed[dep] ?? -1;
    return inputVer > compVer;
  });

  if (isStale) {
    return 'stale';
  }

  // Blocked if any blocker tab is stale or never run
  const blockerTabs = BLOCKERS[tab] || [];
  const isBlocked = blockerTabs.some(blockerTab => {
    const blockerStatus = computedStatuses[blockerTab];
    return blockerStatus === 'stale' || blockerStatus === 'never';
  });

  if (isBlocked) {
    return 'blocked';
  }

  return 'fresh';
}

/**
 * Compute statuses for all tabs
 * Two-pass to handle blocker dependencies correctly
 */
export function computeStatuses(inputVersions, tabComputedVersions) {
  const statuses = {};

  // First pass: compute without blockers (just stale/never/fresh)
  for (const tab of Object.keys(DEPENDENCIES)) {
    statuses[tab] = getTabStatus(tab, inputVersions, tabComputedVersions, {});
  }

  // Second pass: apply blocker logic
  for (const tab of Object.keys(DEPENDENCIES)) {
    statuses[tab] = getTabStatus(tab, inputVersions, tabComputedVersions, statuses);
  }

  return statuses;
}

/**
 * Get a human-readable reason for the status
 */
export function getStatusReason(tab, status, inputVersions, tabComputedVersions) {
  if (status === 'fresh') return null;
  if (status === 'never') return 'This analysis has not been run yet.';

  if (status === 'stale') {
    const computed = tabComputedVersions[tab] || {};
    const deps = DEPENDENCIES[tab] || [];
    const staleInputs = deps.filter(dep => {
      const inputVer = inputVersions[dep] ?? 0;
      const compVer = computed[dep] ?? -1;
      return inputVer > compVer;
    });

    const inputNames = staleInputs.map(s => {
      if (s === 'positions') return 'positions';
      if (s === 'distributions') return 'distribution parameters';
      if (s === 'correlation') return 'correlation matrix';
      return s;
    });

    return `Results are stale because ${inputNames.join(' and ')} changed.`;
  }

  if (status === 'blocked') {
    const blockerTabs = BLOCKERS[tab] || [];
    const blockingTabs = blockerTabs.filter(b => {
      const bStatus = getTabStatus(b, inputVersions, tabComputedVersions, {});
      return bStatus === 'stale' || bStatus === 'never';
    });

    const tabNames = blockingTabs.map(t => {
      if (t === 'distributions') return 'Distributions';
      if (t === 'correlation') return 'Correlation';
      if (t === 'simulation') return 'Simulation';
      return t;
    });

    return `Update ${tabNames.join(' and ')} first before running this analysis.`;
  }

  return null;
}

/**
 * Main hook for staleness tracking
 */
export function useStaleness(inputVersions, tabComputedVersions) {
  const statuses = useMemo(
    () => computeStatuses(inputVersions, tabComputedVersions),
    [inputVersions, tabComputedVersions]
  );

  const getStatus = useCallback((tab) => statuses[tab] || 'never', [statuses]);

  const getReason = useCallback((tab) => {
    const status = statuses[tab];
    return getStatusReason(tab, status, inputVersions, tabComputedVersions);
  }, [statuses, inputVersions, tabComputedVersions]);

  const isStale = useCallback((tab) => {
    const status = statuses[tab];
    return status === 'stale' || status === 'blocked';
  }, [statuses]);

  const canRun = useCallback((tab) => {
    const status = statuses[tab];
    return status !== 'blocked';
  }, [statuses]);

  return {
    statuses,
    getStatus,
    getReason,
    isStale,
    canRun,
  };
}

/**
 * Initial state for input versions
 */
export const initialInputVersions = {
  positions: 0,
  distributions: 0,
  correlation: 0,
};

/**
 * Initial state for tab computed versions
 * -1 means "never computed"
 */
export const initialTabComputedVersions = {
  distributions: { positions: -1 },
  correlation: { positions: -1 },
  simulation: { positions: -1, distributions: -1, correlation: -1 },
  factors: { positions: -1 },
  optimize: { positions: -1, distributions: -1, correlation: -1 },
};

export default useStaleness;
