/**
 * ConversationBuilder
 * Handles building conversation pairs from JSONL entries
 * Extracted from SessionManager following Single Responsibility Principle
 * Uses Extract Method pattern to break down complex conversation building logic
 */

class ConversationBuilder {
  constructor(contentExtractor, fastParser) {
    this.contentExtractor = contentExtractor;
    this.fastParser = fastParser;
  }

  /**
   * Build conversation pairs from JSONL entries
   * Main entry point that coordinates the conversation building process
   * @param {Object[]} entries - Array of JSONL entries
   * @returns {Object[]} Array of conversation pair objects
   */
  buildConversationPairs(entries) {
    const pairs = [];
    let currentState = this.createInitialState();

    for (const entry of entries) {
      if (!entry.type) continue;
      
      // Ensure timestamp exists (use current time as fallback for tests)
      this.ensureTimestamp(entry);

      if (entry.type === 'user') {
        this.processUserEntry(entry, currentState, pairs);
      } else if (entry.type === 'assistant' && currentState.userMessage) {
        this.processAssistantEntry(entry, currentState);
      }
    }
    
    // Complete final conversation if exists
    this.completeFinalConversation(currentState, pairs);
    
    return pairs;
  }

  /**
   * Create initial conversation state
   * @returns {Object} Initial conversation state object
   */
  createInitialState() {
    return {
      userMessage: null,
      toolUses: [],
      toolResults: new Map(), // Map toolId to result
      thinkingCharCount: 0,
      thinkingContent: [],
      assistantResponses: [],
      subAgentCommands: [],
      tokenUsage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0
      }
    };
  }

  /**
   * Ensure entry has a timestamp
   * @param {Object} entry - JSONL entry
   */
  ensureTimestamp(entry) {
    if (!entry.timestamp) {
      entry.timestamp = new Date().toISOString();
    }
  }

  /**
   * Process a user entry
   * @param {Object} entry - User JSONL entry
   * @param {Object} currentState - Current conversation state
   * @param {Object[]} pairs - Array of conversation pairs
   */
  processUserEntry(entry, currentState, pairs) {
    // Skip tool result notifications
    if (this.isToolResultNotification(entry)) {
      return;
    }
    
    // Check if this is a sub-agent command
    const isSubAgentCommand = this.isSubAgentCommand(entry, currentState);
    
    if (isSubAgentCommand && currentState.userMessage) {
      this.addSubAgentCommand(entry, currentState);
    } else {
      this.startNewConversation(entry, currentState, pairs);
    }
  }

  /**
   * Process an assistant entry
   * @param {Object} entry - Assistant JSONL entry
   * @param {Object} currentState - Current conversation state
   */
  processAssistantEntry(entry, currentState) {
    // Extract and accumulate data from assistant message
    this.extractAndAccumulateToolData(entry, currentState);
    this.extractAndAccumulateThinkingData(entry, currentState);
    this.extractAndAccumulateTokenUsage(entry, currentState);
    
    // Handle sub-agent responses
    this.handleSubAgentResponse(entry, currentState);
    
    // Add to assistant responses if it has actual content
    if (this.hasActualContent(entry) || currentState.toolUses.length > 0) {
      currentState.assistantResponses.push(entry);
    }
  }

  /**
   * Add sub-agent command to current conversation
   * @param {Object} entry - User entry representing sub-agent command
   * @param {Object} currentState - Current conversation state
   */
  addSubAgentCommand(entry, currentState) {
    if (!currentState.subAgentCommands) {
      currentState.subAgentCommands = [];
    }
    currentState.subAgentCommands.push({
      command: entry,
      response: null, // Will be filled when assistant responds
      commandIndex: currentState.subAgentCommands.length
    });
  }

  /**
   * Start a new conversation
   * @param {Object} entry - User entry starting new conversation
   * @param {Object} currentState - Current conversation state
   * @param {Object[]} pairs - Array of conversation pairs
   */
  startNewConversation(entry, currentState, pairs) {
    // Complete previous conversation if exists
    if (currentState.userMessage && currentState.assistantResponses.length > 0) {
      const lastAssistant = currentState.assistantResponses[currentState.assistantResponses.length - 1];
      this.createConversationPair(pairs, currentState, lastAssistant);
    }
    
    // Reset state for new conversation
    Object.assign(currentState, this.createInitialState());
    currentState.userMessage = entry;
  }

  /**
   * Extract and accumulate tool data from assistant entry
   * @param {Object} entry - Assistant JSONL entry
   * @param {Object} currentState - Current conversation state
   */
  extractAndAccumulateToolData(entry, currentState) {
    // Extract tool uses from assistant message
    const tools = this.extractToolUses(entry);
    currentState.toolUses.push(...tools);
    
    // Extract tool results from assistant message (including Task tools)
    const toolResults = this.extractToolResults(entry);
    toolResults.forEach(result => {
      currentState.toolResults.set(result.toolId, result);
    });
  }

  /**
   * Extract and accumulate thinking data from assistant entry
   * @param {Object} entry - Assistant JSONL entry
   * @param {Object} currentState - Current conversation state
   */
  extractAndAccumulateThinkingData(entry, currentState) {
    const thinkingData = this.extractThinkingContent(entry);
    currentState.thinkingCharCount += thinkingData.charCount;
    currentState.thinkingContent.push(...thinkingData.content);
  }

  /**
   * Extract and accumulate token usage from assistant entry
   * @param {Object} entry - Assistant JSONL entry
   * @param {Object} currentState - Current conversation state
   */
  extractAndAccumulateTokenUsage(entry, currentState) {
    const tokenUsage = this.extractTokenUsage(entry);
    currentState.tokenUsage.inputTokens += tokenUsage.inputTokens;
    currentState.tokenUsage.outputTokens += tokenUsage.outputTokens;
    currentState.tokenUsage.totalTokens += tokenUsage.totalTokens;
    currentState.tokenUsage.cacheCreationInputTokens += tokenUsage.cacheCreationInputTokens;
    currentState.tokenUsage.cacheReadInputTokens += tokenUsage.cacheReadInputTokens;
  }

  /**
   * Handle sub-agent response
   * @param {Object} entry - Assistant JSONL entry
   * @param {Object} currentState - Current conversation state
   */
  handleSubAgentResponse(entry, currentState) {
    const isSubAgentResponse = this.isSubAgentResponse(entry, currentState);
    
    if (isSubAgentResponse && currentState.subAgentCommands && currentState.subAgentCommands.length > 0) {
      // Find the most recent sub-agent command without a response
      const unresponded = currentState.subAgentCommands.find(cmd => cmd.response === null);
      if (unresponded) {
        unresponded.response = entry;
      }
    }
  }

  /**
   * Complete final conversation if it exists
   * @param {Object} currentState - Current conversation state
   * @param {Object[]} pairs - Array of conversation pairs
   */
  completeFinalConversation(currentState, pairs) {
    if (currentState.userMessage && currentState.assistantResponses.length > 0) {
      const lastAssistant = currentState.assistantResponses[currentState.assistantResponses.length - 1];
      this.createConversationPair(pairs, currentState, lastAssistant);
    }
  }

  /**
   * Check if entry is a sub-agent command (follows a Task tool)
   * @param {Object} entry - JSONL entry to check
   * @param {Object} currentState - Current conversation state
   * @returns {boolean} True if entry is a sub-agent command
   */
  isSubAgentCommand(entry, currentState) {
    // Check if there's a previous Task tool in the current conversation
    if (!currentState.toolUses || currentState.toolUses.length === 0) {
      return false;
    }
    
    // Check if the last tool used was a Task tool
    const lastTool = currentState.toolUses[currentState.toolUses.length - 1];
    if (lastTool && lastTool.toolName === 'Task') {
      return true;
    }
    
    // Also check if the content contains sub-agent indicators
    const content = this.contentExtractor.extractUserContent(entry);
    if (content.includes('⎿ task:') || content.includes('task:')) {
      return true;
    }
    
    return false;
  }

  /**
   * Check if entry is a sub-agent response (follows a sub-agent command)
   * @param {Object} entry - JSONL entry to check
   * @param {Object} currentState - Current conversation state
   * @returns {boolean} True if entry is a sub-agent response
   */
  isSubAgentResponse(entry, currentState) {
    // Check if there are any sub-agent commands waiting for responses
    if (!currentState.subAgentCommands || currentState.subAgentCommands.length === 0) {
      return false;
    }
    
    // Check if there's at least one sub-agent command without a response
    const unresponded = currentState.subAgentCommands.find(cmd => cmd.response === null);
    return !!unresponded;
  }

  /**
   * Check if entry is a tool result notification
   * @param {Object} entry - JSONL entry to check
   * @returns {boolean} True if entry is a tool result notification
   */
  isToolResultNotification(entry) {
    if (!entry.message || !entry.message.content) return false;
    
    const content = entry.message.content;
    
    // String content
    if (typeof content === 'string') {
      return content.includes('tool_use_id') || content.includes('tool_result');
    }
    
    // Array content
    if (Array.isArray(content)) {
      return content.some(item => {
        if (typeof item === 'string') {
          return item.includes('tool_use_id') || item.includes('tool_result');
        }
        if (item && typeof item === 'object') {
          return item.tool_use_id !== undefined || item.type === 'tool_result';
        }
        return false;
      });
    }
    
    // Object content
    if (typeof content === 'object') {
      return content.tool_use_id !== undefined || content.type === 'tool_result';
    }
    
    return false;
  }

  /**
   * Extract tool uses from assistant message
   * @param {Object} entry - Assistant JSONL entry
   * @returns {Object[]} Array of tool use objects
   */
  extractToolUses(entry) {
    if (!entry.message || !entry.message.content) return [];
    
    // Use FastParser's optimized tool extraction
    const tools = this.fastParser.extractToolUsesOptimized(entry.message.content);
    
    // Transform to expected format
    return tools.map(tool => ({
      timestamp: this.fastParser.extractTimestamp(entry),
      toolName: tool.name,
      toolId: tool.id || 'unknown',
      input: tool.input || {}
    }));
  }

  /**
   * Extract tool results from entry
   * @param {Object} entry - JSONL entry
   * @returns {Object[]} Array of tool result objects
   */
  extractToolResults(entry) {
    return this.contentExtractor.extractToolResults(entry);
  }

  /**
   * Extract thinking content from entry
   * @param {Object} entry - JSONL entry
   * @returns {Object} Object with charCount and content array
   */
  extractThinkingContent(entry) {
    return this.contentExtractor.extractThinkingContent(entry);
  }

  /**
   * Extract token usage from entry
   * @param {Object} entry - JSONL entry
   * @returns {Object} Token usage object
   */
  extractTokenUsage(entry) {
    return this.contentExtractor.extractTokenUsage(entry);
  }

  /**
   * Check if entry has actual content
   * @param {Object} entry - JSONL entry
   * @returns {boolean} True if entry has actual content
   */
  hasActualContent(entry) {
    return this.contentExtractor.hasActualContent(entry);
  }

  /**
   * Create conversation pair from current state
   * @param {Object[]} pairs - Array of conversation pairs
   * @param {Object} state - Current conversation state
   * @param {Object} assistantEntry - Assistant JSONL entry
   */
  createConversationPair(pairs, state, assistantEntry) {
    const responseTime = this.calculateResponseTime(state.userMessage.timestamp, assistantEntry.timestamp);
    const assistantContent = this.contentExtractor.extractAssistantContent(assistantEntry);
    
    // Merge tool uses with their results, keep Task tools for display but exclude from count
    const allToolUsesWithResults = state.toolUses.map(tool => {
      const result = state.toolResults.get(tool.toolId);
      return {
        ...tool,
        result: result ? result.result : null,
        isError: result ? result.isError : false
      };
    });
    
    // Filter out Task tools for counting purposes only
    const toolUsesWithResults = allToolUsesWithResults.filter(tool => tool.toolName !== 'Task');
    
    // Build chronological raw assistant content from all assistant responses
    const rawAssistantContent = this.buildChronologicalContent(state.assistantResponses);
    
    pairs.push({
      userTime: new Date(state.userMessage.timestamp),
      assistantTime: new Date(assistantEntry.timestamp),
      responseTime,
      userContent: this.contentExtractor.extractUserContent(state.userMessage),
      assistantContent,
      thinkingCharCount: state.thinkingCharCount,
      thinkingContent: [...state.thinkingContent],
      toolUses: toolUsesWithResults,
      allToolUses: allToolUsesWithResults, // Include Task tools for display
      toolCount: toolUsesWithResults.length,
      toolResults: Array.from(state.toolResults.values()), // Add toolResults for tests
      userEntry: state.userMessage,
      assistantEntry: assistantEntry,
      rawAssistantContent: rawAssistantContent, // Add raw content for chronological display
      tokenUsage: { ...state.tokenUsage }, // Add token usage
      // Conversation tree fields
      userUuid: state.userMessage.uuid,
      userParentUuid: state.userMessage.parentUuid,
      assistantUuid: assistantEntry.uuid,
      assistantParentUuid: assistantEntry.parentUuid,
      isMeta: state.userMessage.isMeta || false,
      isSidechain: state.userMessage.isSidechain || false,
      // Legacy fields for compatibility
      userMessage: this.contentExtractor.extractUserContent(state.userMessage),
      assistantResponse: assistantContent,
      assistantResponsePreview: this.contentExtractor.sanitizeForDisplay(assistantContent, 200),
      timestamp: state.userMessage.timestamp,
      toolsUsed: toolUsesWithResults.map(t => t.toolName),
      subAgentCommands: state.subAgentCommands || []
    });
  }

  /**
   * Calculate response time between timestamps
   * @param {string} startTime - Start timestamp
   * @param {string} endTime - End timestamp
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
   * Build chronological content from all assistant responses
   * @param {Object[]} assistantResponses - Array of assistant response entries
   * @returns {Object[]} Array of chronological content items
   */
  buildChronologicalContent(assistantResponses) {
    const chronologicalItems = [];
    
    // Process each assistant response in order
    for (const response of assistantResponses) {
      if (!response.message || !response.message.content) continue;
      
      const content = Array.isArray(response.message.content) ? 
        response.message.content : [response.message.content];
      
      // Add each content item with timestamp for sorting
      for (const item of content) {
        chronologicalItems.push({
          ...item,
          timestamp: new Date(response.timestamp)
        });
      }
    }
    
    // Sort by timestamp to maintain chronological order
    chronologicalItems.sort((a, b) => a.timestamp - b.timestamp);
    
    // Keep timestamp property for display purposes in ViewRenderer
    return chronologicalItems;
  }
}

module.exports = ConversationBuilder;