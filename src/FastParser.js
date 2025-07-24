/**
 * FastParser
 * Optimized JSONL parsing for better performance
 */

const fs = require('fs');
const readline = require('readline');
const { Transform } = require('stream');

class FastParser {
  constructor() {
    // Pre-compile regex patterns for better performance
    this.patterns = {
      timestamp: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      toolUse: /"type":\s*"tool_use"/,
      thinking: /"type":\s*"thinking"/,
      userType: /"type":\s*"user"/,
      assistantType: /"type":\s*"assistant"/
    };
  }

  /**
   * Parse JSONL file using streaming for better performance
   */
  async parseFileStream(filePath) {
    return new Promise((resolve, reject) => {
      const entries = [];
      let firstEntry = null;
      let lineCount = 0;
      
      const fileStream = fs.createReadStream(filePath, { 
        encoding: 'utf8',
        highWaterMark: 64 * 1024 // 64KB chunks
      });
      
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity,
        // Disable history for better performance
        terminal: false,
        historySize: 0
      });
      
      rl.on('line', (line) => {
        lineCount++;
        line = line.trim();
        
        if (!line) return;
        
        try {
          // Quick pre-check to avoid parsing invalid JSON
          if (line[0] !== '{' || line[line.length - 1] !== '}') {
            return;
          }
          
          // Quick type check before full parse
          if (!line.includes('"type"')) return;
          
          const entry = JSON.parse(line);
          
          // Skip entries without type
          if (!entry.type) return;
          
          // Optimize memory for large entries
          if (entry.type === 'tool_result' && entry.content) {
            if (typeof entry.content === 'string' && entry.content.length > 10000) {
              entry.content = entry.content.substring(0, 10000) + '... [truncated]';
            }
          }
          
          entries.push(entry);
          
          if (!firstEntry) {
            firstEntry = entry;
          }
          
        } catch (error) {
          // Skip malformed lines silently
        }
      });
      
      rl.on('close', () => {
        resolve({ entries, firstEntry, lineCount });
      });
      
      rl.on('error', (error) => {
        reject(error);
      });
      
      fileStream.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse file with size check - use streaming for large files
   */
  async parseFile(filePath) {
    const stats = fs.statSync(filePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    
    // Use streaming for files larger than 5MB (reduced threshold)
    if (fileSizeMB > 5) {
      return this.parseFileStream(filePath);
    }
    
    // Use synchronous parsing for small files (faster for small files)
    return this.parseFileSync(filePath);
  }

  /**
   * Synchronous parsing for small files
   */
  parseFileSync(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const entries = [];
    let firstEntry = null;
    let lineCount = 0;
    
    for (const line of lines) {
      lineCount++;
      const trimmed = line.trim();
      
      if (!trimmed) continue;
      
      try {
        // Quick pre-check
        if (trimmed[0] !== '{' || trimmed[trimmed.length - 1] !== '}') {
          continue;
        }
        
        // Quick type check before full parse
        if (!trimmed.includes('"type"')) continue;
        
        const entry = JSON.parse(trimmed);
        
        // Skip entries without type
        if (!entry.type) continue;
        
        // Optimize memory for large entries
        if (entry.type === 'tool_result' && entry.content) {
          if (typeof entry.content === 'string' && entry.content.length > 10000) {
            entry.content = entry.content.substring(0, 10000) + '... [truncated]';
          }
        }
        
        entries.push(entry);
        
        if (!firstEntry) {
          firstEntry = entry;
        }
      } catch (error) {
        // Skip malformed lines
      }
    }
    
    return { entries, firstEntry, lineCount };
  }

  /**
   * Extract tool uses from message content (optimized)
   */
  extractToolUsesOptimized(content) {
    const tools = [];
    
    if (!content) return tools;
    
    // Handle array content
    if (Array.isArray(content)) {
      for (const item of content) {
        if (item && item.type === 'tool_use') {
          tools.push({
            name: item.name || 'unknown',
            id: item.id,
            input: item.input || {}
          });
        }
      }
      return tools;
    }
    
    // Quick string check for tool_use
    if (typeof content === 'string' && this.patterns.toolUse.test(content)) {
      // Extract tool uses from string content
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          return this.extractToolUsesOptimized(parsed);
        }
      } catch (error) {
        // Not JSON, skip
      }
    }
    
    return tools;
  }

  /**
   * Quick type detection without full parsing
   */
  getEntryType(entry) {
    if (!entry || !entry.type) return null;
    
    // Direct type check is fastest
    return entry.type;
  }

  /**
   * Extract timestamp efficiently
   */
  extractTimestamp(entry) {
    if (entry.timestamp) {
      // If it's already a Date object, return it
      if (entry.timestamp instanceof Date) {
        return entry.timestamp;
      }
      
      // Quick regex check for valid timestamp format
      if (typeof entry.timestamp === 'string' && 
          this.patterns.timestamp.test(entry.timestamp)) {
        return new Date(entry.timestamp);
      }
    }
    
    return new Date(); // Fallback to current time
  }

  /**
   * Calculate content hash for caching
   */
  calculateHash(content) {
    // Simple hash function for speed
    let hash = 0;
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
  }
}

module.exports = FastParser;