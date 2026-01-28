/**
 * Formatting Utilities
 * 
 * @module utils/formatting
 * @description Number, currency, and date formatting helpers for display.
 */

/**
 * Format currency value
 * @param {number} value - Value to format
 * @param {string} currency - Currency code (default: USD)
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currency = 'USD', decimals = 2) => {
  if (value == null || isNaN(value)) return '-';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  return formatter.format(value);
};

/**
 * Format compact currency (K, M, B suffixes)
 * @param {number} value - Value to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted compact currency
 */
export const formatCurrencyCompact = (value, currency = 'USD') => {
  if (value == null || isNaN(value)) return '-';
  
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  const symbol = currency === 'USD' ? '$' : currency;
  
  if (absValue >= 1e9) {
    return `${sign}${symbol}${(absValue / 1e9).toFixed(1)}B`;
  } else if (absValue >= 1e6) {
    return `${sign}${symbol}${(absValue / 1e6).toFixed(1)}M`;
  } else if (absValue >= 1e3) {
    return `${sign}${symbol}${(absValue / 1e3).toFixed(1)}K`;
  }
  return `${sign}${symbol}${absValue.toFixed(0)}`;
};

/**
 * Format percentage
 * @param {number} value - Value to format (0.15 = 15%)
 * @param {number} decimals - Decimal places (default: 1)
 * @param {boolean} showSign - Show + for positive (default: false)
 * @returns {string} Formatted percentage string
 */
export const formatPercent = (value, decimals = 1, showSign = false) => {
  if (value == null || isNaN(value)) return '-';
  
  const pct = value * 100;
  const sign = showSign && pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
};

/**
 * Format percentage from already-percentage value
 * @param {number} value - Value already in percentage (15 = 15%)
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted percentage string
 */
export const formatPercentRaw = (value, decimals = 1) => {
  if (value == null || isNaN(value)) return '-';
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format number with thousand separators
 * @param {number} value - Value to format
 * @param {number} decimals - Decimal places (default: 0)
 * @returns {string} Formatted number string
 */
export const formatNumber = (value, decimals = 0) => {
  if (value == null || isNaN(value)) return '-';
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

/**
 * Format date as YYYY-MM-DD
 * @param {Date|number|string} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDateISO = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
};

/**
 * Format date as MMM DD, YYYY
 * @param {Date|number|string} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDateLong = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

/**
 * Format date as MM/DD/YY
 * @param {Date|number|string} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDateShort = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US');
};

/**
 * Format correlation value (fixed 2 decimals)
 * @param {number} value - Correlation (-1 to 1)
 * @returns {string} Formatted correlation
 */
export const formatCorrelation = (value) => {
  if (value == null || isNaN(value)) return '-';
  return value.toFixed(2);
};

/**
 * Format beta value (fixed 2 decimals)
 * @param {number} value - Beta value
 * @returns {string} Formatted beta
 */
export const formatBeta = (value) => {
  if (value == null || isNaN(value)) return '-';
  return value.toFixed(2);
};

/**
 * Get color for return value (red for negative, green for positive)
 * @param {number} value - Return value
 * @returns {string} CSS color string
 */
export const getReturnColor = (value) => {
  if (value == null || isNaN(value)) return '#888';
  if (value > 0.001) return '#22c55e';  // Green
  if (value < -0.001) return '#ef4444'; // Red
  return '#888'; // Gray for ~0
};

/**
 * Get color for correlation value (blue gradient)
 * @param {number} value - Correlation (-1 to 1)
 * @returns {string} CSS color string
 */
export const getCorrelationColor = (value) => {
  if (value == null || isNaN(value)) return '#888';
  
  // Map correlation to color intensity
  const absCorr = Math.abs(value);
  const intensity = Math.floor(absCorr * 255);
  
  if (value > 0) {
    // Positive: blue
    return `rgb(${255 - intensity}, ${255 - intensity}, 255)`;
  } else {
    // Negative: red
    return `rgb(255, ${255 - intensity}, ${255 - intensity})`;
  }
};

/**
 * Truncate string with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export const truncate = (str, maxLength = 20) => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
};

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Format duration in seconds to human readable
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
export const formatDuration = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export default {
  formatCurrency,
  formatCurrencyCompact,
  formatPercent,
  formatPercentRaw,
  formatNumber,
  formatDateISO,
  formatDateLong,
  formatDateShort,
  formatCorrelation,
  formatBeta,
  getReturnColor,
  getCorrelationColor,
  truncate,
  formatFileSize,
  formatDuration,
};
