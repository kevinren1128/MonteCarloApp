import React, { useMemo, memo, useCallback, useState } from 'react';
import { InteractiveHistogram } from '../charts';
import { StaleBanner } from '../common';

// Monospace font stack - matches appStyles.js container font
const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

/**
 * SimulationTab - Monte Carlo Simulation Tab Component
 * 
 * Optimized for rendering performance with:
 * - Memoized histogram computations
 * - Efficient contribution chart with hover table
 * - No unnecessary re-renders
 */
const SimulationTab = memo(({
  // Simulation parameters
  numPaths,
  setNumPaths,
  drawdownThreshold,
  setDrawdownThreshold,
  fatTailMethod,
  setFatTailMethod,
  useQmc,
  setUseQmc,

  // Correlation data
  editedCorrelation,
  correlationMethod,
  useEwma,

  // Simulation state
  simulationResults,
  previousSimulationResults,
  isSimulating,
  
  // Portfolio data
  positions,
  
  // Methodology explainer
  showMethodologyExplainer,
  setShowMethodologyExplainer,
  
  // Contribution chart
  contributionChartMemo,
  
  // Callbacks
  runSimulation,

  // Staleness tracking
  stalenessStatus,
  stalenessReason,
  canRun,
  onNavigateTab,

  // Common components passed as props
  BlurInput,
  InfoTooltip,

  // Styles
  styles,
}) => {
  // Local state for contribution hover
  const [hoveredScenario, setHoveredScenario] = useState('p50');
  
  // Helper: Format currency
  const formatCurrency = useCallback((value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }, []);

  // Helper to generate histogram data
  const generateHistogram = useCallback((dist, bins = 30) => {
    if (!dist || dist.length === 0) return [];
    const min = Math.min(...dist);
    const max = Math.max(...dist);
    const binWidth = (max - min) / bins;

    const histogram = Array(bins).fill(0);
    dist.forEach(v => {
      const binIndex = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    });

    return histogram.map((count, i) => ({
      value: min + (i + 0.5) * binWidth,
      pct: (count / dist.length) * 100,
      label: `${((min + (i + 0.5) * binWidth) * 100).toFixed(0)}%`,
    }));
  }, []);

  // Prepare histogram data for terminal returns
  const terminalHistogramData = useMemo(() => {
    return generateHistogram(simulationResults?.terminal?.distribution, 30);
  }, [simulationResults?.terminal?.distribution, generateHistogram]);

  // Previous simulation histogram for comparison
  const previousTerminalHistogramData = useMemo(() => {
    return generateHistogram(previousSimulationResults?.terminal?.distribution, 30);
  }, [previousSimulationResults?.terminal?.distribution, generateHistogram]);

  // Prepare histogram data for dollar outcomes
  const dollarHistogramData = useMemo(() => {
    if (!simulationResults?.terminalDollars?.distribution) return [];
    const dist = simulationResults.terminalDollars.distribution;
    const bins = 25;
    const min = Math.min(...dist);
    const max = Math.max(...dist);
    const binWidth = (max - min) / bins;
    
    const histogram = Array(bins).fill(0);
    dist.forEach(v => {
      const binIndex = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    });
    
    return histogram.map((count, i) => ({
      value: min + (i + 0.5) * binWidth,
      pct: (count / dist.length) * 100,
      label: formatCurrency(min + (i + 0.5) * binWidth),
    }));
  }, [simulationResults?.terminalDollars?.distribution, formatCurrency]);

  // Prepare histogram data for drawdowns
  const drawdownHistogramData = useMemo(() => {
    if (!simulationResults?.drawdown?.distribution) return [];
    const dist = simulationResults.drawdown.distribution;
    const bins = 20;
    const min = Math.min(...dist);
    const max = Math.max(...dist);
    const binWidth = (max - min) / bins;
    
    const histogram = Array(bins).fill(0);
    dist.forEach(v => {
      const binIndex = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    });
    
    return histogram.map((count, i) => ({
      value: min + (i + 0.5) * binWidth,
      pct: (count / dist.length) * 100,
      label: `-${((min + (i + 0.5) * binWidth) * 100).toFixed(0)}%`,
    }));
  }, [simulationResults?.drawdown?.distribution]);

  // Compute loss statistics with CVaR fallback
  const lossAnalysis = useMemo(() => {
    if (!simulationResults?.terminalReturns) return null;
    
    const allReturns = simulationResults.terminalReturns;
    const lossOnlyReturns = allReturns.filter(r => r < 0);
    const numLossScenarios = lossOnlyReturns.length;
    
    if (numLossScenarios === 0) return { noLosses: true };
    
    const sortedLosses = [...lossOnlyReturns].sort((a, b) => a - b);
    const sortedAll = [...allReturns].sort((a, b) => a - b);
    
    const getLossPercentile = (p) => {
      const idx = Math.floor(sortedLosses.length * p);
      return sortedLosses[Math.min(idx, sortedLosses.length - 1)];
    };
    
    // Calculate CVaR (Expected Shortfall) from all returns
    const cvar5Index = Math.floor(sortedAll.length * 0.05);
    const worst5Percent = sortedAll.slice(0, cvar5Index);
    const cvar5 = worst5Percent.length > 0 
      ? worst5Percent.reduce((a, b) => a + b, 0) / worst5Percent.length 
      : sortedAll[0];
    
    // Find breakeven percentile (at what P value we start to incur losses)
    const breakevenIndex = sortedAll.findIndex(r => r >= 0);
    const breakevenPercentile = breakevenIndex >= 0 
      ? (breakevenIndex / sortedAll.length) * 100 
      : 100;
    
    // Calculate VaR at different levels
    const var5 = sortedAll[Math.floor(sortedAll.length * 0.05)];
    const var10 = sortedAll[Math.floor(sortedAll.length * 0.10)];
    
    // Create histogram for loss scenarios
    const bins = 15;
    const min = sortedLosses[0]; // Most negative
    const max = sortedLosses[sortedLosses.length - 1]; // Least negative (closest to 0)
    const binWidth = (max - min) / bins || 0.01;
    
    const histogram = Array(bins).fill(0);
    lossOnlyReturns.forEach(v => {
      const binIndex = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histogram[binIndex]++;
    });
    
    const histogramData = histogram.map((count, i) => ({
      value: min + (i + 0.5) * binWidth,
      pct: (count / lossOnlyReturns.length) * 100,
      label: `${((min + (i + 0.5) * binWidth) * 100).toFixed(0)}%`,
    }));
    
    return {
      noLosses: false,
      count: numLossScenarios,
      lossPercent: (numLossScenarios / allReturns.length) * 100,
      worstCase: sortedLosses[0],
      avgLoss: lossOnlyReturns.reduce((a, b) => a + b, 0) / numLossScenarios,
      p25Loss: getLossPercentile(0.25),
      p50Loss: getLossPercentile(0.50),
      p75Loss: getLossPercentile(0.75),
      cvar5,
      var5,
      var10,
      breakevenPercentile,
      histogramData,
    };
  }, [simulationResults?.terminalReturns]);

  // Contribution chart data for vertical bars
  const contributionVerticalData = useMemo(() => {
    if (!contributionChartMemo?.chartData) return null;
    
    const scenarios = ['p5', 'p25', 'p50', 'p75', 'p95', 'mean'];
    const scenarioLabels = {
      p5: 'P5 (Bad)',
      p25: 'P25',
      p50: 'P50 (Median)',
      p75: 'P75',
      p95: 'P95 (Good)',
      mean: 'Mean',
    };
    
    return scenarios.map(key => {
      const row = contributionChartMemo.chartData.find(d => d.scenarioKey === key);
      if (!row) return null;
      
      const total = contributionChartMemo.sortedTickers.reduce(
        (sum, t) => sum + (row[t] || 0), 0
      );
      
      return {
        scenario: scenarioLabels[key],
        scenarioKey: key,
        total,
        ...row,
      };
    }).filter(Boolean);
  }, [contributionChartMemo]);

  // Get contribution details for hovered scenario
  const hoveredContributions = useMemo(() => {
    if (!contributionChartMemo?.chartData || !hoveredScenario) return [];
    
    const row = contributionChartMemo.chartData.find(d => d.scenarioKey === hoveredScenario);
    if (!row) return [];
    
    return contributionChartMemo.sortedTickers
      .map(ticker => ({
        ticker,
        value: row[ticker] || 0,
        color: contributionChartMemo.tickerColors[ticker],
      }))
      .sort((a, b) => b.value - a.value);
  }, [contributionChartMemo, hoveredScenario]);

  const scenarioLabels = {
    p5: 'P5 (Bad)',
    p25: 'P25',
    p50: 'P50 (Median)',
    p75: 'P75',
    p95: 'P95 (Good)',
    mean: 'Mean',
  };

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* Staleness Banner */}
      {stalenessStatus && stalenessStatus !== 'fresh' && (
        <StaleBanner
          status={stalenessStatus}
          reason={stalenessReason}
          tabName="Simulation"
          onRerun={canRun ? runSimulation : undefined}
          rerunLabel="Run Simulation"
          blockedTab={stalenessStatus === 'blocked' ? 'correlation' : undefined}
          onNavigate={onNavigateTab}
          styles={styles}
        />
      )}

      {/* Monte Carlo Settings - Premium Design */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(22, 27, 44, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(0, 212, 255, 0.12)',
        overflow: 'hidden',
        marginBottom: '16px',
      }}>
        {/* Header with gradient accent */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.08) 100%)',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}>
              🎲
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', fontFamily: FONT_FAMILY }}>
                Monte Carlo Simulation
              </div>
              <div style={{ fontSize: '10px', color: '#888', fontFamily: FONT_FAMILY }}>
                Configure simulation parameters
              </div>
            </div>
          </div>
          
          {/* Run Button - Prominent */}
          <button
            onClick={runSimulation}
            disabled={isSimulating || !editedCorrelation}
            style={{
              padding: '12px 24px',
              fontSize: '12px',
              fontWeight: '600',
              fontFamily: FONT_FAMILY,
              borderRadius: '10px',
              border: 'none',
              background: isSimulating
                ? 'linear-gradient(135deg, #444 0%, #333 100%)'
                : 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
              color: '#fff',
              cursor: isSimulating || !editedCorrelation ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: isSimulating ? 'none' : '0 4px 15px rgba(0, 212, 255, 0.25)',
              transition: 'all 0.2s ease',
              opacity: !editedCorrelation ? 0.5 : 1,
            }}
          >
            {isSimulating ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                Running...
              </>
            ) : (
              <>
                <span style={{ fontSize: '16px' }}>▶</span>
                Run Simulation
                <span style={{ 
                  marginLeft: '12px', 
                  display: 'inline-flex',
                  gap: '4px',
                }}>
                  <kbd style={{ 
                    padding: '2px 6px', 
                    fontSize: '9px', 
                    background: 'rgba(255,255,255,0.15)', 
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontFamily: 'inherit',
                  }}>Enter</kbd>
                  <kbd style={{ 
                    padding: '2px 6px', 
                    fontSize: '9px', 
                    background: 'rgba(255,255,255,0.15)', 
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    fontFamily: 'inherit',
                  }}>⌘R</kbd>
                </span>
              </>
            )}
          </button>
        </div>
        
        {/* Settings Grid */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '16px',
          }}>
            {/* Simulation Paths */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}>
              <div style={{
                fontSize: '10px',
                color: '#00d4ff',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
                fontWeight: '500',
                fontFamily: FONT_FAMILY,
              }}>
                Simulation Paths
              </div>
              <div style={{ 
                fontSize: '28px', 
                fontWeight: '700', 
                color: '#fff',
                marginBottom: '12px',
                fontFamily: FONT_FAMILY,
              }}>
                {numPaths.toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  { n: 1000, label: '1K', desc: 'Fast' },
                  { n: 5000, label: '5K', desc: '' },
                  { n: 10000, label: '10K', desc: 'Default' },
                  { n: 50000, label: '50K', desc: '' },
                  { n: 100000, label: '100K', desc: 'Precise' },
                ].map(({ n, label, desc }) => (
                  <button
                    key={n}
                    onClick={() => setNumPaths(n)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      fontFamily: FONT_FAMILY,
                      borderRadius: '6px',
                      border: numPaths === n ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.1)',
                      background: numPaths === n 
                        ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.2) 0%, rgba(123, 47, 247, 0.2) 100%)'
                        : 'transparent',
                      color: numPaths === n ? '#00d4ff' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Drawdown Threshold */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ 
                fontSize: '10px', 
                color: '#e74c3c', 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '8px',
                fontWeight: '600',
                fontFamily: FONT_FAMILY,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                Drawdown Threshold
                <InfoTooltip 
                  content="Probability of falling below this % from peak."
                  position="right"
                  size={10}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '12px' }}>
                <span style={{ 
                  fontSize: '28px', 
                  fontWeight: '700', 
                  color: '#e74c3c',
                  fontFamily: FONT_FAMILY,
                }}>
                  {drawdownThreshold}
                </span>
                <span style={{ fontSize: '16px', color: '#888', fontFamily: FONT_FAMILY }}>%</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[10, 15, 20, 25, 30].map(n => (
                  <button
                    key={n}
                    onClick={() => setDrawdownThreshold(n)}
                    style={{
                      padding: '6px 10px',
                      fontSize: '11px',
                      fontWeight: '600',
                      fontFamily: FONT_FAMILY,
                      borderRadius: '6px',
                      border: drawdownThreshold === n ? '1px solid #e74c3c' : '1px solid rgba(255,255,255,0.1)',
                      background: drawdownThreshold === n ? 'rgba(231, 76, 60, 0.2)' : 'transparent',
                      color: drawdownThreshold === n ? '#e74c3c' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {n}%
                  </button>
                ))}
              </div>
            </div>
            
            {/* Fat Tail Method */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ 
                fontSize: '10px', 
                color: '#ff9f43', 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: FONT_FAMILY,
              }}>
                Fat Tail Method
                <InfoTooltip 
                  content="Student-t preserves correlations during crashes. Copula applies tails independently."
                  position="right"
                  size={10}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: 'multivariateTStudent', label: 'Student-t', desc: 'Correlated tails' },
                  { value: 'gaussianCopula', label: 'Copula', desc: 'Independent tails' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFatTailMethod(opt.value)}
                    style={{
                      padding: '10px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      fontFamily: FONT_FAMILY,
                      borderRadius: '8px',
                      border: fatTailMethod === opt.value ? '1px solid #ff9f43' : '1px solid rgba(255,255,255,0.1)',
                      background: fatTailMethod === opt.value ? 'rgba(255, 159, 67, 0.15)' : 'transparent',
                      color: fatTailMethod === opt.value ? '#ff9f43' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sampling Method */}
            <div style={{
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
            }}>
              <div style={{ 
                fontSize: '10px', 
                color: '#9b59b6', 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '12px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: FONT_FAMILY,
              }}>
                Sampling Method
                <InfoTooltip 
                  content="Quasi-MC uses Sobol sequences for ~10× faster convergence."
                  position="right"
                  size={10}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { value: true, label: 'Quasi-MC', desc: 'Sobol sequences' },
                  { value: false, label: 'Standard', desc: 'Pseudo-random' },
                ].map(opt => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setUseQmc(opt.value)}
                    style={{
                      padding: '10px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      fontFamily: FONT_FAMILY,
                      borderRadius: '8px',
                      border: useQmc === opt.value ? '1px solid #9b59b6' : '1px solid rgba(255,255,255,0.1)',
                      background: useQmc === opt.value ? 'rgba(155, 89, 182, 0.15)' : 'transparent',
                      color: useQmc === opt.value ? '#9b59b6' : '#888',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{opt.label}</span>
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Methodology Pipeline - Always Visible */}
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '12px',
            padding: '16px 20px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div style={{ 
                fontSize: '10px', 
                color: '#888', 
                textTransform: 'uppercase',
                letterSpacing: '1px',
                fontWeight: '600',
                fontFamily: FONT_FAMILY,
              }}>
                Simulation Pipeline
              </div>
              <button
                onClick={() => setShowMethodologyExplainer(!showMethodologyExplainer)}
                style={{
                  padding: '4px 10px',
                  fontSize: '10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: '#888',
                  cursor: 'pointer',
                  fontFamily: FONT_FAMILY,
                }}
              >
                {showMethodologyExplainer ? '− Less' : '+ More'}
              </button>
            </div>
            
            {/* Pipeline visualization - 7 steps with sampling integrated */}
            <div style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: '4px',
              overflowX: 'auto',
            }}>
              {[
                { 
                  label: 'Moment Extraction', 
                  icon: '∫', 
                  color: '#00d4ff', 
                  sub: 'μ, σ², γ₁, γ₂',
                  tech: 'L-moments'
                },
                { 
                  label: 'Covariance', 
                  icon: 'Σ', 
                  color: '#9b59b6', 
                  sub: 'Ledoit-Wolf',
                  tech: 'Shrinkage α'
                },
                { 
                  label: 'Decomposition', 
                  icon: 'L', 
                  color: '#2ecc71', 
                  sub: 'Cholesky',
                  tech: 'LLᵀ = Σ'
                },
                { 
                  label: useQmc ? 'Sobol Seq.' : 'PRNG',
                  icon: useQmc ? '⊡' : '⊙', 
                  color: '#9b59b6', 
                  sub: useQmc ? 'Quasi-MC' : 'Mersenne',
                  tech: useQmc ? 'Low-discrep.' : 'MT19937',
                  highlight: true
                },
                { 
                  label: fatTailMethod === 'multivariateTStudent' ? 'Student-t' : 'Copula',
                  icon: 'ν', 
                  color: '#ff9f43', 
                  sub: fatTailMethod === 'multivariateTStudent' ? 'df=5' : 'Gaussian',
                  tech: fatTailMethod === 'multivariateTStudent' ? 'χ²/ν scaling' : 'Marginal CDF'
                },
                { 
                  label: 'Skew Adj.', 
                  icon: '≋', 
                  color: '#e74c3c', 
                  sub: 'Cornish-Fisher',
                  tech: 'z → z + γ₁(z²-1)/6'
                },
                { 
                  label: 'Terminal', 
                  icon: '$', 
                  color: '#2ecc71', 
                  sub: 'Returns',
                  tech: 'Σwᵢrᵢ'
                },
              ].map((step, i, arr) => (
                <React.Fragment key={i}>
                  <div style={{
                    flex: 1,
                    padding: '10px 6px',
                    background: step.highlight 
                      ? `linear-gradient(135deg, ${step.color}25 0%, ${step.color}10 100%)`
                      : `linear-gradient(135deg, ${step.color}12 0%, ${step.color}04 100%)`,
                    border: step.highlight 
                      ? `1px solid ${step.color}66`
                      : `1px solid ${step.color}22`,
                    borderRadius: '6px',
                    textAlign: 'center',
                    minWidth: '75px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}>
                    <div style={{ 
                      fontSize: '16px', 
                      marginBottom: '2px', 
                      fontFamily: FONT_FAMILY,
                      fontWeight: 'bold',
                      color: step.color,
                    }}>
                      {step.icon}
                    </div>
                    <div style={{ 
                      fontSize: '9px', 
                      fontWeight: '600', 
                      color: step.color, 
                      marginBottom: '1px',
                      fontFamily: FONT_FAMILY,
                    }}>
                      {step.label}
                    </div>
                    <div style={{ 
                      fontSize: '8px', 
                      color: '#666',
                      fontFamily: FONT_FAMILY,
                    }}>
                      {step.sub}
                    </div>
                    <div style={{ 
                      fontSize: '7px', 
                      color: '#555',
                      fontFamily: FONT_FAMILY,
                      marginTop: '2px',
                    }}>
                      {step.tech}
                    </div>
                  </div>
                  {i < arr.length - 1 && (
                    <div style={{ 
                      color: '#444', 
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                    }}>→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
            
            {/* Expanded methodology details */}
            {showMethodologyExplainer && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'rgba(0, 212, 255, 0.05)',
                border: '1px solid rgba(0, 212, 255, 0.15)',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: 1.7,
                color: '#aaa',
                fontFamily: FONT_FAMILY,
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#00d4ff' }}>1. Moment Extraction:</strong> We compute the first four moments of each asset's historical returns: 
                  mean (μ), variance (σ²), skewness (γ₁), and excess kurtosis (γ₂). {useEwma ? 'Using EWMA weighting to emphasize recent observations.' : ''}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#9b59b6' }}>2. Covariance Estimation:</strong> Ledoit-Wolf shrinkage estimator blends the sample covariance 
                  with a structured target (constant correlation) to improve conditioning and reduce estimation error.
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#2ecc71' }}>3. Cholesky Decomposition:</strong> Factor the PSD covariance matrix Σ = LLᵀ where L is lower-triangular, 
                  enabling efficient generation of correlated random vectors.
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#9b59b6' }}>4. Random Sampling:</strong> {useQmc 
                    ? 'Quasi-Monte Carlo uses Sobol low-discrepancy sequences that fill the sample space more uniformly than pseudo-random numbers, achieving O(1/N) convergence vs O(1/√N).'
                    : 'Standard Mersenne Twister PRNG generates IID uniform samples, transformed via inverse CDF to standard normal.'}
                </div>
                <div style={{ marginBottom: '12px' }}>
                  <strong style={{ color: '#ff9f43' }}>5. Fat Tails:</strong> {fatTailMethod === 'multivariateTStudent' 
                    ? 'Multivariate Student-t with df=5 scales correlated normals by √(ν/χ²_ν), preserving dependence structure during tail events.'
                    : 'Gaussian Copula applies marginal fat-tail transforms independently while maintaining the correlation structure via probability integral transform.'}
                </div>
                <div>
                  <strong style={{ color: '#e74c3c' }}>6. Skewness Adjustment:</strong> Cornish-Fisher expansion transforms symmetric draws to match 
                  empirical skewness: z′ = z + γ₁(z²-1)/6, capturing asymmetric return distributions.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {!editedCorrelation && (
        <div style={{ 
          marginTop: '12px', 
          padding: '12px 16px',
          background: 'rgba(255, 159, 67, 0.1)',
          border: '1px solid rgba(255, 159, 67, 0.3)',
          borderRadius: '8px',
          color: '#ff9f43', 
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>⚠️</span>
          Please compute the correlation matrix first (Correlation tab) before running simulation
        </div>
      )}
      
      {simulationResults?.savedAt && (
        <div style={{ 
          marginTop: '12px', 
          padding: '10px 16px',
          background: 'rgba(0, 212, 255, 0.05)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: '8px',
          color: '#00d4ff', 
          fontSize: '11px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span>📋</span>
          Cached results from {new Date(simulationResults.savedAt).toLocaleString()} • Click "Run Simulation" to refresh
        </div>
      )}
      
      {/* Empty state */}
      {!simulationResults && (
        <EmptySimulationState 
          positions={positions}
          editedCorrelation={editedCorrelation}
          isSimulating={isSimulating}
          runSimulation={runSimulation}
          styles={styles}
        />
      )}
      
      {/* Results */}
      {simulationResults && !simulationResults.error && (
        <>
          {/* Sanity check */}
          <SanityCheckCard simulationResults={simulationResults} styles={styles} />
        
          {/* 2x2 Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Terminal Returns */}
            <DistributionCard
              title="📊 1-Year Return Distribution"
              subtitle={`${numPaths.toLocaleString()} paths${useQmc ? ' (QMC)' : ''}`}
              stats={[
                { label: 'P5', value: simulationResults.terminal?.p5 },
                { label: 'P25', value: simulationResults.terminal?.p25 },
                { label: 'Median', value: simulationResults.terminal?.p50 },
                { label: 'Mean', value: simulationResults.terminal?.mean },
                { label: 'P75', value: simulationResults.terminal?.p75 },
                { label: 'P95', value: simulationResults.terminal?.p95 },
              ]}
              histogramData={terminalHistogramData}
              comparisonData={previousTerminalHistogramData}
              formatValue={(v) => `${(v * 100).toFixed(1)}%`}
              meanLine={simulationResults.terminal?.mean}
              styles={styles}
              animationKey={simulationResults?.simulationTime}
            />
            
            {/* Portfolio Value */}
            <DollarDistributionCard
              simulationResults={simulationResults}
              histogramData={dollarHistogramData}
              formatCurrency={formatCurrency}
              styles={styles}
            />
            
            {/* Drawdown */}
            <DrawdownCard
              simulationResults={simulationResults}
              histogramData={drawdownHistogramData}
              styles={styles}
            />
            
            {/* Loss Scenario Analysis */}
            <LossScenarioCard
              lossAnalysis={lossAnalysis}
              probLoss={simulationResults.probLoss}
              styles={styles}
            />
          </div>
          
          {/* Contribution Analysis - Vertical Bars with Table */}
          {contributionChartMemo && contributionVerticalData && (
            <ContributionAnalysis
              data={contributionVerticalData}
              tickers={contributionChartMemo.sortedTickers}
              tickerColors={contributionChartMemo.tickerColors}
              hoveredScenario={hoveredScenario}
              setHoveredScenario={setHoveredScenario}
              hoveredContributions={hoveredContributions}
              scenarioLabels={scenarioLabels}
              styles={styles}
            />
          )}
        </>
      )}
      
      {/* Error state */}
      {simulationResults?.error && (
        <div style={{ 
          ...styles.card, 
          background: 'rgba(231, 76, 60, 0.1)', 
          border: '1px solid rgba(231, 76, 60, 0.3)',
        }}>
          <div style={{ color: '#e74c3c', fontWeight: 'bold', marginBottom: '8px' }}>
            ⚠️ Simulation Error
          </div>
          <div style={{ color: '#ff6b6b' }}>{simulationResults.error}</div>
        </div>
      )}
    </div>
  );
});

// ============================================
// SUB-COMPONENTS (Memoized for performance)
// ============================================

const EmptySimulationState = memo(({ positions, editedCorrelation, isSimulating, runSimulation, styles }) => (
  <div style={{
    marginTop: '16px',
    padding: '50px 24px',
    textAlign: 'center',
    background: 'linear-gradient(135deg, rgba(22, 27, 44, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(0, 212, 255, 0.08)',
    fontFamily: FONT_FAMILY,
  }}>
    <div style={{
      width: '80px',
      height: '80px',
      borderRadius: '20px',
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.15) 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '32px',
      margin: '0 auto 20px',
      border: '1px solid rgba(0, 212, 255, 0.15)',
    }}>
      🎲
    </div>
    <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px', fontWeight: '600' }}>
      Ready to Simulate
    </h3>
    <p style={{ margin: '0 0 24px 0', color: '#888', fontSize: '12px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto', lineHeight: '1.6' }}>
      Run a Monte Carlo simulation with {positions.length} positions to see potential portfolio outcomes across thousands of scenarios.
    </p>
    
    <div style={{ 
      display: 'inline-flex', 
      flexDirection: 'column', 
      gap: '12px', 
      alignItems: 'flex-start', 
      marginBottom: '32px',
      padding: '16px 24px',
      background: 'rgba(0, 0, 0, 0.2)',
      borderRadius: '12px',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        color: positions.length > 0 ? '#2ecc71' : '#666',
        fontSize: '13px',
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          background: positions.length > 0 ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.05)',
          border: positions.length > 0 ? '1px solid #2ecc71' : '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
        }}>
          {positions.length > 0 ? '✓' : '1'}
        </div>
        Add positions ({positions.length} added)
      </div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px', 
        color: editedCorrelation ? '#2ecc71' : '#666',
        fontSize: '13px',
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '6px',
          background: editedCorrelation ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.05)',
          border: editedCorrelation ? '1px solid #2ecc71' : '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px',
        }}>
          {editedCorrelation ? '✓' : '2'}
        </div>
        Compute correlation matrix
      </div>
    </div>
    
    {!editedCorrelation && (
      <p style={{ margin: 0, color: '#ff9f43', fontSize: '12px' }}>
        ⚠️ Go to Correlation tab and click "Compute Correlation" first
      </p>
    )}
  </div>
));

const SanityCheckCard = memo(({ simulationResults, styles }) => (
  <div style={{ 
    marginTop: '24px',
    marginBottom: '20px',
    padding: '20px 24px',
    background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.1) 0%, rgba(0, 212, 255, 0.05) 100%)',
    borderRadius: '12px',
    border: '1px solid rgba(46, 204, 113, 0.2)',
    fontFamily: FONT_FAMILY,
  }}>
    <div style={{ 
      fontSize: '10px', 
      color: '#2ecc71', 
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '16px',
      fontWeight: '600',
    }}>
      ✓ Simulation Complete
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
      <div>
        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Expected Return</div>
        <div style={{ fontSize: '28px', fontWeight: '700', color: simulationResults.expectedReturn >= 0 ? '#2ecc71' : '#e74c3c' }}>
          {isFinite(simulationResults.expectedReturn) ? `${(simulationResults.expectedReturn * 100).toFixed(1)}%` : 'N/A'}
        </div>
      </div>
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
      <div>
        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Portfolio Volatility</div>
        <div style={{ fontSize: '28px', fontWeight: '700', color: '#ff9f43' }}>
          {isFinite(simulationResults.expectedVol) ? `${(simulationResults.expectedVol * 100).toFixed(1)}%` : 'N/A'}
        </div>
      </div>
      <div style={{ width: '1px', background: 'rgba(255,255,255,0.1)' }} />
      <div>
        <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Simulated Mean</div>
        <div style={{ fontSize: '28px', fontWeight: '700', color: simulationResults.terminal?.mean >= 0 ? '#00d4ff' : '#e74c3c' }}>
          {isFinite(simulationResults.terminal?.mean) ? `${(simulationResults.terminal.mean * 100).toFixed(1)}%` : 'N/A'}
        </div>
      </div>
    </div>
  </div>
));

const DistributionCard = memo(({ title, subtitle, stats, histogramData, comparisonData, formatValue, meanLine, styles, animationKey }) => {
  const cardStyle = { ...styles.card, display: 'flex', flexDirection: 'column', minHeight: '380px', fontFamily: FONT_FAMILY, overflow: 'hidden' };

  return (
    <div style={cardStyle}>
      {/* Card Header */}
      <div style={{ ...styles.cardTitle, fontSize: '14px', fontFamily: FONT_FAMILY }}>{title}</div>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', fontFamily: FONT_FAMILY }}>{subtitle}</div>

      {/* 3x2 Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {stats.filter(s => s.value !== undefined).map((stat, i) => (
          <div key={i} style={{
            ...styles.stat,
            padding: '6px 4px',
            background: stat.value >= 0 ? 'rgba(46, 204, 113, 0.05)' : 'rgba(231, 76, 60, 0.05)',
            borderRadius: '6px',
            transition: 'all 0.3s ease',
          }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: stat.value >= 0 ? '#2ecc71' : '#e74c3c',
              fontFamily: FONT_FAMILY,
            }}>
              {formatValue(stat.value)}
            </div>
            <div style={{ ...styles.statLabel, fontSize: '9px', fontFamily: FONT_FAMILY }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Interactive Histogram with zoom, highlight, and comparison */}
      <div style={{ flex: 1, minHeight: '160px' }}>
        <InteractiveHistogram
          data={histogramData}
          comparisonData={comparisonData}
          height={160}
          meanLine={meanLine}
          animationKey={animationKey}
          showControls={true}
        />
      </div>
    </div>
  );
});

const DollarDistributionCard = memo(({ simulationResults, histogramData, formatCurrency, styles }) => {
  const cardStyle = { ...styles.card, display: 'flex', flexDirection: 'column', minHeight: '380px', fontFamily: FONT_FAMILY, overflow: 'hidden' };
  const td = simulationResults.terminalDollars;
  
  if (!td) {
    return (
      <div style={cardStyle}>
        <div style={{ ...styles.cardTitle, fontSize: '14px', fontFamily: FONT_FAMILY }}>💰 Portfolio Value</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontFamily: FONT_FAMILY }}>
          Data not available
        </div>
      </div>
    );
  }
  
  // 6 stats for 3x2 grid
  const stats = [
    { label: 'P5 (Bad)', value: td.p5 },
    { label: 'P25', value: td.p25 },
    { label: 'Median', value: td.p50 },
    { label: 'Mean', value: td.mean },
    { label: 'P75', value: td.p75 },
    { label: 'P95 (Good)', value: td.p95 },
  ];
  
  return (
    <div style={cardStyle}>
      <div style={{ ...styles.cardTitle, fontSize: '14px', fontFamily: FONT_FAMILY }}>💰 Portfolio Value Distribution</div>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', fontFamily: FONT_FAMILY }}>
        Starting: {formatCurrency(td.startingValue)}
      </div>
      
      {/* 3x2 Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{ 
            ...styles.stat, 
            padding: '6px 4px',
            background: stat.value >= td.startingValue ? 'rgba(46, 204, 113, 0.05)' : 'rgba(231, 76, 60, 0.05)',
            borderRadius: '6px',
          }}>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: '600', 
              color: stat.value >= td.startingValue ? '#2ecc71' : '#e74c3c',
              fontFamily: FONT_FAMILY,
            }}>
              {formatCurrency(stat.value)}
            </div>
            <div style={{ ...styles.statLabel, fontSize: '9px', fontFamily: FONT_FAMILY }}>{stat.label}</div>
          </div>
        ))}
      </div>
      
      {/* Interactive Histogram */}
      <div style={{ flex: 1, minHeight: '160px' }}>
        <InteractiveHistogram
          data={histogramData.map(d => ({
            ...d,
            // Adjust value sign for coloring (positive if above starting value)
            value: d.value - td.startingValue,
          }))}
          height={160}
          showControls={true}
        />
      </div>
    </div>
  );
});

