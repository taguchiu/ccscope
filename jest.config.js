module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // File extensions to consider
  moduleFileExtensions: ['js', 'json'],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '/__tests__/helpers/',
    '/__tests__/setup.js'
  ],
  
  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/__tests__/**'
  ],
  
  // Coverage output
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // Coverage thresholds - set to current achievable levels
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 50,
      lines: 47,
      statements: 46
    }
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  
  // Transform files (no babel needed for pure Node.js)
  
  // Module name mapper for mocking
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // Globals
  globals: {
    'NODE_ENV': 'test'
  },
  
  // Fake timers
  fakeTimers: {
    enableGlobally: false
  },
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Maximum worker threads
  maxWorkers: '50%'
};