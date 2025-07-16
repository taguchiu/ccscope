const fs = require('fs');
const path = require('path');
const os = require('os');

function createMockSessionData() {
  return {
    sessionId: '52ccc342',
    fullSessionId: '52ccc342-1234-5678-9012-345678901234',
    projectName: 'test-project',
    projectPath: '/home/user/test-project',
    filePath: '/home/user/.claude/projects/test/transcript.jsonl',
    conversationPairs: [
      {
        index: 0,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        userMessage: 'Test user message',
        assistantMessage: 'Test assistant response',
        responseTime: 1500,
        tools: [
          { name: 'Read', type: 'file_operation' },
          { name: 'Edit', type: 'file_operation' }
        ],
        toolsUsed: [
          { name: 'Read', type: 'file_operation' },
          { name: 'Edit', type: 'file_operation' }
        ]
      },
      {
        index: 1,
        timestamp: new Date('2024-01-01T10:05:00Z'),
        userMessage: 'Another test message',
        assistantMessage: 'Another response',
        responseTime: 2500,
        tools: [],
        toolsUsed: []
      }
    ],
    totalDuration: 4000,
    duration: 4000,
    totalConversations: 2,
    startTime: new Date('2024-01-01T10:00:00Z'),
    lastActivity: new Date('2024-01-01T10:05:00Z'),
    metrics: {
      avgResponseTime: 2000,
      toolUsageCount: 2
    }
  };
}

function createMockJSONLContent() {
  return [
    {
      type: 'user',
      timestamp: '2024-01-01T10:00:00Z',
      message: { content: 'Test user message' },
      cwd: '/home/user/test-project'
    },
    {
      type: 'assistant',
      timestamp: '2024-01-01T10:00:01.5Z',
      message: {
        content: [
          { type: 'text', text: 'Test assistant response' },
          { 
            type: 'tool_use',
            name: 'Read',
            input: { file_path: 'test.js' }
          },
          {
            type: 'tool_use',
            name: 'Edit',
            input: { file_path: 'test.js', old_string: 'foo', new_string: 'bar' }
          }
        ]
      }
    },
    {
      type: 'user',
      timestamp: '2024-01-01T10:05:00Z',
      message: { content: 'Another test message' }
    },
    {
      type: 'assistant',
      timestamp: '2024-01-01T10:05:02.5Z',
      message: { content: 'Another response' }
    }
  ];
}

function createTempTranscriptFile() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccscope-test-'));
  const transcriptPath = path.join(tempDir, '52ccc342-1234-5678-9012-345678901234.jsonl');
  
  const content = createMockJSONLContent()
    .map(obj => JSON.stringify(obj))
    .join('\n');
  
  fs.writeFileSync(transcriptPath, content);
  
  return { tempDir, transcriptPath };
}

function cleanupTempDir(tempDir) {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  createMockSessionData,
  createMockJSONLContent,
  createTempTranscriptFile,
  cleanupTempDir
};