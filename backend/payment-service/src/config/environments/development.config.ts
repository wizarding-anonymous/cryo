export const developmentConfig = () => ({
  app: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  database: {
    synchronize: true,
    logging: true,
  },
  cache: {
    ttl: 300,
  },
  logging: {
    level: 'silly',
  },
});
