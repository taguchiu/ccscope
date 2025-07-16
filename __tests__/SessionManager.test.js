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
      // Check if console.log was called with the expected message (with emoji)
      expect(consoleOutput.some(out => out && out.toString().includes('ℹ️ No transcript files found'))).toBe(true);
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
});