import React, { memo, useState } from 'react';

/**
 * FactorsTab - Factor Analysis Tab Component (v2.0 Premium Refresh)
 * 
 * Premium UI/UX redesign matching Optimize and Positions tabs:
 * - Design system integration (COLORS, FONT_FAMILY)
 * - Gradient backgrounds and premium cards
 * - GPU-accelerated animations
 * - Micro-interactions and hover effects
 * - Enhanced data visualizations
 */

// ============================================
// DESIGN SYSTEM
// ============================================

const COLORS = {
  cyan: '#00d4ff',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#ff9f43',
  purple: '#9b59b6',
  blue: '#3498db',
  gold: '#f1c40f',
};

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// Thematic ETF definitions
const THEMATIC_ETFS = {
  // Sectors
  XLK: { name: 'Technology', category: 'sector' },
  XLF: { name: 'Financials', category: 'sector' },
  XLE: { name: 'Energy', category: 'sector' },
  XLV: { name: 'Healthcare', category: 'sector' },
  XLI: { name: 'Industrials', category: 'sector' },
  XLY: { name: 'Consumer Disc.', category: 'sector' },
  XLP: { name: 'Consumer Staples', category: 'sector' },
  XLU: { name: 'Utilities', category: 'sector' },
  XLRE: { name: 'Real Estate', category: 'sector' },
  XLC: { name: 'Comm Services', category: 'sector' },
  XLB: { name: 'Materials', category: 'sector' },
  // Thematic
  SOXX: { name: 'Semiconductors', category: 'thematic' },
  ITA: { name: 'Aerospace & Defense', category: 'thematic' },
  XBI: { name: 'Biotech', category: 'thematic' },
  IGV: { name: 'Software', category: 'thematic' },
  TAN: { name: 'Solar', category: 'thematic' },
  KWEB: { name: 'China Internet', category: 'thematic' },
  ARKK: { name: 'Innovation', category: 'thematic' },
  GDX: { name: 'Gold Miners', category: 'thematic' },
  XHB: { name: 'Homebuilders', category: 'thematic' },
  KRE: { name: 'Regional Banks', category: 'thematic' },
  IBB: { name: 'Biotech (Broad)', category: 'thematic' },
  SMH: { name: 'Semis (VanEck)', category: 'thematic' },
  // International
  EEM: { name: 'Emerging Markets', category: 'international' },
  EFA: { name: 'Developed Intl', category: 'international' },
  FXI: { name: 'China Large Cap', category: 'international' },
  EWJ: { name: 'Japan', category: 'international' },
  EWZ: { name: 'Brazil', category: 'international' },
};

// ============================================
// REUSABLE COMPONENTS
// ============================================

const Card = memo(({ children, style = {}, gradient = false, noPadding = false }) => (
  <div style={{
    background: gradient 
      ? 'linear-gradient(135deg, rgba(22, 27, 44, 0.98) 0%, rgba(17, 24, 39, 0.98) 100%)'
      : 'rgba(22, 27, 44, 0.7)',
    borderRadius: '14px',
    border: gradient ? '1px solid rgba(0, 212, 255, 0.12)' : '1px solid rgba(255, 255, 255, 0.06)',
    padding: noPadding ? 0 : '20px',
    marginBottom: '16px',
    fontFamily: FONT_FAMILY,
    ...style,
  }}>
    {children}
  </div>
));

const CardTitle = memo(({ icon, children, badge, subtitle }) => (
  <div style={{ marginBottom: '16px' }}>
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '8px',
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '10px',
        fontSize: '14px', 
        fontWeight: '600', 
        color: '#fff',
      }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        {children}
      </div>
      {badge}
    </div>
    {subtitle && (
      <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', marginLeft: '28px' }}>
        {subtitle}
      </div>
    )}
  </div>
));

const StatusPill = memo(({ active, label, color = COLORS.green }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '10px',
    fontWeight: '500',
    background: active ? `${color}15` : 'rgba(255,255,255,0.03)',
    border: `1px solid ${active ? `${color}40` : 'rgba(255,255,255,0.08)'}`,
    color: active ? color : '#555',
    transition: 'all 0.2s ease',
  }}>
    <div style={{
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: active ? color : '#444',
      transition: 'all 0.2s ease',
    }} />
    {label}
  </div>
));

const PremiumButton = memo(({ onClick, disabled, loading, children, secondary = false }) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    style={{
      padding: secondary ? '8px 16px' : '10px 20px',
      fontSize: '12px',
      fontWeight: '600',
      borderRadius: '8px',
      border: secondary ? '1px solid rgba(255,255,255,0.15)' : 'none',
      background: loading ? '#333' : secondary ? 'transparent' : disabled ? '#2a2a3a' 
        : 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
      color: secondary ? '#888' : '#fff',
      cursor: disabled || loading ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      boxShadow: !disabled && !loading && !secondary ? '0 4px 15px rgba(0, 212, 255, 0.25)' : 'none',
      fontFamily: FONT_FAMILY,
      transition: 'all 0.2s ease',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    }}
  >
    {children}
  </button>
));

// ============================================
// MAIN COMPONENT
// ============================================

