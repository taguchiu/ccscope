/**
 * Text Truncation Utility
 * 
 * Provides unified text truncation with proper terminal cell width calculation
 * Handles emojis, CJK characters, ANSI codes, and grapheme clusters correctly
 */

class TextTruncator {
  constructor() {
    this.ELLIPSIS = '…';  // Use single ellipsis character (width 1)
    this.ANSI_REGEX = /\x1b\[[0-9;]*[a-zA-Z]/g;
  }

  /**
   * Calculate terminal display width of a character
   * Based on Unicode East Asian Width property and emoji detection
   */
  getCharWidth(char) {
    const code = char.codePointAt(0);
    
    // Control characters have width 0
    if (code < 0x20 || (code >= 0x7F && code < 0xA0)) {
      return 0;
    }
    
    // ASCII characters (except control) have width 1
    if (code < 0x7F) {
      return 1;
    }
    
    // Emoji detection (simplified)
    // Most emojis are in these ranges and have width 2
    if (
      (code >= 0x1F600 && code <= 0x1F64F) || // Emoticons
      (code >= 0x1F300 && code <= 0x1F5FF) || // Misc Symbols and Pictographs
      (code >= 0x1F680 && code <= 0x1F6FF) || // Transport and Map
      (code >= 0x1F700 && code <= 0x1F77F) || // Alchemical Symbols
      (code >= 0x1F780 && code <= 0x1F7FF) || // Geometric Shapes Extended
      (code >= 0x1F800 && code <= 0x1F8FF) || // Supplemental Arrows-C
      (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols and Pictographs
      (code >= 0x1FA00 && code <= 0x1FA6F) || // Chess Symbols
      (code >= 0x1FA70 && code <= 0x1FAFF) || // Symbols and Pictographs Extended-A
      (code >= 0x2600 && code <= 0x26FF) ||   // Miscellaneous Symbols
      (code >= 0x2700 && code <= 0x27BF) ||   // Dingbats
      (code >= 0x1F1E6 && code <= 0x1F1FF)    // Regional Indicator Symbols
    ) {
      return 2;
    }
    
    // CJK characters (wide characters)
    if (
      (code >= 0x1100 && code <= 0x115F) ||   // Hangul Jamo
      (code >= 0x2E80 && code <= 0x2EFF) ||   // CJK Radicals Supplement
      (code >= 0x2F00 && code <= 0x2FDF) ||   // Kangxi Radicals
      (code >= 0x2FF0 && code <= 0x2FFF) ||   // Ideographic Description Characters
      (code >= 0x3000 && code <= 0x303F) ||   // CJK Symbols and Punctuation
      (code >= 0x3040 && code <= 0x309F) ||   // Hiragana
      (code >= 0x30A0 && code <= 0x30FF) ||   // Katakana
      (code >= 0x3100 && code <= 0x312F) ||   // Bopomofo
      (code >= 0x3130 && code <= 0x318F) ||   // Hangul Compatibility Jamo
      (code >= 0x3190 && code <= 0x319F) ||   // Kanbun
      (code >= 0x31A0 && code <= 0x31BF) ||   // Bopomofo Extended
      (code >= 0x31C0 && code <= 0x31EF) ||   // CJK Strokes
      (code >= 0x31F0 && code <= 0x31FF) ||   // Katakana Phonetic Extensions
      (code >= 0x3200 && code <= 0x32FF) ||   // Enclosed CJK Letters and Months
      (code >= 0x3300 && code <= 0x33FF) ||   // CJK Compatibility
      (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Unified Ideographs Extension A
      (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
      (code >= 0xA000 && code <= 0xA48F) ||   // Yi Syllables
      (code >= 0xA490 && code <= 0xA4CF) ||   // Yi Radicals
      (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compatibility Ideographs
      (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK Compatibility Forms
      (code >= 0xFF00 && code <= 0xFFEF) ||   // Halfwidth and Fullwidth Forms
      (code >= 0x20000 && code <= 0x2A6DF) || // CJK Unified Ideographs Extension B
      (code >= 0x2A700 && code <= 0x2B73F) || // CJK Unified Ideographs Extension C
      (code >= 0x2B740 && code <= 0x2B81F) || // CJK Unified Ideographs Extension D
      (code >= 0x2B820 && code <= 0x2CEAF) || // CJK Unified Ideographs Extension E
      (code >= 0x2CEB0 && code <= 0x2EBEF)    // CJK Unified Ideographs Extension F
    ) {
      return 2;
    }
    
    // Combining marks have width 0
    if (
      (code >= 0x0300 && code <= 0x036F) ||   // Combining Diacritical Marks
      (code >= 0x1AB0 && code <= 0x1AFF) ||   // Combining Diacritical Marks Extended
      (code >= 0x1DC0 && code <= 0x1DFF) ||   // Combining Diacritical Marks Supplement
      (code >= 0x20D0 && code <= 0x20FF) ||   // Combining Diacritical Marks for Symbols
      (code >= 0xFE20 && code <= 0xFE2F)      // Combining Half Marks
    ) {
      return 0;
    }
    
    // Default to width 1 for other characters
    return 1;
  }

  /**
   * Calculate total display width of text (excluding ANSI codes)
   */
  getDisplayWidth(text) {
    if (!text) return 0;
    
    // Remove ANSI escape sequences
    const cleanText = text.replace(this.ANSI_REGEX, '');
    
    let totalWidth = 0;
    let i = 0;
    
    while (i < cleanText.length) {
      const char = cleanText[i];
      const code = char.charCodeAt(0);
      
      // Handle surrogate pairs (for emojis and high Unicode characters)
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < cleanText.length) {
        const lowSurrogate = cleanText.charCodeAt(i + 1);
        if (lowSurrogate >= 0xDC00 && lowSurrogate <= 0xDFFF) {
          // This is a surrogate pair, combine them
          const combined = String.fromCharCode(code, lowSurrogate);
          totalWidth += this.getCharWidth(combined);
          i += 2; // Skip both characters
          continue;
        }
      }
      
      totalWidth += this.getCharWidth(char);
      i++;
    }
    
    return totalWidth;
  }

  /**
   * Split text into grapheme clusters (basic implementation)
   * Handles surrogate pairs and basic combining characters
   */
  getGraphemes(text) {
    const graphemes = [];
    let i = 0;
    
    while (i < text.length) {
      let grapheme = text[i];
      const code = text.charCodeAt(i);
      
      // Handle surrogate pairs
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
        const lowSurrogate = text.charCodeAt(i + 1);
        if (lowSurrogate >= 0xDC00 && lowSurrogate <= 0xDFFF) {
          grapheme += text[i + 1];
          i += 2;
        } else {
          i++;
        }
      } else {
        i++;
      }
      
      // Collect combining characters that follow
      while (i < text.length) {
        const nextCode = text.codePointAt(i);
        if (this.getCharWidth(String.fromCodePoint(nextCode)) === 0) {
          grapheme += text[i];
          i++;
        } else {
          break;
        }
      }
      
      graphemes.push(grapheme);
    }
    
    return graphemes;
  }

  /**
   * Strip ANSI escape sequences while preserving them for later restoration
   */
  stripAnsiCodes(text) {
    return text.replace(this.ANSI_REGEX, '');
  }

  /**
   * Truncate text to fit within specified terminal cell width
   * Handles all character types and preserves grapheme cluster boundaries
   */
  truncate(text, maxWidth, ellipsis = this.ELLIPSIS) {
    if (!text || maxWidth <= 0) return '';
    
    // Quick check: if no special characters and short enough, return as-is
    const cleanText = this.stripAnsiCodes(text);
    const totalWidth = this.getDisplayWidth(cleanText);
    
    if (totalWidth <= maxWidth) {
      return cleanText;
    }
    
    // Account for ellipsis width
    const ellipsisWidth = this.getDisplayWidth(ellipsis);
    const targetWidth = maxWidth - ellipsisWidth;
    
    if (targetWidth <= 0) {
      return ellipsis.slice(0, maxWidth);
    }
    
    // Split into grapheme clusters and accumulate until we hit the limit
    const graphemes = this.getGraphemes(cleanText);
    let result = '';
    let currentWidth = 0;
    
    for (const grapheme of graphemes) {
      const graphemeWidth = this.getDisplayWidth(grapheme);
      
      if (currentWidth + graphemeWidth > targetWidth) {
        break;
      }
      
      result += grapheme;
      currentWidth += graphemeWidth;
    }
    
    return result + ellipsis;
  }

  /**
   * Pad text to exact width (for table columns)
   */
  padToWidth(text, width, align = 'left', padChar = ' ') {
    const displayWidth = this.getDisplayWidth(text);
    const padding = Math.max(0, width - displayWidth);
    const padString = padChar.repeat(padding);
    
    switch (align) {
      case 'right':
        return padString + text;
      case 'center':
        const leftPad = Math.floor(padding / 2);
        const rightPad = padding - leftPad;
        return padChar.repeat(leftPad) + text + padChar.repeat(rightPad);
      default: // 'left'
        return text + padString;
    }
  }

  /**
   * Clean text for processing (remove control characters, normalize whitespace)
   */
  cleanText(text) {
    return text
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')  // Remove ANSI codes
      .replace(/[\u0000-\u001F]/g, ' ')       // Replace control characters
      .replace(/[\u007F-\u009F]/g, ' ')       // Replace DEL and C1 control characters
      .replace(/\t/g, ' ')                    // Replace tabs with spaces
      .replace(/\r?\n/g, ' ')                 // Replace line breaks with spaces
      .replace(/\s+/g, ' ')                   // Collapse multiple spaces
      .trim();                                // Remove leading/trailing spaces
  }

  /**
   * High-level truncation method that combines cleaning and truncation
   */
  smartTruncate(text, maxWidth, ellipsis = this.ELLIPSIS) {
    const cleaned = this.cleanText(text);
    return this.truncate(cleaned, maxWidth, ellipsis);
  }
}

// Export singleton instance
module.exports = new TextTruncator();