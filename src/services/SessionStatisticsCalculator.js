/**
 * SessionStatisticsCalculator
 * Handles calculation of session metrics and summary generation
 * Extracted from SessionManager following Single Responsibility Principle
 */

const textTruncator = require('../utils/textTruncator');

class SessionStatisticsCalculator {
  constructor() {
    // Action patterns for summary generation
    this.actionPatterns = [
      { pattern: /fix|修正|なおして/i, label: 'Fix' },
      { pattern: /implement|実装|つくって/i, label: 'Implement' },
      { pattern: /refactor|リファクタ/i, label: 'Refactor' },
      { pattern: /debug|デバッグ/i, label: 'Debug' },
      { pattern: /test|テスト/i, label: 'Test' },
      { pattern: /analyze|分析|解析/i, label: 'Analyze' },
      { pattern: /optimize|最適化/i, label: 'Optimize' },
      { pattern: /update|更新|アップデート/i, label: 'Update' },
      { pattern: /add|追加/i, label: 'Add' },
      { pattern: /remove|削除/i, label: 'Remove' },
      { pattern: /error|エラー/i, label: 'Error' },
      { pattern: /bug|バグ/i, label: 'Bug' },
      { pattern: /選択|selection/i, label: 'Selection' },
      { pattern: /ハイライト|highlight/i, label: 'Highlight' },
      { pattern: /表示|display/i, label: 'Display' },
      { pattern: /画面|screen|view/i, label: 'View' }
    ];

    // File extension patterns for summary generation
    this.fileExtensionPattern = /[\w-]+\.(js|ts|tsx|jsx|json|md|css|html|py|rs|go|java|cpp|c|h|hpp)/g;
  }

  /**
   * Calculate comprehensive session metrics
   * @param {Object[]} conversationPairs - Array of conversation pair objects
   * @returns {Object} Session metrics object
   */
  calculateSessionMetrics(conversationPairs) {
    if (conversationPairs.length === 0) {
      return this.createEmptyMetrics();
    }
    
    const responseTimes = this.extractResponseTimes(conversationPairs);
    const totalTools = this.calculateTotalTools(conversationPairs);
    const tokenUsage = this.calculateTokenUsage(conversationPairs);
    const timeMetrics = this.calculateTimeMetrics(conversationPairs, responseTimes);
    
    return {
      ...timeMetrics,
      avgResponseTime: this.calculateAverageResponseTime(responseTimes),
      totalTools,
      toolUsageCount: totalTools, // Add toolUsageCount field for sorting
      ...tokenUsage
    };
  }

  /**
   * Create empty metrics object for sessions with no conversations
   * @returns {Object} Empty metrics object
   */
  createEmptyMetrics() {
    return {
      duration: 0,
      actualDuration: 0,
      avgResponseTime: 0,
      totalTools: 0,
      startTime: null,
      endTime: null,
      lastActivity: null,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0
    };
  }

  /**
   * Extract response times from conversation pairs
   * @param {Object[]} conversationPairs - Array of conversation pairs
   * @returns {number[]} Array of response times in seconds
   */
  extractResponseTimes(conversationPairs) {
    return conversationPairs.map(pair => {
      // If responseTime is missing, calculate it from timestamps
      if (pair.responseTime !== undefined) {
        return pair.responseTime;
      }
      if (pair.userTime && pair.assistantTime) {
        return this.calculateResponseTime(pair.userTime, pair.assistantTime);
      }
      return 0;
    });
  }

  /**
   * Calculate total number of tools used across all conversations
   * @param {Object[]} conversationPairs - Array of conversation pairs
   * @returns {number} Total tool count
   */
  calculateTotalTools(conversationPairs) {
    return conversationPairs.reduce((sum, pair) => sum + (pair.toolCount || 0), 0);
  }

  /**
   * Calculate aggregated token usage across all conversations
   * @param {Object[]} conversationPairs - Array of conversation pairs
   * @returns {Object} Aggregated token usage object
   */
  calculateTokenUsage(conversationPairs) {
    return conversationPairs.reduce((acc, pair) => {
      if (pair.tokenUsage) {
        acc.inputTokens += pair.tokenUsage.inputTokens || 0;
        acc.outputTokens += pair.tokenUsage.outputTokens || 0;
        acc.totalTokens += pair.tokenUsage.totalTokens || 0;
        acc.cacheCreationInputTokens += pair.tokenUsage.cacheCreationInputTokens || 0;
        acc.cacheReadInputTokens += pair.tokenUsage.cacheReadInputTokens || 0;
      }
      return acc;
    }, {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0
    });
  }

  /**
   * Calculate time-related metrics
   * @param {Object[]} conversationPairs - Array of conversation pairs
   * @param {number[]} responseTimes - Array of response times
   * @returns {Object} Time metrics object
   */
  calculateTimeMetrics(conversationPairs, responseTimes) {
    // Handle different timestamp field names
    const startTime = conversationPairs[0].userTime || conversationPairs[0].timestamp;
    const endTime = conversationPairs[conversationPairs.length - 1].assistantTime || 
                   conversationPairs[conversationPairs.length - 1].timestamp;
    
    // Calculate total response time (sum of all response times in milliseconds)
    const totalResponseTime = responseTimes.reduce((sum, time) => sum + (time * 1000), 0);
    
    // Calculate actual session duration (from first message to last response)
    const actualDuration = startTime && endTime ? 
      new Date(endTime) - new Date(startTime) : 0;
    
    return {
      duration: Math.max(0, totalResponseTime), // Total response time in milliseconds
      actualDuration: Math.max(0, actualDuration), // Actual session time in milliseconds
      startTime,
      endTime,
      lastActivity: endTime
    };
  }

