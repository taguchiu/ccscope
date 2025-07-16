const InputHandler = require('../src/InputHandler');
const { EventEmitter } = require('events');

// Mock dependencies
jest.mock('../src/config', () => ({
  keyBindings: {
    navigation: {
      up: ['up', 'k'],
      down: ['down', 'j'],
      left: ['left', 'h'],
      right: ['right', 'l'],
      enter: ['enter', 'return'],
      escape: ['escape', 'esc'],
      quit: ['q'],
      home: ['home'],
      end: ['end'],
      pageUp: ['pageup'],
      pageDown: ['pagedown']
    },
    actions: {
      search: ['/'],
      filter: ['f'],
      help: ['?'],
      quit: ['q', 'Q'],
      resume: ['r'],
      export: ['e'],
      toggleTools: ['ctrl+r'],
      sort: ['s'],
      refresh: ['R'],
      bookmark: ['b'],
      copy: ['c']
    }
  },
  performance: {
    debounceDelay: 50
  }
}));

jest.mock('../src/MouseEventFilter', () => {
  return jest.fn().mockImplementation(() => ({
    isMouseEventInput: jest.fn().mockReturnValue(false),
    isMouseEventOutput: jest.fn().mockReturnValue(false),
    isMouseEventKeypress: jest.fn().mockReturnValue(false),
    extractScrollEvents: jest.fn().mockReturnValue([]),
    matchesPattern: jest.fn().mockReturnValue(false)
  }));
});

