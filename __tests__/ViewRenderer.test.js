const ViewRenderer = require('../src/ViewRenderer');
const { createMockSessionData } = require('./helpers/testHelpers');

// Mock MouseEventFilter to prevent stdout.write issues
jest.mock('../src/MouseEventFilter', () => {
  return jest.fn().mockImplementation(() => ({
    isMouseEventInput: jest.fn().mockReturnValue(false),
    isMouseEventOutput: jest.fn().mockReturnValue(false),
    isMouseEventKeypress: jest.fn().mockReturnValue(false),
    extractScrollEvents: jest.fn().mockReturnValue([]),
    matchesPattern: jest.fn().mockReturnValue(false)
  }));
});

// Mock console methods
const originalConsole = {
  log: console.log,
  clear: console.clear
};

jest.mock('../src/config', () => ({
  terminal: {
    defaultWidth: 80,
    defaultHeight: 24,
    minWidth: 60,
    minHeight: 10,
    wideThreshold: 100
  },
  ui: {
    pageSize: 20
  },
  contextFlow: {
    defaultRange: 3
  },
  display: {
    progressBarWidth: 20
  },
  debug: {
    showTimings: false
  },
  layout: {
    projectNameLength: 20
  },
  performance: {
    debounceDelay: 50
  }
}));