  /**
   * Calculate average response time
   * @param {number[]} responseTimes - Array of response times
   * @returns {number} Average response time in seconds
   */
  calculateAverageResponseTime(responseTimes) {
    if (responseTimes.length === 0) return 0;
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  /**
   * Calculate response time between timestamps
   * @param {string|Date} startTime - Start timestamp
   * @param {string|Date} endTime - End timestamp
   * @returns {number} Response time in seconds
   */
  calculateResponseTime(startTime, endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      const seconds = Math.max(0, (end - start) / 1000); // Convert to seconds
      
      // Cap response time at 60 minutes (3600 seconds)
      // This prevents long pauses (user walking away) from skewing statistics
      const MAX_REASONABLE_RESPONSE_TIME = 3600; // 60 minutes
      
      if (seconds > MAX_REASONABLE_RESPONSE_TIME) {
        return MAX_REASONABLE_RESPONSE_TIME;
      }
      
      return seconds;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate session summary from conversations
   * @param {Object[]} conversationPairs - Array of conversation pairs
   * @returns {Object} Session summary object with short and detailed summaries
   */
  generateSessionSummary(conversationPairs) {
    if (conversationPairs.length === 0) {
      return { short: 'No conversations', detailed: [] };
    }
    
    // Get first few meaningful conversations
    const summaryPairs = this.getMeaningfulConversations(conversationPairs);
    
    if (summaryPairs.length === 0) {
      return this.createFallbackSummary(conversationPairs[0]);
    }
    
    // Extract topics and build summary
    const { topics, detailedMessages } = this.extractTopicsAndMessages(summaryPairs);
    const shortSummary = this.buildShortSummary(topics, summaryPairs);
    
    return {
      short: shortSummary,
      detailed: detailedMessages.slice(0, 3)
    };
  }

  /**
   * Get meaningful conversations (filter out very short messages)
   * @param {Object[]} conversationPairs - Array of conversation pairs
   * @returns {Object[]} Array of meaningful conversation pairs
   */
  getMeaningfulConversations(conversationPairs) {
    const summaryPairs = [];
    const maxSummaryConversations = 5;
    
    for (const pair of conversationPairs) {
      // Skip very short messages
      if (pair.userContent.length < 10) continue;
      
      summaryPairs.push(pair);
      if (summaryPairs.length >= maxSummaryConversations) break;
    }
    
    return summaryPairs;
  }

  /**
   * Create fallback summary for edge cases
   * @param {Object} firstConversation - First conversation pair
   * @returns {Object} Fallback summary object
   */
  createFallbackSummary(firstConversation) {
    return {
      short: textTruncator.smartTruncate(firstConversation.userContent, 50),
      detailed: [firstConversation.userContent]
    };
  }

  /**
   * Extract topics and messages from conversation pairs
   * @param {Object[]} summaryPairs - Array of meaningful conversation pairs
   * @returns {Object} Object with topics array and detailed messages array
   */
  extractTopicsAndMessages(summaryPairs) {
    const topics = [];
    const seenTopics = new Set();
    const detailedMessages = [];
    
    for (const pair of summaryPairs) {
      const message = pair.userContent;
      detailedMessages.push(message);
      
      this.extractFileNames(message, topics, seenTopics);
      this.extractActionKeywords(message, topics, seenTopics);
    }
    
    return { topics, detailedMessages };
  }

  /**
   * Extract file names from message content
   * @param {string} message - Message content
   * @param {string[]} topics - Topics array to add to
   * @param {Set} seenTopics - Set of already seen topics
   */
  extractFileNames(message, topics, seenTopics) {
    const messageLower = message.toLowerCase();
    const fileMatches = messageLower.match(this.fileExtensionPattern);
    
    if (fileMatches) {
      fileMatches.forEach(file => {
        if (!seenTopics.has(file)) {
          topics.push(file);
          seenTopics.add(file);
        }
      });
    }
  }

  /**
   * Extract action keywords from message content
   * @param {string} message - Message content
   * @param {string[]} topics - Topics array to add to
   * @param {Set} seenTopics - Set of already seen topics
   */
  extractActionKeywords(message, topics, seenTopics) {
    const messageLower = message.toLowerCase();
    
    for (const { pattern, label } of this.actionPatterns) {
      if (pattern.test(messageLower) && !seenTopics.has(label)) {
        topics.push(label);
        seenTopics.add(label);
      }
    }
  }

  /**
   * Build short summary from extracted topics
   * @param {string[]} topics - Array of extracted topics
   * @param {Object[]} summaryPairs - Array of conversation pairs
   * @returns {string} Short summary string
   */
  buildShortSummary(topics, summaryPairs) {
    if (topics.length > 0) {
      return topics.slice(0, 5).join(' • ');
    } else {
      return textTruncator.smartTruncate(summaryPairs[0].userContent, 60);
    }
  }
}

module.exports = SessionStatisticsCalculator;