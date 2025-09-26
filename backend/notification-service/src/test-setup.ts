// Global test setup

// Increase timeout for all tests
jest.setTimeout(30000);

// Mock console methods to reduce noise in test output (but keep error for debugging)
const originalConsole = global.console;
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep errors for debugging
};

// Set test environment variables
process.env.NODE_ENV = 'test';

// Test Database Configuration
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = '5437'; // Test database port
process.env.DB_USERNAME = process.env.DB_USERNAME || 'notification_test_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'notification_test_password';
process.env.DB_DATABASE = process.env.DB_DATABASE || 'notification_test_db';
process.env.DB_SYNCHRONIZE = 'true'; // Auto-sync for tests
process.env.DB_DROP_SCHEMA = 'true'; // Clean schema for each test run

// Test Redis Configuration
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = '6381'; // Test Redis port
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD || '';

// Auth Configuration
process.env.JWT_SECRET = 'test-secret-key-for-notification-service';

// Email Configuration (Mock)
process.env.EMAIL_PROVIDER = 'generic';
process.env.EMAIL_URL = 'http://localhost:1025'; // MailHog SMTP
process.env.EMAIL_API_KEY = 'test-api-key';
process.env.EMAIL_FROM = 'test@notification-service.test';
process.env.EMAIL_MAX_RETRIES = '2';
process.env.EMAIL_RETRY_DELAY = '100';

// External Services (Mock)
process.env.USER_SERVICE_URL = 'http://localhost:3001';

// Cache Configuration
process.env.CACHE_TTL = '300'; // 5 minutes for tests

// Logging Configuration
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests

// Performance Configuration for Tests
process.env.BULK_NOTIFICATION_BATCH_SIZE = '10'; // Smaller batches for tests

// Global test utilities
(global as any).testUtils = {
  // Helper to wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Helper to generate test UUIDs
  generateTestId: () => `test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,

  // Helper to create test dates
  createTestDate: (offsetMs = 0) => new Date(Date.now() + offsetMs),

  // Helper to reset all mocks
  resetAllMocks: () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  },
};

// Setup global error handlers for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Declare global types for TypeScript
declare global {
  var testUtils: {
    waitFor: (ms: number) => Promise<void>;
    generateTestId: () => string;
    createTestDate: (offsetMs?: number) => Date;
    resetAllMocks: () => void;
  };
}

// Cleanup function for tests
afterEach(() => {
  // Reset all mocks after each test
  jest.clearAllMocks();
});

// Global cleanup
afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});

// Export to make this an external module (required for global augmentation)
export { };
