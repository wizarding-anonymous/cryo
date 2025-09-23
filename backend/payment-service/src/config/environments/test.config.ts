export const testConfig = () => ({
  app: {
    corsOrigin: 'http://localhost:3001',
  },
  database: {
    synchronize: false,
    logging: false,
  },
  cache: {
    ttl: 0,
  },
  logging: {
    level: 'warn',
  },
});
