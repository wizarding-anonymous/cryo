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

  // JWT
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  JWT_REFRESH_SECRET: Joi.string().min(32).optional(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().min(1000).default(60000), // 1 minute
  THROTTLE_LIMIT: Joi.number().min(1).default(60), // 60 requests per minute

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

  // JWT
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  JWT_REFRESH_SECRET?: string;
  JWT_REFRESH_EXPIRES_IN: string;

  // Rate Limiting
  THROTTLE_TTL: number;
  THROTTLE_LIMIT: number;

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

  // External Services
  GAME_CATALOG_SERVICE_URL?: string;
  NOTIFICATION_SERVICE_URL?: string;

  // Monitoring
  SENTRY_DSN?: string;
  JAEGER_ENDPOINT?: string;
}