describe('InputHandler Extended Tests', () => {
  let inputHandler;
  let mockStateManager;
  let mockSessionManager;
  let mockViewRenderer;
  let mockThemeManager;
  let mockStdin;
  let mockStdout;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock process.stdin/stdout
    mockStdin = new EventEmitter();
    mockStdin.setRawMode = jest.fn();
    mockStdin.resume = jest.fn();
    mockStdin.pause = jest.fn();
    mockStdin.isTTY = true;
    
    mockStdout = new EventEmitter();
    mockStdout.write = jest.fn(() => true);
    mockStdout.columns = 80;
    mockStdout.rows = 24;
    
    // Mock dependencies
    mockStateManager = {
      getCurrentView: jest.fn(() => 'session_list'),
      navigateUp: jest.fn(),
      navigateDown: jest.fn(),
      navigateLeft: jest.fn(),
      navigateRight: jest.fn(),
      navigateToFirst: jest.fn(),
      navigateToLast: jest.fn(),
      setView: jest.fn(),
      setPreviousView: jest.fn(),
      scrollUp: jest.fn(),
      scrollDown: jest.fn(),
      scrollPageUp: jest.fn(),
      scrollPageDown: jest.fn(),
      scrollHalfPageUp: jest.fn(),
      scrollHalfPageDown: jest.fn(),
      scrollToTop: jest.fn(),
      scrollToBottom: jest.fn(),
      getCurrentSession: jest.fn(),
      setSearchQuery: jest.fn(),
      clearSearch: jest.fn(),
      clearFilters: jest.fn(),
      navigateToSessionConversation: jest.fn(() => true),
      increaseContextRange: jest.fn(),
      decreaseContextRange: jest.fn(),
      cycleSortOrder: jest.fn(),
      cycleConversationSortOrder: jest.fn(),
      searchResults: [],
      toggleToolExpansion: jest.fn(),
      toggleAllToolExpansions: jest.fn(),
      setSearchResults: jest.fn(),
      getViewData: jest.fn(() => ({
        sessions: [],
        selectedIndex: 0
      })),
      previousSearchState: null,
      navigateSearchResultLeft: jest.fn(),
      navigateSearchResultRight: jest.fn(),
      setFilter: jest.fn(),
      bookmarkSession: jest.fn(),
      unbookmarkSession: jest.fn(),
      isBookmarked: jest.fn(() => false),
      exportState: jest.fn(() => ({})),
      setLoading: jest.fn()
    };

    mockSessionManager = {
      discoverSessions: jest.fn(() => Promise.resolve([])),
      getProjects: jest.fn(() => ['project1', 'project2']),
      searchConversations: jest.fn(() => []),
      exportToFormat: jest.fn(() => 'exported data')
    };

    mockViewRenderer = {
      render: jest.fn(),
      updateTerminalSize: jest.fn(),
      clearScreen: jest.fn(),
      terminalWidth: 80
    };

    mockThemeManager = {
      formatInfo: jest.fn(text => text),
      formatError: jest.fn(text => text),
      formatHeader: jest.fn(text => text),
      formatSeparator: jest.fn((width) => '='.repeat(width)),
      formatMuted: jest.fn(text => text),
      formatSelection: jest.fn((text, isSelected) => isSelected ? `> ${text}` : text)
    };

    const originalStdin = process.stdin;
    const originalStdout = process.stdout;
    
    process.stdin = mockStdin;
    process.stdout = mockStdout;
    
    inputHandler = new InputHandler(
      mockStateManager,
      mockSessionManager,
      mockViewRenderer,
      mockThemeManager
    );
    
    // Restore after creation
    process.stdin = originalStdin;
    process.stdout = originalStdout;
  });

  describe('handleConversationDetailInput', () => {
    beforeEach(() => {
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
    });

    test('handles navigation up', () => {
      inputHandler.handleConversationDetailInput('k', { name: 'k' });
      expect(mockStateManager.navigateUp).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles navigation down', () => {
      inputHandler.handleConversationDetailInput('j', { name: 'j' });
      expect(mockStateManager.navigateDown).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles enter to view full detail', () => {
      inputHandler.handleConversationDetailInput('enter', { name: 'enter' });
      expect(mockStateManager.setView).toHaveBeenCalledWith('full_detail');
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles left/right navigation', () => {
      inputHandler.handleConversationDetailInput('h', { name: 'h' });
      expect(mockStateManager.navigateLeft).toHaveBeenCalled();
      
      inputHandler.handleConversationDetailInput('l', { name: 'l' });
      expect(mockStateManager.navigateRight).toHaveBeenCalled();
    });

    test('handles escape to go back', () => {
      inputHandler.handleConversationDetailInput('escape', { name: 'escape' });
      expect(mockStateManager.setPreviousView).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles sort conversations', () => {
      inputHandler.handleConversationDetailInput('s', { name: 's' });
      expect(mockStateManager.cycleConversationSortOrder).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles resume session', () => {
      const resumeSpy = jest.spyOn(inputHandler, 'resumeSession');
      inputHandler.handleConversationDetailInput('r', { name: 'r' });
      expect(resumeSpy).toHaveBeenCalled();
    });
  });

  describe('handleSearchResultsInput', () => {
    beforeEach(() => {
      mockStateManager.getCurrentView.mockReturnValue('search_results');
      mockStateManager.getViewData.mockReturnValue({
        searchResults: [
          { sessionIndex: 0, conversationIndex: 0 },
          { sessionIndex: 1, conversationIndex: 1 }
        ],
        selectedIndex: 0
      });
    });

    test('handles navigation', () => {
      inputHandler.handleSearchResultsInput('j', { name: 'j' });
      expect(mockStateManager.navigateDown).toHaveBeenCalled();
      
      inputHandler.handleSearchResultsInput('k', { name: 'k' });
      expect(mockStateManager.navigateUp).toHaveBeenCalled();
    });

    test('handles enter to navigate to result', () => {
      inputHandler.handleSearchResultsInput('enter', { name: 'enter' });
      expect(mockStateManager.navigateToSessionConversation).toHaveBeenCalled();
    });

    test('handles escape to clear search', () => {
      inputHandler.handleSearchResultsInput('escape', { name: 'escape' });
      expect(mockStateManager.clearSearch).toHaveBeenCalled();
      expect(mockStateManager.setView).toHaveBeenCalledWith('session_list');
    });

    test('handles new search', () => {
      const enterSearchModeSpy = jest.spyOn(inputHandler, 'enterSearchMode');
      inputHandler.handleSearchResultsInput('/', { name: '/' });
      expect(enterSearchModeSpy).toHaveBeenCalled();
    });
  });

  describe('handleHelpInput', () => {
    test('handles escape to exit help', () => {
      inputHandler.handleHelpInput('escape', { name: 'escape' });
      expect(mockStateManager.setPreviousView).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles any other key to exit help', () => {
      inputHandler.handleHelpInput('x', { name: 'x' });
      expect(mockStateManager.setPreviousView).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });
  });

  describe('advanced input modes', () => {
    test('handles filter by project', async () => {
      inputHandler.inputMode = 'filter';
      const projects = ['project1', 'project2'];
      mockSessionManager.getProjects.mockReturnValue(projects);
      
      // Mock user selecting project
      inputHandler.filterByProject = jest.fn();
      inputHandler.handleFilterInput('p', { name: 'p' });
      
      expect(inputHandler.filterByProject).toHaveBeenCalled();
    });

    test('handles bookmark toggle', () => {
      const session = { sessionId: 'test' };
      mockStateManager.getCurrentSession.mockReturnValue(session);
      mockStateManager.isBookmarked.mockReturnValue(false);
      
      inputHandler.handleSessionListInput('b', { name: 'b' });
      
      expect(mockStateManager.bookmarkSession).toHaveBeenCalledWith(session);
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles export functionality', () => {
      const exportSpy = jest.spyOn(inputHandler, 'exportData').mockImplementation(() => {});
      
      inputHandler.handleSessionListInput('e', { name: 'e' });
      
      expect(exportSpy).toHaveBeenCalled();
    });

    test('handles copy to clipboard', () => {
      const session = { sessionId: 'test123', fullSessionId: 'full-test-123' };
      mockStateManager.getCurrentSession.mockReturnValue(session);
      
      const mockClipboard = jest.fn();
      const execSync = require('child_process').execSync;
      execSync.mockImplementation(mockClipboard);
      
      inputHandler.handleSessionListInput('c', { name: 'c' });
      
      expect(mockClipboard).toHaveBeenCalled();
    });
  });

  describe('debouncing and performance', () => {
    test('debounces rapid inputs', () => {
      jest.useFakeTimers();
      
      // Rapid navigation
      for (let i = 0; i < 10; i++) {
        inputHandler.handleSessionListInput('j', { name: 'j' });
      }
      
      // Should only navigate once per debounce period
      jest.runAllTimers();
      
      // Check that render was debounced
      const renderCalls = mockViewRenderer.render.mock.calls.length;
      expect(renderCalls).toBeLessThan(10);
      
      jest.useRealTimers();
    });

    test('handles scroll with acceleration', () => {
      // Test multiple rapid scrolls
      const startTime = Date.now();
      inputHandler.lastScrollTime = startTime - 10; // Recent scroll
      
      inputHandler.handleFullDetailInput('j', { name: 'j' });
      
      // Should scroll more lines due to acceleration
      expect(mockStateManager.scrollDown).toHaveBeenCalled();
    });
  });

  describe('mouse event handling', () => {
    test('extracts and handles scroll events', () => {
      inputHandler.mouseFilter.extractScrollEvents.mockReturnValue([
        { type: 'scroll', direction: 'up', x: 10, y: 5 }
      ]);
      
      inputHandler.handleMouseInput('\x1b[<64;10;5M');
      
      expect(mockStateManager.scrollUp).toHaveBeenCalled();
    });

    test('ignores non-scroll mouse events', () => {
      inputHandler.mouseFilter.extractScrollEvents.mockReturnValue([]);
      
      inputHandler.handleMouseInput('\x1b[<0;10;5M'); // Click event
      
      expect(mockStateManager.scrollUp).not.toHaveBeenCalled();
      expect(mockStateManager.scrollDown).not.toHaveBeenCalled();
    });
  });

  describe('state transitions', () => {
    test('handles complex navigation flow', () => {
      // Start in session list
      mockStateManager.getCurrentView.mockReturnValue('session_list');
      
      // Navigate to conversation detail
      inputHandler.handleSessionListInput('enter', { name: 'enter' });
      expect(mockStateManager.setView).toHaveBeenCalledWith('conversation_detail');
      
      // Navigate to full detail
      mockStateManager.getCurrentView.mockReturnValue('conversation_detail');
      inputHandler.handleConversationDetailInput('enter', { name: 'enter' });
      expect(mockStateManager.setView).toHaveBeenCalledWith('full_detail');
      
      // Go back
      mockStateManager.getCurrentView.mockReturnValue('full_detail');
      inputHandler.handleFullDetailInput('escape', { name: 'escape' });
      expect(mockStateManager.setPreviousView).toHaveBeenCalled();
    });

    test('handles search flow', () => {
      // Enter search mode
      inputHandler.enterSearchMode();
      expect(inputHandler.inputMode).toBe('search');
      
      // Type search query
      inputHandler.handleSearchInput('t', { name: 't' });
      inputHandler.handleSearchInput('e', { name: 'e' });
      inputHandler.handleSearchInput('s', { name: 's' });
      inputHandler.handleSearchInput('t', { name: 't' });
      
      expect(inputHandler.inputBuffer).toBe('test');
      
      // Execute search
      mockSessionManager.searchConversations.mockReturnValue([
        { sessionId: 'test1', conversationIndex: 0 }
      ]);
      
      inputHandler.handleSearchInput('', { name: 'return' });
      
      expect(mockSessionManager.searchConversations).toHaveBeenCalledWith('test');
      expect(mockStateManager.setView).toHaveBeenCalledWith('search_results');
    });
  });

  describe('error recovery', () => {
    test('handles render errors gracefully', () => {
      mockViewRenderer.render.mockImplementation(() => {
        throw new Error('Render failed');
      });
      
      expect(() => {
        inputHandler.handleSessionListInput('j', { name: 'j' });
      }).not.toThrow();
    });

    test('handles state manager errors', () => {
      mockStateManager.navigateDown.mockImplementation(() => {
        throw new Error('Navigation failed');
      });
      
      expect(() => {
        inputHandler.handleSessionListInput('j', { name: 'j' });
      }).not.toThrow();
    });

    test('recovers from invalid state', () => {
      mockStateManager.getCurrentView.mockReturnValue('invalid_view');
      
      expect(() => {
        inputHandler.handleNormalInput('j', { name: 'j' }, 'invalid_view');
      }).not.toThrow();
    });
  });

  describe('special key combinations', () => {
    test('handles Ctrl+U for half page up', () => {
      inputHandler.handleFullDetailInput('u', { name: 'u', ctrl: true });
      expect(mockStateManager.scrollHalfPageUp).toHaveBeenCalled();
    });

    test('handles Ctrl+D for half page down', () => {
      inputHandler.handleFullDetailInput('d', { name: 'd', ctrl: true });
      expect(mockStateManager.scrollHalfPageDown).toHaveBeenCalled();
    });

    test('handles Ctrl+F for page forward', () => {
      inputHandler.handleFullDetailInput('f', { name: 'f', ctrl: true });
      expect(mockStateManager.scrollPageDown).toHaveBeenCalled();
    });

    test('handles Ctrl+B for page back', () => {
      inputHandler.handleFullDetailInput('b', { name: 'b', ctrl: true });
      expect(mockStateManager.scrollPageUp).toHaveBeenCalled();
    });

    test('handles space for page down', () => {
      inputHandler.handleFullDetailInput(' ', { name: 'space' });
      expect(mockStateManager.scrollPageDown).toHaveBeenCalled();
    });
  });
});