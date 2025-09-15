import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3008),

  // Database (prefer DATABASE_URL if provided)
  DATABASE_URL: Joi.string().uri().optional(),
  DB_HOST: Joi.string().hostname().default('localhost'),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default('postgres'),
  DB_NAME: Joi.string().default('security_service'),

  // Redis
  REDIS_URL: Joi.string().uri().optional(),
  REDIS_HOST: Joi.string().hostname().default('localhost'),
  REDIS_PORT: Joi.number().port().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // Security thresholds
  SECURITY_LOGIN_PER_MINUTE_IP: Joi.number().integer().min(1).default(20),
  SECURITY_LOGIN_PER_MINUTE_USER: Joi.number().integer().min(1).default(10),
  SECURITY_TXN_PER_MINUTE_USER: Joi.number().integer().min(1).default(15),
  SECURITY_TXN_AMOUNT_THRESHOLD: Joi.number().integer().min(1).default(10000),
  SECURITY_ACTIVITY_PER_MINUTE: Joi.number().integer().min(1).default(60),
  SECURITY_SUSPICIOUS_EVENTS_WINDOW_MIN: Joi.number().integer().min(1).default(10),
  SECURITY_SUSPICIOUS_EVENTS_THRESHOLD: Joi.number().integer().min(1).default(20),
  SECURITY_ALERT_RISK_THRESHOLD: Joi.number().integer().min(1).max(100).default(80),
  SECURITY_BEHAVIOR_WINDOW_DAYS: Joi.number().integer().min(1).default(7),

  // Auth (JWT)
  JWT_PUBLIC_KEY: Joi.string().optional(),
  JWT_SECRET: Joi.string().optional(),
}).unknown(true);
