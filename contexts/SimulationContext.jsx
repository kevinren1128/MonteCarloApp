import React, { createContext, useContext, useReducer, useRef } from 'react';

const SimulationContext = createContext(null);

const simulationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_SIMULATION_RESULTS':
      return { ...state, simulationResults: action.payload };
    case 'SET_PREVIOUS_RESULTS':
      return { ...state, previousSimulationResults: action.payload };
    case 'SET_OPTIMIZATION_RESULTS':
      return { ...state, optimizationResults: action.payload };
    case 'SET_SELECTED_SWAP':
      return { ...state, selectedSwap: action.payload };
    case 'SET_SWAP_VALIDATION':
      return { ...state, swapValidationResults: action.payload };
    case 'SET_THEMATIC_RESULTS':
      return { ...state, thematicSwapResults: action.payload };
    case 'SET_THEMATIC_PROGRESS':
      return { ...state, thematicSwapProgress: action.payload };
    case 'UPDATE_HOVERED_SCENARIO':
      return { ...state, hoveredScenario: action.payload };
    case 'SET_SIMULATION_WORKER':
      return { ...state, simulationWorkerRef: action.payload };
    case 'RESET_SIMULATION':
      return { ...state, simulationResults: null, optimizationResults: null, selectedSwap: null };
    default:
      return state;
  }
};

export const SimulationProvider = ({ children }) => {
  const initialState = {
    simulationResults: null,
    previousSimulationResults: null,
    optimizationResults: null,
    selectedSwap: null,
    swapValidationResults: null,
    thematicSwapResults: null,
    thematicSwapProgress: { current: 0, total: 0, phase: '' },
    hoveredScenario: null,
    simulationWorkerRef: null
  };

  const [state, dispatch] = useReducer(simulationReducer, initialState);

  // Worker management
  const simulationWorkerRef = useRef(null);

  // Action creators
  const setSimulationResults = useCallback((results) => {
    dispatch({ type: 'SET_SIMULATION_RESULTS', payload: results });
  }, []);

  const setPreviousResults = useCallback((results) => {
    dispatch({ type: 'SET_PREVIOUS_RESULTS', payload: results });
  }, []);

  const setOptimizationResults = useCallback((results) => {
    dispatch({ type: 'SET_OPTIMIZATION_RESULTS', payload: results });
  }, []);

  const setSelectedSwap = useCallback((swap) => {
    dispatch({ type: 'SET_SELECTED_SWAP', payload: swap });
  }, []);

  const setSwapValidationResults = useCallback((validation) => {
    dispatch({ type: 'SET_SWAP_VALIDATION', payload: validation });
  }, []);

  const setThematicResults = useCallback((results) => {
    dispatch({ type: 'SET_THEMATIC_RESULTS', payload: results });
  }, []);

  const setThematicProgress = useCallback((progress) => {
    dispatch({ type: 'SET_THEMATIC_PROGRESS', payload: progress });
  }, []);

  const updateHoveredScenario = useCallback((scenario) => {
    dispatch({ type: 'UPDATE_HOVERED_SCENARIO', payload: scenario });
  }, []);

  const resetSimulation = useCallback(() => {
    dispatch({ type: 'RESET_SIMULATION' });
  }, []);

  // Progress controls
  const startSimulation = useCallback(() => {
    setThematicProgress({ current: 0, total: 100, phase: 'initialization' });
  }, [setThematicProgress]);

  const updateProgress = useCallback((phase, current, total) => {
    setThematicProgress({ current, total, phase });
  }, [setThematicProgress]);

  // Derived values
  const hasSimulation = useCallback(() => state.simulationResults !== null, [state.simulationResults]);
  const hasOptimization = useCallback(() => state.optimizationResults !== null, [state.optimizationResults]);
  const hasSelectedSwap = useCallback(() => state.selectedSwap !== null, [state.selectedSwap]);
  const hasThematicResults = useCallback(() => state.thematicSwapResults !== null, [state.thematicSwapResults]);

  const value = {
    ...state,
    // Actions
    setSimulationResults,
    setPreviousResults,
    setOptimizationResults,
    setSelectedSwap,
    setSwapValidationResults,
    setThematicResults,
    setThematicProgress,
    updateHoveredScenario,
    resetSimulation,
    startSimulation,
    updateProgress,
    // Predicates
    hasSimulation,
    hasOptimization,
    hasSelectedSwap,
    hasThematicResults,
    // Refs
    simulationWorkerRef
  };

  return (
    <SimulationContext.Provider value={value}>
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulationContext = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulationContext must be used within SimulationProvider');
  }
  return context;
};
