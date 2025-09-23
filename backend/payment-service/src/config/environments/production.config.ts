export const productionConfig = () => ({
  app: {
    corsOrigin: process.env.CORS_ORIGIN || 'https://payments.example.com',
    corsCredentials: true,
    helmetEnabled: true, // Security headers enabled
    swaggerEnabled: false, // No API docs in production
  },
  database: {
    synchronize: false, // Never auto-sync in production
    logging: ['error'], // Only log errors
    poolSize: parseInt(process.env.POSTGRES_POOL_SIZE) || 20,
    ssl: process.env.POSTGRES_SSL === 'true',
  },
  cache: {
    ttl: 600, // 10 minutes
    max: 10000, // Large cache for production
  },
  logging: {
    level: 'info',
    fileEnabled: true,
  },
  security: {
    bcryptRounds: 12, // Strong hashing in production
  },
  payment: {
    mode: process.env.PAYMENT_MODE || 'simulation',
    autoApprove: process.env.PAYMENT_AUTO_APPROVE === 'true',
    delayMs: parseInt(process.env.PAYMENT_DELAY_MS) || 2000,
    successRate: parseFloat(process.env.PAYMENT_SUCCESS_RATE) || 0.95,
  },
  monitoring: {
    metricsEnabled: true,
    healthCheckEnabled: true,
  },
  external: {
    timeoutMs: parseInt(process.env.SERVICE_TIMEOUT_MS) || 5000,
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 3,
  },
});
