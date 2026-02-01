import React, { memo, useState, useRef, useEffect, useMemo } from 'react';
import { BlurInput } from '../common';

/**
 * PositionsTab - Portfolio Positions Management Component (v2.2)
 * 
 * Premium UI redesign with:
 * - Design system integration with COLORS and FONT_FAMILY
 * - Premium header panel with gradient background
 * - Enhanced search and filter bar with icons
 * - Modernized table with volatility column
 * - Dual metric panels (Beta + Volatility)
 * - Auto-sort after ticker entry
 */

// Design tokens (matching OptimizeTab)
const COLORS = {
  cyan: '#00d4ff',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#ff9f43',
  purple: '#9b59b6',
  blue: '#3498db',
};

const FONT_FAMILY = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// ============================================
// MAIN COMPONENT
// ============================================

const PositionsTab = memo(({
  // Position data
  positions,
  positionMetadata,
  positionBetas,
  
  // Filtering/sorting state
  positionSearch,
  setPositionSearch,
  positionFilter,
  setPositionFilter,
  positionSort,
  setPositionSort,
  lastPriceRefresh,
  
  // Portfolio values
  portfolioValue,
  grossPositionsValue,
  cashBalance,
  setCashBalance,
  cashRate,
  setCashRate,
  cashWeight,
  
  // Loading states
  isFetchingData,
  isFetchingBetas,
  isFetchingUnified,
  
  // Actions
  addPosition,
  removePosition,
  updatePosition,
  calculateAllBetas,
  refreshAllPrices,
  setConfirmDialog,
  
  // Add positions modal
  onOpenAddModal,
  onOpenScreenshotImport,
  
  // Styles (kept for backwards compatibility but using local styles)
  styles: externalStyles,
}) => {
  // Track the newest position ID for auto-focus
  const [newestPositionId, setNewestPositionId] = useState(null);
  // Track which position is being actively edited (to prevent sorting)
  const [editingPositionId, setEditingPositionId] = useState(null);
  const prevPositionsLength = useRef(positions.length);
  
  // Detect when a new position is added
  useEffect(() => {
    if (positions.length > prevPositionsLength.current) {
      // A new position was added - find it (it will be the one with the highest ID)
      const maxId = Math.max(...positions.map(p => p.id));
      setNewestPositionId(maxId);
      setEditingPositionId(maxId); // Also mark it as being edited
    }
    prevPositionsLength.current = positions.length;
  }, [positions]);
  
  // Filter positions
  const filteredPositions = positions.filter(pos => {
    // Search filter
    if (positionSearch) {
      const search = positionSearch.toLowerCase();
      const ticker = (pos.ticker || '').toLowerCase();
      const meta = positionMetadata[pos.ticker?.toUpperCase()];
      const name = (meta?.name || '').toLowerCase();
      if (!ticker.includes(search) && !name.includes(search)) {
        return false;
      }
    }
    
    // Type filter
    if (positionFilter === 'long' && pos.quantity <= 0) return false;
    if (positionFilter === 'short' && pos.quantity >= 0) return false;
    if (positionFilter === 'etf' && pos.type !== 'ETF') return false;
    if (positionFilter === 'equity' && pos.type !== 'Equity') return false;
    
    return true;
  });
  
  // Store the last stable sort order
  const lastSortedRef = useRef([]);
  // Track last sort settings to detect when user clicks a sort header
  const lastSortSettingsRef = useRef({ column: positionSort.column, direction: positionSort.direction });
  // Track last price refresh to trigger re-sort
  const lastPriceRefreshRef = useRef(lastPriceRefresh);

  // Clear cached sort order when prices are refreshed (forces re-sort by value)
  useEffect(() => {
    if (lastPriceRefresh !== lastPriceRefreshRef.current && lastPriceRefresh > 0) {
      console.log('🔄 Price refresh detected, clearing cached sort order');
      lastSortedRef.current = [];
      lastPriceRefreshRef.current = lastPriceRefresh;
    }
  }, [lastPriceRefresh]);

  // Sort positions - but don't resort while actively editing
  const sortedPositions = useMemo(() => {
    // Detect if there's a brand new position (not in our last sorted list)
    const lastIds = new Set(lastSortedRef.current.map(p => p.id));
    const brandNewPositions = filteredPositions.filter(p => !lastIds.has(p.id));
    const hasBrandNewPosition = brandNewPositions.length > 0;

    // Check if sort settings changed (user clicked a column header)
    const sortSettingsChanged =
      lastSortSettingsRef.current.column !== positionSort.column ||
      lastSortSettingsRef.current.direction !== positionSort.direction;

    // Update the ref for next comparison
    lastSortSettingsRef.current = { column: positionSort.column, direction: positionSort.direction };

    // If actively editing OR there's a brand new position, keep the list stable
    // BUT always sort if the user explicitly clicked a sort header
    if (!sortSettingsChanged && (editingPositionId !== null || hasBrandNewPosition) && lastSortedRef.current.length > 0) {
      // Filter the last sorted list to only include positions that still exist
      const existingIds = new Set(filteredPositions.map(p => p.id));
      const filtered = lastSortedRef.current.filter(p => existingIds.has(p.id));
      
      // Return with actual position data (in case it changed), plus any new positions at the end
      const result = [
        ...filtered.map(lastP => 
          filteredPositions.find(p => p.id === lastP.id) || lastP
        ),
        ...brandNewPositions  // New positions go at the end
      ];
      
      // Update the ref so new positions are tracked
      lastSortedRef.current = result;
      return result;
    }
    
    // Normal sorting when not editing and no new positions
    const sorted = [...filteredPositions].sort((a, b) => {
      // Keep newest position at bottom if it has no ticker
      if (newestPositionId !== null) {
        const newestPos = positions.find(p => p.id === newestPositionId);
        if (newestPos && !newestPos.ticker) {
          if (a.id === newestPositionId) return 1;
          if (b.id === newestPositionId) return -1;
        }
      }
      
      const col = positionSort.column;
      const dir = positionSort.direction;
      
      if (col === 'ticker') {
        const aVal = (a.ticker || '').toLowerCase();
        const bVal = (b.ticker || '').toLowerCase();
        return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } 
      
      if (col === 'value' || col === 'weight') {
        const aVal = a.quantity * a.price;
        const bVal = b.quantity * b.price;
        const aIsPos = aVal >= 0;
        const bIsPos = bVal >= 0;
        
        if (dir === 'desc') {
          if (aIsPos && !bIsPos) return -1;
          if (!aIsPos && bIsPos) return 1;
          if (aIsPos && bIsPos) return bVal - aVal;
          return bVal - aVal;
        } else {
          if (!aIsPos && bIsPos) return -1;
          if (aIsPos && !bIsPos) return 1;
          if (!aIsPos && !bIsPos) return aVal - bVal;
          return aVal - bVal;
        }
      }
      
      if (col === 'beta') {
        const aVal = positionBetas[a.ticker?.toUpperCase()]?.beta ?? -999;
        const bVal = positionBetas[b.ticker?.toUpperCase()]?.beta ?? -999;
        return dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (col === 'vol') {
        const aVal = positionBetas[a.ticker?.toUpperCase()]?.volatility ?? -999;
        const bVal = positionBetas[b.ticker?.toUpperCase()]?.volatility ?? -999;
        return dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (col === 'ytd') {
        const aVal = positionBetas[a.ticker?.toUpperCase()]?.ytdReturn ?? -999;
        const bVal = positionBetas[b.ticker?.toUpperCase()]?.ytdReturn ?? -999;
        return dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      if (col === '1y') {
        const aVal = positionBetas[a.ticker?.toUpperCase()]?.oneYearReturn ?? -999;
        const bVal = positionBetas[b.ticker?.toUpperCase()]?.oneYearReturn ?? -999;
        return dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
    
    // Store as last stable sort
    lastSortedRef.current = sorted;
    return sorted;
  }, [filteredPositions, positionSort, positionBetas, newestPositionId, editingPositionId, positions]);
  
  // Calculate exposure metrics
  const grossLong = positions.filter(p => p.quantity > 0).reduce((sum, p) => sum + p.quantity * p.price, 0);
  const grossShort = Math.abs(positions.filter(p => p.quantity < 0).reduce((sum, p) => sum + p.quantity * p.price, 0));
  const netExposure = grossLong - grossShort;
  
  // Portfolio weighted average beta
  const portfolioWeightedBeta = (() => {
    let sumWeightedBeta = 0;
    let sumWeights = 0;
    for (const pos of positions) {
      const beta = positionBetas[pos.ticker?.toUpperCase()]?.beta;
      if (beta != null && pos.quantity !== 0) {
        const weight = Math.abs(pos.quantity * pos.price) / (grossPositionsValue || 1);
        const sign = pos.quantity > 0 ? 1 : -1;
        sumWeightedBeta += sign * beta * weight;
        sumWeights += weight;
      }
    }
    return sumWeights > 0 ? sumWeightedBeta : null;
  })();
  
  // Portfolio weighted average volatility
  const portfolioWeightedVol = (() => {
    let sumWeightedVol = 0;
    let sumWeights = 0;
    for (const pos of positions) {
      const vol = positionBetas[pos.ticker?.toUpperCase()]?.volatility;
      if (vol != null && pos.quantity !== 0) {
        const weight = Math.abs(pos.quantity * pos.price) / (grossPositionsValue || 1);
        sumWeightedVol += vol * weight;
        sumWeights += weight;
      }
    }
    return sumWeights > 0 ? sumWeightedVol : null;
  })();
  
  // Handle add position with focus tracking
  const handleAddPosition = () => {
    addPosition();
  };
  
  // Handle ticker change - don't clear editing state while typing
  const handleTickerChange = (id, value) => {
    // Let the parent updatePosition handle the actual update (which fetches price)
    updatePosition(id, 'ticker', value);
    // Don't clear newestPositionId or editingPositionId while user is still typing
  };
  
  // Handle blur on ticker input - clear editing state when user clicks away
  const handleTickerBlur = (id) => {
    // Only clear editing state if this is the position being edited
    if (id === editingPositionId) {
      // Small delay to allow click events to process first
      setTimeout(() => {
        setEditingPositionId(null);
        setNewestPositionId(null);
      }, 150);
    }
  };
  
  // Handle focus on ticker input - mark as editing
  const handleTickerFocus = (id) => {
    setEditingPositionId(id);
  };

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* Premium Header Panel */}
      <PositionsHeader
        positions={positions}
        isFetchingBetas={isFetchingBetas}
        isFetchingData={isFetchingData}
        isFetchingUnified={isFetchingUnified}
        calculateAllBetas={calculateAllBetas}
        refreshAllPrices={refreshAllPrices}
        portfolioValue={portfolioValue}
      />
      
      {/* Search, Filter & Dual Metric Panels */}
      <SearchFilterBar
        positionSearch={positionSearch}
        setPositionSearch={setPositionSearch}
        positionFilter={positionFilter}
        setPositionFilter={setPositionFilter}
        filteredCount={sortedPositions.length}
        totalCount={positions.length}
        portfolioWeightedBeta={portfolioWeightedBeta}
        portfolioWeightedVol={portfolioWeightedVol}
      />
      
      {/* Positions Table Card */}
      <PositionsTableCard
        sortedPositions={sortedPositions}
        positions={positions}
        positionMetadata={positionMetadata}
        positionBetas={positionBetas}
        positionSort={positionSort}
        setPositionSort={setPositionSort}
        positionSearch={positionSearch}
        setPositionSearch={setPositionSearch}
        positionFilter={positionFilter}
        setPositionFilter={setPositionFilter}
        portfolioValue={portfolioValue}
        updatePosition={updatePosition}
        handleTickerChange={handleTickerChange}
        handleTickerBlur={handleTickerBlur}
        handleTickerFocus={handleTickerFocus}
        removePosition={removePosition}
        setConfirmDialog={setConfirmDialog}
        addPosition={handleAddPosition}
        onOpenAddModal={onOpenAddModal}
        onOpenScreenshotImport={onOpenScreenshotImport}
        newestPositionId={newestPositionId}
        editingPositionId={editingPositionId}
      />
      
      {/* Cash/Margin Card */}
      <CashMarginCard
        cashBalance={cashBalance}
        setCashBalance={setCashBalance}
        cashRate={cashRate}
        setCashRate={setCashRate}
        cashWeight={cashWeight}
        portfolioValue={portfolioValue}
      />
      
      {/* Exposure Charts Card */}
      <ExposureChartsCard
        positions={positions}
        portfolioValue={portfolioValue}
        grossLong={grossLong}
        grossShort={grossShort}
        grossPositionsValue={grossPositionsValue}
        netExposure={netExposure}
      />
    </div>
  );
});

// ============================================
// HEADER PANEL
// ============================================

const PositionsHeader = memo(({
  positions,
  isFetchingBetas,
  isFetchingData,
  isFetchingUnified,
  calculateAllBetas,
  refreshAllPrices,
  portfolioValue,
}) => {
  const positionCount = positions.length;
  const hasPositions = positionCount > 0;
  
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
            <span style={{ fontSize: '18px' }}>📊</span>
            Portfolio Positions
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Manage your holdings with real-time data</span>
            {hasPositions && (
              <span style={{ 
                background: 'rgba(0, 212, 255, 0.15)', 
                color: COLORS.cyan, 
                padding: '2px 6px', 
                borderRadius: '4px',
                fontSize: '9px',
              }}>
                {positionCount} position{positionCount !== 1 ? 's' : ''} • ${portfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} NLV
              </span>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={calculateAllBetas}
            disabled={isFetchingBetas || isFetchingUnified || !hasPositions}
            style={{
              padding: '8px 16px',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: '8px',
              border: '1px solid rgba(155, 89, 182, 0.3)',
              background: isFetchingBetas ? '#333' : 'rgba(155, 89, 182, 0.15)',
              color: isFetchingBetas ? '#666' : COLORS.purple,
              cursor: (isFetchingBetas || isFetchingUnified || !hasPositions) ? 'not-allowed' : 'pointer',
              opacity: !hasPositions ? 0.5 : 1,
              fontFamily: FONT_FAMILY,
              transition: 'all 0.2s ease',
            }}
          >
            {isFetchingBetas ? '⏳ Loading...' : (
              <>
                📈 Load Betas
                <kbd style={{ 
                  marginLeft: '8px', 
                  padding: '2px 6px', 
                  fontSize: '9px', 
                  background: 'rgba(255,255,255,0.1)', 
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontFamily: 'inherit',
                }}>Enter</kbd>
              </>
            )}
          </button>
          
          <button
            onClick={refreshAllPrices}
            disabled={isFetchingData || isFetchingUnified || !hasPositions}
            style={{
              padding: '8px 16px',
              fontSize: '11px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: (isFetchingData || !hasPositions) ? '#333' : 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
              color: '#fff',
              cursor: (isFetchingData || isFetchingUnified || !hasPositions) ? 'not-allowed' : 'pointer',
              opacity: !hasPositions ? 0.5 : 1,
              boxShadow: hasPositions && !isFetchingData ? '0 4px 15px rgba(0, 212, 255, 0.25)' : 'none',
              fontFamily: FONT_FAMILY,
              transition: 'all 0.2s ease',
            }}
          >
            {isFetchingData ? '⏳ Refreshing...' : (
              <>
                🔄 Refresh Prices
                <kbd style={{ 
                  marginLeft: '8px', 
                  padding: '2px 6px', 
                  fontSize: '9px', 
                  background: 'rgba(255,255,255,0.15)', 
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  fontFamily: 'inherit',
                }}>⌘L</kbd>
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Loading indicator */}
      {(isFetchingBetas || isFetchingData || isFetchingUnified) && (
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{ width: '100%', height: '3px', background: '#1a1a2e', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ 
              width: '30%',
              height: '100%',
              background: 'linear-gradient(90deg, #00d4ff, #7b2ff7)',
              animation: 'loading 1.5s ease-in-out infinite',
              borderRadius: '2px',
              willChange: 'transform',
            }} />
          </div>
          <style>{`
            @keyframes loading {
              0% { transform: translateX(-100%); }
              50% { transform: translateX(200%); }
              100% { transform: translateX(-100%); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
});

// ============================================
// SEARCH & FILTER BAR WITH DUAL METRICS
// ============================================

const SearchFilterBar = memo(({
  positionSearch,
  setPositionSearch,
  positionFilter,
  setPositionFilter,
  filteredCount,
  totalCount,
  portfolioWeightedBeta,
  portfolioWeightedVol,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  
  const filters = [
    { id: 'all', label: 'All', icon: '📋' },
    { id: 'long', label: 'Long', icon: '📈' },
    { id: 'short', label: 'Short', icon: '📉' },
    { id: 'etf', label: 'ETF', icon: '🏛️' },
    { id: 'equity', label: 'Stock', icon: '🏢' },
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
      {/* Top row: Search, Filters, Count */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: (portfolioWeightedBeta != null || portfolioWeightedVol != null) ? '16px' : 0 }}>
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '0 0 240px', minWidth: '200px' }}>
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: searchFocused ? COLORS.cyan : '#555',
            fontSize: '13px',
            transition: 'color 0.2s ease',
            pointerEvents: 'none',
          }}>
            🔍
          </div>
          <input
            type="text"
            placeholder="Search ticker or name..."
            value={positionSearch}
            onChange={(e) => setPositionSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              width: '100%',
              padding: '10px 32px 10px 36px',
              fontSize: '12px',
              fontFamily: FONT_FAMILY,
              background: 'rgba(0, 0, 0, 0.25)',
              border: searchFocused ? `1px solid ${COLORS.cyan}` : '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              color: '#fff',
              outline: 'none',
              transition: 'all 0.2s ease',
              boxShadow: searchFocused ? `0 0 0 3px rgba(0, 212, 255, 0.1)` : 'none',
            }}
          />
          {positionSearch && (
            <button 
              onClick={() => setPositionSearch('')} 
              style={{ 
                position: 'absolute', 
                right: '10px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: 'rgba(255, 255, 255, 0.1)', 
                border: 'none', 
                color: '#888', 
                cursor: 'pointer', 
                fontSize: '12px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              ×
            </button>
          )}
        </div>
        
        {/* Filter Pills with Icons */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '4px' }}>
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setPositionFilter(f.id)}
              style={{
                padding: '6px 12px',
                fontSize: '10px',
                fontWeight: '600',
                borderRadius: '6px',
                border: 'none',
                background: positionFilter === f.id 
                  ? 'linear-gradient(135deg, rgba(0, 212, 255, 0.25) 0%, rgba(123, 47, 247, 0.2) 100%)'
                  : 'transparent',
                color: positionFilter === f.id ? '#fff' : '#666',
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
                transition: 'all 0.2s ease',
                boxShadow: positionFilter === f.id ? '0 2px 8px rgba(0, 212, 255, 0.2)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '11px' }}>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>
        
        {/* Position Count Badge */}
        <div style={{ 
          padding: '6px 12px', 
          background: 'rgba(0, 212, 255, 0.08)', 
          borderRadius: '6px',
          fontSize: '11px',
          color: COLORS.cyan,
          fontWeight: '500',
        }}>
          {filteredCount} of {totalCount}
        </div>
      </div>
      
      {/* Bottom row: Dual Metric Panels */}
      {(portfolioWeightedBeta != null || portfolioWeightedVol != null) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {/* Beta Panel */}
          <MetricPanel
            icon="β"
            label="Portfolio Beta"
            value={portfolioWeightedBeta}
            format={(v) => v?.toFixed(2) || '—'}
            color={portfolioWeightedBeta != null 
              ? (portfolioWeightedBeta > 1.2 ? COLORS.red : portfolioWeightedBeta < 0.8 ? COLORS.green : COLORS.cyan)
              : '#666'}
            description={portfolioWeightedBeta != null 
              ? (portfolioWeightedBeta > 1.2 
                  ? 'High correlation — amplifies market moves'
                  : portfolioWeightedBeta < 0.8 
                    ? 'Low correlation — dampens market moves'
                    : portfolioWeightedBeta < 0 
                      ? 'Inverse correlation — moves opposite to market'
                      : 'Moderate correlation — tracks market closely')
              : 'Load betas to calculate'}
            tooltip="Beta measures how correlated your portfolio is to the S&P 500. β=1 means perfect correlation, β>1 means amplified market moves, β<1 means dampened moves."
          />
          
          {/* Volatility Panel - show expected daily range for intuitiveness */}
          <MetricPanel
            icon="σ"
            label="Daily Risk"
            value={portfolioWeightedVol}
            format={(v) => {
              if (v == null) return '—';
              // Convert annualized vol to daily vol: daily = annual / sqrt(252)
              const dailyVol = v / Math.sqrt(252);
              return `±${dailyVol.toFixed(2)}%`;
            }}
            color={portfolioWeightedVol != null 
              ? (portfolioWeightedVol > 35 ? COLORS.red : portfolioWeightedVol < 20 ? COLORS.green : COLORS.orange)
              : '#666'}
            description={portfolioWeightedVol != null 
              ? (portfolioWeightedVol > 35 
                  ? 'High risk — expect significant daily swings'
                  : portfolioWeightedVol < 20 
                    ? 'Low risk — relatively stable day-to-day'
                    : 'Moderate risk — normal market fluctuations')
              : 'Load betas to calculate'}
            tooltip={portfolioWeightedVol != null 
              ? `Expected daily move (1σ). Annualized volatility: ${portfolioWeightedVol.toFixed(1)}%`
              : 'Shows expected daily price movement based on historical volatility'}
          />
        </div>
      )}
    </div>
  );
});

// Metric Panel Component
const MetricPanel = memo(({ icon, label, value, format, color, description, tooltip }) => (
  <div 
    style={{ 
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 16px',
      background: 'rgba(0, 0, 0, 0.25)',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.05)',
    }}
    title={tooltip}
  >
    {/* Icon */}
    <div style={{
      width: '40px',
      height: '40px',
      borderRadius: '10px',
      background: `${color}15`,
      border: `1px solid ${color}30`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
      fontWeight: '700',
      color: color,
      fontFamily: 'Georgia, serif',
    }}>
      {icon}
    </div>
    
    {/* Value */}
    <div>
      <div style={{ fontSize: '9px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '22px', 
        fontWeight: '700', 
        color: color,
        lineHeight: 1.1,
      }}>
        {format(value)}
      </div>
    </div>
    
    {/* Description */}
    <div style={{ fontSize: '10px', color: '#555', flex: 1, paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
      {description}
    </div>
  </div>
));

// ============================================
// POSITIONS TABLE CARD
// ============================================

const PositionsTableCard = memo(({
  sortedPositions,
  positions,
  positionMetadata,
  positionBetas,
  positionSort,
  setPositionSort,
  positionSearch,
  setPositionSearch,
  positionFilter,
  setPositionFilter,
  portfolioValue,
  updatePosition,
  handleTickerChange,
  handleTickerBlur,
  handleTickerFocus,
  removePosition,
  setConfirmDialog,
  addPosition,
  onOpenAddModal,
  onOpenScreenshotImport,
  newestPositionId,
  editingPositionId,
}) => {
  // Refs for ticker inputs to handle auto-focus
  const tickerInputRefs = useRef({});
  
  // Track if we've already focused the newest position (to prevent re-focusing on state changes)
  const hasFocusedNewestRef = useRef(null);
  
  // Auto-focus the newest position's ticker input - only once when created
  useEffect(() => {
    // Only focus if this is a new newestPositionId we haven't focused yet
    if (newestPositionId !== null && 
        newestPositionId !== hasFocusedNewestRef.current && 
        tickerInputRefs.current[newestPositionId]) {
      tickerInputRefs.current[newestPositionId].focus();
      tickerInputRefs.current[newestPositionId].select();
      hasFocusedNewestRef.current = newestPositionId;
    }
    // Reset the ref when newestPositionId is cleared
    if (newestPositionId === null) {
      hasFocusedNewestRef.current = null;
    }
  }, [newestPositionId]);
  
  // Sparkline component
  const Sparkline = ({ data, width = 50, height = 20 }) => {
    if (!data || data.length < 2) return <span style={{ color: '#444', fontSize: '10px' }}>—</span>;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    const isUp = data[data.length - 1] >= data[0];
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <polyline 
          points={points} 
          fill="none" 
          stroke={isUp ? COLORS.green : COLORS.red} 
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };
  
  // Sortable header component with optional tooltip
  const SortHeader = ({ column, label, width, align, tooltip }) => {
    const isActive = positionSort.column === column;
    const [showTooltip, setShowTooltip] = useState(false);

    return (
      <th
        style={{
          textAlign: align || 'left',
          padding: '12px 8px',
          color: isActive ? COLORS.cyan : '#666',
          fontWeight: '600',
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          cursor: 'pointer',
          userSelect: 'none',
          width: width || 'auto',
          minWidth: width || 'auto',
          background: isActive ? 'rgba(0, 212, 255, 0.05)' : 'transparent',
          transition: 'all 0.2s ease',
          position: 'relative',
        }}
        onClick={() => setPositionSort(prev => ({
          column,
          direction: prev.column === column && prev.direction === 'desc' ? 'asc' : 'desc'
        }))}
        onMouseEnter={() => tooltip && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {label}
        {isActive && (
          <span style={{ marginLeft: '4px', color: COLORS.cyan }}>
            {positionSort.direction === 'desc' ? '↓' : '↑'}
          </span>
        )}
        {/* Tooltip - appears above */}
        {tooltip && showTooltip && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '8px 12px',
            background: 'rgba(20, 20, 35, 0.98)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: '6px',
            color: '#e0e0e0',
            fontSize: '11px',
            fontWeight: '400',
            textTransform: 'none',
            letterSpacing: 'normal',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'none',
          }}>
            {tooltip}
            {/* Arrow pointing down */}
            <div style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(0, 212, 255, 0.3)',
            }} />
          </div>
        )}
      </th>
    );
  };
  
  // Empty state
  if (sortedPositions.length === 0 && positions.length === 0) {
    return (
      <div style={{ 
        padding: '50px 24px', 
        textAlign: 'center', 
        background: 'linear-gradient(135deg, rgba(22, 27, 44, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(0, 212, 255, 0.08)',
        marginBottom: '16px',
        fontFamily: FONT_FAMILY,
      }}>
        <div style={{ 
          width: '70px', height: '70px', borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.15) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', margin: '0 auto 16px',
          border: '1px solid rgba(0, 212, 255, 0.15)',
        }}>
          📊
        </div>
        
        <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px', fontWeight: '600' }}>
          No Positions Yet
        </h3>
        <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: '12px', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
          Start building your portfolio by adding your first position.
        </p>
        <div style={{ 
          display: 'inline-flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', 
          padding: '14px 20px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '10px', marginBottom: '20px',
          textAlign: 'left',
        }}>
          {[
            'Stocks, ETFs, and international securities',
            'Long and short positions',
            'Real-time price updates',
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#666', fontSize: '11px' }}>
              <div style={{
                width: '18px', height: '18px', borderRadius: '4px',
                background: 'rgba(46, 204, 113, 0.15)',
                border: '1px solid rgba(46, 204, 113, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '10px', color: COLORS.green,
              }}>
                ✓
              </div>
              {item}
            </div>
          ))}
        </div>
        
        <div>
          <button 
            onClick={addPosition}
            style={{
              padding: '12px 24px',
              fontSize: '13px',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
              color: '#fff',
              cursor: 'pointer',
              fontFamily: FONT_FAMILY,
              boxShadow: '0 4px 15px rgba(0, 212, 255, 0.3)',
            }}
          >
            + Add First Position
          </button>
        </div>
      </div>
    );
  }
  
  // Filter empty state
  if (sortedPositions.length === 0 && positions.length > 0) {
    return (
      <div style={{ 
        padding: '50px 24px', 
        textAlign: 'center', 
        background: 'linear-gradient(135deg, rgba(22, 27, 44, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(0, 212, 255, 0.08)',
        marginBottom: '16px',
        fontFamily: FONT_FAMILY,
      }}>
        <div style={{ 
          width: '70px', height: '70px', borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(123, 47, 247, 0.15) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '32px', margin: '0 auto 16px',
          border: '1px solid rgba(0, 212, 255, 0.15)',
        }}>
          🔍
        </div>
        
        <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px', fontWeight: '600' }}>
          No Matches Found
        </h3>
        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '12px' }}>
          No positions match your current search or filter criteria.
        </p>
        <button 
          onClick={() => { setPositionSearch(''); setPositionFilter('all'); }}
          style={{
            padding: '10px 20px',
            fontSize: '12px',
            fontWeight: '600',
            borderRadius: '8px',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            background: 'rgba(0, 212, 255, 0.1)',
            color: COLORS.cyan,
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
          }}
        >
          Clear Filters
        </button>
      </div>
    );
  }
  
  // Column widths - defined once for consistency
  const colWidths = {
    ticker: '75px',
    name: '140px',
    qty: '75px',
    localPrice: '95px',
    priceUsd: '85px',
    value: '95px',
    weight: '65px',
    beta: '50px',
    vol: '50px',
    ytd: '55px',
    oneY: '55px',
    spark: '50px',
    action: '32px',
  };
  
  return (
    <div style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      overflow: 'hidden',
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
    }}>
      {/* Single table with header and body */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.04) 0%, rgba(123, 47, 247, 0.04) 100%)' }}>
              <SortHeader column="ticker" label="Ticker" width={colWidths.ticker} />
              <th style={{ ...thStyle, width: colWidths.name }}>Name / Type</th>
              <th style={{ ...thStyle, width: colWidths.qty }}>Qty</th>
              <th style={{ ...thStyle, width: colWidths.localPrice }}>Local Price</th>
              <th style={{ ...thStyle, width: colWidths.priceUsd }}>Price $</th>
              <SortHeader column="value" label="Value" width={colWidths.value} />
              <SortHeader column="weight" label="Wt%" width={colWidths.weight} />
              <SortHeader column="beta" label="β" width={colWidths.beta} align="center" tooltip="Beta: Correlation to S&P 500. β=1 tracks market, β>1 amplifies moves" />
              <SortHeader column="vol" label="σ" width={colWidths.vol} align="center" tooltip="Volatility: Annualized standard deviation of returns" />
              <SortHeader column="ytd" label="YTD" width={colWidths.ytd} align="center" tooltip="Year-to-date return since Jan 1" />
              <SortHeader column="1y" label="1Y" width={colWidths.oneY} align="center" tooltip="1-year trailing return" />
              <th style={{ ...thStyle, width: colWidths.spark, textAlign: 'center' }}>30D</th>
              <th style={{ ...thStyle, width: colWidths.action }}></th>
            </tr>
          </thead>
          <tbody>
            {sortedPositions.map((pos, idx) => {
              const posValue = pos.quantity * pos.price;
              const weight = portfolioValue !== 0 ? (posValue / portfolioValue) * 100 : 0;
              const meta = positionMetadata[pos.ticker?.toUpperCase()];
              const betaData = positionBetas[pos.ticker?.toUpperCase()];
              const hasForeignCurrency = pos.currency && pos.currency !== 'USD';
              const isLong = pos.quantity >= 0;
              const isNewest = pos.id === newestPositionId;
              const isEditing = pos.id === editingPositionId;
              const isHighlighted = isNewest || isEditing;
              
              return (
                <tr 
                  key={pos.id} 
                  style={{ 
                    background: isHighlighted 
                      ? 'rgba(0, 212, 255, 0.08)' 
                      : idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => { if (!isHighlighted) e.currentTarget.style.background = 'rgba(0, 212, 255, 0.04)'; }}
                  onMouseLeave={(e) => { if (!isHighlighted) e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'; }}
                >
                  <td style={{ ...tdStyle, width: colWidths.ticker }}>
                    <input
                      ref={el => tickerInputRefs.current[pos.id] = el}
                      style={{ ...inputStyle, width: '65px', fontWeight: '600' }}
                      value={pos.ticker}
                      onChange={(e) => handleTickerChange(pos.id, e.target.value.toUpperCase())}
                      onFocus={() => handleTickerFocus && handleTickerFocus(pos.id)}
                      onBlur={() => handleTickerBlur && handleTickerBlur(pos.id)}
                      placeholder="AAPL"
                    />
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.name }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {meta?.name && (
                        <span style={{ fontSize: '9px', color: '#777', maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {meta.name}
                        </span>
                      )}
                      <TypeBadge type={pos.type} />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.qty }}>
                    <BlurInput
                      style={{ ...inputStyle, width: '65px', color: isLong ? COLORS.green : COLORS.red, textAlign: 'right', fontWeight: '600' }}
                      type="text"
                      value={pos.quantity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      onChange={(v) => updatePosition(pos.id, 'quantity', parseInt(String(v).replace(/,/g, '')) || 0)}
                    />
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.localPrice }}>
                    {hasForeignCurrency ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '10px', color: COLORS.orange, fontWeight: '500' }}>
                          {pos.currency} {pos.domesticPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        {meta?.exchangeRate && (
                          <span style={{ fontSize: '8px', color: '#555' }}>
                            1 {pos.currency} = ${meta.exchangeRate.toFixed(4)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#555', fontSize: '9px' }}>USD</span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.priceUsd }}>
                    <BlurInput
                      style={{ ...inputStyle, width: '75px', textAlign: 'right' }}
                      type="text"
                      value={pos.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      onChange={(v) => updatePosition(pos.id, 'price', parseFloat(String(v).replace(/,/g, '')) || 0)}
                    />
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.value, fontWeight: '600', color: posValue >= 0 ? COLORS.green : COLORS.red, fontSize: '11px' }}>
                    {posValue >= 0 ? '' : '-'}${Math.abs(posValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.weight, color: weight >= 0 ? COLORS.green : COLORS.red, fontWeight: '600', fontSize: '11px' }}>
                    {weight >= 0 ? '+' : ''}{weight.toFixed(1)}%
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.beta, textAlign: 'center' }}>
                    {betaData?.beta != null ? (
                      <span 
                        style={{ 
                          color: betaData.beta > 1.5 ? COLORS.red : betaData.beta < 0.7 ? COLORS.green : '#fff', 
                          fontWeight: betaData.beta > 1.5 || betaData.beta < 0.5 ? '700' : '500',
                          fontSize: '10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                        title={betaData.isInternational 
                          ? `International stock - date-aligned beta${betaData.betaLag ? ` (lag: ${betaData.betaLag > 0 ? '+' : ''}${betaData.betaLag} day)` : ''}`
                          : `Beta vs SPY`}
                      >
                        {betaData.beta.toFixed(2)}
                        {betaData.isInternational && (
                          <span style={{ fontSize: '7px', opacity: 0.6 }}>🌍</span>
                        )}
                      </span>
                    ) : <span style={{ color: '#444', fontSize: '9px' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.vol, textAlign: 'center' }}>
                    {betaData?.volatility != null ? (
                      <span 
                        style={{ 
                          color: betaData.volatility > 40 ? COLORS.red : betaData.volatility < 20 ? COLORS.green : COLORS.orange, 
                          fontWeight: betaData.volatility > 40 ? '700' : '500',
                          fontSize: '10px',
                        }}
                        title={`Annualized: ${betaData.volatility.toFixed(1)}% | Daily: ±${(betaData.volatility / Math.sqrt(252)).toFixed(2)}%`}
                      >
                        {betaData.volatility.toFixed(0)}%
                      </span>
                    ) : <span style={{ color: '#444', fontSize: '9px' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.ytd, textAlign: 'center' }}>
                    {betaData?.ytdReturn != null ? (
                      <span style={{ color: betaData.ytdReturn >= 0 ? COLORS.green : COLORS.red, fontSize: '9px', fontWeight: '500' }}>
                        {betaData.ytdReturn >= 0 ? '+' : ''}{(betaData.ytdReturn * 100).toFixed(0)}%
                      </span>
                    ) : <span style={{ color: '#444', fontSize: '9px' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.oneY, textAlign: 'center' }}>
                    {betaData?.oneYearReturn != null ? (
                      <span style={{ color: betaData.oneYearReturn >= 0 ? COLORS.green : COLORS.red, fontSize: '9px', fontWeight: '500' }}>
                        {betaData.oneYearReturn >= 0 ? '+' : ''}{(betaData.oneYearReturn * 100).toFixed(0)}%
                      </span>
                    ) : <span style={{ color: '#444', fontSize: '9px' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.spark, textAlign: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <Sparkline data={betaData?.sparklineData} width={40} height={16} />
                    </div>
                  </td>
                  <td style={{ ...tdStyle, width: colWidths.action }}>
                    <button 
                      style={deleteButtonStyle} 
                      onClick={() => setConfirmDialog({
                        title: `Remove ${pos.ticker || 'Position'}?`,
                        message: `This will remove ${pos.ticker || 'this position'} (${pos.quantity} shares, $${Math.abs(pos.quantity * pos.price).toLocaleString()}) from your portfolio.`,
                        confirmLabel: 'Remove',
                        confirmVariant: 'danger',
                        onConfirm: () => removePosition(pos.id),
                      })}
                      title={`Remove ${pos.ticker}`}
                      aria-label={`Remove ${pos.ticker} position`}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Add Position Button Footer */}
      <div style={{ 
        padding: '12px 16px', 
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        display: 'flex',
        justifyContent: 'flex-start',
        gap: '10px',
      }}>
        <button 
          onClick={onOpenAddModal || addPosition}
          style={{
            padding: '8px 16px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
            color: '#fff',
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            boxShadow: '0 4px 12px rgba(0, 212, 255, 0.2)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <span>+</span> Add Positions
        </button>
        {onOpenAddModal && (
          <button 
            onClick={addPosition}
            style={{
              padding: '8px 12px',
              fontSize: '10px',
              fontWeight: '500',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              fontFamily: FONT_FAMILY,
              transition: 'all 0.2s ease',
            }}
            title="Add empty row for quick inline editing"
          >
            Quick Add Row
          </button>
        )}
        {onOpenScreenshotImport && (
          <button
            onClick={onOpenScreenshotImport}
            style={{
              padding: '8px 12px',
              fontSize: '10px',
              fontWeight: '500',
              borderRadius: '8px',
              border: '1px solid rgba(155, 89, 182, 0.3)',
              background: 'rgba(155, 89, 182, 0.1)',
              color: COLORS.purple,
              cursor: 'pointer',
              fontFamily: FONT_FAMILY,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Import positions from a screenshot using AI"
          >
            <span>📷</span> Screenshot Import
          </button>
        )}
      </div>
    </div>
  );
});

// Type Badge Component
const TypeBadge = memo(({ type }) => {
  const configs = {
    ETF: { bg: 'rgba(0, 212, 255, 0.15)', color: COLORS.cyan, border: 'rgba(0, 212, 255, 0.3)' },
    Equity: { bg: 'rgba(46, 204, 113, 0.15)', color: COLORS.green, border: 'rgba(46, 204, 113, 0.3)' },
    Option: { bg: 'rgba(155, 89, 182, 0.15)', color: COLORS.purple, border: 'rgba(155, 89, 182, 0.3)' },
  };
  const config = configs[type] || configs.Equity;
  
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      fontSize: '8px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.3px',
      borderRadius: '4px',
      background: config.bg,
      color: config.color,
      border: `1px solid ${config.border}`,
    }}>
      {type}
    </span>
  );
});

// Shared table styles
const thStyle = {
  textAlign: 'left',
  padding: '12px 8px',
  color: '#666',
  fontWeight: '600',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  borderBottom: '2px solid rgba(0, 212, 255, 0.1)',
};

const tdStyle = {
  padding: '8px 6px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
};

const inputStyle = {
  padding: '5px 6px',
  fontSize: '11px',
  fontFamily: FONT_FAMILY,
  fontWeight: '500',
  background: 'rgba(0, 0, 0, 0.25)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '5px',
  color: '#fff',
  outline: 'none',
};

const deleteButtonStyle = {
  width: '22px',
  height: '22px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(231, 76, 60, 0.1)',
  border: '1px solid rgba(231, 76, 60, 0.2)',
  borderRadius: '5px',
  color: COLORS.red,
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '600',
  transition: 'all 0.2s ease',
};

// ============================================
// CASH/MARGIN CARD
// ============================================

const CashMarginCard = memo(({
  cashBalance,
  setCashBalance,
  cashRate,
  setCashRate,
  cashWeight,
  portfolioValue,
}) => {
  const isCash = cashBalance >= 0;
  const accentColor = isCash ? COLORS.green : COLORS.red;
  
  return (
    <div style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: `1px solid ${isCash ? 'rgba(46, 204, 113, 0.15)' : 'rgba(231, 76, 60, 0.15)'}`,
      padding: '16px 20px',
      marginBottom: '16px',
      fontFamily: FONT_FAMILY,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Icon */}
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: `${accentColor}15`,
            border: `1px solid ${accentColor}30`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
          }}>
            {isCash ? '💵' : '💳'}
          </div>
          
          {/* Title & Inputs */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: '600', color: accentColor, marginBottom: '8px' }}>
              {isCash ? 'Cash Balance' : 'Margin Balance'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#666' }}>Amount:</span>
                <span style={{ color: '#888', fontSize: '13px' }}>$</span>
                <BlurInput 
                  type="number" 
                  value={cashBalance} 
                  onChange={(v) => setCashBalance(parseFloat(v) || 0)} 
                  style={{ 
                    ...inputStyle, 
                    width: '100px',
                    color: accentColor,
                    fontWeight: '600',
                  }} 
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: '#666' }}>Rate:</span>
                <BlurInput 
                  type="number" 
                  value={(cashRate * 100).toFixed(1)} 
                  onChange={(v) => setCashRate((parseFloat(v) || 0) / 100)} 
                  style={{ ...inputStyle, width: '60px' }} 
                />
                <span style={{ fontSize: '11px', color: '#666' }}>%</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: accentColor }}>
              ${Math.abs(cashBalance).toLocaleString()}
            </div>
            <div style={{ fontSize: '10px', color: '#666' }}>
              {portfolioValue > 0 ? `${(cashWeight * 100).toFixed(1)}% of NLV` : '—'}
            </div>
          </div>
          <div style={{
            padding: '8px 12px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '12px', color: isCash ? COLORS.green : COLORS.orange, fontWeight: '600' }}>
              {isCash ? '+' : '-'}{(cashRate * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '9px', color: '#555' }}>{isCash ? 'earns' : 'costs'}/yr</div>
          </div>
        </div>
      </div>
      
      {/* Helper text */}
      <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.04)' }}>
        <div style={{ fontSize: '10px', color: '#555' }}>
          {isCash 
            ? '💡 Positive = cash/money market earning interest' 
            : '💡 Negative = margin borrowing (costs interest)'}
        </div>
      </div>
    </div>
  );
});

// ============================================
// EXPOSURE CHARTS CARD
// ============================================

const ExposureChartsCard = memo(({
  positions,
  portfolioValue,
  grossLong,
  grossShort,
  grossPositionsValue,
  netExposure,
}) => {
  // Track expanded state for long/short position lists
  const [longsExpanded, setLongsExpanded] = useState(false);
  const [shortsExpanded, setShortsExpanded] = useState(false);

  const nlv = Math.abs(portfolioValue) || 1;
  
  // Calculate position data for charts
  const longs = positions
    .filter(p => p.quantity > 0)
    .map(p => ({ ticker: p.ticker || 'Unknown', value: p.quantity * p.price }))
    .sort((a, b) => b.value - a.value);
  
  const shorts = positions
    .filter(p => p.quantity < 0)
    .map(p => ({ ticker: p.ticker || 'Unknown', value: Math.abs(p.quantity * p.price) }))
    .sort((a, b) => b.value - a.value);
  
  const totalLong = longs.reduce((sum, p) => sum + p.value, 0);
  const totalShort = shorts.reduce((sum, p) => sum + p.value, 0);
  
  return (
    <div style={{
      background: 'rgba(22, 27, 44, 0.7)',
      borderRadius: '14px',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      padding: '20px',
      fontFamily: FONT_FAMILY,
    }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>📊</span> Portfolio Exposure
      </div>
      
      {/* 4-Column Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Gross Long', value: grossLong, pct: (grossLong / nlv) * 100, color: COLORS.green },
          { label: 'Gross Short', value: grossShort, pct: (grossShort / nlv) * 100, color: COLORS.red },
          { label: 'Gross Exposure', value: grossPositionsValue, pct: (grossPositionsValue / nlv) * 100, color: COLORS.orange },
          { label: 'Net Exposure', value: netExposure, pct: (netExposure / nlv) * 100, color: netExposure >= 0 ? COLORS.cyan : COLORS.red },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '14px',
            background: `rgba(${stat.color === COLORS.green ? '46,204,113' : stat.color === COLORS.red ? '231,76,60' : stat.color === COLORS.cyan ? '0,212,255' : '255,159,67'}, 0.08)`,
            borderRadius: '10px',
            textAlign: 'center',
            border: `1px solid ${stat.color}15`,
          }}>
            <div style={{ fontSize: '20px', fontWeight: '700', color: stat.color }}>
              ${stat.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={{ fontSize: '11px', color: stat.color, marginTop: '2px', fontWeight: '500' }}>
              {stat.pct.toFixed(0)}% of NLV
            </div>
            <div style={{ fontSize: '9px', color: '#666', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
      
      {/* Long/Short Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Long Positions */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: COLORS.green, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📈</span> Long Positions
            <span style={{ color: '#555', fontWeight: '400' }}>% of NLV</span>
          </div>
          {longs.length === 0 ? (
            <div style={{ color: '#555', fontSize: '11px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center' }}>
              No long positions
            </div>
          ) : (
            <div>
              {(longsExpanded ? longs : longs.slice(0, 8)).map((p, i) => {
                const pctOfNLV = (p.value / nlv) * 100;
                return (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                      <span style={{ color: '#fff', fontWeight: '500' }}>{p.ticker}</span>
                      <span style={{ color: COLORS.green }}>
                        ${p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span style={{ opacity: 0.7, marginLeft: '4px' }}>({pctOfNLV.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(46, 204, 113, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, pctOfNLV)}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${COLORS.green} 0%, rgba(46, 204, 113, 0.6) 100%)`,
                        borderRadius: '3px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
              {longs.length > 8 && (
                <button
                  onClick={() => setLongsExpanded(!longsExpanded)}
                  style={{
                    fontSize: '10px',
                    color: COLORS.cyan,
                    marginTop: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {longsExpanded ? (
                    <>▲ Show less</>
                  ) : (
                    <>▼ +{longs.length - 8} more positions</>
                  )}
                </button>
              )}
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(46, 204, 113, 0.15)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600' }}>
                <span style={{ color: '#fff' }}>Total Long</span>
                <span style={{ color: COLORS.green }}>
                  ${totalLong.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((totalLong / nlv) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Short Positions */}
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: COLORS.red, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>📉</span> Short Positions
            <span style={{ color: '#555', fontWeight: '400' }}>% of NLV</span>
          </div>
          {shorts.length === 0 ? (
            <div style={{ color: '#555', fontSize: '11px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', textAlign: 'center' }}>
              No short positions
            </div>
          ) : (
            <div>
              {(shortsExpanded ? shorts : shorts.slice(0, 8)).map((p, i) => {
                const pctOfNLV = (p.value / nlv) * 100;
                return (
                  <div key={i} style={{ marginBottom: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' }}>
                      <span style={{ color: '#fff', fontWeight: '500' }}>{p.ticker}</span>
                      <span style={{ color: COLORS.red }}>
                        ${p.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        <span style={{ opacity: 0.7, marginLeft: '4px' }}>({pctOfNLV.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(231, 76, 60, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, pctOfNLV)}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${COLORS.red} 0%, rgba(231, 76, 60, 0.6) 100%)`,
                        borderRadius: '3px',
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                  </div>
                );
              })}
              {shorts.length > 8 && (
                <button
                  onClick={() => setShortsExpanded(!shortsExpanded)}
                  style={{
                    fontSize: '10px',
                    color: COLORS.cyan,
                    marginTop: '8px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {shortsExpanded ? (
                    <>▲ Show less</>
                  ) : (
                    <>▼ +{shorts.length - 8} more positions</>
                  )}
                </button>
              )}
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(231, 76, 60, 0.15)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600' }}>
                <span style={{ color: '#fff' }}>Total Short</span>
                <span style={{ color: COLORS.red }}>
                  ${totalShort.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({((totalShort / nlv) * 100).toFixed(0)}%)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer note */}
      <div style={{ 
        marginTop: '16px', 
        padding: '10px 12px', 
        background: 'rgba(0, 212, 255, 0.06)', 
        borderRadius: '8px', 
        fontSize: '10px', 
        color: '#666',
        border: '1px solid rgba(0, 212, 255, 0.1)',
      }}>
        💡 <span style={{ color: '#888' }}>NLV = Net Liquidation Value (positions + cash).</span>
        {' '}Gross exposure shows total market risk, net exposure shows directional bias.
      </div>
    </div>
  );
});

export default PositionsTab;
