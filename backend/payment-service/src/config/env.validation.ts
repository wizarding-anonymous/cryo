import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3003),
  APP_URL: Joi.string().default('http://localhost:3003'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),

  // Database
  POSTGRES_HOST: Joi.string().default('localhost'),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USERNAME: Joi.string().default('postgres'),
  POSTGRES_PASSWORD: Joi.string().required(),
  POSTGRES_DATABASE: Joi.string().default('payment_service'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  // Rate limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Payment providers (mock URLs and keys)
  SBERBANK_MOCK_URL: Joi.string().default(
    'http://localhost:3003/mock/sberbank',
  ),
  SBERBANK_MOCK_API_KEY: Joi.string().default('mock_sberbank_key_12345'),
  YANDEX_MOCK_URL: Joi.string().default('http://localhost:3003/mock/ymoney'),
  YANDEX_MOCK_API_KEY: Joi.string().default('mock_ymoney_key_67890'),
  TBANK_MOCK_URL: Joi.string().default('http://localhost:3003/mock/tbank'),
  TBANK_MOCK_API_KEY: Joi.string().default('mock_tbank_key_abcde'),

  // External services
  USER_SERVICE_URL: Joi.string().default('http://localhost:3001'),
  GAME_CATALOG_SERVICE_URL: Joi.string().default('http://localhost:3002'),
  LIBRARY_SERVICE_URL: Joi.string().default('http://localhost:3004'),
  EVENT_BUS_URL: Joi.string().uri().optional(),
  PURCHASE_COMPLETED_EVENT_NAME: Joi.string().default(
    'payment.purchase.completed',
  ),
  EVENT_BUS_TIMEOUT_MS: Joi.number().default(3000),

  // Payment Simulation
  PAYMENT_MODE: Joi.string()
    .valid('simulation', 'sandbox', 'production')
    .default('simulation'),
  PAYMENT_AUTO_APPROVE: Joi.boolean().default(true),
  PAYMENT_DELAY_MS: Joi.number().default(1000),
  PAYMENT_SUCCESS_RATE: Joi.number().min(0).max(1).default(0.95),
  ENABLED_PROVIDERS: Joi.string().default('sberbank,yandex_money,tinkoff'),
});
