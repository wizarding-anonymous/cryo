/**
 * E2E Test Setup
 * Configures environment variables for testing with separate test database
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_HOST = 'localhost';
process.env.DATABASE_PORT = '5433';
process.env.DATABASE_USERNAME = 'postgres';
process.env.DATABASE_PASSWORD = 'test_password';
process.env.DATABASE_NAME = 'library_service_test';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6380';
process.env.JWT_SECRET = 'test-secret-key-for-e2e-tests-only';

// Mock external services for testing
process.env.SERVICES_GAMES_CATALOG_URL = 'http://localhost:3011';
process.env.SERVICES_USER_SERVICE_URL = 'http://localhost:3012';
process.env.SERVICES_PAYMENT_SERVICE_URL = 'http://localhost:3013';

// Disable Kafka for tests
process.env.KAFKA_ENABLED = 'false';

// Set shorter timeouts for tests
process.env.HTTP_TIMEOUT = '1000';
process.env.CACHE_TTL = '60';

console.log('🧪 E2E Test environment configured');