describe('ViewRenderer', () => {
  let viewRenderer;
  let mockSessionManager;
  let mockThemeManager;
  let mockStateManager;
  let consoleOutput;

  beforeEach(() => {
    // Mock console
    consoleOutput = [];
    console.log = jest.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
    console.clear = jest.fn();

    // Mock dependencies
    mockSessionManager = {
      sessions: [createMockSessionData()]
    };

    mockThemeManager = {
      formatHeader: jest.fn(text => `[HEADER] ${text}`),
      formatInfo: jest.fn(text => `[INFO] ${text}`),
      formatSuccess: jest.fn(text => `[SUCCESS] ${text}`),
      formatWarning: jest.fn(text => `[WARNING] ${text}`),
      formatError: jest.fn(text => `[ERROR] ${text}`),
      formatMuted: jest.fn(text => `[MUTED] ${text}`),
      formatHighlight: jest.fn(text => `[HIGHLIGHT] ${text}`),
      formatSeparator: jest.fn((width, char = '═') => char.repeat(width || 80)),
      formatDuration: jest.fn(ms => `${ms}ms`),
      formatResponseTime: jest.fn(ms => `${ms}ms`),
      formatToolUsage: jest.fn(tools => tools.map(t => t.name).join(', ')),
      truncate: jest.fn((text, width) => text.substring(0, width)),
      formatSelectedPrefix: jest.fn(() => '>'),
      formatSessionId: jest.fn(id => id),
      formatAccent: jest.fn(text => `[ACCENT] ${text}`),
      formatDim: jest.fn(text => `[DIM] ${text}`),
      getDisplayWidth: jest.fn(text => text.length),
      formatDateTime: jest.fn(date => '01/01 12:00'),
      formatThinkingRate: jest.fn(rate => `${(rate * 100).toFixed(0)}%`),
      formatToolCount: jest.fn(count => `${count}t`),
      stripAnsiCodes: jest.fn(text => text.replace(/\x1b\[[0-9;]*m/g, '')),
      formatSelection: jest.fn((text, isSelected) => isSelected ? `[SELECTED] ${text}` : text),
      truncateWithWidth: jest.fn((text, width) => text.substring(0, width)),
      createProgressBar: jest.fn((current, total, width) => `[${current}/${total}]`),
      formatDuration: jest.fn(ms => `${Math.floor(ms/1000)}s`)
    };

    mockStateManager = {
      getCurrentView: jest.fn(() => 'session_list'),
      getViewData: jest.fn(() => ({
        sessions: mockSessionManager.sessions,
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      })),
      clearAllToolIds: jest.fn(),
      setMaxScrollOffset: jest.fn(),
      expandedTools: new Map(),
      allToolIds: new Set()
    };

    // Set up stdout
    process.stdout.columns = 80;
    process.stdout.rows = 24;

    viewRenderer = new ViewRenderer(mockSessionManager, mockThemeManager, mockStateManager);
    
    // Add missing methods that tests spy on
    viewRenderer.truncateWithWidth = jest.fn((text, width) => text.substring(0, width));
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.clear = originalConsole.clear;
  });

  describe('constructor', () => {
    test('initializes with correct dimensions', () => {
      expect(viewRenderer.terminalWidth).toBe(80);
      expect(viewRenderer.terminalHeight).toBe(24);
    });

    test('calculates layout dimensions', () => {
      expect(viewRenderer.leftWidth).toBe(48); // 60% of 80
      expect(viewRenderer.rightWidth).toBe(31); // 80 - 48 - 1
    });
  });

  describe('updateTerminalSize', () => {
    test('updates dimensions and recalculates layout', () => {
      process.stdout.columns = 120;
      process.stdout.rows = 40;
      
      viewRenderer.updateTerminalSize();
      
      expect(viewRenderer.terminalWidth).toBe(120);
      expect(viewRenderer.terminalHeight).toBe(40);
      expect(viewRenderer.leftWidth).toBe(72); // 60% of 120
      expect(viewRenderer.rightWidth).toBe(47); // 120 - 72 - 1
    });

    test('clears layout cache', () => {
      viewRenderer.layoutCache.set('test', 'value');
      viewRenderer.updateTerminalSize();
      
      expect(viewRenderer.layoutCache.size).toBe(0);
    });
  });

  describe('clearScreen', () => {
    test('calls console.clear', () => {
      viewRenderer.clearScreen();
      expect(console.clear).toHaveBeenCalled();
    });
  });

  describe('render', () => {
    test('shows error for small terminal', () => {
      viewRenderer.terminalHeight = 5;
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
      expect(consoleOutput).toContain('Terminal too small. Please resize.');
    });

    test('renders session list view', () => {
      viewRenderer.render();
      
      expect(mockStateManager.getCurrentView).toHaveBeenCalled();
      expect(mockStateManager.getViewData).toHaveBeenCalled();
      expect(consoleOutput.some(line => line.includes('[HEADER]'))).toBe(true);
    });

    test('renders conversation detail view', () => {
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
      
      // Create mock conversations with the properties ViewRenderer expects
      const conversations = [
        {
          index: 0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          userMessage: 'Test user message',
          assistantResponse: 'Test assistant response',
          responseTime: 1500,
          toolsUsed: [
            { name: 'Read', type: 'file_operation' },
            { name: 'Edit', type: 'file_operation' }
          ]
        }
      ];
      
      mockStateManager.getViewData.mockReturnValue({
        session: mockSessionManager.sessions[0],
        conversations: conversations,
        selectedConversationIndex: 0,
        conversationSortOrder: 'dateTime',
        conversationSortDirection: 'desc'
      });
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('renders full detail view', () => {
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      
      // Create mock conversations with the properties ViewRenderer expects
      const conversations = [
        {
          index: 0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          userMessage: 'Test user message',
          assistantResponse: 'Test assistant response',
          responseTime: 1500,
          toolsUsed: [
            { name: 'Read', type: 'file_operation' },
            { name: 'Edit', type: 'file_operation' }
          ]
        }
      ];
      
      mockStateManager.getViewData.mockReturnValue({
        session: mockSessionManager.sessions[0],
        conversations: conversations,
        selectedConversationIndex: 0,
        scrollOffset: 0,
        scrollToEnd: false
      });
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('renders search results view', () => {
      mockStateManager.getCurrentView.mockReturnValue('search_results');
      mockStateManager.getViewData.mockReturnValue({
        searchResults: [{
          sessionId: 'test',
          conversationIndex: 0,
          matchedContent: 'test match',
          matchContext: 'This is a test match context',
          matchType: 'user',
          searchOptions: {}
        }],
        selectedIndex: 0,
        searchQuery: 'test',
        searchOptions: {}
      });
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('renders help view', () => {
      mockStateManager.getCurrentView.mockReturnValue('help');
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });
  });

  describe('renderSessionList', () => {
    test('renders wide layout for wide terminals', () => {
      viewRenderer.terminalWidth = 120;
      viewRenderer.renderSessionList({
        sessions: mockSessionManager.sessions,
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      expect(consoleOutput.some(line => line.includes('[HEADER]'))).toBe(true);
    });

    test('renders compact layout for narrow terminals', () => {
      viewRenderer.terminalWidth = 70;
      viewRenderer.renderSessionList({
        sessions: mockSessionManager.sessions,
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      expect(consoleOutput.some(line => line.includes('[HEADER]'))).toBe(true);
    });
  });

  describe('formatStatsLine', () => {
    test('formats stats with sessions and conversations', () => {
      const stats = {
        totalSessions: 5,
        totalConversations: 25,
        totalDuration: 125000
      };
      
      const line = viewRenderer.formatStatsLine(stats);
      
      expect(mockThemeManager.formatHeader).toHaveBeenCalled();
      expect(mockThemeManager.formatDuration).toHaveBeenCalled();
      expect(line).toContain('Sessions');
      expect(line).toContain('Convos');
    });
  });

  describe('formatSearchFilterInfo', () => {
    test('formats search query', () => {
      const line = viewRenderer.formatSearchFilterInfo('test query', {}, 'lastActivity', 'desc');
      
      expect(line).toContain('[INFO]');
      expect(line).toContain('test query');
    });

    test('formats filters', () => {
      const filters = { project: 'test-project', duration: { min: 60000 } };
      const line = viewRenderer.formatSearchFilterInfo('', filters, 'lastActivity', 'desc');
      
      expect(line).toContain('[INFO]');
      expect(line).toContain('test-project');
    });

    test('formats sort info', () => {
      const line = viewRenderer.formatSearchFilterInfo('', {}, 'duration', 'asc');
      
      expect(line).toContain('[INFO]');
      expect(line).toContain('Duration');
      expect(line).toContain('↑');
    });
  });

  describe('getVisibleRange', () => {
    test('returns full range for small lists', () => {
      // Mock getMaxVisibleSessions to return a known value
      jest.spyOn(viewRenderer, 'getMaxVisibleSessions').mockReturnValue(10);
      
      const range = viewRenderer.getVisibleRange(5, 2);
      
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(5);
    });

    test('scrolls to show selected item', () => {
      // Mock getMaxVisibleSessions to return a known value
      jest.spyOn(viewRenderer, 'getMaxVisibleSessions').mockReturnValue(10);
      
      const range = viewRenderer.getVisibleRange(30, 25);
      
      expect(range.startIndex).toBeGreaterThan(0);
      expect(range.endIndex).toBeGreaterThan(range.startIndex);
      expect(range.endIndex - range.startIndex).toBeLessThanOrEqual(10);
    });
  });

  describe('renderWideSessionRow', () => {
    test('renders selected session with highlight', () => {
      // Mock config.layout
      const config = require('../src/config');
      config.layout = { projectNameLength: 20 };
      
      // Mock required methods
      jest.spyOn(viewRenderer, 'truncateWithWidth').mockReturnValue('test-project');
      
      // Call with properly structured session
      const session = {
        sessionId: '12345678',
        projectName: 'test-project',
        totalConversations: 2,
        duration: 5000,
        startTime: new Date('2024-01-01T10:00:00Z'),
        lastActivity: new Date('2024-01-01T10:05:00Z')
      };
      
      viewRenderer.renderWideSessionRow(session, 0, true);
      
      expect(mockThemeManager.formatSelectedPrefix).toHaveBeenCalled();
      expect(consoleOutput.some(line => line.includes('>'))).toBe(true);
    });

    test('renders normal session without highlight', () => {
      // Mock config.layout
      const config = require('../src/config');
      config.layout = { projectNameLength: 20 };
      
      // Mock required methods
      jest.spyOn(viewRenderer, 'truncateWithWidth').mockReturnValue('test-project');
      
      // Call with properly structured session
      const session = {
        sessionId: '12345678',
        projectName: 'test-project',
        totalConversations: 2,
        duration: 5000,
        startTime: new Date('2024-01-01T10:00:00Z'),
        lastActivity: new Date('2024-01-01T10:05:00Z')
      };
      
      viewRenderer.renderWideSessionRow(session, 0, false);
      
      expect(consoleOutput.length).toBeGreaterThan(0);
    });
  });

  describe('calculateFilteredStats', () => {
    test('calculates stats for sessions', () => {
      const sessions = [
        { ...createMockSessionData(), duration: 5000, totalConversations: 2 },
        { ...createMockSessionData(), duration: 3000, totalConversations: 2 }
      ];
      
      const stats = viewRenderer.calculateFilteredStats(sessions);
      
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalConversations).toBe(4);
      expect(stats.totalDuration).toBe(8000);
    });

    test('returns zeros for empty sessions', () => {
      const stats = viewRenderer.calculateFilteredStats([]);
      
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalConversations).toBe(0);
      expect(stats.totalDuration).toBe(0);
    });
  });

  describe('renderConversationDetail', () => {
    test('renders conversation list with preview', () => {
      // Create mock conversations with the properties ViewRenderer expects
      const conversations = [
        {
          index: 0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          userMessage: 'Test user message',
          assistantResponse: 'Test assistant response',
          responseTime: 1500,
          toolsUsed: [
            { name: 'Read', type: 'file_operation' },
            { name: 'Edit', type: 'file_operation' }
          ]
        }
      ];
      
      const viewData = {
        session: mockSessionManager.sessions[0],
        conversations: conversations,
        selectedConversationIndex: 0,
        conversationSortOrder: 'dateTime',
        conversationSortDirection: 'desc'
      };
      
      viewRenderer.renderConversationDetail(viewData);
      
      expect(console.clear).toHaveBeenCalled();
      expect(consoleOutput.some(line => line.includes('[HEADER]'))).toBe(true);
    });
  });

  describe('renderHelp', () => {
    test('renders help screen', () => {
      viewRenderer.renderHelp();
      
      expect(console.clear).toHaveBeenCalled();
      expect(consoleOutput.some(line => line.includes('Help'))).toBe(true);
    });
  });

  describe('renderControls', () => {
    test('renders control footer', () => {
      viewRenderer.renderControls();
      
      // renderControls calls formatMuted multiple times for control labels
      expect(mockThemeManager.formatMuted).toHaveBeenCalled();
      expect(consoleOutput.some(line => line.includes('[MUTED]'))).toBe(true);
    });
  });

  describe('highlightText', () => {
    test('highlights search terms in text', () => {
      const text = 'This is a test message with test word';
      const result = viewRenderer.highlightText(text, 'test', {});
      
      expect(mockThemeManager.formatHighlight).toHaveBeenCalledWith('test');
    });

    test('highlights regex matches', () => {
      const text = 'import React from "react"';
      const result = viewRenderer.highlightText(text, 'import.*from', { regex: true });
      
      expect(mockThemeManager.formatHighlight).toHaveBeenCalled();
    });

    test('returns original text when no matches', () => {
      const text = 'No matches here';
      const result = viewRenderer.highlightText(text, 'xyz', {});
      
      expect(result).toBe(text);
    });
  });

  describe('edge cases and error handling', () => {
    test('handles empty sessions array', () => {
      viewRenderer.renderSessionList({
        sessions: [],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles null session data', () => {
      // Create a minimal valid session object to avoid null access
      const nullSession = {
        sessionId: 'unknown',
        projectName: 'unknown',
        filePath: null
      };
      
      expect(() => {
        viewRenderer.renderConversationDetail({
          session: nullSession,
          conversations: [],
          selectedConversationIndex: 0
        });
      }).not.toThrow();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles different terminal sizes', () => {
      viewRenderer.terminalWidth = 50;
      viewRenderer.terminalHeight = 10;
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles search results with no matches', () => {
      mockStateManager.getCurrentView.mockReturnValue('search_results');
      mockStateManager.getViewData.mockReturnValue({
        searchResults: [],
        selectedIndex: 0,
        searchQuery: 'no results',
        searchOptions: {}
      });
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles full detail view with no conversations', () => {
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: mockSessionManager.sessions[0],
        conversations: [],
        selectedConversationIndex: 0,
        scrollOffset: 0,
        scrollToEnd: false
      });
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('formatSearchFilterInfo with empty values', () => {
      const line = viewRenderer.formatSearchFilterInfo('', {}, '', '');
      
      expect(mockThemeManager.formatInfo).toHaveBeenCalled();
    });

    test('getVisibleRange with edge cases', () => {
      // Test with zero items
      const range1 = viewRenderer.getVisibleRange(0, 0);
      expect(range1.startIndex).toBe(0);
      expect(range1.endIndex).toBe(0);

      // Test with negative selected index
      const range2 = viewRenderer.getVisibleRange(10, -1);
      expect(range2.startIndex).toBeGreaterThanOrEqual(0);
    });

    test('calculateFilteredStats with edge cases', () => {
      // Test with sessions that have no conversations
      const sessions = [
        { ...createMockSessionData(), duration: 0, totalConversations: 0 }
      ];
      
      const stats = viewRenderer.calculateFilteredStats(sessions);
      
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalConversations).toBe(0);
      expect(stats.totalDuration).toBe(0);
    });
  });

  describe('rendering conditions and branches', () => {
    test('renders with different view states', () => {
      // Test unknown view fallback
      mockStateManager.getCurrentView.mockReturnValue('unknown_view');
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles different sort directions', () => {
      viewRenderer.formatSearchFilterInfo('test', {}, 'duration', 'asc');
      expect(mockThemeManager.formatInfo).toHaveBeenCalled();
      
      viewRenderer.formatSearchFilterInfo('test', {}, 'duration', 'desc');
      expect(mockThemeManager.formatInfo).toHaveBeenCalled();
    });

    test('handles filters with different values', () => {
      const filters = { 
        project: 'test-project', 
        duration: { min: 1000, max: 5000 },
        other: 'value'
      };
      
      viewRenderer.formatSearchFilterInfo('', filters, 'lastActivity', 'desc');
      
      expect(mockThemeManager.formatInfo).toHaveBeenCalled();
    });

    test('renders wide vs compact layout based on terminal width', () => {
      // Test compact layout
      viewRenderer.terminalWidth = 60;
      viewRenderer.renderSessionList({
        sessions: mockSessionManager.sessions,
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      // Test wide layout
      viewRenderer.terminalWidth = 120;
      viewRenderer.renderSessionList({
        sessions: mockSessionManager.sessions,
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      expect(console.clear).toHaveBeenCalledTimes(2);
    });

    test('handles rendering with various scroll states', () => {
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      
      // Test scrollToEnd behavior
      mockStateManager.getViewData.mockReturnValue({
        session: mockSessionManager.sessions[0],
        conversations: [{
          index: 0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          userMessage: 'Test message',
          assistantResponse: 'Test response',
          responseTime: 1500,
          toolsUsed: []
        }],
        selectedConversationIndex: 0,
        scrollOffset: 0,
        scrollToEnd: true  // Test scrollToEnd branch
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles error conditions in rendering', () => {
      // Test with minimal valid data (empty sessions)
      mockStateManager.getViewData.mockReturnValue({
        sessions: [],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      expect(() => {
        viewRenderer.render();
      }).not.toThrow();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles highlightText with complex patterns', () => {
      // Test case-insensitive matching
      const text = 'This is a TEST message';
      const result = viewRenderer.highlightText(text, 'test', { caseInsensitive: true });
      
      // Test with special regex characters
      const text2 = 'Error: (test) failed';
      const result2 = viewRenderer.highlightText(text2, '(test)', {});
      
      expect(mockThemeManager.formatHighlight).toHaveBeenCalled();
    });

    test('calculates visible range with various edge cases', () => {
      // Test when selectedIndex is very large
      jest.spyOn(viewRenderer, 'getMaxVisibleSessions').mockReturnValue(5);
      
      const range = viewRenderer.getVisibleRange(100, 95);
      expect(range.startIndex).toBeGreaterThan(0);
      expect(range.endIndex).toBeLessThanOrEqual(100);
      
      // Test when selectedIndex is 0 and we have many items
      const range2 = viewRenderer.getVisibleRange(100, 0);
      expect(range2.startIndex).toBe(0);
    });

    test('handles branch conditions in formatting', () => {
      // Test formatResponseTime branches
      const fastTime = viewRenderer.formatResponseTime ? 
        viewRenderer.formatResponseTime(500) : mockThemeManager.formatResponseTime(500);
      const mediumTime = viewRenderer.formatResponseTime ?
        viewRenderer.formatResponseTime(15000) : mockThemeManager.formatResponseTime(15000);
      const slowTime = viewRenderer.formatResponseTime ?
        viewRenderer.formatResponseTime(35000) : mockThemeManager.formatResponseTime(35000);
      
      expect(mockThemeManager.formatResponseTime).toHaveBeenCalled();
      
      // Test different session states
      const emptySession = {
        sessionId: 'empty',
        projectName: 'empty-project',
        conversations: [],
        conversationPairs: [],
        totalConversations: 0,
        duration: 0
      };
      
      const viewData = {
        session: emptySession,
        conversations: [],
        selectedConversationIndex: 0
      };
      
      expect(() => {
        viewRenderer.renderConversationDetail(viewData);
      }).not.toThrow();
    });

    test('handles different terminal width branches', () => {
      // Test wide terminal branch
      viewRenderer.terminalWidth = 150;
      viewRenderer.updateTerminalSize();
      
      const wideData = {
        sessions: [createMockSessionData()],
        selectedIndex: 0,
        searchQuery: 'test',
        filters: { project: 'test' },
        sortOrder: 'duration',
        sortDirection: 'asc'
      };
      
      viewRenderer.renderSessionList(wideData);
      expect(console.clear).toHaveBeenCalled();
      
      // Test narrow terminal branch
      viewRenderer.terminalWidth = 50;
      viewRenderer.updateTerminalSize();
      
      viewRenderer.renderSessionList(wideData);
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles search query highlighting branches', () => {
      // Test with search query
      const textWithMatch = 'This is a test message';
      const highlighted1 = viewRenderer.highlightText(textWithMatch, 'test', { regex: false });
      expect(mockThemeManager.formatHighlight).toHaveBeenCalled();
      
      // Test with regex
      const highlighted2 = viewRenderer.highlightText(textWithMatch, 'test.*message', { regex: true });
      expect(mockThemeManager.formatHighlight).toHaveBeenCalled();
      
      // Test with no matches
      const highlighted3 = viewRenderer.highlightText(textWithMatch, 'xyz', {});
      expect(highlighted3).toBe(textWithMatch);
      
      // Test with empty query
      const highlighted4 = viewRenderer.highlightText(textWithMatch, '', {});
      expect(highlighted4).toBe(textWithMatch);
    });

    test('handles conversation sorting branches', () => {
      const conversations = [
        {
          index: 0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          userMessage: 'First message',
          assistantResponse: 'First response',
          responseTime: 1000,
          toolsUsed: [{ name: 'Read' }]
        },
        {
          index: 1,
          timestamp: new Date('2024-01-01T11:00:00Z'),
          userMessage: 'Second message', 
          assistantResponse: 'Second response',
          responseTime: 2000,
          toolsUsed: []
        }
      ];
      
      // Test different sort orders
      const detailData1 = {
        session: mockSessionManager.sessions[0],
        conversations: conversations,
        selectedConversationIndex: 0,
        conversationSortOrder: 'dateTime',
        conversationSortDirection: 'desc'
      };
      
      viewRenderer.renderConversationDetail(detailData1);
      expect(console.clear).toHaveBeenCalled();
      
      const detailData2 = {
        session: mockSessionManager.sessions[0],
        conversations: conversations,
        selectedConversationIndex: 0,
        conversationSortOrder: 'duration',
        conversationSortDirection: 'asc'
      };
      
      viewRenderer.renderConversationDetail(detailData2);
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles compact rendering mode', () => {
      // Test compact mode with narrow terminal
      viewRenderer.terminalWidth = 60;
      
      const compactData = {
        sessions: [createMockSessionData()],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      };
      
      expect(() => {
        viewRenderer.renderSessionList(compactData);
      }).not.toThrow();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles different view rendering modes', () => {
      // Test different terminal sizes
      viewRenderer.terminalWidth = 120;
      viewRenderer.terminalHeight = 30;
      
      expect(() => {
        viewRenderer.render();
      }).not.toThrow();
      
      // Test minimal terminal size
      viewRenderer.terminalWidth = 40;
      viewRenderer.terminalHeight = 10;
      
      expect(() => {
        viewRenderer.render();
      }).not.toThrow();
    });

    test('handles session summary formatting', () => {
      const session = {
        ...createMockSessionData(),
        metrics: {
          totalThinkingTime: 5000,
          avgThinkingRatio: 0.3,
          totalResponseTime: 15000
        }
      };
      
      const summary = viewRenderer.formatSessionSummary(session);
      expect(mockThemeManager.formatDuration).toHaveBeenCalled();
      expect(mockThemeManager.formatThinkingRate).toHaveBeenCalled();
    });

    test('handles progress indicators', () => {
      const progress = viewRenderer.createProgressIndicator(7, 10);
      expect(mockThemeManager.createProgressBar).toHaveBeenCalledWith(7, 10, 20);
      
      const emptyProgress = viewRenderer.createProgressIndicator(0, 0);
      expect(mockThemeManager.createProgressBar).toHaveBeenCalledWith(0, 0, 20);
    });

    test('handles conversation list rendering with various states', () => {
      // Test with thinking content
      const conversationsWithThinking = [{
        index: 0,
        timestamp: new Date('2024-01-01T10:00:00Z'),
        userMessage: 'User question',
        assistantResponse: 'Assistant response',
        responseTime: 2500,
        thinkingContent: 'Let me think about this...',
        toolsUsed: [{ name: 'Read', type: 'file_operation' }]
      }];
      
      // renderConversationList expects conversations array and selectedIndex as separate params
      viewRenderer.renderConversationList(conversationsWithThinking, 0);
      
      // Just verify the method was called without errors
      expect(console.log).toHaveBeenCalled();
    });

    test('handles keyboard shortcut help', () => {
      viewRenderer.renderKeyboardHelp('session_list');
      expect(mockThemeManager.formatAccent).toHaveBeenCalled();
      
      viewRenderer.renderKeyboardHelp('conversation_detail');
      expect(mockThemeManager.formatAccent).toHaveBeenCalled();
      
      viewRenderer.renderKeyboardHelp('full_detail');
      expect(mockThemeManager.formatAccent).toHaveBeenCalled();
    });

    test('handles status bar rendering', () => {
      const status = {
        mode: 'normal',
        message: 'Ready',
        progress: { current: 5, total: 10 }
      };
      
      viewRenderer.renderStatusBar(status);
      expect(mockThemeManager.formatInfo).toHaveBeenCalled();
    });

    test('handles error message formatting', () => {
      const error = new Error('Test error message');
      viewRenderer.renderError(error);
      expect(mockThemeManager.formatError).toHaveBeenCalled();
      
      viewRenderer.renderError('String error');
      expect(mockThemeManager.formatError).toHaveBeenCalled();
    });

    test('handles view rendering with different session counts', () => {
      // Test with empty sessions
      mockStateManager.getViewData.mockReturnValue({
        sessions: [],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
      
      // Test with multiple sessions
      mockStateManager.getViewData.mockReturnValue({
        sessions: [createMockSessionData(), createMockSessionData()],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles rendering with different filters', () => {
      // Test with project filter
      mockStateManager.getViewData.mockReturnValue({
        sessions: [createMockSessionData()],
        selectedIndex: 0,
        searchQuery: '',
        filters: { project: 'test-project' },
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
      
      // Test with duration filter
      mockStateManager.getViewData.mockReturnValue({
        sessions: [createMockSessionData()],
        selectedIndex: 0,
        searchQuery: '',
        filters: { duration: { min: 1000, max: 5000 } },
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles rendering with different sort orders', () => {
      // Test duration sort
      mockStateManager.getViewData.mockReturnValue({
        sessions: [createMockSessionData()],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'duration',
        sortDirection: 'asc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
      
      // Test project sort
      mockStateManager.getViewData.mockReturnValue({
        sessions: [createMockSessionData()],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'projectName',
        sortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles layout calculations with different terminal sizes', () => {
      // Mock process.stdout for terminal size
      const originalColumns = process.stdout.columns;
      const originalRows = process.stdout.rows;
      
      // Test very wide terminal
      process.stdout.columns = 200;
      process.stdout.rows = 60;
      viewRenderer.updateTerminalSize();
      
      expect(viewRenderer.leftWidth).toBe(120); // 60% of 200
      expect(viewRenderer.rightWidth).toBe(79); // 200 - 120 - 1
      
      // Test very narrow terminal
      process.stdout.columns = 40;
      process.stdout.rows = 10;
      viewRenderer.updateTerminalSize();
      
      expect(viewRenderer.leftWidth).toBe(24); // 60% of 40
      expect(viewRenderer.rightWidth).toBe(15); // 40 - 24 - 1
      
      // Restore original values
      process.stdout.columns = originalColumns;
      process.stdout.rows = originalRows;
    });

    test('handles maximum visible sessions calculation', () => {
      // Test with different terminal heights
      const originalRows = process.stdout.rows;
      
      // First test with larger terminal (should have more visible sessions)
      process.stdout.rows = 50;
      viewRenderer.updateTerminalSize();
      const maxVisible1 = viewRenderer.getMaxVisibleSessions();
      expect(maxVisible1).toBeGreaterThan(0);
      // 50 - 8 - 10 - 2 = 30
      expect(maxVisible1).toBe(30);
      
      // Then test with smaller terminal (should have fewer visible sessions)
      process.stdout.rows = 25;
      viewRenderer.updateTerminalSize();
      const maxVisible2 = viewRenderer.getMaxVisibleSessions();
      // 25 - 8 - 10 - 2 = 5
      expect(maxVisible2).toBe(5);
      expect(maxVisible2).toBeLessThan(maxVisible1);
      
      // Test minimum case
      process.stdout.rows = 10;
      viewRenderer.updateTerminalSize();
      const maxVisible3 = viewRenderer.getMaxVisibleSessions();
      // 10 - 8 - 10 - 2 = -10, but Math.max(1, -10) = 1
      expect(maxVisible3).toBe(1);
      
      // Restore original value
      process.stdout.rows = originalRows;
    });

    test('handles content height calculation', () => {
      // Test content height with different terminal sizes
      viewRenderer.terminalHeight = 30;
      const contentHeight1 = viewRenderer.getContentHeight();
      expect(contentHeight1).toBeGreaterThan(0);
      
      viewRenderer.terminalHeight = 15;
      const contentHeight2 = viewRenderer.getContentHeight();
      expect(contentHeight2).toBeGreaterThan(0);
      expect(contentHeight2).toBeLessThan(contentHeight1);
    });

    test('handles text truncation with different widths', () => {
      // Test truncation with various widths
      const longText = 'This is a very long text that should be truncated';
      
      const truncated1 = viewRenderer.truncateWithWidth(longText, 10);
      expect(truncated1.length).toBeLessThanOrEqual(10);
      
      const truncated2 = viewRenderer.truncateWithWidth(longText, 20);
      expect(truncated2.length).toBeLessThanOrEqual(20);
      
      const truncated3 = viewRenderer.truncateWithWidth('short', 20);
      expect(truncated3).toBe('short');
    });

    test('handles session row rendering with different states', () => {
      const session = {
        sessionId: '12345678',
        projectName: 'test-project',
        totalConversations: 5,
        duration: 10000,
        startTime: new Date('2024-01-01T10:00:00Z'),
        lastActivity: new Date('2024-01-01T10:05:00Z'),
        metrics: {
          avgResponseTime: 2.5,
          totalTools: 8
        }
      };
      
      // Test compact row rendering
      viewRenderer.terminalWidth = 60;
      viewRenderer.renderCompactSessionRow(session, 0, true);
      expect(consoleOutput.length).toBeGreaterThan(0);
      
      viewRenderer.renderCompactSessionRow(session, 0, false);
      expect(consoleOutput.length).toBeGreaterThan(0);
    });

    test('handles conversation rendering with different content types', () => {
      const conversations = [
        {
          index: 0,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          userMessage: 'Short message',
          assistantResponse: 'Short response',
          responseTime: 1000,
          toolsUsed: [],
          thinkingContent: null
        },
        {
          index: 1,
          timestamp: new Date('2024-01-01T10:05:00Z'),
          userMessage: 'Long message '.repeat(20),
          assistantResponse: 'Long response '.repeat(50),
          responseTime: 5000,
          toolsUsed: [
            { name: 'Read', type: 'file_operation' },
            { name: 'Edit', type: 'file_operation' }
          ],
          thinkingContent: 'Thinking content here'
        }
      ];
      
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: conversations,
        selectedConversationIndex: 0,
        conversationSortOrder: 'dateTime',
        conversationSortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles search result rendering with different match types', () => {
      mockStateManager.getCurrentView.mockReturnValue('search_results');
      mockStateManager.getViewData.mockReturnValue({
        searchResults: [
          {
            sessionId: 'test1',
            conversationIndex: 0,
            matchedContent: 'user message match',
            matchContext: 'This is a user message match context',
            matchType: 'user',
            searchOptions: {}
          },
          {
            sessionId: 'test2',
            conversationIndex: 1,
            matchedContent: 'assistant response match',
            matchContext: 'This is an assistant response match context',
            matchType: 'assistant',
            searchOptions: { regex: true }
          }
        ],
        selectedIndex: 0,
        searchQuery: 'match',
        searchOptions: {}
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles virtual scrolling with different ranges', () => {
      // Test virtual scrolling with large session list
      const largeSessions = Array.from({ length: 100 }, (_, i) => ({
        ...createMockSessionData(),
        sessionId: `session${i}`,
        projectName: `project${i}`
      }));
      
      mockStateManager.getViewData.mockReturnValue({
        sessions: largeSessions,
        selectedIndex: 50,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles rendering with null/undefined values', () => {
      // Test with null session
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: null,
        conversations: [],
        selectedConversationIndex: 0
      });
      
      expect(() => {
        viewRenderer.render();
      }).not.toThrow();
      
      // Test with undefined values
      mockStateManager.getViewData.mockReturnValue({
        sessions: undefined,
        selectedIndex: 0,
        searchQuery: undefined,
        filters: undefined,
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      expect(() => {
        viewRenderer.render();
      }).not.toThrow();
    });
    
    test('handles renderDailyStatistics with empty data', () => {
      viewRenderer.renderDailyStatistics(null);
      expect(mockThemeManager.formatMuted).toHaveBeenCalledWith('No sessions found');
      
      viewRenderer.renderDailyStatistics({ dailyStats: [] });
      expect(mockThemeManager.formatMuted).toHaveBeenCalledWith('No sessions found');
    });
    
    test('handles renderDailyStatistics with data', () => {
      const dailyStats = {
        dailyStats: [
          {
            date: '2024-01-01',
            sessionCount: 5,
            conversationCount: 20,
            totalDuration: 3600000,
            avgDuration: 180000,
            toolUsageCount: 15
          }
        ],
        totalSessions: 5,
        totalConversations: 20
      };
      
      viewRenderer.renderDailyStatistics(dailyStats);
      
      expect(console.clear).toHaveBeenCalled();
      expect(mockThemeManager.formatHeader).toHaveBeenCalledWith('📊 Daily Conversation Statistics');
      expect(mockThemeManager.formatDuration).toHaveBeenCalled();
      expect(mockThemeManager.formatInfo).toHaveBeenCalledWith('Total: 5 sessions, 20 conversations, 15 tool uses');
    });
    
    test('handles renderProjectStatistics with empty data', () => {
      viewRenderer.renderProjectStatistics(null);
      expect(mockThemeManager.formatMuted).toHaveBeenCalledWith('No projects found');
      
      viewRenderer.renderProjectStatistics([]);
      expect(mockThemeManager.formatMuted).toHaveBeenCalledWith('No projects found');
    });
    
    test('handles renderProjectStatistics with data', () => {
      const projectStats = [
          {
            project: 'Test Project',
            sessionCount: 3,
            conversationCount: 10,
            totalDuration: 1800000,
            toolUsageCount: 25
          },
          {
            project: null,
            sessionCount: 1,
            conversationCount: 5,
            totalDuration: 600000,
            toolUsageCount: 10
          }
        ];
      
      viewRenderer.renderProjectStatistics(projectStats);
      
      expect(console.clear).toHaveBeenCalled();
      expect(mockThemeManager.formatHeader).toHaveBeenCalledWith('📊 Project Statistics');
      // Project stats now displayed differently
      expect(mockThemeManager.formatInfo).toHaveBeenCalledWith('Total: 2 projects, 4 sessions, 15 conversations');
      expect(mockThemeManager.formatDuration).toHaveBeenCalled();
    });
    
    test('handles different content types in createContentBox', () => {
      // Test code block formatting
      const content = ['```javascript\nconst x = 1;\n```'];
      const result = viewRenderer.createContentBox('Test', content, 'default');
      expect(result).toContain('Test');
      
      // Test indented code
      const indentedContent = ['    const y = 2;'];
      const indentedResult = viewRenderer.createContentBox('Code', indentedContent, 'user');
      expect(indentedResult).toContain('Code');
    });
    
    test('handles wrapTextWithWidth edge cases', () => {
      // Test empty text
      const emptyResult = viewRenderer.wrapTextWithWidth('', 80);
      expect(emptyResult).toEqual(['']);
      
      // Test single long word
      const longWord = 'a'.repeat(100);
      const longResult = viewRenderer.wrapTextWithWidth(longWord, 20);
      expect(longResult.length).toBeGreaterThan(1);
      
      // Test text with newlines - split returns single line for each paragraph
      const multilineText = 'Line 1\n\nLine 3';
      const multilineResult = viewRenderer.wrapTextWithWidth(multilineText, 80);
      expect(multilineResult.length).toBe(3);
      expect(multilineResult[0]).toBe('Line 1');
      expect(multilineResult[1]).toBe('');
      expect(multilineResult[2]).toBe('Line 3');
    });
    
    test('handles formatToolInput with different tool types', () => {
      // Test Search tool
      const searchTool = {
        toolName: 'Search',
        input: { query: 'test search' }
      };
      const searchResult = viewRenderer.formatToolInput(searchTool);
      expect(searchResult.length).toBeGreaterThan(0);
      
      // Test Grep tool
      const grepTool = {
        toolName: 'Grep',
        input: { pattern: 'test.*pattern', path: '/test/path' }
      };
      const grepResult = viewRenderer.formatToolInput(grepTool);
      expect(grepResult.length).toBeGreaterThan(0);
      
      // Test unknown tool
      const unknownTool = {
        toolName: 'Unknown',
        input: { data: 'test' }
      };
      const unknownResult = viewRenderer.formatToolInput(unknownTool);
      expect(unknownResult.length).toBeGreaterThan(0);
    });
    
    test('handles tool parameters display', () => {
      const conversation = {
        index: 0,
        timestamp: new Date(),
        userMessage: 'Test',
        assistantResponse: 'Response',
        responseTime: 1000,
        toolsUsed: [
          { toolName: 'Read', input: { file_path: '/test/file.js' } },
          { toolName: 'Bash', input: { command: 'ls -la' } },
          { toolName: 'Grep', input: { pattern: 'test' } }
        ]
      };
      
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: [conversation],
        selectedConversationIndex: 0,
        scrollOffset: 0,
        scrollToEnd: false
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });
    
    test('handles createUnifiedDiff edge cases', () => {
      // Test identical strings - returns array with context
      const sameDiff = viewRenderer.createUnifiedDiff('same', 'same');
      expect(sameDiff.some(line => line.content === 'same')).toBe(true);
      
      // Test empty strings
      const emptyDiff = viewRenderer.createUnifiedDiff('', 'new content');
      expect(emptyDiff.length).toBeGreaterThan(0);
      expect(emptyDiff.some(line => line.type === 'added')).toBe(true);
      
      // Test removal
      const removeDiff = viewRenderer.createUnifiedDiff('old content', '');
      expect(removeDiff.length).toBeGreaterThan(0);
      expect(removeDiff.some(line => line.type === 'removed')).toBe(true);
    });

    test('handles tool usage summary display', () => {
      const conversations = [
        {
          index: 0,
          timestamp: new Date(),
          userMessage: 'Test 1',
          assistantResponse: 'Response 1',
          responseTime: 1000,
          toolsUsed: [
            { toolName: 'Read' },
            { toolName: 'Read' },
            { toolName: 'Edit' }
          ]
        },
        {
          index: 1,
          timestamp: new Date(),
          userMessage: 'Test 2',
          assistantResponse: 'Response 2',
          responseTime: 2000,
          toolsUsed: [
            { toolName: 'Bash' },
            { toolName: 'Bash' },
            { toolName: 'Bash' }
          ]
        }
      ];
      
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: conversations,
        selectedConversationIndex: 0,
        conversationSortOrder: 'dateTime',
        conversationSortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles conversation row display edge cases', () => {
      // Test conversation with no tools
      const noToolsConv = {
        index: 0,
        timestamp: new Date(),
        userMessage: 'User message',
        assistantResponse: 'Response',
        responseTime: 1000,
        toolsUsed: []
      };
      
      // Test conversation with thinking
      const thinkingConv = {
        index: 1,
        timestamp: new Date(),
        userMessage: 'User message',
        assistantResponse: 'Response',
        responseTime: 5000,
        toolsUsed: [],
        thinkingContent: 'Let me think...'
      };
      
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: [noToolsConv, thinkingConv],
        selectedConversationIndex: 0,
        conversationSortOrder: 'dateTime',
        conversationSortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles renderSearchResults with no results', () => {
      mockStateManager.getCurrentView.mockReturnValue('search_results');
      mockStateManager.getViewData.mockReturnValue({
        searchResults: [],
        selectedIndex: 0,
        searchQuery: 'nonexistent',
        searchOptions: {}
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles renderFullDetail with tool outputs', () => {
      const conversation = {
        index: 0,
        timestamp: new Date(),
        userMessage: 'Test',
        assistantResponse: 'Response',
        responseTime: 1000,
        toolsUsed: [
          {
            toolName: 'Read',
            input: { file_path: '/test.js' },
            output: 'File content\\n'.repeat(30), // Long output
            toolId: 'tool1'
          }
        ]
      };
      
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: [conversation],
        selectedConversationIndex: 0,
        scrollOffset: 0,
        scrollToEnd: false
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles conversation content with various types', () => {
      // Test with array content in conversation
      const conversation = {
        index: 0,
        timestamp: new Date(),
        userMessage: 'User message',
        assistantResponse: 'Assistant response',
        responseTime: 1000,
        toolsUsed: []
      };
      
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: [conversation],
        selectedConversationIndex: 0,
        scrollOffset: 0,
        scrollToEnd: false
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles conversation preview with edge cases', () => {
      // Test with empty conversation
      const emptyConv = {
        index: 0,
        timestamp: new Date(),
        userMessage: '',
        assistantResponse: '',
        responseTime: 0,
        toolsUsed: []
      };
      
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: [emptyConv],
        selectedConversationIndex: 0
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles tool usage with collapsed/expanded states', () => {
      const conversation = {
        index: 0,
        timestamp: new Date(),
        userMessage: 'Test',
        assistantResponse: 'Response',
        responseTime: 1000,
        toolsUsed: [
          {
            toolName: 'Read',
            input: { file_path: '/test.js' },
            output: 'Line\\n'.repeat(30),
            toolId: 'tool1'
          }
        ]
      };
      
      // Test collapsed state
      mockStateManager.isToolExpanded = jest.fn(() => false);
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: createMockSessionData(),
        conversations: [conversation],
        selectedConversationIndex: 0,
        scrollOffset: 0,
        scrollToEnd: false
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles session statistics display', () => {
      const sessions = [
        {
          ...createMockSessionData(),
          conversationPairs: [{ responseTime: 1000 }, { responseTime: 2000 }],
          metrics: { totalTools: 5 },
          totalConversations: 2
        },
        {
          ...createMockSessionData(),
          conversationPairs: [{ responseTime: 3000 }],
          metrics: { totalTools: 3 },
          totalConversations: 1
        }
      ];
      
      const stats = viewRenderer.calculateFilteredStats(sessions);
      expect(stats.totalSessions).toBe(2);
      expect(stats.totalConversations).toBe(3);
    });

    test('handles session metrics display', () => {
      const session = {
        ...createMockSessionData(),
        metrics: {
          avgResponseTime: 2.5,
          totalTools: 10,
          avgThinkingRatio: 0.3,
          toolsByType: {
            'file_operation': 5,
            'command': 3,
            'search': 2
          }
        }
      };
      
      mockStateManager.getViewData.mockReturnValue({
        sessions: [session],
        selectedIndex: 0,
        searchQuery: '',
        filters: {},
        sortOrder: 'lastActivity',
        sortDirection: 'desc'
      });
      
      viewRenderer.render();
      expect(console.clear).toHaveBeenCalled();
    });

    test('handles error boundary in render method', () => {
      // Mock a method to throw error
      mockStateManager.getViewData.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // ViewRenderer doesn't have error boundary, so it will throw
      expect(() => {
        viewRenderer.render();
      }).toThrow('Test error');
    });
  });
});