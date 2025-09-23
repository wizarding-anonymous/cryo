export const productionConfig = () => ({
  app: {
    corsOrigin: process.env.CORS_ORIGIN || 'https://payments.example.com',
  },
  database: {
    synchronize: false,
    logging: false,
  },
  cache: {
    ttl: 600,
  },
  logging: {
    level: 'info',
  },
});
