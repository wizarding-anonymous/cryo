import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application Configuration
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development')
    .description('Application environment'),
  PORT: Joi.number().port().default(3003).description('Application port'),
  APP_URL: Joi.string()
    .uri()
    .default('http://localhost:3003')
    .description('Application URL'),
  CORS_ORIGIN: Joi.string()
    .default('http://localhost:3000')
    .description('CORS origin URL'),

  // Database Configuration
  POSTGRES_HOST: Joi.string()
    .hostname()
    .default('localhost')
    .description('PostgreSQL host'),
  POSTGRES_PORT: Joi.number()
    .port()
    .default(5432)
    .description('PostgreSQL port'),
  POSTGRES_USERNAME: Joi.string()
    .min(1)
    .default('postgres')
    .description('PostgreSQL username'),
  POSTGRES_PASSWORD: Joi.string()
    .min(8)
    .required()
    .description('PostgreSQL password (minimum 8 characters)'),
  POSTGRES_DATABASE: Joi.string()
    .min(1)
    .default('payment_service')
    .description('PostgreSQL database name'),
  POSTGRES_SSL: Joi.boolean()
    .default(false)
    .description('Enable PostgreSQL SSL'),
  POSTGRES_POOL_SIZE: Joi.number()
    .min(1)
    .max(100)
    .default(10)
    .description('PostgreSQL connection pool size'),

  // Redis Configuration
  REDIS_HOST: Joi.string()
    .hostname()
    .default('localhost')
    .description('Redis host'),
  REDIS_PORT: Joi.number().port().default(6379).description('Redis port'),
  REDIS_PASSWORD: Joi.string()
    .allow('')
    .optional()
    .description('Redis password'),
  REDIS_DB: Joi.number()
    .min(0)
    .max(15)
    .default(0)
    .description('Redis database number'),
  REDIS_TTL: Joi.number()
    .min(0)
    .default(300)
    .description('Redis default TTL in seconds (0 disables caching)'),

  // JWT Configuration
  JWT_SECRET: Joi.string()
    .min(32)
    .required()
    .description('JWT secret key (minimum 32 characters)'),
  JWT_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('1h')
    .description('JWT expiration time (e.g., 1h, 30m, 7d)'),
  JWT_REFRESH_EXPIRES_IN: Joi.string()
    .pattern(/^\d+[smhd]$/)
    .default('7d')
    .description('JWT refresh token expiration time'),

  // Rate Limiting Configuration
  THROTTLE_TTL: Joi.number()
    .min(1)
    .default(60)
    .description('Rate limiting TTL in seconds'),
  THROTTLE_LIMIT: Joi.number()
    .min(1)
    .default(100)
    .description('Rate limiting request limit'),

  // Payment Provider Configuration (Mock URLs and Keys)
  SBERBANK_MOCK_URL: Joi.string()
    .uri()
    .default('http://localhost:3003/mock/sberbank')
    .description('Sberbank mock API URL'),
  SBERBANK_MOCK_API_KEY: Joi.string()
    .min(10)
    .default('mock_sberbank_key_12345')
    .description('Sberbank mock API key'),
  YANDEX_MOCK_URL: Joi.string()
    .uri()
    .default('http://localhost:3003/mock/ymoney')
    .description('Yandex Money mock API URL'),
  YANDEX_MOCK_API_KEY: Joi.string()
    .min(10)
    .default('mock_ymoney_key_67890')
    .description('Yandex Money mock API key'),
  TBANK_MOCK_URL: Joi.string()
    .uri()
    .default('http://localhost:3003/mock/tbank')
    .description('T-Bank mock API URL'),
  TBANK_MOCK_API_KEY: Joi.string()
    .min(10)
    .default('mock_tbank_key_abcde')
    .description('T-Bank mock API key'),

  // External Services Configuration
  USER_SERVICE_URL: Joi.string()
    .uri()
    .default('http://localhost:3001')
    .description('User Service URL'),
  GAME_CATALOG_SERVICE_URL: Joi.string()
    .uri()
    .default('http://localhost:3002')
    .description('Game Catalog Service URL'),
  LIBRARY_SERVICE_URL: Joi.string()
    .uri()
    .default('http://localhost:3004')
    .description('Library Service URL'),
  EVENT_BUS_URL: Joi.string()
    .uri()
    .optional()
    .description('Event Bus URL (optional)'),
  PURCHASE_COMPLETED_EVENT_NAME: Joi.string()
    .default('payment.purchase.completed')
    .description('Purchase completed event name'),
  EVENT_BUS_TIMEOUT_MS: Joi.number()
    .min(100)
    .max(30000)
    .default(3000)
    .description('Event Bus timeout in milliseconds'),
  SERVICE_TIMEOUT_MS: Joi.number()
    .min(100)
    .max(30000)
    .default(5000)
    .description('External service timeout in milliseconds'),
  RETRY_ATTEMPTS: Joi.number()
    .min(0)
    .max(10)
    .default(3)
    .description('Number of retry attempts for external services'),

  // Payment Simulation Configuration
  PAYMENT_MODE: Joi.string()
    .valid('simulation', 'sandbox', 'production')
    .default('simulation')
    .description('Payment processing mode'),
  PAYMENT_AUTO_APPROVE: Joi.boolean()
    .default(true)
    .description('Auto-approve payments in simulation mode'),
  PAYMENT_DELAY_MS: Joi.number()
    .min(0)
    .max(10000)
    .default(1000)
    .description('Payment processing delay in milliseconds'),
  PAYMENT_SUCCESS_RATE: Joi.number()
    .min(0)
    .max(1)
    .default(0.95)
    .description('Payment success rate for simulation (0-1)'),
  ENABLED_PROVIDERS: Joi.string()
    .pattern(/^(sberbank|yandex|tbank)(,(sberbank|yandex|tbank))*$/)
    .default('sberbank,yandex,tbank')
    .description('Comma-separated list of enabled payment providers'),

  // Logging Configuration
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info')
    .description('Logging level'),
  LOG_FILE_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable file logging'),
  LOG_FILE_MAX_SIZE: Joi.string()
    .pattern(/^\d+[kmg]?b?$/i)
    .default('20m')
    .description('Maximum log file size'),
  LOG_FILE_MAX_FILES: Joi.string()
    .pattern(/^\d+[dwmy]?$/)
    .default('14d')
    .description('Maximum log file retention'),

  // Security Configuration
  BCRYPT_ROUNDS: Joi.number()
    .min(4)
    .max(15)
    .default(12)
    .description('BCrypt hash rounds (minimum 4 for tests, 8+ for production)'),
  CORS_CREDENTIALS: Joi.boolean()
    .default(true)
    .description('Enable CORS credentials'),
  HELMET_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable Helmet security middleware'),

  // Monitoring Configuration
  METRICS_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable Prometheus metrics'),
  HEALTH_CHECK_ENABLED: Joi.boolean()
    .default(true)
    .description('Enable health check endpoints'),
  SWAGGER_ENABLED: Joi.boolean()
    .default(false)
    .when('NODE_ENV', {
      is: 'development',
      then: Joi.boolean().default(true),
    })
    .description('Enable Swagger documentation'),
});
