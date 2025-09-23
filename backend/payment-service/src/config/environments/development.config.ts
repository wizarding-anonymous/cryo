export const developmentConfig = () => ({
  app: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    corsCredentials: true,
    helmetEnabled: false, // Disabled for easier development
    swaggerEnabled: true,
  },
  database: {
    synchronize: true,
    logging: ['query', 'error', 'warn'],
    poolSize: 5,
    ssl: false,
  },
  cache: {
    ttl: 300, // 5 minutes
    max: 100, // Smaller cache for development
  },
  logging: {
    level: 'silly',
    fileEnabled: true,
  },
  security: {
    bcryptRounds: 10, // Faster for development
  },
  payment: {
    mode: 'simulation',
    autoApprove: true,
    delayMs: 500, // Faster for development
    successRate: 1.0, // Always succeed in development
  },
  monitoring: {
    metricsEnabled: true,
    healthCheckEnabled: true,
  },
  external: {
    timeoutMs: 3000,
    retryAttempts: 2,
  },
});
