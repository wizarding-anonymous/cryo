export const testConfig = () => ({
  app: {
    corsOrigin: 'http://localhost:3001',
    corsCredentials: false,
    helmetEnabled: false,
    swaggerEnabled: false,
  },
  database: {
    synchronize: false, // Use migrations in tests
    logging: false, // Quiet during tests
    poolSize: 2, // Minimal pool for tests
    ssl: false,
  },
  cache: {
    ttl: 0, // No caching in tests
    max: 10,
  },
  logging: {
    level: 'warn', // Minimal logging in tests
    fileEnabled: false, // No file logging in tests
  },
  security: {
    bcryptRounds: 4, // Fastest for tests
  },
  payment: {
    mode: 'simulation',
    autoApprove: true,
    delayMs: 10, // Minimal delay for tests
    successRate: 1.0, // Always succeed in tests
  },
  monitoring: {
    metricsEnabled: false, // Disable metrics in tests
    healthCheckEnabled: true,
  },
  external: {
    timeoutMs: 1000, // Fast timeout for tests
    retryAttempts: 1, // Minimal retries in tests
  },
});
