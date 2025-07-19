/**
 * ContentExtractor
 * Handles extraction of various content types from JSONL entries
 * Extracted from SessionManager following Single Responsibility Principle
 * Uses Extract Method pattern to organize content extraction logic
 */

class ContentExtractor {
  constructor() {
    // Thinking content markers for detection
    this.thinkingMarkers = [
      '🔧 TOOLS EXECUTION FLOW:',
      '🧠 THINKING PROCESS:',
      '[Thinking',
      /\[\d+\]\s+(Read|Write|Edit|Bash|Glob|Grep|Task)/,
      'File:',
      'Command:',
      'pattern:',
      'path:',
      /^\s*\[\d+\]\s+\w+$/m  // Tool execution markers like [1] Read
    ];
  }

  /**
   * Extract tool results from JSONL entry
   * @param {Object} entry - JSONL entry to extract from
   * @returns {Object[]} Array of tool result objects
   */
  extractToolResults(entry) {
    const results = [];
    if (!entry.message || !entry.message.content) return results;
    
    const content = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    for (const item of content) {
      if (item.type === 'tool_result' && item.tool_use_id) {
        const resultContent = this.extractToolResultContent(item);
        
        results.push({
          toolId: item.tool_use_id,
          result: resultContent,
          isError: item.is_error || false
        });
      }
    }
    
    return results;
  }

  /**
   * Extract content from a tool result item
   * @param {Object} item - Tool result item
   * @returns {string} Extracted result content
   */
  extractToolResultContent(item) {
    // Try multiple ways to get the result content
    if (item.content) {
      return this.extractContentFromProperty(item.content);
    } else if (item.text) {
      return item.text;
    } else if (item.result) {
      return typeof item.result === 'string' ? item.result : JSON.stringify(item.result);
    }
    
    return '';
  }

