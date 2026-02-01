/**
 * User Guide Modal
 * 
 * @module components/common/UserGuide
 * @description Modal showing app workflow and feature guide
 */

import React, { useEffect, useState } from 'react';

const UserGuide = ({ isOpen, onClose, isFirstTime = false }) => {
  const [activeSection, setActiveSection] = useState('overview');
  
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
  
  const sections = [
    { id: 'overview', label: 'Overview', icon: '🎯' },
    { id: 'workflow', label: 'Workflow', icon: '📋' },
    { id: 'positions', label: 'Positions', icon: '📊' },
    { id: 'distributions', label: 'Distributions', icon: '📈' },
    { id: 'correlation', label: 'Correlation', icon: '🔗' },
    { id: 'simulation', label: 'Simulation', icon: '🎲' },
    { id: 'factors', label: 'Factors', icon: '🧬' },
    { id: 'consensus', label: 'Consensus', icon: '📢' },
    { id: 'optimize', label: 'Optimize', icon: '⚡' },
    { id: 'export', label: 'Export', icon: '📄' },
    { id: 'tips', label: 'Tips', icon: '💡' },
  ];
  
  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div style={styles.sectionContent}>
            {isFirstTime && (
              <div style={styles.welcomeBox}>
                <h2 style={styles.welcomeTitle}>Welcome to FactorSim!</h2>
                <p style={styles.welcomeText}>
                  This is your first time here. Let us show you around so you can get the most
                  out of your portfolio analysis.
                </p>
              </div>
            )}

            <h3 style={styles.sectionTitle}>What is Monte Carlo Simulation?</h3>
            <p style={styles.paragraph}>
              Monte Carlo simulation uses random sampling to model the probability of different outcomes
              in a process that cannot easily be predicted. For portfolios, it simulates thousands of
              possible market scenarios to estimate the range of potential returns.
            </p>

            <h3 style={styles.sectionTitle}>What This App Does</h3>
            <p style={styles.paragraph}>
              This application takes your portfolio holdings and runs sophisticated Monte Carlo simulations
              to help you understand:
            </p>
            <ul style={styles.list}>
              <li>Expected returns across different market scenarios</li>
              <li>Probability of losses and potential drawdowns</li>
              <li>How your positions interact through correlations</li>
              <li>Which positions contribute most to risk and return</li>
              <li>Factor exposures (market, size, value, momentum)</li>
              <li>Optimization opportunities to improve risk-adjusted returns</li>
            </ul>

            <div style={styles.highlightBox}>
              <div style={styles.highlightIcon}>💡</div>
              <div>
                <strong>Key Insight:</strong> The simulation uses historical data to estimate how your
                positions move together (correlation) and their individual volatility profiles, then
                projects thousands of possible future scenarios.
              </div>
            </div>

            {isFirstTime && (
              <div style={styles.getStartedBox}>
                <button
                  onClick={() => setActiveSection('workflow')}
                  style={styles.getStartedButton}
                >
                  See the Recommended Workflow
                </button>
                <button
                  onClick={onClose}
                  style={styles.skipButton}
                >
                  I'll explore on my own
                </button>
              </div>
            )}
          </div>
        );
        
      case 'workflow':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Recommended Workflow</h3>
            <p style={styles.paragraph}>
              Follow these steps for a complete portfolio analysis:
            </p>
            
            <div style={styles.workflowSteps}>
              {[
                { step: 1, title: 'Enter Positions', desc: 'Add your holdings with ticker, quantity, and price. Negative quantities = short positions.', tab: 'Positions' },
                { step: 2, title: 'Load Market Data', desc: 'Click "Load All" to fetch historical data, beta, and YTD/1Y returns for each position.', tab: 'Positions' },
                { step: 3, title: 'Estimate Distributions', desc: 'Generate expected return (P5-P95) for each position from historical data or your own views.', tab: 'Distributions' },
                { step: 4, title: 'Build Correlation Matrix', desc: 'Estimate how your positions move together. Use Ledoit-Wolf shrinkage for stability.', tab: 'Correlation' },
                { step: 5, title: 'Run Simulation', desc: 'Execute Monte Carlo with 10,000-50,000 paths to see return distributions and risk metrics.', tab: 'Simulation' },
                { step: 6, title: 'Analyze Factors', desc: 'Understand your exposure to market factors and thematic concentrations.', tab: 'Factors' },
                { step: 7, title: 'Check Consensus (Optional)', desc: 'Compare your assumptions to Wall Street analyst estimates.', tab: 'Consensus' },
                { step: 8, title: 'Optimize (Optional)', desc: 'Find position swaps that could improve your Sharpe ratio.', tab: 'Optimize' },
                { step: 9, title: 'Export Report', desc: 'Generate a comprehensive PDF report of your analysis.', tab: 'Export' },
              ].map(item => (
                <div key={item.step} style={styles.workflowStep}>
                  <div style={styles.stepNumber}>{item.step}</div>
                  <div style={styles.stepContent}>
                    <div style={styles.stepTitle}>{item.title}</div>
                    <div style={styles.stepDesc}>{item.desc}</div>
                    <div style={styles.stepTab}>Tab: {item.tab}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={styles.highlightBox}>
              <div style={styles.highlightIcon}>⚡</div>
              <div>
                <strong>Quick Start:</strong> Press <kbd style={styles.kbd}>⌘</kbd> + <kbd style={styles.kbd}>L</kbd> to 
                load all market data at once (betas, distributions, correlations).
              </div>
            </div>
          </div>
        );
        
      case 'positions':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Positions Tab</h3>
            <p style={styles.paragraph}>
              Enter and manage your portfolio holdings. This is your starting point.
            </p>
            
            <h4 style={styles.subTitle}>Adding Positions</h4>
            <ul style={styles.list}>
              <li><strong>Ticker:</strong> Stock symbol (e.g., AAPL, MSFT, SPY)</li>
              <li><strong>Quantity:</strong> Number of shares (negative for short positions)</li>
              <li><strong>Price:</strong> Current price per share</li>
            </ul>
            
            <h4 style={styles.subTitle}>Loading Market Data</h4>
            <p style={styles.paragraph}>
              Click "Load Betas" to fetch from Yahoo Finance:
            </p>
            <ul style={styles.list}>
              <li><strong>Beta (β):</strong> Sensitivity to market movements (1.0 = moves with market)</li>
              <li><strong>Volatility (σ):</strong> Annualized standard deviation of returns</li>
              <li><strong>YTD/1Y Returns:</strong> Historical performance metrics</li>
            </ul>
            
            <h4 style={styles.subTitle}>Portfolio Metrics</h4>
            <ul style={styles.list}>
              <li><strong>Gross Exposure:</strong> Total |long| + |short| value</li>
              <li><strong>Net Exposure:</strong> Long - Short value</li>
              <li><strong>Portfolio Beta:</strong> Weighted average beta</li>
            </ul>
          </div>
        );
        
      case 'distributions':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Distributions Tab</h3>
            <p style={styles.paragraph}>
              Configure the expected return distribution for each position.
            </p>
            
            <h4 style={styles.subTitle}>Key Parameters</h4>
            <ul style={styles.list}>
              <li><strong>μ (mu):</strong> Expected annual return (e.g., 0.15 = 15%)</li>
              <li><strong>σ (sigma):</strong> Annual volatility (e.g., 0.30 = 30%)</li>
              <li><strong>Skew:</strong> Distribution asymmetry (negative = more downside risk)</li>
            </ul>
            
            <h4 style={styles.subTitle}>Estimation Methods</h4>
            <ul style={styles.list}>
              <li><strong>Historical:</strong> Uses past returns to estimate parameters</li>
              <li><strong>Manual:</strong> Enter your own estimates for each position</li>
            </ul>
            
            <div style={styles.highlightBox}>
              <div style={styles.highlightIcon}>📊</div>
              <div>
                <strong>Note:</strong> Historical estimates assume past patterns continue. 
                Consider adjusting μ based on your forward-looking views.
              </div>
            </div>
          </div>
        );
        
      case 'correlation':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Correlation Tab</h3>
            <p style={styles.paragraph}>
              Define how positions move together. Critical for accurate risk assessment.
            </p>
            
            <h4 style={styles.subTitle}>Correlation Values</h4>
            <ul style={styles.list}>
              <li><strong>+1.0:</strong> Perfect positive correlation (move together)</li>
              <li><strong>0.0:</strong> No correlation (independent)</li>
              <li><strong>-1.0:</strong> Perfect negative correlation (move opposite)</li>
            </ul>
            
            <h4 style={styles.subTitle}>Estimation Methods</h4>
            <ul style={styles.list}>
              <li><strong>Ledoit-Wolf:</strong> Recommended. Shrinks extreme correlations for stability.</li>
              <li><strong>EWMA:</strong> Exponentially weighted. More responsive to recent data.</li>
              <li><strong>Sample:</strong> Raw historical correlation. Can be unstable.</li>
            </ul>
            
            <h4 style={styles.subTitle}>Why Correlation Matters</h4>
            <p style={styles.paragraph}>
              Two 30% volatility positions with 0.3 correlation have much less combined risk 
              than two 30% volatility positions with 0.9 correlation. Diversification benefits 
              come from low correlations.
            </p>
          </div>
        );
        
      case 'simulation':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Simulation Tab</h3>
            <p style={styles.paragraph}>
              Run Monte Carlo simulation to see the range of possible outcomes.
            </p>
            
            <h4 style={styles.subTitle}>Configuration</h4>
            <ul style={styles.list}>
              <li><strong>Paths:</strong> Number of simulations (10,000-50,000 recommended)</li>
              <li><strong>Horizon:</strong> Time period (1 Year typical)</li>
              <li><strong>Distribution:</strong> Normal or Student-t (fat tails for crash scenarios)</li>
            </ul>
            
            <h4 style={styles.subTitle}>Key Outputs</h4>
            <ul style={styles.list}>
              <li><strong>P5 (Bad Case):</strong> 5th percentile - worst 5% of outcomes</li>
              <li><strong>P50 (Median):</strong> Middle outcome</li>
              <li><strong>P95 (Good Case):</strong> 95th percentile - best 5% of outcomes</li>
              <li><strong>P(Loss):</strong> Probability of any loss</li>
              <li><strong>VaR 5%:</strong> Value at Risk - max loss at 95% confidence</li>
              <li><strong>CVaR 5%:</strong> Expected Shortfall - average of worst 5% outcomes</li>
            </ul>
            
            <h4 style={styles.subTitle}>Contribution Analysis</h4>
            <p style={styles.paragraph}>
              Shows how each position contributes to portfolio return, helping identify 
              which holdings drive performance in different scenarios.
            </p>
          </div>
        );
        
      case 'factors':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Factors Tab</h3>
            <p style={styles.paragraph}>
              Analyze your portfolio's exposure to systematic risk factors.
            </p>
            
            <h4 style={styles.subTitle}>Fama-French Factors</h4>
            <ul style={styles.list}>
              <li><strong>Market (β):</strong> Overall market sensitivity</li>
              <li><strong>Size:</strong> Small cap vs large cap tilt</li>
              <li><strong>Value:</strong> Value vs growth tilt</li>
              <li><strong>Momentum:</strong> Winners vs losers tilt</li>
            </ul>
            
            <h4 style={styles.subTitle}>Risk Decomposition</h4>
            <p style={styles.paragraph}>
              Shows what percentage of your risk comes from:
            </p>
            <ul style={styles.list}>
              <li><strong>Factor (Systematic):</strong> Broad market/style exposure</li>
              <li><strong>Idiosyncratic:</strong> Stock-specific risk</li>
            </ul>
            
            <h4 style={styles.subTitle}>Thematic Concentrations</h4>
            <p style={styles.paragraph}>
              Detects exposure to themes like semiconductors, emerging markets, software, etc.
              Shows potential portfolio impact if these themes decline.
            </p>
          </div>
        );

      case 'consensus':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Consensus Tab</h3>
            <p style={styles.paragraph}>
              View Wall Street analyst estimates and compare your assumptions to market consensus.
            </p>

            <h4 style={styles.subTitle}>Analyst Estimates</h4>
            <ul style={styles.list}>
              <li><strong>EPS Estimates:</strong> Expected earnings per share for coming quarters/years</li>
              <li><strong>Revenue Estimates:</strong> Projected sales figures</li>
              <li><strong>Price Targets:</strong> Analyst price target high/low/average</li>
              <li><strong>Recommendation:</strong> Buy/Hold/Sell consensus rating</li>
            </ul>

            <h4 style={styles.subTitle}>Why This Matters</h4>
            <p style={styles.paragraph}>
              Comparing your distribution assumptions (P5-P95) against analyst estimates helps you
              understand if your views differ from consensus. If you expect -20% while analysts
              expect +30%, either you have unique insight or should revisit your assumptions.
            </p>

            <div style={styles.highlightBox}>
              <div style={styles.highlightIcon}>📢</div>
              <div>
                <strong>Note:</strong> Consensus data requires an FMP API key. Sign up at
                financialmodelingprep.com for free to enable this feature.
              </div>
            </div>
          </div>
        );

      case 'optimize':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Optimize Tab</h3>
            <p style={styles.paragraph}>
              Find trades that could improve your portfolio's risk-adjusted returns.
            </p>
            
            <h4 style={styles.subTitle}>Optimization Approach</h4>
            <p style={styles.paragraph}>
              The optimizer evaluates position swaps (sell X, buy Y) and ranks them by 
              improvement to Monte Carlo Sharpe ratio.
            </p>
            
            <h4 style={styles.subTitle}>Swap Recommendations</h4>
            <ul style={styles.list}>
              <li><strong>ΔSharpe:</strong> Expected improvement in Sharpe ratio</li>
              <li><strong>From → To:</strong> Suggested position swap</li>
              <li>Higher ΔSharpe = more impactful trade</li>
            </ul>
            
            <h4 style={styles.subTitle}>Risk Contribution</h4>
            <p style={styles.paragraph}>
              Visual breakdown of how each position contributes to total portfolio risk.
              Large contributors may be candidates for reduction.
            </p>
            
            <div style={styles.highlightBox}>
              <div style={styles.highlightIcon}>⚠️</div>
              <div>
                <strong>Disclaimer:</strong> Optimization is based on historical data and model assumptions. 
                Always apply your own judgment before trading.
              </div>
            </div>
          </div>
        );
        
      case 'export':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Export Tab</h3>
            <p style={styles.paragraph}>
              Generate reports and export your analysis.
            </p>
            
            <h4 style={styles.subTitle}>PDF Report</h4>
            <p style={styles.paragraph}>
              Comprehensive multi-page report including:
            </p>
            <ul style={styles.list}>
              <li>Portfolio summary and holdings</li>
              <li>Exposure analysis (long/short breakdown)</li>
              <li>Simulation results and distributions</li>
              <li>Key takeaways and risk metrics</li>
              <li>Contribution analysis</li>
              <li>Correlation heatmap</li>
              <li>Volatility analysis</li>
              <li>Factor exposures</li>
              <li>Optimization recommendations</li>
            </ul>
            
            <h4 style={styles.subTitle}>Other Exports</h4>
            <ul style={styles.list}>
              <li><strong>JSON:</strong> Full portfolio data for backup/sharing</li>
              <li><strong>CSV:</strong> Position data for spreadsheets</li>
            </ul>
          </div>
        );
        
      case 'tips':
        return (
          <div style={styles.sectionContent}>
            <h3 style={styles.sectionTitle}>Tips & Best Practices</h3>
            
            <div style={styles.tipBox}>
              <div style={styles.tipIcon}>🎯</div>
              <div>
                <strong>Use Student-t Distribution</strong>
                <p style={styles.tipText}>
                  Enable "fat tails" for more realistic crash scenarios. Markets have more 
                  extreme moves than normal distributions suggest.
                </p>
              </div>
            </div>
            
            <div style={styles.tipBox}>
              <div style={styles.tipIcon}>📊</div>
              <div>
                <strong>Ledoit-Wolf for Correlations</strong>
                <p style={styles.tipText}>
                  This method produces more stable correlation estimates, especially for 
                  portfolios with many positions or limited historical data.
                </p>
              </div>
            </div>
            
            <div style={styles.tipBox}>
              <div style={styles.tipIcon}>⚡</div>
              <div>
                <strong>50,000 Paths for Accuracy</strong>
                <p style={styles.tipText}>
                  More simulation paths give more stable estimates, especially for tail 
                  metrics like P5 and VaR. 50K is a good balance of accuracy and speed.
                </p>
              </div>
            </div>
            
            <div style={styles.tipBox}>
              <div style={styles.tipIcon}>🔄</div>
              <div>
                <strong>Adjust μ for Forward Views</strong>
                <p style={styles.tipText}>
                  Historical returns don't predict the future. Adjust expected returns 
                  based on your own research and market outlook.
                </p>
              </div>
            </div>
            
            <div style={styles.tipBox}>
              <div style={styles.tipIcon}>⚖️</div>
              <div>
                <strong>Watch Concentration Risk</strong>
                <p style={styles.tipText}>
                  The Factors tab shows thematic concentrations. High exposure to a single 
                  theme (e.g., 60%+ semiconductors) creates significant event risk.
                </p>
              </div>
            </div>
            
            <div style={styles.tipBox}>
              <div style={styles.tipIcon}>💾</div>
              <div>
                <strong>Save Your Work</strong>
                <p style={styles.tipText}>
                  Use Export → JSON to save your portfolio configuration. You can reload 
                  it later without re-entering all positions.
                </p>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>📖</div>
          <h2 style={styles.title}>User Guide</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        {/* Navigation */}
        <div style={styles.nav}>
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{
                ...styles.navButton,
                ...(activeSection === section.id ? styles.navButtonActive : {}),
              }}
            >
              <span style={styles.navIcon}>{section.icon}</span>
              <span style={styles.navLabel}>{section.label}</span>
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div style={styles.content}>
          {renderContent()}
        </div>
        
        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerText}>
            Press <kbd style={styles.kbd}>?</kbd> for keyboard shortcuts
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
    background: 'rgba(0, 0, 0, 0.75)',
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
    maxWidth: '700px',
    width: '100%',
    maxHeight: '85vh',
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
    flexShrink: 0,
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
  
  nav: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
    background: 'rgba(0, 0, 0, 0.2)',
    flexShrink: 0,
  },
  
  navButton: {
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 0.15s ease',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
  },
  
  navButtonActive: {
    background: 'rgba(0, 212, 255, 0.15)',
    borderColor: 'rgba(0, 212, 255, 0.3)',
    color: '#00d4ff',
  },
  
  navIcon: {
    fontSize: '12px',
  },
  
  navLabel: {
    fontWeight: 500,
  },
  
  content: {
    padding: '20px 24px',
    overflowY: 'auto',
    flex: 1,
  },
  
  sectionContent: {
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 1.6,
  },
  
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: 600,
    color: '#fff',
  },
  
  subTitle: {
    margin: '20px 0 8px 0',
    fontSize: '13px',
    fontWeight: 600,
    color: '#00d4ff',
  },
  
  paragraph: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  
  list: {
    margin: '0 0 16px 0',
    paddingLeft: '20px',
    fontSize: '13px',
    color: 'rgba(255, 255, 255, 0.75)',
  },
  
  highlightBox: {
    display: 'flex',
    gap: '12px',
    padding: '14px',
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.2)',
    borderRadius: '8px',
    marginTop: '16px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.85)',
  },
  
  highlightIcon: {
    fontSize: '18px',
    flexShrink: 0,
  },
  
  workflowSteps: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px',
  },
  
  workflowStep: {
    display: 'flex',
    gap: '12px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  
  stepNumber: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  
  stepContent: {
    flex: 1,
  },
  
  stepTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '4px',
  },
  
  stepDesc: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.65)',
    marginBottom: '4px',
  },
  
  stepTab: {
    fontSize: '10px',
    color: '#00d4ff',
    fontWeight: 500,
  },
  
  tipBox: {
    display: 'flex',
    gap: '12px',
    padding: '14px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    marginBottom: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  
  tipIcon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  
  tipText: {
    margin: '6px 0 0 0',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.65)',
  },
  
  footer: {
    padding: '12px 24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    background: 'rgba(0, 0, 0, 0.2)',
    textAlign: 'center',
    flexShrink: 0,
  },
  
  footerText: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  
  kbd: {
    background: 'rgba(255, 255, 255, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '10px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    fontFamily: 'monospace',
  },

  // First-time user welcome styles
  welcomeBox: {
    background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    textAlign: 'center',
  },

  welcomeTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },

  welcomeText: {
    margin: 0,
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1.5,
  },

  getStartedBox: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },

  getStartedButton: {
    background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },

  skipButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 500,
    color: 'rgba(255, 255, 255, 0.7)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

export default UserGuide;
