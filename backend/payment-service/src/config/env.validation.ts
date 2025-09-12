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
  REDIS_PASSWORD: Joi.string().optional(),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),

  // Rate limiting
  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),

  // Payment providers (mock URLs)
  SBERBANK_MOCK_URL: Joi.string().default('http://localhost:3003/mock/sberbank'),
  YANDEX_MOCK_URL: Joi.string().default('http://localhost:3003/mock/yandex'),
  TBANK_MOCK_URL: Joi.string().default('http://localhost:3003/mock/tbank'),

  // External services
  USER_SERVICE_URL: Joi.string().default('http://localhost:3001'),
  LIBRARY_SERVICE_URL: Joi.string().default('http://localhost:3004'),
});