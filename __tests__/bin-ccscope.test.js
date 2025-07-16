const path = require('path');

// Mock modules before requiring the script
jest.mock('../../src/CCScope');
jest.mock('../../package.json', () => ({
  version: '1.2.2'
}));

describe('ccscope CLI', () => {
  let mockConsoleLog;
  let mockConsoleError;
  let mockProcessExit;
  let mockArgv;
  let CCScopeApplication;
  
  beforeEach(() => {
    // Reset modules
    jest.resetModules();
    
    // Mock console
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    
    // Store original argv
    mockArgv = process.argv;
    
    // Mock CCScopeApplication
    CCScopeApplication = require('../../src/CCScope');
    CCScopeApplication.mockClear();
    CCScopeApplication.mockImplementation(() => ({
      enableDebug: jest.fn(),
      start: jest.fn().mockResolvedValue(),
      showDailyStatistics: jest.fn().mockResolvedValue(),
      showProjectStatistics: jest.fn().mockResolvedValue(),
      showSearchResults: jest.fn().mockResolvedValue()
    }));
  });
  
  afterEach(() => {
    // Restore mocks
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
    process.argv = mockArgv;
  });
  
  describe('parseArguments', () => {
    test('shows version with --version flag', () => {
      process.argv = ['node', 'ccscope', '--version'];
      
      // Require the module to trigger execution
      require('../../bin/ccscope');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('CCScope v1.2.2');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
    
    test('shows version with -v flag', () => {
      process.argv = ['node', 'ccscope', '-v'];
      
      require('../../bin/ccscope');
      
      expect(mockConsoleLog).toHaveBeenCalledWith('CCScope v1.2.2');
      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
    
    test('parses daily command', async () => {
      process.argv = ['node', 'ccscope', 'daily'];
      
      // Mock require.main to simulate direct execution
      const originalMain = require.main;
      require.main = module;
      
      // Load the module
      require('../../bin/ccscope');
      
      // Wait for async operations
      await new Promise(resolve => setImmediate(resolve));
      
      expect(CCScopeApplication).toHaveBeenCalled();
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.showDailyStatistics).toHaveBeenCalled();
      
      require.main = originalMain;
    });
    
    test('parses project command', async () => {
      process.argv = ['node', 'ccscope', 'project'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(CCScopeApplication).toHaveBeenCalled();
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.showProjectStatistics).toHaveBeenCalled();
      
      require.main = originalMain;
    });
    
    test('parses search command with query', async () => {
      process.argv = ['node', 'ccscope', 'search', 'test', 'query'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(CCScopeApplication).toHaveBeenCalled();
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.showSearchResults).toHaveBeenCalledWith('test query', { regex: false });
      
      require.main = originalMain;
    });
    
    test('parses search command with regex option', async () => {
      process.argv = ['node', 'ccscope', 'search', '--regex', 'test.*pattern'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(CCScopeApplication).toHaveBeenCalled();
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.showSearchResults).toHaveBeenCalledWith('test.*pattern', { regex: true });
      
      require.main = originalMain;
    });
    
    test('shows error for search without query', async () => {
      process.argv = ['node', 'ccscope', 'search'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Search query is required');
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      
      require.main = originalMain;
    });
    
    test('enables debug mode', async () => {
      process.argv = ['node', 'ccscope', '--debug'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(CCScopeApplication).toHaveBeenCalled();
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.enableDebug).toHaveBeenCalled();
      expect(appInstance.start).toHaveBeenCalled();
      
      require.main = originalMain;
    });
    
    test('starts interactive mode by default', async () => {
      process.argv = ['node', 'ccscope'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(CCScopeApplication).toHaveBeenCalled();
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.start).toHaveBeenCalled();
      
      require.main = originalMain;
    });
    
    test('shows help with --help flag', () => {
      process.argv = ['node', 'ccscope', '--help'];
      
      require('../../bin/ccscope');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('CCScope (Claude Code Scope)'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('USAGE:'));
    });
    
    test('shows command help with command --help', () => {
      process.argv = ['node', 'ccscope', 'daily', '--help'];
      
      require('../../bin/ccscope');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('CCScope daily'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Show daily conversation statistics'));
    });
    
    test('handles errors gracefully', async () => {
      process.argv = ['node', 'ccscope'];
      
      // Mock app to throw error
      CCScopeApplication.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      expect(mockConsoleError).toHaveBeenCalledWith('❌ Failed to start CCScope:', expect.any(Error));
      expect(mockProcessExit).toHaveBeenCalledWith(1);
      
      require.main = originalMain;
    });
  });
  
  describe('help messages', () => {
    test('shows project help', () => {
      process.argv = ['node', 'ccscope', 'project', '--help'];
      
      require('../../bin/ccscope');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('CCScope project'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Show project statistics'));
    });
    
    test('shows search help', () => {
      process.argv = ['node', 'ccscope', 'search', '--help'];
      
      require('../../bin/ccscope');
      
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('CCScope search'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Search conversations by text content'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Supports OR conditions'));
    });
  });
  
  describe('edge cases', () => {
    test('handles multiple queries in search', async () => {
      process.argv = ['node', 'ccscope', 'search', 'multiple', 'word', 'query'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.showSearchResults).toHaveBeenCalledWith('multiple word query', { regex: false });
      
      require.main = originalMain;
    });
    
    test('ignores unknown options', async () => {
      process.argv = ['node', 'ccscope', '--unknown-option'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.start).toHaveBeenCalled();
      
      require.main = originalMain;
    });
    
    test('handles debug short flag', async () => {
      process.argv = ['node', 'ccscope', '-d'];
      
      const originalMain = require.main;
      require.main = module;
      
      require('../../bin/ccscope');
      
      await new Promise(resolve => setImmediate(resolve));
      
      const appInstance = CCScopeApplication.mock.results[0].value;
      expect(appInstance.enableDebug).toHaveBeenCalled();
      
      require.main = originalMain;
    });
  });
});