import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';

const PortfolioContext = createContext(null);

// Reducer for complex state updates with undo/redo support
const portfolioReducer = (state, action) => {
  switch (action.type) {
    case 'SET_POSITIONS':
      return { ...state, positions: action.payload };
    case 'ADD_POSITION':
      return { ...state, positions: [...state.positions, action.payload], history: [...state.history, state], future: [] };
    case 'UPDATE_POSITION':
      const updatedPositions = state.positions.map(pos => 
        pos.symbol === action.payload.symbol ? { ...pos, ...action.payload } : pos
      );
      return { ...state, positions: updatedPositions, history: [...state.history, state], future: [] };
    case 'REMOVE_POSITION':
      const filteredPositions = state.positions.filter(pos => pos.symbol !== action.payload);
      return { ...state, positions: filteredPositions, history: [...state.history, state], future: [] };
    case 'CASH_UPDATE':
      return { ...state, cashBalance: action.payload, history: [...state.history, state], future: [] };
    case 'UNDO':
      if (state.history.length === 0) return state;
      const previousState = state.history[state.history.length - 1];
      return {
        ...previousState,
        history: state.history.slice(0, -1),
        future: [state, ...state.future]
      };
    case 'REDO':
      if (state.future.length === 0) return state;
      const nextState = state.future[0];
      return {
        ...nextState,
        history: [...state.history, state],
        future: state.future.slice(1)
      };
    default:
      return state;
  }
};

export const PortfolioProvider = ({ children }) => {
  const initialState = {
    positions: [],
    cashBalance: 100000,
    cashRate: 0.02,
    positionMetadata: {},
    thematicOverrides: {},
    sort: 'symbol',
    filter: 'all',
    search: '',
    history: [],
    future: []
  };

  const [state, dispatch] = useReducer(portfolioReducer, initialState);

  // Core CRUD operations
  const setPositions = useCallback((positions) => {
    dispatch({ type: 'SET_POSITIONS', payload: positions });
  }, []);

  const addPosition = useCallback((position) => {
    dispatch({ type: 'ADD_POSITION', payload: position });
  }, []);

  const updatePosition = useCallback((symbol, updates) => {
    dispatch({ type: 'UPDATE_POSITION', payload: { symbol, ...updates } });
  }, []);

  const removePosition = useCallback((symbol) => {
    dispatch({ type: 'REMOVE_POSITION', payload: symbol });
  }, []);

  const setCashBalance = useCallback((balance) => {
    dispatch({ type: 'CASH_UPDATE', payload: balance });
  }, []);

  // Navigation
  const canUndo = state.history.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    if (canUndo) dispatch({ type: 'UNDO' });
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) dispatch({ type: 'REDO' });
  }, [canRedo]);

  // Derived values
  const totalValue = useMemo(() => {
    return state.positions.reduce((total, pos) => total + (pos.shares * pos.currentPrice), 0) + state.cashBalance;
  }, [state.positions, state.cashBalance]);

  const weights = useMemo(() => {
    const totalPositionValue = state.positions.reduce((total, pos) => total + (pos.shares * pos.currentPrice), 0);
    return state.positions.reduce((wts, pos) => {
      wts[pos.symbol] = totalPositionValue > 0 ? (pos.shares * pos.currentPrice) / totalPositionValue : 0;
      return wts;
    }, {});
  }, [state.positions, totalValue]);

  const value = {
    // State
    ...state,
    totalValue,
    weights,
    // Actions
    setPositions,
    addPosition,
    updatePosition,
    removePosition,
    setCashBalance,
    undo,
    redo,
    canUndo,
    canRedo
  };

  return (
    <PortfolioContext.Provider value={value}>
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolioContext = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolioContext must be used within PortfolioProvider');
  }
  return context;
};
