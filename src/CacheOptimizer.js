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
      userContent: conversation.userContent, // Keep full content for detail view
      assistantContent: conversation.assistantContent, // Keep full content for detail view
      thinkingCharCount: conversation.thinkingCharCount,
      toolCount: conversation.toolCount,
      toolsUsed: conversation.toolsUsed,
      tokenUsage: conversation.tokenUsage,
      // Keep essential data for display
      thinkingContent: conversation.thinkingContent,
      toolUses: this.optimizeToolUses(conversation.toolUses),
      allToolUses: this.optimizeToolUses(conversation.allToolUses),
      rawAssistantContent: conversation.rawAssistantContent,
      // Legacy fields - only store if different from main fields
      userMessage: conversation.userMessage !== conversation.userContent ? conversation.userMessage : undefined,
      assistantResponse: conversation.assistantResponse !== conversation.assistantContent ? conversation.assistantResponse : undefined,
      assistantResponsePreview: conversation.assistantResponsePreview,
      timestamp: conversation.timestamp !== conversation.userTime ? conversation.timestamp : undefined
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
   * Optimize tool uses to reduce size
   * Remove very large tool results but keep structure
   */
  static optimizeToolUses(toolUses) {
    if (!toolUses || !Array.isArray(toolUses)) return toolUses;
    
    return toolUses.map(tool => ({
      ...tool,
      // Truncate very large tool results
      result: tool.result && tool.result.length > 5000 
        ? tool.result.substring(0, 5000) + '... [truncated]'
        : tool.result,
      // Truncate large inputs
      input: tool.input && JSON.stringify(tool.input).length > 1000
        ? { ...tool.input, _truncated: true }
        : tool.input
    }));
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
        // Only add missing fields, don't override existing ones
        thinkingContent: conv.thinkingContent || [],
        toolUses: conv.toolUses || [],
        allToolUses: conv.allToolUses || [],
        toolResults: conv.toolResults || [],
        rawAssistantContent: conv.rawAssistantContent || [],
        userMessage: conv.userMessage || conv.userContent,
        assistantResponse: conv.assistantResponse || conv.assistantContent,
        assistantResponsePreview: conv.assistantResponsePreview || conv.assistantContent.substring(0, 200),
        timestamp: conv.timestamp || conv.userTime
      }))
    };
  }
}

module.exports = CacheOptimizer;