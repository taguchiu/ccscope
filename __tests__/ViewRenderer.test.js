const ViewRenderer = require('../src/ViewRenderer');
const { createMockSessionData } = require('./helpers/testHelpers');

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
      stripAnsiCodes: jest.fn(text => text.replace(/\x1b\[[0-9;]*m/g, ''))
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
      }))
    };

    // Set up stdout
    process.stdout.columns = 80;
    process.stdout.rows = 24;

    viewRenderer = new ViewRenderer(mockSessionManager, mockThemeManager, mockStateManager);
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
      mockStateManager.getViewData.mockReturnValue({
        session: mockSessionManager.sessions[0],
        conversations: mockSessionManager.sessions[0].conversationPairs,
        selectedConversationIndex: 0,
        conversationSortOrder: 'dateTime',
        conversationSortDirection: 'desc'
      });
      
      viewRenderer.render();
      
      expect(console.clear).toHaveBeenCalled();
    });

    test('renders full detail view', () => {
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      mockStateManager.getViewData.mockReturnValue({
        session: mockSessionManager.sessions[0],
        conversations: mockSessionManager.sessions[0].conversationPairs,
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
          matchedContent: 'test match'
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
        sessions: 5,
        conversations: 25,
        avgResponseTime: 2500,
        totalDuration: 125000
      };
      
      const line = viewRenderer.formatStatsLine(stats);
      
      expect(mockThemeManager.formatInfo).toHaveBeenCalled();
      expect(line).toContain('[INFO]');
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
      const range = viewRenderer.getVisibleRange(5, 2);
      
      expect(range.startIndex).toBe(0);
      expect(range.endIndex).toBe(5);
    });

    test('scrolls to show selected item', () => {
      const range = viewRenderer.getVisibleRange(30, 25);
      
      expect(range.startIndex).toBeGreaterThan(0);
      expect(range.endIndex).toBeGreaterThan(range.startIndex);
      expect(range.endIndex - range.startIndex).toBeLessThanOrEqual(viewRenderer.getMaxVisibleSessions());
    });
  });

  describe('renderWideSessionRow', () => {
    test('renders selected session with highlight', () => {
      viewRenderer.renderWideSessionRow(mockSessionManager.sessions[0], 0, true);
      
      expect(mockThemeManager.formatHighlight).toHaveBeenCalled();
      expect(consoleOutput.some(line => line.includes('[HIGHLIGHT]'))).toBe(true);
    });

    test('renders normal session without highlight', () => {
      viewRenderer.renderWideSessionRow(mockSessionManager.sessions[0], 0, false);
      
      expect(consoleOutput.some(line => line.includes('52ccc342'))).toBe(true);
    });
  });

  describe('calculateFilteredStats', () => {
    test('calculates stats for sessions', () => {
      const sessions = [
        { ...createMockSessionData(), totalDuration: 5000 },
        { ...createMockSessionData(), totalDuration: 3000 }
      ];
      
      const stats = viewRenderer.calculateFilteredStats(sessions);
      
      expect(stats.sessions).toBe(2);
      expect(stats.conversations).toBe(4);
      expect(stats.totalDuration).toBe(8000);
      expect(stats.avgResponseTime).toBe(2000);
    });

    test('returns zeros for empty sessions', () => {
      const stats = viewRenderer.calculateFilteredStats([]);
      
      expect(stats.sessions).toBe(0);
      expect(stats.conversations).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.avgResponseTime).toBe(0);
    });
  });

  describe('renderConversationDetail', () => {
    test('renders conversation list with preview', () => {
      const viewData = {
        session: mockSessionManager.sessions[0],
        conversations: mockSessionManager.sessions[0].conversationPairs,
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
      
      expect(mockThemeManager.formatSeparator).toHaveBeenCalled();
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
});