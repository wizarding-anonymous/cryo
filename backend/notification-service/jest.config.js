module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // Root directory for tests
  rootDir: 'src',
  
  // Test file patterns
  testRegex: '.*\\.spec\\.ts$',
  
  // Transform configuration
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.e2e-spec.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.d.ts',
    '!**/main.ts',
    '!**/test-setup.ts',
    '!**/__mocks__/**',
  ],
  
  // Coverage directory
  coverageDirectory: '../coverage',
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
  ],
  
  // Coverage thresholds for 100% coverage requirement
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  
  // Test timeout
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/test-setup.ts'],
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output for debugging
  verbose: false,
  
  // Maximum number of concurrent workers
  maxWorkers: '50%',
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/',
  ],
  
  // Preset for ts-jest
  preset: 'ts-jest',
};