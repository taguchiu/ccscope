/**
 * CacheManager
 * Handles persistent caching of parsed sessions to improve loading speed
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const zlib = require('zlib');
const CacheOptimizer = require('./CacheOptimizer');

class CacheManager {
  constructor() {
    // Cache directory in user's home directory
    this.cacheDir = path.join(os.homedir(), '.ccscope', 'cache');
    this.cacheFile = path.join(this.cacheDir, 'sessions.cache.gz');
    this.metadataFile = path.join(this.cacheDir, 'metadata.json');
    
    // In-memory cache
    this.memoryCache = new Map();
    
    // Cache version for invalidation when format changes
    this.CACHE_VERSION = '1.1.0'; // Bumped for compression support
    
    // Initialize cache directory
    this.initializeCacheDirectory();
  }

  /**
   * Initialize cache directory
   */
  initializeCacheDirectory() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
    } catch (error) {
      console.debug('Failed to create cache directory:', error.message);
    }
  }

  /**
   * Get file hash for cache validation
   */
  getFileHash(filePath) {
    try {
      const stats = fs.statSync(filePath);
      // Use file size and modification time for quick hash
      return `${stats.size}-${stats.mtime.getTime()}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Load cache metadata
   */
  loadMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const content = fs.readFileSync(this.metadataFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.debug('Failed to load cache metadata:', error.message);
    }
    
    return {
      version: this.CACHE_VERSION,
      files: {},
      lastUpdate: null
    };
  }

  /**
   * Save cache metadata
   */
  saveMetadata(metadata) {
    try {
      // Ensure directory exists
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata));
    } catch (error) {
      console.debug('Failed to save cache metadata:', error.message);
    }
  }

  /**
   * Check if cached session is valid
   */
  isCacheValid(filePath, metadata) {
    if (!metadata.files[filePath]) {
      return false;
    }
    
    const currentHash = this.getFileHash(filePath);
    const cachedHash = metadata.files[filePath].hash;
    
    return currentHash === cachedHash;
  }

  /**
   * Load cached sessions
   */
  loadCache() {
    try {
      if (!fs.existsSync(this.cacheFile)) {
        return null;
      }
      
      const metadata = this.loadMetadata();
      
      // Check cache version
      if (metadata.version !== this.CACHE_VERSION) {
        console.debug('Cache version mismatch, invalidating cache');
        this.clearCache();
        return null;
      }
      
      // Load cached sessions (with compression support)
      let content;
      if (this.cacheFile.endsWith('.gz')) {
        const compressed = fs.readFileSync(this.cacheFile);
        content = zlib.gunzipSync(compressed).toString('utf8');
      } else {
        content = fs.readFileSync(this.cacheFile, 'utf8');
      }
      const cache = JSON.parse(content);
      
      // Validate cache structure
      if (!cache.sessions || !Array.isArray(cache.sessions)) {
        console.debug('Invalid cache structure, missing sessions array');
        this.clearCache();
        return null;
      }
      
      // Convert arrays back to Date objects
      for (const session of cache.sessions) {
        session.startTime = new Date(session.startTime);
        session.lastActivity = new Date(session.lastActivity);
        
        for (const conversation of session.conversationPairs) {
          // Handle both new and legacy timestamp fields
          if (conversation.timestamp) {
            conversation.timestamp = new Date(conversation.timestamp);
          }
          if (conversation.userTime) {
            conversation.userTime = new Date(conversation.userTime);
          }
          if (conversation.assistantTime) {
            conversation.assistantTime = new Date(conversation.assistantTime);
          }
          // Convert thinking content timestamps
          if (conversation.thinkingContent && Array.isArray(conversation.thinkingContent)) {
            for (const thinking of conversation.thinkingContent) {
              if (thinking.timestamp) {
                thinking.timestamp = new Date(thinking.timestamp);
              }
            }
          }
          // Convert raw assistant content timestamps
          if (conversation.rawAssistantContent && Array.isArray(conversation.rawAssistantContent)) {
            for (const item of conversation.rawAssistantContent) {
              if (item.timestamp) {
                item.timestamp = new Date(item.timestamp);
              }
            }
          }
        }
      }
      
      // Restore optimized sessions
      const restoredSessions = cache.sessions.map(session => 
        CacheOptimizer.restoreSessionFromCache(session)
      );
      
      return {
        sessions: restoredSessions,
        metadata: metadata
      };
      
    } catch (error) {
      console.debug('Failed to load cache:', error.message);
      return null;
    }
  }

  /**
   * Save sessions to cache
   */
  saveCache(sessions, fileHashes) {
    try {
      const startTime = Date.now();
      
      const metadata = {
        version: this.CACHE_VERSION,
        files: fileHashes,
        lastUpdate: new Date().toISOString()
      };
      
      // Save metadata
      const metadataStart = Date.now();
      this.saveMetadata(metadata);
      const metadataTime = Date.now() - metadataStart;
      
      // Prepare cache object with optimized sessions
      const optimizedSessions = sessions.map(session => 
        CacheOptimizer.optimizeSessionForCache(session)
      );
      
      const cache = {
        sessions: optimizedSessions,
        timestamp: new Date().toISOString()
      };
      
      // Stringify the data
      const stringifyStart = Date.now();
      const cacheData = JSON.stringify(cache);
      const stringifyTime = Date.now() - stringifyStart;
      
      // Compress and write to file
      const compressStart = Date.now();
      const compressed = zlib.gzipSync(cacheData);
      const compressTime = Date.now() - compressStart;
      
      // Ensure directory exists before writing
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      
      const writeStart = Date.now();
      fs.writeFileSync(this.cacheFile, compressed);
      const writeTime = Date.now() - writeStart;
      
      const totalTime = Date.now() - startTime;
      
      // Log details if slow
      if (totalTime > 100) {
        console.log(`  Cache save details: stringify=${stringifyTime}ms, compress=${compressTime}ms, write=${writeTime}ms, metadata=${metadataTime}ms, original=${(cacheData.length / 1024 / 1024).toFixed(2)}MB, compressed=${(compressed.length / 1024 / 1024).toFixed(2)}MB`);
      }
      
      return true;
      
    } catch (error) {
      console.debug('Failed to save cache:', error.message);
      return false;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        fs.unlinkSync(this.cacheFile);
      }
      if (fs.existsSync(this.metadataFile)) {
        fs.unlinkSync(this.metadataFile);
      }
      this.memoryCache.clear();
    } catch (error) {
      console.debug('Failed to clear cache:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    try {
      const metadata = this.loadMetadata();
      const cacheStats = fs.existsSync(this.cacheFile) ? fs.statSync(this.cacheFile) : null;
      
      return {
        version: metadata.version,
        lastUpdate: metadata.lastUpdate,
        fileCount: Object.keys(metadata.files).length,
        cacheSize: cacheStats ? cacheStats.size : 0,
        memoryCacheSize: this.memoryCache.size
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if session needs update
   */
  needsUpdate(filePath, metadata) {
    return !this.isCacheValid(filePath, metadata);
  }

  /**
   * Get cached session from memory
   */
  getFromMemoryCache(filePath) {
    return this.memoryCache.get(filePath);
  }

  /**
   * Store session in memory cache
   */
  storeInMemoryCache(filePath, session) {
    // Limit memory cache size to prevent memory issues
    if (this.memoryCache.size > 1000) {
      // Remove oldest entries
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
    }
    
    this.memoryCache.set(filePath, session);
  }
}

module.exports = CacheManager;