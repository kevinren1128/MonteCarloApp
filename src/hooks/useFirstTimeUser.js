/**
 * useFirstTimeUser Hook
 *
 * @module hooks/useFirstTimeUser
 * @description Detects first-time users after login and manages onboarding state.
 *
 * A user is considered "first-time" if:
 * 1. They just logged in (authentication state changed to authenticated)
 * 2. They have no positions saved in the cloud
 * 3. They haven't completed onboarding before (localStorage flag not set)
 *
 * Usage:
 * const { isFirstTimeUser, completeOnboarding, shouldShowOnboarding } = useFirstTimeUser();
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { STORAGE_KEYS, loadFromStorage, saveToStorage } from '../constants/storage';

/**
 * Hook to detect and manage first-time user onboarding
 *
 * @returns {{
 *   isFirstTimeUser: boolean,
 *   shouldShowOnboarding: boolean,
 *   completeOnboarding: Function,
 *   triggerOnboardingCheck: Function,
 * }}
 */
export function useFirstTimeUser() {
  // Check if onboarding was already completed (persisted)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => {
    return !!loadFromStorage(STORAGE_KEYS.ONBOARDING_COMPLETED);
  });

  // Track whether we should show onboarding (set after login + empty portfolio check)
  const [shouldShowOnboarding, setShouldShowOnboarding] = useState(false);

  // Ref to prevent multiple triggers
  const hasTriggeredRef = useRef(false);

  /**
   * Check if user is first-time based on server data
   * Called after login when server data is loaded
   *
   * @param {Object} serverData - Data loaded from server
   * @param {Array} serverData.positions - User's positions from cloud
   * @returns {boolean} Whether user appears to be first-time
   */
  const triggerOnboardingCheck = useCallback((serverData) => {
    // Don't trigger if already completed onboarding
    if (hasCompletedOnboarding) {
      console.log('[useFirstTimeUser] Onboarding already completed, skipping');
      return false;
    }

    // Don't trigger multiple times in one session
    if (hasTriggeredRef.current) {
      console.log('[useFirstTimeUser] Already triggered this session, skipping');
      return false;
    }

    // Check if user has any positions
    const hasPositions = serverData?.positions && serverData.positions.length > 0;

    if (!hasPositions) {
      // First-time user: no positions and hasn't completed onboarding
      console.log('[useFirstTimeUser] First-time user detected - no positions, showing onboarding');
      hasTriggeredRef.current = true;
      setShouldShowOnboarding(true);
      return true;
    }

    console.log('[useFirstTimeUser] Returning user with positions, skipping onboarding');
    return false;
  }, [hasCompletedOnboarding]);

  /**
   * Mark onboarding as complete
   * Called when user closes the guide modal
   */
  const completeOnboarding = useCallback(() => {
    console.log('[useFirstTimeUser] Marking onboarding as complete');
    setHasCompletedOnboarding(true);
    setShouldShowOnboarding(false);
    saveToStorage(STORAGE_KEYS.ONBOARDING_COMPLETED, true);
  }, []);

  /**
   * Reset onboarding state (for testing purposes)
   */
  const resetOnboarding = useCallback(() => {
    console.log('[useFirstTimeUser] Resetting onboarding state');
    setHasCompletedOnboarding(false);
    setShouldShowOnboarding(false);
    hasTriggeredRef.current = false;
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING_COMPLETED);
  }, []);

  return {
    /** Whether user has never completed onboarding */
    isFirstTimeUser: !hasCompletedOnboarding,

    /** Whether to show the onboarding modal now */
    shouldShowOnboarding,

    /** Call when user completes/dismisses onboarding */
    completeOnboarding,

    /** Call after login with server data to check if should show onboarding */
    triggerOnboardingCheck,

    /** Reset onboarding state (for testing) */
    resetOnboarding,
  };
}

export default useFirstTimeUser;
