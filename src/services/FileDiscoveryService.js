/**
 * FileDiscoveryService
 * Handles discovery and scanning of transcript files
 * Extracted from SessionManager following Single Responsibility Principle
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

class FileDiscoveryService {
  constructor() {
    // No dependencies needed for file discovery
  }

  /**
   * Discover transcript files from configured directories
   * @returns {Promise<string[]>} Array of transcript file paths
   */
  async discoverTranscriptFiles() {
    const transcriptFiles = [];
    const directories = config.filesystem.transcriptDirectories;
    
    for (const dir of directories) {
      const expandedDir = dir.startsWith('~') ? 
        path.join(require('os').homedir(), dir.slice(1)) : 
        path.resolve(dir);
      
      try {
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
   * Scan directory for transcript files (optimized recursive scanning)
   * @param {string} directory - Directory to scan
   * @param {number} depth - Current recursion depth
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {Promise<string[]>} Array of transcript file paths
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
        if (this.shouldSkipEntry(entry.name)) {
          continue;
        }
        
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          subdirectories.push(fullPath);
        } else if (this.isTranscriptFile(entry.name)) {
          transcriptFiles.push(fullPath);
        }
      }
      
      // Add transcript files first (immediate results)
      files.push(...transcriptFiles);
      
      // Early termination optimization
      if (this.shouldSkipDeepRecursion(depth, transcriptFiles, subdirectories)) {
        return files;
      }
      
      // Process subdirectories in batches for better performance
      if (subdirectories.length > 0) {
        const batchResults = await this.processSubdirectoriesBatched(
          subdirectories, depth, maxDepth
        );
        batchResults.forEach(subFiles => files.push(...subFiles));
      }
      
    } catch (error) {
      // Skip inaccessible directories
    }
    
    return files;
  }

  /**
   * Check if entry should be skipped during directory scanning
   * @param {string} entryName - Name of directory entry
   * @returns {boolean} True if entry should be skipped
   */
  shouldSkipEntry(entryName) {
    const skipPatterns = [
      'node_modules',
      'venv', 
      '__pycache__',
      'dist',
      'build'
    ];
    
    return entryName.startsWith('.') || skipPatterns.includes(entryName);
  }

  /**
   * Check if file is a transcript file based on extension
   * @param {string} fileName - Name of the file
   * @returns {boolean} True if file is a transcript file
   */
  isTranscriptFile(fileName) {
    return fileName.endsWith(config.filesystem.transcriptExtension);
  }

  /**
   * Determine if deep recursion should be skipped for optimization
   * @param {number} depth - Current depth
   * @param {string[]} transcriptFiles - Transcript files found at current level
   * @param {string[]} subdirectories - Subdirectories found at current level
   * @returns {boolean} True if deep recursion should be skipped
   */
  shouldSkipDeepRecursion(depth, transcriptFiles, subdirectories) {
    // Never skip deep recursion - we need to find all files
    return false;
  }

  /**
   * Process subdirectories in batches to avoid overwhelming the filesystem
   * @param {string[]} subdirectories - Array of subdirectory paths
   * @param {number} depth - Current recursion depth
   * @param {number} maxDepth - Maximum recursion depth
   * @returns {Promise<string[][]>} Array of file arrays from each batch
   */
  async processSubdirectoriesBatched(subdirectories, depth, maxDepth) {
    const MAX_CONCURRENT_DIRS = 5;
    const batchResults = [];
    
    for (let i = 0; i < subdirectories.length; i += MAX_CONCURRENT_DIRS) {
      const batch = subdirectories.slice(i, i + MAX_CONCURRENT_DIRS);
      const batchPromises = batch.map(subDir => 
        this.scanDirectory(subDir, depth + 1, maxDepth).catch(() => [])
      );
      
      const batchResult = await Promise.all(batchPromises);
      batchResults.push(...batchResult);
    }
    
    return batchResults;
  }
}

module.exports = FileDiscoveryService;