/**
 * E2E Test Setup
 * Configures environment variables for testing with separate test database
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = '127.0.0.1';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_USERNAME = 'postgres';
process.env.DATABASE_PASSWORD = 'password';
process.env.DATABASE_NAME = 'library_service_test';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = '6380';
process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-only';

// Mock external services for testing - match configuration.ts env names
process.env.GAMES_CATALOG_SERVICE_URL = 'http://localhost:3011';
process.env.USER_SERVICE_URL = 'http://localhost:3012';
process.env.PAYMENT_SERVICE_URL = 'http://localhost:3013';

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
