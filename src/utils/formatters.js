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
 * Format large numbers with locale-appropriate separators
 * @param {number} num - The number to format
 * @param {string} locale - Locale string (default: 'en-US')
 * @returns {string} Formatted number string
 */
function formatLargeNumber(num, locale = 'en-US') {
  if (!num && num !== 0) return '0';
  return num.toLocaleString(locale);
}


module.exports = {
  formatWithUnit,
  formatLargeNumber
};