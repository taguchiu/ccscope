/**
 * TranscriptParser
 * Handles parsing of JSONL transcript files into session objects
 * Extracted from SessionManager following Single Responsibility Principle
 */

const fs = require('fs');

class TranscriptParser {
  constructor(fastParser, cacheManager, projectExtractor, conversationBuilder, sessionCalculator) {
    this.fastParser = fastParser;
    this.cacheManager = cacheManager;
    this.projectExtractor = projectExtractor;
    this.conversationBuilder = conversationBuilder;
    this.sessionCalculator = sessionCalculator;
    
    // Keep a reference to session cache for backward compatibility
    this.sessionCache = new Map();
  }

  /**
   * Parse multiple transcript files with progress updates and parallel processing
   * @param {string[]} transcriptFiles - Array of file paths to parse
   * @param {boolean} isIncremental - Whether this is an incremental update
   * @returns {Promise<Object[]>} Array of parsed session objects
   */
  async parseSessionsWithProgress(transcriptFiles, isIncremental = false) {
    if (transcriptFiles.length === 0) return [];
    
    const sessions = [];
    
    // Parse all files in parallel - Node.js can handle it
    const parsePromises = transcriptFiles.map(file => {
      // Check memory cache first
      const cached = this.cacheManager.getFromMemoryCache(file);
      if (cached) {
        return Promise.resolve(cached);
      }
      
      // Parse and store in memory cache
      return this.parseTranscriptFile(file)
        .then(session => {
          if (session) {
            this.cacheManager.storeInMemoryCache(file, session);
          }
          return session;
        })
        .catch(error => {
          // Silently skip files with errors
          return null;
        });
    });
    
    // Wait for all files to be parsed
    const results = await Promise.all(parsePromises);
    
    // Filter out null results (failed parses)
    results.forEach(session => {
      if (session) sessions.push(session);
    });
    
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
      
      // Cache the parsed session for fast future access
      await this.cacheSession(filePath, session);
      
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
    const path = require('path');
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

  /**
   * Cache a parsed session for fast future access
   * @param {string} filePath - Path to the transcript file
   * @param {Object} session - Parsed session object
   */
  async cacheSession(filePath, session) {
    try {
      const stats = await fs.promises.stat(filePath);
      this.sessionCache.set(filePath, {
        session,
        mtime: stats.mtime.getTime()
      });
    } catch (error) {
      // Ignore caching errors
    }
  }
}

module.exports = TranscriptParser;