/**
 * CacheOptimizer
 * Reduces cache size by removing unnecessary data
 */

class CacheOptimizer {
  /**
   * Optimize session data for caching
   * Removes large, redundant, or regeneratable data
   */
  static optimizeSessionForCache(session) {
    const optimized = {
      sessionId: session.sessionId,
      fullSessionId: session.fullSessionId,
      projectName: session.projectName,
      projectPath: session.projectPath,
      filePath: session.filePath,
      totalConversations: session.totalConversations,
      summary: session.summary,
      duration: session.duration,
      actualDuration: session.actualDuration,
      avgResponseTime: session.avgResponseTime,
      totalTools: session.totalTools,
      toolUsageCount: session.toolUsageCount,
      startTime: session.startTime,
      endTime: session.endTime,
      lastActivity: session.lastActivity,
      totalTokens: session.totalTokens,
      inputTokens: session.inputTokens,
      outputTokens: session.outputTokens,
      cacheCreationInputTokens: session.cacheCreationInputTokens,
      cacheReadInputTokens: session.cacheReadInputTokens,
      // Store minimal conversation data
      conversationPairs: session.conversationPairs.map(conv => this.optimizeConversation(conv))
    };
    
    return optimized;
  }
  
  /**
   * Optimize conversation data
   * Keep only essential fields
   */
  static optimizeConversation(conversation) {
    return {
      userTime: conversation.userTime,
      assistantTime: conversation.assistantTime,
      responseTime: conversation.responseTime,
      userContent: this.truncateContent(conversation.userContent, 500),
      assistantContent: this.truncateContent(conversation.assistantContent, 500),
      thinkingCharCount: conversation.thinkingCharCount,
      toolCount: conversation.toolCount,
      toolsUsed: conversation.toolsUsed,
      tokenUsage: conversation.tokenUsage,
      // Remove large data like rawAssistantContent, full tool results, etc
      // These can be re-parsed from the original file if needed
    };
  }
  
  /**
   * Truncate content for cache storage
   */
  static truncateContent(content, maxLength) {
    if (!content || content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }
  
  /**
   * Restore session from optimized cache
   * Fills in missing data with defaults
   */
  static restoreSessionFromCache(cached) {
    return {
      ...cached,
      conversationPairs: cached.conversationPairs.map(conv => ({
        ...conv,
        // Restore missing fields with defaults
        thinkingContent: [],
        toolUses: [],
        allToolUses: [],
        toolResults: [],
        rawAssistantContent: [],
        userMessage: conv.userContent,
        assistantResponse: conv.assistantContent,
        assistantResponsePreview: conv.assistantContent.substring(0, 200),
        timestamp: conv.userTime
      }))
    };
  }
}

module.exports = CacheOptimizer;