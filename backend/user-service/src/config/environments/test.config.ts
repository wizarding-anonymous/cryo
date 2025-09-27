import { EnvironmentVariables } from '../env.validation';

export const testConfig: Partial<EnvironmentVariables> = {
  NODE_ENV: 'test',
  PORT: 3001,

  // Logging - minimal in test environment
  LOG_LEVEL: 'error',
  LOG_FORMAT: 'simple',

  // Database - minimal connections for testing
  POSTGRES_MAX_CONNECTIONS: 3,
  POSTGRES_CONNECTION_TIMEOUT: 5000,

  // Redis - test settings
  REDIS_MAX_RETRIES: 1,
  REDIS_RETRY_DELAY: 500,

  // JWT - test-friendly settings
  JWT_EXPIRES_IN: '1h',
  JWT_REFRESH_EXPIRES_IN: '24h',

  // Rate limiting - disabled for testing
  THROTTLE_TTL: 60000,
  THROTTLE_LIMIT: 1000, // Very high limit for tests

  // Health check - fast timeout for tests
  HEALTH_CHECK_TIMEOUT: 2000,

  // Metrics - disabled in tests
  METRICS_ENABLED: false,
  METRICS_PORT: 9091, // Different port to avoid conflicts

  // CORS - permissive for testing
  CORS_ORIGIN: '*',
  CORS_CREDENTIALS: true,

  // Security - relaxed for testing
  HELMET_ENABLED: false,
  RATE_LIMIT_ENABLED: false,
};
