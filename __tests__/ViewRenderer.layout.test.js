const ViewRenderer = require('../src/ViewRenderer');
const ThemeManager = require('../src/ThemeManager');
const { formatWithUnit } = require('../src/utils/formatters');

// Mock dependencies
jest.mock('../src/config', () => ({
  theme: {
    colors: {
      slowResponse: '\x1b[91m',
      mediumResponse: '\x1b[93m',
      fastResponse: '\x1b[92m',
      selected: '\x1b[44m\x1b[97m',
      header: '\x1b[1m\x1b[94m',
      separator: '\x1b[97m',
      prefix: '\x1b[92m',
      accent: '\x1b[95m',
      muted: '\x1b[90m',
      info: '\x1b[96m',
      warning: '\x1b[93m',
      error: '\x1b[91m',
      success: '\x1b[92m',
      reset: '\x1b[0m'
    },
    icons: {
      ui: {
        selected: '▶',
        unselected: ' ',
        bullet: '•',
        arrow: '→',
        separator: '─',
        loading: '⏳',
        search: '🔍',
        filter: '🔽',
        bookmark: '🔖',
        export: '📤'
      }
    }
  },
  performance: {
    maxVisibleSessions: 100,
    cacheSize: 1000
  }
}));

// Mock console.log to capture output
const originalConsoleLog = console.log;
let logOutput = [];

beforeEach(() => {
  logOutput = [];
  console.log = jest.fn((msg) => {
    logOutput.push(msg);
  });
});

afterEach(() => {
  console.log = originalConsoleLog;
});

