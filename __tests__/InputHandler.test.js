const InputHandler = require('../src/InputHandler');
const { MockReadline } = require('./helpers/mockTerminal');
const { EventEmitter } = require('events');

jest.mock('../src/config', () => ({
  keyBindings: {
    navigation: {
      up: ['up', 'k'],
      down: ['down', 'j'],
      left: ['left', 'h'],
      right: ['right', 'l'],
      enter: ['enter', 'return'],
      escape: ['escape', 'esc'],
      quit: ['q']
    },
    actions: {
      search: ['/'],
      filter: ['f'],
      help: ['?'],
      quit: ['q', 'Q'],
      resume: ['r'],
      export: ['e']
    }
  }
}));

// Mock MouseEventFilter
const mockMouseEventFilter = {
  isMouseEventInput: jest.fn(() => false),
  isMouseEventOutput: jest.fn(() => false),
  isMouseEventKeypress: jest.fn(() => false)
};

jest.mock('../src/MouseEventFilter', () => {
  return jest.fn().mockImplementation(() => mockMouseEventFilter);
});

// Mock readline
jest.mock('readline', () => ({
  createInterface: jest.fn(() => ({
    close: jest.fn(),
    question: jest.fn()
  })),
  emitKeypressEvents: jest.fn()
}));

describe('InputHandler', () => {
  let inputHandler;
  let mockStateManager;
  let mockSessionManager;
  let mockViewRenderer;
  let mockThemeManager;
  let mockStdin;
  let mockStdout;
  let originalStdout;

  beforeEach(() => {
    // Mock stdin/stdout
    mockStdin = new EventEmitter();
    mockStdin.setRawMode = jest.fn();
    mockStdin.resume = jest.fn();
    mockStdin.isTTY = true;
    
    mockStdout = new EventEmitter();
    mockStdout.write = jest.fn();
    mockStdout.columns = 80;
    mockStdout.rows = 24;
    
    originalStdout = process.stdout;
    process.stdin = mockStdin;
    process.stdout = mockStdout;

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
      scrollToTop: jest.fn(),
      scrollToBottom: jest.fn(),
      getCurrentSession: jest.fn(),
      setSearchQuery: jest.fn(),
      clearSearch: jest.fn(),
      increaseContextRange: jest.fn(),
      decreaseContextRange: jest.fn(),
      cycleSortOrder: jest.fn(),
      cycleConversationSortOrder: jest.fn(),
      searchResults: [],
      toggleToolExpansion: jest.fn(),
      toggleAllToolExpansions: jest.fn()
    };

    mockSessionManager = {
      discoverSessions: jest.fn(() => Promise.resolve([]))
    };

    mockViewRenderer = {
      render: jest.fn(),
      updateTerminalSize: jest.fn()
    };

    mockThemeManager = {
      formatInfo: jest.fn(text => text),
      formatError: jest.fn(text => text)
    };

    // Create inputHandler before each test
    inputHandler = new InputHandler(
      mockStateManager,
      mockSessionManager,
      mockViewRenderer,
      mockThemeManager
    );
  });

  afterEach(() => {
    process.stdout = originalStdout;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('initializes with correct defaults', () => {
      expect(inputHandler.inputMode).toBe('normal');
      expect(inputHandler.inputBuffer).toBe('');
      expect(inputHandler.inputHistory).toEqual([]);
    });

    test('enables raw mode for TTY', () => {
      expect(mockStdin.setRawMode).toHaveBeenCalledWith(true);
      expect(mockStdin.resume).toHaveBeenCalled();
    });

    test('sets up mouse event filter', () => {
      expect(inputHandler.mouseFilter).toBeDefined();
    });
  });

  describe('handleKeyPress', () => {
    test('handles Ctrl+C to exit', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      inputHandler.handleKeyPress('', { ctrl: true, name: 'c' });
      
      expect(exitSpy).toHaveBeenCalled();
      exitSpy.mockRestore();
    });

    test('ignores mouse events', () => {
      mockMouseEventFilter.isMouseEventKeypress.mockReturnValue(true);
      
      inputHandler.handleKeyPress('\\x1b[M', { sequence: '\\x1b[M' });
      
      expect(mockViewRenderer.render).not.toHaveBeenCalled();
    });

    test('handles search mode input', () => {
      inputHandler.inputMode = 'search';
      const handleSearchSpy = jest.spyOn(inputHandler, 'handleSearchInput');
      
      inputHandler.handleKeyPress('a', { name: 'a' });
      
      expect(handleSearchSpy).toHaveBeenCalledWith('a', { name: 'a' });
    });

    test('handles filter mode input', () => {
      inputHandler.inputMode = 'filter';
      const handleFilterSpy = jest.spyOn(inputHandler, 'handleFilterInput');
      
      inputHandler.handleKeyPress('1', { name: '1' });
      
      expect(handleFilterSpy).toHaveBeenCalledWith('1', { name: '1' });
    });

    test('handles normal mode input', () => {
      const handleNormalSpy = jest.spyOn(inputHandler, 'handleNormalInput');
      
      inputHandler.handleKeyPress('j', { name: 'j' });
      
      expect(handleNormalSpy).toHaveBeenCalled();
    });
  });

  describe('handleNormalInput', () => {
    test('handles quit key', () => {
      const exitSpy = jest.spyOn(inputHandler, 'exitApplication').mockImplementation(() => {});
      
      inputHandler.handleNormalInput('q', { name: 'q' }, 'session_list');
      
      expect(exitSpy).toHaveBeenCalled();
    });

    test('handles uppercase G for last navigation', () => {
      inputHandler.handleNormalInput('G', { name: 'G' }, 'session_list');
      
      expect(mockStateManager.navigateToLast).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles view-specific input', () => {
      const handleSessionListSpy = jest.spyOn(inputHandler, 'handleSessionListInput');
      
      inputHandler.handleNormalInput('j', { name: 'j' }, 'session_list');
      
      expect(handleSessionListSpy).toHaveBeenCalledWith('j', { name: 'j' });
    });
  });

  describe('handleSessionListInput', () => {
    test('handles navigation up', () => {
      inputHandler.handleSessionListInput('k', { name: 'k' });
      
      expect(mockStateManager.navigateUp).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles navigation down', () => {
      inputHandler.handleSessionListInput('j', { name: 'j' });
      
      expect(mockStateManager.navigateDown).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles enter to view details', () => {
      inputHandler.handleSessionListInput('enter', { name: 'enter' });
      
      expect(mockStateManager.setView).toHaveBeenCalledWith('conversation_detail');
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles search key', () => {
      inputHandler.handleSessionListInput('/', { name: '/' });
      
      expect(inputHandler.inputMode).toBe('search');
      expect(mockStdout.write).toHaveBeenCalled();
    });

    test('handles help key', () => {
      inputHandler.handleSessionListInput('?', { name: '?' });
      
      expect(mockStateManager.setView).toHaveBeenCalledWith('help');
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles resume session', () => {
      mockStateManager.getCurrentSession.mockReturnValue({
        fullSessionId: 'test-session-id',
        projectPath: '/test/path'
      });
      
      const execSyncSpy = jest.spyOn(require('child_process'), 'execSync').mockImplementation(() => {});
      
      inputHandler.handleSessionListInput('r', { name: 'r' });
      
      expect(execSyncSpy).toHaveBeenCalled();
      execSyncSpy.mockRestore();
    });
  });

  describe('handleSearchInput', () => {
    beforeEach(() => {
      inputHandler.inputMode = 'search';
    });

    test('appends characters to buffer', () => {
      inputHandler.handleSearchInput('t', { name: 't' });
      inputHandler.handleSearchInput('e', { name: 'e' });
      inputHandler.handleSearchInput('s', { name: 's' });
      inputHandler.handleSearchInput('t', { name: 't' });
      
      expect(inputHandler.inputBuffer).toBe('test');
    });

    test('handles backspace', () => {
      inputHandler.inputBuffer = 'test';
      inputHandler.handleSearchInput('', { name: 'backspace' });
      
      expect(inputHandler.inputBuffer).toBe('tes');
    });

    test('handles escape to cancel', () => {
      inputHandler.inputBuffer = 'test';
      inputHandler.handleSearchInput('', { name: 'escape' });
      
      expect(inputHandler.inputMode).toBe('normal');
      expect(inputHandler.inputBuffer).toBe('');
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles enter to search', () => {
      const searchSpy = jest.spyOn(inputHandler, 'performSearch').mockImplementation(() => {});
      inputHandler.inputBuffer = 'test';
      
      inputHandler.handleSearchInput('', { name: 'enter' });
      
      expect(searchSpy).toHaveBeenCalledWith('test', {});
      expect(inputHandler.inputMode).toBe('normal');
    });
  });

  describe('handleFullDetailInput', () => {
    test('handles scroll up', () => {
      inputHandler.handleFullDetailInput('k', { name: 'k' });
      
      expect(mockStateManager.scrollUp).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles scroll down', () => {
      inputHandler.handleFullDetailInput('j', { name: 'j' });
      
      expect(mockStateManager.scrollDown).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles page up', () => {
      inputHandler.handleFullDetailInput('pageup', { name: 'pageup' });
      
      expect(mockStateManager.scrollPageUp).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles page down', () => {
      inputHandler.handleFullDetailInput('pagedown', { name: 'pagedown' });
      
      expect(mockStateManager.scrollPageDown).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles escape to go back', () => {
      inputHandler.handleFullDetailInput('escape', { name: 'escape' });
      
      expect(mockStateManager.setPreviousView).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles Ctrl+R to toggle tool expansion', () => {
      inputHandler.handleFullDetailInput('r', { name: 'r', ctrl: true });
      
      expect(mockStateManager.toggleAllToolExpansions).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles home key', () => {
      inputHandler.handleFullDetailInput('home', { name: 'home' });
      
      expect(mockStateManager.scrollToTop).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });

    test('handles end key', () => {
      inputHandler.handleFullDetailInput('end', { name: 'end' });
      
      expect(mockStateManager.scrollToBottom).toHaveBeenCalled();
      expect(mockViewRenderer.render).toHaveBeenCalled();
    });
  });

  describe('performSearch', () => {
    test('performs conversation search', () => {
      mockSessionManager.searchConversations = jest.fn(() => ({
        results: [{ sessionId: 'test', conversationIndex: 0 }],
        totalMatches: 1
      }));
      
      inputHandler.performSearch('test query', {});
      
      expect(mockSessionManager.searchConversations).toHaveBeenCalledWith('test query', {});
      expect(mockStateManager.setView).toHaveBeenCalledWith('search_results');
    });

    test('handles no search results', () => {
      mockSessionManager.searchConversations = jest.fn(() => ({
        results: [],
        totalMatches: 0
      }));
      
      inputHandler.performSearch('no results', {});
      
      expect(mockStdout.write).toHaveBeenCalledWith(expect.stringContaining('No matches'));
    });
  });

  describe('setupOutputFiltering', () => {
    test('filters mouse event output', () => {
      inputHandler.mouseFilter.isMouseEventOutput.mockReturnValue(true);
      
      const result = process.stdout.write('\\x1b[M');
      
      expect(result).toBe(true);
      expect(inputHandler.mouseFilter.isMouseEventOutput).toHaveBeenCalledWith('\\x1b[M');
    });

    test('allows normal output', () => {
      inputHandler.mouseFilter.isMouseEventOutput.mockReturnValue(false);
      
      process.stdout.write('Normal text');
      
      expect(mockStdout.write).toHaveBeenCalledWith('Normal text');
    });
  });

  describe('cleanup', () => {
    test('restores terminal state', () => {
      // Spy on the cleanup method implementation
      mockStdin.setRawMode.mockClear();
      
      inputHandler.cleanup();
      
      expect(mockStdin.setRawMode).toHaveBeenCalledWith(false);
    });
  });

  describe('debounceRender', () => {
    jest.useFakeTimers();

    test('debounces rapid render calls', () => {
      inputHandler.debounceRender();
      inputHandler.debounceRender();
      inputHandler.debounceRender();
      
      jest.runAllTimers();
      
      expect(mockViewRenderer.render).toHaveBeenCalledTimes(1);
    });

    jest.useRealTimers();
  });
});