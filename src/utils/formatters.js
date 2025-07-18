/**
 * Utility functions for formatting numbers and units
 */

/**
 * Format a number with appropriate unit suffix (k, M, B)
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @param {boolean} forceUnit - Force unit display even for small numbers (default: false)
 * @returns {string} Formatted string with unit
 */
function formatWithUnit(num, decimals = 1, forceUnit = false) {
  if (!num && num !== 0) return '0';
  
  const absNum = Math.abs(num);
  
  // For small numbers, return as-is unless forceUnit is true
  if (absNum < 1000 && !forceUnit) {
    return num.toString();
  }
  
  // Define units and their thresholds
  const units = [
    { threshold: 1e9, suffix: 'b', divisor: 1e9 },   // Billion
    { threshold: 1e6, suffix: 'm', divisor: 1e6 },   // Million  
    { threshold: 1e3, suffix: 'k', divisor: 1e3 }    // Thousand
  ];
  
  // Find appropriate unit
  for (const unit of units) {
    if (absNum >= unit.threshold) {
      const value = num / unit.divisor;
      return `${value.toFixed(decimals)}${unit.suffix}`;
    }
  }
  
  // Default to raw number if no unit applies
  return num.toString();
}

/**
 * Format tokens with appropriate color coding and units
 * @param {number} tokens - Number of tokens
 * @param {Object} theme - Theme manager instance for color coding
 * @param {Object} thresholds - Custom thresholds for color coding
 * @returns {Object} { formatted: string, colored: string }
 */
function formatTokens(tokens, theme = null, thresholds = null) {
  const formatted = formatWithUnit(tokens);
  
  if (!theme) {
    return { formatted, colored: formatted };
  }
  
  // Default thresholds
  const defaultThresholds = {
    error: 50000,
    warning: 20000
  };
  
  const activeThresholds = thresholds || defaultThresholds;
  
  // Color coding based on token count
  let colored;
  if (tokens > activeThresholds.error) {
    colored = theme.formatError(formatted);
  } else if (tokens > activeThresholds.warning) {
    colored = theme.formatWarning(formatted);
  } else {
    colored = theme.formatMuted(formatted);
  }
  
  return { formatted, colored };
}

/**
 * Format large numbers with locale-appropriate separators
 * @param {number} num - The number to format
 * @param {string} locale - Locale string (default: 'en-US')
 * @returns {string} Formatted number string
 */
function formatLargeNumber(num, locale = 'en-US') {
  if (!num && num !== 0) return '0';
  return num.toLocaleString(locale);
}

/**
 * Format bytes with appropriate unit (B, KB, MB, GB)
 * @param {number} bytes - Number of bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted string with unit
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

module.exports = {
  formatWithUnit,
  formatTokens,
  formatLargeNumber,
  formatBytes
};