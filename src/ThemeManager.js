/**
 * ThemeManager
 * Handles color themes, ANSI codes, and visual styling
 */

const config = require('./config');
const { formatWithUnit } = require('./utils/formatters');

class ThemeManager {
  constructor() {
    this.currentTheme = 'default';
    this.themes = {
      default: config.theme,
      dark: this.createDarkTheme(),
      light: this.createLightTheme(),
      minimal: this.createMinimalTheme()
    };
    
    // Cache for formatted strings
    this.formatCache = new Map();
  }

  /**
   * Get current theme
   */
  getTheme() {
    return this.themes[this.currentTheme];
  }

  /**
   * Set theme
   */
  setTheme(themeName) {
    if (this.themes[themeName]) {
      this.currentTheme = themeName;
      this.clearCache();
      return true;
    }
    return false;
  }

  /**
   * Get available themes
   */
  getAvailableThemes() {
    return Object.keys(this.themes);
  }

  /**
   * Format thinking rate as simple percentage
   */
  formatThinkingRate(rate) {
    const cacheKey = `thinking_${rate}`;
    if (this.formatCache.has(cacheKey)) {
      return this.formatCache.get(cacheKey);
    }

    const theme = this.getTheme();
    const percent = (rate * 100).toFixed(0);
    let percentStr = `${percent}%`.padStart(4);

    const formatted = `${percentStr}`;
    this.formatCache.set(cacheKey, formatted);
    return formatted;
  }

  /**
   * Format response time with appropriate color
   */
  formatResponseTime(seconds) {
    const cacheKey = `response_${seconds}`;
    if (this.formatCache.has(cacheKey)) {
      return this.formatCache.get(cacheKey);
    }

    const theme = this.getTheme();
    let color = '';
    let timeStr = '';

    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      timeStr = `${minutes}m${remainingSeconds}s`;
    } else {
      timeStr = `${seconds.toFixed(1)}s`;
    }

    // Pad timeStr to fixed width (8 characters) before applying colors
    const paddedTimeStr = timeStr.padEnd(8);

    // New color rules: 30m+ = red, 10-30m = yellow, <10m = no color
    if (seconds >= 1800) { // 30 minutes
      color = theme.colors.slowResponse;
    } else if (seconds >= 600) { // 10 minutes
      color = theme.colors.mediumResponse;
    } else {
      color = ''; // No color for fast responses
    }