const DrawdownCard = memo(({ simulationResults, histogramData, styles }) => {
  const cardStyle = { ...styles.card, display: 'flex', flexDirection: 'column', minHeight: '380px', fontFamily: FONT_FAMILY, overflow: 'hidden' };
  const dd = simulationResults.drawdown;

  // Calculate additional drawdown stats
  const probExceed20 = dd?.probExceedThreshold || 0;
  const expectedDD = dd?.mean || dd?.p50 || 0;

  return (
    <div style={cardStyle}>
      <div style={{ ...styles.cardTitle, fontSize: '14px', fontFamily: FONT_FAMILY }}>📉 Max Drawdown Distribution</div>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', fontFamily: FONT_FAMILY }}>Estimated from portfolio volatility</div>

      {/* 3x2 Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {[
          { label: 'Median (P50)', value: dd?.p50, format: 'dd' },
          { label: 'P75', value: dd?.p75 || (dd?.p90 ? dd.p90 * 0.85 : 0), format: 'dd' },
          { label: 'P90', value: dd?.p90, format: 'dd' },
          { label: 'P95', value: dd?.p95 || (dd?.p99 ? dd.p99 * 0.9 : 0), format: 'dd' },
          { label: 'P99 (Extreme)', value: dd?.p99, format: 'dd' },
          { label: 'Expected', value: expectedDD, format: 'dd' },
        ].map((stat, i) => (
          <div key={i} style={{
            ...styles.stat,
            padding: '6px 4px',
            background: 'rgba(231, 76, 60, 0.05)',
            borderRadius: '6px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#e74c3c', fontFamily: FONT_FAMILY }}>
              -{((stat.value || 0) * 100).toFixed(1)}%
            </div>
            <div style={{ ...styles.statLabel, fontSize: '9px', fontFamily: FONT_FAMILY }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Interactive Histogram for Drawdowns */}
      <div style={{ flex: 1, minHeight: '160px' }}>
        <InteractiveHistogram
          data={histogramData.map(d => ({ ...d, value: -Math.abs(d.value) }))}
          height={160}
          colorPositive="#e74c3c"
          colorNegative="#e74c3c"
          showControls={true}
        />
      </div>
    </div>
  );
});

