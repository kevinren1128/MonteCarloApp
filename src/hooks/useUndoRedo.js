/**
 * useUndoRedo Hook
 *
 * @module hooks/useUndoRedo
 * @description History stack for undo/redo functionality.
 */

import { useState, useCallback, useRef } from 'react';

/**
 * Hook for undo/redo functionality with history tracking.
 *
 * @param {any} initialState - Initial state value
 * @param {Object} options - Configuration options
 * @param {number} options.maxHistory - Maximum history size (default: 50)
 * @returns {Object} { state, set, undo, redo, canUndo, canRedo, history, clear }
 */
export function useUndoRedo(initialState, options = {}) {
  const { maxHistory = 50 } = options;

  // Current state
  const [state, setState] = useState(initialState);

  // History stacks
  const pastRef = useRef([]);
  const futureRef = useRef([]);

  /**
   * Set new state with history tracking.
   * @param {any} newState - New state value or updater function
   * @param {Object} opts - Options
   * @param {boolean} opts.skipHistory - If true, don't record in history
   */
  const set = useCallback((newState, opts = {}) => {
    const { skipHistory = false } = opts;

    setState((currentState) => {
      const resolvedState =
        typeof newState === 'function' ? newState(currentState) : newState;

      // Don't record if same as current
      if (JSON.stringify(resolvedState) === JSON.stringify(currentState)) {
        return currentState;
      }

      if (!skipHistory) {
        // Add current state to past
        pastRef.current = [...pastRef.current, currentState];

        // Trim history if exceeds max
        if (pastRef.current.length > maxHistory) {
          pastRef.current = pastRef.current.slice(-maxHistory);
        }

        // Clear future (new action invalidates redo stack)
        futureRef.current = [];
      }

      return resolvedState;
    });
  }, [maxHistory]);

  /**
   * Undo to previous state.
   */
  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;

    setState((currentState) => {
      const previous = pastRef.current[pastRef.current.length - 1];

      // Move current to future
      futureRef.current = [currentState, ...futureRef.current];

      // Remove from past
      pastRef.current = pastRef.current.slice(0, -1);

      return previous;
    });
  }, []);

  /**
   * Redo to next state.
   */
  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;

    setState((currentState) => {
      const next = futureRef.current[0];

      // Move current to past
      pastRef.current = [...pastRef.current, currentState];

      // Remove from future
      futureRef.current = futureRef.current.slice(1);

      return next;
    });
  }, []);

  /**
   * Clear all history.
   */
  const clear = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
  }, []);

  /**
   * Reset to initial state and clear history.
   */
  const reset = useCallback(() => {
    setState(initialState);
    pastRef.current = [];
    futureRef.current = [];
  }, [initialState]);

  /**
   * Get current history state for debugging/display.
   */
  const getHistory = useCallback(() => ({
    past: [...pastRef.current],
    present: state,
    future: [...futureRef.current],
    pastLength: pastRef.current.length,
    futureLength: futureRef.current.length,
  }), [state]);

  return {
    state,
    set,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    clear,
    reset,
    history: getHistory,
  };
}

export default useUndoRedo;
