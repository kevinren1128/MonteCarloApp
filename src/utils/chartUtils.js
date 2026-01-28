/**
 * Chart Utilities
 * 
 * @module utils/chartUtils
 * @description Utility functions for chart data generation and formatting.
 */

/**
 * Generate histogram data from an array of values
 * @param {number[]} values - Array of values
 * @param {number} bins - Number of bins
 * @returns {Array} Histogram data
 */
export const generateHistogramData = (values, bins = 50) => {
  if (!values || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / bins;
  const histogram = Array(bins).fill(0);
  
  values.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    histogram[idx]++;
  });
  
  return histogram.map((count, i) => ({
    value: min + (i + 0.5) * binWidth,
    count: count,
    return: ((min + (i + 0.5) * binWidth - 1) * 100).toFixed(1) + '%',
  }));
};

/**
 * Generate histogram data for return values (percentages)
 * @param {number[]} returns - Array of return values (e.g., 0.12 for 12%)
 * @param {number} bins - Number of bins
 * @returns {Array} Histogram data with labels
 */
export const generateReturnHistogramData = (returns, bins = 50) => {
  if (!returns || returns.length === 0) return [];
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const binWidth = (max - min) / bins;
  const histogram = Array(bins).fill(0);
  const total = returns.length;
  
  returns.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    histogram[idx]++;
  });
  
  return histogram.map((count, i) => {
    const returnVal = min + (i + 0.5) * binWidth;
    const pct = (count / total) * 100;
    return {
      value: returnVal,
      count: count,
      pct: pct,
      label: `${returnVal >= 0 ? '+' : ''}${(returnVal * 100).toFixed(0)}%`,
    };
  });
};

/**
 * Format dollar values nicely
 * @param {number} val - Dollar value
 * @returns {string} Formatted string
 */
export const formatDollars = (val) => {
  if (Math.abs(val) >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (Math.abs(val) >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  if (Math.abs(val) >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
};

/**
 * Generate histogram data for dollar values
 * @param {number[]} dollars - Array of dollar amounts
 * @param {number} bins - Number of bins
 * @returns {Array} Histogram data
 */
export const generateDollarHistogramData = (dollars, bins = 40) => {
  if (!dollars || dollars.length === 0) return [];
  const min = Math.min(...dollars);
  const max = Math.max(...dollars);
  const binWidth = (max - min) / bins;
  const histogram = Array(bins).fill(0);
  const total = dollars.length;
  
  dollars.forEach(v => {
    const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
    histogram[idx]++;
  });
  
  return histogram.map((count, i) => {
    const dollarVal = min + (i + 0.5) * binWidth;
    const pct = (count / total) * 100;
    return {
      value: dollarVal,
      count: count,
      pct: pct,
      label: formatDollars(dollarVal),
    };
  });
};

/**
 * Format currency for display
 * @param {number} val - Value to format
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (val) => {
  if (!isFinite(val)) return '$--';
  const absVal = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (absVal >= 1e9) return `${sign}$${(absVal / 1e9).toFixed(2)}B`;
  if (absVal >= 1e6) return `${sign}$${(absVal / 1e6).toFixed(2)}M`;
  if (absVal >= 1e3) return `${sign}$${(absVal / 1e3).toFixed(0)}K`;
  return `${sign}$${absVal.toFixed(0)}`;
};

/**
 * Format percentage for display
 * @param {number} val - Value (e.g., 0.12 for 12%)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage
 */
export const formatPercent = (val, decimals = 1) => {
  if (!isFinite(val)) return '--%';
  const pct = val * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(decimals)}%`;
};

/**
 * Get color based on value (positive=green, negative=red)
 * @param {number} value - Value to color
 * @param {string} positiveColor - Color for positive values
 * @param {string} negativeColor - Color for negative values
 * @returns {string} Color string
 */
export const getValueColor = (value, positiveColor = '#2ecc71', negativeColor = '#e74c3c') => {
  return value >= 0 ? positiveColor : negativeColor;
};

/**
 * Get percentile from sorted array
 * @param {number[]} sortedArr - Sorted array
 * @param {number} p - Percentile (0-1)
 * @returns {number} Percentile value
 */
export const getPercentile = (sortedArr, p) => {
  if (!sortedArr || sortedArr.length === 0) return 0;
  const idx = Math.floor(p * (sortedArr.length - 1));
  return sortedArr[idx];
};

export default {
  generateHistogramData,
  generateReturnHistogramData,
  generateDollarHistogramData,
  formatDollars,
  formatCurrency,
  formatPercent,
  getValueColor,
  getPercentile,
};