const FactorsTab = memo(({
  positions,
  factorData,
  unifiedMarketData,
  useEwma,
  isFetchingFactors,
  setIsFetchingFactors,
  runFactorAnalysis,
  factorAnalysis,
  historyTimeline,
  thematicOverrides,
  setThematicOverrides,
  thematicSwapResults,
  thematicSwapProgress,
  isRunningThematicSwaps,
  runThematicSwapAnalysis,
  styles,
}) => {
  try {
    const tickers = positions.map(p => p.ticker?.toUpperCase()).filter(t => t);
    
    const hasFactorData = factorData && Object.keys(factorData).length > 10;
    const hasPositionData = tickers.every(t => unifiedMarketData[t]?.dailyReturns?.length > 30);
    const dataReady = hasFactorData && hasPositionData;
    
    const formatBeta = (beta, threshold = 0.3) => {
      if (!isFinite(beta)) return <span style={{ color: '#555' }}>—</span>;
      const color = beta > threshold ? COLORS.green : beta < -threshold ? COLORS.red : '#888';
      const sign = beta >= 0 ? '+' : '';
      return <span style={{ color, fontFamily: FONT_FAMILY, fontWeight: '600' }}>{sign}{beta.toFixed(2)}</span>;
    };
    
    const formatPct = (val, decimals = 1) => {
      if (!isFinite(val)) return <span style={{ color: '#555' }}>—</span>;
      const pct = val * 100;
      const color = pct > 0.5 ? COLORS.green : pct < -0.5 ? COLORS.red : '#888';
      const sign = pct >= 0 ? '+' : '';
      return <span style={{ color, fontFamily: FONT_FAMILY }}>{sign}{pct.toFixed(decimals)}%</span>;
    };
    
    const handleRunAnalysis = async () => {
      if (!dataReady) return;
      setIsFetchingFactors(true);
      try {
        await runFactorAnalysis(factorData);
      } finally {
        setIsFetchingFactors(false);
      }
    };
    
    return (
      <div style={{ fontFamily: FONT_FAMILY }}>
        {/* Premium Header Panel */}
        <HeaderPanel
          dataReady={dataReady}
          hasFactorData={hasFactorData}
          hasPositionData={hasPositionData}
          factorAnalysis={factorAnalysis}
          factorDataCount={Object.keys(factorData || {}).length}
          positionReadyCount={tickers.filter(t => unifiedMarketData[t]?.dailyReturns?.length > 30).length}
          totalPositions={tickers.length}
          isFetchingFactors={isFetchingFactors}
          handleRunAnalysis={handleRunAnalysis}
          useEwma={useEwma}
        />
        
        {/* Empty State */}
        {!factorAnalysis && !isFetchingFactors && (
          <EmptyState 
            positions={positions}
            unifiedMarketData={unifiedMarketData}
            dataReady={dataReady}
            handleRunAnalysis={handleRunAnalysis}
          />
        )}
        
        {/* Loading State */}
        {isFetchingFactors && <LoadingState />}
        
        {/* Results */}
        {factorAnalysis && !isFetchingFactors && (
          <>
            <FactorExposuresCard 
              factorBetas={factorAnalysis.portfolioFactorBetas} 
              formatBeta={formatBeta}
            />
            
            {factorAnalysis.thematicGroups?.length > 0 && (
              <ThematicConcentrationsCard 
                thematicGroups={factorAnalysis.thematicGroups}
              />
            )}
            
            <ReturnAttributionCard
              factorAnalysis={factorAnalysis}
              historyTimeline={historyTimeline}
              formatPct={formatPct}
              formatBeta={formatBeta}
            />
            
            <RiskDecompositionCard
              riskDecomposition={factorAnalysis.riskDecomposition}
            />
            
            <PositionLoadingsCard
              factorAnalysis={factorAnalysis}
              thematicOverrides={thematicOverrides}
              setThematicOverrides={setThematicOverrides}
              runFactorAnalysis={runFactorAnalysis}
              factorData={factorData}
              formatBeta={formatBeta}
              formatPct={formatPct}
              styles={styles}
            />
            
            <ThematicSwapSection
              dataReady={dataReady}
              isRunningThematicSwaps={isRunningThematicSwaps}
              thematicSwapProgress={thematicSwapProgress}
              thematicSwapResults={thematicSwapResults}
              runThematicSwapAnalysis={runThematicSwapAnalysis}
            />
            
            {/* Footer timestamp */}
            <div style={{ 
              textAlign: 'center', 
              fontSize: '10px', 
              color: '#555', 
              padding: '12px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}>
              Analysis completed {new Date(factorAnalysis.timestamp).toLocaleString()} • 
              Data period: {historyTimeline}
            </div>
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering Factors tab:', error);
    return (
      <Card gradient style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px 0', color: COLORS.red }}>Error Rendering Factors Tab</h3>
        <p style={{ fontSize: '12px', color: '#888' }}>{error.message}</p>
      </Card>
    );
  }
});

// ============================================
// HEADER PANEL
// ============================================

const HeaderPanel = memo(({ 
  dataReady, hasFactorData, hasPositionData, factorAnalysis,
  factorDataCount, positionReadyCount, totalPositions,
  isFetchingFactors, handleRunAnalysis, useEwma
}) => (
  <Card gradient noPadding>
    {/* Header */}
    <div style={{
      background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.08) 0%, rgba(123, 47, 247, 0.08) 100%)',
      padding: '16px 20px',
      borderBottom: '1px solid rgba(0, 212, 255, 0.08)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px',
    }}>
      <div>
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '20px' }}>🧬</span>
          Factor Analysis
        </div>
        <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
          Decompose returns into systematic factors and detect thematic concentrations
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {factorAnalysis && (
          <div style={{ fontSize: '9px', color: '#555' }}>
            Last: {new Date(factorAnalysis.timestamp).toLocaleTimeString()}
          </div>
        )}
        
        {dataReady ? (
          <PremiumButton onClick={handleRunAnalysis} loading={isFetchingFactors}>
            {isFetchingFactors ? '⏳ Analyzing...' : (
              <>
                🔬 {factorAnalysis ? 'Re-run' : 'Run'} Analysis
                <kbd style={{ 
                  padding: '2px 6px', 
                  fontSize: '9px', 
                  background: 'rgba(255,255,255,0.15)', 
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}>Enter</kbd>
              </>
            )}
          </PremiumButton>
        ) : (
          <div style={{ 
            padding: '8px 14px', 
            background: 'rgba(255, 159, 67, 0.1)', 
            border: '1px solid rgba(255, 159, 67, 0.2)',
            borderRadius: '8px',
            fontSize: '11px',
            color: COLORS.orange,
          }}>
            ⚠️ Load data via "🚀 Load All" first
          </div>
        )}
      </div>
    </div>
    
    {/* Status Row */}
    <div style={{ padding: '12px 20px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
      <StatusPill active={hasFactorData} label={`Factor ETFs (${factorDataCount})`} color={COLORS.cyan} />
      <StatusPill active={hasPositionData} label={`Positions (${positionReadyCount}/${totalPositions})`} color={COLORS.green} />
      <StatusPill active={!!factorAnalysis} label="Analysis Complete" color={COLORS.purple} />
      {useEwma && <StatusPill active={true} label="EWMA Enabled" color={COLORS.orange} />}
    </div>
  </Card>
));

// ============================================
// EMPTY STATE
// ============================================

const EmptyState = memo(({ positions, unifiedMarketData, dataReady, handleRunAnalysis }) => (
  <Card gradient style={{ textAlign: 'center', padding: '50px 24px' }}>
    <div style={{ 
      width: '70px', height: '70px', borderRadius: '16px',
      background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.15) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '32px', margin: '0 auto 20px',
      border: '1px solid rgba(0, 212, 255, 0.15)',
    }}>
      🧬
    </div>
    <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px', fontWeight: '600' }}>
      Ready for Factor Analysis
    </h3>
    <p style={{ margin: '0 0 28px 0', color: '#666', fontSize: '12px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
      Decompose your portfolio into systematic factors (Market β, Size, Value, Momentum) and identify thematic concentrations.
    </p>
    
    <div style={{ 
      display: 'inline-flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start', 
      padding: '16px 24px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '12px', marginBottom: '24px',
    }}>
      {[
        { done: positions.length > 0, text: `Add positions (${positions.length} added)` },
        { done: Object.keys(unifiedMarketData).length > 0, text: 'Load market data' },
      ].map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: item.done ? COLORS.green : '#555', fontSize: '12px' }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '6px',
            background: item.done ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.03)',
            border: item.done ? `1px solid ${COLORS.green}` : '1px solid #333',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600',
          }}>
            {item.done ? '✓' : i + 1}
          </div>
          {item.text}
        </div>
      ))}
    </div>
    
    {dataReady && (
      <PremiumButton onClick={handleRunAnalysis}>
        🧬 Run Factor Analysis
      </PremiumButton>
    )}
  </Card>
));

