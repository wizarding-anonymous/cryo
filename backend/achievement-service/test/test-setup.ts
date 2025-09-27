// Global test setup for e2e tests
import { config } from 'dotenv';
import { TestDatabaseSetup } from './test-database-setup';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for database operations
jest.setTimeout(60000); // Increased for integration tests

// Global test configuration
beforeAll(async () => {
  // Ensure test database is ready
  try {
    await TestDatabaseSetup.waitForDatabase();
    console.log('Test database setup completed');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
});

afterAll(async () => {
  // Global cleanup
  try {
    await TestDatabaseSetup.closeTestDatabase();
    console.log('Test database cleanup completed');
  } catch (error) {
    console.warn('Test database cleanup failed:', error);
  }
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions in tests
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
});
