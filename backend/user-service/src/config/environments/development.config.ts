import { EnvironmentVariables } from '../env.validation';

export const developmentConfig: Partial<EnvironmentVariables> = {
  NODE_ENV: 'development',
  PORT: 3001,

  // Logging - more verbose in development
  LOG_LEVEL: 'debug',
  LOG_FORMAT: 'simple',

  // Database - optimized for development
  POSTGRES_MAX_CONNECTIONS: 5,
  POSTGRES_CONNECTION_TIMEOUT: 10000,

  // Redis - development settings
  REDIS_MAX_RETRIES: 3,
  REDIS_RETRY_DELAY: 1000,

  // Rate limiting - more lenient in development
  THROTTLE_TTL: 60000, // 1 minute
  THROTTLE_LIMIT: 100, // 100 requests per minute

  // Health check - shorter timeout for faster feedback
  HEALTH_CHECK_TIMEOUT: 3000,

  // Metrics
  METRICS_ENABLED: true,
  METRICS_PORT: 9090,

  // CORS - permissive for development
  CORS_ORIGIN: '*',
  CORS_CREDENTIALS: true,

  // Security - relaxed for development
  HELMET_ENABLED: true,
  RATE_LIMIT_ENABLED: true,
};
