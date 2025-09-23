// Jest setup file for global test configuration

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.LIBRARY_SERVICE_URL = 'http://library-service:3000';
process.env.GAME_CATALOG_SERVICE_URL = 'http://game-catalog-service:3000';
process.env.PAYMENT_MODE = 'simulation';
process.env.PAYMENT_AUTO_APPROVE = 'true';
process.env.PAYMENT_DELAY_MS = '100';
process.env.PAYMENT_SUCCESS_RATE = '0.95';

// Increase timeout for integration tests
jest.setTimeout(15000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
