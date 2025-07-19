/**
 * ProjectExtractor
 * Handles extraction of project names and paths from transcript files
 * Extracted from SessionManager following Single Responsibility Principle
 * Uses Extract Method pattern to break down complex logic
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

class ProjectExtractor {
  constructor() {
    // Known project patterns for content-based extraction
    this.projectPatterns = [
      { keywords: ['ccscope', 'CCScope', 'interactive-conversation-browser'], name: 'ccscope' },
      { keywords: ['sms-proto', 'SMS', 'sms/proto'], name: 'sms-proto' },
      { keywords: ['refactor'], name: 'refactor-project' },
      { keywords: ['ViewRenderer', 'ThemeManager', 'SessionManager'], name: 'ccscope' }
    ];
    
    // Directory patterns to skip during project extraction
    this.skipDirectories = [
      'transcripts', 'logs', 'claude', 'config', 'Documents', 
      'workspace', 'Users', 'taguchiu', 'home'
    ];
    
    // System directories to exclude from project names
    this.systemDirectories = ['Users', 'Documents', 'taguchiu'];
  }

  /**
   * Extract project name from entries or file path
   * Main entry point that coordinates different extraction strategies
   * @param {Object[]} entries - Array of JSONL entries
   * @param {string} filePath - Path to the transcript file
   * @returns {string} Extracted project name
   */
  extractProjectName(entries, filePath) {
    // Strategy 1: Extract from entry metadata
    const nameFromEntries = this.extractFromEntries(entries);
    if (nameFromEntries) return nameFromEntries;
    
    // Strategy 2: Extract from file path structure
    const nameFromPath = this.extractFromFilePath(filePath);
    if (nameFromPath) return nameFromPath;
    
    // Strategy 3: Extract from conversation content
    const nameFromContent = this.extractFromContent(entries);
    if (nameFromContent) return nameFromContent;
    
    // Fallback: Use filename or unknown
    return this.extractFallbackName(filePath);
  }

  /**
   * Extract project name from JSONL entry metadata
   * @param {Object[]} entries - Array of JSONL entries
   * @returns {string|null} Project name or null if not found
   */
  extractFromEntries(entries) {
    for (const entry of entries) {
      if (entry.project_name) return entry.project_name;
      if (entry.project) return entry.project;
      
      // Extract project name from cwd if available
      if (entry.cwd) {
        const cwdParts = entry.cwd.split(path.sep).filter(p => p.length > 0);
        if (cwdParts.length > 0) {
          return cwdParts[cwdParts.length - 1];
        }
      }
    }
    return null;
  }

  /**
   * Extract project name from file path structure
   * @param {string} filePath - Path to the transcript file
   * @returns {string|null} Project name or null if not found
   */
  extractFromFilePath(filePath) {
    const parts = filePath.split(path.sep);
    const filename = parts[parts.length - 1];
    const nameWithoutExt = filename.replace(config.filesystem.transcriptExtension, '');
    
    // Handle mangled path filenames
    if (this.isMangledPath(nameWithoutExt)) {
      return this.extractFromMangledPath(nameWithoutExt);
    }
    
    // Check for .claude/projects/ pattern
    const claudeProjectName = this.extractFromClaudeProjects(parts);
    if (claudeProjectName) return claudeProjectName;
    
    // Search directory names for project indicators
    return this.extractFromDirectoryNames(parts);
  }

  /**
   * Extract project name from conversation content
   * @param {Object[]} entries - Array of JSONL entries
   * @returns {string|null} Project name or null if not found
   */
  extractFromContent(entries) {
    if (entries.length === 0) return null;
    
    const firstUserMessage = entries.find(e => 
      e.type === 'user' && e.message && e.message.content
    );
    
    if (!firstUserMessage) return null;
    
    const content = this.extractMessageContent(firstUserMessage.message.content);
    return this.matchContentToProject(content);
  }

  /**
   * Extract fallback project name
   * @param {string} filePath - Path to the transcript file
   * @returns {string} Fallback project name
   */
  extractFallbackName(filePath) {
    const parts = filePath.split(path.sep);
    const filename = parts[parts.length - 1];
    const nameWithoutExt = filename.replace(config.filesystem.transcriptExtension, '');
    
    // If filename is just a hash/ID, try parent directory
    if (nameWithoutExt.match(/^[a-f0-9-]+$/)) {
      const parentDir = parts[parts.length - 2];
      if (this.isValidProjectName(parentDir)) {
        return parentDir;
      }
      return 'unknown-project';
    }
    
    // If nameWithoutExt looks like a long path, return unknown
    if (nameWithoutExt.includes('-') && nameWithoutExt.length > 30) {
      return 'unknown-project';
    }
    
    return nameWithoutExt || 'unknown';
  }

  /**
   * Check if filename represents a mangled path
   * @param {string} nameWithoutExt - Filename without extension
   * @returns {boolean} True if filename is a mangled path
   */
  isMangledPath(nameWithoutExt) {
    return nameWithoutExt.includes('-') && 
           (nameWithoutExt.startsWith('-Users-') || nameWithoutExt.startsWith('Users-'));
  }

  /**
   * Extract project name from mangled path filename
   * @param {string} nameWithoutExt - Mangled path filename
   * @returns {string|null} Project name or null if not found
   */
  extractFromMangledPath(nameWithoutExt) {
    const pathParts = nameWithoutExt.split('-');
    
    // Look for known project names in the path parts
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      // Direct matches
      if (part === 'ccscope') return 'ccscope';
      if (part === 'sms' && pathParts.includes('proto')) return 'sms-proto';
      
      // Check after workspace directory
      const workspaceProject = this.extractAfterDirectory(pathParts, i, 'workspace');
      if (workspaceProject) return workspaceProject;
      
      // Check after Documents directory
      const documentsProject = this.extractAfterDirectory(pathParts, i, 'Documents');
      if (documentsProject) return documentsProject;
    }
    
    return null;
  }

  /**
   * Extract project name after a specific directory in path parts
   * @param {string[]} pathParts - Split path parts
   * @param {number} index - Current index in path parts
   * @param {string} directory - Directory to look for
   * @returns {string|null} Project name or null if not found
   */
  extractAfterDirectory(pathParts, index, directory) {
    if (pathParts[index] === directory && index + 1 < pathParts.length) {
      const nextPart = pathParts[index + 1];
      if (nextPart && !this.systemDirectories.includes(nextPart)) {
        return nextPart;
      }
    }
    return null;
  }

  /**
   * Extract project name from .claude/projects/ pattern
   * @param {string[]} parts - Split file path parts
   * @returns {string|null} Project name or null if not found
   */
  extractFromClaudeProjects(parts) {
    const projectsIndex = parts.indexOf('projects');
    if (projectsIndex !== -1 && projectsIndex + 1 < parts.length) {
      const projectName = parts[projectsIndex + 1];
      if (projectName && !projectName.includes('.jsonl')) {
        return projectName;
      }
    }
    return null;
  }

  /**
   * Extract project name from directory names in path
   * @param {string[]} parts - Split file path parts
   * @returns {string|null} Project name or null if not found
   */
  extractFromDirectoryNames(parts) {
    // Check directories from end to beginning (excluding the file itself)
    for (let i = parts.length - 2; i >= 0; i--) {
      const part = parts[i];
      if (this.isValidProjectName(part)) {
        return part;
      }
    }
    return null;
  }

  /**
   * Check if a directory name is a valid project name
   * @param {string} name - Directory name to check
   * @returns {boolean} True if valid project name
   */
  isValidProjectName(name) {
    if (!name || this.skipDirectories.includes(name)) return false;
    
    // Check if it looks like a project name
    return name.match(/^[a-zA-Z0-9-_]+$/) && 
           name.length > 2 && 
           !name.match(/^[0-9]+$/);
  }

  /**
   * Extract content from message object
   * @param {string|Object|Array} messageContent - Message content in various formats
   * @returns {string} Extracted content as string
   */
  extractMessageContent(messageContent) {
    if (typeof messageContent === 'string') {
      return messageContent;
    }
    return JSON.stringify(messageContent);
  }

  /**
   * Match content to known project patterns
   * @param {string} content - Content to analyze
   * @returns {string|null} Project name or null if no match
   */
  matchContentToProject(content) {
    const lowerContent = content.toLowerCase();
    
    for (const pattern of this.projectPatterns) {
      for (const keyword of pattern.keywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
          return pattern.name;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract project path from file path and project name (optimized)
   * @param {string} filePath - Path to the transcript file
   * @param {string} projectName - Extracted project name
   * @param {Object} firstEntry - First JSONL entry (optional, for optimization)
   * @returns {string} Extracted project path
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
   * Extract project path from file path and project name (with file I/O)
   * @param {string} filePath - Path to the transcript file
   * @param {string} projectName - Extracted project name
   * @returns {string} Extracted project path
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
   * @param {string} filePath - Path to the transcript file
   * @param {string} projectName - Extracted project name
   * @returns {string} Extracted project path
   */
  extractProjectPathFallback(filePath, projectName) {
    // Special handling for .claude/projects/ pattern
    const claudePath = this.extractClaudeProjectPath(filePath);
    if (claudePath) return claudePath;
    
    // Look for the project path in the file path
    const projectPath = this.findProjectInPath(filePath, projectName);
    if (projectPath) return projectPath;
    
    // Try common patterns
    const commonPath = this.extractFromCommonPatterns(filePath);
    if (commonPath) return commonPath;
    
    // Default to home directory if can't determine
    return process.env.HOME || '/';
  }

  /**
   * Extract project path from .claude/projects/ pattern
   * @param {string} filePath - Path to the transcript file
   * @returns {string|null} Project path or null if not found
   */
  extractClaudeProjectPath(filePath) {
    if (!filePath.includes('/.claude/projects/')) return null;
    
    const filename = path.basename(filePath);
    const nameWithoutExt = filename.replace('.jsonl', '');
    
    // If filename starts with '-' or contains mangled path
    if (nameWithoutExt.startsWith('-') || nameWithoutExt.includes('-Users-')) {
      // Reconstruct the actual path from the mangled filename
      // -Users-taguchiu-Documents-workspace-ccscope -> /Users/taguchiu/Documents/workspace/ccscope
      const reconstructedPath = '/' + nameWithoutExt.replace(/^-/, '').replace(/-/g, '/');
      return reconstructedPath;
    }
    
    return null;
  }

  /**
   * Find project directory in file path
   * @param {string} filePath - Path to the transcript file
   * @param {string} projectName - Project name to find
   * @returns {string|null} Project path or null if not found
   */
  findProjectInPath(filePath, projectName) {
    const parts = filePath.split(path.sep);
    
    // Try to find the project directory
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === projectName) {
        // Found project directory, return path up to and including it
        return parts.slice(0, i + 1).join(path.sep);
      }
    }
    
    return null;
  }

  /**
   * Extract project path from common directory patterns
   * @param {string} filePath - Path to the transcript file
   * @returns {string|null} Project path or null if not found
   */
  extractFromCommonPatterns(filePath) {
    // Try workspace pattern
    const workspacePath = this.extractWorkspacePath(filePath);
    if (workspacePath) return workspacePath;
    
    // Try Documents pattern
    const documentsPath = this.extractDocumentsPath(filePath);
    if (documentsPath) return documentsPath;
    
    return null;
  }

  /**
   * Extract project path from workspace pattern
   * @param {string} filePath - Path to the transcript file
   * @returns {string|null} Project path or null if not found
   */
  extractWorkspacePath(filePath) {
    if (!filePath.includes('/workspace/')) return null;
    
    const workspaceIndex = filePath.indexOf('/workspace/');
    const afterWorkspace = filePath.substring(workspaceIndex + '/workspace/'.length);
    const projectDir = afterWorkspace.split('/')[0];
    
    if (projectDir) {
      return filePath.substring(0, workspaceIndex + '/workspace/'.length + projectDir.length);
    }
    
    return null;
  }

  /**
   * Extract project path from Documents pattern
   * @param {string} filePath - Path to the transcript file
   * @returns {string|null} Project path or null if not found
   */
  extractDocumentsPath(filePath) {
    if (!filePath.includes('/Documents/')) return null;
    
    const docsIndex = filePath.indexOf('/Documents/');
    const afterDocs = filePath.substring(docsIndex + '/Documents/'.length);
    const projectDir = afterDocs.split('/')[0];
    
    if (projectDir && projectDir !== 'workspace') {
      return filePath.substring(0, docsIndex + '/Documents/'.length + projectDir.length);
    }
    
    return null;
  }
}

module.exports = ProjectExtractor;