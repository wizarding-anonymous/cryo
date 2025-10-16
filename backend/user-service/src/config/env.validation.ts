import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3001),

  // Service Discovery
  SERVICE_NAME: Joi.string().default('user-service'),
  SERVICE_VERSION: Joi.string().default('1.0.0'),

  // Database
  POSTGRES_HOST: Joi.string().required(),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_USER: Joi.string().required(),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DB: Joi.string().required(),

  // Database Connection Pool
  POSTGRES_MAX_CONNECTIONS: Joi.number().min(1).max(100).default(10),
  POSTGRES_CONNECTION_TIMEOUT: Joi.number().min(1000).default(30000),

  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().min(0).max(15).default(0),

  // Redis Connection
  REDIS_MAX_RETRIES: Joi.number().min(0).default(3),
  REDIS_RETRY_DELAY: Joi.number().min(100).default(1000),

  // Query Cache Configuration
  QUERY_CACHE_ENABLED: Joi.boolean().default(true),
  QUERY_CACHE_TTL: Joi.number().min(30).default(300), // 5 minutes default
  QUERY_CACHE_MAX_SIZE: Joi.number().min(100).default(10000),
  SLOW_QUERY_THRESHOLD: Joi.number().min(100).default(1000), // 1 second

  // Rate Limiting
  THROTTLE_TTL: Joi.number().min(1000).default(60000), // 1 minute
  THROTTLE_LIMIT: Joi.number().min(1).default(60), // 60 requests per minute
  
  // Advanced Rate Limiting
  RATE_LIMIT_DEFAULT_TTL: Joi.number().min(1000).default(60000), // 1 minute
  RATE_LIMIT_DEFAULT_LIMIT: Joi.number().min(1).default(60), // 60 requests per minute
  RATE_LIMIT_BATCH_TTL: Joi.number().min(1000).default(300000), // 5 minutes
  RATE_LIMIT_BATCH_LIMIT: Joi.number().min(1).default(10), // 10 batch operations per 5 minutes
  RATE_LIMIT_PROFILE_TTL: Joi.number().min(1000).default(60000), // 1 minute
  RATE_LIMIT_PROFILE_LIMIT: Joi.number().min(1).default(30), // 30 profile operations per minute
  RATE_LIMIT_INTERNAL_TTL: Joi.number().min(1000).default(60000), // 1 minute
  RATE_LIMIT_INTERNAL_LIMIT: Joi.number().min(1).default(1000), // 1000 internal requests per minute
  RATE_LIMIT_UPLOAD_TTL: Joi.number().min(1000).default(60000), // 1 minute
  RATE_LIMIT_UPLOAD_LIMIT: Joi.number().min(1).default(5), // 5 uploads per minute
  RATE_LIMIT_SEARCH_TTL: Joi.number().min(1000).default(60000), // 1 minute
  RATE_LIMIT_SEARCH_LIMIT: Joi.number().min(1).default(100), // 100 search requests per minute

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info'),
  LOG_FORMAT: Joi.string().valid('json', 'simple').default('simple'),

  // Health Check
  HEALTH_CHECK_TIMEOUT: Joi.number().min(1000).default(5000),

  // Metrics
  METRICS_ENABLED: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(9090),

  // CORS
  CORS_ORIGIN: Joi.string().default('*'),
  CORS_METHODS: Joi.string().default('GET,HEAD,PUT,PATCH,POST,DELETE'),
  CORS_CREDENTIALS: Joi.boolean().default(true),

  // Security
  HELMET_ENABLED: Joi.boolean().default(true),
  RATE_LIMIT_ENABLED: Joi.boolean().default(true),

  // Encryption
  ENCRYPTION_KEY: Joi.string().min(32).required(),

  // Internal Services Security
  INTERNAL_API_KEYS: Joi.string().allow('').default(''),
  INTERNAL_ALLOWED_IPS: Joi.string().default('127.0.0.1,::1'),
  INTERNAL_SERVICE_SECRET: Joi.string().default('user-service-internal'),

  // External Services (for future integrations)
  GAME_CATALOG_SERVICE_URL: Joi.string().uri().optional(),
  NOTIFICATION_SERVICE_URL: Joi.string().uri().optional(),

  // Monitoring
  SENTRY_DSN: Joi.string().uri().allow('').optional(),
  JAEGER_ENDPOINT: Joi.string().uri().allow('').optional(),
});

export interface EnvironmentVariables {
  // Application
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  SERVICE_NAME: string;
  SERVICE_VERSION: string;

  // Database
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  POSTGRES_MAX_CONNECTIONS: number;
  POSTGRES_CONNECTION_TIMEOUT: number;

  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  REDIS_MAX_RETRIES: number;
  REDIS_RETRY_DELAY: number;

  // Query Cache
  QUERY_CACHE_ENABLED: boolean;
  QUERY_CACHE_TTL: number;
  QUERY_CACHE_MAX_SIZE: number;
  SLOW_QUERY_THRESHOLD: number;

  // Rate Limiting
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;
  
  // Advanced Rate Limiting
  RATE_LIMIT_DEFAULT_TTL: number;
  RATE_LIMIT_DEFAULT_LIMIT: number;
  RATE_LIMIT_BATCH_TTL: number;
  RATE_LIMIT_BATCH_LIMIT: number;
  RATE_LIMIT_PROFILE_TTL: number;
  RATE_LIMIT_PROFILE_LIMIT: number;
  RATE_LIMIT_INTERNAL_TTL: number;
  RATE_LIMIT_INTERNAL_LIMIT: number;
  RATE_LIMIT_UPLOAD_TTL: number;
  RATE_LIMIT_UPLOAD_LIMIT: number;
  RATE_LIMIT_SEARCH_TTL: number;
  RATE_LIMIT_SEARCH_LIMIT: number;

  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  LOG_FORMAT: 'json' | 'simple';

  // Health Check
  HEALTH_CHECK_TIMEOUT: number;

  // Metrics
  METRICS_ENABLED: boolean;
  METRICS_PORT: number;

  // CORS
  CORS_ORIGIN: string;
  CORS_METHODS: string;
  CORS_CREDENTIALS: boolean;

  // Security
  HELMET_ENABLED: boolean;
  RATE_LIMIT_ENABLED: boolean;

  // Encryption
  ENCRYPTION_KEY: string;

  // Internal Services Security
  INTERNAL_API_KEYS?: string;
  INTERNAL_ALLOWED_IPS: string;
  INTERNAL_SERVICE_SECRET: string;

  // External Services
  GAME_CATALOG_SERVICE_URL?: string;
  NOTIFICATION_SERVICE_URL?: string;

  // Monitoring
  SENTRY_DSN?: string;
  JAEGER_ENDPOINT?: string;
}
