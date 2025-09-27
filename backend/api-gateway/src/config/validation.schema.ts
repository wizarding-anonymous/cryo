import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3001),

  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().integer().min(0).default(0),
  REDIS_KEY_PREFIX: Joi.string().default('cryo:gateway:'),

  SERVICE_DEFAULT_TIMEOUT_MS: Joi.number().integer().min(100).default(5000),
  SERVICE_DEFAULT_RETRIES: Joi.number().integer().min(0).default(1),

  SERVICE_USER_BASE_URL: Joi.string().uri().default('http://localhost:3000'),
  SERVICE_GAME_CATALOG_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3002'),
  SERVICE_PAYMENT_BASE_URL: Joi.string().uri().default('http://localhost:3003'),
  SERVICE_LIBRARY_BASE_URL: Joi.string().uri().default('http://localhost:3004'),
  SERVICE_NOTIFICATION_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3005'),
  SERVICE_REVIEW_BASE_URL: Joi.string().uri().default('http://localhost:3006'),
  SERVICE_ACHIEVEMENT_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3007'),
  SERVICE_SECURITY_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3008'),
  SERVICE_SOCIAL_BASE_URL: Joi.string().uri().default('http://localhost:3009'),
  SERVICE_DOWNLOAD_BASE_URL: Joi.string()
    .uri()
    .default('http://localhost:3010'),

  // Rate limiting
  RATE_LIMIT_ENABLED: Joi.boolean().default(true),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_SKIP_SUCCESS: Joi.boolean().default(false),
  RATE_LIMIT_SKIP_FAILED: Joi.boolean().default(false),

  // Response caching
  CACHE_ENABLED: Joi.boolean().default(true),
  CACHE_TTL_MS: Joi.number().integer().min(1000).default(30000),

  // CORS
  CORS_ENABLED: Joi.boolean().default(true),
  CORS_ORIGIN: Joi.string().default('*'),
  CORS_METHODS: Joi.string().default('GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS'),
  CORS_HEADERS: Joi.string().default('Content-Type, Authorization'),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'log', 'debug', 'verbose')
    .default('log'),

  // Health Check Configuration
  HEALTH_CHECK_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),
  HEALTH_CHECK_RETRIES: Joi.number().integer().min(1).default(3),

  // Circuit Breaker Configuration
  CIRCUIT_BREAKER_FAILURE_THRESHOLD: Joi.number().integer().min(1).default(5),
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(60000),
  CIRCUIT_BREAKER_MONITORING_PERIOD_MS: Joi.number()
    .integer()
    .min(1000)
    .default(10000),
});
