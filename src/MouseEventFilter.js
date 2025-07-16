/**
 * Mouse Event Filter
 * 
 * Centralized mouse event detection and filtering logic
 * to prevent mouse event artifacts from appearing in the terminal
 */
class MouseEventFilter {
  constructor() {
    // Mouse event patterns for different types of events
    this.patterns = {
      // ANSI escape sequences
      ansiEscape: /\x1b\[/,
      
      // Raw mouse event formats
      rawSingle: /^\d+;\d+;\d+[Mm]/,
      rawMultiple: /\d+;\d+;\d+[Mm]\d+;\d+;\d+[Mm]/,
      
      // Specific button codes
      dragLeft: /^65;\d+;\d+M/,      // Left drag
      dragMiddle: /^32;\d+;\d+M/,    // Middle drag
      leftClick: /^0;\d+;\d+M/,      // Left click (selection)
      middleClick: /^1;\d+;\d+M/,    // Middle click
      rightClick: /^2;\d+;\d+M/,     // Right click
      selectionRelease: /^3;\d+;\d+M/, // Selection release
      
      // Scroll wheel events (for artifact detection only)
      scrollUp: /^64;\d+;\d+M/,      // Scroll up
      scrollDown: /^65;\d+;\d+M/,    // Scroll down
      
      // Long sequences (likely mouse events)
      longSequence: (str) => str.length > 100 && /^\d+;\d+;\d+M/.test(str),
      
      // Repeated event patterns for output filtering
      repeatedDrag: /^(65|32);\d+;\d+M\1;\d+;\d+M/,
      repeatedClick: /^[0-3];\d+;\d+M[0-3];\d+;\d+M/,
      multipleEvents: /^\d+;\d+;\d+M\d+;\d+;\d+M/
    };
  }

  /**
   * Check if input data contains mouse events
   * Used for stdin data filtering
   */
  isMouseEventInput(dataStr) {
    return (
      this.patterns.ansiEscape.test(dataStr) ||
      this.patterns.rawSingle.test(dataStr) ||
      this.patterns.rawMultiple.test(dataStr) ||
      this.patterns.longSequence(dataStr) ||
      this.patterns.dragLeft.test(dataStr) ||
      this.patterns.dragMiddle.test(dataStr) ||
      this.patterns.leftClick.test(dataStr) ||
      this.patterns.middleClick.test(dataStr) ||
      this.patterns.rightClick.test(dataStr) ||
      this.patterns.selectionRelease.test(dataStr)
    );
  }

  /**
   * Check if keypress string contains mouse events
   * Used for keypress filtering - minimal filtering to preserve all keyboard input
   */
  isMouseEventKeypress(str) {
    if (!str) return false;
    
    // For keypress filtering, only block very obvious and long mouse event patterns
    // This ensures keyboard shortcuts like Ctrl+R are never blocked
    return (
      // Only block multiple mouse events or very long sequences
      this.patterns.rawMultiple.test(str) ||
      (str.length > 50 && /^\d+;\d+;\d+M\d+;\d+;\d+M/.test(str))
    );
  }

  /**
   * Check if output string contains mouse events
   * Used for stdout filtering - more restrictive to avoid blocking normal text
   */
  isMouseEventOutput(str) {
    return (
      this.patterns.multipleEvents.test(str) ||
      this.patterns.longSequence(str) ||
      this.patterns.repeatedDrag.test(str) ||
      this.patterns.repeatedClick.test(str) ||
      // Also block if it ends with a mouse event (common artifact pattern)
      /\d+;\d+;\d+M$/.test(str)
    );
  }

  /**
   * Extract scroll wheel events from input data
   * Returns array of scroll events: { direction: 'up'|'down', x: number, y: number }
   */
  extractScrollEvents(dataStr) {
    const events = [];
    
    // First, check for SGR format and remove processed parts
    let processedStr = dataStr;
    
    // SGR format: \x1b[<buttoncode;x;yM
    const sgrMatches = dataStr.matchAll(/\x1b\[<(64|65);(\d+);(\d+)M/g);
    for (const match of sgrMatches) {
      const buttonCode = parseInt(match[1], 10);
      const x = parseInt(match[2], 10);
      const y = parseInt(match[3], 10);
      
      events.push({
        direction: buttonCode === 64 ? 'up' : 'down',
        x: x,
        y: y
      });
      
      // Remove processed SGR sequence
      processedStr = processedStr.replace(match[0], '');
    }
    
    // Raw format: buttoncode;x;yM (only process if not part of SGR sequence)
    const rawMatches = processedStr.matchAll(/(?:^|[^0-9])(64|65);(\d+);(\d+)M/g);
    for (const match of rawMatches) {
      const buttonCode = parseInt(match[1], 10);
      const x = parseInt(match[2], 10);
      const y = parseInt(match[3], 10);
      
      events.push({
        direction: buttonCode === 64 ? 'up' : 'down',
        x: x,
        y: y
      });
    }
    
    return events;
  }

  /**
   * Check if a specific pattern matches
   * Utility method for custom pattern checking
   */
  matchesPattern(str, patternName) {
    if (!this.patterns[patternName]) {
      return false;
    }
    
    const pattern = this.patterns[patternName];
    if (typeof pattern === 'function') {
      return pattern(str);
    }
    
    return pattern.test(str);
  }
}

module.exports = MouseEventFilter;