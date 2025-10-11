/**
 * E2E Test Setup
 * Configures environment variables for testing with separate test database
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5434';
process.env.DATABASE_USERNAME = 'library_service';
process.env.DATABASE_PASSWORD = 'library_password';
process.env.DATABASE_NAME = 'library_db';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = 'redis_password';
process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-only';

// External services for testing - use running services
process.env.GAMES_CATALOG_SERVICE_URL = 'http://localhost:3002';
process.env.USER_SERVICE_URL = 'http://localhost:3001';
process.env.PAYMENT_SERVICE_URL = 'http://localhost:3005';

// Disable Kafka for tests
process.env.KAFKA_ENABLED = 'false';

// Set shorter timeouts for tests
process.env.HTTP_TIMEOUT = '1000';
process.env.CACHE_TTL = '60';

// Basic debug to verify env values in CI/local

console.log('[e2e] E2E Test environment configured');

console.log(
  '[e2e] DB',
  process.env.DATABASE_HOST,
  process.env.DATABASE_PORT,
  process.env.DATABASE_USERNAME,
  process.env.DATABASE_PASSWORD,
  process.env.DATABASE_NAME,
);
