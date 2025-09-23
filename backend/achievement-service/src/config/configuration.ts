export default () => ({
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    name: process.env.DATABASE_NAME || 'achievement_db',
    user: process.env.DATABASE_USER || 'achievement_user',
    password: process.env.DATABASE_PASSWORD || 'achievement_password',
    ssl: process.env.DATABASE_SSL === 'true',
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    logging: process.env.DATABASE_LOGGING === 'true',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
    connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000', 10),
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000', 10),
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'simple',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '10', 10),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
  },
  
  health: {
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000', 10),
  },
  
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
    limit: parseInt(process.env.RATE_LIMIT_LIMIT || '100', 10),
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS === 'true',
  },
  
  cache: {
    ttl: parseInt(process.env.CACHE_TTL || '300', 10),
    max: parseInt(process.env.CACHE_MAX || '1000', 10),
  },
  
  security: {
    helmetEnabled: process.env.HELMET_ENABLED === 'true',
    compressionEnabled: process.env.COMPRESSION_ENABLED === 'true',
  },
  
  shutdown: {
    timeout: parseInt(process.env.SHUTDOWN_TIMEOUT || '10000', 10),
  },
  
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT || '9090', 10),
    path: process.env.METRICS_PATH || '/metrics',
  },
  
  services: {
    notification: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3006',
    library: process.env.LIBRARY_SERVICE_URL || 'http://library-service:3003',
    payment: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3005',
    review: process.env.REVIEW_SERVICE_URL || 'http://review-service:3004',
    social: process.env.SOCIAL_SERVICE_URL || 'http://social-service:3007',
    timeout: parseInt(process.env.SERVICE_TIMEOUT || '5000', 10),
    retryAttempts: parseInt(process.env.SERVICE_RETRY_ATTEMPTS || '3', 10),
    circuitBreakerThreshold: parseInt(process.env.SERVICE_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
    circuitBreakerTimeout: parseInt(process.env.SERVICE_CIRCUIT_BREAKER_TIMEOUT || '60000', 10),
  },
});