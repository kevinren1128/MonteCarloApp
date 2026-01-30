import React, { createContext, useContext, useReducer } from 'react';

const UIContext = createContext(null);

const uiReducer = (state, action) => {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: { ...state.loading, ...action.payload } };
    case 'SET_MODALS':
      return { ...state, modals: { ...state.modals, ...action.payload } };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'SET_SETTINGS_OVERRIDES':
      return { ...state, settingsOverrides: { ...state.settingsOverrides, ...action.payload } };
    default:
      return state;
  }
};

export const UIProvider = ({ children }) => {
  const initialState = {
    activeTab: 'positions',
    loading: {
      marketData: false,
      correlation: false,
      simulation: false,
      optimization: false,
      thematicAnalysis: false
    },
    modals: {
      settings: false,
      about: false,
      exportModal: false,
      optimizationDetails: false,
      swapValidation: false
    },
    notifications: [],
    settingsOverrides: {},
    environment: 'browser'
  };

  const [state, dispatch] = useReducer(uiReducer, initialState);

  // Action creators
  const setActiveTab = useCallback((tab) => {
    dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
  }, []);

  const setLoading = useCallback((component, isLoading) => {
    dispatch({ type: 'SET_LOADING', payload: { [component]: isLoading } });
  }, []);

  const setModal = useCallback((modalName, isOpen) => {
    dispatch({ type: 'SET_MODALS', payload: { [modalName]: isOpen } });
  }, []);

  const openModal = useCallback((modalName) => {
    setModal(modalName, true);
  }, [setModal]);

  const closeModal = useCallback((modalName) => {
    setModal(modalName, false);
  }, [setModal]);

  const addNotification = useCallback((message, type = 'info') => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    const newNotifications = [...state.notifications, notification];
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      dispatch({ 
        type: 'SET_NOTIFICATIONS', 
        payload: state.notifications.filter(n => n.id !== notification.id)
      });
    }, 5000);

    dispatch({ type: 'SET_NOTIFICATIONS', payload: newNotifications });
  }, [state.notifications]);

  const clearNotifications = useCallback(() => {
    dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
  }, []);

  const setSettingsOverride = useCallback((key, value) => {
    dispatch({ 
      type: 'SET_SETTINGS_OVERRIDES', 
      payload: { [key]: value } 
    });
  }, []);

  // Convenience predicates
  const isLoading = useCallback((component) => state.loading[component] || false, [state.loading]);
  const isModalOpen = useCallback((modalName) => state.modals[modalName] || false, [state.modals]);

  const value = {
    ...state,
    // Actions
    setActiveTab,
    setLoading,
    setModal,
    openModal,
    closeModal,
    addNotification,
    clearNotifications,
    setSettingsOverride,
    // Predicates
    isLoading,
    isModalOpen
  };

  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  );
};

export const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUIContext must be used within UIProvider');
  }
  return context;
};
