/**
 * SessionManager
 * Handles session data management and parsing
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const os = require('os');
const config = require('./config');
const FastParser = require('./FastParser');
const textTruncator = require('./utils/textTruncator');
const FileDiscoveryService = require('./services/FileDiscoveryService');
const ProjectExtractor = require('./services/ProjectExtractor');
const ContentExtractor = require('./services/ContentExtractor');
const ConversationBuilder = require('./services/ConversationBuilder');
const SessionStatisticsCalculator = require('./services/SessionStatisticsCalculator');

class SessionManager {
  constructor() {
    this.sessions = [];
    this.isLoading = false;
    
    // Performance tracking
    this.lastScanTime = null;
    this.scanDuration = 0;
    
    // Search and filter state
    this.searchQuery = '';
    this.activeFilters = {
      project: null,
      responseTime: null,
      dateRange: null
    };
    
    // Initialize fast parser
    this.fastParser = new FastParser();
    
    // Initialize core services
    this.fileDiscoveryService = new FileDiscoveryService();
    this.projectExtractor = new ProjectExtractor();
    this.contentExtractor = new ContentExtractor();
    this.sessionCalculator = new SessionStatisticsCalculator();
    this.conversationBuilder = new ConversationBuilder(this.contentExtractor, this.fastParser);
  }

  /**
   * Discover and analyze all sessions
   */
  async discoverSessions(progressCallback) {
    if (this.isLoading) return this.sessions;
    
    this.isLoading = true;
    const startTime = Date.now();
    
    try {
      // Update progress
      if (progressCallback) progressCallback('Scanning for transcripts...');
      
      // Discover transcript files
      const transcriptFiles = await this.discoverTranscriptFiles();
      
      // Early return if no files found
      if (transcriptFiles.length === 0) {
        this.sessions = [];
        return this.sessions;
      }
      
      // Update progress
      if (progressCallback) progressCallback(`Parsing ${transcriptFiles.length} transcript files...`);
      
      // Parse all files with parallel processing
      const sessions = await this.parseSessionsWithProgress(transcriptFiles, false, progressCallback);
      
      // Sort sessions by last activity
      if (progressCallback) progressCallback(`Sorting ${sessions.length} sessions...`);
      sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      this.sessions = sessions;
      
      this.scanDuration = Date.now() - startTime;
      this.lastScanTime = new Date();
      
      return this.sessions;
      
    } catch (error) {
      console.error('❌ Error discovering sessions:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Proxy methods for backwards compatibility with tests
  async scanDirectory(directory, depth = 0, maxDepth = 5) {
    return this.fileDiscoveryService.scanDirectory(directory, depth, maxDepth);
  }

  async parseTranscriptFile(filePath) {
    return this.transcriptParser.parseTranscriptFile(filePath);
  }

  extractSessionId(entries) {
    return this.transcriptParser.extractSessionId(entries);
  }

  extractFullSessionId(filePath) {
    return this.transcriptParser.extractFullSessionId(filePath);
  }

  extractProjectName(entries, filePath) {
    return this.projectExtractor.extractProjectName(entries, filePath);
  }

  async discoverTranscriptFiles() {
    return this.fileDiscoveryService.discoverTranscriptFiles();
  }

  buildConversationPairs(entries) {
    return this.conversationBuilder.buildConversationPairs(entries);
  }

  calculateSessionMetrics(conversationPairs) {
    return this.sessionCalculator.calculateSessionMetrics(conversationPairs);
  }

  generateSessionSummary(conversationPairs) {
    return this.sessionCalculator.generateSessionSummary(conversationPairs);
  }

  extractToolUses(entry) {
    return this.conversationBuilder.extractToolUses(entry);
  }

  extractToolResults(entry) {
    return this.contentExtractor.extractToolResults(entry);
  }

  extractThinkingContent(entry) {
    return this.contentExtractor.extractThinkingContent(entry);
  }

  extractTokenUsage(entry) {
    return this.contentExtractor.extractTokenUsage(entry);
  }

  extractUserContent(entry) {
    return this.contentExtractor.extractUserContent(entry);
  }

  extractAssistantContent(entry) {
    return this.contentExtractor.extractAssistantContent(entry);
  }

  hasActualContent(entry) {
    return this.contentExtractor.hasActualContent(entry);
  }

  sanitizeForDisplay(text, maxLength) {
    return this.contentExtractor.sanitizeForDisplay(text, maxLength);
  }

  /**
   * Extract project path from file path and project name (optimized)
   */
  extractProjectPathOptimized(filePath, projectName, firstEntry) {
    // Use cached first entry if available
    if (firstEntry && firstEntry.cwd) {
      return firstEntry.cwd;
    }
    
    // Fallback to original logic without file I/O
    return this.extractProjectPathFallback(filePath, projectName);
  }

  /**
   * Extract project path from file path and project name (original method)
   */
  extractProjectPath(filePath, projectName) {
    try {
      // Read the first line of the JSONL file to get cwd
      const content = fs.readFileSync(filePath, 'utf8');
      const firstLine = content.split('\n')[0];
      
      if (firstLine) {
        const entry = JSON.parse(firstLine);
        if (entry.cwd) {
          // Return the cwd field directly - this is the most accurate
          return entry.cwd;
        }
      }
    } catch (error) {
      // If we can't read the file or parse JSON, fall back to other methods
      console.debug('Could not extract cwd from file:', error.message);
    }
    
    return this.extractProjectPathFallback(filePath, projectName);
  }

  /**
   * Fallback method for extracting project path without file I/O
   */
  extractProjectPathFallback(filePath, projectName) {
    // Special handling for .claude/projects/ pattern
    if (filePath.includes('/.claude/projects/')) {
      const filename = path.basename(filePath);
      const nameWithoutExt = filename.replace('.jsonl', '');
      
      // If filename starts with '-' or contains mangled path
      if (nameWithoutExt.startsWith('-') || nameWithoutExt.includes('-Users-')) {
        // Reconstruct the actual path from the mangled filename
        // -Users-taguchiu-Documents-workspace-ccscope -> /Users/taguchiu/Documents/workspace/ccscope
        const reconstructedPath = '/' + nameWithoutExt.replace(/^-/, '').replace(/-/g, '/');
        return reconstructedPath;
      }
    }
    
    // Look for the project path in the file path
    const parts = filePath.split(path.sep);
    
    // Try to find the project directory
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === projectName) {
        // Found project directory, return path up to and including it
        return parts.slice(0, i + 1).join(path.sep);
      }
    }
    
    // Try common patterns
    if (filePath.includes('/workspace/')) {
      const workspaceIndex = filePath.indexOf('/workspace/');
      const afterWorkspace = filePath.substring(workspaceIndex + '/workspace/'.length);
      const projectDir = afterWorkspace.split('/')[0];
      if (projectDir) {
        return filePath.substring(0, workspaceIndex + '/workspace/'.length + projectDir.length);
      }
    }
    
    if (filePath.includes('/Documents/')) {
      const docsIndex = filePath.indexOf('/Documents/');
      const afterDocs = filePath.substring(docsIndex + '/Documents/'.length);
      const projectDir = afterDocs.split('/')[0];
      if (projectDir && projectDir !== 'workspace') {
        return filePath.substring(0, docsIndex + '/Documents/'.length + projectDir.length);
      }
    }
    
    // Default to home directory if can't determine
    return process.env.HOME || '/';
  }





  /**
   * Extract tool uses from assistant message
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
   */
  extractToolResults(entry) {
    const results = [];
    if (!entry.message || !entry.message.content) return results;
    
    const content = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    for (const item of content) {
      if (item.type === 'tool_result' && item.tool_use_id) {
        // Try multiple ways to get the result content
        let resultContent = '';
        
        if (item.content) {
          // Handle both string and array content
          if (typeof item.content === 'string') {
            resultContent = item.content;
          } else if (Array.isArray(item.content)) {
            resultContent = item.content.map(c => c.text || c.content || JSON.stringify(c)).join('\n');
          } else if (item.content.text) {
            resultContent = item.content.text;
          } else {
            resultContent = JSON.stringify(item.content);
          }
        } else if (item.text) {
          resultContent = item.text;
        } else if (item.result) {
          resultContent = typeof item.result === 'string' ? item.result : JSON.stringify(item.result);
        }
        
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
   * Extract token usage from entry
   */
  extractTokenUsage(entry) {
    // Usage data can be in entry.usage or entry.message.usage
    const usage = entry.usage || (entry.message && entry.message.usage);
    
    if (!usage) {
      return {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0
      };
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
   * Extract thinking content from entry
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
   * Extract thinking character count from entry (legacy)
   */
  extractThinkingChars(entry) {
    const thinkingData = this.extractThinkingContent(entry);
    return thinkingData.charCount;
  }

  /**
   * Check if entry has actual content
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
   * Create conversation pair from current state
   */
  createConversationPair(pairs, state, assistantEntry) {
    const responseTime = this.calculateResponseTime(state.userMessage.timestamp, assistantEntry.timestamp);
    const assistantContent = this.extractAssistantContent(assistantEntry);
    
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
      userContent: this.extractUserContent(state.userMessage),
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
      userMessage: this.extractUserContent(state.userMessage),
      assistantResponse: assistantContent,
      assistantResponsePreview: this.sanitizeForDisplay(assistantContent, 200),
      timestamp: state.userMessage.timestamp,
      toolsUsed: toolUsesWithResults.map(t => t.toolName),
      subAgentCommands: state.subAgentCommands || []
    });
  }

  /**
   * Build chronological content from all assistant responses
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

  /**
   * Extract raw assistant content for chronological display (legacy)
   */
  extractRawAssistantContent(entry) {
    if (!entry.message || !entry.message.content) return [];
    
    const content = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    return content;
  }

  /**
   * Extract user content from entry
   */
  extractUserContent(entry) {
    if (!entry.message || !entry.message.content) return '(No content)';
    
    const content = entry.message.content;
    let text = '';
    
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      text = content.map(item => {
        if (typeof item === 'string') return item;
        if (item.type === 'text' && item.text) return item.text;
        return '';
      }).join('');
    } else if (typeof content === 'object') {
      text = JSON.stringify(content);
    }
    
    // Check if this is a continuation session with metadata
    if (text.includes('This session is being continued from a previous conversation')) {
      // Extract the actual user request from continuation metadata
      const lines = text.split('\n');
      let actualRequest = '';
      
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        
        // Look for patterns that indicate the actual user request
        if (line.match(/^(The user|User|ユーザー).*[:：]/i) || 
            line.match(/requested|asked|want|リクエスト|依頼|要求/i) ||
            line.match(/表示方法|見直し|修正|改善/i)) {
          // Found user request indicator, extract from here
          actualRequest = lines.slice(i).join('\n').trim();
          break;
        }
        
        // Also check for the last non-metadata content
        if (!line.startsWith('Analysis:') && 
            !line.startsWith('Summary:') && 
            !line.startsWith('-') &&
            !line.match(/^\d+\./) &&
            line.length > 0) {
          actualRequest = line;
        }
      }
      
      // If we found an actual request, use it; otherwise show continuation marker
      if (actualRequest) {
        return actualRequest;
      } else {
        return '[Continued session - see full detail for context]';
      }
    }
    
    // Check if this contains Claude Code thinking content or tool execution flow
    if (this.containsThinkingContent(text)) {
      return this.extractActualUserMessage(text);
    }
    
    // Return full content without sanitizing (keep line breaks)
    return text.trim();
  }

  /**
   * Check if text contains Claude Code thinking content markers
   */
  containsThinkingContent(text) {
    const thinkingMarkers = [
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
    
    return thinkingMarkers.some(marker => {
      if (typeof marker === 'string') {
        return text.includes(marker);
      } else {
        return marker.test(text);
      }
    });
  }

  /**
   * Extract actual user message from text containing thinking content
   */
  extractActualUserMessage(text) {
    if (!text) return '';
    
    // Split into sections by common delimiters
    const sections = text.split(/(?:\n\n|\r\n\r\n|👤\s*USER|🤖\s*ASSISTANT)/);
    
    for (const section of sections) {
      const cleanSection = section.trim();
      if (!cleanSection) continue;
      
      // Skip sections that are clearly tool execution details
      if (this.isToolExecutionSection(cleanSection)) {
        continue;
      }
      
      // Skip sections that are thinking content
      if (this.isThinkingSection(cleanSection)) {
        continue;
      }
      
      // Extract meaningful user message from this section
      const userMessage = this.extractMeaningfulContent(cleanSection);
      if (userMessage && userMessage.length > 10) { // Must be substantial
        return userMessage;
      }
    }
    
    // Fallback: try to extract any meaningful text from the entire content
    return this.extractMeaningfulContent(text) || this.extractFirstMeaningfulContent(text) || '';
  }
  
  isToolExecutionSection(text) {
    const toolMarkers = [
      '🔧 TOOLS EXECUTION FLOW:',
      '🧠 THINKING PROCESS:',
      '⏺ Thinking', '⏺ Edit', '⏺ Read', '⏺ Write', '⏺ Bash', 
      '⏺ Task', '⏺ TodoWrite', '⏺ Grep', '⏺ Glob', '⏺ MultiEdit',
      'File:', 'Command:', 'pattern:', 'path:', '⎿'
    ];
    
    return toolMarkers.some(marker => text.includes(marker)) ||
           /^\s*\[Thinking \d+\]/.test(text) ||
           /^\s*\[\d+\]\s+\w+/.test(text) ||
           /^\s*\d+│/.test(text);
  }
  
  isThinkingSection(text) {
    return text.includes('[Thinking') || 
           text.includes('THINKING PROCESS') ||
           text.includes('TOOLS EXECUTION FLOW');
  }
  
  extractMeaningfulContent(text) {
    const lines = text.split('\n');
    const meaningfulLines = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) continue;
      
      // Skip obvious tool execution markers
      if (this.isToolLine(trimmed)) continue;
      
      // Skip assistant response patterns
      if (this.isAssistantLine(trimmed)) continue;
      
      // Keep meaningful content
      if (trimmed.length > 3 && !this.isMetadataLine(trimmed)) {
        meaningfulLines.push(trimmed);
      }
    }
    
    return meaningfulLines.join(' ').replace(/\s+/g, ' ').trim();
  }
  
  isToolLine(line) {
    return /^\s*\[(?:\d+|\w+)\]/.test(line) ||
           line.includes('⏺') ||
           line.includes('⎿') ||
           /^(File|Command|pattern|path):\s/.test(line) ||
           /^\d+│/.test(line);
  }
  
  isAssistantLine(line) {
    const assistantPatterns = [
      /^(Looking at|I need to|Let me|I'll|I will|First,|Based on|Here's|Now)/,
      /^(The|This|That|It|We|You)/,
      /^(To|In order to|For|With|By)/
    ];
    
    return assistantPatterns.some(pattern => pattern.test(line));
  }
  
  isMetadataLine(line) {
    return /^\s*\d+\s*$/.test(line) ||
           /^-+$/.test(line) ||
           /^=+$/.test(line) ||
           /^\s*[\[\](){}]+\s*$/.test(line);
  }
  
  extractFirstMeaningfulContent(text) {
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.length > 10 && 
          !this.isToolLine(trimmed) && 
          !this.isMetadataLine(trimmed) &&
          !/^[🔧🧠⏺👤🤖]/.test(trimmed)) {
        return trimmed;
      }
    }
    
    return '';
  }

  /**
   * Extract assistant content from entry
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
   * Sanitize text for display
   */
  sanitizeForDisplay(text, maxLength) {
    if (!text) return '';
    
    let sanitized = text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[\x00-\x1F\x7F]/g, '')
      .trim();
    
    sanitized = textTruncator.smartTruncate(sanitized, maxLength);
    
    return sanitized;
  }

  /**
   * Calculate session metrics
   */
  calculateSessionMetrics(conversationPairs) {
    if (conversationPairs.length === 0) {
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
    
    const responseTimes = conversationPairs.map(pair => {
      // If responseTime is missing, calculate it from timestamps
      if (pair.responseTime !== undefined) {
        return pair.responseTime;
      }
      if (pair.userTime && pair.assistantTime) {
        return this.calculateResponseTime(pair.userTime, pair.assistantTime);
      }
      return 0;
    });
    const totalTools = conversationPairs.reduce((sum, pair) => sum + (pair.toolCount || 0), 0);
    
    // Calculate total token usage
    const tokenUsage = conversationPairs.reduce((acc, pair) => {
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
    
    // Handle different timestamp field names
    const startTime = conversationPairs[0].userTime || conversationPairs[0].timestamp;
    const endTime = conversationPairs[conversationPairs.length - 1].assistantTime || conversationPairs[conversationPairs.length - 1].timestamp;
    
    // Calculate total response time (sum of all response times in milliseconds)
    const totalResponseTime = responseTimes.reduce((sum, time) => sum + (time * 1000), 0);
    
    // Calculate actual session duration (from first message to last response)
    const actualDuration = startTime && endTime ? 
      new Date(endTime) - new Date(startTime) : 0;
    
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    return {
      duration: Math.max(0, totalResponseTime), // Total response time in milliseconds
      actualDuration: Math.max(0, actualDuration), // Actual session time in milliseconds
      avgResponseTime,
      totalTools,
      toolUsageCount: totalTools, // Add toolUsageCount field for sorting
      startTime,
      endTime,
      lastActivity: endTime,
      totalTokens: tokenUsage.totalTokens,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      cacheCreationInputTokens: tokenUsage.cacheCreationInputTokens,
      cacheReadInputTokens: tokenUsage.cacheReadInputTokens
    };
  }

  /**
   * Calculate response time between timestamps
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
        // Silently cap without logging
        return MAX_REASONABLE_RESPONSE_TIME;
      }
      
      return seconds;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate hash for session ID
   */
  generateHash(content) {
    // Use FastParser's optimized hash function
    const hash = this.fastParser.calculateHash(content);
    // Pad with zeros to ensure at least 8 characters
    return hash.padStart(8, '0');
  }

  /**
   * Generate session summary from conversations
   */
  generateSessionSummary(conversationPairs) {
    if (conversationPairs.length === 0) return { short: 'No conversations', detailed: [] };
    
    // Get first few meaningful conversations
    const summaryPairs = [];
    const maxSummaryConversations = 5;
    
    for (const pair of conversationPairs) {
      // Skip very short messages
      if (pair.userContent.length < 10) continue;
      
      summaryPairs.push(pair);
      if (summaryPairs.length >= maxSummaryConversations) break;
    }
    
    if (summaryPairs.length === 0) {
      return {
        short: textTruncator.smartTruncate(conversationPairs[0].userContent, 50),
        detailed: [conversationPairs[0].userContent]
      };
    }
    
    // Extract key topics/actions
    const topics = [];
    const seenTopics = new Set();
    const detailedMessages = [];
    
    for (const pair of summaryPairs) {
      const message = pair.userContent;
      detailedMessages.push(message);
      
      const messageLower = message.toLowerCase();
      
      // Extract file names
      const fileMatches = messageLower.match(/[\w-]+\.(js|ts|tsx|jsx|json|md|css|html|py|rs|go|java|cpp|c|h|hpp)/g);
      if (fileMatches) {
        fileMatches.forEach(file => {
          if (!seenTopics.has(file)) {
            topics.push(file);
            seenTopics.add(file);
          }
        });
      }
      
      // Extract key actions
      const actionPatterns = [
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
      
      for (const {pattern, label} of actionPatterns) {
        if (pattern.test(messageLower) && !seenTopics.has(label)) {
          topics.push(label);
          seenTopics.add(label);
        }
      }
    }
    
    // Build summary
    let shortSummary;
    if (topics.length > 0) {
      shortSummary = topics.slice(0, 5).join(' • ');
    } else {
      shortSummary = textTruncator.smartTruncate(summaryPairs[0].userContent, 60);
    }
    
    return {
      short: shortSummary,
      detailed: detailedMessages.slice(0, 3)
    };
  }

  /**
   * Search sessions by query
   */
  searchSessions(query) {
    if (!query.trim()) return this.sessions;
    
    this.searchQuery = query.toLowerCase();
    
    return this.sessions.filter(session => {
      // Search in project name
      if (session.projectName.toLowerCase().includes(this.searchQuery)) {
        return true;
      }
      
      // Search in session ID
      if (session.sessionId.toLowerCase().includes(this.searchQuery)) {
        return true;
      }
      
      // Search in conversation content
      return session.conversationPairs.some(pair => {
        return pair.userMessage.toLowerCase().includes(this.searchQuery) ||
               pair.assistantResponse.toLowerCase().includes(this.searchQuery);
      });
    });
  }

  /**
   * Filter sessions by criteria
   */
  filterSessions(filters) {
    this.activeFilters = { ...this.activeFilters, ...filters };
    
    let filteredSessions = this.sessions || [];
    
    // Filter by project
    if (this.activeFilters.project) {
      filteredSessions = filteredSessions.filter(session => 
        session.projectName === this.activeFilters.project
      );
    }
    
    // Filter by duration
    if (this.activeFilters.duration) {
      const threshold = this.activeFilters.duration;
      filteredSessions = filteredSessions.filter(session => 
        session.duration >= threshold
      );
    }
    
    return filteredSessions;
  }

  /**
   * Get unique project names
   */
  getProjects() {
    const projects = new Set();
    this.sessions.forEach(session => projects.add(session.projectName));
    return Array.from(projects).sort();
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return this.sessions.find(session => session.sessionId === sessionId);
  }



  /**
   * Get statistics
   */
  getStatistics() {
    if (this.sessions.length === 0) {
      return {
        totalSessions: 0,
        totalConversations: 0,
        totalDuration: 0
      };
    }
    
    const totalConversations = this.sessions.reduce((sum, session) => sum + session.totalConversations, 0);
    const totalDuration = this.sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    
    return {
      totalSessions: this.sessions.length,
      totalConversations,
      totalDuration,
      scanDuration: this.scanDuration,
      lastScanTime: this.lastScanTime
    };
  }

  /**
   * Get daily statistics
   */
  getDailyStatistics() {
    const dailyStats = new Map();
    const dailyTimeRanges = new Map(); // Track first and last conversation times per day
    
    // Aggregate conversations by date
    for (const session of this.sessions) {
      // Use conversationPairs which is the actual property name
      const conversations = session.conversationPairs || session.conversations || [];
      
      if (!Array.isArray(conversations)) {
        continue;
      }
      
      for (const conversation of conversations) {
        // Use userTime or startTime
        const timestamp = conversation.userTime || conversation.startTime || conversation.timestamp;
        
        // Skip conversations without valid timestamp
        if (!timestamp) continue;
        
        const date = new Date(timestamp);
        
        // Skip invalid dates
        if (isNaN(date.getTime())) continue;
        
        const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!dailyStats.has(dateKey)) {
          dailyStats.set(dateKey, {
            date: dateKey,
            sessions: new Set(),
            conversationCount: 0,
            totalDuration: 0,
            toolUsageCount: 0,
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0
          });
          dailyTimeRanges.set(dateKey, {
            firstTime: date,
            lastTime: date
          });
        }
        
        const dayStats = dailyStats.get(dateKey);
        dayStats.sessions.add(session.sessionId);
        dayStats.conversationCount++;
        // Use responseTime (in seconds) and convert to milliseconds for consistency
        const durationInSeconds = conversation.responseTime || 0;
        const durationInMs = durationInSeconds * 1000;
        dayStats.totalDuration += durationInMs;
        dayStats.toolUsageCount += conversation.toolCount || 0;
        
        // Add token usage
        if (conversation.tokenUsage) {
          dayStats.totalTokens += conversation.tokenUsage.totalTokens || 0;
          dayStats.inputTokens += conversation.tokenUsage.inputTokens || 0;
          dayStats.outputTokens += conversation.tokenUsage.outputTokens || 0;
        }
        
        // Update time range for the day
        const timeRange = dailyTimeRanges.get(dateKey);
        const convEndTime = conversation.assistantTime || conversation.endTime || timestamp;
        const endDate = new Date(convEndTime);
        
        if (date < timeRange.firstTime) {
          timeRange.firstTime = date;
        }
        if (endDate > timeRange.lastTime) {
          timeRange.lastTime = endDate;
        }
      }
    }
    
    // Calculate total unique sessions
    const allSessions = new Set();
    dailyStats.forEach(stats => {
      stats.sessions.forEach(sessionId => allSessions.add(sessionId));
    });
    
    // Convert to array and sort by date
    const statsArray = Array.from(dailyStats.values()).map(stats => ({
      ...stats,
      sessionCount: stats.sessions.size,
      sessions: undefined // Remove the Set from output
    }));
    
    // Add total sessions count to the result
    return {
      dailyStats: statsArray.sort((a, b) => a.date.localeCompare(b.date)),
      totalSessions: allSessions.size
    };
  }

  /**
   * Get project statistics
   */
  getProjectStatistics() {
    const projectStats = new Map();
    
    // Aggregate sessions by project
    for (const session of this.sessions) {
      const projectKey = session.projectName || 'Unknown';
      
      if (!projectStats.has(projectKey)) {
        projectStats.set(projectKey, {
          project: projectKey,
          sessions: new Set(),
          conversationCount: 0,
          totalDuration: 0,
          toolUsageCount: 0,
          thinkingTime: 0,
          thinkingRates: [],
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0
        });
      }
      
      const projectStat = projectStats.get(projectKey);
      projectStat.sessions.add(session.sessionId);
      projectStat.conversationCount += session.totalConversations || 0;
      projectStat.totalDuration += session.duration || 0;
      
      // Add thinking rate for average calculation
      if (session.thinkingRate !== undefined) {
        projectStat.thinkingRates.push(session.thinkingRate);
      }
      
      // Add session-level token usage
      projectStat.totalTokens += session.totalTokens || 0;
      projectStat.inputTokens += session.inputTokens || 0;
      projectStat.outputTokens += session.outputTokens || 0;
      
      // Calculate total tools and thinking time from conversations
      const conversations = session.conversationPairs || session.conversations || [];
      for (const conversation of conversations) {
        projectStat.toolUsageCount += conversation.toolCount || 0;
        
        const duration = conversation.responseTime || conversation.duration || 0;
        if (conversation.thinkingRate && duration) {
          projectStat.thinkingTime += (duration * 1000 * conversation.thinkingRate / 100);
        }
      }
    }
    
    // Convert to array and calculate averages
    const statsArray = Array.from(projectStats.values()).map(stats => ({
      ...stats,
      sessionCount: stats.sessions.size,
      sessions: undefined // Remove the Set from output
    }));
    
    // Sort by conversation count descending
    return statsArray.sort((a, b) => b.conversationCount - a.conversationCount);
  }

  /**
   * Search conversations by query
   * @param {string} query - Search query (supports OR operator and regex)
   * @param {Object} options - Search options
   * @param {boolean} options.regex - Use regular expression search
   * @returns {Array} Search results
   */
  searchConversations(query, options = {}) {
    const results = [];
    
    // Parse search terms - support OR operator
    let searchTerms = [];
    let searchRegex = null;
    
    if (options.regex) {
      // Regex mode
      try {
        searchRegex = new RegExp(query, 'i');
      } catch (error) {
        console.error('Invalid regex:', error.message);
        return [];
      }
    } else {
      // Normal mode - parse OR conditions (support both OR and or)
      const orPattern = /\s+(OR|or)\s+/;
      if (orPattern.test(query)) {
        searchTerms = query.split(orPattern)
          .filter((term, index) => index % 2 === 0) // Skip the "OR"/"or" matches
          .map(term => term.trim().toLowerCase());
      } else {
        searchTerms = [query.toLowerCase()];
      }
    }
    
    // Helper function to check if text matches
    const textMatches = (text) => {
      if (!text) return null;
      
      if (searchRegex) {
        const match = text.match(searchRegex);
        if (match) {
          return {
            found: true,
            index: match.index,
            length: match[0].length,
            matchedText: match[0]
          };
        }
      } else {
        // Check each OR term
        for (const term of searchTerms) {
          const lowerText = text.toLowerCase();
          const index = lowerText.indexOf(term);
          if (index !== -1) {
            return {
              found: true,
              index: index,
              length: term.length,
              matchedText: text.substring(index, index + term.length)
            };
          }
        }
      }
      return null;
    };
    
    // Helper function to extract context
    const extractContext = (text, matchInfo) => {
      // Check if this is continuation session metadata
      if (text.includes('This session is being continued from a previous conversation')) {
        // For continuation sessions, try to extract the actual user request
        const lines = text.split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = lines[i].trim();
          if (line.match(/^(The user|User|ユーザー).*[:：]/i) || 
              line.match(/requested|asked|want|リクエスト|依頼|要求/i) ||
              line.match(/表示方法|見直し|修正|改善/i)) {
            return '[Continued session] ' + textTruncator.smartTruncate(line, 100);
          }
        }
        // If no specific request found, return a generic message
        return '[Continued session with previous context]';
      }
      
      // Check if this contains thinking content
      if (this.containsThinkingContent(text)) {
        // Extract clean user message for context
        const cleanMessage = this.extractActualUserMessage(text);
        return textTruncator.smartTruncate(cleanMessage || text.replace(/\s+/g, ' ').trim(), 100);
      }
      
      // Normal context extraction
      const contextStart = Math.max(0, matchInfo.index - 50);
      const contextEnd = Math.min(text.length, matchInfo.index + matchInfo.length + 50);
      return text.substring(contextStart, contextEnd);
    };
    
    // Search through all sessions
    for (const session of this.sessions) {
      const conversations = session.conversationPairs || [];
      
      for (let i = 0; i < conversations.length; i++) {
        const conversation = conversations[i];
        
        let matchFound = false;
        let matchContext = '';
        let matchType = '';
        
        // Search in user content
        const userMatch = textMatches(conversation.userContent);
        if (userMatch) {
          matchFound = true;
          matchType = 'user';
          matchContext = extractContext(conversation.userContent, userMatch);
        }
        
        // Search in assistant content
        if (!matchFound) {
          const assistantMatch = textMatches(conversation.assistantContent);
          if (assistantMatch) {
            matchFound = true;
            matchType = 'assistant';
            matchContext = extractContext(conversation.assistantContent, assistantMatch);
          }
        }
        
        // Search in thinking content
        if (!matchFound && conversation.thinkingContent && Array.isArray(conversation.thinkingContent)) {
          for (const thinking of conversation.thinkingContent) {
            const thinkingMatch = textMatches(thinking.text);
            if (thinkingMatch) {
              matchFound = true;
              matchType = 'thinking';
              matchContext = extractContext(thinking.text, thinkingMatch);
              break;
            }
          }
        }
        
        if (matchFound) {
          results.push({
            sessionId: session.sessionId,
            projectName: session.projectName,
            conversationIndex: i,
            originalConversationNumber: i + 1, // Store the original conversation number
            conversation: conversation,
            matchType: matchType,
            matchContext: matchContext,
            userTime: conversation.userTime,
            responseTime: conversation.responseTime,
            toolCount: conversation.toolCount,
            searchQuery: query,
            searchOptions: options
          });
        }
      }
    }
    
    // Sort results by timestamp (newest first)
    return results.sort((a, b) => new Date(b.userTime) - new Date(a.userTime));
  }

  /**
   * Build conversation tree structure from conversation pairs
   */
  buildConversationTree(conversationPairs) {
    const tree = {
      nodes: new Map(), // uuid -> node data
      roots: [], // conversations with no parent
      children: new Map() // parentUuid -> [childUuids]
    };

    // First pass: create all nodes
    for (const conversation of conversationPairs) {
      // User message node
      if (conversation.userUuid) {
        tree.nodes.set(conversation.userUuid, {
          uuid: conversation.userUuid,
          parentUuid: conversation.userParentUuid,
          type: 'user',
          content: conversation.userContent,
          timestamp: conversation.userTime,
          isMeta: conversation.isMeta,
          isSidechain: conversation.isSidechain,
          conversation: conversation
        });
      }

      // Assistant message node
      if (conversation.assistantUuid) {
        tree.nodes.set(conversation.assistantUuid, {
          uuid: conversation.assistantUuid,
          parentUuid: conversation.assistantParentUuid,
          type: 'assistant',
          content: conversation.assistantContent,
          timestamp: conversation.assistantTime,
          isMeta: false,
          isSidechain: conversation.isSidechain,
          conversation: conversation
        });
      }
    }

    // Second pass: build parent-child relationships
    for (const [uuid, node] of tree.nodes) {
      if (node.parentUuid && tree.nodes.has(node.parentUuid)) {
        // Add to parent's children
        if (!tree.children.has(node.parentUuid)) {
          tree.children.set(node.parentUuid, []);
        }
        tree.children.get(node.parentUuid).push(uuid);
      } else {
        // No parent or parent not found - this is a root
        tree.roots.push(uuid);
      }
    }

    // Sort children by timestamp for consistent ordering
    for (const [parentUuid, childUuids] of tree.children) {
      childUuids.sort((a, b) => {
        const nodeA = tree.nodes.get(a);
        const nodeB = tree.nodes.get(b);
        return new Date(nodeA.timestamp) - new Date(nodeB.timestamp);
      });
    }

    // Sort roots by timestamp
    tree.roots.sort((a, b) => {
      const nodeA = tree.nodes.get(a);
      const nodeB = tree.nodes.get(b);
      return new Date(nodeA.timestamp) - new Date(nodeB.timestamp);
    });

    return tree;
  }

  /**
   * Get conversation path from root to specified node
   */
  getConversationPath(tree, targetUuid) {
    const path = [];
    let currentUuid = targetUuid;

    while (currentUuid && tree.nodes.has(currentUuid)) {
      const node = tree.nodes.get(currentUuid);
      path.unshift(node);
      currentUuid = node.parentUuid;
    }

    return path;
  }

  /**
   * Get all descendants of a node
   */
  getNodeDescendants(tree, nodeUuid) {
    const descendants = [];
    const queue = [nodeUuid];

    while (queue.length > 0) {
      const currentUuid = queue.shift();
      const children = tree.children.get(currentUuid) || [];
      
      for (const childUuid of children) {
        descendants.push(tree.nodes.get(childUuid));
        queue.push(childUuid);
      }
    }

    return descendants.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Parse multiple transcript files with progress updates and parallel processing
   * @param {string[]} transcriptFiles - Array of file paths to parse
   * @param {boolean} isIncremental - Whether this is an incremental update
   * @param {Function} progressCallback - Progress update callback
   * @returns {Promise<Object[]>} Array of parsed session objects
   */
  async parseSessionsWithProgress(transcriptFiles, isIncremental = false, progressCallback) {
    if (transcriptFiles.length === 0) return [];
    
    const sessions = [];
    const totalFiles = transcriptFiles.length;
    
    // Optimal worker count based on benchmarks
    const WORKER_COUNT = 2; // Benchmarks show 2 workers is optimal for I/O-bound tasks
    const workerPath = path.join(__dirname, 'ParserWorker.js');
    
    // Create worker pool
    const workers = [];
    for (let i = 0; i < WORKER_COUNT; i++) {
      workers.push(new Worker(workerPath));
    }
    
    let fileIndex = 0;
    let processedFiles = 0;
    
    // Process files using worker pool
    const processNextFile = (worker) => {
      if (fileIndex >= transcriptFiles.length) {
        return Promise.resolve();
      }
      
      const currentFile = transcriptFiles[fileIndex++];
      
      return new Promise((resolve) => {
        worker.once('message', (result) => {
          processedFiles++;
          
          if (progressCallback) {
            progressCallback(`Parsing files... (${processedFiles}/${totalFiles})`);
          }
          
          if (result.success && result.result) {
            sessions.push(result.result);
          }
          
          // Process next file with this worker
          processNextFile(worker).then(resolve);
        });
        
        worker.postMessage(currentFile);
      });
    };
    
    // Start processing with all workers
    await Promise.all(workers.map(worker => processNextFile(worker)));
    
    // Terminate all workers
    await Promise.all(workers.map(worker => worker.terminate()));
    
    return sessions;
  }

  /**
   * Parse a single transcript file using optimized parsing
   * @param {string} filePath - Path to the transcript file
   * @returns {Promise<Object|null>} Parsed session object or null if parsing fails
   */
  async parseTranscriptFile(filePath) {
    try {
      // Use FastParser for optimized parsing
      const { entries, firstEntry } = await this.fastParser.parseFile(filePath);
      
      if (entries.length === 0) return null;
      
      // Extract session metadata using project extractor
      const sessionId = this.extractSessionId(entries);
      const fullSessionId = this.extractFullSessionId(filePath);
      const projectName = this.projectExtractor.extractProjectName(entries, filePath);
      const projectPath = this.projectExtractor.extractProjectPathOptimized(filePath, projectName, firstEntry);
      
      // Build conversation pairs using conversation builder
      const conversationPairs = this.conversationBuilder.buildConversationPairs(entries);
      
      if (conversationPairs.length === 0) return null;
      
      // Calculate metrics and summary using session calculator
      const metrics = this.sessionCalculator.calculateSessionMetrics(conversationPairs);
      const summary = this.sessionCalculator.generateSessionSummary(conversationPairs);
      
      const session = {
        sessionId,
        fullSessionId: fullSessionId || sessionId,
        projectName,
        projectPath,
        filePath,
        conversationPairs,
        totalConversations: conversationPairs.length,
        summary,
        ...metrics
      };
      
      return session;
      
    } catch (error) {
      throw new Error(`Failed to parse transcript: ${error.message}`);
    }
  }

  /**
   * Extract session ID from entries
   * @param {Object[]} entries - Array of JSONL entries
   * @returns {string} Extracted session ID
   */
  extractSessionId(entries) {
    // Try to find session ID in various places
    for (const entry of entries) {
      if (entry.session_id) return entry.session_id;
      if (entry.conversation_id) return entry.conversation_id;
    }
    
    // Fallback to generating from content
    const content = JSON.stringify(entries.slice(0, 3));
    const hash = this.generateHash(content);
    return hash.substring(0, 8);
  }

  /**
   * Extract full session ID from filename
   * @param {string} filePath - Path to the transcript file
   * @returns {string|null} Full session ID or null if not found
   */
  extractFullSessionId(filePath) {
    const filename = path.basename(filePath);
    
    // Look for UUID pattern in filename (8-4-4-4-12 format)
    const uuidPattern = /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
    const match = filename.match(uuidPattern);
    
    if (match) {
      return match[1];
    }
    
    // Look for other long ID patterns (e.g., 32 character hex string)
    const hexPattern = /([a-f0-9]{32,})/i;
    const hexMatch = filename.match(hexPattern);
    
    if (hexMatch) {
      return hexMatch[1];
    }
    
    return null;
  }

  /**
   * Generate hash for session ID
   * @param {string} content - Content to hash
   * @returns {string} Generated hash
   */
  generateHash(content) {
    // Simple hash function for session ID generation
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to hex and pad with zeros
    return Math.abs(hash).toString(16).padStart(8, '0');
  }


}

module.exports = SessionManager;