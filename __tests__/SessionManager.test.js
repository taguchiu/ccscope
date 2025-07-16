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
    sessionManager = new SessionManager();
    // Capture console output
    originalStdout = process.stdout.write;
    consoleOutput = [];
    process.stdout.write = jest.fn(data => {
      consoleOutput.push(data);
    });
    process.stdout.columns = 80;
  });

  afterEach(() => {
    process.stdout.write = originalStdout;
    if (tempDir) {
      cleanupTempDir(tempDir);
      tempDir = null;
    }
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
      expect(consoleOutput.some(out => out.includes('No transcript files found'))).toBe(true);
    });

    test('discovers and parses transcript files', async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      // Mock scanDirectory to return our temp file
      jest.spyOn(sessionManager, 'scanDirectory').mockResolvedValue([transcriptPath]);
      
      const sessions = await sessionManager.discoverSessions();
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionId).toBe('52ccc342');
      expect(sessions[0].projectName).toBe('test-project');
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
      
      jest.spyOn(sessionManager, 'scanDirectory').mockResolvedValue([file1, file2]);
      
      const sessions = await sessionManager.discoverSessions();
      
      expect(sessions[0].lastActivity > sessions[1].lastActivity).toBe(true);
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
      expect(session.sessionId).toBe('52ccc342');
      expect(session.fullSessionId).toBe('52ccc342-1234-5678-9012-345678901234');
      expect(session.projectName).toBe('test-project');
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
      const filePath = '/path/to/abc123def456.jsonl';
      const fullId = sessionManager.extractFullSessionId(filePath);
      expect(fullId).toBe('abc123def456');
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
      expect(pairs[0].tools).toHaveLength(2);
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
      expect(tools[0].name).toBe('Read');
      expect(tools[1].name).toBe('Edit');
    });
  });

  describe('calculateSessionMetrics', () => {
    test('calculates metrics for conversation pairs', () => {
      const pairs = [
        { responseTime: 1000, tools: [{ name: 'Read' }] },
        { responseTime: 2000, tools: [{ name: 'Edit' }, { name: 'Read' }] },
        { responseTime: 3000, tools: [] }
      ];
      
      const metrics = sessionManager.calculateSessionMetrics(pairs);
      
      expect(metrics.totalDuration).toBe(6000);
      expect(metrics.avgResponseTime).toBe(2000);
      expect(metrics.toolUsageCount).toBe(3);
      expect(metrics.avgToolsPerConversation).toBe(1);
    });

    test('handles empty conversation pairs', () => {
      const metrics = sessionManager.calculateSessionMetrics([]);
      
      expect(metrics.totalDuration).toBe(0);
      expect(metrics.avgResponseTime).toBe(0);
      expect(metrics.toolUsageCount).toBe(0);
    });
  });

  describe('searchConversations', () => {
    beforeEach(async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      jest.spyOn(sessionManager, 'scanDirectory').mockResolvedValue([transcriptPath]);
      await sessionManager.discoverSessions();
    });

    test('searches conversations with simple query', () => {
      const results = sessionManager.searchConversations('test');
      
      expect(results.results).toHaveLength(2);
      expect(results.totalMatches).toBe(2);
    });

    test('supports OR queries', () => {
      const results = sessionManager.searchConversations('user OR assistant');
      
      expect(results.results).toHaveLength(2);
    });

    test('supports regex search', () => {
      const results = sessionManager.searchConversations('test.*message', { regex: true });
      
      expect(results.results).toHaveLength(2);
    });

    test('returns match indices for highlighting', () => {
      const results = sessionManager.searchConversations('test');
      
      expect(results.results[0].matchIndices).toBeDefined();
      expect(results.results[0].matchIndices.length).toBeGreaterThan(0);
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
      expect(stats.timeRange).toBeDefined();
      expect(stats.totals).toBeDefined();
      expect(stats.totals.sessions).toBe(1);
      expect(stats.totals.conversations).toBe(2);
    });
  });

  describe('getProjectStatistics', () => {
    beforeEach(async () => {
      const { tempDir: dir, transcriptPath } = createTempTranscriptFile();
      tempDir = dir;
      
      jest.spyOn(sessionManager, 'scanDirectory').mockResolvedValue([transcriptPath]);
      await sessionManager.discoverSessions();
    });

    test('generates project statistics', () => {
      const stats = sessionManager.getProjectStatistics();
      
      expect(stats.size).toBe(1);
      expect(stats.has('test-project')).toBe(true);
      
      const projectStats = stats.get('test-project');
      expect(projectStats.sessions).toBe(1);
      expect(projectStats.conversations).toBe(2);
    });
  });
});