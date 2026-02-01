import React, { memo, useState, useMemo, useRef } from 'react';
import { StaleBanner } from '../common';

/**
 * OptimizeTab - Portfolio Optimization Analysis Tab Component (v2.0)
 * 
 * Premium UI redesign with:
 * - Visual settings panel with pipeline visualization
 * - 3x2 stats grid for portfolio metrics
 * - Top swap cards with visual emphasis
 * - Interactive risk contribution chart
 * - Modern heatmap styling
 */

// Design tokens
const COLORS = {
  cyan: '#00d4ff',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#ff9f43',
  purple: '#9b59b6',
  blue: '#3498db',
};

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// Helper to safely format delta Sharpe values as basis points
// Clamps extreme values and handles NaN/Infinity
// Returns number only (caller adds +/- sign if needed)
const formatDeltaSharpeBps = (deltaSharpe, includeSign = false) => {
  const val = deltaSharpe || 0;
  // Handle NaN or Infinity
  if (!isFinite(val)) return 0;
  // Clamp to reasonable range: ±1.0 = ±10000 bps (±100 percentage points)
  const clamped = Math.max(-1, Math.min(1, val));
  const bps = Math.round(clamped * 10000);
  if (includeSign) {
    return bps > 0 ? `+${bps}` : `${bps}`;
  }
  return bps;
};

// ============================================
// MAIN COMPONENT
// ============================================

