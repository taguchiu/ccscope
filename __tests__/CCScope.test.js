const CCScopeApplication = require('../src/CCScope');
const SessionManager = require('../src/SessionManager');
const ThemeManager = require('../src/ThemeManager');
const StateManager = require('../src/StateManager');
const ViewRenderer = require('../src/ViewRenderer');
const InputHandler = require('../src/InputHandler');

// Mock all dependencies
jest.mock('../src/SessionManager');
jest.mock('../src/ThemeManager');
jest.mock('../src/StateManager');
jest.mock('../src/ViewRenderer');
jest.mock('../src/InputHandler');
jest.mock('../src/config', () => ({
  theme: 'default',
  terminal: {
    defaultWidth: 120,
    defaultHeight: 40
  },
  debug: {
    enabled: false,
    showTimings: false,
    showMemoryUsage: false
  }
}));

describe('CCScopeApplication', () => {
  let app;
  let mockConsoleLog;
  let mockConsoleError;
  let mockConsoleClear;
  let mockProcessExit;
  let mockProcessOn;
  let mockStdoutWrite;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock console methods
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleClear = jest.spyOn(console, 'clear').mockImplementation(() => {});
    
    // Mock process methods
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mockProcessOn = jest.spyOn(process, 'on').mockImplementation(() => {});
    mockStdoutWrite = jest.spyOn(process.stdout, 'write').mockImplementation(() => {});
    
    // Mock dependency methods
    SessionManager.mockImplementation(() => ({
      discoverSessions: jest.fn().mockResolvedValue([]),
      getStatistics: jest.fn(() => ({ totalSessions: 10, totalConversations: 50 }))
    }));
    
    ThemeManager.mockImplementation(() => ({
      setTheme: jest.fn(),
      formatHeader: jest.fn(text => text),
      formatSeparator: jest.fn(() => '='.repeat(80)),
      formatSuccess: jest.fn(text => text),
      formatInfo: jest.fn(text => text),
      formatMuted: jest.fn(text => text),
      formatWarning: jest.fn(text => text)
    }));
    
    StateManager.mockImplementation(() => ({
      resetState: jest.fn(),
      getStateStatistics: jest.fn(() => ({ currentView: 'session_list' }))
    }));
    
    ViewRenderer.mockImplementation(() => ({
      render: jest.fn()
    }));
    
    InputHandler.mockImplementation(() => ({
      cleanup: jest.fn()
    }));
    
    // Create app instance
    app = new CCScopeApplication();
  });

  afterEach(() => {
    // Restore all mocks
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleClear.mockRestore();
    mockProcessExit.mockRestore();
    mockProcessOn.mockRestore();
    mockStdoutWrite.mockRestore();
  });

  describe('constructor', () => {
    test('initializes with correct defaults', () => {
      expect(app.isInitialized).toBe(false);
      expect(app.isRunning).toBe(false);
      expect(app.sessionManager).toBeDefined();
      expect(app.themeManager).toBeDefined();
      expect(app.stateManager).toBeDefined();
      expect(app.viewRenderer).toBeDefined();
      expect(app.inputHandler).toBeDefined();
    });

    test('sets up error handlers', () => {
      expect(mockProcessOn).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(mockProcessOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });
  });

  describe('initialize', () => {
    test('initializes application successfully', async () => {
      await app.initialize();
      
      expect(mockConsoleLog).toHaveBeenCalledWith('🚀 Starting CCScope...');
      expect(mockConsoleClear).toHaveBeenCalled();
      expect(app.sessionManager.discoverSessions).toHaveBeenCalled();
      expect(app.themeManager.setTheme).toHaveBeenCalledWith('default');
      expect(app.stateManager.resetState).toHaveBeenCalled();
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x1b[?25l');
      expect(app.isInitialized).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Claude Code Scope initialized successfully');
    });

    test('skips initialization if already initialized', async () => {
      app.isInitialized = true;
      await app.initialize();
      
      expect(mockConsoleLog).not.toHaveBeenCalledWith('🚀 Starting CCScope...');
      expect(app.sessionManager.discoverSessions).not.toHaveBeenCalled();
    });

    test('handles initialization errors', async () => {
      const error = new Error('Initialization failed');
      app.sessionManager.discoverSessions.mockRejectedValue(error);
      
      await app.initialize();
      
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to initialize Claude Code Scope:', error);
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('showLoadingScreen', () => {
    test('displays loading screen', () => {
      app.showLoadingScreen();
      
      expect(mockConsoleClear).toHaveBeenCalled();
      expect(mockStdoutWrite).toHaveBeenCalledWith('🔍 Claude Code Scope - Loading... ');
    });
  });

  describe('start', () => {
    test('starts application successfully', async () => {
      // Mock methods
      app.showWelcomeMessage = jest.fn();
      app.startRenderLoop = jest.fn();
      
      await app.start();
      
      expect(app.isRunning).toBe(true);
      expect(app.showWelcomeMessage).toHaveBeenCalled();
      expect(app.startRenderLoop).toHaveBeenCalled();
    });

    test('initializes if not already initialized', async () => {
      app.initialize = jest.fn().mockResolvedValue();
      app.showWelcomeMessage = jest.fn();
      app.startRenderLoop = jest.fn();
      
      await app.start();
      
      expect(app.initialize).toHaveBeenCalled();
    });

    test('skips if already running', async () => {
      app.isRunning = true;
      app.showWelcomeMessage = jest.fn();
      app.startRenderLoop = jest.fn();
      
      await app.start();
      
      expect(app.showWelcomeMessage).not.toHaveBeenCalled();
    });

    test('handles start errors', async () => {
      const error = new Error('Start failed');
      app.showWelcomeMessage = jest.fn().mockImplementation(() => {
        throw error;
      });
      app.handleError = jest.fn();
      
      await app.start();
      
      expect(app.handleError).toHaveBeenCalledWith(error);
    });
  });

  describe('showWelcomeMessage', () => {
    test('displays welcome message', () => {
      app.showWelcomeMessage();
      
      expect(mockConsoleClear).toHaveBeenCalled();
      expect(mockConsoleLog).toHaveBeenCalledWith('🎉 Welcome to Claude Code Scope');
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Ready: 10 sessions, 50 conversations');
      expect(app.viewRenderer.render).toHaveBeenCalled();
    });
  });

  describe('startRenderLoop', () => {
    test('starts render loop', () => {
      app.startRenderLoop();
      
      expect(app.viewRenderer.render).toHaveBeenCalled();
    });
  });

  describe('handleExit', () => {
    test('handles exit gracefully', () => {
      app.inputHandler.cleanup = jest.fn();
      app.handleExit();
      
      expect(mockConsoleLog).toHaveBeenCalledWith('\\n');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Shutting down'));
      expect(app.inputHandler.cleanup).toHaveBeenCalled();
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x1b[?25h');
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x1b[0m');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  describe('handleError', () => {
    test('handles errors', () => {
      const error = new Error('Test error');
      app.handleExit = jest.fn();
      
      app.handleError(error);
      
      expect(mockConsoleError).toHaveBeenCalledWith('\\n❌ Application Error:', error);
      expect(app.handleExit).toHaveBeenCalled();
    });
    
    test('shows stack trace in debug mode', () => {
      const error = new Error('Test error');
      error.stack = 'Test stack';
      app.handleExit = jest.fn();
      const config = require('../src/config');
      config.debug.enabled = true;
      
      app.handleError(error);
      
      expect(mockConsoleError).toHaveBeenCalledWith('Stack trace:', error.stack);
    });
  });

  describe('getStatistics', () => {
    test('returns application statistics', () => {
      const stats = app.getStatistics();
      
      expect(stats.session).toEqual({ totalSessions: 10, totalConversations: 50 });
      expect(stats.state).toEqual({ currentView: 'session_list' });
      expect(stats.runtime.isInitialized).toBe(false);
      expect(stats.runtime.isRunning).toBe(false);
      expect(stats.runtime.uptime).toBeDefined();
      expect(stats.runtime.memoryUsage).toBeDefined();
    });
  });
  
  describe('enableDebug', () => {
    test('enables debug mode', () => {
      const config = require('../src/config');
      config.debug.enabled = false;
      
      app.enableDebug();
      
      expect(config.debug.enabled).toBe(true);
      expect(config.debug.showTimings).toBe(true);
      expect(config.debug.showMemoryUsage).toBe(true);
      expect(mockConsoleLog).toHaveBeenCalledWith('🐛 Debug mode enabled');
    });
  });

  describe('run', () => {
    test('runs the application', async () => {
      // Mock the static run method
      CCScopeApplication.run = jest.fn(async () => {
        const app = new CCScopeApplication();
        await app.start();
      });
      
      await CCScopeApplication.run();
      
      expect(CCScopeApplication.run).toHaveBeenCalled();
    });
  });
});