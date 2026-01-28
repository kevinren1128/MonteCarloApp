/**
 * Screenshot Import Modal
 *
 * @module components/common/ScreenshotImportModal
 * @description Modal for importing positions from a screenshot using AI vision
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  extractPositionsFromImage,
  processImageFile,
  saveApiSettings,
  getApiSettings,
  clearApiSettings,
} from '../../services/visionService';

const COLORS = {
  cyan: '#00d4ff',
  green: '#2ecc71',
  red: '#e74c3c',
  orange: '#f39c12',
  purple: '#9b59b6',
  gold: '#f1c40f',
};

const ScreenshotImportModal = ({
  isOpen,
  onClose,
  onImportPositions,
  existingTickers = [],
  fetchPriceForTicker,
}) => {
  // Step state: 'upload' | 'processing' | 'review' | 'error'
  const [step, setStep] = useState('upload');

  // Image state
  const [imageData, setImageData] = useState(null); // { base64, mediaType, preview }
  const [isDragging, setIsDragging] = useState(false);

  // API settings
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState('claude');
  const [saveKey, setSaveKey] = useState(true);
  const [showKey, setShowKey] = useState(false);

  // Extracted positions
  const [extractedPositions, setExtractedPositions] = useState([]);
  const [extractionMeta, setExtractionMeta] = useState({ confidence: null, notes: null });

  // Error state
  const [error, setError] = useState(null);

  // Price fetching
  const [isFetchingPrices, setIsFetchingPrices] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });

  // Refs
  const fileInputRef = useRef(null);
  const dropzoneRef = useRef(null);

  // Load saved settings on mount
  useEffect(() => {
    const saved = getApiSettings();
    if (saved) {
      setApiKey(saved.apiKey || '');
      setProvider(saved.provider || 'claude');
    }
  }, []);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setImageData(null);
      setExtractedPositions([]);
      setExtractionMeta({ confidence: null, notes: null });
      setError(null);
      setIsFetchingPrices(false);
    }
  }, [isOpen]);

  // Handle escape key
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

  // Handle paste events
  useEffect(() => {
    if (!isOpen || step !== 'upload') return;

    const handlePaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          await handleImageFile(file);
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen, step]);

  // Process image file
  const handleImageFile = async (file) => {
    try {
      setError(null);
      const { base64, mediaType } = await processImageFile(file);

      // Create preview URL
      const preview = URL.createObjectURL(file);

      setImageData({ base64, mediaType, preview });
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle file input change
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if leaving the dropzone entirely
    if (e.target === dropzoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      await handleImageFile(file);
    }
  };

  // Extract positions from image
  const handleExtract = async () => {
    if (!imageData || !apiKey) return;

    setStep('processing');
    setError(null);

    try {
      // Save settings if requested
      if (saveKey) {
        saveApiSettings(apiKey, provider);
      }

      const result = await extractPositionsFromImage(
        imageData.base64,
        imageData.mediaType,
        apiKey,
        provider
      );

      if (result.positions.length === 0) {
        throw new Error('No positions found in the screenshot. Try a clearer image or ensure positions are visible.');
      }

      // Mark duplicates
      const positionsWithMeta = result.positions.map((p, idx) => ({
        ...p,
        id: Date.now() + idx,
        isDuplicate: existingTickers.includes(p.ticker.toUpperCase()),
      }));

      setExtractedPositions(positionsWithMeta);
      setExtractionMeta({
        confidence: result.confidence,
        notes: result.notes,
      });
      setStep('review');
    } catch (err) {
      setError(err.message);
      setStep('error');
    }
  };

  // Update position field
  const handleUpdatePosition = (id, field, value) => {
    setExtractedPositions(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // Remove position
  const handleRemovePosition = (id) => {
    setExtractedPositions(prev => prev.filter(p => p.id !== id));
  };

  // Fetch prices for positions
  const handleFetchPrices = async () => {
    if (!fetchPriceForTicker || extractedPositions.length === 0) return;

    setIsFetchingPrices(true);
    const needsFetch = extractedPositions.filter(p => p.price === null);
    setFetchProgress({ current: 0, total: needsFetch.length });

    const updatedPositions = [...extractedPositions];

    for (let i = 0; i < updatedPositions.length; i++) {
      const pos = updatedPositions[i];
      if (pos.price === null && !pos.notFound) {
        try {
          const result = await fetchPriceForTicker(pos.ticker);
          if (result && result.price) {
            updatedPositions[i] = {
              ...pos,
              price: result.price,
              ticker: result.ticker || pos.ticker,
              name: result.name || pos.name,
              currency: result.currency || 'USD',
              domesticPrice: result.domesticPrice || result.price,
              wasAutoCorrected: result.ticker && result.ticker !== pos.ticker,
            };
          } else {
            updatedPositions[i] = { ...pos, notFound: true };
          }
        } catch (err) {
          console.error(`Failed to fetch price for ${pos.ticker}:`, err);
          updatedPositions[i] = { ...pos, notFound: true };
        }
        setFetchProgress(prev => ({ ...prev, current: prev.current + 1 }));
        setExtractedPositions([...updatedPositions]);
      }
    }

    setIsFetchingPrices(false);
  };

  // Import positions to portfolio
  const handleImport = () => {
    if (extractedPositions.length === 0) return;

    const validPositions = extractedPositions
      .filter(p => p.ticker)
      .map(p => ({
        ticker: p.ticker,
        quantity: p.quantity,
        price: p.price || 100,
        currency: p.currency || 'USD',
        domesticPrice: p.domesticPrice || p.price || 100,
      }));

    if (validPositions.length > 0) {
      onImportPositions(validPositions);
      onClose();
    }
  };

  // Go back to upload step
  const handleBack = () => {
    setStep('upload');
    setError(null);
  };

  // Clear saved API key
  const handleClearKey = () => {
    clearApiSettings();
    setApiKey('');
    setSaveKey(true);
  };

  // Calculate totals
  const totalValue = extractedPositions.reduce((sum, p) => {
    return sum + (p.quantity * (p.price || 0));
  }, 0);

  const needsPriceFetch = extractedPositions.some(p => p.price === null && !p.notFound);
  const hasAnyDuplicates = extractedPositions.some(p => p.isDuplicate);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>📷</div>
          <h2 style={styles.title}>Import from Screenshot</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <>
              {/* Image Dropzone */}
              <div
                ref={dropzoneRef}
                style={{
                  ...styles.dropzone,
                  ...(isDragging ? styles.dropzoneActive : {}),
                  ...(imageData ? styles.dropzoneWithImage : {}),
                }}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />

                {imageData ? (
                  <div style={styles.imagePreviewContainer}>
                    <img
                      src={imageData.preview}
                      alt="Screenshot preview"
                      style={styles.imagePreview}
                    />
                    <div style={styles.imageOverlay}>
                      <span>Click or paste to replace</span>
                    </div>
                  </div>
                ) : (
                  <div style={styles.dropzoneContent}>
                    <span style={styles.dropzoneIcon}>📸</span>
                    <span style={styles.dropzoneText}>
                      Drop screenshot here, paste, or click to upload
                    </span>
                    <span style={styles.dropzoneHint}>
                      Supports PNG, JPG, WebP (max 10MB)
                    </span>
                  </div>
                )}
              </div>

              {/* API Settings */}
              <div style={styles.section}>
                <div style={styles.sectionHeader}>
                  <span style={styles.sectionIcon}>🔑</span>
                  <span style={styles.sectionTitle}>API Settings</span>
                </div>

                {/* Provider Toggle */}
                <div style={styles.providerToggle}>
                  <button
                    style={{
                      ...styles.providerButton,
                      ...(provider === 'claude' ? styles.providerButtonActive : {}),
                    }}
                    onClick={() => setProvider('claude')}
                  >
                    Claude
                  </button>
                  <button
                    style={{
                      ...styles.providerButton,
                      ...(provider === 'openai' ? styles.providerButtonActive : {}),
                    }}
                    onClick={() => setProvider('openai')}
                  >
                    OpenAI
                  </button>
                </div>

                {/* API Key Input */}
                <div style={styles.apiKeyRow}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === 'claude' ? 'sk-ant-...' : 'sk-...'}
                    style={styles.apiKeyInput}
                  />
                  <button
                    style={styles.showKeyButton}
                    onClick={() => setShowKey(!showKey)}
                    title={showKey ? 'Hide key' : 'Show key'}
                  >
                    {showKey ? '🙈' : '👁️'}
                  </button>
                  {apiKey && (
                    <button
                      style={styles.clearKeyButton}
                      onClick={handleClearKey}
                      title="Clear saved key"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Save checkbox */}
                <label style={styles.saveKeyLabel}>
                  <input
                    type="checkbox"
                    checked={saveKey}
                    onChange={(e) => setSaveKey(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <span>Save API key in browser</span>
                </label>

                <p style={styles.securityNote}>
                  ⚠️ Your API key is stored locally in your browser. Never share it.
                </p>
              </div>

              {/* Error display */}
              {error && (
                <div style={styles.errorBox}>
                  <span>❌</span>
                  <span>{error}</span>
                </div>
              )}
            </>
          )}

          {/* Step 2: Processing */}
          {step === 'processing' && (
            <div style={styles.processingContainer}>
              <div style={styles.spinner}></div>
              <span style={styles.processingText}>Analyzing screenshot...</span>
              <span style={styles.processingHint}>
                Using {provider === 'claude' ? 'Claude' : 'OpenAI'} vision to extract positions
              </span>
            </div>
          )}

          {/* Step 3: Error */}
          {step === 'error' && (
            <div style={styles.errorContainer}>
              <span style={styles.errorIcon}>❌</span>
              <span style={styles.errorText}>{error}</span>
              <div style={styles.errorActions}>
                <button style={styles.retryButton} onClick={handleExtract}>
                  Try Again
                </button>
                <button style={styles.backButton} onClick={handleBack}>
                  Upload Different Image
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 'review' && (
            <>
              {/* Extraction metadata */}
              {(extractionMeta.confidence || extractionMeta.notes) && (
                <div style={styles.metaBox}>
                  {extractionMeta.confidence && (
                    <span style={styles.confidence}>
                      Confidence: {Math.round(extractionMeta.confidence * 100)}%
                    </span>
                  )}
                  {extractionMeta.notes && (
                    <span style={styles.notes}>{extractionMeta.notes}</span>
                  )}
                </div>
              )}

              {/* Positions table */}
              <div style={styles.pendingSection}>
                <div style={styles.pendingHeader}>
                  <span>Extracted Positions ({extractedPositions.length})</span>
                  {needsPriceFetch && fetchPriceForTicker && (
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
                    <span style={{ width: '32px' }}></span>
                  </div>

                  <div style={styles.pendingTableBody}>
                    {extractedPositions.map(pos => {
                      const value = pos.price ? pos.quantity * pos.price : null;
                      const isLong = pos.quantity >= 0;

                      return (
                        <div
                          key={pos.id}
                          style={{
                            ...styles.pendingRow,
                            ...(pos.isDuplicate ? styles.duplicateRow : {}),
                            ...(pos.notFound ? styles.notFoundRow : {}),
                          }}
                        >
                          <span style={{
                            width: '120px',
                            fontWeight: '600',
                            color: pos.notFound ? COLORS.red : COLORS.cyan,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                          }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {pos.ticker}
                              {pos.isDuplicate && (
                                <span title="Already in portfolio">⚠️</span>
                              )}
                              {pos.notFound && (
                                <span title="Ticker not found">✗</span>
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
                              onChange={(e) => handleUpdatePosition(pos.id, 'quantity', parseInt(e.target.value) || 0)}
                            />
                          </span>
                          <span style={{
                            width: '80px',
                            textAlign: 'right',
                            color: pos.price ? '#fff' : pos.notFound ? COLORS.red : '#555',
                            fontSize: '11px',
                          }}>
                            {pos.price ? `$${pos.price.toFixed(2)}` : pos.notFound ? 'N/A' : '—'}
                          </span>
                          <span style={{
                            width: '100px',
                            textAlign: 'right',
                            fontWeight: '600',
                            color: value === null ? '#555' : isLong ? COLORS.green : COLORS.red,
                          }}>
                            {value !== null
                              ? `${value >= 0 ? '' : '-'}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                              : '—'}
                          </span>
                          <span style={{ marginLeft: 'auto' }}>
                            <button
                              style={styles.removeButton}
                              onClick={() => handleRemovePosition(pos.id)}
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
                </div>

                {/* Duplicate warning */}
                {hasAnyDuplicates && (
                  <div style={styles.warningBox}>
                    <span>⚠️</span>
                    <span>Some tickers already exist. Adding duplicates will create separate positions.</span>
                  </div>
                )}
              </div>

              {/* Back link */}
              <button style={styles.backLink} onClick={handleBack}>
                ← Upload different screenshot
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose}>
            Cancel
          </button>

          {step === 'upload' && (
            <button
              style={{
                ...styles.confirmButton,
                opacity: !imageData || !apiKey ? 0.5 : 1,
              }}
              onClick={handleExtract}
              disabled={!imageData || !apiKey}
            >
              Extract Positions
            </button>
          )}

          {step === 'review' && (
            <button
              style={{
                ...styles.confirmButton,
                opacity: extractedPositions.length === 0 ? 0.5 : 1,
              }}
              onClick={handleImport}
              disabled={extractedPositions.length === 0}
            >
              Import {extractedPositions.length} Position{extractedPositions.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
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
  },

  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
  },

  // Dropzone styles
  dropzone: {
    border: '2px dashed rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '20px',
  },

  dropzoneActive: {
    borderColor: COLORS.cyan,
    background: 'rgba(0, 212, 255, 0.05)',
  },

  dropzoneWithImage: {
    padding: '0',
    border: '2px solid rgba(0, 212, 255, 0.3)',
  },

  dropzoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },

  dropzoneIcon: {
    fontSize: '48px',
    opacity: 0.5,
  },

  dropzoneText: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.7)',
  },

  dropzoneHint: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.4)',
  },

  imagePreviewContainer: {
    position: 'relative',
    borderRadius: '10px',
    overflow: 'hidden',
  },

  imagePreview: {
    width: '100%',
    maxHeight: '200px',
    objectFit: 'contain',
    display: 'block',
  },

  imageOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    color: '#fff',
    fontSize: '13px',
  },

  // Section styles
  section: {
    marginBottom: '16px',
  },

  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
  },

  sectionIcon: {
    fontSize: '16px',
  },

  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#fff',
  },

  providerToggle: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },

  providerButton: {
    flex: 1,
    padding: '8px 16px',
    fontSize: '12px',
    fontWeight: '500',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },

  providerButtonActive: {
    background: 'rgba(0, 212, 255, 0.1)',
    borderColor: 'rgba(0, 212, 255, 0.3)',
    color: COLORS.cyan,
  },

  apiKeyRow: {
    display: 'flex',
    gap: '8px',
    marginBottom: '8px',
  },

  apiKeyInput: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '13px',
    fontFamily: 'SF Mono, Monaco, Consolas, monospace',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    outline: 'none',
  },

  showKeyButton: {
    padding: '10px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
  },

  clearKeyButton: {
    padding: '10px 12px',
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    color: COLORS.red,
    fontSize: '12px',
  },

  saveKeyLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)',
    cursor: 'pointer',
    marginBottom: '8px',
  },

  checkbox: {
    width: '14px',
    height: '14px',
  },

  securityNote: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.4)',
    margin: 0,
  },

  // Processing styles
  processingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px',
    gap: '16px',
  },

  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(0, 212, 255, 0.2)',
    borderTopColor: COLORS.cyan,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },

  processingText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#fff',
  },

  processingHint: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
  },

  // Error styles
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 20px',
    gap: '16px',
  },

  errorIcon: {
    fontSize: '48px',
  },

  errorText: {
    fontSize: '14px',
    color: COLORS.red,
    textAlign: 'center',
  },

  errorActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },

  retryButton: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '600',
    background: 'rgba(0, 212, 255, 0.1)',
    border: '1px solid rgba(0, 212, 255, 0.3)',
    borderRadius: '8px',
    color: COLORS.cyan,
    cursor: 'pointer',
  },

  backButton: {
    padding: '10px 20px',
    fontSize: '13px',
    fontWeight: '500',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
  },

  errorBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.2)',
    borderRadius: '8px',
    fontSize: '12px',
    color: COLORS.red,
  },

  // Review table styles
  metaBox: {
    display: 'flex',
    gap: '16px',
    padding: '12px',
    background: 'rgba(0, 212, 255, 0.05)',
    border: '1px solid rgba(0, 212, 255, 0.1)',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '12px',
  },

  confidence: {
    color: COLORS.cyan,
    fontWeight: '600',
  },

  notes: {
    color: 'rgba(255, 255, 255, 0.6)',
  },

  pendingSection: {
    marginTop: '8px',
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
    maxHeight: '250px',
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

  backLink: {
    background: 'none',
    border: 'none',
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '16px',
    padding: 0,
  },

  // Footer styles
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
  },

  confirmButton: {
    padding: '10px 24px',
    fontSize: '13px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #00d4ff 0%, #7b2ff7 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
  },
};

export default ScreenshotImportModal;
