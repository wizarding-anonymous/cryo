// Jest setup for E2E tests
require('dotenv').config({ path: './test/test.env' });

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_TYPE = 'sqlite';
process.env.DATABASE_DATABASE = ':memory:';
process.env.DATABASE_SYNCHRONIZE = 'true';
process.env.DATABASE_LOGGING = 'false';

// Mock external HTTP calls by default
global.fetch = jest.fn();

// Increase timeout for database operations
jest.setTimeout(30000);