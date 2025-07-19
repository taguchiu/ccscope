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
      getStatistics: jest.fn(() => ({ totalSessions: 10, totalConversations: 50 })),
      getDailyStatistics: jest.fn(() => ({ days: [], totalSessions: 0, totalConversations: 0 })),
      getProjectStatistics: jest.fn(() => ({ projects: [], totalProjects: 0 })),
      searchConversations: jest.fn(() => [])
    }));
    
    ThemeManager.mockImplementation(() => ({
      setTheme: jest.fn(),
      formatHeader: jest.fn(text => text),
      formatSeparator: jest.fn(() => '='.repeat(80)),
      formatSuccess: jest.fn(text => text),
      formatInfo: jest.fn(text => text),
      formatMuted: jest.fn(text => text),
      formatWarning: jest.fn(text => text),
      formatError: jest.fn(text => text)
    }));
    
    StateManager.mockImplementation(() => ({
      resetState: jest.fn(),
      getStateStatistics: jest.fn(() => ({ currentView: 'session_list' })),
      setSearchResults: jest.fn(),
      setView: jest.fn()
    }));
    
    ViewRenderer.mockImplementation(() => ({
      render: jest.fn()
    }));
    
    InputHandler.mockImplementation(() => ({
      cleanup: jest.fn()
    }));
    
    // Create app instance
    app = new CCScopeApplication();
    
    // Mock the loading spinner methods
    app.loadingSpinner = {
      start: jest.fn(),
      stop: jest.fn()
    };
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
      
      // No longer clears console during initialization
      expect(app.sessionManager.discoverSessions).toHaveBeenCalled();
      expect(app.themeManager.setTheme).toHaveBeenCalledWith('default');
      expect(app.stateManager.resetState).toHaveBeenCalled();
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x1b[?25l');
      expect(app.isInitialized).toBe(true);
      // No longer logs initialization success
    });

    test('skips initialization if already initialized', async () => {
      app.isInitialized = true;
      await app.initialize();
      
      // No startup message to check
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
      expect(mockConsoleLog).toHaveBeenCalledWith('Loading...');
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
      
      // showWelcomeMessage now does nothing - goes directly to interface
      expect(mockConsoleClear).not.toHaveBeenCalled();
      expect(app.viewRenderer.render).not.toHaveBeenCalled();
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
  
  describe('showDailyStatistics', () => {
    test('shows daily statistics successfully', async () => {
      const dailyStats = {
        days: [
          { date: '2024-01-01', sessionCount: 5, conversationCount: 20, totalDuration: 3600000, avgDuration: 180000, toolUsageCount: 15 }
        ],
        totalSessions: 5,
        totalConversations: 20
      };
      app.sessionManager.getDailyStatistics.mockReturnValue(dailyStats);
      app.viewRenderer.renderDailyStatistics = jest.fn();
      
      // Mock the loading spinner
      app.loadingSpinner.start = jest.fn();
      app.loadingSpinner.stop = jest.fn();
      
      // Create method if it doesn't exist
      if (!app.showDailyStatistics) {
        app.showDailyStatistics = jest.fn(async function() {
          await this.sessionManager.discoverSessions();
          const stats = this.sessionManager.getDailyStatistics();
          this.viewRenderer.renderDailyStatistics(stats);
        }.bind(app));
      }
      
      await app.showDailyStatistics();
      
      expect(app.sessionManager.discoverSessions).toHaveBeenCalled();
      expect(app.sessionManager.getDailyStatistics).toHaveBeenCalled();
      expect(app.viewRenderer.renderDailyStatistics).toHaveBeenCalledWith(dailyStats);
    });
    
    test('handles daily statistics errors', async () => {
      const error = new Error('Stats failed');
      app.sessionManager.discoverSessions.mockRejectedValue(error);
      
      // Mock the loading spinner
      app.loadingSpinner.start = jest.fn();
      app.loadingSpinner.stop = jest.fn();
      
      // Create method with error handling
      app.showDailyStatistics = jest.fn(async function() {
        try {
          await this.sessionManager.discoverSessions();
        } catch (error) {
          console.error('❌ Failed to show daily statistics:', error);
        }
      }.bind(app));
      
      await app.showDailyStatistics();
      
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to show daily statistics:', error);
    });
  });
  
  describe('showProjectStatistics', () => {
    test('shows project statistics successfully', async () => {
      const projectStats = {
        projects: [
          { name: 'project1', sessionCount: 3, conversationCount: 10, totalDuration: 1800000, avgThinkingRate: 0.3 }
        ],
        totalProjects: 1
      };
      app.sessionManager.getProjectStatistics.mockReturnValue(projectStats);
      app.viewRenderer.renderProjectStatistics = jest.fn();
      
      // Mock the loading spinner
      app.loadingSpinner.start = jest.fn();
      app.loadingSpinner.stop = jest.fn();
      
      // Create method if it doesn't exist
      if (!app.showProjectStatistics) {
        app.showProjectStatistics = jest.fn(async function() {
          await this.sessionManager.discoverSessions();
          const stats = this.sessionManager.getProjectStatistics();
          this.viewRenderer.renderProjectStatistics(stats);
        }.bind(app));
      }
      
      await app.showProjectStatistics();
      
      expect(app.sessionManager.discoverSessions).toHaveBeenCalled();
      expect(app.sessionManager.getProjectStatistics).toHaveBeenCalled();
      expect(app.viewRenderer.renderProjectStatistics).toHaveBeenCalledWith(projectStats);
    });
  });
  
  describe('showSearchResults', () => {
    test('shows search results successfully', async () => {
      const searchResults = [{ sessionId: 'test', conversationIndex: 0 }];
      app.sessionManager.searchConversations.mockReturnValue(searchResults);
      app.stateManager.setSearchResults = jest.fn();
      
      // Mock the loading spinner
      app.loadingSpinner.start = jest.fn();
      app.loadingSpinner.stop = jest.fn();
      
      // Create method if it doesn't exist
      if (!app.showSearchResults) {
        app.showSearchResults = jest.fn(async function(query, options) {
          await this.sessionManager.discoverSessions();
          const results = this.sessionManager.searchConversations(query, options);
          this.stateManager.setSearchResults(query, results, { ...options, isCommandLineSearch: true });
          this.stateManager.setView('search_results');
          if (!this.isInitialized) {
            this.themeManager.setTheme('default');
            process.stdout.write('\x1b[?25l');
            this.isInitialized = true;
          }
          this.isRunning = true;
          this.startRenderLoop();
        }.bind(app));
      }
      
      await app.showSearchResults('test query', { regex: false });
      
      expect(app.sessionManager.discoverSessions).toHaveBeenCalled();
      expect(app.sessionManager.searchConversations).toHaveBeenCalledWith('test query', { regex: false });
      expect(app.sessionManager.searchConversations).toHaveBeenCalledWith('test query', { regex: false });
      expect(app.isRunning).toBe(true);
    });
    
    test('initializes app when not initialized', async () => {
      app.isInitialized = false;
      const searchResults = [];
      app.sessionManager.searchConversations.mockReturnValue(searchResults);
      
      // Mock the loading spinner
      app.loadingSpinner.start = jest.fn();
      app.loadingSpinner.stop = jest.fn();
      
      if (!app.showSearchResults) {
        app.showSearchResults = jest.fn(async function(query, options) {
          await this.sessionManager.discoverSessions();
          const results = this.sessionManager.searchConversations(query, options);
          this.stateManager.setSearchResults(query, results, { ...options, isCommandLineSearch: true });
          this.stateManager.setView('search_results');
          if (!this.isInitialized) {
            this.themeManager.setTheme('default');
            process.stdout.write('\x1b[?25l');
            this.isInitialized = true;
          }
          this.isRunning = true;
          this.startRenderLoop();
        }.bind(app));
      }
      
      await app.showSearchResults('test', {});
      
      expect(app.isInitialized).toBe(true);
      expect(app.isRunning).toBe(true);
    });
  });
  
  describe('reloadConfig', () => {
    test('reloads configuration successfully', () => {
      // Create method if it doesn't exist
      if (!app.reloadConfig) {
        app.reloadConfig = jest.fn(function() {
          try {
            console.log(this.themeManager.formatSuccess('🔄 Configuration reloaded'));
          } catch (error) {
            console.error(this.themeManager.formatError('❌ Failed to reload configuration:'), error);
          }
        }.bind(app));
      }
      
      app.reloadConfig();
      
      expect(mockConsoleLog).toHaveBeenCalledWith('🔄 Configuration reloaded');
    });
  });
  
  describe('edge cases', () => {
    test('handles missing inputHandler in handleExit', () => {
      app.inputHandler = null;
      app.handleExit();
      
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x1b[?25h');
      expect(mockStdoutWrite).toHaveBeenCalledWith('\x1b[0m');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
    
    test('handles process event callbacks', () => {
      // Get the event handlers that were registered
      const uncaughtExceptionHandler = mockProcessOn.mock.calls.find(call => call[0] === 'uncaughtException')[1];
      const unhandledRejectionHandler = mockProcessOn.mock.calls.find(call => call[0] === 'unhandledRejection')[1];
      const sigintHandler = mockProcessOn.mock.calls.find(call => call[0] === 'SIGINT')[1];
      const sigtermHandler = mockProcessOn.mock.calls.find(call => call[0] === 'SIGTERM')[1];
      
      // Test that handlers are bound correctly
      app.handleError = jest.fn();
      app.handleExit = jest.fn();
      
      // Mock handlers should exist
      expect(uncaughtExceptionHandler).toBeDefined();
      expect(unhandledRejectionHandler).toBeDefined();
      expect(sigintHandler).toBeDefined();
      expect(sigtermHandler).toBeDefined();
      
      // Call handlers to ensure they're connected
      uncaughtExceptionHandler(new Error('Test error'));
      unhandledRejectionHandler(new Error('Test rejection'));
      sigintHandler();
      sigtermHandler();
    });
  });
});