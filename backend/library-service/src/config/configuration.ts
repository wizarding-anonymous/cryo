export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'password',
    database: process.env.DATABASE_NAME || 'library_service',
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
    minConnections: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10),
    acquireTimeout: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000', 10),
    idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600000', 10),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    ttl: parseInt(process.env.CACHE_TTL || '300', 10), // 5 minutes default
  },
  kafka: {
    enabled: process.env.KAFKA_ENABLED === 'true' || false, // Default to false for MVP
    broker: process.env.KAFKA_BROKER || 'localhost:9092',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  services: {
    gamesCatalog: {
      url: process.env.GAMES_CATALOG_SERVICE_URL || 'http://localhost:3001',
      timeout: parseInt(process.env.GAMES_CATALOG_TIMEOUT || '5000', 10),
    },
    payment: {
      url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002',
      timeout: parseInt(process.env.PAYMENT_SERVICE_TIMEOUT || '5000', 10),
    },
    user: {
      url: process.env.USER_SERVICE_URL || 'http://localhost:3003',
      timeout: parseInt(process.env.USER_SERVICE_TIMEOUT || '5000', 10),
    },
  },
  swagger: {
    title: 'Library Service API',
    description: 'API for managing user game libraries and purchase history',
    version: '1.0',
    path: 'api/docs',
  },
  apm: {
    enabled: Boolean(process.env.ELASTIC_APM_SERVER_URL),
    serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'library-service',
    serverUrl: process.env.ELASTIC_APM_SERVER_URL,
    secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
  },
});