    const formatted = color ? `${color}${paddedTimeStr}${theme.colors.reset}` : paddedTimeStr;
    this.formatCache.set(cacheKey, formatted);
    return formatted;
  }

  /**
   * Format tool usage count with color
   */
  formatToolCount(count) {
    const cacheKey = `tool_${count}`;
    if (this.formatCache.has(cacheKey)) {
      return this.formatCache.get(cacheKey);
    }

    const theme = this.getTheme();
    const toolStr = formatWithUnit(count);
    const paddedToolStr = toolStr.padStart(5) + ' '; // Right-align with trailing space
    
    let color = '';
    // New color rules: 50+ = red, 20-49 = yellow, <20 = no color
    if (count >= 50) {
      color = theme.colors.slowResponse; // Red for many tools
    } else if (count >= 20) {
      color = theme.colors.mediumResponse; // Yellow for moderate tools
    } else {
      color = ''; // No color for few tools
    }

    const formatted = `${color}${paddedToolStr}${theme.colors.reset}`;
    this.formatCache.set(cacheKey, formatted);
    return formatted;
  }

  /**
   * Format token count with color and right alignment
   */
  formatTokenCount(tokens, thresholds = null) {
    const cacheKey = `token_${tokens}_${thresholds ? JSON.stringify(thresholds) : 'default'}`;
    if (this.formatCache.has(cacheKey)) {
      return this.formatCache.get(cacheKey);
    }

    const theme = this.getTheme();
    const { formatWithUnit } = require('./utils/formatters');
    const tokenStr = formatWithUnit(tokens);
    const paddedTokenStr = tokenStr.padStart(7) + ' '; // Right-align with trailing space (8 chars total)
    
    let color = '';
    // Apply color only when thresholds are provided (conversation detail view)
    if (thresholds) {
      const activeThresholds = thresholds;
      
      if (tokens >= activeThresholds.error) {
        color = theme.colors.slowResponse; // Red for high token usage
      } else if (tokens >= activeThresholds.warning) {
        color = theme.colors.mediumResponse; // Yellow for moderate token usage
      } else {
        color = ''; // No color for normal token usage
      }
    }
    // No color for session list (when thresholds is null)
    
    const formatted = color ? `${color}${paddedTokenStr}${theme.colors.reset}` : paddedTokenStr;
    this.formatCache.set(cacheKey, formatted);
    return formatted;
  }

  /**
   * Format session selection highlight
   */
  formatSelection(content, isSelected) {
    const theme = this.getTheme();
    
    if (isSelected) {
      return `${theme.colors.selected}${content}${theme.colors.reset}`;
    }
    
    return content;
  }

  /**
   * Format header text
   */
  formatHeader(text) {
    const theme = this.getTheme();
    return `${theme.colors.header}${text}${theme.colors.reset}`;
  }

  /**
   * Format separator line
   */
  formatSeparator(width, char = '=') {
    const theme = this.getTheme();
    return `${theme.colors.separator}${char.repeat(width)}${theme.colors.reset}`;
  }

  /**
   * Format selected item prefix
   */
  formatSelectedPrefix() {
    const theme = this.getTheme();
    return `${theme.colors.prefix}${theme.icons.ui.selected}${theme.colors.reset}`;
  }

  /**
   * Format muted text
   */
  formatMuted(text) {
    const theme = this.getTheme();
    return `${theme.colors.muted}${text}${theme.colors.reset}`;
  }

  /**
   * Format info text
   */
  formatInfo(text) {
    const theme = this.getTheme();
    return `${theme.colors.info}${text}${theme.colors.reset}`;
  }

  /**
   * Format success text
   */
  formatSuccess(text) {
    const theme = this.getTheme();
    return `${theme.colors.success}${text}${theme.colors.reset}`;
  }

  /**
   * Format warning text
   */
  formatWarning(text) {
    const theme = this.getTheme();
    return `${theme.colors.warning}${text}${theme.colors.reset}`;
  }

  /**
   * Format error text
   */
  formatError(text) {
    const theme = this.getTheme();
    return `${theme.colors.error}${text}${theme.colors.reset}`;
  }

  /**
   * Format accent text
   */
  formatAccent(text) {
    const theme = this.getTheme();
    return `${theme.colors.accent}${text}${theme.colors.reset}`;
  }

  /**
   * Format highlighted text
   */
  formatHighlight(text) {
    const theme = this.getTheme();
    // Use inverse video for highlighting
    return `\x1b[7m${text}\x1b[27m`;
  }

  /**
   * Format dim/muted text
   */
  formatDim(text) {
    const theme = this.getTheme();
    return `${theme.colors.muted || '\x1b[2m'}${text}${theme.colors.reset}`;
  }

  /**
   * Strip ANSI codes from text
   */
  stripAnsiCodes(text) {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  }

  /**
   * Get display width accounting for full-width characters and emojis
   */
  getDisplayWidth(text) {
    const stripped = this.stripAnsiCodes(text);
    let width = 0;
    
    for (let i = 0; i < stripped.length; i++) {
      const code = stripped.charCodeAt(i);
      
      // Check for emoji sequences (surrogate pairs)
      if (code >= 0xD800 && code <= 0xDBFF) {
        // This is a high surrogate, skip the low surrogate
        if (i + 1 < stripped.length) {
          const lowCode = stripped.charCodeAt(i + 1);
          if (lowCode >= 0xDC00 && lowCode <= 0xDFFF) {
            i++; // Skip the low surrogate
          }
        }
        width += 2;
      } else if (code >= 0xDC00 && code <= 0xDFFF) {
        // Orphan low surrogate, shouldn't happen but handle it
        continue;
      } else if ((code >= 0x2600 && code <= 0x27BF) || // Miscellaneous Symbols
                 (code >= 0x1F300 && code <= 0x1F6FF) || // Misc Symbols and Pictographs
                 (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols
                 (code >= 0x1F000 && code <= 0x1F02F)) { // Mahjong/Domino
        width += 2;
      } else if ((code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
                 (code >= 0x2E80 && code <= 0x9FFF) || // CJK
                 (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
                 (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility
                 (code >= 0xFE30 && code <= 0xFE4F) || // CJK Compatibility Forms
                 (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
                 (code >= 0xFFE0 && code <= 0xFFE6) || // Fullwidth Forms
                 (code >= 0x3000 && code <= 0x303F) || // CJK Symbols
                 (code >= 0x2018 && code <= 0x201F)) { // Quotation marks
        width += 2;
      } else {
        width += 1;
      }
    }
    
    return width;
  }

  /**
   * Create dark theme
   */
  createDarkTheme() {
    return {
      ...config.theme,
      colors: {
        ...config.theme.colors,
        // Darker variants for dark theme
        selected: '\x1b[100m\x1b[97m', // Dark gray background
        header: '\x1b[1m\x1b[96m',     // Bright cyan
        separator: '\x1b[90m'          // Dark gray
      }
    };
  }

  /**
   * Create light theme
   */
  createLightTheme() {
    return {
      ...config.theme,
      colors: {
        ...config.theme.colors,
        // Light variants
        selected: '\x1b[47m\x1b[30m',  // Light gray background, black text
        header: '\x1b[1m\x1b[34m',     // Dark blue
        separator: '\x1b[37m',         // Light gray
        muted: '\x1b[37m'              // Light gray
      }
    };
  }

  /**
   * Create minimal theme
   */
  createMinimalTheme() {
    return {
      ...config.theme,
      colors: {
        // All colors are reset (no colors)
        slowResponse: '',
        mediumResponse: '',
        fastResponse: '',
        selected: '\x1b[7m',           // Only use reverse video
        header: '\x1b[1m',             // Only bold
        separator: '',
        prefix: '',
        accent: '',
        muted: '',
        info: '',
        warning: '',
        error: '',
        success: '',
        reset: '\x1b[0m'
      },
      icons: {
        thinking: {
          high: '+ ',
          medium: '  ',
          low: '  ',
          none: '  '
        },
        ui: {
          selected: '>',
          unselected: ' ',
          bullet: '*',
          arrow: '->',
          separator: '-',
          loading: '...',
          search: '?',
          filter: 'F',
          bookmark: 'B',
          export: 'E'
        }
      }
    };
  }

  /**
   * Clear format cache
   */
  clearCache() {
    this.formatCache.clear();
  }


  /**
   * Format duration
   */
  formatDuration(milliseconds) {
    // Handle negative values
    if (milliseconds <= 0) return '0s';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      const remainingHours = hours % 24;
      const remainingMinutes = minutes % 60;
      if (remainingHours > 0 && remainingMinutes > 0) {
        return `${days}d ${remainingHours}h ${remainingMinutes}m`;
      } else if (remainingHours > 0) {
        return `${days}d ${remainingHours}h`;
      } else if (remainingMinutes > 0) {
        return `${days}d ${remainingMinutes}m`;
      } else {
        return `${days}d`;
      }
    } else if (hours > 0) {
      const remainingMinutes = minutes % 60;
      if (remainingMinutes > 0) {
        return `${hours}h ${remainingMinutes}m`;
      } else {
        return `${hours}h`;
      }
    } else if (minutes > 0) {
      const remainingSeconds = seconds % 60;
      if (remainingSeconds > 0) {
        return `${minutes}m ${remainingSeconds}s`;
      } else {
        return `${minutes}m`;
      }
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Format session ID for display
   */
  formatSessionId(sessionId) {
    // If it's a short hash (7-8 chars), show in full
    if (sessionId.length <= 8) {
      return sessionId;
    }
    // For longer UUIDs, show first 8 characters, ellipsis, and last 4 characters
    return `${sessionId.substring(0, 8)}...${sessionId.substring(sessionId.length - 4)}`;
  }

  /**
   * Format date/time to mm/dd hh:mm (compact format)
   */
  formatDateTime(timestamp) {
    const date = new Date(timestamp);
    
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${month}/${day} ${hours}:${minutes}`;
  }

  /**
   * Create progress bar
   */
  createProgressBar(current, total, width = 20) {
    const theme = this.getTheme();
    // Handle edge cases
    if (width <= 0) return `${theme.colors.info}[] 0%${theme.colors.reset}`;
    if (total <= 0) return `${theme.colors.info}[${'░'.repeat(width)}] 0%${theme.colors.reset}`;
    
    const progress = Math.max(0, Math.min(current / total, 1));
    const filled = Math.floor(progress * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    const percentage = Math.round(progress * 100);
    
    return `${theme.colors.info}[${bar}] ${percentage}%${theme.colors.reset}`;
  }
}

module.exports = ThemeManager;