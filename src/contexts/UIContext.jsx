import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

/**
 * @typedef {Object} UIState
 * @property {string} activeTab - Currently active tab identifier
 * @property {boolean} sidebarExpanded - Whether sidebar is expanded
 * @property {number} windowWidth - Current window width
 * @property {Object} modalStates - States of various modals
 * @property {Object} loadingStates - Loading states for different operations
 * @property {Object} viewModes - View mode settings for different components
 * @property {boolean} autosave - Whether autosave is enabled
 */

/**
 * @typedef {Object} UIContextValue
 * @property {UIState} state - UI state
 * @property {Function} setActiveTab - Set active tab
 * @property {Function} toggleSidebar - Toggle sidebar expansion
 * @property {Function} setWindowWidth - Set window width
 * @property {Function} openModal - Open a modal
 * @property {Function} closeModal - Close a modal
 * @property {Function} setLoading - Set loading state
 * @property {Function} setViewMode - Set view mode for a component
 * @property {Function} toggleAutosave - Toggle autosave
 */

const UIContext = createContext(null);

/**
 * UIContext Provider component
 * Manages global UI state including tabs, sidebar, modals, loading states, and view modes
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children
 */
export function UIProvider({ children }) {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [modalStates, setModalStates] = useState({});
  const [loadingStates, setLoadingStates] = useState({});
  const [viewModes, setViewModes] = useState({});
  const [autosave, setAutosave] = useState(true);

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded(prev => !prev);
  }, []);

  const openModal = useCallback((modalName) => {
    setModalStates(prev => ({ ...prev, [modalName]: true }));
  }, []);

  const closeModal = useCallback((modalName) => {
    setModalStates(prev => ({ ...prev, [modalName]: false }));
  }, []);

  const setLoading = useCallback((key, value) => {
    setLoadingStates(prev => ({ ...prev, [key]: value }));
  }, []);

  const setViewMode = useCallback((component, mode) => {
    setViewModes(prev => ({ ...prev, [component]: mode }));
  }, []);

  const toggleAutosave = useCallback(() => {
    setAutosave(prev => !prev);
  }, []);

  const value = useMemo(() => ({
    state: {
      activeTab,
      sidebarExpanded,
      windowWidth,
      modalStates,
      loadingStates,
      viewModes,
      autosave,
    },
    setActiveTab,
    toggleSidebar,
    setWindowWidth,
    openModal,
    closeModal,
    setLoading,
    setViewMode,
    toggleAutosave,
  }), [
    activeTab,
    sidebarExpanded,
    windowWidth,
    modalStates,
    loadingStates,
    viewModes,
    autosave,
    toggleSidebar,
    openModal,
    closeModal,
    setLoading,
    setViewMode,
    toggleAutosave,
  ]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

/**
 * Hook to access UI context
 * @returns {UIContextValue}
 * @throws {Error} If used outside UIProvider
 */
export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
