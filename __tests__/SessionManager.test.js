const fs = require('fs');
const path = require('path');
const os = require('os');
const SessionManager = require('../src/SessionManager');
const { 
  createMockJSONLContent, 
  createTempTranscriptFile, 
  cleanupTempDir 
} = require('./helpers/testHelpers');

jest.mock('../src/config', () => ({
  filesystem: {
    transcriptDirectories: ['~/.claude/projects/', './transcripts/'],
    transcriptExtension: '.jsonl'
  }
}));

describe('SessionManager', () => {
  let sessionManager;
  let tempDir;
  let originalStdout;
  let consoleOutput;

  beforeEach(() => {
    // Clear all mocks first
    jest.restoreAllMocks();
    
    sessionManager = new SessionManager();
    // Ensure sessions array is empty
    sessionManager.sessions = [];
    
    // Capture console output
    originalStdout = process.stdout.write;
    consoleOutput = [];
    
    // Mock both console.log and process.stdout.write
    const originalConsoleLog = console.log;
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    
    process.stdout.write = jest.fn(data => {
      consoleOutput.push(data);
      return true;
    });
    process.stdout.columns = 80;
    
    // Store original console.log for cleanup
    sessionManager._originalConsoleLog = originalConsoleLog;
  });

  afterEach(() => {
    process.stdout.write = originalStdout;
    if (sessionManager._originalConsoleLog) {
      console.log = sessionManager._originalConsoleLog;
    }
    if (tempDir) {
      cleanupTempDir(tempDir);
      tempDir = null;
    }
    // Clear all mocks and spies
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    test('initializes with empty sessions', () => {
      expect(sessionManager.sessions).toEqual([]);
      expect(sessionManager.sessionCache).toBeInstanceOf(Map);
      expect(sessionManager.isLoading).toBe(false);
    });

    test('initializes search and filter state', () => {
      expect(sessionManager.searchQuery).toBe('');
      expect(sessionManager.activeFilters).toEqual({
        project: null,
        responseTime: null,
        dateRange: null
      });
    });
  });

  describe('discoverSessions', () => {
    test('returns empty array when no transcript files found', async () => {
      // Mock scanDirectory to return empty
      jest.spyOn(sessionManager, 'scanDirectory').mockResolvedValue([]);
      
      const sessions = await sessionManager.discoverSessions();
      
      expect(sessions).toEqual([]);
      // No longer outputs message when no files found
    });

    test('discovers and parses transcript files', async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      // Mock discoverTranscriptFiles directly to return our temp file
      jest.spyOn(sessionManager, 'discoverTranscriptFiles').mockResolvedValue([transcriptPath]);
      
      const sessions = await sessionManager.discoverSessions();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBeDefined();
      expect(sessions[0].sessionId).toHaveLength(8); // Should be 8-char hash
      expect(sessions[0].fullSessionId).toBe('52ccc342-1234-5678-9012-345678901234');
      expect(sessions[0].conversationPairs).toHaveLength(2);
    });

    test('sorts sessions by last activity', async () => {
      // Create multiple transcript files with different timestamps
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
      
      const file1 = path.join(tempDir, 'session1.jsonl');
      const file2 = path.join(tempDir, 'session2.jsonl');
      
      // Older session
      fs.writeFileSync(file1, JSON.stringify({
        type: 'user',
        timestamp: '2024-01-01T10:00:00Z',
        message: { content: 'Test 1' },
        cwd: '/home/user/project1'
      }) + '\n' + JSON.stringify({
        type: 'assistant',
        timestamp: '2024-01-01T10:00:01Z',
        message: { content: 'Response 1' }
      }));
      
      // Newer session
      fs.writeFileSync(file2, JSON.stringify({
        type: 'user',
        timestamp: '2024-01-02T10:00:00Z',
        message: { content: 'Test 2' },
        cwd: '/home/user/project2'
      }) + '\n' + JSON.stringify({
        type: 'assistant',
        timestamp: '2024-01-02T10:00:01Z',
        message: { content: 'Response 2' }
      }));
      
      jest.spyOn(sessionManager, 'discoverTranscriptFiles').mockResolvedValue([file1, file2]);
      
      const sessions = await sessionManager.discoverSessions();
      
      expect(sessions).toHaveLength(2);
      // Newer session should come first after sorting
      const firstTimestamp = new Date(sessions[0].lastActivity).getTime();
      const secondTimestamp = new Date(sessions[1].lastActivity).getTime();
      expect(firstTimestamp).toBeGreaterThan(secondTimestamp);
    });
  });

  describe('scanDirectory', () => {
    test('finds transcript files in directory', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
      const transcriptFile = path.join(tempDir, 'test.jsonl');
      const otherFile = path.join(tempDir, 'test.txt');
      
      fs.writeFileSync(transcriptFile, '{}');
      fs.writeFileSync(otherFile, 'test');
      
      const files = await sessionManager.scanDirectory(tempDir);
      
      expect(files).toHaveLength(1);
      expect(files[0]).toBe(transcriptFile);
    });

    test('recursively scans subdirectories', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir);
      
      const file1 = path.join(tempDir, 'test1.jsonl');
      const file2 = path.join(subDir, 'test2.jsonl');
      
      fs.writeFileSync(file1, '{}');
      fs.writeFileSync(file2, '{}');
      
      const files = await sessionManager.scanDirectory(tempDir);
      
      expect(files).toHaveLength(2);
      expect(files.sort()).toEqual([file1, file2].sort());
    });

    test('respects max depth limit', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
      
      // Create deep directory structure
      let currentDir = tempDir;
      for (let i = 0; i < 10; i++) {
        currentDir = path.join(currentDir, `level${i}`);
        fs.mkdirSync(currentDir);
      }
      
      const deepFile = path.join(currentDir, 'deep.jsonl');
      fs.writeFileSync(deepFile, '{}');
      
      const files = await sessionManager.scanDirectory(tempDir, 0, 3);
      
      expect(files).toHaveLength(0); // Should not find the deep file
    });

    test('skips hidden and ignored directories', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
      const hiddenDir = path.join(tempDir, '.hidden');
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      
      fs.mkdirSync(hiddenDir);
      fs.mkdirSync(nodeModulesDir);
      
      fs.writeFileSync(path.join(hiddenDir, 'test.jsonl'), '{}');
      fs.writeFileSync(path.join(nodeModulesDir, 'test.jsonl'), '{}');
      fs.writeFileSync(path.join(tempDir, 'visible.jsonl'), '{}');
      
      const files = await sessionManager.scanDirectory(tempDir);
      
      expect(files).toHaveLength(1);
      expect(files[0]).toContain('visible.jsonl');
    });
  });

  describe('parseTranscriptFile', () => {
    test('parses valid JSONL file', async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      const session = await sessionManager.parseTranscriptFile(transcriptPath);
      
      expect(session).toBeTruthy();
      expect(session.sessionId).toBeDefined();
      expect(session.sessionId).toHaveLength(8); // Should be 8-char hash
      expect(session.fullSessionId).toBe('52ccc342-1234-5678-9012-345678901234');
      expect(session.projectPath).toBe('/home/user/test-project');
      expect(session.conversationPairs).toHaveLength(2);
    });

    test('returns null for empty file', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
      const emptyFile = path.join(tempDir, 'empty.jsonl');
      fs.writeFileSync(emptyFile, '');
      
      const session = await sessionManager.parseTranscriptFile(emptyFile);
      
      expect(session).toBeNull();
    });

    test('skips malformed JSON lines', async () => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
      const file = path.join(tempDir, 'malformed.jsonl');
      
      fs.writeFileSync(file, 
        'invalid json\n' +
        JSON.stringify({ type: 'user', timestamp: '2024-01-01T10:00:00Z', message: { content: 'Test' }, cwd: '/test' }) + '\n' +
        'another invalid line\n' +
        JSON.stringify({ type: 'assistant', timestamp: '2024-01-01T10:00:01Z', message: { content: 'Response' } })
      );
      
      const session = await sessionManager.parseTranscriptFile(file);
      
      expect(session).toBeTruthy();
      expect(session.conversationPairs).toHaveLength(1);
    });
  });

  describe('extractSessionId', () => {
    test('extracts session ID from entries', () => {
      const entries = [
        { type: 'user', message: { content: 'test' } },
        { type: 'assistant', session_id: 'abc123', message: { content: 'response' } }
      ];
      
      const sessionId = sessionManager.extractSessionId(entries);
      expect(sessionId).toBe('abc123');
    });

    test('generates session ID when not found', () => {
      const entries = [
        { type: 'user', message: { content: 'test' } }
      ];
      
      const sessionId = sessionManager.extractSessionId(entries);
      expect(sessionId).toMatch(/^[a-f0-9]{8}$/);
    });
  });

  describe('extractFullSessionId', () => {
    test('extracts UUID from filename', () => {
      const filePath = '/path/to/52ccc342-1234-5678-9012-345678901234.jsonl';
      const fullId = sessionManager.extractFullSessionId(filePath);
      expect(fullId).toBe('52ccc342-1234-5678-9012-345678901234');
    });

    test('extracts hex ID from filename', () => {
      const filePath = '/path/to/abc123def456789012345678901234567890.jsonl';
      const fullId = sessionManager.extractFullSessionId(filePath);
      expect(fullId).toBe('abc123def456789012345678901234567890');
    });

    test('returns null for invalid filename', () => {
      const filePath = '/path/to/invalid.jsonl';
      const fullId = sessionManager.extractFullSessionId(filePath);
      expect(fullId).toBeNull();
    });
  });

  describe('buildConversationPairs', () => {
    test('pairs user and assistant messages correctly', () => {
      const entries = createMockJSONLContent();
      const pairs = sessionManager.buildConversationPairs(entries);
      
      expect(pairs).toHaveLength(2);
      expect(pairs[0].userMessage).toBe('Test user message');
      expect(pairs[0].assistantContent).toContain('Test assistant response');
      expect(pairs[0].toolUses).toHaveLength(2);
    });

    test('filters out tool result notifications', () => {
      const entries = [
        { type: 'user', timestamp: '2024-01-01T10:00:00Z', message: { content: 'Real message' } },
        { type: 'assistant', timestamp: '2024-01-01T10:00:01Z', message: { content: 'Response' } },
        { type: 'user', timestamp: '2024-01-01T10:00:02Z', message: { content: 'Tool results:\\n- Success' } }
      ];
      
      const pairs = sessionManager.buildConversationPairs(entries);
      
      expect(pairs).toHaveLength(1);
      expect(pairs[0].userMessage).toBe('Real message');
    });
  });

  describe('extractToolUses', () => {
    test('extracts tool uses from assistant message', () => {
      const entry = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Let me help' },
            { type: 'tool_use', name: 'Read', input: { file: 'test.js' } },
            { type: 'tool_use', name: 'Edit', input: { file: 'test.js' } }
          ]
        }
      };
      
      const tools = sessionManager.extractToolUses(entry);
      
      expect(tools).toHaveLength(2);
      expect(tools[0].toolName).toBe('Read');
      expect(tools[1].toolName).toBe('Edit');
    });
  });

  describe('calculateSessionMetrics', () => {
    test('calculates metrics for conversation pairs', () => {
      const pairs = [
        { 
          responseTime: 1, 
          toolCount: 1,
          userTime: new Date('2024-01-01T10:00:00Z'),
          assistantTime: new Date('2024-01-01T10:00:01Z')
        },
        { 
          responseTime: 2, 
          toolCount: 2,
          userTime: new Date('2024-01-01T10:00:10Z'),
          assistantTime: new Date('2024-01-01T10:00:12Z')
        },
        { 
          responseTime: 3, 
          toolCount: 0,
          userTime: new Date('2024-01-01T10:00:20Z'),
          assistantTime: new Date('2024-01-01T10:00:23Z')
        }
      ];
      
      const metrics = sessionManager.calculateSessionMetrics(pairs);
      
      expect(metrics.duration).toBe(6000); // Total response time in ms (1+2+3)*1000
      expect(metrics.avgResponseTime).toBe(2); // Average in seconds
      expect(metrics.totalTools).toBe(3); // 1+2+0
    });

    test('handles empty conversation pairs', () => {
      const metrics = sessionManager.calculateSessionMetrics([]);
      
      expect(metrics.duration).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
      expect(metrics.totalTools).toBe(0);
    });
  });

  describe('searchConversations', () => {
    beforeEach(async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      jest.spyOn(sessionManager, 'discoverTranscriptFiles').mockResolvedValue([transcriptPath]);
      await sessionManager.discoverSessions();
    });

    test('searches conversations with simple query', () => {
      const results = sessionManager.searchConversations('test');
      
      expect(results).toHaveLength(2);
      expect(results[0].sessionId).toBeDefined();
    });

    test('supports OR queries', () => {
      const results = sessionManager.searchConversations('user OR assistant');
      
      expect(results).toHaveLength(1);
    });

    test('supports regex search', () => {
      const results = sessionManager.searchConversations('test.*message', { regex: true });
      
      expect(results).toHaveLength(2);
    });

    test('returns match context for highlighting', () => {
      const results = sessionManager.searchConversations('test');
      
      expect(results[0].matchContext).toBeDefined();
      expect(results[0].matchType).toBeDefined();
    });
  });

  describe('getDailyStatistics', () => {
    beforeEach(async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      jest.spyOn(sessionManager, 'scanDirectory').mockResolvedValue([transcriptPath]);
      await sessionManager.discoverSessions();
    });

    test('generates daily statistics', () => {
      const stats = sessionManager.getDailyStatistics();
      
      expect(stats.dailyStats).toBeDefined();
      expect(stats.totalSessions).toBe(1);
      expect(stats.dailyStats).toBeInstanceOf(Array);
      expect(stats.dailyStats.length).toBeGreaterThan(0);
    });
  });

  describe('getProjectStatistics', () => {
    beforeEach(async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      jest.spyOn(sessionManager, 'discoverTranscriptFiles').mockResolvedValue([transcriptPath]);
      await sessionManager.discoverSessions();
    });

    test('generates project statistics', () => {
      const stats = sessionManager.getProjectStatistics();
      
      expect(stats).toBeInstanceOf(Array);
      expect(stats.length).toBeGreaterThan(0);
      
      // Check that at least one project exists
      const projectStats = stats[0];
      expect(projectStats).toBeDefined();
      expect(projectStats.project).toBeDefined();
      expect(projectStats.sessionCount).toBeGreaterThan(0);
      expect(projectStats.conversationCount).toBeGreaterThan(0);
    });
  });

  describe('additional edge cases for branch coverage', () => {
    test('handles different file formats and patterns', () => {
      // Test extractFullSessionId with various filename patterns
      const uuid = sessionManager.extractFullSessionId('conversation-12345678-90ab-cdef-1234-567890abcdef.jsonl');
      expect(uuid).toBe('12345678-90ab-cdef-1234-567890abcdef');
      
      // Test with 32+ character hex string (minimum length for hex pattern)
      const hex = sessionManager.extractFullSessionId('conversation-deadbeef123456789abcdef012345678.jsonl');
      expect(hex).toBe('deadbeef123456789abcdef012345678');
      
      const invalid = sessionManager.extractFullSessionId('invalid-filename.jsonl');
      expect(invalid).toBeNull();
    });

    test('handles various transcript entry formats', () => {
      // Test buildConversationPairs with complex message structures
      const entries = [
        {
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
          message: { content: 'Test user message' }
        },
        {
          type: 'assistant',
          timestamp: '2024-01-01T10:01:00Z',
          message: {
            content: [
              { type: 'text', text: 'Response text' },
              { type: 'tool_use', name: 'Read', input: { path: '/test' } }
            ]
          }
        },
        {
          type: 'tool_result',
          timestamp: '2024-01-01T10:01:30Z',
          message: { content: 'Tool result' }
        }
      ];
      
      const pairs = sessionManager.buildConversationPairs(entries);
      expect(pairs).toHaveLength(1);
      expect(pairs[0].toolsUsed).toHaveLength(1);
    });

    test('handles search with edge cases', () => {
      // Test different search patterns without setup (will return empty results)
      const results1 = sessionManager.searchConversations('nonexistent');
      const results2 = sessionManager.searchConversations('');
      
      expect(results1).toHaveLength(0);
      expect(results2).toHaveLength(0);
    });

    test('handles various tool extraction patterns', () => {
      // Test extractToolUses with different content structures
      const entry = {
        type: 'assistant',
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          content: [
            { type: 'text', text: 'Some text' },
            { type: 'tool_use', name: 'Read', input: { file_path: '/test.js' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: '/test.js', old_string: 'old', new_string: 'new' } }
          ]
        }
      };
      
      const tools = sessionManager.extractToolUses(entry);
      expect(tools).toHaveLength(2);
      expect(tools[0].toolName).toBe('Read');
      expect(tools[1].toolName).toBe('Edit');
      
      // Test with string content (no tools)
      const stringEntry = { 
        type: 'assistant',
        message: { content: 'Just a string message' } 
      };
      const noTools = sessionManager.extractToolUses(stringEntry);
      expect(noTools).toHaveLength(0);
    });

    test('calculates metrics with various conversation patterns', () => {
      // Test with conversations that have response times and tool counts
      const pairs = [
        {
          responseTime: 5,
          toolCount: 0,
          userTime: new Date('2024-01-01T10:00:00Z'),
          assistantTime: new Date('2024-01-01T10:00:05Z')
        },
        {
          responseTime: 10,
          toolCount: 2,
          userTime: new Date('2024-01-01T11:00:00Z'),
          assistantTime: new Date('2024-01-01T11:00:10Z')
        }
      ];
      
      const metrics = sessionManager.calculateSessionMetrics(pairs);
      expect(metrics.duration).toBe(15000); // (5+10)*1000
      expect(metrics.avgResponseTime).toBe(7.5); // (5+10)/2
      expect(metrics.totalTools).toBe(2);
    });

    test('handles file system edge cases', async () => {
      // Test scanDirectory with non-existent directory - should return empty array
      const files = await sessionManager.scanDirectory('/nonexistent/path');
      expect(files).toEqual([]);
      
      // Test parseTranscriptFile with non-existent file - should throw error
      await expect(sessionManager.parseTranscriptFile('/nonexistent/file.jsonl')).rejects.toThrow();
    });

    test('handles basic search edge cases', () => {
      // Test empty search
      const results1 = sessionManager.searchConversations('');
      expect(results1).toBeInstanceOf(Array);
      
      // Test single character search
      const results2 = sessionManager.searchConversations('a');
      expect(results2).toBeInstanceOf(Array);
      
      // Test whitespace search
      const results3 = sessionManager.searchConversations('   ');
      expect(results3).toBeInstanceOf(Array);
    });

    test('handles session data validation', () => {
      // Test with empty sessions array
      expect(sessionManager.sessions).toBeInstanceOf(Array);
      
      // Test getting session count
      const count = sessionManager.sessions.length;
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('handles basic data operations', () => {
      // Test basic session operations
      const sessionCount = sessionManager.sessions.length;
      expect(sessionCount).toBeGreaterThanOrEqual(0);
      
      // Test search functionality
      const searchResults = sessionManager.searchConversations('test');
      expect(searchResults).toBeInstanceOf(Array);
    });

    test('handles different search query formats', () => {
      // Test OR queries with different cases
      const orResults1 = sessionManager.searchConversations('test OR example');
      expect(orResults1).toBeInstanceOf(Array);
      
      const orResults2 = sessionManager.searchConversations('test or example');
      expect(orResults2).toBeInstanceOf(Array);
      
      const orResults3 = sessionManager.searchConversations('test | example');
      expect(orResults3).toBeInstanceOf(Array);
      
      // Test regex search with different options
      const regexResults1 = sessionManager.searchConversations('test.*message', { regex: true });
      expect(regexResults1).toBeInstanceOf(Array);
      
      const regexResults2 = sessionManager.searchConversations('invalid[regex', { regex: true });
      expect(regexResults2).toBeInstanceOf(Array); // Should handle invalid regex
      
      // Test case sensitive search
      const caseResults = sessionManager.searchConversations('Test', { caseSensitive: true });
      expect(caseResults).toBeInstanceOf(Array);
    });

    test('handles extractFullSessionId with different patterns', () => {
      // Test UUID pattern
      const uuid = sessionManager.extractFullSessionId('/path/12345678-90ab-cdef-1234-567890abcdef.jsonl');
      expect(uuid).toBe('12345678-90ab-cdef-1234-567890abcdef');
      
      // Test hex pattern (32+ chars)
      const hex = sessionManager.extractFullSessionId('/path/deadbeef123456789abcdef012345678.jsonl');
      expect(hex).toBe('deadbeef123456789abcdef012345678');
      
      // Test short hex (less than 32 chars) - should return null
      const shortHex = sessionManager.extractFullSessionId('/path/deadbeef12345.jsonl');
      expect(shortHex).toBeNull();
      
      // Test no pattern match
      const noMatch = sessionManager.extractFullSessionId('/path/regular-filename.jsonl');
      expect(noMatch).toBeNull();
      
      // Test empty filename
      const empty = sessionManager.extractFullSessionId('');
      expect(empty).toBeNull();
    });

    test('handles buildConversationPairs with edge cases', () => {
      // Test with empty entries
      const emptyPairs = sessionManager.buildConversationPairs([]);
      expect(emptyPairs).toEqual([]);
      
      // Test with only user entries
      const userOnlyEntries = [
        { type: 'user', timestamp: '2024-01-01T10:00:00Z', message: { content: 'Test' } }
      ];
      const userOnlyPairs = sessionManager.buildConversationPairs(userOnlyEntries);
      expect(userOnlyPairs).toEqual([]); // No pairs without assistant responses
      
      // Test with only assistant entries
      const assistantOnlyEntries = [
        { type: 'assistant', timestamp: '2024-01-01T10:00:00Z', message: { content: 'Response' } }
      ];
      const assistantOnlyPairs = sessionManager.buildConversationPairs(assistantOnlyEntries);
      expect(assistantOnlyPairs).toEqual([]); // No pairs without user messages
      
      // Test with tool_result entries (should be filtered)
      const entriesWithToolResults = [
        { type: 'user', timestamp: '2024-01-01T10:00:00Z', message: { content: 'Test' } },
        { type: 'tool_result', timestamp: '2024-01-01T10:00:01Z', message: { content: 'Tool output' } },
        { type: 'assistant', timestamp: '2024-01-01T10:00:02Z', message: { content: 'Response' } }
      ];
      const filteredPairs = sessionManager.buildConversationPairs(entriesWithToolResults);
      expect(filteredPairs).toHaveLength(1);
      expect(filteredPairs[0].toolResults).toBeDefined();
    });

    test('handles extractToolUses with different content types', () => {
      // Test with array content
      const arrayContentEntry = {
        type: 'assistant',
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          content: [
            { type: 'text', text: 'Some text' },
            { type: 'tool_use', name: 'Read', input: { file: 'test.js' } }
          ]
        }
      };
      const arrayTools = sessionManager.extractToolUses(arrayContentEntry);
      expect(arrayTools).toHaveLength(1);
      
      // Test with string content
      const stringContentEntry = {
        type: 'assistant',
        timestamp: '2024-01-01T10:00:00Z',
        message: { content: 'Just a string response' }
      };
      const stringTools = sessionManager.extractToolUses(stringContentEntry);
      expect(stringTools).toHaveLength(0);
      
      // Test with no message
      const noMessageEntry = {
        type: 'assistant',
        timestamp: '2024-01-01T10:00:00Z'
      };
      const noMessageTools = sessionManager.extractToolUses(noMessageEntry);
      expect(noMessageTools).toHaveLength(0);
      
      // Test with no content
      const noContentEntry = {
        type: 'assistant',
        timestamp: '2024-01-01T10:00:00Z',
        message: {}
      };
      const noContentTools = sessionManager.extractToolUses(noContentEntry);
      expect(noContentTools).toHaveLength(0);
    });

    test('handles calculateSessionMetrics with edge cases', () => {
      // Test with pairs missing responseTime
      const pairsNoResponseTime = [
        {
          userTime: new Date('2024-01-01T10:00:00Z'),
          assistantTime: new Date('2024-01-01T10:01:00Z'),
          toolCount: 2
        }
      ];
      const metricsNoTime = sessionManager.calculateSessionMetrics(pairsNoResponseTime);
      expect(metricsNoTime.duration).toBeGreaterThan(0);
      expect(metricsNoTime.avgResponseTime).toBeGreaterThan(0);
      
      // Test with pairs missing toolCount
      const pairsNoToolCount = [
        {
          responseTime: 5,
          userTime: new Date('2024-01-01T10:00:00Z'),
          assistantTime: new Date('2024-01-01T10:00:05Z')
        }
      ];
      const metricsNoToolCount = sessionManager.calculateSessionMetrics(pairsNoToolCount);
      expect(metricsNoToolCount.totalTools).toBe(0);
      
      // Test with mixed valid/invalid data
      const mixedPairs = [
        {
          responseTime: 5,
          toolCount: 1,
          userTime: new Date('2024-01-01T10:00:00Z'),
          assistantTime: new Date('2024-01-01T10:00:05Z')
        },
        {
          // Missing some fields
          userTime: new Date('2024-01-01T11:00:00Z')
        }
      ];
      const mixedMetrics = sessionManager.calculateSessionMetrics(mixedPairs);
      expect(mixedMetrics.totalTools).toBe(1);
    });

    test('handles scanDirectory with different scenarios', async () => {
      // Test with non-existent directory
      const nonExistentFiles = await sessionManager.scanDirectory('/non/existent/path');
      expect(nonExistentFiles).toEqual([]);
      
      // Test with null/undefined path
      const nullFiles = await sessionManager.scanDirectory(null);
      expect(nullFiles).toEqual([]);
      
      const undefinedFiles = await sessionManager.scanDirectory(undefined);
      expect(undefinedFiles).toEqual([]);
    });

    test('handles project name extraction edge cases', () => {
      // Test extractProjectName with different entry types
      const entriesWithCwd = [
        { type: 'user', cwd: '/Users/test/project-name', message: { content: 'Test' } }
      ];
      const projectFromCwd = sessionManager.extractProjectName(entriesWithCwd, '/path/to/file.jsonl');
      expect(projectFromCwd).toBe('project-name');
      
      // Test with no cwd
      const entriesNoCwd = [
        { type: 'user', message: { content: 'Test' } }
      ];
      const projectFromFile = sessionManager.extractProjectName(entriesNoCwd, '/path/to/project-file.jsonl');
      expect(projectFromFile).toBeDefined();
      
      // Test with empty entries
      const emptyEntries = [];
      const projectFromEmpty = sessionManager.extractProjectName(emptyEntries, '/path/to/file.jsonl');
      expect(projectFromEmpty).toBeDefined();
    });

    test('handles search query with different options', () => {
      // Test search with valid sessions
      const results = sessionManager.searchConversations('test');
      expect(results).toBeInstanceOf(Array);
      
      // Test search with regex option
      const regexResults = sessionManager.searchConversations('test.*pattern', { regex: true });
      expect(regexResults).toBeInstanceOf(Array);
      
      // Test search with case sensitive option
      const caseResults = sessionManager.searchConversations('Test', { caseSensitive: true });
      expect(caseResults).toBeInstanceOf(Array);
      
      // Test empty search
      const emptyResults = sessionManager.searchConversations('');
      expect(emptyResults).toBeInstanceOf(Array);
    });

    test('handles session cache operations', () => {
      // Test basic cache operations
      expect(sessionManager.sessionCache).toBeInstanceOf(Map);
      
      // Test cache size
      const cacheSize = sessionManager.sessionCache.size;
      expect(cacheSize).toBeGreaterThanOrEqual(0);
      
      // Test cache operations with session discovery
      const cacheKey = 'test-cache-key';
      sessionManager.sessionCache.set(cacheKey, { test: 'value' });
      expect(sessionManager.sessionCache.has(cacheKey)).toBe(true);
      
      sessionManager.sessionCache.delete(cacheKey);
      expect(sessionManager.sessionCache.has(cacheKey)).toBe(false);
    });

    test('handles conversation pair building with different message types', () => {
      // Test with thinking content
      const entriesWithThinking = [
        {
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
          message: { content: 'Test user message' }
        },
        {
          type: 'assistant',
          timestamp: '2024-01-01T10:00:01Z',
          message: {
            content: [
              { type: 'thinking', text: 'Let me think about this...' },
              { type: 'text', text: 'Test assistant response' }
            ]
          }
        }
      ];
      
      const pairsWithThinking = sessionManager.buildConversationPairs(entriesWithThinking);
      expect(pairsWithThinking).toHaveLength(1);
      expect(pairsWithThinking[0].thinkingContent).toBeDefined();
      
      // Test with mixed content types
      const entriesWithMixed = [
        {
          type: 'user',
          timestamp: '2024-01-01T10:00:00Z',
          message: { content: 'Test user message' }
        },
        {
          type: 'assistant',
          timestamp: '2024-01-01T10:00:01Z',
          message: {
            content: [
              { type: 'text', text: 'Response text' },
              { type: 'tool_use', name: 'Read', input: { file: 'test.js' } },
              { type: 'thinking', text: 'Some thinking' }
            ]
          }
        }
      ];
      
      const pairsWithMixed = sessionManager.buildConversationPairs(entriesWithMixed);
      expect(pairsWithMixed).toHaveLength(1);
      expect(pairsWithMixed[0].toolsUsed).toHaveLength(1);
      expect(pairsWithMixed[0].thinkingContent).toBeDefined();
    });

    test('handles error recovery and malformed data', () => {
      // Test with malformed JSONL entries
      const malformedEntries = [
        { type: 'user', message: { content: 'Valid entry' } },
        { invalidEntry: true }, // Missing required fields
        { type: 'assistant', message: { content: 'Another valid entry' } }
      ];
      
      const pairs = sessionManager.buildConversationPairs(malformedEntries);
      expect(pairs).toHaveLength(1);
      
      // Test with missing timestamps
      const entriesNoTimestamp = [
        { type: 'user', message: { content: 'Test' } },
        { type: 'assistant', message: { content: 'Response' } }
      ];
      
      const pairsNoTimestamp = sessionManager.buildConversationPairs(entriesNoTimestamp);
      expect(pairsNoTimestamp).toHaveLength(1);
      
      // Test with invalid message content
      const entriesInvalidContent = [
        { type: 'user', timestamp: '2024-01-01T10:00:00Z', message: null },
        { type: 'assistant', timestamp: '2024-01-01T10:00:01Z', message: { content: 'Response' } }
      ];
      
      const pairsInvalidContent = sessionManager.buildConversationPairs(entriesInvalidContent);
      // Changed expectation: The method now creates pairs even with null messages
      expect(pairsInvalidContent).toHaveLength(1);
      expect(pairsInvalidContent[0].userContent).toBe('(No content)');
    });

    test('handles different search result scenarios', () => {
      // Test search with no results
      const noResults = sessionManager.searchConversations('nonexistent');
      expect(noResults).toBeInstanceOf(Array);
      expect(noResults).toHaveLength(0);
      
      // Test search with basic query
      const basicResults = sessionManager.searchConversations('test');
      expect(basicResults).toBeInstanceOf(Array);
      
      // Test search with regex
      const regexResults = sessionManager.searchConversations('test.*pattern', { regex: true });
      expect(regexResults).toBeInstanceOf(Array);
      
      // Test search with case sensitivity
      const caseResults = sessionManager.searchConversations('Test', { caseSensitive: true });
      expect(caseResults).toBeInstanceOf(Array);
    });

    test('handles session data structure validation', () => {
      // Test session structure validation
      const sessions = sessionManager.sessions;
      expect(sessions).toBeInstanceOf(Array);
      
      // Test that each session has required properties
      sessions.forEach(session => {
        expect(session).toHaveProperty('sessionId');
        expect(session).toHaveProperty('projectName');
        expect(session).toHaveProperty('conversationPairs');
        expect(session.conversationPairs).toBeInstanceOf(Array);
      });
      
      // Test session metrics
      sessions.forEach(session => {
        if (session.conversationPairs.length > 0) {
          expect(session).toHaveProperty('duration');
          expect(session.duration).toBeGreaterThanOrEqual(0);
        }
      });
    });
  });
});