const OptimizeTab = memo(({
  positions,
  editedCorrelation,
  correlationGroups,
  optimizationResults,
  optimizationProgress,
  analyticalSwapMatrix,
  riskFreeRate,
  setRiskFreeRate,
  swapSize,
  setSwapSize,
  optimizationPaths,
  setOptimizationPaths,
  useQmc,
  setUseQmc,
  isOptimizing,
  runPortfolioOptimization,
  setOptimizationResults,
  // Staleness tracking
  stalenessStatus,
  stalenessReason,
  canRun,
  onNavigateTab,
  styles,
}) => {
  try {
    // Defensive: ensure positions is an array
    const safePositions = Array.isArray(positions) ? positions : [];
    const tickers = safePositions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    const hasCorrelation = editedCorrelation && Array.isArray(editedCorrelation) && editedCorrelation.length >= 2;
    // Allow optimization if we have correlation data OR if we already have results (can re-run)
    const hasExistingResults = optimizationResults && optimizationResults.current;
    const canOptimize = tickers.length >= 2 && (hasCorrelation || hasExistingResults);
    
    // Detect if correlation groups/floors are configured
    const safeCorrelationGroups = correlationGroups && typeof correlationGroups === 'object' ? correlationGroups : {};
    const hasCorrelationGroups = Object.keys(safeCorrelationGroups).length > 0 && Object.values(safeCorrelationGroups).some(arr => Array.isArray(arr) && arr.length > 0);
    const groupCount = hasCorrelationGroups ? Object.values(safeCorrelationGroups).filter(arr => Array.isArray(arr) && arr.length > 0).length : 0;
    
    // Check if results might be stale (basic check - optimization older than correlation updates)
    const resultsTimestamp = optimizationResults?.timestamp;
    const isResultsStale = resultsTimestamp && (Date.now() - resultsTimestamp > 30 * 60 * 1000); // 30 min threshold
    
    // Format helpers
    const fmtPct = (v, decimals = 1) => {
      if (v == null || !isFinite(v)) return '-';
      return (v * 100).toFixed(decimals) + '%';
    };
    
    const fmtChange = (v, decimals = 2, inverted = false) => {
      if (v == null || !isFinite(v)) return <span style={{ color: '#888' }}>-</span>;
      const isPositive = inverted ? v < 0 : v > 0;
      const color = isPositive ? COLORS.green : v === 0 ? '#888' : COLORS.red;
      const sign = v > 0 ? '+' : '';
      return <span style={{ color, fontFamily: FONT_FAMILY }}>{sign}{(v * 100).toFixed(decimals)}%</span>;
    };
    
    const getHeatmapColor = (value, max) => {
      if (value === 0) return 'transparent';
      const intensity = Math.min(1, Math.abs(value) / (max || 0.1));
      return value > 0 
        ? `rgba(46, 204, 113, ${0.15 + intensity * 0.5})`
        : `rgba(231, 76, 60, ${0.15 + intensity * 0.5})`;
    };
    
    return (
      <div style={{ fontFamily: FONT_FAMILY }}>
        {/* Staleness Banner */}
        <StaleBanner
          status={stalenessStatus}
          reason={stalenessReason}
          tabName="Optimization"
          onRerun={runPortfolioOptimization}
          rerunLabel="Run Optimization"
          blockedTab="simulation"
          onNavigate={onNavigateTab}
          styles={styles}
        />

        {/* Premium Settings Panel */}
        <OptimizationSettings
          riskFreeRate={riskFreeRate}
          setRiskFreeRate={setRiskFreeRate}
          swapSize={swapSize}
          setSwapSize={setSwapSize}
          optimizationPaths={optimizationPaths}
          setOptimizationPaths={setOptimizationPaths}
          useQmc={useQmc}
          setUseQmc={setUseQmc}
          canOptimize={canOptimize}
          isOptimizing={isOptimizing}
          runPortfolioOptimization={runPortfolioOptimization}
          optimizationProgress={optimizationProgress}
          hasCorrelationGroups={hasCorrelationGroups}
          groupCount={groupCount}
          resultsTimestamp={resultsTimestamp}
          isResultsStale={isResultsStale}
        />
        
        {/* Empty state - only show if no optimization results */}
        {!optimizationResults && !isOptimizing && (
          <EmptyOptimizeState 
            tickers={tickers}
            hasCorrelation={hasCorrelation}
            canOptimize={canOptimize}
            runPortfolioOptimization={runPortfolioOptimization}
          />
        )}
        
        {/* Results - full optimization data */}
        {optimizationResults && !isOptimizing && optimizationResults.current && (
          <>
            <PortfolioSummaryCard optimizationResults={optimizationResults} fmtPct={fmtPct} />
            
            {(optimizationResults.topSwaps?.length || 0) > 0 && (
              <TopSwapsCard optimizationResults={optimizationResults} fmtPct={fmtPct} fmtChange={fmtChange} />
            )}
            
            <RiskContributionCard optimizationResults={optimizationResults} fmtPct={fmtPct} />
          </>
        )}
        
        {/* Swap Heatmap - ALWAYS in this position, uses best available data */}
        {!isOptimizing && (optimizationResults?.swapMatrix || analyticalSwapMatrix) && (
          <SwapHeatmapCard 
            swapMatrix={optimizationResults?.swapMatrix || analyticalSwapMatrix}
            isAnalytical={!optimizationResults?.swapMatrix}
            getHeatmapColor={getHeatmapColor}
            pathsPerScenario={optimizationResults?.pathsPerScenario || optimizationPaths}
          />
        )}
        
        {/* Risk Parity and Footer - only when we have full results */}
        {optimizationResults && !isOptimizing && optimizationResults.current && (
          <>
            {optimizationResults.riskParity && (
              <RiskParityCard optimizationResults={optimizationResults} fmtPct={fmtPct} />
            )}
            
            {/* Footer */}
            <div style={{ 
              fontSize: '10px', 
              color: '#555', 
              textAlign: 'center', 
              marginTop: '20px',
              padding: '10px 16px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '8px',
              fontFamily: FONT_FAMILY,
            }}>
              <span style={{ color: COLORS.green }}>✓</span> {((optimizationResults.computeTime || 0) / 1000).toFixed(1)}s
              <span style={{ margin: '0 8px', color: '#333' }}>•</span>
              {(optimizationResults.topSwaps?.length || 0)} swaps
              <span style={{ margin: '0 8px', color: '#333' }}>•</span>
              {optimizationResults.pathsPerScenario?.toLocaleString() || '100K'} paths
              {optimizationResults.useQmc && <span style={{ color: COLORS.purple }}> QMC</span>}
              <span style={{ margin: '0 8px', color: '#333' }}>•</span>
              {optimizationResults.timestamp ? new Date(optimizationResults.timestamp).toLocaleTimeString() : '-'}
              {hasCorrelationGroups && (
                <>
                  <span style={{ margin: '0 8px', color: '#333' }}>•</span>
                  <span style={{ color: COLORS.purple }}>🔗 {groupCount} corr group{groupCount > 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering Optimize tab:', error);
    return (
      <div style={{ 
        padding: '24px', 
        background: 'rgba(231, 76, 60, 0.1)', 
        border: '1px solid rgba(231, 76, 60, 0.3)',
        borderRadius: '12px',
        fontFamily: FONT_FAMILY,
      }}>
        <div style={{ color: COLORS.red, marginBottom: '16px' }}>
          ⚠️ Error rendering optimization results
        </div>
        <button 
          onClick={() => { setOptimizationResults(null); }}
          style={{
            padding: '8px 16px',
            background: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid ' + COLORS.red,
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
          }}
        >
          🗑️ Clear & Retry
        </button>
        <div style={{ fontSize: '10px', color: '#888', marginTop: '12px' }}>{error.message}</div>
      </div>
    );
  }
});

// ============================================
// SETTINGS PANEL
// ============================================

const OptimizationSettings = memo(({ 
  riskFreeRate, setRiskFreeRate, 
  swapSize, setSwapSize,
  optimizationPaths, setOptimizationPaths,
  useQmc, setUseQmc,
  canOptimize, isOptimizing, runPortfolioOptimization, optimizationProgress,
  hasCorrelationGroups, groupCount, resultsTimestamp, isResultsStale,
}) => {
  const pipeline = [
    { icon: '📊', label: 'Covariance', desc: 'Build Σ matrix' },
    { icon: '📈', label: 'MCTR', desc: 'Risk attribution' },
    { icon: '⚡', label: 'iSharpe', desc: 'Incremental analysis' },
    { icon: '🔄', label: 'Swaps', desc: 'Generate pairs' },
    { icon: '🎲', label: 'MC Validate', desc: `${(optimizationPaths / 1000).toFixed(0)}K sims` },
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(22, 27, 44, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)',
      borderRadius: '16px',
      border: '1px solid rgba(0, 212, 255, 0.12)',
      overflow: 'hidden',
      marginBottom: '20px',
      fontFamily: FONT_FAMILY,
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.08) 100%)',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(0, 212, 255, 0.08)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🎯</span>
            Portfolio Optimization
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Analytical + Monte Carlo validated trade recommendations</span>
            {hasCorrelationGroups && (
              <span style={{ 
                background: 'rgba(155, 89, 182, 0.15)', 
                color: COLORS.purple, 
                padding: '2px 6px', 
                borderRadius: '4px',
                fontSize: '9px',
              }}>
                🔗 {groupCount} corr group{groupCount > 1 ? 's' : ''} active
              </span>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Data freshness indicator */}
          {resultsTimestamp && (
            <div style={{ 
              fontSize: '9px', 
              color: isResultsStale ? COLORS.orange : '#555',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}>
              {isResultsStale && <span>⚠️</span>}
              <span>Last run: {new Date(resultsTimestamp).toLocaleTimeString()}</span>
            </div>
          )}
          
          <button
            onClick={runPortfolioOptimization}
            disabled={isOptimizing || !canOptimize}
            style={{
              padding: '10px 20px',
              fontSize: '12px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: isOptimizing ? '#333' : canOptimize 
                ? 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)' : '#2a2a3a',
              color: '#fff',
              cursor: isOptimizing || !canOptimize ? 'not-allowed' : 'pointer',
              opacity: !canOptimize ? 0.5 : 1,
              boxShadow: canOptimize && !isOptimizing ? '0 4px 15px rgba(0, 212, 255, 0.25)' : 'none',
              fontFamily: FONT_FAMILY,
            }}
          >
            {isOptimizing ? '⏳ Analyzing...' : (
              <>
                {isResultsStale ? '🔄 Re-run Analysis' : '🚀 Run Analysis'}
                <kbd style={{ 
                  marginLeft: '8px', 
                  padding: '2px 6px', 
                  fontSize: '9px', 
                  background: 'rgba(255,255,255,0.15)', 
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontFamily: 'inherit',
                }}>Enter</kbd>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Settings Grid */}
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          {/* Risk-Free Rate */}
          <SettingCard
            label="Risk-Free Rate"
            value={`${(riskFreeRate * 100).toFixed(1)}%`}
            color={COLORS.cyan}
          >
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {[0.02, 0.04, 0.05, 0.06].map(rate => (
                <button
                  key={rate}
                  onClick={() => setRiskFreeRate(rate)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '10px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    border: riskFreeRate === rate ? '1px solid ' + COLORS.cyan : '1px solid rgba(255,255,255,0.08)',
                    background: riskFreeRate === rate ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                    color: riskFreeRate === rate ? COLORS.cyan : '#666',
                    cursor: 'pointer',
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {(rate * 100)}%
                </button>
              ))}
            </div>
          </SettingCard>
          
          {/* Sampling Method */}
          <SettingCard
            label="MC Sampling"
            value={useQmc ? 'Quasi-MC' : 'Standard'}
            color={COLORS.purple}
          >
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              {[{ v: false, l: 'Standard' }, { v: true, l: 'Sobol QMC' }].map(opt => (
                <button
                  key={String(opt.v)}
                  onClick={() => setUseQmc(opt.v)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '10px',
                    fontWeight: '500',
                    borderRadius: '4px',
                    border: useQmc === opt.v ? '1px solid ' + COLORS.purple : '1px solid rgba(255,255,255,0.08)',
                    background: useQmc === opt.v ? 'rgba(155, 89, 182, 0.15)' : 'transparent',
                    color: useQmc === opt.v ? COLORS.purple : '#666',
                    cursor: 'pointer',
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </SettingCard>
          
          {/* Swap Size */}
          <SettingCard
            label="Swap Size"
            value={`${(swapSize * 100).toFixed(1)}%`}
            color={COLORS.orange}
          >
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {[0.005, 0.01, 0.02, 0.05].map(size => (
                <button
                  key={size}
                  onClick={() => setSwapSize(size)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '10px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    border: swapSize === size ? '1px solid ' + COLORS.orange : '1px solid rgba(255,255,255,0.08)',
                    background: swapSize === size ? 'rgba(255, 159, 67, 0.15)' : 'transparent',
                    color: swapSize === size ? COLORS.orange : '#666',
                    cursor: 'pointer',
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {(size * 100)}%
                </button>
              ))}
            </div>
          </SettingCard>
          
          {/* Validation Paths */}
          <SettingCard
            label="MC Validation"
            value={`${(optimizationPaths / 1000).toFixed(0)}K`}
            color={COLORS.green}
          >
            <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
              {[25000, 50000, 100000, 250000].map(paths => (
                <button
                  key={paths}
                  onClick={() => setOptimizationPaths(paths)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    fontSize: '10px',
                    fontWeight: '600',
                    borderRadius: '4px',
                    border: optimizationPaths === paths ? '1px solid ' + COLORS.green : '1px solid rgba(255,255,255,0.08)',
                    background: optimizationPaths === paths ? 'rgba(46, 204, 113, 0.15)' : 'transparent',
                    color: optimizationPaths === paths ? COLORS.green : '#666',
                    cursor: 'pointer',
                    fontFamily: FONT_FAMILY,
                  }}
                >
                  {(paths / 1000)}K
                </button>
              ))}
            </div>
          </SettingCard>
        </div>
        
        {/* Pipeline Visualization */}
        <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '10px' }}>
          <div style={{ fontSize: '9px', color: '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Optimization Pipeline
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {pipeline.map((step, i) => (
              <React.Fragment key={step.label}>
                <div style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{ 
                    fontSize: '16px', 
                    marginBottom: '4px',
                    opacity: isOptimizing && optimizationProgress?.phase?.includes(step.label.toLowerCase()) ? 1 : 0.6,
                  }}>
                    {step.icon}
                  </div>
                  <div style={{ fontSize: '9px', color: '#888', fontWeight: '600' }}>{step.label}</div>
                  <div style={{ fontSize: '8px', color: '#555' }}>{step.desc}</div>
                </div>
                {i < pipeline.length - 1 && (
                  <div style={{ color: '#333', fontSize: '10px', padding: '0 4px' }}>→</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* Progress bar - GPU accelerated */}
        {isOptimizing && (
          <div style={{ marginTop: '12px' }}>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '6px' }}>
              {optimizationProgress?.phase || 'Starting...'}
            </div>
            <div style={{ width: '100%', height: '4px', background: '#1a1a2e', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ 
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #00d4ff, #2ecc71)',
                transform: `scaleX(${(optimizationProgress?.current || 0) / (optimizationProgress?.total || 1)})`,
                transformOrigin: 'left',
                transition: 'transform 0.3s ease',
                willChange: 'transform',
              }} />
            </div>
          </div>
        )}
        
        {!canOptimize && (
          <div style={{ 
            marginTop: '12px',
            padding: '10px 12px', 
            background: 'rgba(255, 159, 67, 0.1)', 
            border: '1px solid rgba(255, 159, 67, 0.2)',
            borderRadius: '6px',
            fontSize: '11px',
            color: COLORS.orange,
          }}>
            ⚠️ Need ≥2 positions + correlation matrix
          </div>
        )}
      </div>
    </div>
  );
});

const SettingCard = memo(({ label, value, color, children }) => (
  <div style={{
    background: 'rgba(0, 0, 0, 0.25)',
    borderRadius: '10px',
    padding: '12px',
    border: '1px solid rgba(255, 255, 255, 0.04)',
  }}>
    <div style={{ fontSize: '9px', color: color, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px', fontWeight: '600' }}>
      {label}
    </div>
    <div style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>
      {value}
    </div>
    {children}
  </div>
));

// ============================================
// EMPTY STATE
// ============================================

const EmptyOptimizeState = memo(({ tickers, hasCorrelation, canOptimize, runPortfolioOptimization }) => (
  <div style={{ 
    padding: '50px 24px', 
    textAlign: 'center', 
    background: 'linear-gradient(135deg, rgba(22, 27, 44, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)',
    borderRadius: '16px',
    border: '1px solid rgba(0, 212, 255, 0.08)',
    fontFamily: FONT_FAMILY,
  }}>
    <div style={{ 
      width: '70px', height: '70px', borderRadius: '16px',
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.15) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '32px', margin: '0 auto 16px',
      border: '1px solid rgba(0, 212, 255, 0.15)',
    }}>
      🎯
    </div>
    <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px', fontWeight: '600' }}>
      Ready to Optimize
    </h3>
    <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '12px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
      Find optimal swap trades that improve your Sharpe ratio using analytical methods validated by Monte Carlo simulation.
    </p>
    
    <div style={{ 
      display: 'inline-flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start', 
      padding: '14px 20px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px', marginBottom: '20px',
    }}>
      {[
        { done: tickers.length >= 2, text: `At least 2 positions (${tickers.length} added)` },
        { done: hasCorrelation, text: 'Compute correlation matrix' },
      ].map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: item.done ? COLORS.green : '#555', fontSize: '12px' }}>
          <div style={{
            width: '20px', height: '20px', borderRadius: '5px',
            background: item.done ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.03)',
            border: item.done ? '1px solid ' + COLORS.green : '1px solid #333',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
          }}>
            {item.done ? '✓' : i + 1}
          </div>
          {item.text}
        </div>
      ))}
    </div>
    
    {canOptimize && (
      <button 
        onClick={runPortfolioOptimization}
        style={{
          padding: '12px 28px', fontSize: '13px', fontWeight: '600', borderRadius: '8px', border: 'none',
          background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
          color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(0, 212, 255, 0.3)',
          fontFamily: FONT_FAMILY,
        }}
      >
        🎯 Run Optimization
      </button>
    )}
  </div>
));

// ============================================
// PORTFOLIO SUMMARY CARD
// ============================================

const PortfolioSummaryCard = memo(({ optimizationResults, fmtPct }) => {
  // Defensive: ensure optimizationResults exists
  if (!optimizationResults || !optimizationResults.current) return null;

  const current = optimizationResults.current;
  const mc = current?.mcResults;
  const lvg = optimizationResults.leverageRatio;
  
  const stats = [
    { label: 'Expected Return', value: fmtPct(current.portfolioReturn), sub: 'annualized μ', color: current.portfolioReturn >= 0 ? COLORS.green : COLORS.red },
    { label: 'Volatility', value: fmtPct(current.portfolioVol), sub: 'annualized σ', color: COLORS.orange },
    { label: 'Sharpe Ratio', value: (current.sharpe ?? 0).toFixed(3), sub: '(μ - Rf) / σ', color: COLORS.cyan },
    { label: 'P(Loss) 1Y', value: fmtPct(mc?.pLoss), sub: 'MC simulated', color: COLORS.red },
    { label: 'VaR 5%', value: fmtPct(mc?.var5), sub: 'worst 5% MC', color: mc?.var5 >= 0 ? COLORS.green : COLORS.red },
    { label: 'CVaR 5%', value: fmtPct(mc?.cvar5), sub: 'expected shortfall', color: mc?.cvar5 >= 0 ? COLORS.green : COLORS.red },
  ];
  
  return (
    <div style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '16px',
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
    }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📊</span> Current Portfolio
        {lvg && lvg !== 1 && (
          <span style={{ fontSize: '10px', color: COLORS.purple, background: 'rgba(155,89,182,0.15)', padding: '2px 8px', borderRadius: '4px' }}>
            {fmtPct(lvg)} exposure
          </span>
        )}
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{
            padding: '12px',
            background: `rgba(${stat.color === COLORS.green ? '46,204,113' : stat.color === COLORS.red ? '231,76,60' : stat.color === COLORS.cyan ? '0,212,255' : stat.color === COLORS.orange ? '255,159,67' : '155,89,182'}, 0.08)`,
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{stat.label}</div>
            <div style={{ fontSize: '8px', color: '#555', marginTop: '1px' }}>{stat.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================
// TOP SWAPS CARD (Premium Redesign)
// ============================================

const TopSwapsCard = memo(({ optimizationResults, fmtPct, fmtChange }) => {
  const [showAll, setShowAll] = useState(true); // Default to showing all
  const [viewMode, setViewMode] = useState('cards'); // 'cards' or 'compact'

  // Defensive: ensure optimizationResults exists
  if (!optimizationResults) return null;

  const topSwaps = optimizationResults.topSwaps || [];
  const top3 = topSwaps.slice(0, 3);
  const remaining = topSwaps.slice(3, 15); // Show up to 15
  
  if (top3.length === 0) return null;
  
  const bestSwap = top3[0];
  const hasBetterSwap = (bestSwap?.deltaMetrics?.deltaMCSharpe || 0) > 0;
  
  // Find max values for visual scaling
  const maxDeltaSharpe = Math.max(...topSwaps.map(s => Math.abs(s.deltaMetrics?.deltaMCSharpe || 0)));
  const maxDeltaPLoss = Math.max(...topSwaps.map(s => Math.abs(s.deltaMetrics?.deltaPLoss || 0)));
  
  // Get rank color gradient
  const getRankColor = (rank) => {
    if (rank <= 3) return COLORS.green;
    if (rank <= 6) return COLORS.cyan;
    if (rank <= 9) return COLORS.blue;
    if (rank <= 12) return COLORS.purple;
    return COLORS.orange;
  };
  
  const getRankGradient = (rank) => {
    if (rank <= 3) return 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(46, 204, 113, 0.05) 100%)';
    if (rank <= 6) return 'linear-gradient(135deg, rgba(0, 212, 255, 0.12) 0%, rgba(0, 212, 255, 0.04) 100%)';
    if (rank <= 9) return 'linear-gradient(135deg, rgba(52, 152, 219, 0.12) 0%, rgba(52, 152, 219, 0.04) 100%)';
    if (rank <= 12) return 'linear-gradient(135deg, rgba(155, 89, 182, 0.12) 0%, rgba(155, 89, 182, 0.04) 100%)';
    return 'linear-gradient(135deg, rgba(255, 159, 67, 0.12) 0%, rgba(255, 159, 67, 0.04) 100%)';
  };
  
  return (
    <div style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '16px',
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>💡</span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff' }}>Recommended Swaps</div>
            <div style={{ fontSize: '9px', color: '#555' }}>
              MC validated • {optimizationResults.pathsPerScenario?.toLocaleString() || '100K'} paths
              {optimizationResults.useQmc && <span style={{ color: COLORS.purple }}> QMC</span>}
            </div>
          </div>
        </div>
        
        {/* View mode toggle */}
        <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', padding: '3px' }}>
          {[
            { mode: 'cards', icon: '▦', label: 'Cards' },
            { mode: 'compact', icon: '≡', label: 'List' },
          ].map(v => (
            <button
              key={v.mode}
              onClick={() => setViewMode(v.mode)}
              style={{
                padding: '5px 10px',
                fontSize: '10px',
                fontWeight: '500',
                borderRadius: '4px',
                border: 'none',
                background: viewMode === v.mode ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                color: viewMode === v.mode ? COLORS.cyan : '#666',
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{v.icon}</span> {v.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Best Trade Hero */}
      {hasBetterSwap && (
        <div style={{ 
          padding: '16px', 
          background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.12) 0%, rgba(0, 212, 255, 0.08) 100%)',
          border: '1px solid rgba(46, 204, 113, 0.25)',
          borderRadius: '12px',
          marginBottom: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative glow */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(46, 204, 113, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
            <div style={{ 
              width: '52px', height: '52px', borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.3) 0%, rgba(46, 204, 113, 0.1) 100%)', 
              border: '1px solid rgba(46,204,113,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
              boxShadow: '0 4px 20px rgba(46, 204, 113, 0.2)',
            }}>
              🏆
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '10px', fontWeight: '600', color: COLORS.green, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                #1 Best Trade
              </div>
              <div style={{ fontSize: '16px', color: '#fff', fontWeight: '600' }}>
                Sell <span style={{ color: COLORS.red, fontWeight: '700' }}>{bestSwap.sellTicker}</span>
                <span style={{ color: '#555', margin: '0 10px', fontSize: '14px' }}>→</span>
                Buy <span style={{ color: COLORS.green, fontWeight: '700' }}>{bestSwap.buyTicker}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: COLORS.green, lineHeight: 1 }}>
                {formatDeltaSharpeBps(bestSwap.deltaMetrics?.deltaMCSharpe, true)} bps
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>ΔSharpe (MC)</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginTop: '14px' }}>
            {[
              { label: 'ΔSharpe', value: formatDeltaSharpeBps(bestSwap.deltaMetrics?.deltaMCSharpe), unit: ' bps', positive: (bestSwap.deltaMetrics?.deltaMCSharpe || 0) > 0 },
              { label: 'ΔP(Loss)', value: (-(bestSwap.deltaMetrics?.deltaPLoss || 0) * 100).toFixed(2), unit: '%', positive: -(bestSwap.deltaMetrics?.deltaPLoss || 0) > 0 },
              { label: 'ΔVaR 5%', value: ((bestSwap.deltaMetrics?.deltaVaR5 || 0) * 100).toFixed(2), unit: '%', positive: (bestSwap.deltaMetrics?.deltaVaR5 || 0) > 0 },
              { label: 'ΔMedian', value: ((bestSwap.deltaMetrics?.deltaMedian || 0) * 100).toFixed(2), unit: '%', positive: (bestSwap.deltaMetrics?.deltaMedian || 0) > 0 },
            ].map((m, i) => (
              <div key={i} style={{ 
                textAlign: 'center', 
                padding: '10px 8px', 
                background: 'rgba(0,0,0,0.25)', 
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <div style={{ 
                  fontSize: '16px', 
                  fontWeight: '700', 
                  color: m.positive ? COLORS.green : COLORS.red,
                  fontFamily: 'monospace',
                }}>
                  {parseFloat(m.value) > 0 ? '+' : ''}{m.value}{m.unit}
                </div>
                <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Top 3 Podium Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {top3.map((swap, i) => {
          const isGood = (swap.deltaMetrics?.deltaMCSharpe || 0) > 0;
          const medals = ['🥇', '🥈', '🥉'];
          const rankColor = getRankColor(i + 1);
          const deltaSharpe = swap.deltaMetrics?.deltaMCSharpe || 0;
          const barWidth = maxDeltaSharpe > 0 ? Math.abs(deltaSharpe) / maxDeltaSharpe * 100 : 0;
          
          return (
            <div key={i} style={{
              padding: '14px',
              background: getRankGradient(i + 1),
              border: `1px solid ${rankColor}20`,
              borderRadius: '10px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Rank badge */}
              <div style={{ 
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '20px',
              }}>
                {medals[i]}
              </div>
              
              <div style={{ fontSize: '10px', color: rankColor, fontWeight: '700', marginBottom: '6px' }}>
                #{i + 1}
              </div>
              
              <div style={{ fontSize: '12px', marginBottom: '8px' }}>
                <span style={{ color: COLORS.red, fontWeight: '600' }}>−{swap.sellTicker}</span>
                <span style={{ color: '#444', margin: '0 6px' }}>→</span>
                <span style={{ color: COLORS.green, fontWeight: '600' }}>+{swap.buyTicker}</span>
              </div>
              
              {/* Delta Sharpe with mini bar */}
              <div style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9px', color: '#666' }}>ΔSharpe</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: isGood ? COLORS.green : COLORS.red, fontFamily: 'monospace' }}>
                    {formatDeltaSharpeBps(deltaSharpe, true)} bps
                  </span>
                </div>
                <div style={{ height: '3px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    width: `${barWidth}%`,
                    background: isGood ? COLORS.green : COLORS.red,
                    borderRadius: '2px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
              
              <div style={{ fontSize: '9px', color: '#555', display: 'flex', gap: '8px' }}>
                <span>ΔP: {fmtChange(swap.deltaMetrics?.deltaPLoss, 1, true)}</span>
                <span>ΔVaR: {fmtChange(swap.deltaMetrics?.deltaVaR5, 1)}</span>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Remaining Swaps */}
      {remaining.length > 0 && (
        <>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            marginBottom: '14px',
            padding: '10px 14px',
            background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.05), transparent, rgba(155, 89, 182, 0.05))',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.03)',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(155, 89, 182, 0.2))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
            }}>
              📊
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '11px', color: '#fff', fontWeight: '600' }}>
                More Opportunities
              </div>
              <div style={{ fontSize: '9px', color: '#666' }}>
                {remaining.length} additional swaps ranked by Monte Carlo ΔSharpe
              </div>
            </div>
            <div style={{ 
              display: 'flex', 
              gap: '6px',
              padding: '4px 8px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
            }}>
              <span style={{ fontSize: '9px', color: COLORS.green }}>
                ✓ {remaining.filter(s => (s.deltaMetrics?.deltaMCSharpe || 0) > 0).length}
              </span>
              <span style={{ fontSize: '9px', color: '#444' }}>|</span>
              <span style={{ fontSize: '9px', color: COLORS.red }}>
                ✗ {remaining.filter(s => (s.deltaMetrics?.deltaMCSharpe || 0) <= 0).length}
              </span>
            </div>
          </div>
          
          {viewMode === 'cards' ? (
            /* Card Grid View - Premium Design */
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
              gap: '12px',
            }}>
              {remaining.map((swap, i) => {
                const rank = i + 4;
                const isGood = (swap.deltaMetrics?.deltaMCSharpe || 0) > 0;
                const rankColor = getRankColor(rank);
                const deltaSharpe = swap.deltaMetrics?.deltaMCSharpe || 0;
                const deltaPLoss = swap.deltaMetrics?.deltaPLoss || 0;
                const barWidth = maxDeltaSharpe > 0 ? Math.abs(deltaSharpe) / maxDeltaSharpe * 100 : 0;
                
                // Tier badges
                const getTierBadge = (r) => {
                  if (r <= 5) return { label: 'A', color: COLORS.green, bg: 'rgba(46, 204, 113, 0.15)' };
                  if (r <= 8) return { label: 'B', color: COLORS.cyan, bg: 'rgba(0, 212, 255, 0.15)' };
                  if (r <= 11) return { label: 'C', color: COLORS.blue, bg: 'rgba(52, 152, 219, 0.15)' };
                  return { label: 'D', color: COLORS.purple, bg: 'rgba(155, 89, 182, 0.15)' };
                };
                const tier = getTierBadge(rank);
                
                return (
                  <div 
                    key={rank} 
                    style={{
                      padding: '14px',
                      background: getRankGradient(rank),
                      border: `1px solid ${rankColor}20`,
                      borderRadius: '12px',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease',
                      cursor: 'default',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-3px) scale(1.01)';
                      e.currentTarget.style.boxShadow = `0 8px 30px ${rankColor}25, 0 0 15px ${rankColor}15`;
                      e.currentTarget.style.borderColor = `${rankColor}40`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                      e.currentTarget.style.borderColor = `${rankColor}20`;
                    }}
                  >
                    {/* Decorative gradient corner */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '60px',
                      height: '60px',
                      background: `radial-gradient(circle at top right, ${rankColor}15, transparent 70%)`,
                      pointerEvents: 'none',
                    }} />
                    
                    {/* Header row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: '700', 
                          color: rankColor,
                          background: `${rankColor}20`,
                          padding: '3px 8px',
                          borderRadius: '5px',
                          border: `1px solid ${rankColor}30`,
                        }}>
                          #{rank}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          fontWeight: '600',
                          color: tier.color,
                          background: tier.bg,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          letterSpacing: '0.5px',
                        }}>
                          TIER {tier.label}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '700',
                        color: isGood ? COLORS.green : COLORS.red,
                        fontFamily: 'monospace',
                        textShadow: isGood ? '0 0 10px rgba(46, 204, 113, 0.3)' : 'none',
                      }}>
                        {formatDeltaSharpeBps(deltaSharpe, true)} bps
                      </span>
                    </div>
                    
                    {/* Trade pair */}
                    <div style={{ 
                      fontSize: '12px', 
                      marginBottom: '10px',
                      padding: '8px 10px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ color: COLORS.red, fontWeight: '600' }}>−{swap.sellTicker}</span>
                      <span style={{ 
                        color: '#555', 
                        fontSize: '14px',
                        background: 'rgba(255,255,255,0.05)',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>→</span>
                      <span style={{ color: COLORS.green, fontWeight: '600' }}>+{swap.buyTicker}</span>
                    </div>
                    
                    {/* Progress bar with glow */}
                    <div style={{ 
                      height: '4px', 
                      background: 'rgba(0,0,0,0.4)', 
                      borderRadius: '2px', 
                      marginBottom: '10px', 
                      overflow: 'hidden',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${barWidth}%`,
                        background: isGood 
                          ? `linear-gradient(90deg, ${COLORS.green}, ${rankColor})` 
                          : `linear-gradient(90deg, ${COLORS.red}, ${COLORS.orange})`,
                        borderRadius: '2px',
                        boxShadow: isGood ? `0 0 8px ${COLORS.green}60` : 'none',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    
                    {/* Metrics row */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: '1fr 1fr', 
                      gap: '6px', 
                      fontSize: '9px',
                    }}>
                      <div style={{ 
                        padding: '6px 8px', 
                        background: 'rgba(0,0,0,0.15)', 
                        borderRadius: '4px',
                        textAlign: 'center',
                      }}>
                        <div style={{ color: '#555', marginBottom: '2px' }}>ΔP(Loss)</div>
                        <div style={{ color: -deltaPLoss > 0 ? COLORS.green : COLORS.red, fontWeight: '600', fontSize: '11px' }}>
                          {-deltaPLoss > 0 ? '+' : ''}{(-deltaPLoss * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div style={{ 
                        padding: '6px 8px', 
                        background: 'rgba(0,0,0,0.15)', 
                        borderRadius: '4px',
                        textAlign: 'center',
                      }}>
                        <div style={{ color: '#555', marginBottom: '2px' }}>ΔVaR 5%</div>
                        <div style={{ fontWeight: '600', fontSize: '11px' }}>
                          {fmtChange(swap.deltaMetrics?.deltaVaR5, 1)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Compact List View */
            <div style={{ 
              background: 'rgba(0,0,0,0.2)', 
              borderRadius: '10px', 
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.05)',
            }}>
              {remaining.map((swap, i) => {
                const rank = i + 4;
                const isGood = (swap.deltaMetrics?.deltaMCSharpe || 0) > 0;
                const rankColor = getRankColor(rank);
                const deltaSharpe = swap.deltaMetrics?.deltaMCSharpe || 0;
                const barWidth = maxDeltaSharpe > 0 ? Math.abs(deltaSharpe) / maxDeltaSharpe * 100 : 0;
                
                return (
                  <div 
                    key={rank}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 1fr 100px 80px 60px',
                      alignItems: 'center',
                      padding: '10px 12px',
                      borderBottom: i < remaining.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                      background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,212,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.1)'}
                  >
                    {/* Rank */}
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '700', 
                      color: rankColor,
                    }}>
                      #{rank}
                    </span>
                    
                    {/* Trade */}
                    <div style={{ fontSize: '11px' }}>
                      <span style={{ color: COLORS.red, fontWeight: '600' }}>−{swap.sellTicker}</span>
                      <span style={{ color: '#444', margin: '0 8px' }}>→</span>
                      <span style={{ color: COLORS.green, fontWeight: '600' }}>+{swap.buyTicker}</span>
                    </div>
                    
                    {/* Mini bar + Delta Sharpe */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${barWidth}%`,
                            background: isGood ? COLORS.green : COLORS.red,
                            borderRadius: '2px',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: isGood ? COLORS.green : COLORS.red,
                          fontFamily: 'monospace',
                          minWidth: '50px',
                          textAlign: 'right',
                        }}>
                          {formatDeltaSharpeBps(deltaSharpe, true)} bps
                        </span>
                      </div>
                    </div>
                    
                    {/* ΔP(Loss) */}
                    <span style={{ fontSize: '10px', textAlign: 'right' }}>
                      {fmtChange(swap.deltaMetrics?.deltaPLoss, 1, true)}
                    </span>
                    
                    {/* ΔVaR */}
                    <span style={{ fontSize: '10px', textAlign: 'right' }}>
                      {fmtChange(swap.deltaMetrics?.deltaVaR5, 1)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Toggle for more swaps if available */}
          {topSwaps.length > 15 && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '12px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '8px',
                color: '#888',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,212,255,0.1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.3)'}
            >
              {showAll ? '▲ Show less' : `▼ Show all ${topSwaps.length} swaps`}
            </button>
          )}
        </>
      )}
      
      {/* Summary footer */}
      <div style={{ 
        marginTop: '14px', 
        padding: '10px 12px', 
        background: 'rgba(0, 212, 255, 0.06)', 
        borderRadius: '8px',
        border: '1px solid rgba(0, 212, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
      }}>
        <div style={{ fontSize: '9px', color: '#888' }}>
          💡 All swaps validated with {optimizationResults.pathsPerScenario?.toLocaleString() || '100K'}-path Monte Carlo
          {optimizationResults.useQmc && <span style={{ color: COLORS.purple }}> (Quasi-Monte Carlo)</span>}
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '9px' }}>
          <span style={{ color: '#666' }}>
            Improving: <span style={{ color: COLORS.green, fontWeight: '600' }}>{topSwaps.filter(s => (s.deltaMetrics?.deltaMCSharpe || 0) > 0).length}</span>
          </span>
          <span style={{ color: '#666' }}>
            Degrading: <span style={{ color: COLORS.red, fontWeight: '600' }}>{topSwaps.filter(s => (s.deltaMetrics?.deltaMCSharpe || 0) < 0).length}</span>
          </span>
        </div>
      </div>
    </div>
  );
});

// ============================================
// RISK CONTRIBUTION CARD
// ============================================

const RiskContributionCard = memo(({ optimizationResults, fmtPct }) => {
  const [sortBy, setSortBy] = useState('iSharpe');
  const [hoveredIdx, setHoveredIdx] = useState(null);

  // Defensive: ensure optimizationResults exists
  if (!optimizationResults) return null;

  const positions = optimizationResults.positions || [];
  const lvgRatio = optimizationResults.leverageRatio || 1;
  
  // Create display labels for duplicate tickers
  const positionsWithLabels = useMemo(() => {
    const tickerCounts = {};
    const tickerIndices = {};
    
    // First pass: count occurrences
    positions.forEach(p => {
      const t = p.ticker;
      tickerCounts[t] = (tickerCounts[t] || 0) + 1;
    });
    
    // Second pass: assign labels
    return positions.map((p, idx) => {
      const t = p.ticker;
      if (tickerCounts[t] > 1) {
        tickerIndices[t] = (tickerIndices[t] || 0) + 1;
        return { ...p, displayLabel: `${t} #${tickerIndices[t]}`, idx };
      }
      return { ...p, displayLabel: t, idx };
    });
  }, [positions]);
  
  const sortedPositions = useMemo(() => {
    return [...positionsWithLabels].sort((a, b) => {
      if (sortBy === 'iSharpe') return (b.iSharpe || 0) - (a.iSharpe || 0);
      if (sortBy === 'risk') return (b.riskContribution || 0) - (a.riskContribution || 0);
      if (sortBy === 'weight') return (b.weight || 0) - (a.weight || 0);
      return 0;
    });
  }, [positionsWithLabels, sortBy]);
  
  const barColors = ['#00d4ff', '#2ecc71', '#ff9f43', '#e74c3c', '#9b59b6', '#3498db', '#1abc9c', '#f39c12', '#e67e22', '#95a5a6'];
  
  // Filtered positions for the bar (only those with >0.5% risk)
  const barPositions = sortedPositions.filter(p => (p.riskContribution || 0) > 0.005);
  
  return (
    <div style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '16px',
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📈</span> Risk Contribution
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[{ k: 'iSharpe', l: 'iSharpe' }, { k: 'risk', l: '%Risk' }, { k: 'weight', l: 'Weight' }].map(s => (
            <button
              key={s.k}
              onClick={() => setSortBy(s.k)}
              style={{
                padding: '4px 8px',
                fontSize: '9px',
                borderRadius: '4px',
                border: sortBy === s.k ? '1px solid ' + COLORS.cyan : '1px solid rgba(255,255,255,0.08)',
                background: sortBy === s.k ? 'rgba(0, 212, 255, 0.15)' : 'transparent',
                color: sortBy === s.k ? COLORS.cyan : '#666',
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
              }}
            >
              {s.l}
            </button>
          ))}
        </div>
      </div>
      
      {/* Risk Bar with Tooltips */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '9px', color: '#555', marginBottom: '6px', textTransform: 'uppercase' }}>
          Risk Contribution by Position
        </div>
        <div style={{ display: 'flex', height: '32px', borderRadius: '6px', overflow: 'visible', position: 'relative' }}>
          {barPositions.map((pos, i) => {
            const isHovered = hoveredIdx === i;
            const weightNLV = (pos.weight || 0) * lvgRatio;
            return (
              <div 
                key={`bar-${pos.idx}`}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ 
                  width: `${(pos.riskContribution || 0) * 100}%`,
                  height: '100%',
                  background: barColors[i % barColors.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '8px',
                  fontWeight: 'bold',
                  color: '#fff',
                  minWidth: (pos.riskContribution || 0) > 0.06 ? '24px' : '0',
                  borderRight: '1px solid rgba(0,0,0,0.3)',
                  position: 'relative',
                  cursor: 'pointer',
                  transform: isHovered ? 'scaleY(1.15)' : 'scaleY(1)',
                  filter: isHovered ? 'brightness(1.2)' : 'brightness(1)',
                  zIndex: isHovered ? 10 : 1,
                  transition: 'transform 0.15s, filter 0.15s',
                }}
              >
                {(pos.riskContribution || 0) > 0.08 ? pos.displayLabel : ''}
                
                {/* Tooltip */}
                {isHovered && (
                  <div style={{
                    position: 'absolute',
                    bottom: '110%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(15, 15, 30, 0.98)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    whiteSpace: 'nowrap',
                    zIndex: 100,
                    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                    minWidth: '140px',
                  }}>
                    <div style={{ fontWeight: '700', fontSize: '12px', marginBottom: '6px', color: barColors[i % barColors.length] }}>
                      {pos.displayLabel}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 12px', fontSize: '10px' }}>
                      <span style={{ color: '#888' }}>Risk:</span>
                      <span style={{ color: '#fff', fontWeight: '600' }}>{fmtPct(pos.riskContribution)}</span>
                      <span style={{ color: '#888' }}>Weight:</span>
                      <span style={{ color: '#fff', fontWeight: '600' }}>{fmtPct(weightNLV)}</span>
                      <span style={{ color: '#888' }}>iSharpe:</span>
                      <span style={{ color: (pos.iSharpe || 0) > 0 ? COLORS.green : (pos.iSharpe || 0) < 0 ? COLORS.red : '#888', fontWeight: '600' }}>
                        {formatDeltaSharpeBps(pos.iSharpe, true)} bps
                      </span>
                      <span style={{ color: '#888' }}>μ:</span>
                      <span style={{ color: (pos.mu || 0) >= 0 ? COLORS.green : COLORS.red }}>{fmtPct(pos.mu)}</span>
                      <span style={{ color: '#888' }}>σ:</span>
                      <span style={{ color: COLORS.orange }}>{fmtPct(pos.sigma)}</span>
                    </div>
                    {/* Arrow */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-6px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '6px solid transparent',
                      borderRight: '6px solid transparent',
                      borderTop: '6px solid rgba(15, 15, 30, 0.98)',
                    }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {barPositions.map((pos, i) => (
            <div 
              key={`legend-${pos.idx}`} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '3px', 
                fontSize: '9px',
                opacity: hoveredIdx !== null && hoveredIdx !== i ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: barColors[i % barColors.length] }} />
              <span style={{ color: '#888' }}>{pos.displayLabel}</span>
              <span style={{ color: '#555' }}>{fmtPct(pos.riskContribution)}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a2a3a', background: 'rgba(0,0,0,0.2)' }}>
              <th style={{ padding: '8px 6px', textAlign: 'left', color: '#666' }}>Ticker</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', color: '#666' }}>Weight</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', color: '#666' }}>μ</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', color: '#666' }}>σ</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', color: '#666' }}>MCTR</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', color: '#666' }}>%Risk</th>
              <th style={{ padding: '8px 6px', textAlign: 'right', color: '#666' }}>iSharpe</th>
              <th style={{ padding: '8px 6px', textAlign: 'center', color: '#666' }}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((pos) => {
              const isPositive = (pos.iSharpe || 0) > 0.01;
              const isNegative = (pos.iSharpe || 0) < -0.01;
              const weightNLV = (pos.weight || 0) * lvgRatio;
              return (
                <tr key={`row-${pos.idx}`} style={{ 
                  borderBottom: '1px solid #1a1a2a',
                  background: isPositive ? 'rgba(46, 204, 113, 0.04)' : isNegative ? 'rgba(231, 76, 60, 0.04)' : 'transparent',
                }}>
                  <td style={{ padding: '8px 6px', fontWeight: '600' }}>{pos.displayLabel}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtPct(weightNLV)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: (pos.mu || 0) >= 0 ? COLORS.green : COLORS.red }}>{fmtPct(pos.mu)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', color: COLORS.orange }}>{fmtPct(pos.sigma)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtPct(pos.mctr)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right' }}>{fmtPct(pos.riskContribution)}</td>
                  <td style={{ padding: '8px 6px', textAlign: 'right', fontWeight: '600', color: isPositive ? COLORS.green : isNegative ? COLORS.red : '#666' }}>
                    {formatDeltaSharpeBps(pos.iSharpe, true)} bps
                  </td>
                  <td style={{ padding: '8px 6px', textAlign: 'center', fontSize: '11px' }}>
                    {isPositive && <span title="Consider adding">⬆️</span>}
                    {isNegative && <span title="Consider reducing">⬇️</span>}
                    {!isPositive && !isNegative && <span title="Neutral">➖</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(255, 159, 67, 0.08)', borderRadius: '6px', fontSize: '9px', color: COLORS.orange, border: '1px solid rgba(255, 159, 67, 0.15)' }}>
        ⚠️ Mean-variance metrics don't capture fat tails. Use MC-validated swaps for actual trades.
      </div>
    </div>
  );
});

// ============================================
// SWAP HEATMAP CARD (Enhanced with Tooltip)
// ============================================

const SwapHeatmapCard = memo(({ swapMatrix, isAnalytical, getHeatmapColor, pathsPerScenario }) => {
  const matrix = swapMatrix;
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const cardRef = useRef(null);
  const tableContainerRef = useRef(null);
  
  if (!matrix || !matrix.tickers || !Array.isArray(matrix.tickers)) return null;

  const n = matrix.tickers.length;
  const maxDelta = Math.max(...matrix.deltaSharpe.flat().map(Math.abs));
  const maxDeltaVol = Math.max(...matrix.deltaVol.flat().map(Math.abs));
  
  // Compute summary statistics
  const allSwaps = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        allSwaps.push({
          sell: matrix.tickers[i],
          buy: matrix.tickers[j],
          sellIdx: i,
          buyIdx: j,
          deltaSharpe: matrix.deltaSharpe[i][j],
          deltaVol: matrix.deltaVol[i][j],
          deltaReturn: matrix.deltaReturn[i][j],
        });
      }
    }
  }
  
  // Sort for best/worst
  const sortedByDelta = [...allSwaps].sort((a, b) => b.deltaSharpe - a.deltaSharpe);
  const bestSwap = sortedByDelta[0];
  const worstSwap = sortedByDelta[sortedByDelta.length - 1];
  const positiveSwaps = allSwaps.filter(s => s.deltaSharpe > 0.0001);
  const negativeSwaps = allSwaps.filter(s => s.deltaSharpe < -0.0001);
  const avgPositive = positiveSwaps.length > 0 
    ? positiveSwaps.reduce((sum, s) => sum + s.deltaSharpe, 0) / positiveSwaps.length 
    : 0;
  
  // Per-ticker aggregates: best swap to buy INTO this ticker, best swap to sell FROM this ticker
  const bestBuyInto = matrix.tickers.map((ticker, buyIdx) => {
    let best = { delta: -Infinity, from: null };
    for (let sellIdx = 0; sellIdx < n; sellIdx++) {
      if (sellIdx !== buyIdx && matrix.deltaSharpe[sellIdx][buyIdx] > best.delta) {
        best = { delta: matrix.deltaSharpe[sellIdx][buyIdx], from: matrix.tickers[sellIdx] };
      }
    }
    return best;
  });
  
  const bestSellFrom = matrix.tickers.map((ticker, sellIdx) => {
    let best = { delta: -Infinity, to: null };
    for (let buyIdx = 0; buyIdx < n; buyIdx++) {
      if (sellIdx !== buyIdx && matrix.deltaSharpe[sellIdx][buyIdx] > best.delta) {
        best = { delta: matrix.deltaSharpe[sellIdx][buyIdx], to: matrix.tickers[buyIdx] };
      }
    }
    return best;
  });
  
  // Row averages (avg delta when selling this ticker)
  const rowAvgs = matrix.tickers.map((_, sellIdx) => {
    let sum = 0, count = 0;
    for (let buyIdx = 0; buyIdx < n; buyIdx++) {
      if (sellIdx !== buyIdx) { sum += matrix.deltaSharpe[sellIdx][buyIdx]; count++; }
    }
    return count > 0 ? sum / count : 0;
  });
  
  // Col averages (avg delta when buying this ticker)
  const colAvgs = matrix.tickers.map((_, buyIdx) => {
    let sum = 0, count = 0;
    for (let sellIdx = 0; sellIdx < n; sellIdx++) {
      if (sellIdx !== buyIdx) { sum += matrix.deltaSharpe[sellIdx][buyIdx]; count++; }
    }
    return count > 0 ? sum / count : 0;
  });
  
  // Compute dynamic cell width based on ticker count for better scaling
  const baseCellWidth = n <= 6 ? 56 : n <= 10 ? 48 : 42;
  const tableMinWidth = (n + 2) * baseCellWidth; // +2 for row headers and summary col
  
  // Handle cell hover
  const handleCellHover = (e, sellIdx, buyIdx) => {
    if (sellIdx === buyIdx) {
      setHoveredCell(null);
      return;
    }
    
    const rect = e.currentTarget.getBoundingClientRect();
    const cardRect = cardRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    
    setTooltipPos({
      x: rect.left - cardRect.left + rect.width / 2,
      y: rect.top - cardRect.top - 8,
    });
    
    setHoveredCell({ sellIdx, buyIdx });
  };
  
  // Get rank of a swap
  const getSwapRank = (sellIdx, buyIdx) => {
    const idx = sortedByDelta.findIndex(s => s.sellIdx === sellIdx && s.buyIdx === buyIdx);
    return idx + 1;
  };
  
  return (
    <div 
      ref={cardRef}
      style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '16px',
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
      position: 'relative',
      overflow: 'visible', // Allow tooltip to overflow above
    }}>
      {/* Header with title and summary stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🔥</span> Portfolio Position Swap Heatmap
            {isAnalytical && (
              <span style={{
                fontSize: '9px',
                padding: '2px 6px',
                background: 'rgba(155, 89, 182, 0.2)',
                border: '1px solid rgba(155, 89, 182, 0.3)',
                borderRadius: '4px',
                color: COLORS.purple,
                fontWeight: '500',
              }}>
                ANALYTICAL
              </span>
            )}
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            ΔSharpe from 1% swap between portfolio positions. Hover cells for details.
            {isAnalytical && <span style={{ color: '#888', marginLeft: '4px' }}>(Run analysis for MC validation)</span>}
          </div>
        </div>
        
        {/* Quick stats badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ 
            padding: '6px 10px', 
            background: 'rgba(46, 204, 113, 0.1)', 
            border: '1px solid rgba(46, 204, 113, 0.2)', 
            borderRadius: '6px',
            fontSize: '10px',
          }}>
            <span style={{ color: '#666' }}>Improving:</span>
            <span style={{ color: COLORS.green, fontWeight: '600', marginLeft: '4px' }}>{positiveSwaps.length}</span>
          </div>
          <div style={{ 
            padding: '6px 10px', 
            background: 'rgba(231, 76, 60, 0.1)', 
            border: '1px solid rgba(231, 76, 60, 0.2)', 
            borderRadius: '6px',
            fontSize: '10px',
          }}>
            <span style={{ color: '#666' }}>Degrading:</span>
            <span style={{ color: COLORS.red, fontWeight: '600', marginLeft: '4px' }}>{negativeSwaps.length}</span>
          </div>
          <div style={{ 
            padding: '6px 10px', 
            background: 'rgba(0, 212, 255, 0.1)', 
            border: '1px solid rgba(0, 212, 255, 0.2)', 
            borderRadius: '6px',
            fontSize: '10px',
          }}>
            <span style={{ color: '#666' }}>Max Δ:</span>
            <span style={{ color: COLORS.cyan, fontWeight: '600', marginLeft: '4px' }}>
              {bestSwap ? `+${Math.round(bestSwap.deltaSharpe * 10000)} bps` : '-'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Best/Worst swap callout */}
      {bestSwap && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '10px', 
          marginBottom: '14px',
        }}>
          <div style={{ 
            padding: '10px 12px', 
            background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.08) 0%, rgba(46, 204, 113, 0.02) 100%)', 
            border: '1px solid rgba(46, 204, 113, 0.15)', 
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '9px', color: COLORS.green, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              🏆 Best Swap
            </div>
            <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
              Sell {bestSwap.sell} → Buy {bestSwap.buy}
            </div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
              ΔSharpe: <span style={{ color: COLORS.green }}>+{Math.round(bestSwap.deltaSharpe * 10000)} bps</span>
              <span style={{ margin: '0 6px', color: '#444' }}>|</span>
              ΔVol: <span style={{ color: bestSwap.deltaVol < 0 ? COLORS.green : COLORS.orange }}>
                {(bestSwap.deltaVol * 100).toFixed(2)}%
              </span>
            </div>
          </div>
          
          <div style={{ 
            padding: '10px 12px', 
            background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.08) 0%, rgba(231, 76, 60, 0.02) 100%)', 
            border: '1px solid rgba(231, 76, 60, 0.15)', 
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '9px', color: COLORS.red, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              ⚠️ Worst Swap
            </div>
            <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
              Sell {worstSwap.sell} → Buy {worstSwap.buy}
            </div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
              ΔSharpe: <span style={{ color: COLORS.red }}>{Math.round(worstSwap.deltaSharpe * 10000)} bps</span>
              <span style={{ margin: '0 6px', color: '#444' }}>|</span>
              ΔVol: <span style={{ color: worstSwap.deltaVol > 0 ? COLORS.red : COLORS.green }}>
                {worstSwap.deltaVol > 0 ? '+' : ''}{(worstSwap.deltaVol * 100).toFixed(2)}%
              </span>
            </div>
          </div>
          
          {avgPositive > 0 && (
            <div style={{ 
              padding: '10px 12px', 
              background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.08) 0%, rgba(155, 89, 182, 0.02) 100%)', 
              border: '1px solid rgba(155, 89, 182, 0.15)', 
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '9px', color: COLORS.purple, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                📊 Avg Improvement
              </div>
              <div style={{ fontSize: '12px', color: '#fff', fontWeight: '600' }}>
                +{(avgPositive * 100).toFixed(3)} ΔSharpe
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                Across {positiveSwaps.length} positive swaps
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px', 
        marginBottom: '12px',
        padding: '8px 10px',
        background: 'rgba(0,0,0,0.2)',
        borderRadius: '6px',
        fontSize: '10px',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#666', fontWeight: '600' }}>Scale:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(46, 204, 113, 0.65)' }} />
          <span style={{ color: COLORS.green }}>Better</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: 'rgba(231, 76, 60, 0.65)' }} />
          <span style={{ color: COLORS.red }}>Worse</span>
        </div>
        <span style={{ color: '#444' }}>|</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '2px', border: '2px solid #f1c40f', background: 'transparent' }} />
          <span style={{ color: '#f1c40f' }}>Best</span>
        </div>
        <span style={{ color: '#444' }}>|</span>
        <span style={{ color: '#666' }}>Row = Sell, Column = Buy</span>
        <span style={{ color: '#444' }}>|</span>
        <span style={{ color: '#555' }}>Σ = Row/Col average</span>
      </div>
      
      {/* Styled Tooltip - rendered at card level for proper overflow */}
      {hoveredCell && (
        <div 
          style={{
            position: 'absolute',
            left: Math.max(110, Math.min(tooltipPos.x, (cardRef.current?.offsetWidth || 400) - 110)),
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
            background: 'linear-gradient(135deg, rgba(30, 35, 55, 0.98) 0%, rgba(20, 25, 40, 0.98) 100%)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '10px',
            padding: '12px 14px',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(0, 212, 255, 0.15)',
            minWidth: '200px',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%) rotate(45deg)',
            width: '12px',
            height: '12px',
            background: 'rgba(25, 30, 45, 0.98)',
            borderRight: '1px solid rgba(0, 212, 255, 0.3)',
            borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
          }} />
          
          {(() => {
            const { sellIdx, buyIdx } = hoveredCell;
            const sellTicker = matrix.tickers[sellIdx];
            const buyTicker = matrix.tickers[buyIdx];
            const delta = matrix.deltaSharpe[sellIdx][buyIdx];
            const deltaVol = matrix.deltaVol[sellIdx][buyIdx];
            const deltaReturn = matrix.deltaReturn[sellIdx][buyIdx];
            const rank = getSwapRank(sellIdx, buyIdx);
            const totalSwaps = n * (n - 1);
            const isTop3 = rank <= 3;
            const isBottom3 = rank > totalSwaps - 3;
            
            return (
              <>
                {/* Header */}
                <div style={{ 
                  fontSize: '11px', 
                  fontWeight: '700', 
                  color: '#fff', 
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{ color: COLORS.red }}>−{sellTicker}</span>
                  <span style={{ color: '#555' }}>→</span>
                  <span style={{ color: COLORS.green }}>+{buyTicker}</span>
                  {isTop3 && <span style={{ fontSize: '9px', background: 'rgba(46,204,113,0.2)', color: COLORS.green, padding: '2px 6px', borderRadius: '4px' }}>Top {rank}</span>}
                  {isBottom3 && <span style={{ fontSize: '9px', background: 'rgba(231,76,60,0.2)', color: COLORS.red, padding: '2px 6px', borderRadius: '4px' }}>Bottom {totalSwaps - rank + 1}</span>}
                </div>
                
                {/* Metrics Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div style={{ 
                    padding: '8px', 
                    background: delta > 0 ? 'rgba(46, 204, 113, 0.1)' : delta < 0 ? 'rgba(231, 76, 60, 0.1)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '700', 
                      color: delta > 0 ? COLORS.green : delta < 0 ? COLORS.red : '#888',
                      fontFamily: 'monospace',
                    }}>
                      {delta > 0 ? '+' : ''}{Math.round(delta * 10000)} bps
                    </div>
                    <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>ΔSharpe</div>
                  </div>
                  
                  <div style={{ 
                    padding: '8px', 
                    background: deltaVol < 0 ? 'rgba(46, 204, 113, 0.1)' : deltaVol > 0 ? 'rgba(255, 159, 67, 0.1)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '700', 
                      color: deltaVol < 0 ? COLORS.green : deltaVol > 0 ? COLORS.orange : '#888',
                      fontFamily: 'monospace',
                    }}>
                      {deltaVol > 0 ? '+' : ''}{(deltaVol * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>ΔVolatility</div>
                  </div>
                  
                  <div style={{ 
                    padding: '8px', 
                    background: deltaReturn > 0 ? 'rgba(46, 204, 113, 0.1)' : deltaReturn < 0 ? 'rgba(231, 76, 60, 0.1)' : 'rgba(255,255,255,0.03)',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '700', 
                      color: deltaReturn > 0 ? COLORS.green : deltaReturn < 0 ? COLORS.red : '#888',
                      fontFamily: 'monospace',
                    }}>
                      {deltaReturn > 0 ? '+' : ''}{(deltaReturn * 100).toFixed(2)}%
                    </div>
                    <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>ΔReturn</div>
                  </div>
                  
                  <div style={{ 
                    padding: '8px', 
                    background: 'rgba(155, 89, 182, 0.1)',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: '700', 
                      color: COLORS.purple,
                      fontFamily: 'monospace',
                    }}>
                      #{rank}
                    </div>
                    <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>of {totalSwaps} swaps</div>
                  </div>
                </div>
                
                {/* Interpretation */}
                <div style={{ 
                  marginTop: '10px', 
                  fontSize: '9px', 
                  color: '#888',
                  padding: '6px 8px',
                  background: 'rgba(0,0,0,0.2)',
                  borderRadius: '4px',
                }}>
                  {delta > 0.001 ? (
                    <span>
                      <span style={{ color: COLORS.green }}>✓</span> Improves risk-adjusted return
                      {deltaVol < 0 && <span> with lower volatility</span>}
                    </span>
                  ) : delta < -0.001 ? (
                    <span>
                      <span style={{ color: COLORS.red }}>✗</span> Degrades portfolio efficiency
                    </span>
                  ) : (
                    <span>
                      <span style={{ color: '#666' }}>○</span> Negligible impact
                    </span>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
      
      {/* Main heatmap table with dynamic width */}
      <div ref={tableContainerRef} style={{ overflowX: 'auto', position: 'relative' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '2px', fontSize: '10px', width: '100%', minWidth: `${tableMinWidth}px`, fontFamily: "'JetBrains Mono', monospace" }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 10px',
                textAlign: 'left',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '6px',
                color: '#666',
                minWidth: `${baseCellWidth}px`,
                position: 'sticky',
                left: 0,
                zIndex: 2,
              }}>
                Sell↓ Buy→
              </th>
              {matrix.tickers.map((t, idx) => (
                <th key={`header-${idx}`} style={{
                  padding: '8px 10px',
                  textAlign: 'center',
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: '6px',
                  minWidth: `${baseCellWidth}px`,
                  color: '#888',
                }}>
                  {t}
                </th>
              ))}
              <th style={{
                padding: '8px 10px',
                textAlign: 'center',
                borderLeft: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(155, 89, 182, 0.15)',
                borderRadius: '6px',
                minWidth: `${baseCellWidth}px`,
                color: COLORS.purple,
                fontSize: '9px',
              }}>
                Σ Sell
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.tickers.map((sellTicker, sellIdx) => (
              <tr key={`row-${sellIdx}`}>
                <td style={{
                  padding: '8px 10px',
                  fontWeight: '600',
                  fontSize: '11px',
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: '6px',
                  color: '#aaa',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                }}>
                  {sellTicker}
                </td>
                {matrix.tickers.map((buyTicker, buyIdx) => {
                  const delta = matrix.deltaSharpe[sellIdx][buyIdx];
                  const deltaVol = matrix.deltaVol[sellIdx][buyIdx];
                  const isSame = sellIdx === buyIdx;
                  const isBest = bestSwap && sellIdx === bestSwap.sellIdx && buyIdx === bestSwap.buyIdx;
                  const isHovered = hoveredCell && hoveredCell.sellIdx === sellIdx && hoveredCell.buyIdx === buyIdx;
                  return (
                    <td
                      key={`cell-${sellIdx}-${buyIdx}`}
                      onMouseEnter={(e) => handleCellHover(e, sellIdx, buyIdx)}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        padding: '8px 10px',
                        textAlign: 'center',
                        background: isSame ? 'rgba(255,255,255,0.08)' : getHeatmapColor(delta, maxDelta),
                        borderRadius: '6px',
                        color: isSame ? '#666' : (delta > 0 ? COLORS.green : delta < 0 ? COLORS.red : '#555'),
                        fontWeight: Math.abs(delta) > maxDelta * 0.5 ? '600' : '500',
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        // Best swap gets gold/yellow outline, hovered gets cyan
                        outline: isHovered ? `2px solid ${COLORS.cyan}` : isBest ? `2px solid #f1c40f` : 'none',
                        outlineOffset: '-2px',
                        boxShadow: isHovered ? `0 0 12px ${COLORS.cyan}60` : isBest ? `0 0 8px rgba(241, 196, 15, 0.4)` : 'none',
                        cursor: isSame ? 'default' : 'pointer',
                        transition: 'all 0.2s ease',
                        position: 'relative',
                        zIndex: isHovered ? 5 : 'auto',
                      }}
                    >
                      {isSame ? '—' : (delta > 0 ? '+' : '') + (delta * 100).toFixed(1)}
                    </td>
                  );
                })}
                {/* Row average (avg when selling this ticker) */}
                <td style={{
                  padding: '8px 10px',
                  textAlign: 'center',
                  borderLeft: '2px solid rgba(255, 255, 255, 0.1)',
                  background: rowAvgs[sellIdx] > 0 ? 'rgba(46, 204, 113, 0.12)' : rowAvgs[sellIdx] < 0 ? 'rgba(231, 76, 60, 0.12)' : 'rgba(0,0,0,0.15)',
                  borderRadius: '6px',
                  color: rowAvgs[sellIdx] > 0 ? COLORS.green : rowAvgs[sellIdx] < 0 ? COLORS.red : '#555',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  fontWeight: '500',
                }}>
                  {(rowAvgs[sellIdx] > 0 ? '+' : '') + (rowAvgs[sellIdx] * 100).toFixed(1)}
                </td>
              </tr>
            ))}
            {/* Column averages row */}
            <tr>
              <td style={{
                padding: '8px 10px',
                fontWeight: '600',
                borderTop: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(155, 89, 182, 0.15)',
                borderRadius: '6px',
                color: COLORS.purple,
                fontSize: '9px',
                position: 'sticky',
                left: 0,
                zIndex: 1,
              }}>
                Σ Buy
              </td>
              {colAvgs.map((avg, idx) => (
                <td
                  key={idx}
                  style={{
                    padding: '8px 10px',
                    textAlign: 'center',
                    borderTop: '2px solid rgba(255, 255, 255, 0.1)',
                    background: avg > 0 ? 'rgba(46, 204, 113, 0.12)' : avg < 0 ? 'rgba(231, 76, 60, 0.12)' : 'rgba(0,0,0,0.15)',
                    borderRadius: '6px',
                    color: avg > 0 ? COLORS.green : avg < 0 ? COLORS.red : '#555',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: '500',
                  }}
                >
                  {(avg > 0 ? '+' : '') + (avg * 100).toFixed(1)}
                </td>
              ))}
              <td style={{
                padding: '8px 10px',
                borderTop: '2px solid rgba(255, 255, 255, 0.1)',
                borderLeft: '2px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: '6px',
              }} />
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Position-level insights */}
      <div style={{ marginTop: '14px' }}>
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px', fontWeight: '600' }}>
          Per-Position Best Trades:
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
          gap: '8px',
        }}>
          {matrix.tickers.map((ticker, idx) => {
            const buyBest = bestBuyInto[idx];
            const sellBest = bestSellFrom[idx];
            const showBuy = buyBest.delta > 0.0001;
            const showSell = sellBest.delta > 0.0001;
            if (!showBuy && !showSell) return null;
            
            return (
              <div 
                key={`position-${idx}`}
                style={{ 
                  padding: '8px 10px', 
                  background: 'rgba(0,0,0,0.2)', 
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>
                  {ticker}
                </div>
                {showBuy && (
                  <div style={{ fontSize: '10px', color: '#888' }}>
                    <span style={{ color: COLORS.green }}>↑ Buy from {buyBest.from}:</span>{' '}
                    <span style={{ color: COLORS.green }}>+{(buyBest.delta * 100).toFixed(2)}</span>
                  </div>
                )}
                {showSell && (
                  <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                    <span style={{ color: COLORS.orange }}>↓ Sell into {sellBest.to}:</span>{' '}
                    <span style={{ color: COLORS.green }}>+{(sellBest.delta * 100).toFixed(2)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Footer note */}
      <div style={{ 
        marginTop: '12px', 
        padding: '8px 10px', 
        background: 'rgba(0, 212, 255, 0.06)', 
        borderRadius: '6px', 
        fontSize: '9px', 
        color: '#666',
        border: '1px solid rgba(0, 212, 255, 0.1)',
      }}>
        💡 <span style={{ color: '#888' }}>These are analytical estimates using mean-variance optimization.</span>
        {' '}The top swaps above are validated with {pathsPerScenario ? `${(pathsPerScenario/1000).toFixed(0)}K` : ''}-path Monte Carlo simulations for accuracy.
        {' '}<span style={{ color: COLORS.cyan }}>Σ columns show average improvement potential.</span>
      </div>
    </div>
  );
});

// ============================================
// RISK PARITY CARD
// ============================================

const RiskParityCard = memo(({ optimizationResults, fmtPct }) => {
  // Defensive: ensure optimizationResults exists
  if (!optimizationResults) return null;

  const rp = optimizationResults.riskParity;
  if (!rp) return null;
  
  const lvgRatio = optimizationResults.leverageRatio || 1;
  const weightChanges = rp.weightChanges || [];
  const sortedChanges = [...weightChanges].sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  
  return (
    <div style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '16px',
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
    }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>⚖️</span> Risk Parity Target
        <span style={{ fontSize: '9px', color: '#555', fontWeight: '400' }}>
          Equal risk contribution per position
        </span>
      </div>
      
      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {[
          { label: 'RP Sharpe', value: (rp.sharpe ?? 0).toFixed(3), color: COLORS.purple },
          { label: 'ΔSharpe', value: `${(rp.deltaSharpe || 0) > 0 ? '+' : ''}${Math.round((rp.deltaSharpe ?? 0) * 10000)} bps`, color: (rp.deltaSharpe || 0) > 0 ? COLORS.green : COLORS.red },
          { label: 'RP Vol', value: fmtPct(rp.portfolioVol), color: COLORS.orange },
        ].map((s, i) => (
          <div key={i} style={{ padding: '10px', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>
      
      {/* Weight Changes */}
      <div style={{ fontSize: '10px', color: '#666', marginBottom: '8px' }}>Weight Adjustments (% NLV):</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '8px' }}>
        {sortedChanges.map((wc, wcIdx) => {
          const currentNLV = wc.current * lvgRatio;
          const targetNLV = wc.target * lvgRatio;
          const changeNLV = wc.change * lvgRatio;
          const isIncrease = changeNLV > 0.01;
          const isDecrease = changeNLV < -0.01;
          return (
            <div 
              key={`wc-${wcIdx}`}
              style={{ 
                padding: '8px', 
                background: isIncrease ? 'rgba(46, 204, 113, 0.08)' : isDecrease ? 'rgba(231, 76, 60, 0.08)' : 'rgba(255,255,255,0.03)',
                borderRadius: '6px',
                border: isIncrease ? '1px solid rgba(46, 204, 113, 0.15)' : isDecrease ? '1px solid rgba(231, 76, 60, 0.15)' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <div style={{ fontWeight: '600', marginBottom: '2px', fontSize: '11px' }}>{wc.ticker}</div>
              <div style={{ fontSize: '9px', color: '#666' }}>
                {fmtPct(currentNLV)} → {fmtPct(targetNLV)}
              </div>
              <div style={{ fontSize: '11px', fontWeight: '600', color: isIncrease ? COLORS.green : isDecrease ? COLORS.red : '#666', marginTop: '2px' }}>
                {isIncrease ? '↑' : isDecrease ? '↓' : '='} {fmtPct(Math.abs(changeNLV))}
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{ marginTop: '10px', padding: '8px 10px', background: 'rgba(255, 159, 67, 0.08)', borderRadius: '6px', fontSize: '9px', color: COLORS.orange, border: '1px solid rgba(255, 159, 67, 0.15)' }}>
        ⚠️ Risk parity uses covariance-based risk. Equal risk ≠ optimal for all strategies.
      </div>
    </div>
  );
});

export default OptimizeTab;
