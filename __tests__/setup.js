// Jest setup file
// Configure test environment before running tests

// Set test environment
process.env.NODE_ENV = 'test';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  clear: jest.fn()
};

// Mock process.stdout and process.stdin
if (!process.stdout.columns) {
  process.stdout.columns = 80;
}
if (!process.stdout.rows) {
  process.stdout.rows = 24;
}

// Global test utilities
global.testUtils = {
  // Wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Flush promises
  flushPromises: () => new Promise(resolve => setImmediate(resolve)),
  
  // Mock terminal dimensions
  setTerminalSize: (width, height) => {
    process.stdout.columns = width;
    process.stdout.rows = height;
  }
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Increase test timeout for slower operations
jest.setTimeout(10000);