const LossScenarioCard = memo(({ lossAnalysis, probLoss, styles }) => {
  const cardStyle = { ...styles.card, display: 'flex', flexDirection: 'column', minHeight: '380px', fontFamily: FONT_FAMILY, overflow: 'hidden' };
  
  if (!lossAnalysis) {
    return (
      <div style={cardStyle}>
        <div style={{ ...styles.cardTitle, fontSize: '14px', fontFamily: FONT_FAMILY }}>🔴 Loss Scenario Analysis</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontFamily: FONT_FAMILY }}>
          Run simulation to see loss analysis
        </div>
      </div>
    );
  }
  
  if (lossAnalysis.noLosses) {
    return (
      <div style={cardStyle}>
        <div style={{ ...styles.cardTitle, fontSize: '14px', fontFamily: FONT_FAMILY }}>🔴 Loss Scenario Analysis</div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2ecc71', fontFamily: FONT_FAMILY }}>
          🎉 No loss scenarios in this simulation!
        </div>
      </div>
    );
  }
  
  return (
    <div style={cardStyle}>
      <div style={{ ...styles.cardTitle, fontSize: '14px', fontFamily: FONT_FAMILY }}>🔴 Loss Scenario Analysis</div>
      <div style={{ fontSize: '11px', color: '#666', marginBottom: '10px', fontFamily: FONT_FAMILY }}>
        Analyzing {lossAnalysis.count.toLocaleString()} loss scenarios ({lossAnalysis.lossPercent?.toFixed(1) || ((probLoss?.probBreakeven || 0) * 100).toFixed(1)}% of paths)
      </div>
      
      {/* 3x2 Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
        {[
          { label: 'Loss Threshold', value: lossAnalysis.breakevenPercentile, format: 'pct', color: '#ff9f43', desc: 'Losses start at P' },
          { label: 'VaR 5%', value: lossAnalysis.var5, format: 'ret', color: '#e74c3c' },
          { label: 'VaR 10%', value: lossAnalysis.var10, format: 'ret', color: '#e74c3c' },
          { label: 'CVaR 5%', value: lossAnalysis.cvar5, format: 'ret', color: '#e74c3c', desc: 'Expected Shortfall' },
          { label: 'Median Loss', value: lossAnalysis.p50Loss, format: 'ret', color: '#e74c3c' },
          { label: 'Worst Case', value: lossAnalysis.worstCase, format: 'ret', color: '#e74c3c' },
        ].map((stat, i) => (
          <div key={i} style={{ 
            ...styles.stat, 
            padding: '6px 4px',
            background: stat.color === '#ff9f43' ? 'rgba(255, 159, 67, 0.08)' : 'rgba(231, 76, 60, 0.05)',
            borderRadius: '6px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: stat.color, fontFamily: FONT_FAMILY }}>
              {stat.format === 'pct' 
                ? `P${(stat.value || 0).toFixed(0)}`
                : `${((stat.value || 0) * 100).toFixed(1)}%`
              }
            </div>
            <div style={{ ...styles.statLabel, fontSize: '9px', fontFamily: FONT_FAMILY }}>{stat.label}</div>
          </div>
        ))}
      </div>
      
      {/* Interactive Histogram for Loss Scenarios */}
      <div style={{ flex: 1, minHeight: '160px' }}>
        <InteractiveHistogram
          data={lossAnalysis.histogramData}
          height={160}
          colorPositive="#e74c3c"
          colorNegative="#e74c3c"
          showControls={true}
        />
      </div>
    </div>
  );
});

