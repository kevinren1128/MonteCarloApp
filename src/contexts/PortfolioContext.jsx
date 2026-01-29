import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

/**
 * @typedef {Object} Position
 * @property {string} ticker - Stock ticker symbol
 * @property {number} shares - Number of shares
 * @property {number} price - Current price per share
 */

/**
 * @typedef {Object} PortfolioState
 * @property {Position[]} positions - Array of portfolio positions
 * @property {number} cashBalance - Available cash balance
 * @property {number} cashRate - Annual rate for cash position
 * @property {number} portfolioValue - Computed total portfolio value
 * @property {Object} weights - Computed position weights
 */

/**
 * @typedef {Object} PortfolioContextValue
 * @property {PortfolioState} state - Portfolio state
 * @property {Function} addPosition - Add a new position
 * @property {Function} updatePosition - Update existing position
 * @property {Function} deletePosition - Remove a position
 * @property {Function} setCashBalance - Set cash balance
 * @property {Function} setCashRate - Set cash rate
 * @property {Function} undo - Undo last change
 * @property {Function} redo - Redo last undone change
 * @property {boolean} canUndo - Whether undo is available
 * @property {boolean} canRedo - Whether redo is available
 */

export const PortfolioContext = createContext(null);

/**
 * PortfolioContext Provider component
 * Manages portfolio positions, cash balance, and undo/redo functionality
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function PortfolioProvider({ children }) {
  const [positions, setPositions] = useState([]);
  const [cashBalance, setCashBalance] = useState(10000);
  const [cashRate, setCashRate] = useState(0.05);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Computed portfolio value
  const portfolioValue = useMemo(() => {
    const positionsValue = positions.reduce((sum, pos) => sum + (pos.shares * pos.price), 0);
    return positionsValue + cashBalance;
  }, [positions, cashBalance]);

  // Computed position weights
  const weights = useMemo(() => {
    if (portfolioValue === 0) return {};
    
    const result = {};
    positions.forEach(pos => {
      result[pos.ticker] = (pos.shares * pos.price) / portfolioValue;
    });
    result.CASH = cashBalance / portfolioValue;
    
    return result;
  }, [positions, cashBalance, portfolioValue]);

  const addPosition = useCallback((position) => {
    setPositions(prev => [...prev, position]);
    // TODO: Add to history for undo/redo
  }, []);

  const updatePosition = useCallback((ticker, updates) => {
    setPositions(prev => 
      prev.map(pos => pos.ticker === ticker ? { ...pos, ...updates } : pos)
    );
    // TODO: Add to history for undo/redo
  }, []);

  const deletePosition = useCallback((ticker) => {
    setPositions(prev => prev.filter(pos => pos.ticker !== ticker));
    // TODO: Add to history for undo/redo
  }, []);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      // TODO: Restore state from history
    }
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      // TODO: Restore state from history
    }
  }, [historyIndex, history.length]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const value = useMemo(() => ({
    state: {
      positions,
      cashBalance,
      cashRate,
      portfolioValue,
      weights,
    },
    addPosition,
    updatePosition,
    deletePosition,
    setCashBalance,
    setCashRate,
    undo,
    redo,
    canUndo,
    canRedo,
  }), [
    positions,
    cashBalance,
    cashRate,
    portfolioValue,
    weights,
    addPosition,
    updatePosition,
    deletePosition,
    undo,
    redo,
    canUndo,
    canRedo,
  ]);

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

/**
 * Hook to access Portfolio context
 * @returns {PortfolioContextValue}
 * @throws {Error} If used outside PortfolioProvider
 */
export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
}
