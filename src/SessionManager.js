/**
 * SessionManager
 * Handles session data management, parsing, and caching
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

class SessionManager {
  constructor() {
    this.sessions = [];
    this.sessionCache = new Map();
    this.isLoading = false;
    
    // Performance tracking
    this.lastScanTime = null;
    this.scanDuration = 0;
    
    // Search and filter state
    this.searchQuery = '';
    this.activeFilters = {
      project: null,
      thinkingRate: null,
      responseTime: null,
      dateRange: null
    };
  }

  /**
   * Discover and analyze all sessions
   */
  async discoverSessions() {
    if (this.isLoading) return this.sessions;
    
    this.isLoading = true;
    const startTime = Date.now();
    
    try {
      console.log('🔍 Searching Claude Code transcripts...');
      
      // Discover transcript files
      const transcriptFiles = await this.discoverTranscriptFiles();
      console.log(`📁 ${transcriptFiles.length} files discovered`);
      
      // Parse sessions with progress
      console.log('📊 Analyzing sessions...');
      this.sessions = await this.parseSessionsWithProgress(transcriptFiles);
      
      // Sort sessions by last activity
      this.sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      
      this.scanDuration = Date.now() - startTime;
      this.lastScanTime = new Date();
      
      console.log(`✅ Analyzed ${this.sessions.length} sessions in ${this.scanDuration}ms`);
      
      return this.sessions;
      
    } catch (error) {
      console.error('❌ Error discovering sessions:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Discover transcript files from configured directories
   */
  async discoverTranscriptFiles() {
    const transcriptFiles = [];
    const directories = config.filesystem.transcriptDirectories;
    
    for (const dir of directories) {
      const expandedDir = dir.startsWith('~') ? 
        path.join(require('os').homedir(), dir.slice(1)) : 
        path.resolve(dir);
      
      try {
        console.log(`🔍 Searching: ${expandedDir}...`);
        const files = await this.scanDirectory(expandedDir);
        transcriptFiles.push(...files);
      } catch (error) {
        // Directory doesn't exist or not accessible, skip silently
        continue;
      }
    }
    
    return transcriptFiles;
  }

  /**
   * Scan directory for transcript files
   */
  async scanDirectory(directory, depth = 0, maxDepth = 5) {
    const files = [];
    
    // Prevent infinite recursion
    if (depth > maxDepth) {
      return files;
    }
    
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden directories and common ignored directories
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || 
            entry.name === 'venv' || entry.name === '__pycache__') {
          continue;
        }
        
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          const subFiles = await this.scanDirectory(fullPath, depth + 1, maxDepth);
          files.push(...subFiles);
        } else if (entry.name.endsWith(config.filesystem.transcriptExtension)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip inaccessible directories
    }
    
    return files;
  }

  /**
   * Parse sessions with progress updates
   */
  async parseSessionsWithProgress(transcriptFiles) {
    const sessions = [];
    
    for (let i = 0; i < transcriptFiles.length; i++) {
      const file = transcriptFiles[i];
      const progress = Math.round((i / transcriptFiles.length) * 100);
      
      process.stdout.write(`\r📊 Analyzing sessions... ${i + 1}/${transcriptFiles.length} (${progress}%)`);
      
      try {
        const session = await this.parseTranscriptFile(file);
        if (session) {
          sessions.push(session);
        }
      } catch (error) {
        console.error(`\n❌ Error parsing ${file}:`, error.message);
      }
    }
    
    console.log(); // New line after progress
    return sessions;
  }

  /**
   * Parse a single transcript file
   */
  async parseTranscriptFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return null;
      
      // Parse JSON lines
      const entries = [];
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
        } catch (error) {
          continue; // Skip malformed lines
        }
      }
      
      if (entries.length === 0) return null;
      
      // Extract session metadata
      const sessionId = this.extractSessionId(entries);
      const projectName = this.extractProjectName(entries, filePath);
      
      // Build conversation pairs
      const conversationPairs = this.buildConversationPairs(entries);
      
      if (conversationPairs.length === 0) return null;
      
      // Calculate metrics
      const metrics = this.calculateSessionMetrics(conversationPairs);
      
      // Generate session summary
      const summary = this.generateSessionSummary(conversationPairs);
      
      return {
        sessionId,
        fullSessionId: sessionId,
        projectName,
        filePath,
        conversationPairs,
        totalConversations: conversationPairs.length,
        summary,
        ...metrics
      };
      
    } catch (error) {
      throw new Error(`Failed to parse transcript: ${error.message}`);
    }
  }

  /**
   * Extract session ID from entries
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
   * Extract project name from entries or file path
   */
  extractProjectName(entries, filePath) {
    // Try to extract from entries
    for (const entry of entries) {
      if (entry.project_name) return entry.project_name;
      if (entry.project) return entry.project;
    }
    
    // Extract from file path - look for actual project names in path
    const parts = filePath.split(path.sep);
    
    // Debug: Check if filename itself contains the full path
    const filename = parts[parts.length - 1];
    const nameWithoutExt = filename.replace(config.filesystem.transcriptExtension, '');
    
    // If filename contains dashes and looks like a path, it's likely a mangled path
    if ((nameWithoutExt.includes('-') && (nameWithoutExt.startsWith('-Users-') || nameWithoutExt.startsWith('Users-')))) {
      // This is a path that got turned into a filename
      // Try to extract meaningful parts from the mangled path
      const pathParts = nameWithoutExt.split('-');
      
      // Look for known project names in the path parts
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        
        // Direct matches
        if (part === 'cclens') return 'cclens';
        if (part === 'sms' && pathParts.includes('proto')) return 'sms-proto';
        
        // Check after workspace directory
        if (part === 'workspace' && i + 1 < pathParts.length) {
          const nextPart = pathParts[i + 1];
          if (nextPart && !['Users', 'Documents', 'taguchiu'].includes(nextPart)) {
            return nextPart;
          }
        }
        
        // Check after Documents directory
        if (part === 'Documents' && i + 1 < pathParts.length) {
          const nextPart = pathParts[i + 1];
          if (nextPart && nextPart !== 'workspace' && !['Users', 'taguchiu'].includes(nextPart)) {
            return nextPart;
          }
        }
      }
      
      // If no project found in path, try to extract from content
      if (entries.length > 0) {
        const firstUserMessage = entries.find(e => e.type === 'user' && e.message && e.message.content);
        if (firstUserMessage && firstUserMessage.message.content) {
          const content = typeof firstUserMessage.message.content === 'string' ? 
            firstUserMessage.message.content : 
            JSON.stringify(firstUserMessage.message.content);
          
          // Extract project hints from content
          if (content.includes('cclens') || content.includes('CC Lens') || content.includes('interactive-conversation-browser')) return 'cclens';
          if (content.includes('sms-proto') || content.includes('SMS') || content.includes('sms/proto')) return 'sms-proto';
          if (content.includes('refactor')) return 'refactor-project';
          if (content.includes('ViewRenderer') || content.includes('ThemeManager') || content.includes('SessionManager')) return 'cclens';
        }
      }
      
      return 'unknown';
    }
    
    // Check if path contains .claude/projects/PROJECT_NAME/
    const projectsIndex = parts.indexOf('projects');
    if (projectsIndex !== -1 && projectsIndex + 1 < parts.length) {
      const projectName = parts[projectsIndex + 1];
      // Clean up project name if needed
      if (projectName && !projectName.includes('.jsonl')) {
        return projectName;
      }
    }
    
    // Check if file is in a cclens, sms-proto, etc. directory
    for (let i = parts.length - 2; i >= 0; i--) {
      const part = parts[i];
      // Skip generic directory names and user paths
      if (part && !['transcripts', 'logs', 'claude', 'config', 'Documents', 'workspace', 'Users', 'taguchiu', 'home'].includes(part)) {
        // Check if it looks like a project name
        if (part.match(/^[a-zA-Z0-9-_]+$/) && part.length > 2 && !part.match(/^[0-9]+$/)) {
          return part;
        }
      }
    }
    
    // If filename is just a hash/ID, use a better fallback
    if (nameWithoutExt.match(/^[a-f0-9-]+$/)) {
      // Look for conversation content to infer project
      if (entries.length > 0) {
        const firstUserMessage = entries.find(e => e.type === 'user' && e.message && e.message.content);
        if (firstUserMessage && firstUserMessage.message.content) {
          const content = typeof firstUserMessage.message.content === 'string' ? 
            firstUserMessage.message.content : 
            JSON.stringify(firstUserMessage.message.content);
          
          // Extract project hints from content
          if (content.includes('cclens') || content.includes('CC Lens') || content.includes('interactive-conversation-browser')) return 'cclens';
          if (content.includes('sms-proto') || content.includes('SMS') || content.includes('sms/proto')) return 'sms-proto';
          if (content.includes('refactor')) return 'refactor-project';
          if (content.includes('ViewRenderer') || content.includes('ThemeManager') || content.includes('SessionManager')) return 'cclens';
          if (content.includes('ultrathink')) return 'ultrathink-analysis';
        }
      }
      
      // If still no match, use the parent directory name if reasonable
      const parentDir = parts[parts.length - 2];
      if (parentDir && parentDir.length > 2 && !parentDir.match(/^[0-9]+$/) && !parentDir.includes('-')) {
        return parentDir;
      }
      
      return 'unknown-project';
    }
    
    // Check if nameWithoutExt looks like a path
    if (nameWithoutExt.includes('-') && nameWithoutExt.length > 30) {
      // This is likely a path fragment, try to extract from content
      if (entries.length > 0) {
        const firstUserMessage = entries.find(e => e.type === 'user' && e.message && e.message.content);
        if (firstUserMessage && firstUserMessage.message.content) {
          const content = typeof firstUserMessage.message.content === 'string' ? 
            firstUserMessage.message.content : 
            JSON.stringify(firstUserMessage.message.content);
          
          // Extract project hints from content
          if (content.includes('cclens') || content.includes('CC Lens') || content.includes('interactive-conversation-browser')) return 'cclens';
          if (content.includes('sms-proto') || content.includes('SMS') || content.includes('sms/proto')) return 'sms-proto';
          if (content.includes('refactor')) return 'refactor-project';
          if (content.includes('ViewRenderer') || content.includes('ThemeManager') || content.includes('SessionManager')) return 'cclens';
          if (content.includes('ultrathink')) return 'ultrathink-analysis';
        }
      }
      
      return 'unknown-project';
    }
    
    return nameWithoutExt;
  }

  /**
   * Build conversation pairs from entries
   */
  buildConversationPairs(entries) {
    const pairs = [];
    let currentState = {
      userMessage: null,
      toolUses: [],
      toolResults: new Map(), // Map toolId to result
      thinkingCharCount: 0,
      thinkingContent: [],
      assistantResponses: []
    };

    for (const entry of entries) {
      if (!entry.type || !entry.timestamp) continue;

      // Handle user entries
      if (entry.type === 'user') {
        // Skip tool result notifications
        if (this.isToolResultNotification(entry)) {
          continue;
        }
        
        // Complete previous conversation if exists
        if (currentState.userMessage && currentState.assistantResponses.length > 0) {
          const lastAssistant = currentState.assistantResponses[currentState.assistantResponses.length - 1];
          this.createConversationPair(pairs, currentState, lastAssistant);
        }
        
        // Start new conversation
        currentState = {
          userMessage: entry,
          toolUses: [],
          toolResults: new Map(),
          thinkingCharCount: 0,
          thinkingContent: [],
          assistantResponses: []
        };
      }
      // Handle assistant entries
      else if (entry.type === 'assistant' && currentState.userMessage) {
        // Extract tool uses from assistant message
        const tools = this.extractToolUses(entry);
        currentState.toolUses.push(...tools);
        
        // Extract tool results from assistant message
        const toolResults = this.extractToolResults(entry);
        toolResults.forEach(result => {
          currentState.toolResults.set(result.toolId, result);
        });
        
        // Extract thinking content
        const thinkingData = this.extractThinkingContent(entry);
        currentState.thinkingCharCount += thinkingData.charCount;
        currentState.thinkingContent.push(...thinkingData.content);
        
        // Add to assistant responses if it has actual content
        if (this.hasActualContent(entry) || tools.length > 0) {
          currentState.assistantResponses.push(entry);
        }
      }
    }
    
    // Complete final conversation if exists
    if (currentState.userMessage && currentState.assistantResponses.length > 0) {
      const lastAssistant = currentState.assistantResponses[currentState.assistantResponses.length - 1];
      this.createConversationPair(pairs, currentState, lastAssistant);
    }
    
    return pairs;
  }

  /**
   * Check if entry is a tool result notification
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
   */
  extractToolUses(entry) {
    const toolUses = [];
    if (!entry.message || !entry.message.content) return toolUses;
    
    const content = Array.isArray(entry.message.content) ? 
      entry.message.content : [entry.message.content];
    
    for (const item of content) {
      if (item.type === 'tool_use' && item.name) {
        toolUses.push({
          timestamp: new Date(entry.timestamp),
          toolName: item.name,
          toolId: item.id || 'unknown',
          input: item.input || {}
        });
      }
    }
    
    return toolUses;
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
        results.push({
          toolId: item.tool_use_id,
          result: item.content || '',
          isError: item.is_error || false
        });
      }
    }
    
    return results;
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
    const thinkingRate = assistantContent.length > 0 ? state.thinkingCharCount / assistantContent.length : 0;
    
    // Merge tool uses with their results
    const toolUsesWithResults = state.toolUses.map(tool => {
      const result = state.toolResults.get(tool.toolId);
      return {
        ...tool,
        result: result ? result.result : null,
        isError: result ? result.isError : false
      };
    });
    
    pairs.push({
      userTime: new Date(state.userMessage.timestamp),
      assistantTime: new Date(assistantEntry.timestamp),
      responseTime,
      userContent: this.extractUserContent(state.userMessage),
      assistantContent,
      thinkingCharCount: state.thinkingCharCount,
      thinkingContent: [...state.thinkingContent],
      thinkingRate,
      hasThinking: state.thinkingCharCount > 0,
      toolUses: toolUsesWithResults,
      toolCount: state.toolUses.length,
      userEntry: state.userMessage,
      assistantEntry: assistantEntry,
      // Legacy fields for compatibility
      userMessage: this.extractUserContent(state.userMessage),
      assistantResponse: assistantContent,
      assistantResponsePreview: this.sanitizeForDisplay(assistantContent, 200),
      timestamp: state.userMessage.timestamp,
      toolsUsed: state.toolUses.map(t => t.toolName)
    });
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
    
    // Return full content without sanitizing (keep line breaks)
    return text.trim();
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
    
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '...';
    }
    
    return sanitized;
  }

  /**
   * Calculate session metrics
   */
  calculateSessionMetrics(conversationPairs) {
    if (conversationPairs.length === 0) {
      return {
        duration: 0,
        avgResponseTime: 0,
        thinkingRate: 0,
        totalTools: 0,
        startTime: null,
        endTime: null,
        lastActivity: null
      };
    }
    
    const responseTimes = conversationPairs.map(pair => pair.responseTime);
    const thinkingCounts = conversationPairs.map(pair => pair.thinkingCharCount || 0);
    const responseLengths = conversationPairs.map(pair => pair.assistantContent.length);
    const totalTools = conversationPairs.reduce((sum, pair) => sum + pair.toolCount, 0);
    
    const startTime = conversationPairs[0].userTime;
    const endTime = conversationPairs[conversationPairs.length - 1].assistantTime;
    
    // Calculate total duration as sum of all response times (in milliseconds)
    const duration = responseTimes.reduce((sum, time) => sum + (time * 1000), 0);
    
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    // Calculate thinking rate (thinking chars / response chars)
    const totalThinking = thinkingCounts.reduce((sum, count) => sum + count, 0);
    const totalResponse = responseLengths.reduce((sum, len) => sum + len, 0);
    const thinkingRate = totalResponse > 0 ? totalThinking / totalResponse : 0;
    
    return {
      duration: Math.max(0, duration), // Total response time in milliseconds
      avgResponseTime,
      thinkingRate,
      totalTools,
      startTime,
      endTime,
      lastActivity: endTime
    };
  }

  /**
   * Calculate response time between timestamps
   */
  calculateResponseTime(startTime, endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);
      return Math.max(0, (end - start) / 1000); // Convert to seconds
    } catch (error) {
      return 0;
    }
  }

  /**
   * Generate hash for session ID
   */
  generateHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
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
        short: conversationPairs[0].userContent.substring(0, 50),
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
        { pattern: /ultrathink/i, label: 'Ultrathink' },
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
      shortSummary = summaryPairs[0].userContent.substring(0, 60) + '...';
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
    
    let filteredSessions = this.sessions;
    
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
   * Clear cache
   */
  clearCache() {
    this.sessionCache.clear();
  }

  /**
   * Get statistics
   */
  getStatistics() {
    if (this.sessions.length === 0) {
      return {
        totalSessions: 0,
        totalConversations: 0,
        totalDuration: 0,
        avgThinkingRate: 0
      };
    }
    
    const totalConversations = this.sessions.reduce((sum, session) => sum + session.totalConversations, 0);
    const totalDuration = this.sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const avgThinkingRate = this.sessions.reduce((sum, session) => sum + session.thinkingRate, 0) / this.sessions.length;
    
    return {
      totalSessions: this.sessions.length,
      totalConversations,
      totalDuration,
      avgThinkingRate,
      scanDuration: this.scanDuration,
      lastScanTime: this.lastScanTime
    };
  }

  /**
   * Get daily statistics
   */
  getDailyStatistics() {
    const dailyStats = new Map();
    
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
            thinkingTime: 0
          });
        }
        
        const dayStats = dailyStats.get(dateKey);
        dayStats.sessions.add(session.sessionId);
        dayStats.conversationCount++;
        // Use responseTime (in seconds) and convert to milliseconds for consistency
        const durationInSeconds = conversation.responseTime || conversation.duration || 0;
        const durationInMs = durationInSeconds * 1000;
        dayStats.totalDuration += durationInMs;
        dayStats.toolUsageCount += conversation.toolCount || 0;
        
        // Calculate thinking time from thinking rate
        if (conversation.thinkingRate && durationInMs) {
          dayStats.thinkingTime += (durationInMs * conversation.thinkingRate / 100);
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
          thinkingRates: []
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
      avgThinkingRate: stats.thinkingRates.length > 0 
        ? stats.thinkingRates.reduce((a, b) => a + b, 0) / stats.thinkingRates.length
        : 0,
      sessions: undefined, // Remove the Set from output
      thinkingRates: undefined // Remove array from output
    }));
    
    // Sort by conversation count descending
    return statsArray.sort((a, b) => b.conversationCount - a.conversationCount);
  }

  /**
   * Search conversations by query
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @param {boolean} options.thinkingOnly - Only search in thinking content
   * @param {number} options.minThinkingRate - Minimum thinking rate (0-1)
   * @returns {Array} Search results
   */
  searchConversations(query, options = {}) {
    const { thinkingOnly = false, minThinkingRate = null } = options;
    const results = [];
    const searchQuery = query.toLowerCase();
    
    // Search through all sessions
    for (const session of this.sessions) {
      const conversations = session.conversationPairs || [];
      
      for (let i = 0; i < conversations.length; i++) {
        const conversation = conversations[i];
        
        // Apply thinking rate filter if specified
        if (minThinkingRate !== null && conversation.thinkingRate < minThinkingRate) {
          continue;
        }
        
        let matchFound = false;
        let matchContext = '';
        let matchType = '';
        
        if (thinkingOnly) {
          // Search only in thinking content
          if (conversation.thinkingContent && Array.isArray(conversation.thinkingContent)) {
            for (const thinking of conversation.thinkingContent) {
              if (thinking.text && thinking.text.toLowerCase().includes(searchQuery)) {
                matchFound = true;
                matchType = 'thinking';
                // Extract context around the match
                const matchIndex = thinking.text.toLowerCase().indexOf(searchQuery);
                const contextStart = Math.max(0, matchIndex - 50);
                const contextEnd = Math.min(thinking.text.length, matchIndex + searchQuery.length + 50);
                matchContext = thinking.text.substring(contextStart, contextEnd);
                break;
              }
            }
          }
        } else {
          // Search in all content
          // Search in user content
          if (conversation.userContent && conversation.userContent.toLowerCase().includes(searchQuery)) {
            matchFound = true;
            matchType = 'user';
            const matchIndex = conversation.userContent.toLowerCase().indexOf(searchQuery);
            const contextStart = Math.max(0, matchIndex - 50);
            const contextEnd = Math.min(conversation.userContent.length, matchIndex + searchQuery.length + 50);
            matchContext = conversation.userContent.substring(contextStart, contextEnd);
          }
          
          // Search in assistant content
          if (!matchFound && conversation.assistantContent && conversation.assistantContent.toLowerCase().includes(searchQuery)) {
            matchFound = true;
            matchType = 'assistant';
            const matchIndex = conversation.assistantContent.toLowerCase().indexOf(searchQuery);
            const contextStart = Math.max(0, matchIndex - 50);
            const contextEnd = Math.min(conversation.assistantContent.length, matchIndex + searchQuery.length + 50);
            matchContext = conversation.assistantContent.substring(contextStart, contextEnd);
          }
          
          // Search in thinking content
          if (!matchFound && conversation.thinkingContent && Array.isArray(conversation.thinkingContent)) {
            for (const thinking of conversation.thinkingContent) {
              if (thinking.text && thinking.text.toLowerCase().includes(searchQuery)) {
                matchFound = true;
                matchType = 'thinking';
                const matchIndex = thinking.text.toLowerCase().indexOf(searchQuery);
                const contextStart = Math.max(0, matchIndex - 50);
                const contextEnd = Math.min(thinking.text.length, matchIndex + searchQuery.length + 50);
                matchContext = thinking.text.substring(contextStart, contextEnd);
                break;
              }
            }
          }
        }
        
        if (matchFound) {
          results.push({
            sessionId: session.sessionId,
            projectName: session.projectName,
            conversationIndex: i,
            conversation: conversation,
            matchType: matchType,
            matchContext: matchContext,
            userTime: conversation.userTime,
            responseTime: conversation.responseTime,
            thinkingRate: conversation.thinkingRate,
            toolCount: conversation.toolCount
          });
        }
      }
    }
    
    // Sort results by timestamp (newest first)
    return results.sort((a, b) => new Date(b.userTime) - new Date(a.userTime));
  }

}

module.exports = SessionManager;