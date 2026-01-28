/**
 * Add Positions Modal
 * 
 * @module components/common/AddPositionsModal
 * @description Modal for batch-adding positions with multi-ticker support
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

const COLORS = {
  cyan: '#00d4ff',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#f39c12',
  purple: '#9b59b6',
  gold: '#f1c40f',
};

const AddPositionsModal = ({ 
  isOpen, 
  onClose, 
  onAddPositions,
  existingTickers = [],
  fetchPriceForTicker,
}) => {
  // Pending positions to be added
  const [pendingPositions, setPendingPositions] = useState([]);
  
  // Individual add inputs
  const [tickerInput, setTickerInput] = useState('');
  const [qtyInput, setQtyInput] = useState('');
  
  // Bulk add textarea
  const [bulkInput, setBulkInput] = useState('');
  
  // Loading state for price fetching
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  
  // Refs
  const tickerInputRef = useRef(null);
  const bulkInputRef = useRef(null);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPendingPositions([]);
      setTickerInput('');
      setQtyInput('');
      setBulkInput('');
      setIsFetchingPrices(false);
      // Focus ticker input after a short delay
      setTimeout(() => {
        tickerInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
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
  
  // Parse a single line into ticker and quantity
  const parseLine = (line) => {
    const trimmed = line.trim().toUpperCase();
    if (!trimmed) return null;
    
    // Try different formats:
    // "AAPL 100", "AAPL,100", "AAPL\t100", "AAPL"
    const patterns = [
      /^([A-Z0-9.-]+)\s+(-?\d+)$/,      // AAPL 100 or AAPL -100
      /^([A-Z0-9.-]+),\s*(-?\d+)$/,     // AAPL,100 or AAPL, 100
      /^([A-Z0-9.-]+)\t(-?\d+)$/,       // AAPL<tab>100
      /^([A-Z0-9.-]+)$/,                 // Just ticker
    ];
    
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        return {
          ticker: match[1],
          quantity: match[2] ? parseInt(match[2], 10) : 0,
        };
      }
    }
    
    return null;
  };
  
  // Add individual position
  const handleAddIndividual = useCallback(() => {
    const ticker = tickerInput.trim().toUpperCase();
    const qty = parseInt(qtyInput, 10) || 0;
    
    if (!ticker) {
      tickerInputRef.current?.focus();
      return;
    }
    
    // Check for duplicates in pending list
    const isDuplicatePending = pendingPositions.some(p => p.ticker === ticker);
    
    // Check for duplicates in existing portfolio
    const isDuplicateExisting = existingTickers.includes(ticker);
    
    const newPosition = {
      id: Date.now() + Math.random(),
      ticker,
      quantity: qty,
      price: null, // Will be fetched
      isDuplicate: isDuplicatePending || isDuplicateExisting,
      duplicateType: isDuplicatePending ? 'pending' : isDuplicateExisting ? 'existing' : null,
    };
    
    setPendingPositions(prev => [...prev, newPosition]);
    setTickerInput('');
    setQtyInput('');
    tickerInputRef.current?.focus();
  }, [tickerInput, qtyInput, pendingPositions, existingTickers]);
  
  // Handle Enter key in individual inputs
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddIndividual();
    }
  };
  
  // Parse bulk input
  const handleParseBulk = useCallback(() => {
    const lines = bulkInput.split('\n').filter(line => line.trim());
    const parsed = [];
    
    for (const line of lines) {
      const result = parseLine(line);
      if (result) {
        const isDuplicatePending = pendingPositions.some(p => p.ticker === result.ticker) ||
                                   parsed.some(p => p.ticker === result.ticker);
        const isDuplicateExisting = existingTickers.includes(result.ticker);
        
        parsed.push({
          id: Date.now() + Math.random(),
          ticker: result.ticker,
          quantity: result.quantity,
          price: null,
          isDuplicate: isDuplicatePending || isDuplicateExisting,
          duplicateType: isDuplicatePending ? 'pending' : isDuplicateExisting ? 'existing' : null,
        });
      }
    }
    
    if (parsed.length > 0) {
      setPendingPositions(prev => [...prev, ...parsed]);
      setBulkInput('');
    }
  }, [bulkInput, pendingPositions, existingTickers]);
  
  // Remove pending position
  const handleRemovePending = (id) => {
    setPendingPositions(prev => prev.filter(p => p.id !== id));
  };
  
  // Update quantity for pending position
  const handleUpdateQty = (id, newQty) => {
    setPendingPositions(prev => prev.map(p => 
      p.id === id ? { ...p, quantity: parseInt(newQty, 10) || 0 } : p
    ));
  };
  
  // Fetch prices for all pending positions
  // Also tries to find correct ticker symbols (e.g., BESI -> BESI.AS)
  // Handles currency conversion to USD
  const handleFetchPrices = async () => {
    if (!fetchPriceForTicker || pendingPositions.length === 0) return;
    
    setIsFetchingPrices(true);
    setFetchProgress({ current: 0, total: pendingPositions.length });
    
    const updatedPositions = [...pendingPositions];
    
    for (let i = 0; i < updatedPositions.length; i++) {
      const pos = updatedPositions[i];
      if (pos.price === null && !pos.notFound) {
        try {
          const result = await fetchPriceForTicker(pos.ticker);
          if (result && result.price) {
            // Update with fetched data - includes currency conversion
            updatedPositions[i] = { 
              ...pos, 
              price: result.price,              // USD price
              ticker: result.ticker || pos.ticker, // Use corrected ticker if found
              name: result.name || null,
              wasAutoCorrected: result.ticker && result.ticker !== pos.ticker,
              currency: result.currency || 'USD',
              domesticPrice: result.domesticPrice || result.price,
              exchangeRate: result.exchangeRate || 1,
            };
          } else {
            // Mark as not found but don't set a default price
            updatedPositions[i] = { ...pos, notFound: true };
          }
        } catch (err) {
          console.error(`Failed to fetch price for ${pos.ticker}:`, err);
          updatedPositions[i] = { ...pos, notFound: true };
        }
      }
      setFetchProgress({ current: i + 1, total: pendingPositions.length });
      setPendingPositions([...updatedPositions]);
    }
    
    setIsFetchingPrices(false);
  };
  
  // Add all positions to portfolio
  const handleAddToPortfolio = () => {
    if (pendingPositions.length === 0) return;
    
    // Filter out positions with no ticker and prepare for adding
    // Include currency info so positions display correctly
    const validPositions = pendingPositions
      .filter(p => p.ticker)
      .map(p => ({
        ticker: p.ticker,
        quantity: p.quantity,
        price: p.price || 100,
        currency: p.currency || 'USD',
        domesticPrice: p.domesticPrice || p.price || 100,
      }));
    
    if (validPositions.length > 0) {
      onAddPositions(validPositions);
      onClose();
    }
  };
  
  // Calculate totals
  const totalValue = pendingPositions.reduce((sum, p) => {
    const price = p.price || 0;
    return sum + (p.quantity * price);
  }, 0);
  
  const hasAnyDuplicates = pendingPositions.some(p => p.isDuplicate);
  const hasAnyNotFound = pendingPositions.some(p => p.notFound);
  const allHavePrices = pendingPositions.every(p => p.price !== null || p.notFound);
  const needsPriceFetch = pendingPositions.some(p => p.price === null && !p.notFound);
  
  if (!isOpen) return null;
  
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>📊</div>
          <h2 style={styles.title}>Add Positions</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        
        {/* Content */}
        <div style={styles.content}>
          {/* Bulk Add Section */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <span style={styles.sectionIcon}>📝</span>
              <span style={styles.sectionTitle}>Quick Add (paste multiple)</span>
            </div>
            <p style={styles.sectionDesc}>
              Enter one position per line: <code style={styles.code}>TICKER QTY</code> (e.g., <code style={styles.code}>AAPL 100</code>)
            </p>
            <textarea
              ref={bulkInputRef}
              style={styles.textarea}
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="AAPL 100&#10;MSFT 50&#10;GOOG -25"
              rows={4}
            />
            <button 
              style={styles.parseButton}
              onClick={handleParseBulk}
              disabled={!bulkInput.trim()}
            >
              Parse & Add ↓
            </button>
          </div>
          
          {/* Divider */}
          <div style={styles.divider}>
            <span style={styles.dividerText}>or add individually</span>
          </div>
          
          {/* Individual Add Section */}
          <div style={styles.individualAdd}>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Ticker</label>
              <input
                ref={tickerInputRef}
                style={styles.input}
                type="text"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                placeholder="AAPL"
                maxLength={10}
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Quantity</label>
              <input
                style={{ ...styles.input, width: '100px' }}
                type="number"
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="100"
              />
            </div>
            <button 
              style={styles.addButton}
              onClick={handleAddIndividual}
              disabled={!tickerInput.trim()}
            >
              + Add
            </button>
          </div>
          
          {/* Pending Positions List */}
          {pendingPositions.length > 0 && (
            <div style={styles.pendingSection}>
              <div style={styles.pendingHeader}>
                <span>Pending Positions ({pendingPositions.length})</span>
                {needsPriceFetch && (
                  <button 
                    style={styles.fetchButton}
                    onClick={handleFetchPrices}
                    disabled={isFetchingPrices}
                  >
                    {isFetchingPrices 
                      ? `Fetching ${fetchProgress.current}/${fetchProgress.total}...` 
                      : '📡 Fetch Prices'}
                  </button>
                )}
              </div>
              
              <div style={styles.pendingTable}>
                <div style={styles.pendingTableHeader}>
                  <span style={{ width: '120px' }}>Ticker</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>Quantity</span>
                  <span style={{ width: '80px', textAlign: 'right' }}>Price</span>
                  <span style={{ width: '100px', textAlign: 'right' }}>Value</span>
                  <span style={{ width: '32px', textAlign: 'right' }}></span>
                </div>
                
                <div style={styles.pendingTableBody}>
                  {pendingPositions.map(pos => {
                    const value = pos.price ? pos.quantity * pos.price : null;
                    const isLong = pos.quantity >= 0;
                    
                    return (
                      <div 
                        key={pos.id} 
                        style={{
                          ...styles.pendingRow,
                          ...(pos.isDuplicate ? styles.duplicateRow : {}),
                          ...(pos.notFound ? styles.notFoundRow : {}),
                          ...(pos.wasAutoCorrected ? styles.correctedRow : {}),
                        }}
                      >
                        <span style={{ 
                          width: '120px', 
                          fontWeight: '600', 
                          color: pos.notFound ? COLORS.red : pos.wasAutoCorrected ? COLORS.green : COLORS.cyan,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {pos.ticker}
                            {pos.isDuplicate && (
                              <span style={styles.duplicateBadge} title={
                                pos.duplicateType === 'existing' 
                                  ? 'Already in portfolio' 
                                  : 'Duplicate in this list'
                              }>
                                ⚠️
                              </span>
                            )}
                            {pos.wasAutoCorrected && (
                              <span style={styles.correctedBadge} title="Ticker was auto-corrected">
                                ✓
                              </span>
                            )}
                            {pos.notFound && (
                              <span style={styles.notFoundBadge} title="Ticker not found">
                                ✗
                              </span>
                            )}
                          </span>
                          {pos.name && (
                            <span style={{ 
                              fontSize: '9px', 
                              color: 'rgba(255,255,255,0.5)', 
                              fontWeight: '400',
                              maxWidth: '110px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {pos.name}
                            </span>
                          )}
                        </span>
                        <span style={{ width: '80px', textAlign: 'right' }}>
                          <input
                            style={styles.qtyInput}
                            type="number"
                            value={pos.quantity}
                            onChange={(e) => handleUpdateQty(pos.id, e.target.value)}
                          />
                        </span>
                        <span style={{ 
                          width: '80px', 
                          textAlign: 'right',
                          color: pos.price ? '#fff' : pos.notFound ? COLORS.red : '#555',
                          fontSize: '11px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-end',
                          gap: '2px',
                        }}>
                          {pos.price ? (
                            <>
                              <span>${pos.price.toFixed(2)}</span>
                              {pos.currency && pos.currency !== 'USD' && (
                                <span style={{ 
                                  fontSize: '9px', 
                                  color: COLORS.orange,
                                }}>
                                  {pos.currency} {pos.domesticPrice?.toFixed(2)}
                                </span>
                              )}
                            </>
                          ) : pos.notFound ? 'N/A' : '—'}
                        </span>
                        <span style={{ 
                          width: '100px', 
                          textAlign: 'right',
                          fontWeight: '600',
                          color: value === null ? '#555' : isLong ? COLORS.green : COLORS.red,
                        }}>
                          {value !== null 
                            ? `${value >= 0 ? '' : '-'}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                            : '—'
                          }
                        </span>
                        <span style={{ marginLeft: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                          <button 
                            style={styles.removeButton}
                            onClick={() => handleRemovePending(pos.id)}
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
                
                {/* Total row */}
                {allHavePrices && (
                  <div style={styles.totalRow}>
                    <span style={{ width: '120px', fontWeight: '600' }}>Total</span>
                    <span style={{ width: '80px' }}></span>
                    <span style={{ width: '80px' }}></span>
                    <span style={{ 
                      width: '100px', 
                      textAlign: 'right',
                      fontWeight: '700',
                      color: totalValue >= 0 ? COLORS.green : COLORS.red,
                    }}>
                      {totalValue >= 0 ? '' : '-'}${Math.abs(totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                    <span style={{ width: '32px' }}></span>
                  </div>
                )}
              </div>
              
              {/* Duplicate warning */}
              {hasAnyDuplicates && (
                <div style={styles.warningBox}>
                  <span style={styles.warningIcon}>⚠️</span>
                  <span>Some tickers already exist. Adding duplicates will create separate positions.</span>
                </div>
              )}
              
              {/* Not found warning */}
              {hasAnyNotFound && (
                <div style={styles.errorBox}>
                  <span style={styles.warningIcon}>✗</span>
                  <span>Some tickers were not found. They will be added without a price.</span>
                </div>
              )}
            </div>
          )}
          
          {/* Empty state */}
          {pendingPositions.length === 0 && (
            <div style={styles.emptyState}>
              <span style={styles.emptyIcon}>📋</span>
              <span>No positions added yet</span>
              <span style={styles.emptyHint}>Enter tickers above to get started</span>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>
          <button 
            style={{
              ...styles.confirmButton,
              opacity: pendingPositions.length === 0 ? 0.5 : 1,
            }}
            onClick={handleAddToPortfolio}
            disabled={pendingPositions.length === 0}
          >
            Add {pendingPositions.length > 0 ? `${pendingPositions.length} Position${pendingPositions.length > 1 ? 's' : ''}` : ''} to Portfolio
          </button>
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
    maxWidth: '600px',
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
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
  },
  
  section: {
    marginBottom: '16px',
  },
  
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  
  sectionIcon: {
    fontSize: '16px',
  },
  
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
  },
  
  sectionDesc: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: '8px',
    margin: '0 0 8px 0',
  },
  
  code: {
    background: 'rgba(0, 212, 255, 0.1)',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    color: COLORS.cyan,
  },
  
  textarea: {
    width: '100%',
    padding: '12px',
    fontSize: '13px',
    fontFamily: 'SF Mono, Monaco, Consolas, monospace',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    resize: 'vertical',
    minHeight: '80px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  
  parseButton: {
    marginTop: '8px',
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '600',
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '6px',
    color: COLORS.cyan,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  
  divider: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    margin: '20px 0',
  },
  
  dividerText: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.3)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    whiteSpace: 'nowrap',
    background: 'linear-gradient(180deg, rgba(30, 30, 50, 0.98) 0%, rgba(20, 20, 35, 0.98) 100%)',
    padding: '0 12px',
  },
  
  individualAdd: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    marginBottom: '20px',
  },
  
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  
  inputLabel: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  
  input: {
    padding: '10px 12px',
    fontSize: '13px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    outline: 'none',
    width: '120px',
  },
  
  addButton: {
    padding: '10px 20px',
    fontSize: '12px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    whiteSpace: 'nowrap',
  },
  
  pendingSection: {
    marginTop: '20px',
  },
  
  pendingHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
  },
  
  fetchButton: {
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: '500',
    background: 'rgba(46, 204, 113, 0.1)',
    border: '1px solid rgba(46, 204, 113, 0.3)',
    borderRadius: '6px',
    color: COLORS.green,
    cursor: 'pointer',
  },
  
  pendingTable: {
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  
  pendingTableHeader: {
    display: 'flex',
    padding: '10px 12px',
    background: 'rgba(0, 0, 0, 0.3)',
    fontSize: '10px',
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  
  pendingTableBody: {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  
  pendingRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
    fontSize: '12px',
    color: '#fff',
  },
  
  duplicateRow: {
    background: 'rgba(243, 156, 18, 0.05)',
  },
  
  notFoundRow: {
    background: 'rgba(231, 76, 60, 0.05)',
  },
  
  correctedRow: {
    background: 'rgba(46, 204, 113, 0.05)',
  },
  
  duplicateBadge: {
    fontSize: '10px',
  },
  
  notFoundBadge: {
    fontSize: '10px',
    color: COLORS.red,
  },
  
  correctedBadge: {
    fontSize: '10px',
    color: COLORS.green,
  },
  
  qtyInput: {
    width: '70px',
    padding: '4px 8px',
    fontSize: '12px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    color: '#fff',
    textAlign: 'right',
    outline: 'none',
  },
  
  removeButton: {
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '4px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: COLORS.red,
    fontSize: '14px',
  },
  
  totalRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    fontSize: '12px',
    color: '#fff',
  },
  
  warningBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    padding: '10px 12px',
    background: 'rgba(243, 156, 18, 0.1)',
    border: '1px solid rgba(243, 156, 18, 0.2)',
    borderRadius: '8px',
    fontSize: '12px',
    color: COLORS.orange,
  },
  
  warningIcon: {
    fontSize: '14px',
  },
  
  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    padding: '10px 12px',
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.2)',
    borderRadius: '8px',
    fontSize: '12px',
    color: COLORS.red,
  },
  
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: '13px',
    gap: '8px',
  },
  
  emptyIcon: {
    fontSize: '32px',
    opacity: 0.5,
  },
  
  emptyHint: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.3)',
  },
  
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '16px 24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'rgba(0, 0, 0, 0.2)',
  },
  
  cancelButton: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '500',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  
  confirmButton: {
    padding: '10px 24px',
    fontSize: '13px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
};

export default AddPositionsModal;
