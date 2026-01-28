/**
 * App Styles
 * 
 * @module styles/appStyles
 * @description Centralized styles for the Monte Carlo Simulator.
 * Extracted to reduce main App.jsx file size.
 */

export const styles = {
  // Root app container - horizontal flex for sidebar layout
  appRoot: {
    display: 'flex',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
    color: '#e0e0e0',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  },
  // Legacy container (for backwards compatibility)
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
    color: '#e0e0e0',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    padding: '0',
  },
  stickyHeader: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'linear-gradient(180deg, rgba(10, 10, 20, 0.98) 0%, rgba(16, 16, 28, 0.95) 100%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    padding: '12px 24px',
    borderBottom: '1px solid rgba(42, 42, 74, 0.6)',
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), 0 1px 0 rgba(255, 255, 255, 0.02) inset',
  },
  // Main content area - takes remaining width next to sidebar
  mainContent: {
    flex: 1,
    minWidth: 0, // Allow flex item to shrink below content size
    padding: '24px',
    background: 'linear-gradient(180deg, rgba(20, 20, 32, 0.5) 0%, transparent 300px)',
    overflowY: 'auto',
    height: '100vh',
  },
  scrollContainer: {
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    scrollbarColor: '#3a3a5a #1a1a2e',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    width: '100%',
    minWidth: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: '0 1 auto',
    minWidth: 0,
    overflow: 'hidden',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: '0 0 auto',
    flexShrink: 0,
  },
  title: {
    fontSize: '17px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 50%, #00d4ff 100%)',
    backgroundSize: '200% 200%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    letterSpacing: '-0.5px',
    whiteSpace: 'nowrap',
    textShadow: '0 0 30px rgba(0, 212, 255, 0.3)',
    flexShrink: 0,
  },
  portfolioValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.1) 0%, rgba(123, 47, 247, 0.08) 100%)',
    borderRadius: '8px',
    border: '1px solid rgba(0, 212, 255, 0.25)',
    boxShadow: '0 2px 8px rgba(0, 212, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  valueLabel: {
    fontSize: '10px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  valueAmount: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#00d4ff',
  },
  tabs: {
    display: 'flex',
    gap: '3px',
    background: 'linear-gradient(135deg, rgba(15, 15, 25, 0.9) 0%, rgba(20, 20, 35, 0.9) 100%)',
    padding: '5px',
    borderRadius: '12px',
    border: '1px solid rgba(42, 42, 74, 0.6)',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.02)',
    flex: '1 1 auto',
    minWidth: 0,
    overflowX: 'auto',
    overflowY: 'hidden',
    justifyContent: 'center',
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE/Edge
  },
  tab: {
    padding: '8px 10px',
    border: 'none',
    background: 'transparent',
    color: '#666',
    cursor: 'pointer',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: '500',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    position: 'relative',
    outline: 'none',
    boxShadow: 'none',
    flexShrink: 0,
  },
  activeTab: {
    background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(123, 47, 247, 0.15) 100%)',
    color: '#fff',
    boxShadow: '0 4px 16px rgba(0,212,255,0.3), inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 3px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(0, 212, 255, 0.4)',
    transform: 'translateY(-1px)',
  },
  card: {
    background: 'linear-gradient(180deg, rgba(25, 25, 45, 0.9) 0%, rgba(15, 15, 30, 0.9) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    padding: '24px',
    marginBottom: '20px',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    letterSpacing: '-0.01em',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    textAlign: 'left',
    padding: '12px 8px',
    borderBottom: '1px solid #2a2a4a',
    color: '#888',
    fontWeight: '500',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  td: {
    padding: '12px 8px',
    borderBottom: '1px solid #1a1a2a',
  },
  input: {
    background: 'linear-gradient(180deg, rgba(10, 10, 21, 0.9) 0%, rgba(15, 15, 30, 0.9) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#fff',
    fontSize: '13px',
    width: '100%',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
    MozAppearance: 'textfield',
    WebkitAppearance: 'none',
  },
  inputSmall: {
    width: '80px',
  },
  button: {
    background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    color: '#fff',
    fontWeight: '600',
    cursor: 'pointer',
    fontSize: '13px',
    fontFamily: 'inherit',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 4px 12px rgba(0, 212, 255, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    letterSpacing: '0.01em',
  },
  buttonSecondary: {
    background: 'linear-gradient(180deg, rgba(50, 50, 80, 0.8) 0%, rgba(35, 35, 60, 0.8) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  buttonDanger: {
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    color: '#e74c3c',
    cursor: 'pointer',
    padding: '6px 10px',
    fontSize: '14px',
    borderRadius: '6px',
    transition: 'all 0.2s ease',
  },
  slider: {
    width: '100%',
    height: '4px',
    borderRadius: '2px',
    background: '#2a2a4a',
    appearance: 'none',
    cursor: 'pointer',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  badgeETF: { background: '#1e3a5f', color: '#5dade2' },
  badgeEquity: { background: '#1e5f3a', color: '#5de2ad' },
  badgeOption: { background: '#5f1e3a', color: '#e25dad' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
  },
  stat: {
    textAlign: 'center',
    padding: '16px',
  },
  statValue: {
    fontSize: '28px',
    fontWeight: '700',
  },
  statLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    marginTop: '4px',
  },
  positive: { color: '#2ecc71' },
  negative: { color: '#e74c3c' },
  matrixCell: {
    padding: '4px',
    textAlign: 'center',
    fontSize: '11px',
  },
  matrixInput: {
    width: '60px',
    padding: '4px',
    fontSize: '11px',
    textAlign: 'center',
    background: '#0a0a15',
    border: '1px solid #2a2a4a',
    borderRadius: '3px',
    color: '#fff',
    fontFamily: 'inherit',
  },
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  toggleSwitch: {
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    background: '#2a2a4a',
    position: 'relative',
    transition: 'background 0.2s',
  },
  toggleSwitchActive: {
    background: '#00d4ff',
  },
  toggleKnob: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    background: '#fff',
    position: 'absolute',
    top: '2px',
    left: '2px',
    transition: 'left 0.2s',
  },
  toggleKnobActive: {
    left: '18px',
  },
  chartContainer: {
    height: '300px',
    marginTop: '16px',
  },
  flexRow: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  select: {
    background: '#0a0a15',
    border: '1px solid #2a2a4a',
    borderRadius: '4px',
    padding: '8px 12px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'inherit',
    cursor: 'pointer',
  },
  infoBox: {
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '16px',
    fontSize: '12px',
    color: '#8fd4e8',
  },

  // Chart interaction styles
  chartContainer: {
    position: 'relative',
  },
  chartControls: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    zIndex: 10,
  },
  chartHighlight: {
    transition: 'all 0.2s ease',
  },
  chartComparisonOverlay: {
    opacity: 0.4,
  },
};

// CSS animation keyframes (inject into document)
if (typeof document !== 'undefined') {
  const styleId = 'monte-carlo-animations';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(0.95); }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      @keyframes chartBarGrow {
        from { transform: scaleY(0); opacity: 0; }
        to { transform: scaleY(1); opacity: 1; }
      }

      @keyframes highlightPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.4); }
        50% { box-shadow: 0 0 0 4px rgba(0, 212, 255, 0.1); }
      }

      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateY(4px); }
        15% { opacity: 1; transform: translateY(0); }
        85% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-4px); }
      }

      @keyframes valueFlash {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }

      .chart-bar-animate {
        animation: chartBarGrow 0.4s ease-out forwards;
        transform-origin: bottom;
      }

      .highlight-pulse {
        animation: highlightPulse 1.5s ease-in-out infinite;
      }
    `;
    document.head.appendChild(style);
  }
}

export default styles;