// ============================================
// LOADING STATE
// ============================================

const LoadingState = memo(() => (
  <Card style={{ textAlign: 'center', padding: '50px' }}>
    <div style={{ 
      width: '48px', height: '48px', 
      border: '3px solid rgba(0, 212, 255, 0.2)',
      borderTopColor: COLORS.cyan,
      borderRadius: '50%',
      margin: '0 auto 20px',
      animation: 'spin 1s linear infinite',
      willChange: 'transform',
    }} />
    <div style={{ fontSize: '14px', color: '#fff', marginBottom: '8px' }}>Running Factor Analysis</div>
    <div style={{ fontSize: '11px', color: '#666' }}>Computing regressions and detecting exposures...</div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </Card>
));

// ============================================
// FACTOR EXPOSURES CARD
// ============================================

const FactorExposuresCard = memo(({ factorBetas, formatBeta }) => {
  const factors = [
    { key: 'MKT', name: 'Market (β)', icon: '📈', color: COLORS.cyan, threshold: 0.5, scale: 50 },
    { key: 'SMB', name: 'Size', icon: '📊', color: COLORS.purple, threshold: 0.2, scale: 100 },
    { key: 'HML', name: 'Value', icon: '💎', color: COLORS.gold, threshold: 0.2, scale: 100 },
    { key: 'MOM', name: 'Momentum', icon: '🚀', color: COLORS.green, threshold: 0.2, scale: 100 },
  ];
  
  const getInterpretation = () => {
    const parts = [];
    if (factorBetas.MKT > 1.1) parts.push('Above-market β (more volatile)');
    else if (factorBetas.MKT < 0.9) parts.push('Below-market β (defensive)');
    if (factorBetas.SMB > 0.15) parts.push('Small-cap tilt');
    else if (factorBetas.SMB < -0.15) parts.push('Large-cap tilt');
    if (factorBetas.HML > 0.15) parts.push('Value tilt');
    else if (factorBetas.HML < -0.15) parts.push('Growth tilt');
    if (factorBetas.MOM > 0.2) parts.push('Positive momentum');
    else if (factorBetas.MOM < -0.2) parts.push('Contrarian/negative momentum');
    return parts.length > 0 ? parts.join(' • ') : 'Factor exposures are close to market-neutral';
  };
  
  return (
    <Card>
      <CardTitle icon="📊">Portfolio Factor Exposures</CardTitle>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
        {factors.map(factor => {
          const value = factorBetas[factor.key] || 0;
          const barWidth = Math.min(100, Math.abs(value) * factor.scale);
          
          return (
            <div key={factor.key} style={{
              background: `linear-gradient(135deg, ${factor.color}12 0%, ${factor.color}05 100%)`,
              borderRadius: '12px',
              padding: '16px',
              border: `1px solid ${factor.color}25`,
              transition: 'all 0.2s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px' }}>{factor.icon}</span>
                <span style={{ fontSize: '11px', color: '#999', fontWeight: '500' }}>{factor.name}</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: '700', marginBottom: '12px' }}>
                {formatBeta(value, factor.threshold)}
              </div>
              
              {/* GPU-accelerated progress bar */}
              <div style={{ 
                height: '6px', 
                background: 'rgba(255,255,255,0.08)', 
                borderRadius: '3px', 
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: '100%',
                  background: value >= 0 
                    ? `linear-gradient(90deg, ${COLORS.green}, ${COLORS.green}80)`
                    : `linear-gradient(90deg, ${COLORS.red}80, ${COLORS.red})`,
                  borderRadius: '3px',
                  transform: `scaleX(${barWidth / 100})`,
                  transformOrigin: value >= 0 ? 'left' : 'right',
                  transition: 'transform 0.4s ease',
                  willChange: 'transform',
                }} />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Interpretation */}
      <div style={{ 
        marginTop: '16px', 
        padding: '14px 16px', 
        background: 'rgba(0, 212, 255, 0.06)', 
        borderRadius: '10px', 
        fontSize: '12px', 
        color: '#aaa',
        border: '1px solid rgba(0, 212, 255, 0.1)',
      }}>
        <span style={{ color: COLORS.cyan, fontWeight: '600' }}>💡 </span>
        {getInterpretation()}
      </div>
    </Card>
  );
});

// ============================================
// THEMATIC CONCENTRATIONS CARD
// ============================================

const ThematicConcentrationsCard = memo(({ thematicGroups }) => (
  <Card>
    <CardTitle 
      icon="🎯" 
      subtitle="Based on correlation with thematic ETFs (minimum 5% portfolio weight)"
      badge={
        <span style={{ 
          fontSize: '10px', 
          padding: '4px 10px', 
          background: 'rgba(255, 159, 67, 0.15)',
          border: '1px solid rgba(255, 159, 67, 0.25)',
          borderRadius: '20px',
          color: COLORS.orange,
        }}>
          {thematicGroups.length} detected
        </span>
      }
    >
      Thematic Concentrations
    </CardTitle>
    
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {thematicGroups.map((group) => {
        const severity = group.totalWeight > 0.25 ? 'high' : group.totalWeight > 0.15 ? 'medium' : 'low';
        const config = {
          high: { bg: `${COLORS.red}10`, border: `${COLORS.red}25`, bar: COLORS.red, icon: '🔴' },
          medium: { bg: `${COLORS.orange}10`, border: `${COLORS.orange}25`, bar: COLORS.orange, icon: '🟠' },
          low: { bg: `${COLORS.cyan}08`, border: `${COLORS.cyan}15`, bar: COLORS.cyan, icon: '🟡' },
        }[severity];
        
        return (
          <div key={group.etf} style={{
            background: config.bg,
            borderRadius: '12px',
            padding: '16px',
            border: `1px solid ${config.border}`,
            transition: 'all 0.2s ease',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px' }}>{config.icon}</span>
                  <span style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>{group.name}</span>
                  <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 8px', 
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '4px',
                    color: '#666',
                  }}>
                    {group.etf}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: '#666' }}>
                  β = {group.avgBeta?.toFixed(2) || 'N/A'} to {group.etf}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '24px', fontWeight: '700', color: config.bar }}>
                  {(group.totalWeight * 100).toFixed(1)}%
                </div>
                <div style={{ fontSize: '10px', color: '#555' }}>portfolio weight</div>
              </div>
            </div>
            
            {/* GPU-accelerated progress bar */}
            <div style={{ 
              height: '8px', 
              background: 'rgba(255,255,255,0.08)', 
              borderRadius: '4px', 
              overflow: 'hidden',
              marginBottom: '12px',
            }}>
              <div style={{
                height: '100%',
                width: '100%',
                background: `linear-gradient(90deg, ${config.bar}, ${config.bar}80)`,
                borderRadius: '4px',
                transform: `scaleX(${Math.min(1, group.totalWeight)})`,
                transformOrigin: 'left',
                transition: 'transform 0.4s ease',
                willChange: 'transform',
              }} />
            </div>
            
            {/* Positions */}
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>
              <span style={{ color: '#aaa' }}>Positions: </span>
              {group.positions.map((p, i) => (
                <span key={p.ticker}>
                  {i > 0 && ', '}
                  <span style={{ color: '#fff' }}>{p.ticker}</span>
                  {p.thematicMatch?.lag !== 0 && (
                    <span style={{ color: COLORS.cyan, fontSize: '9px' }}> ⏱{p.thematicMatch.lag > 0 ? '+' : ''}{p.thematicMatch.lag}d</span>
                  )}
                </span>
              ))}
            </div>
            
            {/* Impact estimate */}
            <div style={{ 
              fontSize: '10px', 
              color: '#555', 
              padding: '8px 12px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '6px',
            }}>
              📉 If {group.etf} drops 20% → ~<span style={{ color: COLORS.red, fontWeight: '600' }}>{(group.avgBeta * group.totalWeight * 0.20 * 100).toFixed(1)}%</span> portfolio impact
            </div>
          </div>
        );
      })}
    </div>
  </Card>
));

