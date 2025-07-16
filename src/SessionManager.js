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
      responseTime: null,
      dateRange: null
    };
  }

  /**
   * Discover and analyze all sessions (optimized)
   */
  async discoverSessions() {
    if (this.isLoading) return this.sessions;
    
    this.isLoading = true;
    const startTime = Date.now();
    
    try {
      process.stdout.write('🔍 Discovering files...');
      
      // Discover transcript files
      const transcriptFiles = await this.discoverTranscriptFiles();
      
      // Early return if no files found
      if (transcriptFiles.length === 0) {
        process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
        console.log('ℹ️ No transcript files found');
        this.sessions = [];
        return this.sessions;
      }
      
      // Update status
      process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
      process.stdout.write(`📊 Found ${transcriptFiles.length} files, analyzing...`);
      
      // Parse sessions with progress (now uses parallel processing)
      this.sessions = await this.parseSessionsWithProgress(transcriptFiles);
      
      // Sort sessions by last activity (optimize by checking if already sorted)
      if (this.sessions.length > 1) {
        const needsSorting = this.sessions.some((session, i) => 
          i > 0 && new Date(session.lastActivity) > new Date(this.sessions[i-1].lastActivity)
        );
        
        if (needsSorting) {
          this.sessions.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
        }
      }
      
      this.scanDuration = Date.now() - startTime;
      this.lastScanTime = new Date();
      
      // Clear the progress line
      const clearLine = '\r' + ' '.repeat(process.stdout.columns || 80) + '\r';
      process.stdout.write(clearLine);
      
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
        // Silently search directories
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
   * Scan directory for transcript files (optimized)
   */
  async scanDirectory(directory, depth = 0, maxDepth = 5) {
    const files = [];
    
    // Prevent infinite recursion
    if (depth > maxDepth) {
      return files;
    }
    
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      
      // Pre-filter entries to reduce iterations
      const transcriptFiles = [];
      const subdirectories = [];
      
      for (const entry of entries) {
        // Skip hidden directories and common ignored directories
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === 'venv' || 
            entry.name === '__pycache__' ||
            entry.name === 'dist' ||
            entry.name === 'build') {
          continue;
        }
        
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          subdirectories.push(fullPath);
        } else if (entry.name.endsWith(config.filesystem.transcriptExtension)) {
          transcriptFiles.push(fullPath);
        }
      }
      
      // Add transcript files first (immediate results)
      files.push(...transcriptFiles);
      
      // Early termination: if we found transcript files at depth 0-1, 
      // and no subdirectories suggest deeper structure, skip deep recursion
      if (depth <= 1 && transcriptFiles.length > 0 && subdirectories.length === 0) {
        return files;
      }
      
      // Process subdirectories in parallel for better performance
      if (subdirectories.length > 0) {
        // Use Promise.all but limit concurrency to avoid overwhelming the filesystem
        const MAX_CONCURRENT_DIRS = 5;
        
        for (let i = 0; i < subdirectories.length; i += MAX_CONCURRENT_DIRS) {
          const batch = subdirectories.slice(i, i + MAX_CONCURRENT_DIRS);
          const batchPromises = batch.map(subDir => 
            this.scanDirectory(subDir, depth + 1, maxDepth).catch(() => [])
          );
          
          const batchResults = await Promise.all(batchPromises);
          batchResults.forEach(subFiles => files.push(...subFiles));
        }
      }
      
    } catch (error) {
      // Skip inaccessible directories
    }
    
    return files;
  }

  /**
   * Parse sessions with progress updates (optimized with parallel processing)
   */
  async parseSessionsWithProgress(transcriptFiles) {
    if (transcriptFiles.length === 0) return [];
    
    // Process files in batches to avoid overwhelming the system
    const BATCH_SIZE = 10;
    const sessions = [];
    let processed = 0;
    
    process.stdout.write('📊 Analyzing sessions... ');
    
    // Process files in batches for better performance
    for (let i = 0; i < transcriptFiles.length; i += BATCH_SIZE) {
      const batch = transcriptFiles.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchPromises = batch.map(file => 
        this.parseTranscriptFile(file).catch(() => null) // Return null for errors
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Add successful results
      batchResults.forEach(session => {
        if (session) sessions.push(session);
      });
      
      processed += batch.length;
      const progress = Math.round((processed / transcriptFiles.length) * 100);
      
      // Update progress less frequently for better performance
      if (progress % 10 === 0 || processed === transcriptFiles.length) {
        const barWidth = 20;
        const filled = Math.round((progress / 100) * barWidth);
        const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
        const progressText = `📊 Analyzing sessions... [${bar}] ${progress}%`;
        
        // Clear line and write progress
        process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
        process.stdout.write(progressText);
      }
    }
    
    console.log(); // New line after progress
    return sessions;
  }

  /**
   * Parse a single transcript file (optimized)
   */
  async parseTranscriptFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) return null;
      
      // Parse JSON lines with improved error handling
      const entries = [];
      let firstEntry = null;
      
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          entries.push(entry);
          if (!firstEntry) firstEntry = entry; // Store first entry for metadata extraction
        } catch (error) {
          continue; // Skip malformed lines
        }
      }
      
      if (entries.length === 0) return null;
      
      // Extract session metadata (use cached first entry)
      const sessionId = this.extractSessionId(entries);
      const fullSessionId = this.extractFullSessionId(filePath);
      const projectName = this.extractProjectName(entries, filePath);
      
      // Extract project path efficiently using cached first entry
      const projectPath = this.extractProjectPathOptimized(filePath, projectName, firstEntry);
      
      // Build conversation pairs
      const conversationPairs = this.buildConversationPairs(entries);
      
      if (conversationPairs.length === 0) return null;
      
      // Calculate metrics
      const metrics = this.calculateSessionMetrics(conversationPairs);
      
      // Generate session summary
      const summary = this.generateSessionSummary(conversationPairs);
      
      return {
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
   * Extract full session ID from filename
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
        if (part === 'ccscope') return 'ccscope';
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
          if (content.includes('ccscope') || content.includes('CCScope') || content.includes('interactive-conversation-browser')) return 'ccscope';
          if (content.includes('sms-proto') || content.includes('SMS') || content.includes('sms/proto')) return 'sms-proto';
          if (content.includes('refactor')) return 'refactor-project';
          if (content.includes('ViewRenderer') || content.includes('ThemeManager') || content.includes('SessionManager')) return 'ccscope';
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
          if (content.includes('ccscope') || content.includes('CCScope') || content.includes('interactive-conversation-browser')) return 'ccscope';
          if (content.includes('sms-proto') || content.includes('SMS') || content.includes('sms/proto')) return 'sms-proto';
          if (content.includes('refactor')) return 'refactor-project';
          if (content.includes('ViewRenderer') || content.includes('ThemeManager') || content.includes('SessionManager')) return 'ccscope';
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
          if (content.includes('ccscope') || content.includes('CCScope') || content.includes('interactive-conversation-browser')) return 'ccscope';
          if (content.includes('sms-proto') || content.includes('SMS') || content.includes('sms/proto')) return 'sms-proto';
          if (content.includes('refactor')) return 'refactor-project';
          if (content.includes('ViewRenderer') || content.includes('ThemeManager') || content.includes('SessionManager')) return 'ccscope';
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
    
    // Merge tool uses with their results
    const toolUsesWithResults = state.toolUses.map(tool => {
      const result = state.toolResults.get(tool.toolId);
      return {
        ...tool,
        result: result ? result.result : null,
        isError: result ? result.isError : false
      };
    });
    
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
      toolCount: state.toolUses.length,
      userEntry: state.userMessage,
      assistantEntry: assistantEntry,
      rawAssistantContent: rawAssistantContent, // Add raw content for chronological display
      // Legacy fields for compatibility
      userMessage: this.extractUserContent(state.userMessage),
      assistantResponse: assistantContent,
      assistantResponsePreview: this.sanitizeForDisplay(assistantContent, 200),
      timestamp: state.userMessage.timestamp,
      toolsUsed: state.toolUses.map(t => t.toolName)
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
    const lines = text.split('\n');
    const userMessageLines = [];
    let foundThinkingMarker = false;
    
    for (const line of lines) {
      // Check if this line is a thinking content marker
      if (line.includes('🔧 TOOLS EXECUTION FLOW:') ||
          line.includes('🧠 THINKING PROCESS:') ||
          line.match(/^\s*\[Thinking \d+\]/) ||
          line.match(/^\s*\[\d+\]\s+\w+/) ||
          line.startsWith('File:') ||
          line.startsWith('Command:') ||
          line.startsWith('pattern:') ||
          line.startsWith('path:') ||
          (foundThinkingMarker && line.trim().startsWith('['))) {
        foundThinkingMarker = true;
        break;
      }
      
      userMessageLines.push(line);
    }
    
    const userMessage = userMessageLines.join('\n').trim();
    return userMessage || '[See full detail for complete context]';
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
        actualDuration: 0,
        avgResponseTime: 0,
        totalTools: 0,
        startTime: null,
        endTime: null,
        lastActivity: null
      };
    }
    
    const responseTimes = conversationPairs.map(pair => pair.responseTime);
    const totalTools = conversationPairs.reduce((sum, pair) => sum + pair.toolCount, 0);
    
    const startTime = conversationPairs[0].userTime;
    const endTime = conversationPairs[conversationPairs.length - 1].assistantTime;
    
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
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    const hexHash = Math.abs(hash).toString(16);
    // Pad with zeros to ensure at least 8 characters
    return hexHash.padStart(8, '0');
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
            toolUsageCount: 0
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
            return '[Continued session] ' + line.substring(0, 100) + (line.length > 100 ? '...' : '');
          }
        }
        // If no specific request found, return a generic message
        return '[Continued session with previous context]';
      }
      
      // Check if this contains thinking content
      if (this.containsThinkingContent(text)) {
        // Extract clean user message for context
        const cleanMessage = this.extractActualUserMessage(text);
        return cleanMessage.length > 100 ? 
          cleanMessage.substring(0, 100) + '...' : 
          cleanMessage || '[Contains tool execution - see full detail]';
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

}

module.exports = SessionManager;