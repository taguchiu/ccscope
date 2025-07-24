/**
 * QuickParser
 * Ultra-fast parsing for essential fields only
 */

class QuickParser {
  constructor() {
    // Pre-compiled patterns for quick extraction
    this.patterns = {
      type: /"type"\s*:\s*"([^"]+)"/,
      timestamp: /"timestamp"\s*:\s*"([^"]+)"/,
      sessionId: /"sessionId"\s*:\s*"([^"]+)"/,
      cwd: /"cwd"\s*:\s*"([^"]+)"/,
      hasContent: /"content"\s*:\s*["\[\{]/,
      toolUseStart: /"type"\s*:\s*"tool_use"/,
      thinkingStart: /"type"\s*:\s*"thinking"/
    };
  }

  /**
   * Quick parse to extract essential fields only
   * Much faster than full JSON.parse for filtering
   */
  quickExtract(line) {
    try {
      // Extract type
      const typeMatch = line.match(this.patterns.type);
      if (!typeMatch) return null;
      
      const type = typeMatch[1];
      if (type !== 'user' && type !== 'assistant') return null;
      
      // Extract timestamp
      const timestampMatch = line.match(this.patterns.timestamp);
      const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
      
      // Check if has content
      const hasContent = this.patterns.hasContent.test(line);
      if (!hasContent) return null;
      
      // Extract other essential fields quickly
      const sessionIdMatch = line.match(this.patterns.sessionId);
      const cwdMatch = line.match(this.patterns.cwd);
      
      return {
        type,
        timestamp,
        sessionId: sessionIdMatch ? sessionIdMatch[1] : undefined,
        cwd: cwdMatch ? cwdMatch[1] : undefined,
        // Mark for full parsing later
        _needsFullParse: true,
        _rawLine: line
      };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Optimized counting of tool uses without full parse
   */
  countToolUses(line) {
    // Count occurrences of tool_use pattern
    const matches = line.match(/"type"\s*:\s*"tool_use"/g);
    return matches ? matches.length : 0;
  }
  
  /**
   * Quick check if line contains thinking content
   */
  hasThinking(line) {
    return this.patterns.thinkingStart.test(line);
  }
}

module.exports = QuickParser;