const ContributionAnalysis = memo(({ 
  data, 
  tickers, 
  tickerColors, 
  hoveredScenario, 
  setHoveredScenario, 
  hoveredContributions,
  scenarioLabels,
  styles 
}) => {
  // Find max absolute contribution for scaling bars
  const maxAbsContrib = useMemo(() => {
    let max = 0;
    hoveredContributions.forEach(c => {
      max = Math.max(max, Math.abs(c.value));
    });
    return max || 1;
  }, [hoveredContributions]);

  const totalReturn = hoveredContributions.reduce((s, c) => s + c.value, 0);

  return (
    <div style={{ ...styles.card, marginTop: '16px', fontFamily: FONT_FAMILY }}>
      <div style={styles.cardTitle}>
        <span>📊</span> Position Contribution Analysis
      </div>
      <div style={{ fontSize: '11px', color: '#888', marginBottom: '16px' }}>
        Click a scenario to see how each position contributes to total return
      </div>
      
      {/* Scenario selector buttons */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '20px',
        flexWrap: 'wrap',
      }}>
        {data.map(d => (
          <button
            key={d.scenarioKey}
            onClick={() => setHoveredScenario(d.scenarioKey)}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: hoveredScenario === d.scenarioKey 
                ? '1px solid #00d4ff' 
                : '1px solid #333',
              background: hoveredScenario === d.scenarioKey 
                ? 'rgba(0, 212, 255, 0.15)' 
                : 'rgba(255,255,255,0.03)',
              color: hoveredScenario === d.scenarioKey ? '#00d4ff' : '#aaa',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: FONT_FAMILY,
              fontWeight: hoveredScenario === d.scenarioKey ? '600' : '400',
              transition: 'all 0.15s ease',
            }}
          >
            <div>{d.scenario}</div>
            <div style={{ 
              fontSize: '14px', 
              fontWeight: 'bold',
              color: d.total >= 0 ? '#2ecc71' : '#e74c3c',
              marginTop: '2px',
            }}>
              {d.total >= 0 ? '+' : ''}{d.total.toFixed(1)}%
            </div>
          </button>
        ))}
      </div>
      
      {/* Selected scenario breakdown */}
      <div style={{
        padding: '16px',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '8px',
        border: '1px solid #2a2a4a',
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #2a2a4a',
        }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#00d4ff' }}>
            {scenarioLabels[hoveredScenario]} Breakdown
          </span>
          <span style={{ 
            fontSize: '16px', 
            fontWeight: 'bold',
            color: totalReturn >= 0 ? '#2ecc71' : '#e74c3c',
          }}>
            Total: {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}%
          </span>
        </div>
        
        {/* Position contributions with mini bar chart */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {hoveredContributions.map(({ ticker, value, color }) => (
            <div 
              key={ticker}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '6px 0',
              }}
            >
              {/* Ticker name */}
              <span style={{ 
                width: '70px',
                fontSize: '11px', 
                color: '#aaa',
                fontWeight: '500',
              }}>
                {ticker}
              </span>
              
              {/* Bar visualization */}
              <div style={{ 
                flex: 1, 
                height: '18px',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '3px',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Center line */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  background: '#444',
                }} />
                
                {/* Bar */}
                <div style={{
                  position: 'absolute',
                  top: '2px',
                  bottom: '2px',
                  borderRadius: '2px',
                  background: value >= 0 ? '#2ecc71' : '#e74c3c',
                  opacity: 0.8,
                  ...(value >= 0 
                    ? { 
                        left: '50%', 
                        width: `${Math.min(50, (Math.abs(value) / maxAbsContrib) * 50)}%` 
                      }
                    : { 
                        right: '50%', 
                        width: `${Math.min(50, (Math.abs(value) / maxAbsContrib) * 50)}%` 
                      }
                  ),
                }} />
              </div>
              
              {/* Value */}
              <span style={{ 
                width: '60px',
                textAlign: 'right',
                fontSize: '12px',
                fontWeight: 'bold',
                color: value >= 0 ? '#2ecc71' : '#e74c3c',
              }}>
                {value >= 0 ? '+' : ''}{value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

SimulationTab.displayName = 'SimulationTab';

export default SimulationTab;
