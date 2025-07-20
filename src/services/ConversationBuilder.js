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
    this.pendingTaskExecution = false; // Track if we're expecting a sub-agent command
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
        // Reset extension state for new user messages unless it's a compact continuation
        if (!this.isCompactContinuation(entry) && currentState.isExtendingPreviousConversation) {
          currentState.isExtendingPreviousConversation = false;
          currentState.targetConversationIndex = -1;
        }
        this.processUserEntry(entry, currentState, pairs);
      } else if (entry.type === 'assistant') {
        if (currentState.userMessage || currentState.isExtendingPreviousConversation) {
          // Validate that assistant response belongs to the same session as user message
          if (currentState.userMessage && currentState.userMessage.sessionId !== entry.sessionId) {
            // Reset state to avoid orphaned user message
            Object.assign(currentState, this.createInitialState());
          }
          // Only process if we have a valid state
          if (currentState.userMessage || currentState.isExtendingPreviousConversation) {
            this.processAssistantEntry(entry, currentState, pairs);
          }
        }
      }
    }
    
    // Complete final conversation if exists
    this.completeFinalConversation(currentState, pairs);
    
    // Post-process: merge [Compact] continuations with their parent conversations
    const mergedPairs = this.mergeCompactContinuations(pairs);
    
    return mergedPairs;
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
      hasCompactContinuation: false,
      compactContinuationEntry: null, // Store the compact continuation entry
      isExtendingPreviousConversation: false, // Flag to indicate we're extending a previous conversation
      targetConversationIndex: -1, // Index of the conversation to extend
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
    // Skip tool result notifications first
    if (this.isToolResultNotification(entry)) {
      return;
    }
    
    // Check if we're expecting a sub-agent command after Task tool execution
    if (this.pendingTaskExecution) {
      // This user entry is the sub-agent command from Task tool
      // Need to have a current conversation to add sub-agent to
      if (currentState.userMessage) {
        this.addSubAgentCommand(entry, currentState);
      } else {
        // If no current conversation, start new one and mark as sub-agent
        this.startNewConversation(entry, currentState, pairs);
        this.addSubAgentCommand(entry, currentState);
      }
      // Reset the flag after processing the sub-agent command
      this.pendingTaskExecution = false;
      return;
    }
    
    // Check if this is a compact continuation instruction
    if (this.isCompactContinuation(entry)) {
      const content = this.contentExtractor.extractUserContent(entry);
      
      // Always create a new conversation for compact continuations
      // They will be merged in post-processing
      this.startNewConversation(entry, currentState, pairs);
      return;
    }
    
    // Check if this is a sub-agent command (legacy check for backward compatibility)
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
  processAssistantEntry(entry, currentState, pairs) {
    // Extract and accumulate data from assistant message first
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
   * Extend previous conversation with continued assistant response
   * @param {Object} entry - Assistant JSONL entry
   * @param {Object} previousConversation - Previous conversation to extend
   */
  extendPreviousConversation(entry, previousConversation) {
    // Update the previous conversation's end time
    previousConversation.assistantTime = new Date(entry.timestamp);
    
    // Recalculate response time from original user time to new end time
    previousConversation.responseTime = this.calculateResponseTime(
      previousConversation.userTime.toISOString(), 
      entry.timestamp
    );
    
    // Extract and add tool uses from this assistant entry
    const tools = this.extractToolUses(entry);
    previousConversation.toolUses.push(...tools.filter(tool => tool.toolName !== 'Task'));
    previousConversation.allToolUses.push(...tools);
    previousConversation.toolCount = previousConversation.toolUses.length;
    
    // Extract and add thinking content
    const thinkingData = this.extractThinkingContent(entry);
    previousConversation.thinkingCharCount += thinkingData.charCount;
    if (!previousConversation.thinkingContent) {
      previousConversation.thinkingContent = [];
    }
    previousConversation.thinkingContent.push(...thinkingData.content);
    
    // Extract and add token usage
    const tokenUsage = this.extractTokenUsage(entry);
    previousConversation.tokenUsage.inputTokens += tokenUsage.inputTokens;
    previousConversation.tokenUsage.outputTokens += tokenUsage.outputTokens;
    previousConversation.tokenUsage.totalTokens += tokenUsage.totalTokens;
    previousConversation.tokenUsage.cacheCreationInputTokens += tokenUsage.cacheCreationInputTokens;
    previousConversation.tokenUsage.cacheReadInputTokens += tokenUsage.cacheReadInputTokens;
    
    // Add to raw assistant content for chronological display
    if (!previousConversation.rawAssistantContent) {
      previousConversation.rawAssistantContent = [];
    }
    
    if (entry.message && entry.message.content) {
      const content = Array.isArray(entry.message.content) ? 
        entry.message.content : [entry.message.content];
      
      // For extending conversations, we just add items with their original timestamp
      // The proper distribution will be done later in buildChronologicalContent
      const baseTime = new Date(entry.timestamp);
      
      content.forEach((item) => {
        previousConversation.rawAssistantContent.push({
          ...item,
          timestamp: baseTime // Use original timestamp, distribution happens later
        });
      });
    }
    
    // Update assistant response content
    const assistantContent = this.contentExtractor.extractAssistantContent(entry);
    if (assistantContent) {
      // Append to existing content
      previousConversation.assistantContent = previousConversation.assistantContent ? 
        previousConversation.assistantContent + '\n\n' + assistantContent : assistantContent;
      previousConversation.assistantResponse = previousConversation.assistantContent;
      previousConversation.assistantResponsePreview = this.contentExtractor.sanitizeForDisplay(previousConversation.assistantContent, 200);
    }
  }

  /**
   * Add sub-agent command to current conversation
   * @param {Object} entry - User entry representing sub-agent command
   * @param {Object} currentState - Current conversation state
   */
  addSubAgentCommand(entry, currentState) {
    // Mark any previous sub-agent as complete when a new one starts
    if (currentState.subAgentCommands && currentState.subAgentCommands.length > 0) {
      const lastSubAgent = currentState.subAgentCommands[currentState.subAgentCommands.length - 1];
      if (!lastSubAgent.isComplete) {
        lastSubAgent.isComplete = true;
      }
    }
    
    if (!currentState.subAgentCommands) {
      currentState.subAgentCommands = [];
    }
    currentState.subAgentCommands.push({
      command: entry,
      response: null, // Will be filled when assistant responds
      responses: [], // Array to store all related assistant responses
      commandIndex: currentState.subAgentCommands.length,
      isComplete: false // Track if sub-agent execution is complete
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
    
    // Check if any of the tools is a Task tool execution
    const hasTaskTool = tools.some(tool => tool.toolName === 'Task');
    if (hasTaskTool) {
      // Set flag to indicate we're expecting sub-agent responses
      this.pendingTaskExecution = true;
    }
    
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
    // Always treat as sub-agent response if we have pending task execution or active sub-agent
    const isSubAgentResponse = this.pendingTaskExecution || this.isSubAgentResponse(entry, currentState);
    
    if (isSubAgentResponse && currentState.subAgentCommands && currentState.subAgentCommands.length > 0) {
      // Find the most recent sub-agent command that is not complete
      const activeSubAgent = currentState.subAgentCommands.find(cmd => !cmd.isComplete);
      
      if (activeSubAgent) {
        // Add this response to the responses array
        activeSubAgent.responses.push(entry);
        
        // Set the first response as the main response for backward compatibility
        if (!activeSubAgent.response) {
          activeSubAgent.response = entry;
        }
        
        // More sophisticated completion detection
        const content = entry.message?.content || [];
        const hasOnlyText = Array.isArray(content) && content.every(item => item.type === 'text');
        const hasToolUse = Array.isArray(content) && content.some(item => item.type === 'tool_use');
        
        // Check for specific completion patterns
        if (hasOnlyText) {
          const textContent = content.find(item => item.type === 'text')?.text || '';
          
          // Strong indicators of completion
          const strongCompletionIndicators = [
            'Task completed successfully',
            'I\'ve completed',
            'I have completed',
            'The task has been completed',
            'All requested',
            'has been successfully',
            '完了しました',
            'タスクを完了',
            '作業を完了'
          ];
          
          // Check if this looks like a final summary
          const isSummaryLike = textContent.includes('Summary') || 
                               textContent.includes('In summary') ||
                               textContent.includes('To summarize') ||
                               textContent.includes('概要') ||
                               textContent.includes('まとめ');
          
          if (strongCompletionIndicators.some(indicator => textContent.includes(indicator)) || 
              (isSummaryLike && activeSubAgent.responses.length >= 2)) {
            activeSubAgent.isComplete = true;
            this.pendingTaskExecution = false; // Reset the flag
          }
        }
        
        // Also check if we're starting a new Task (indicates previous one is complete)
        if (hasToolUse) {
          const hasNewTask = content.some(item => 
            item.type === 'tool_use' && item.name === 'Task'
          );
          if (hasNewTask && activeSubAgent.responses.length > 0) {
            activeSubAgent.isComplete = true;
            this.pendingTaskExecution = true; // New task starting
          }
        }
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
    
    // Check if there's at least one sub-agent command that is not complete
    const activeSubAgent = currentState.subAgentCommands.find(cmd => !cmd.isComplete);
    return !!activeSubAgent;
  }

  /**
   * Check if entry is a compact continuation instruction
   * Uses Claude Code's isCompactSummary field for reliable detection
   * @param {Object} entry - JSONL entry to check
   * @returns {boolean} True if entry is a compact continuation
   */
  isCompactContinuation(entry) {
    // Use Claude Code's isCompactSummary field for most reliable detection
    if (entry.isCompactSummary === true) {
      return true;
    }
    
    // Fallback to content analysis for backward compatibility
    if (!entry.message || !entry.message.content) return false;
    
    const content = this.contentExtractor.extractUserContent(entry);
    
    
    // Check for compact continuation patterns (English and Japanese)
    const continuationPatterns = [
      // English patterns
      /Please continue the conversation from where we left it off/i,
      /without asking the user any further questions/i,
      /Continue with the last task that you were asked to work on/i,
      /continue.*conversation.*from.*where.*left/i,
      /continue.*last.*task/i,
      
      // Japanese patterns - only pure continuation commands
      /つづけて/,        // continue
      /続けて/,         // continue (kanji)
      /継続/,           // continuation
      /続行/,           // continue/proceed
      /作業.*続/,       // continue work
      /続き.*作業/      // continue work
    ];
    
    // Check if content matches any continuation pattern
    let matchesPattern = false;
    for (let i = 0; i < continuationPatterns.length; i++) {
      const pattern = continuationPatterns[i];
      const matches = pattern.test(content);
      if (matches && content.includes('TODOを更新しながら')) {
        matchesPattern = true;
        break;
      } else if (matches) {
        matchesPattern = true;
        break;
      }
    }
    
    // Also check for the exact English pattern commonly used
    const exactPattern = content.includes("Please continue the conversation from where we left it off without asking the user any further questions. Continue with the last task that you were asked to work on.");
    
    // Check for simple Japanese continuation commands only
    const trimmedContent = content.trim();
    const simpleJapanesePatterns = ['つづけて', '続けて', '継続', '続行'];
    const isSimpleJapanese = simpleJapanesePatterns.includes(trimmedContent);
    
    return matchesPattern || exactPattern || isSimpleJapanese;
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
      subAgentCommands: state.subAgentCommands || [],
      hasCompactContinuation: state.hasCompactContinuation || false,
      compactContinuationEntry: state.compactContinuationEntry || null
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
      
      // Cap response time at 8 hours (28800 seconds)
      // This allows for long Claude Code sessions while preventing unreasonable gaps
      const MAX_REASONABLE_RESPONSE_TIME = 28800; // 8 hours
      
      if (seconds > MAX_REASONABLE_RESPONSE_TIME) {
        return MAX_REASONABLE_RESPONSE_TIME;
      }
      
      return seconds;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Merge [Compact] continuation conversations with their parent conversations
   * @param {Object[]} pairs - Array of conversation pairs
   * @returns {Object[]} Array of merged conversation pairs
   */
  mergeCompactContinuations(pairs) {
    const mergedPairs = [];
    
    for (let i = 0; i < pairs.length; i++) {
      const currentPair = pairs[i];
      const isCompactContinuation = currentPair.userMessage.includes('Please continue the conversation from where we left it off') ||
                                   currentPair.userMessage === 'つづけて' ||
                                   currentPair.userMessage === '続けて' ||
                                   (currentPair.userEntry && currentPair.userEntry.isCompactSummary === true);
      
      if (isCompactContinuation) {
        // Find the most recent non-compact conversation to merge into
        let targetPair = null;
        for (let j = mergedPairs.length - 1; j >= 0; j--) {
          // Look for a conversation that's not originally a compact continuation
          if (!mergedPairs[j].originallyCompact) {
            targetPair = mergedPairs[j];
            break;
          }
        }
        
        if (targetPair) {
          
          // Record compact continuation timing
          if (!targetPair.compactContinuations) {
            targetPair.compactContinuations = [];
          }
          targetPair.compactContinuations.push({
            timestamp: currentPair.userTime,
            endTime: currentPair.assistantTime,
            duration: currentPair.responseTime
          });
          
          // Update the end time and total duration
          targetPair.assistantTime = currentPair.assistantTime;
          targetPair.responseTime = this.calculateResponseTime(
            targetPair.userTime.toISOString(),
            currentPair.assistantTime.toISOString()
          );
          
          // Merge tool uses
          targetPair.toolUses.push(...currentPair.toolUses);
          targetPair.allToolUses.push(...currentPair.allToolUses);
          targetPair.toolCount = targetPair.toolUses.length;
          
          // Merge token usage
          if (currentPair.tokenUsage) {
            targetPair.tokenUsage.inputTokens += currentPair.tokenUsage.inputTokens;
            targetPair.tokenUsage.outputTokens += currentPair.tokenUsage.outputTokens;
            targetPair.tokenUsage.totalTokens += currentPair.tokenUsage.totalTokens;
            targetPair.tokenUsage.cacheCreationInputTokens += currentPair.tokenUsage.cacheCreationInputTokens;
            targetPair.tokenUsage.cacheReadInputTokens += currentPair.tokenUsage.cacheReadInputTokens;
          }
          
          // Merge thinking content
          if (currentPair.thinkingContent) {
            targetPair.thinkingContent.push(...currentPair.thinkingContent);
            targetPair.thinkingCharCount += currentPair.thinkingCharCount;
          }
          
          // Merge rawAssistantContent with compact continuation marker
          if (currentPair.rawAssistantContent && Array.isArray(currentPair.rawAssistantContent)) {
            if (!targetPair.rawAssistantContent) {
              targetPair.rawAssistantContent = [];
            }
            
            // Add compact continuation marker
            targetPair.rawAssistantContent.push({
              type: 'compact_continuation',
              timestamp: currentPair.userTime,
              content: `[Compact Continuation at ${currentPair.userTime.toISOString().slice(0, 19).replace('T', ' ')}]`
            });
            
            targetPair.rawAssistantContent.push(...currentPair.rawAssistantContent);
            
            // Re-distribute timestamps for the merged content
            this.redistributeTimestamps(targetPair.rawAssistantContent, 
              targetPair.userTime, 
              targetPair.assistantTime);
          }
          
          // Mark as having compact continuations
          targetPair.hasCompactContinuation = true;
          
          // Don't add compact continuation as separate conversation
        } else {
          // No target found, treat as regular conversation but mark as originally compact
          currentPair.originallyCompact = true;
          mergedPairs.push(currentPair);
        }
      } else {
        // Normal conversation
        mergedPairs.push(currentPair);
      }
    }
    
    
    return mergedPairs;
  }

  /**
   * Build chronological content from all assistant responses
   * @param {Object[]} assistantResponses - Array of assistant response entries
   * @returns {Object[]} Array of chronological content items
   */
  buildChronologicalContent(assistantResponses) {
    const chronologicalItems = [];
    
    // First, collect all content items with their original response timestamps
    const allItems = [];
    for (const response of assistantResponses) {
      if (!response.message || !response.message.content) continue;
      
      const content = Array.isArray(response.message.content) ? 
        response.message.content : [response.message.content];
      
      const baseTime = new Date(response.timestamp);
      
      content.forEach((item, index) => {
        allItems.push({
          item,
          originalTimestamp: baseTime,
          responseIndex: assistantResponses.indexOf(response),
          itemIndexInResponse: index
        });
      });
    }
    
    // Now distribute timestamps across all items, creating a realistic timeline
    // Distribute items across the conversation duration from first to last response
    if (allItems.length > 0) {
      const firstResponse = new Date(assistantResponses[0].timestamp);
      const lastResponse = new Date(assistantResponses[assistantResponses.length - 1].timestamp);
      const totalDurationMs = lastResponse.getTime() - firstResponse.getTime();
      
      allItems.forEach((itemWrapper, globalIndex) => {
        let estimatedTime;
        
        if (allItems.length === 1) {
          // Single item uses its original timestamp
          estimatedTime = itemWrapper.originalTimestamp;
        } else {
          // Multiple items: distribute across the timeline
          const progress = globalIndex / (allItems.length - 1); // 0 to 1
          const offsetMs = progress * totalDurationMs;
          estimatedTime = new Date(firstResponse.getTime() + offsetMs);
          
          // Add small random variation (±30 seconds) to avoid exact duplicates
          const randomVariation = (Math.random() - 0.5) * 60 * 1000; // ±30 seconds
          estimatedTime = new Date(estimatedTime.getTime() + randomVariation);
        }
        
        const chronoItem = {
          ...itemWrapper.item,
          timestamp: estimatedTime
        };
        
        
        chronologicalItems.push(chronoItem);
      });
    }
    
    // Sort by timestamp to maintain chronological order
    chronologicalItems.sort((a, b) => a.timestamp - b.timestamp);
    
    // Keep timestamp property for display purposes in ViewRenderer
    return chronologicalItems;
  }

  /**
   * Redistribute timestamps across chronological content items
   * @param {Object[]} contentItems - Array of content items to redistribute
   * @param {Date} startTime - Start time of the conversation
   * @param {Date} endTime - End time of the conversation
   */
  redistributeTimestamps(contentItems, startTime, endTime) {
    if (!contentItems || contentItems.length === 0) return;
    
    const totalDurationMs = endTime.getTime() - startTime.getTime();
    
    contentItems.forEach((item, index) => {
      if (contentItems.length === 1) {
        // Single item uses start time
        item.timestamp = startTime;
      } else {
        // Multiple items: distribute across the timeline
        const progress = index / (contentItems.length - 1); // 0 to 1
        const offsetMs = progress * totalDurationMs;
        const distributedTime = new Date(startTime.getTime() + offsetMs);
        
        // Add small random variation (±30 seconds) to avoid exact duplicates
        const randomVariation = (Math.random() - 0.5) * 60 * 1000; // ±30 seconds
        item.timestamp = new Date(distributedTime.getTime() + randomVariation);
      }
    });
    
    // Sort by timestamp to maintain chronological order
    contentItems.sort((a, b) => a.timestamp - b.timestamp);
  }
}

module.exports = ConversationBuilder;