// ============================================
// RETURN ATTRIBUTION CARD
// ============================================

const ReturnAttributionCard = memo(({ factorAnalysis, historyTimeline, formatPct, formatBeta }) => {
  const [hoveredRow, setHoveredRow] = useState(null);
  
  const rows = [
    { name: 'Market', key: 'MKT', factorRet: factorAnalysis.factorReturns?.MKT, beta: factorAnalysis.portfolioFactorBetas?.MKT },
    { name: 'Size (SMB)', key: 'SMB', factorRet: factorAnalysis.factorReturns?.SMB, beta: factorAnalysis.portfolioFactorBetas?.SMB },
    { name: 'Value (HML)', key: 'HML', factorRet: factorAnalysis.factorReturns?.HML, beta: factorAnalysis.portfolioFactorBetas?.HML },
    { name: 'Momentum', key: 'MOM', factorRet: factorAnalysis.factorReturns?.MOM, beta: factorAnalysis.portfolioFactorBetas?.MOM },
  ];
  
  const totalAttribution = Object.values(factorAnalysis.attribution || {}).reduce((a, b) => a + b, 0);
  
  return (
    <Card>
      <CardTitle icon="📊" subtitle={`Period: ${historyTimeline}`}>
        Historical Return Attribution
      </CardTitle>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
              {['Factor', 'Factor Return', 'Your β', 'Contribution'].map(col => (
                <th key={col} style={{ 
                  textAlign: col === 'Factor' ? 'left' : 'right', 
                  padding: '12px 10px', 
                  color: '#666', 
                  fontWeight: '600',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr 
                key={row.key} 
                style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: hoveredRow === idx ? 'rgba(0, 212, 255, 0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td style={{ padding: '12px 10px', fontWeight: '500' }}>{row.name}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatPct(row.factorRet)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatBeta(row.beta || 0, 0.2)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatPct(factorAnalysis.attribution?.[row.key])}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '2px solid rgba(255,255,255,0.15)', background: 'rgba(0, 212, 255, 0.05)' }}>
              <td style={{ padding: '12px 10px', fontWeight: '700' }}>Total Factor Attribution</td>
              <td colSpan="2"></td>
              <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '700', fontSize: '14px' }}>
                {formatPct(totalAttribution)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Thematic attribution */}
      {Object.keys(factorAnalysis.thematicAttribution || {}).length > 0 && (
        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', marginBottom: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Thematic Attribution
          </div>
          {Object.entries(factorAnalysis.thematicAttribution).map(([etf, data]) => (
            <div key={etf} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              padding: '10px 12px',
              borderRadius: '8px',
              marginBottom: '4px',
              background: 'rgba(255,255,255,0.02)',
              fontSize: '11px',
              transition: 'background 0.15s ease',
            }}>
              <span>{data.name} <span style={{ color: '#555' }}>({etf})</span></span>
              <span>
                ETF: {formatPct(data.etfReturn)} → Contrib: {formatPct(data.contribution)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
});

// ============================================
// RISK DECOMPOSITION CARD
// ============================================

const RiskDecompositionCard = memo(({ riskDecomposition }) => {
  const factorPct = ((riskDecomposition?.factorRisk || 0) * 100).toFixed(0);
  const idioPct = ((riskDecomposition?.idiosyncraticRisk || 0) * 100).toFixed(0);
  
  return (
    <Card>
      <CardTitle icon="⚖️">Risk Decomposition</CardTitle>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
        <div style={{
          padding: '20px',
          background: 'rgba(0, 212, 255, 0.08)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(0, 212, 255, 0.15)',
        }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: COLORS.cyan }}>{factorPct}%</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>Factor Risk (Systematic)</div>
        </div>
        <div style={{
          padding: '20px',
          background: 'rgba(123, 47, 247, 0.08)',
          borderRadius: '12px',
          textAlign: 'center',
          border: '1px solid rgba(123, 47, 247, 0.15)',
        }}>
          <div style={{ fontSize: '36px', fontWeight: '700', color: COLORS.purple }}>{idioPct}%</div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>Idiosyncratic (Stock-Specific)</div>
        </div>
      </div>
      
      {/* Animated stacked bar */}
      <div style={{ 
        height: '28px', 
        background: 'rgba(255,255,255,0.08)', 
        borderRadius: '14px', 
        overflow: 'hidden', 
        display: 'flex',
        marginBottom: '16px',
      }}>
        <div style={{
          width: `${factorPct}%`,
          background: `linear-gradient(90deg, ${COLORS.cyan}, #0099cc)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: '600',
          color: '#fff',
          transition: 'width 0.5s ease',
        }}>
          Factor
        </div>
        <div style={{
          width: `${idioPct}%`,
          background: `linear-gradient(90deg, ${COLORS.purple}, #5a1fd6)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '10px',
          fontWeight: '600',
          color: '#fff',
          transition: 'width 0.5s ease',
        }}>
          Stock-Specific
        </div>
      </div>
      
      {/* Interpretation */}
      <div style={{ 
        fontSize: '12px', 
        color: '#888',
        padding: '12px 14px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '8px',
      }}>
        {(riskDecomposition?.factorRisk || 0) > 0.7 
          ? '⚠️ High factor risk: Most risk comes from systematic market factors, not stock selection.'
          : (riskDecomposition?.idiosyncraticRisk || 0) > 0.5
          ? '✅ High idiosyncratic risk: Stock-specific bets are a major source of risk/return.'
          : '📊 Balanced mix of systematic and stock-specific risk.'}
      </div>
    </Card>
  );
});

// ============================================
// POSITION LOADINGS CARD
// ============================================

const PositionLoadingsCard = memo(({ 
  factorAnalysis, thematicOverrides, setThematicOverrides, 
  runFactorAnalysis, factorData, formatBeta, formatPct, styles
}) => {
  const [hoveredRow, setHoveredRow] = useState(null);
  
  return (
    <Card>
      <CardTitle 
        icon="📋" 
        badge={
          Object.keys(thematicOverrides).length > 0 && (
            <span style={{ 
              fontSize: '10px', 
              padding: '4px 10px', 
              background: 'rgba(255, 159, 67, 0.15)',
              border: '1px solid rgba(255, 159, 67, 0.25)',
              borderRadius: '20px',
              color: COLORS.orange,
            }}>
              {Object.keys(thematicOverrides).length} override(s)
            </span>
          )
        }
      >
        Position Factor Loadings
      </CardTitle>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '850px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
              {['Ticker', 'Weight', 'β_MKT', 'Size', 'Value', 'Mom', 'R²', 'α (ann)', 'Theme Match', 'Override'].map(col => (
                <th key={col} style={{ 
                  textAlign: col === 'Ticker' || col === 'Theme Match' || col === 'Override' ? 'left' : 'right', 
                  padding: '12px 8px', 
                  color: '#666', 
                  fontWeight: '600',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  position: 'sticky',
                  top: 0,
                  background: 'rgba(22, 27, 44, 0.98)',
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {factorAnalysis.positions?.map((pa, idx) => (
              <tr 
                key={pa.id} 
                style={{ 
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: hoveredRow === idx ? 'rgba(0, 212, 255, 0.05)' : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={() => setHoveredRow(idx)}
                onMouseLeave={() => setHoveredRow(null)}
              >
                <td style={{ padding: '10px 8px', fontWeight: '600', color: '#fff' }}>{pa.ticker}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#aaa' }}>{(pa.weight * 100).toFixed(1)}%</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatBeta(pa.factorBetas?.betas?.MKT || 0, 0.3)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatBeta(pa.factorBetas?.betas?.SMB || 0, 0.15)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatBeta(pa.factorBetas?.betas?.HML || 0, 0.15)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatBeta(pa.factorBetas?.betas?.MOM || 0, 0.15)}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  <span style={{ color: (pa.factorBetas?.rSquared || 0) > 0.5 ? COLORS.green : '#666' }}>
                    {((pa.factorBetas?.rSquared || 0) * 100).toFixed(0)}%
                  </span>
                  {pa.factorBetas?.lag !== 0 && (
                    <span style={{ color: COLORS.cyan, fontSize: '9px', marginLeft: '4px' }}>
                      ⏱{pa.factorBetas.lag}d
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>{formatPct(pa.factorBetas?.alpha)}</td>
                <td style={{ padding: '10px 8px', fontSize: '10px' }}>
                  {pa.thematicMatch?.ticker ? (
                    <span style={{ color: pa.thematicMatch.isOverride ? COLORS.orange : '#aaa' }}>
                      {pa.thematicMatch.name}
                      <span style={{ color: '#555', marginLeft: '4px' }}>
                        ({(pa.thematicMatch.rSquared * 100).toFixed(0)}%)
                      </span>
                      {pa.thematicMatch.lag !== 0 && (
                        <span style={{ color: COLORS.cyan, marginLeft: '4px' }}>⏱{pa.thematicMatch.lag}d</span>
                      )}
                      {pa.thematicMatch.isOverride && <span style={{ color: COLORS.orange }}> ✎</span>}
                    </span>
                  ) : (
                    <span style={{ color: '#444' }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <select
                    value={thematicOverrides[pa.id] || ''}
                    onChange={(e) => {
                      const newOverrides = { ...thematicOverrides };
                      if (e.target.value) {
                        newOverrides[pa.id] = e.target.value;
                      } else {
                        delete newOverrides[pa.id];
                      }
                      setThematicOverrides(newOverrides);
                    }}
                    style={{
                      padding: '5px 8px',
                      fontSize: '10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.3)',
                      color: thematicOverrides[pa.id] ? COLORS.orange : '#888',
                      cursor: 'pointer',
                      width: '100%',
                      maxWidth: '110px',
                      fontFamily: FONT_FAMILY,
                    }}
                  >
                    <option value="">Auto</option>
                    <optgroup label="Sectors">
                      {Object.entries(THEMATIC_ETFS).filter(([_, v]) => v.category === 'sector').map(([etf, data]) => (
                        <option key={etf} value={etf}>{etf} - {data.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Thematic">
                      {Object.entries(THEMATIC_ETFS).filter(([_, v]) => v.category === 'thematic').map(([etf, data]) => (
                        <option key={etf} value={etf}>{etf} - {data.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="International">
                      {Object.entries(THEMATIC_ETFS).filter(([_, v]) => v.category === 'international').map(([etf, data]) => (
                        <option key={etf} value={etf}>{etf} - {data.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Re-run with overrides */}
      {Object.keys(thematicOverrides).length > 0 && (
        <div style={{ 
          marginTop: '16px', 
          paddingTop: '16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flexWrap: 'wrap',
        }}>
          <PremiumButton onClick={() => runFactorAnalysis(factorData)}>
            🔄 Re-run with Overrides
          </PremiumButton>
          <PremiumButton secondary onClick={() => { setThematicOverrides({}); runFactorAnalysis(factorData); }}>
            Clear All Overrides
          </PremiumButton>
          <span style={{ fontSize: '11px', color: '#555' }}>
            {Object.keys(thematicOverrides).length} override(s) set
          </span>
        </div>
      )}
    </Card>
  );
});

// ============================================
// THEMATIC SWAP SECTION
// ============================================

const ThematicSwapSection = memo(({ 
  dataReady, isRunningThematicSwaps, thematicSwapProgress, 
  thematicSwapResults, runThematicSwapAnalysis 
}) => (
  <Card style={{ 
    background: 'linear-gradient(135deg, rgba(155, 89, 182, 0.08) 0%, rgba(22, 27, 44, 0.95) 100%)',
    border: '1px solid rgba(155, 89, 182, 0.15)',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <span style={{ fontSize: '18px' }}>🎯</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>Thematic ETF Swap Analysis</span>
        </div>
        <p style={{ margin: 0, fontSize: '11px', color: '#666' }}>
          Monte Carlo analysis of swapping positions into thematic ETFs
        </p>
      </div>
      <button
        onClick={runThematicSwapAnalysis}
        disabled={isRunningThematicSwaps || !dataReady}
        style={{
          padding: '10px 18px',
          fontSize: '11px',
          fontWeight: '600',
          borderRadius: '8px',
          border: '1px solid rgba(155, 89, 182, 0.3)',
          background: isRunningThematicSwaps ? 'rgba(255,255,255,0.05)' : 'rgba(155, 89, 182, 0.15)',
          color: isRunningThematicSwaps ? '#666' : COLORS.purple,
          cursor: isRunningThematicSwaps || !dataReady ? 'not-allowed' : 'pointer',
          opacity: !dataReady ? 0.5 : 1,
          fontFamily: FONT_FAMILY,
          transition: 'all 0.2s ease',
        }}
      >
        {isRunningThematicSwaps ? '⏳ Analyzing...' : '🚀 Run Thematic Analysis'}
      </button>
    </div>
    
    {/* Progress */}
    {isRunningThematicSwaps && thematicSwapProgress?.phase && (
      <div style={{
        padding: '12px 16px',
        background: 'rgba(155, 89, 182, 0.1)',
        borderRadius: '10px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            width: '140px', 
            height: '6px', 
            background: 'rgba(155, 89, 182, 0.2)', 
            borderRadius: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: COLORS.purple,
              borderRadius: '3px',
              transform: `scaleX(${(thematicSwapProgress.current || 0) / 100})`,
              transformOrigin: 'left',
              transition: 'transform 0.3s ease',
              willChange: 'transform',
            }} />
          </div>
          <span style={{ fontSize: '10px', color: COLORS.purple }}>
            {thematicSwapProgress.phase}
          </span>
        </div>
      </div>
    )}
    
    {/* Results */}
    {!isRunningThematicSwaps && thematicSwapResults && (
      <ThematicSwapCard results={thematicSwapResults} />
    )}
    
    {/* Empty state */}
    {!thematicSwapResults && !isRunningThematicSwaps && (
      <div style={{ 
        padding: '30px', 
        textAlign: 'center', 
        color: '#555',
        fontSize: '12px',
      }}>
        Click "Run Thematic Analysis" to identify beneficial ETF swaps
      </div>
    )}
  </Card>
));

// ============================================
// THEMATIC SWAP CARD
// ============================================

const ThematicSwapCard = memo(({ results }) => {
  if (!results) return null;
  
  const { swaps, baseline, computeTime, pathsPerPair } = results;
  const bestSwaps = swaps.slice(0, 5);
  const worstSwaps = swaps.slice(-3).reverse();
  
  const fmtChange = (v, decimals = 2, inverted = false) => {
    if (v == null || !isFinite(v)) return <span style={{ color: '#555' }}>—</span>;
    const isPositive = inverted ? v < 0 : v > 0;
    const color = isPositive ? COLORS.green : v === 0 ? '#666' : COLORS.red;
    const sign = v > 0 ? '+' : '';
    return <span style={{ color, fontFamily: FONT_FAMILY }}>{sign}{(v * 100).toFixed(decimals)}%</span>;
  };
  
  return (
    <div>
      {/* Baseline metrics */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        padding: '12px 16px', 
        background: 'rgba(0,0,0,0.25)', 
        borderRadius: '10px',
        marginBottom: '16px',
        fontSize: '11px',
        flexWrap: 'wrap',
      }}>
        <div style={{ color: '#666' }}>Baseline:</div>
        <div><span style={{ color: '#555' }}>Sharpe:</span> <span style={{ color: COLORS.cyan, fontWeight: '600' }}>{baseline?.sharpe?.toFixed(3)}</span></div>
        <div><span style={{ color: '#555' }}>P(Loss):</span> <span style={{ color: COLORS.orange, fontWeight: '600' }}>{(baseline?.pLoss * 100)?.toFixed(1)}%</span></div>
        <div><span style={{ color: '#555' }}>VaR 5%:</span> <span style={{ color: COLORS.red, fontWeight: '600' }}>{(baseline?.var5 * 100)?.toFixed(1)}%</span></div>
        <div><span style={{ color: '#555' }}>Median:</span> <span style={{ color: COLORS.green, fontWeight: '600' }}>{(baseline?.median * 100)?.toFixed(1)}%</span></div>
      </div>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '10px', color: '#666' }}>
          Impact of 1% swaps (sell position → buy ETF)
        </div>
        <span style={{
          fontSize: '9px',
          padding: '3px 8px',
          background: 'rgba(155, 89, 182, 0.2)',
          border: '1px solid rgba(155, 89, 182, 0.3)',
          borderRadius: '4px',
          color: COLORS.purple,
        }}>
          {pathsPerPair?.toLocaleString()} QMC paths
        </span>
      </div>
      
      {/* Swap Rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Best Swaps */}
        <div style={{ 
          background: 'rgba(46, 204, 113, 0.06)', 
          borderRadius: '10px', 
          padding: '14px',
          border: '1px solid rgba(46, 204, 113, 0.12)',
        }}>
          <div style={{ fontSize: '10px', color: COLORS.green, fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🏆 Best Swaps
          </div>
          {bestSwaps.map((swap, i) => (
            <div key={`${swap.sellTicker}-${swap.buyTicker}`} style={{ 
              padding: '10px',
              background: i === 0 ? 'rgba(46, 204, 113, 0.1)' : 'transparent',
              borderRadius: '8px',
              marginBottom: '6px',
              transition: 'background 0.15s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px' }}>
                  <span style={{ color: COLORS.red }}>{swap.sellTicker}</span>
                  <span style={{ color: '#444', margin: '0 6px' }}>→</span>
                  <span style={{ color: COLORS.green, fontWeight: '600' }}>{swap.buyTicker}</span>
                </div>
                <div style={{ fontSize: '10px', display: 'flex', gap: '8px' }}>
                  <span>ΔP(L): {fmtChange(swap.deltaMetrics?.deltaPLoss, 1, true)}</span>
                  <span>ΔVaR: {fmtChange(swap.deltaMetrics?.deltaVaR5, 1)}</span>
                </div>
              </div>
              <div style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>
                {swap.buyName}
              </div>
            </div>
          ))}
        </div>
        
        {/* Worst Swaps */}
        <div style={{ 
          background: 'rgba(231, 76, 60, 0.06)', 
          borderRadius: '10px', 
          padding: '14px',
          border: '1px solid rgba(231, 76, 60, 0.12)',
        }}>
          <div style={{ fontSize: '10px', color: COLORS.red, fontWeight: '600', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⚠️ Worst Swaps
          </div>
          {worstSwaps.map((swap, i) => (
            <div key={`${swap.sellTicker}-${swap.buyTicker}`} style={{ 
              padding: '10px',
              background: i === 0 ? 'rgba(231, 76, 60, 0.1)' : 'transparent',
              borderRadius: '8px',
              marginBottom: '6px',
              transition: 'background 0.15s ease',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px' }}>
                  <span style={{ color: COLORS.red }}>{swap.sellTicker}</span>
                  <span style={{ color: '#444', margin: '0 6px' }}>→</span>
                  <span style={{ color: COLORS.green, fontWeight: '600' }}>{swap.buyTicker}</span>
                </div>
                <div style={{ fontSize: '10px', display: 'flex', gap: '8px' }}>
                  <span>ΔP(L): {fmtChange(swap.deltaMetrics?.deltaPLoss, 1, true)}</span>
                  <span>ΔVaR: {fmtChange(swap.deltaMetrics?.deltaVaR5, 1)}</span>
                </div>
              </div>
              <div style={{ fontSize: '9px', color: '#555', marginTop: '4px' }}>
                {swap.buyName}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Footer */}
      <div style={{ 
        marginTop: '16px', 
        padding: '10px 14px', 
        background: 'rgba(0,0,0,0.2)', 
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '10px',
        color: '#555',
      }}>
        <span>{swaps.length} swap scenarios</span>
        <span>
          {(computeTime / 1000).toFixed(1)}s • {new Date(results.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
});

export default FactorsTab;
