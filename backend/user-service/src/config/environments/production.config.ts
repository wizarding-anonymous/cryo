import { EnvironmentVariables } from '../env.validation';

export const productionConfig: Partial<EnvironmentVariables> = {
  NODE_ENV: 'production',
  PORT: 3001,

  // Logging - structured and less verbose in production
  LOG_LEVEL: 'info',
  LOG_FORMAT: 'json',

  // Database - optimized for production load
  POSTGRES_MAX_CONNECTIONS: 20,
  POSTGRES_CONNECTION_TIMEOUT: 30000,

  // Redis - production settings with retries
  REDIS_MAX_RETRIES: 5,
  REDIS_RETRY_DELAY: 2000,

  // Rate limiting - strict in production
  THROTTLE_TTL: 60000, // 1 minute
  THROTTLE_LIMIT: 60, // 60 requests per minute

  // Health check - reasonable timeout for production
  HEALTH_CHECK_TIMEOUT: 5000,

  // Metrics
  METRICS_ENABLED: true,
  METRICS_PORT: 9090,

  // CORS - restrictive for production (should be overridden by env vars)
  CORS_ORIGIN: 'https://yourdomain.com',
  CORS_CREDENTIALS: true,

  // Security - strict for production
  HELMET_ENABLED: true,
  RATE_LIMIT_ENABLED: true,
};