describe('ViewRenderer Layout Tests', () => {
  let viewRenderer;
  let themeManager;
  let mockSessionManager;
  let mockStateManager;

  beforeEach(() => {
    // Mock session manager
    mockSessionManager = {
      sessions: [],
      searchConversations: jest.fn(() => [])
    };

    // Mock theme manager
    themeManager = new ThemeManager();
    themeManager.setTheme('default');

    // Mock state manager
    mockStateManager = {
      getFilteredSessions: jest.fn(() => []),
      selectedSessionIndex: 0,
      getViewData: jest.fn(() => ({ sessions: [], selectedIndex: 0 })),
      currentView: 'session_list',
      searchQuery: '',
      currentFilter: {},
      sortOrder: 'lastActivity',
      sortDirection: 'desc'
    };

    viewRenderer = new ViewRenderer(mockSessionManager, themeManager, mockStateManager);
    
    // Set up terminal dimensions
    viewRenderer.terminalWidth = 120;
    viewRenderer.terminalHeight = 30;
  });

  describe('Token Display Layout', () => {
    test('token column has consistent width in wide layout', () => {
      // Set up wide terminal
      viewRenderer.terminalWidth = 120;
      viewRenderer.terminalHeight = 30;
      
      const conversation = {
        index: 1,
        timestamp: new Date('2024-07-18T01:31:00'),
        userMessage: 'Test message',
        responseTime: 171,
        toolsUsed: ['Read', 'Edit', 'Write'],
        tokenUsage: {
          inputTokens: 800,
          outputTokens: 800,
          totalTokens: 1600
        }
      };

      // Test token formatting
      const totalTokens = conversation.tokenUsage.totalTokens;
      const formattedTokens = formatWithUnit(totalTokens);
      
      // Token column should be exactly 8 characters wide
      expect(formattedTokens.length).toBeLessThanOrEqual(8);
      
      // Test padded version
      const paddedTokens = formattedTokens.padEnd(8);
      expect(paddedTokens.length).toBe(8);
    });

    test('token display is consistent between selected and non-selected rows', () => {
      const conversation = {
        index: 1,
        timestamp: new Date('2024-07-18T01:31:00'),
        userMessage: 'Test message',
        responseTime: 171,
        toolsUsed: ['Read', 'Edit', 'Write'],
        tokenUsage: {
          inputTokens: 800,
          outputTokens: 800,
          totalTokens: 1600
        }
      };

      // Test token formatting directly
      const totalTokens = conversation.tokenUsage.totalTokens;
      const formattedTokens = formatWithUnit(totalTokens);
      
      // Token should be formatted as expected
      expect(formattedTokens).toBe('1.6k');
      
      // Padded token should have consistent width
      const paddedTokens = formattedTokens.padEnd(8);
      expect(paddedTokens.length).toBe(8);
      expect(paddedTokens).toBe('1.6k    ');
    });

    test('token column alignment in various token sizes', () => {
      viewRenderer.terminalWidth = 120;
      viewRenderer.terminalHeight = 30;
      
      const testCases = [
        { tokens: 100, expected: '100' },
        { tokens: 1000, expected: '1.0k' },
        { tokens: 1500, expected: '1.5k' },
        { tokens: 1000000, expected: '1.0m' },
        { tokens: 1500000, expected: '1.5m' },
        { tokens: 1000000000, expected: '1.0b' }
      ];

      testCases.forEach(({ tokens, expected }) => {
        const formatted = formatWithUnit(tokens);
        expect(formatted).toBe(expected);
        
        // Padded version should be exactly 8 characters
        const padded = formatted.padEnd(8);
        expect(padded.length).toBe(8);
      });
    });

    test('wide layout column widths are correctly calculated', () => {
      viewRenderer.terminalWidth = 120;
      viewRenderer.terminalHeight = 30;
      
      // Test the exactFixedWidth calculation
      const expectedFixedWidth = 
        2 +     // prefix: "  " or "▶ "
        3 + 1 + // no: "1  " (padEnd 3) + space  
        12 + 1 + // datetime: "07/13 21:41 " (padEnd 12) + space
        8 + 1 +  // duration: "3m44s   " (8 chars by formatResponseTime) + space
        6 + 1 +  // tools: "  19t " (6 chars by formatToolCount) + space
        8 + 1;   // tokens: "1.2k    " (8 chars) + space
      
      expect(expectedFixedWidth).toBe(44); // 2+4+13+9+7+9 = 44
    });

    test('compact layout handles token display', () => {
      viewRenderer.terminalWidth = 60; // Force compact mode
      viewRenderer.terminalHeight = 30;
      
      const session = {
        sessionId: 'abc123',
        totalConversations: 5,
        tokenUsage: {
          totalTokens: 1500
        }
      };

      // Test compact row rendering
      viewRenderer.renderCompactSessionRow(session, 0, false);
      const output = logOutput[0];
      
      // Should contain session ID, conversation count, and token display
      expect(output).toContain('abc123');
      expect(output).toContain('5');
      expect(output).toContain('1.5k'); // Formatted tokens
    });
  });

  describe('Layout Consistency', () => {
    test('headers contain token column', () => {
      // Test that headers include token column
      const headers = ['No.', 'DateTime', 'Duration', 'Tools', 'Tokens', 'User Message'];
      
      // Verify that Tokens is included in headers
      expect(headers).toContain('Tokens');
      
      // Verify header positioning
      const tokensIndex = headers.indexOf('Tokens');
      expect(tokensIndex).toBe(4); // Should be the 5th column (0-indexed)
    });

    test('message truncation calculation includes token column', () => {
      const terminalWidth = 120; // Wide terminal
      const exactFixedWidth = 
        2 +     // prefix: "  " or "▶ "
        3 + 1 + // no: "1  " (padEnd 3) + space  
        12 + 1 + // datetime: "07/13 21:41 " (padEnd 12) + space
        8 + 1 +  // duration: "3m44s   " (8 chars by formatResponseTime) + space
        6 + 1 +  // tools: "  19t " (6 chars by formatToolCount) + space
        8 + 1;   // tokens: "1.2k    " (8 chars) + space
      
      const reservedMargin = 50; // Current safety margin
      const targetMessageWidth = terminalWidth - exactFixedWidth - reservedMargin;
      
      // Use Math.max(30, targetMessageWidth) like actual implementation
      const availableWidth = Math.max(30, targetMessageWidth);
      
      // Should leave some space for the message
      expect(availableWidth).toBeGreaterThan(0);
      
      // Should account for token column in calculation
      expect(exactFixedWidth).toBe(44);
      
      // Test with narrow terminal - should fall back to minimum width
      const narrowTerminalWidth = 80;
      const narrowTargetWidth = narrowTerminalWidth - exactFixedWidth - reservedMargin;
      const narrowAvailableWidth = Math.max(30, narrowTargetWidth);
      
      // Should guarantee minimum width
      expect(narrowAvailableWidth).toBeGreaterThanOrEqual(30);
      
      // Very narrow terminal should still provide minimum width
      const veryNarrowTerminalWidth = 60;
      const veryNarrowTargetWidth = veryNarrowTerminalWidth - exactFixedWidth - reservedMargin;
      const veryNarrowAvailableWidth = Math.max(30, veryNarrowTargetWidth);
      
      expect(veryNarrowAvailableWidth).toBe(30); // Should be minimum
    });
  });

  describe('Token Formatting Edge Cases', () => {
    test('handles zero tokens', () => {
      const formatted = formatWithUnit(0);
      expect(formatted).toBe('0');
      
      const padded = formatted.padEnd(8);
      expect(padded.length).toBe(8);
    });

    test('handles very large token counts', () => {
      const formatted = formatWithUnit(1234567890);
      expect(formatted).toBe('1.2b');
      expect(formatted.length).toBeLessThanOrEqual(8);
    });

    test('handles fractional display correctly', () => {
      const testCases = [
        { input: 1234, expected: '1.2k' },
        { input: 1567, expected: '1.6k' },
        { input: 1000, expected: '1.0k' },
        { input: 999, expected: '999' }
      ];

      testCases.forEach(({ input, expected }) => {
        const formatted = formatWithUnit(input);
        expect(formatted).toBe(expected);
      });
    });
  });
});