import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Production configuration with secrets management
 * Features:
 * - File-based secrets loading
 * - Environment variable validation
 * - Security configurations
 * - Performance optimizations
 */

/**
 * Load secret from file or environment variable
 */
function loadSecret(secretName: string, envVar?: string): string {
  // Try environment variable first
  if (envVar && process.env[envVar]) {
    return process.env[envVar]!;
  }

  // Try loading from secrets file
  try {
    const secretPath = join(process.cwd(), 'secrets', `${secretName}.txt`);
    return readFileSync(secretPath, 'utf8').trim();
  } catch (error) {
    // Fallback to environment variable with default naming
    const defaultEnvVar = secretName.toUpperCase().replace(/-/g, '_');
    if (process.env[defaultEnvVar]) {
      return process.env[defaultEnvVar]!;
    }

    // Log warning but don't fail in development
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Secret '${secretName}' not found in file or environment variable`);
    }
    
    console.warn(`Warning: Secret '${secretName}' not found, using default value`);
    return 'default-secret-value';
  }
}

/**
 * Production configuration factory
 */
export const productionConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    // Server configuration
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST || '0.0.0.0',
      
      // Security headers
      helmet: {
        enabled: isProduction,
        contentSecurityPolicy: isProduction,
        crossOriginEmbedderPolicy: isProduction,
        crossOriginOpenerPolicy: isProduction,
        crossOriginResourcePolicy: isProduction,
        dnsPrefetchControl: isProduction,
        frameguard: isProduction,
        hidePoweredBy: true,
        hsts: isProduction,
        ieNoOpen: isProduction,
        noSniff: isProduction,
        originAgentCluster: isProduction,
        permittedCrossDomainPolicies: isProduction,
        referrerPolicy: isProduction,
        xssFilter: isProduction,
      },

      // CORS configuration
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
        credentials: true,
        maxAge: 86400, // 24 hours
      },

      // Rate limiting
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
        max: parseInt(process.env.RATE_LIMIT_MAX || '1000', 10), // 1000 requests per minute
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
      },

      // Request timeout
      timeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10), // 30 seconds
    },

    // Database configuration with secrets
    database: {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432', 10),
      username: process.env.DATABASE_USERNAME || 'postgres',
      password: loadSecret('database-password', 'DATABASE_PASSWORD'),
      database: process.env.DATABASE_NAME || 'library_service',
      
      // Production optimizations
      synchronize: false, // Never sync in production
      logging: process.env.DATABASE_LOGGING === 'true',
      
      // SSL configuration for production
      ssl: isProduction ? {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
        ca: process.env.DATABASE_SSL_CA,
        cert: process.env.DATABASE_SSL_CERT,
        key: process.env.DATABASE_SSL_KEY,
      } : false,

      // Connection pooling
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20', 10),
      minConnections: parseInt(process.env.DATABASE_MIN_CONNECTIONS || '5', 10),
      acquireTimeout: parseInt(process.env.DATABASE_ACQUIRE_TIMEOUT || '60000', 10),
      idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '600000', 10),
      
      // Query optimization
      statementTimeout: parseInt(process.env.DATABASE_STATEMENT_TIMEOUT || '30000', 10),
      queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '25000', 10),
      
      // Retry configuration
      retryAttempts: parseInt(process.env.DATABASE_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.DATABASE_RETRY_DELAY || '3000', 10),
    },

    // Redis configuration with secrets
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: loadSecret('redis-password', 'REDIS_PASSWORD'),
      
      // Connection options
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000', 10),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000', 10),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100', 10),
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3', 10),
      
      // Cache TTL settings
      ttl: {
        default: parseInt(process.env.CACHE_TTL_DEFAULT || '300', 10), // 5 minutes
        library: parseInt(process.env.CACHE_TTL_LIBRARY || '300', 10), // 5 minutes
        search: parseInt(process.env.CACHE_TTL_SEARCH || '120', 10), // 2 minutes
        history: parseInt(process.env.CACHE_TTL_HISTORY || '600', 10), // 10 minutes
        ownership: parseInt(process.env.CACHE_TTL_OWNERSHIP || '1800', 10), // 30 minutes
      },
    },

    // JWT configuration with secrets
    jwt: {
      secret: loadSecret('jwt-secret', 'JWT_SECRET'),
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      issuer: process.env.JWT_ISSUER || 'library-service',
      audience: process.env.JWT_AUDIENCE || 'gaming-platform',
    },

    // External services configuration
    services: {
      gamesCatalog: {
        url: process.env.GAMES_CATALOG_SERVICE_URL || 'http://localhost:3001',
        timeout: parseInt(process.env.GAMES_CATALOG_TIMEOUT || '5000', 10),
        retries: parseInt(process.env.GAMES_CATALOG_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.GAMES_CATALOG_RETRY_DELAY || '1000', 10),
      },
      payment: {
        url: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3002',
        timeout: parseInt(process.env.PAYMENT_SERVICE_TIMEOUT || '5000', 10),
        retries: parseInt(process.env.PAYMENT_SERVICE_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.PAYMENT_SERVICE_RETRY_DELAY || '1000', 10),
      },
      user: {
        url: process.env.USER_SERVICE_URL || 'http://localhost:3003',
        timeout: parseInt(process.env.USER_SERVICE_TIMEOUT || '5000', 10),
        retries: parseInt(process.env.USER_SERVICE_RETRIES || '3', 10),
        retryDelay: parseInt(process.env.USER_SERVICE_RETRY_DELAY || '1000', 10),
      },
    },

    // APM configuration
    apm: {
      enabled: Boolean(process.env.ELASTIC_APM_SERVER_URL),
      serviceName: process.env.ELASTIC_APM_SERVICE_NAME || 'library-service',
      serverUrl: process.env.ELASTIC_APM_SERVER_URL,
      secretToken: process.env.ELASTIC_APM_SECRET_TOKEN,
      environment: process.env.NODE_ENV || 'development',
      
      // APM settings
      captureHeaders: process.env.ELASTIC_APM_CAPTURE_HEADERS !== 'false',
      captureBody: process.env.ELASTIC_APM_CAPTURE_BODY || 'transactions',
      transactionSampleRate: parseFloat(process.env.ELASTIC_APM_TRANSACTION_SAMPLE_RATE || '1.0'),
      spanFramesMinDuration: parseInt(process.env.ELASTIC_APM_SPAN_FRAMES_MIN_DURATION || '5', 10),
      stackTraceLimit: parseInt(process.env.ELASTIC_APM_STACK_TRACE_LIMIT || '50', 10),
    },

    // Logging configuration
    logging: {
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      format: process.env.LOG_FORMAT || (isProduction ? 'json' : 'dev'),
      
      // File logging in production
      files: {
        enabled: isProduction,
        directory: process.env.LOG_DIRECTORY || 'logs',
        maxSize: process.env.LOG_MAX_SIZE || '50m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '10', 10),
      },
    },

    // Monitoring configuration
    monitoring: {
      prometheus: {
        enabled: process.env.PROMETHEUS_ENABLED !== 'false',
        path: process.env.PROMETHEUS_PATH || '/metrics',
        defaultLabels: {
          service: 'library-service',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
        },
      },
      
      health: {
        enabled: true,
        path: process.env.HEALTH_PATH || '/health',
        detailedPath: process.env.HEALTH_DETAILED_PATH || '/health/detailed',
        
        // Health check timeouts
        database: {
          timeout: parseInt(process.env.HEALTH_DATABASE_TIMEOUT || '5000', 10),
        },
        redis: {
          timeout: parseInt(process.env.HEALTH_REDIS_TIMEOUT || '3000', 10),
        },
        external: {
          timeout: parseInt(process.env.HEALTH_EXTERNAL_TIMEOUT || '5000', 10),
        },
      },
    },

    // Performance configuration
    performance: {
      // Request size limits
      bodyLimit: process.env.BODY_LIMIT || '10mb',
      parameterLimit: parseInt(process.env.PARAMETER_LIMIT || '1000', 10),
      
      // Compression
      compression: {
        enabled: process.env.COMPRESSION_ENABLED !== 'false',
        threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024', 10),
        level: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
      },
      
      // Caching
      cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10),
      },
    },

    // Security configuration
    security: {
      // API key validation
      apiKey: {
        enabled: process.env.API_KEY_ENABLED === 'true',
        header: process.env.API_KEY_HEADER || 'x-api-key',
        value: process.env.API_KEY_VALUE,
      },
      
      // Request validation
      validation: {
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        validateCustomDecorators: true,
      },
    },
  };
};

/**
 * Validate required production environment variables
 */
export function validateProductionConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    return;
  }

  const requiredVars = [
    'DATABASE_HOST',
    'DATABASE_USERNAME',
    'DATABASE_NAME',
    'REDIS_HOST',
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missingVars.join(', ')}`);
  }

  // Validate secrets exist
  const requiredSecrets = ['database-password', 'jwt-secret'];
  
  for (const secret of requiredSecrets) {
    try {
      loadSecret(secret);
    } catch (error) {
      throw new Error(`Required secret '${secret}' not found: ${error}`);
    }
  }
}