  /**
   * Extract content from content property (handles different formats)
   * @param {string|Array|Object} content - Content to extract from
   * @returns {string} Extracted content as string
   */
  extractContentFromProperty(content) {
    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      return content.map(c => c.text || c.content || JSON.stringify(c)).join('\n');
    } else if (content.text) {
      return content.text;
    } else {
      return JSON.stringify(content);
    }
  }

  /**
   * Extract token usage from JSONL entry
   * @param {Object} entry - JSONL entry to extract from
   * @returns {Object} Token usage object with standardized properties
   */
  extractTokenUsage(entry) {
    // Usage data can be in entry.usage or entry.message.usage
    const usage = entry.usage || (entry.message && entry.message.usage);
    
    if (!usage) {
      return this.createEmptyTokenUsage();
    }
    
    return {
      inputTokens: usage.input_tokens || 0,
      outputTokens: usage.output_tokens || 0,
      totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
      cacheCreationInputTokens: usage.cache_creation_input_tokens || 0,
      cacheReadInputTokens: usage.cache_read_input_tokens || 0
    };
  }

  /**
   * Create empty token usage object
   * @returns {Object} Empty token usage object
   */
  createEmptyTokenUsage() {
    return {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0
    };
  }

  /**
   * Extract thinking content from JSONL entry
   * @param {Object} entry - JSONL entry to extract from
   * @returns {Object} Object with charCount and content array
   */
  extractThinkingContent(entry) {
    let charCount = 0;
    const content = [];
    
    if (!entry.message || !entry.message.content) {
      return { charCount, content };
    }
    
    const items = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    for (const item of items) {
      if (item.type === 'thinking' && item.thinking) {
        charCount += item.thinking.length;
        content.push({
          timestamp: new Date(entry.timestamp),
          text: item.thinking
        });
      }
    }
    
    return { charCount, content };
  }

  /**
   * Check if JSONL entry has actual content
   * @param {Object} entry - JSONL entry to check
   * @returns {boolean} True if entry has actual content
   */
  hasActualContent(entry) {
    if (!entry.message || !entry.message.content) return false;
    
    const content = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    return content.some(item => {
      if (item.type === 'text' && item.text && item.text.trim().length > 0) {
        return true;
      }
      if (item.type === 'thinking' && item.thinking) {
        return true;
      }
      if (item.type === 'tool_use') {
        return true;
      }
      if (typeof item === 'string' && item.trim().length > 0) {
        return true;
      }
      return false;
    });
  }

  /**
   * Extract user content from JSONL entry
   * @param {Object} entry - User JSONL entry
   * @returns {string} Extracted user content
   */
  extractUserContent(entry) {
    if (!entry.message || !entry.message.content) return '(No content)';
    
    const content = entry.message.content;
    let text = this.convertContentToText(content);
    
    // Handle special content types
    if (this.isContinuationSession(text)) {
      return this.extractContinuationSessionContent(text);
    }
    
    if (this.containsThinkingContent(text)) {
      return this.extractActualUserMessage(text);
    }
    
    // Return full content without sanitizing (keep line breaks)
    return text.trim();
  }

  /**
   * Convert content to text string
   * @param {string|Array|Object} content - Content in various formats
   * @returns {string} Content as text string
   */
  convertContentToText(content) {
    if (typeof content === 'string') {
      return content;
    } else if (Array.isArray(content)) {
      return content.map(item => {
        if (typeof item === 'string') return item;
        if (item.type === 'text' && item.text) return item.text;
        return '';
      }).join('');
    } else if (typeof content === 'object') {
      return JSON.stringify(content);
    }
    
    return '';
  }

  /**
   * Check if text represents a continuation session
   * @param {string} text - Text to check
   * @returns {boolean} True if text is from continuation session
   */
  isContinuationSession(text) {
    return text.includes('This session is being continued from a previous conversation');
  }

  /**
   * Extract content from continuation session metadata
   * @param {string} text - Continuation session text
   * @returns {string} Extracted actual user request
   */
  extractContinuationSessionContent(text) {
    const lines = text.split('\n');
    let actualRequest = '';
    
    // Look for actual user request patterns
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      
      // Look for patterns that indicate the actual user request
      if (this.isUserRequestIndicator(line)) {
        actualRequest = lines.slice(i).join('\n').trim();
        break;
      }
      
      // Also check for the last non-metadata content
      if (this.isNonMetadataContent(line)) {
        actualRequest = line;
      }
    }
    
    // Return extracted request or continuation marker
    return actualRequest || '[Continued session - see full detail for context]';
  }

  /**
   * Check if line indicates a user request
   * @param {string} line - Line to check
   * @returns {boolean} True if line indicates user request
   */
  isUserRequestIndicator(line) {
    return line.match(/^(The user|User|ユーザー).*[:：]/i) || 
           line.match(/requested|asked|want|リクエスト|依頼|要求/i) ||
           line.match(/表示方法|見直し|修正|改善/i);
  }

  /**
   * Check if line is non-metadata content
   * @param {string} line - Line to check
   * @returns {boolean} True if line is non-metadata content
   */
  isNonMetadataContent(line) {
    return !line.startsWith('Analysis:') && 
           !line.startsWith('Summary:') && 
           !line.startsWith('-') &&
           !line.match(/^\d+\./) &&
           line.length > 0;
  }

  /**
   * Check if text contains Claude Code thinking content markers
   * @param {string} text - Text to check
   * @returns {boolean} True if text contains thinking content
   */
  containsThinkingContent(text) {
    return this.thinkingMarkers.some(marker => {
      if (typeof marker === 'string') {
        return text.includes(marker);
      } else {
        return marker.test(text);
      }
    });
  }

  /**
   * Extract actual user message from text containing thinking content
   * @param {string} text - Text with thinking content
   * @returns {string} Extracted user message
   */
  extractActualUserMessage(text) {
    const lines = text.split('\n');
    const userMessageLines = [];
    let foundThinkingMarker = false;
    
    for (const line of lines) {
      // Check if this line is a thinking content marker
      if (this.isThinkingMarker(line, foundThinkingMarker)) {
        foundThinkingMarker = true;
        break;
      }
      
      userMessageLines.push(line);
    }
    
    const userMessage = userMessageLines.join('\n').trim();
    return userMessage || '[See full detail for complete context]';
  }

  /**
   * Check if line is a thinking marker
   * @param {string} line - Line to check
   * @param {boolean} foundThinkingMarker - Whether thinking marker already found
   * @returns {boolean} True if line is thinking marker
   */
  isThinkingMarker(line, foundThinkingMarker) {
    return line.includes('🔧 TOOLS EXECUTION FLOW:') ||
           line.includes('🧠 THINKING PROCESS:') ||
           line.match(/^\s*\[Thinking \d+\]/) ||
           line.match(/^\s*\[\d+\]\s+\w+/) ||
           line.startsWith('File:') ||
           line.startsWith('Command:') ||
           line.startsWith('pattern:') ||
           line.startsWith('path:') ||
           (foundThinkingMarker && line.trim().startsWith('['));
  }

  /**
   * Extract assistant content from JSONL entry
   * @param {Object} entry - Assistant JSONL entry
   * @returns {string} Extracted assistant content
   */
  extractAssistantContent(entry) {
    if (!entry.message || !entry.message.content) return '(No content)';
    
    const content = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    let textContent = '';
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        textContent += item.text;
      } else if (typeof item === 'string') {
        textContent += item;
      }
    }
    
    // Return full content without sanitizing (keep line breaks)
    return textContent.trim();
  }

  /**
   * Sanitize text for display purposes
   * @param {string} text - Text to sanitize
   * @param {number} maxLength - Maximum length for truncation
   * @returns {string} Sanitized text
   */
  sanitizeForDisplay(text, maxLength) {
    if (!text) return '';
    
    let sanitized = text
      .replace(/[\r\n]+/g, ' ')      // Replace line breaks with spaces
      .replace(/\s+/g, ' ')          // Collapse multiple spaces
      .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
      .trim();
    
    // Truncate if necessary
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...';
    }
    
    return sanitized;
  }

  /**
   * Extract raw assistant content for chronological display (legacy method)
   * @param {Object} entry - Assistant JSONL entry
   * @returns {Array} Array of content items
   */
  extractRawAssistantContent(entry) {
    if (!entry.message || !entry.message.content) return [];
    
    const content = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    return content;
  }

  /**
   * Extract thinking character count from entry (legacy method)
   * @param {Object} entry - JSONL entry
   * @returns {number} Character count of thinking content
   */
  extractThinkingChars(entry) {
    const thinkingData = this.extractThinkingContent(entry);
    return thinkingData.charCount;
  }
}

module.exports = ContentExtractor;