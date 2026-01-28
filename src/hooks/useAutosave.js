/**
 * useAutosave Hook
 *
 * @module hooks/useAutosave
 * @description Debounced autosave with status tracking.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Autosave status enum
 */
export const AutosaveStatus = {
  IDLE: 'idle',
  SAVING: 'saving',
  SAVED: 'saved',
  ERROR: 'error',
};

/**
 * Hook for automatic saving with debounce and status tracking.
 *
 * @param {any} data - Data to save (changes trigger save)
 * @param {Function} saveFunction - Async function to save data
 * @param {Object} options - Configuration options
 * @param {number} options.delay - Debounce delay in ms (default: 1000)
 * @param {boolean} options.enabled - Whether autosave is enabled (default: true)
 * @param {Function} options.onError - Error callback
 * @param {Function} options.onSave - Success callback
 * @returns {Object} { status, lastSaved, error, saveNow, isSaving }
 */
export function useAutosave(data, saveFunction, options = {}) {
  const {
    delay = 1000,
    enabled = true,
    onError,
    onSave,
  } = options;

  const [status, setStatus] = useState(AutosaveStatus.IDLE);
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);

  const timeoutRef = useRef(null);
  const lastDataRef = useRef(data);
  const isMountedRef = useRef(true);
  const pendingSaveRef = useRef(false);

  // Clear timeout on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Perform the save
  const performSave = useCallback(async (dataToSave) => {
    if (!isMountedRef.current) return;

    setStatus(AutosaveStatus.SAVING);
    setError(null);
    pendingSaveRef.current = false;

    try {
      await saveFunction(dataToSave);

      if (!isMountedRef.current) return;

      const savedTime = new Date();
      setLastSaved(savedTime);
      setStatus(AutosaveStatus.SAVED);

      if (onSave) {
        onSave(dataToSave, savedTime);
      }

      // Reset to idle after a delay
      setTimeout(() => {
        if (isMountedRef.current) {
          setStatus(AutosaveStatus.IDLE);
        }
      }, 2000);
    } catch (err) {
      if (!isMountedRef.current) return;

      console.error('Autosave error:', err);
      setError(err);
      setStatus(AutosaveStatus.ERROR);

      if (onError) {
        onError(err);
      }
    }
  }, [saveFunction, onSave, onError]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    await performSave(lastDataRef.current);
  }, [performSave]);

  // Debounced save on data change
  useEffect(() => {
    if (!enabled) return;

    // Skip if data hasn't actually changed (using JSON comparison)
    const dataStr = JSON.stringify(data);
    const lastDataStr = JSON.stringify(lastDataRef.current);

    if (dataStr === lastDataStr && lastSaved !== null) {
      return;
    }

    lastDataRef.current = data;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set pending state
    pendingSaveRef.current = true;

    // Schedule new save
    timeoutRef.current = setTimeout(() => {
      if (pendingSaveRef.current && isMountedRef.current) {
        performSave(data);
      }
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, enabled, performSave, lastSaved]);

  return {
    status,
    lastSaved,
    error,
    saveNow,
    isSaving: status === AutosaveStatus.SAVING,
  };
}

export default useAutosave;
