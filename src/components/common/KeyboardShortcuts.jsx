/**
 * Keyboard Shortcuts Help Modal
 * 
 * @module components/common/KeyboardShortcuts
 * @description Modal showing all available keyboard shortcuts
 */

import React, { useEffect } from 'react';

const KeyboardShortcuts = ({ isOpen, onClose }) => {
  // Close on escape
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['1'], description: 'Positions tab' },
        { keys: ['2'], description: 'Distributions tab' },
        { keys: ['3'], description: 'Correlation tab' },
        { keys: ['4'], description: 'Simulation tab' },
        { keys: ['5'], description: 'Factors tab' },
        { keys: ['6'], description: 'Optimize tab' },
        { keys: ['7'], description: 'Export tab' },
      ],
    },
    {
      category: 'Tab Actions (Enter key)',
      items: [
        { keys: ['Enter'], description: 'Run primary action for current tab', highlight: true },
        { keys: ['1', '→', 'Enter'], description: 'Positions: Load Betas' },
        { keys: ['2', '→', 'Enter'], description: 'Distributions: Estimate from History' },
        { keys: ['3', '→', 'Enter'], description: 'Correlation: Estimate from History' },
        { keys: ['4', '→', 'Enter'], description: 'Simulation: Run Monte Carlo' },
        { keys: ['5', '→', 'Enter'], description: 'Factors: Run Factor Analysis' },
        { keys: ['6', '→', 'Enter'], description: 'Optimize: Run Optimization' },
      ],
    },
    {
      category: 'Global Actions',
      items: [
        { keys: ['⌘', 'K'], description: 'Open command palette', highlight: true },
        { keys: ['⌘', 'L'], description: 'Load all market data' },
        { keys: ['⌘', 'R'], description: 'Run simulation (any tab)' },
        { keys: ['⌘', 'S'], description: 'Export portfolio to JSON' },
        { keys: ['⌘', 'Z'], description: 'Undo last change' },
        { keys: ['⌘', '⇧', 'Z'], description: 'Redo last change' },
      ],
    },
    {
      category: 'General',
      items: [
        { keys: ['?'], description: 'Show this help' },
        { keys: ['Esc'], description: 'Close dialogs' },
      ],
    },
  ];
  
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>⌨️</div>
          <h2 style={styles.title}>Keyboard Shortcuts</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        {/* Content */}
        <div style={styles.content}>
          {shortcuts.map((section, sectionIdx) => (
            <div key={section.category} style={styles.section}>
              <h3 style={styles.sectionTitle}>{section.category}</h3>
              <div style={styles.shortcutList}>
                {section.items.map((shortcut, idx) => (
                  <div key={idx} style={{
                    ...styles.shortcutRow,
                    ...(shortcut.highlight ? {
                      background: 'rgba(0, 212, 255, 0.1)',
                      border: '1px solid rgba(0, 212, 255, 0.2)',
                    } : {}),
                  }}>
                    <div style={styles.keys}>
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={keyIdx}>
                          {key === '→' ? (
                            <span style={styles.keyArrow}>→</span>
                          ) : (
                            <kbd style={{
                              ...styles.key,
                              ...(shortcut.highlight && key === 'Enter' ? {
                                background: 'linear-gradient(180deg, rgba(0, 180, 220, 0.6) 0%, rgba(0, 140, 180, 0.6) 100%)',
                                borderColor: 'rgba(0, 212, 255, 0.4)',
                              } : {}),
                            }}>{key}</kbd>
                          )}
                          {keyIdx < shortcut.keys.length - 1 && key !== '→' && shortcut.keys[keyIdx + 1] !== '→' && (
                            <span style={styles.keyPlus}>+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div style={{
                      ...styles.description,
                      ...(shortcut.highlight ? { color: '#00d4ff', fontWeight: 500 } : {}),
                    }}>{shortcut.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerNote}>
            💡 Use <kbd style={styles.keySmall}>⌘</kbd> on Mac or <kbd style={styles.keySmall}>Ctrl</kbd> on Windows/Linux
          </span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10001,
    padding: '20px',
  },
  
  modal: {
    background: 'linear-gradient(180deg, rgba(30, 30, 50, 0.98) 0%, rgba(20, 20, 35, 0.98) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 212, 255, 0.1)',
    maxWidth: '480px',
    width: '100%',
    maxHeight: '80vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  
  headerIcon: {
    fontSize: '24px',
  },
  
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
    flex: 1,
  },
  
  closeButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '8px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: '20px',
    transition: 'all 0.15s ease',
  },
  
  content: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  
  section: {
    marginBottom: '24px',
  },
  
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#00d4ff',
  },
  
  shortcutList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  
  shortcutRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  
  keys: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  
  key: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '28px',
    height: '28px',
    padding: '0 8px',
    background: 'linear-gradient(180deg, rgba(60, 60, 80, 0.8) 0%, rgba(40, 40, 60, 0.8) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
    color: '#fff',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  },
  
  keyPlus: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '12px',
    margin: '0 2px',
  },
  
  keyArrow: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: '14px',
    margin: '0 4px',
  },
  
  description: {
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.2)',
  },
  
  footerNote: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  
  keySmall: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '20px',
    height: '20px',
    padding: '0 6px',
    background: 'rgba(60, 60, 80, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: 600,
    color: '#fff',
  },
};

export default KeyboardShortcuts;
