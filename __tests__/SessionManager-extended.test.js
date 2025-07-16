const SessionManager = require('../src/SessionManager');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock fs module
jest.mock('fs');

describe('SessionManager Extended Tests', () => {
  let sessionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionManager = new SessionManager();
    
    // Reset fs mocks
    fs.existsSync.mockReset();
    fs.readdirSync.mockReset();
    fs.readFileSync.mockReset();
    fs.statSync.mockReset();
  });

  describe('extractProjectPath', () => {
    test('extracts project path from cwd field', () => {
      const entries = [
        { type: 'user', cwd: '/Users/test/project1' },
        { type: 'assistant', cwd: '/Users/test/project1' }
      ];
      
      const projectPath = sessionManager.extractProjectPath(entries);
      expect(projectPath).toBe('/Users/test/project1');
    });

    test('returns null when no cwd field', () => {
      const entries = [
        { type: 'user' },
        { type: 'assistant' }
      ];
      
      const projectPath = sessionManager.extractProjectPath(entries);
      expect(projectPath).toBe(null);
    });

    test('uses most common cwd when multiple present', () => {
      const entries = [
        { type: 'user', cwd: '/Users/test/project1' },
        { type: 'assistant', cwd: '/Users/test/project1' },
        { type: 'user', cwd: '/Users/test/project2' },
        { type: 'assistant', cwd: '/Users/test/project1' }
      ];
      
      const projectPath = sessionManager.extractProjectPath(entries);
      expect(projectPath).toBe('/Users/test/project1');
    });
  });

  describe('extractProjectName', () => {
    test('extracts project name from path', () => {
      const name = sessionManager.extractProjectName('/Users/test/my-project');
      expect(name).toBe('my-project');
    });

    test('returns Unknown for empty path', () => {
      const name = sessionManager.extractProjectName('');
      expect(name).toBe('Unknown');
    });

    test('returns Unknown for null path', () => {
      const name = sessionManager.extractProjectName(null);
      expect(name).toBe('Unknown');
    });

    test('handles root path', () => {
      const name = sessionManager.extractProjectName('/');
      expect(name).toBe('Unknown');
    });
  });

  describe('extractThinkingContent', () => {
    test('extracts thinking content from entry', () => {
      const entry = {
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          content: [
            { type: 'thinking', text: 'Let me think about this...' },
            { type: 'text', text: 'Here is my response' }
          ]
        }
      };
      
      const thinkingContent = sessionManager.extractThinkingContent(entry);
      expect(thinkingContent).toHaveLength(1);
      expect(thinkingContent[0].text).toBe('Let me think about this...');
      expect(thinkingContent[0].timestamp).toBeInstanceOf(Date);
    });

    test('handles entry without thinking content', () => {
      const entry = {
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          content: [
            { type: 'text', text: 'Just a response' }
          ]
        }
      };
      
      const thinkingContent = sessionManager.extractThinkingContent(entry);
      expect(thinkingContent).toHaveLength(0);
    });

    test('handles string content', () => {
      const entry = {
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          content: 'Simple string content'
        }
      };
      
      const thinkingContent = sessionManager.extractThinkingContent(entry);
      expect(thinkingContent).toHaveLength(0);
    });

    test('handles thinking item type', () => {
      const entry = {
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          content: [
            { thinking: 'Alternative thinking format' }
          ]
        }
      };
      
      const thinkingContent = sessionManager.extractThinkingContent(entry);
      expect(thinkingContent).toHaveLength(1);
      expect(thinkingContent[0].text).toBe('Alternative thinking format');
    });

    test('handles missing timestamp', () => {
      const entry = {
        message: {
          content: [
            { type: 'thinking', text: 'Thinking without timestamp' }
          ]
        }
      };
      
      const thinkingContent = sessionManager.extractThinkingContent(entry);
      expect(thinkingContent).toHaveLength(1);
      expect(thinkingContent[0].timestamp).toBeInstanceOf(Date);
    });
  });

  describe('calculateThinkingMetrics', () => {
    test('calculates thinking metrics correctly', () => {
      const conversationPairs = [
        {
          responseTime: 10000,
          thinkingDuration: 3000
        },
        {
          responseTime: 20000,
          thinkingDuration: 5000
        }
      ];
      
      const metrics = sessionManager.calculateThinkingMetrics(conversationPairs);
      expect(metrics.totalThinkingTime).toBe(8000);
      expect(metrics.avgThinkingRatio).toBeCloseTo(0.2667, 4);
    });

    test('handles zero response time', () => {
      const conversationPairs = [
        {
          responseTime: 0,
          thinkingDuration: 1000
        }
      ];
      
      const metrics = sessionManager.calculateThinkingMetrics(conversationPairs);
      expect(metrics.totalThinkingTime).toBe(1000);
      expect(metrics.avgThinkingRatio).toBe(0);
    });

    test('handles empty conversation pairs', () => {
      const metrics = sessionManager.calculateThinkingMetrics([]);
      expect(metrics.totalThinkingTime).toBe(0);
      expect(metrics.avgThinkingRatio).toBe(0);
    });
  });

  describe('filterConversationsByQuery', () => {
    test('filters conversations by simple query', () => {
      const conversations = [
        { userMessage: 'How to handle errors?', assistantMessage: 'Use try-catch blocks' },
        { userMessage: 'What is async?', assistantMessage: 'Async is for asynchronous operations' }
      ];
      
      const filtered = sessionManager.filterConversationsByQuery(conversations, 'error');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].userMessage).toContain('error');
    });

    test('filters with case insensitive search', () => {
      const conversations = [
        { userMessage: 'ERROR handling', assistantMessage: 'Handle errors properly' }
      ];
      
      const filtered = sessionManager.filterConversationsByQuery(conversations, 'error');
      expect(filtered).toHaveLength(1);
    });

    test('searches in both user and assistant messages', () => {
      const conversations = [
        { userMessage: 'Question', assistantMessage: 'Answer with keyword' },
        { userMessage: 'Another question with keyword', assistantMessage: 'Response' }
      ];
      
      const filtered = sessionManager.filterConversationsByQuery(conversations, 'keyword');
      expect(filtered).toHaveLength(2);
    });

    test('handles empty query', () => {
      const conversations = [
        { userMessage: 'Test', assistantMessage: 'Response' }
      ];
      
      const filtered = sessionManager.filterConversationsByQuery(conversations, '');
      expect(filtered).toHaveLength(1);
    });
  });

  describe('isValidTranscriptEntry', () => {
    test('validates correct entry', () => {
      const entry = {
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z',
        message: { content: 'Test message' }
      };
      
      expect(sessionManager.isValidTranscriptEntry(entry)).toBe(true);
    });

    test('rejects entry without type', () => {
      const entry = {
        timestamp: '2024-01-01T10:00:00Z',
        message: { content: 'Test message' }
      };
      
      expect(sessionManager.isValidTranscriptEntry(entry)).toBe(false);
    });

    test('rejects entry without message', () => {
      const entry = {
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z'
      };
      
      expect(sessionManager.isValidTranscriptEntry(entry)).toBe(false);
    });

    test('accepts entry without timestamp', () => {
      const entry = {
        type: 'user',
        message: { content: 'Test message' }
      };
      
      expect(sessionManager.isValidTranscriptEntry(entry)).toBe(true);
    });
  });

  describe('getUniqueProjects', () => {
    test('returns unique project names', () => {
      sessionManager.sessions = [
        { projectName: 'project1' },
        { projectName: 'project2' },
        { projectName: 'project1' },
        { projectName: 'project3' }
      ];
      
      const projects = sessionManager.getUniqueProjects();
      expect(projects).toEqual(['project1', 'project2', 'project3']);
    });

    test('handles empty sessions', () => {
      sessionManager.sessions = [];
      const projects = sessionManager.getUniqueProjects();
      expect(projects).toEqual([]);
    });

    test('filters out null/undefined project names', () => {
      sessionManager.sessions = [
        { projectName: 'project1' },
        { projectName: null },
        { projectName: undefined },
        { projectName: 'project2' }
      ];
      
      const projects = sessionManager.getUniqueProjects();
      expect(projects).toEqual(['project1', 'project2']);
    });
  });

  describe('getSessionsByProject', () => {
    test('groups sessions by project', () => {
      sessionManager.sessions = [
        { projectName: 'project1', sessionId: 's1' },
        { projectName: 'project2', sessionId: 's2' },
        { projectName: 'project1', sessionId: 's3' }
      ];
      
      const grouped = sessionManager.getSessionsByProject('project1');
      expect(grouped).toHaveLength(2);
      expect(grouped[0].sessionId).toBe('s1');
      expect(grouped[1].sessionId).toBe('s3');
    });

    test('returns empty array for non-existent project', () => {
      sessionManager.sessions = [
        { projectName: 'project1', sessionId: 's1' }
      ];
      
      const grouped = sessionManager.getSessionsByProject('project2');
      expect(grouped).toEqual([]);
    });
  });

  describe('searchWithOptions', () => {
    test('searches with regex option', () => {
      sessionManager.sessions = [{
        sessionId: 'test1',
        conversationPairs: [
          { userMessage: 'import React from "react"', assistantMessage: 'Response' }
        ]
      }];
      
      const results = sessionManager.searchConversations('import.*from', { regex: true });
      expect(results).toHaveLength(1);
    });

    test('searches with case sensitive option', () => {
      sessionManager.sessions = [{
        sessionId: 'test1',
        conversationPairs: [
          { userMessage: 'ERROR message', assistantMessage: 'Response' }
        ]
      }];
      
      const results1 = sessionManager.searchConversations('error', { caseSensitive: false });
      expect(results1).toHaveLength(1);
      
      const results2 = sessionManager.searchConversations('error', { caseSensitive: true });
      expect(results2).toHaveLength(0);
    });
  });

  describe('calculateDerivedMetrics', () => {
    test('calculates conversation velocity', () => {
      const session = {
        conversationPairs: [
          { timestamp: new Date('2024-01-01T10:00:00Z') },
          { timestamp: new Date('2024-01-01T10:10:00Z') },
          { timestamp: new Date('2024-01-01T10:30:00Z') }
        ]
      };
      
      const velocity = sessionManager.calculateConversationVelocity(session);
      expect(velocity).toBeCloseTo(6, 1); // 3 conversations in 30 minutes = 6/hour
    });

    test('calculates tool usage patterns', () => {
      const session = {
        conversationPairs: [
          { tools: [{ toolName: 'Read' }, { toolName: 'Edit' }] },
          { tools: [{ toolName: 'Read' }, { toolName: 'Bash' }] },
          { tools: [{ toolName: 'Edit' }] }
        ]
      };
      
      const patterns = sessionManager.analyzeToolUsagePatterns(session);
      expect(patterns.Read).toBe(2);
      expect(patterns.Edit).toBe(2);
      expect(patterns.Bash).toBe(1);
    });
  });

  describe('caching behavior', () => {
    test('caches parsed sessions', () => {
      const mockFileContent = JSON.stringify({ type: 'user', message: { content: 'Test' } });
      fs.readFileSync.mockReturnValue(mockFileContent);
      
      // First parse
      const session1 = sessionManager.parseTranscriptFile('/test/file.jsonl');
      
      // Second parse should use cache
      const session2 = sessionManager.parseTranscriptFile('/test/file.jsonl');
      
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
      expect(session1).toBe(session2);
    });

    test('invalidates cache on file change', () => {
      const mockFileContent1 = JSON.stringify({ type: 'user', message: { content: 'Test1' } });
      const mockFileContent2 = JSON.stringify({ type: 'user', message: { content: 'Test2' } });
      
      fs.readFileSync.mockReturnValueOnce(mockFileContent1);
      fs.statSync.mockReturnValueOnce({ mtimeMs: 1000 });
      
      const session1 = sessionManager.parseTranscriptFile('/test/file.jsonl');
      
      fs.readFileSync.mockReturnValueOnce(mockFileContent2);
      fs.statSync.mockReturnValueOnce({ mtimeMs: 2000 });
      
      const session2 = sessionManager.parseTranscriptFile('/test/file.jsonl');
      
      expect(session1).not.toBe(session2);
    });
  });

  describe('error handling edge cases', () => {
    test('handles malformed JSON gracefully', () => {
      fs.readFileSync.mockReturnValue('{"invalid": json}\n{"valid": "json"}');
      
      const session = sessionManager.parseTranscriptFile('/test/file.jsonl');
      expect(session).toBe(null);
    });

    test('handles file read errors', () => {
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const session = sessionManager.parseTranscriptFile('/test/file.jsonl');
      expect(session).toBe(null);
    });

    test('handles circular references in entries', () => {
      const circular = { type: 'user' };
      circular.self = circular;
      
      expect(() => {
        sessionManager.isValidTranscriptEntry(circular);
      }).not.toThrow();
    });
  });

  describe('performance optimizations', () => {
    test('limits search results', () => {
      // Create many sessions
      sessionManager.sessions = Array.from({ length: 1000 }, (_, i) => ({
        sessionId: `session${i}`,
        conversationPairs: [
          { userMessage: 'test query', assistantMessage: 'response' }
        ]
      }));
      
      const results = sessionManager.searchConversations('test', { maxResults: 10 });
      expect(results).toHaveLength(10);
    });

    test('uses early exit for OR queries', () => {
      const spy = jest.spyOn(sessionManager, 'filterConversationsByQuery');
      
      sessionManager.sessions = [{
        sessionId: 'test1',
        conversationPairs: [
          { userMessage: 'contains first term', assistantMessage: 'response' }
        ]
      }];
      
      sessionManager.searchConversations('first OR second');
      
      // Should find match on first term and not need to check second
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});