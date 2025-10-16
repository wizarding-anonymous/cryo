import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import { EnvironmentVariables } from './env.validation';
import { User } from '../user/entities/user.entity';

/**
 * Configuration factory for creating various module configurations
 * based on environment variables and application settings
 */
export class ConfigFactory {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables>,
  ) { }

  /**
   * Create optimized TypeORM configuration with enhanced connection pooling
   */
  createTypeOrmConfig(): TypeOrmModuleOptions {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    const dbConfig = {
      host: this.configService.get('POSTGRES_HOST', { infer: true }),
      port: this.configService.get('POSTGRES_PORT', { infer: true }),
      username: this.configService.get('POSTGRES_USER', { infer: true }),
      password: this.configService.get('POSTGRES_PASSWORD', { infer: true }),
      database: this.configService.get('POSTGRES_DB', { infer: true }),
      maxConnections: this.configService.get('POSTGRES_MAX_CONNECTIONS', {
        infer: true,
      }),
      connectionTimeout: this.configService.get('POSTGRES_CONNECTION_TIMEOUT', {
        infer: true,
      }),
    };

    // Optimized connection pool settings based on environment
    const poolConfig = this.getOptimizedPoolConfig(
      nodeEnv,
      dbConfig.maxConnections,
    );

    return {
      type: 'postgres',
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password,
      database: dbConfig.database,
      entities: [User],
      migrations: ['dist/database/migrations/*.js'],
      migrationsTableName: 'migrations',
      synchronize: false, // Always use migrations
      logging: this.getTypeOrmLogging(nodeEnv),

      // Optimized connection pool configuration
      extra: {
        // Connection pool settings
        max: poolConfig.max, // Maximum connections in pool
        min: poolConfig.min, // Minimum connections in pool

        // Timeout settings (in milliseconds)
        connectionTimeoutMillis: poolConfig.connectionTimeout,
        acquireTimeoutMillis: poolConfig.acquireTimeout,
        idleTimeoutMillis: poolConfig.idleTimeout,

        // Query timeout settings
        statement_timeout: poolConfig.statementTimeout,
        query_timeout: poolConfig.queryTimeout,

        // Connection validation
        testOnBorrow: true,
        validationQuery: 'SELECT 1',

        // Performance optimizations
        application_name: 'user-service',

        // Connection reuse settings
        evictionRunIntervalMillis: 10000, // Run eviction every 10 seconds
        numTestsPerEvictionRun: 3, // Test 3 connections per eviction run
        softIdleTimeoutMillis: 30000, // Soft idle timeout

        // SSL and security
        ssl:
          nodeEnv === 'production'
            ? {
              rejectUnauthorized: false,
              sslmode: 'require',
            }
            : false,

        // Performance tuning
        keepAlive: true,
        keepAliveInitialDelayMillis: 0,
      },

      // Additional TypeORM optimizations
      maxQueryExecutionTime: poolConfig.slowQueryThreshold, // Log slow queries

      // Query result cache configuration (using Redis)
      cache: this.createQueryCacheConfig(nodeEnv),

      // Connection pooling at TypeORM level
      poolSize: poolConfig.max,

      // Logging configuration
      logger: 'advanced-console',

      // Performance monitoring
      dropSchema: false,
      migrationsRun: false, // Run migrations manually for better control
    };
  }

  /**
   * Create enhanced Throttler configuration with multi-level rate limiting
   */
  createThrottlerConfig(): ThrottlerModuleOptions {
    const rateLimitEnabled = this.configService.get('RATE_LIMIT_ENABLED', { infer: true });
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });

    if (!rateLimitEnabled) {
      // Return very high limits when rate limiting is disabled
      return {
        throttlers: [
          {
            name: 'default',
            ttl: 60000, // 1 minute
            limit: 10000, // Very high limit
          },
        ],
      };
    }

    // Environment-specific rate limiting configurations
    const configs = this.getRateLimitConfigs(nodeEnv);

    return {
      throttlers: [
        // Default rate limiting for all endpoints
        {
          name: 'default',
          ttl: configs.default.ttl,
          limit: configs.default.limit,
        },
        // Batch operations - more restrictive
        {
          name: 'batch',
          ttl: configs.batch.ttl,
          limit: configs.batch.limit,
        },
        // Profile operations - moderate restrictions
        {
          name: 'profile',
          ttl: configs.profile.ttl,
          limit: configs.profile.limit,
        },
        // Internal API - higher limits
        {
          name: 'internal',
          ttl: configs.internal.ttl,
          limit: configs.internal.limit,
        },
        // Upload operations - very restrictive
        {
          name: 'upload',
          ttl: configs.upload.ttl,
          limit: configs.upload.limit,
        },
        // Search operations - moderate restrictions
        {
          name: 'search',
          ttl: configs.search.ttl,
          limit: configs.search.limit,
        },
      ],
      // Use Redis for distributed rate limiting
      storage: new (require('ioredis'))({
        host: this.configService.get('REDIS_HOST', { infer: true }),
        port: this.configService.get('REDIS_PORT', { infer: true }),
        password: this.configService.get('REDIS_PASSWORD', { infer: true }),
        db: this.configService.get('REDIS_DB', { infer: true }) + 2, // Use separate DB for throttling
        keyPrefix: 'user-service:throttle:',
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 3000,
      }),
      // Error handling
      errorMessage: 'Too many requests, please try again later',
      skipIf: (context) => {
        // Skip rate limiting for health checks
        const request = context.switchToHttp().getRequest();
        return request.path === '/health' || request.path === '/health/ready' || request.path === '/health/live';
      },
    };
  }

  /**
   * Create Cache configuration
   */
  createCacheConfig(): CacheModuleOptions {
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });

    return {
      isGlobal: true,
      ttl: nodeEnv === 'production' ? 300 : 60, // 5 minutes in prod, 1 minute in dev
      max: nodeEnv === 'production' ? 1000 : 100, // More items in production
    };
  }

  /**
   * Create Redis configuration
   */
  createRedisConfig() {
    return {
      host: this.configService.get('REDIS_HOST', { infer: true }),
      port: this.configService.get('REDIS_PORT', { infer: true }),
      password: this.configService.get('REDIS_PASSWORD', { infer: true }),
      db: this.configService.get('REDIS_DB', { infer: true }),
      maxRetriesPerRequest: this.configService.get('REDIS_MAX_RETRIES', {
        infer: true,
      }),
      retryDelayOnFailover: this.configService.get('REDIS_RETRY_DELAY', {
        infer: true,
      }),
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
    };
  }

  /**
   * Create CORS configuration
   */
  createCorsConfig() {
    const origin = this.configService.get('CORS_ORIGIN', { infer: true });
    const methods = this.configService.get('CORS_METHODS', { infer: true });
    const credentials = this.configService.get('CORS_CREDENTIALS', {
      infer: true,
    });

    return {
      origin: origin === '*' ? true : origin.split(','),
      methods: methods.split(','),
      credentials,
      optionsSuccessStatus: 200,
    };
  }

  /**
   * Create Swagger configuration
   */
  createSwaggerConfig() {
    const serviceName = this.configService.get('SERVICE_NAME', { infer: true });
    const serviceVersion = this.configService.get('SERVICE_VERSION', {
      infer: true,
    });
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });

    return {
      title: `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} API`,
      description: `API documentation for the ${serviceName} microservice`,
      version: serviceVersion,
      // Only enable Swagger in non-production environments
      enabled: nodeEnv !== 'production',
    };
  }

  /**
   * Get TypeORM logging configuration based on environment
   */
  private getTypeOrmLogging(
    nodeEnv: string,
  ):
    | boolean
    | ('query' | 'error' | 'schema' | 'warn' | 'info' | 'log' | 'migration')[] {
    switch (nodeEnv) {
      case 'development':
        return ['query', 'error', 'warn', 'migration'];
      case 'test':
        return ['error'];
      case 'production':
        return ['error', 'warn', 'migration'];
      default:
        return ['error'];
    }
  }

  /**
   * Validate critical configuration
   */
  validateConfiguration(): void {
    const requiredVars = [
      'POSTGRES_HOST',
      'POSTGRES_USER',
      'POSTGRES_PASSWORD',
      'POSTGRES_DB',
      'REDIS_HOST',
    ];

    const missingVars = requiredVars.filter(
      (varName) =>
        !this.configService.get(varName as keyof EnvironmentVariables),
    );

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}`,
      );
    }

    // Validate production-specific requirements
    const nodeEnv = this.configService.get('NODE_ENV', { infer: true });
    if (nodeEnv === 'production') {
      this.validateProductionConfig();
    }
  }

  /**
   * Get optimized connection pool configuration based on environment
   */
  private getOptimizedPoolConfig(nodeEnv: string, maxConnections: number) {
    const baseConfig = {
      development: {
        max: Math.min(maxConnections, 10), // Smaller pool for development
        min: 2, // Keep minimum connections
        connectionTimeout: 5000, // 5 seconds
        acquireTimeout: 10000, // 10 seconds to acquire connection
        idleTimeout: 30000, // 30 seconds idle timeout
        statementTimeout: 30000, // 30 seconds for statements
        queryTimeout: 15000, // 15 seconds for queries
        slowQueryThreshold: 1000, // Log queries > 1 second
      },
      test: {
        max: 5, // Small pool for tests
        min: 1,
        connectionTimeout: 3000,
        acquireTimeout: 5000,
        idleTimeout: 10000,
        statementTimeout: 10000,
        queryTimeout: 5000,
        slowQueryThreshold: 500, // Log queries > 500ms in tests
      },
      production: {
        max: maxConnections, // Use full configured pool
        min: Math.ceil(maxConnections * 0.2), // 20% minimum connections
        connectionTimeout: 10000, // 10 seconds
        acquireTimeout: 30000, // 30 seconds to acquire
        idleTimeout: 60000, // 1 minute idle timeout
        statementTimeout: 60000, // 1 minute for statements
        queryTimeout: 30000, // 30 seconds for queries
        slowQueryThreshold: 2000, // Log queries > 2 seconds
      },
    };

    return (
      baseConfig[nodeEnv as keyof typeof baseConfig] || baseConfig.production
    );
  }

  /**
   * Create enhanced query cache configuration using Redis
   */
  private createQueryCacheConfig(nodeEnv: string) {
    const redisConfig = this.createRedisConfig();
    const queryCacheEnabled = this.configService.get('QUERY_CACHE_ENABLED', {
      infer: true,
    });

    if (!queryCacheEnabled) {
      return false; // Disable query caching
    }

    return {
      type: 'redis' as const,
      options: {
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db + 1, // Use different DB for query cache
        keyPrefix: 'user-service:typeorm-query-cache:',

        // Enhanced Redis configuration for query caching
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 5000,
        commandTimeout: 3000,

        // Connection pool for query cache
        family: 4,
        maxmemoryPolicy: 'allkeys-lru', // Evict least recently used keys
      },

      // Cache duration based on environment and configuration
      duration: this.getQueryCacheDuration(nodeEnv),

      // Advanced caching options
      ignoreErrors: true, // Don't fail if Redis is unavailable

      // Custom cache key generation
      tableName: 'typeorm_metadata',

      // Performance settings
      alwaysEnabled: nodeEnv === 'production',

      // Memory management
      maxSize: this.configService.get('QUERY_CACHE_MAX_SIZE', { infer: true }),
    };
  }

  /**
   * Get query cache duration based on environment and configuration
   */
  private getQueryCacheDuration(nodeEnv: string): number {
    const configuredTTL = this.configService.get('QUERY_CACHE_TTL', {
      infer: true,
    });

    // Convert seconds to milliseconds for TypeORM
    const baseTTL = configuredTTL * 1000;

    switch (nodeEnv) {
      case 'production':
        return baseTTL; // Use configured TTL
      case 'development':
        return Math.min(baseTTL, 60000); // Max 1 minute in dev
      case 'test':
        return Math.min(baseTTL, 30000); // Max 30 seconds in test
      default:
        return baseTTL;
    }
  }

  /**
   * Get rate limiting configurations based on environment
   */
  private getRateLimitConfigs(nodeEnv: string) {
    const baseConfigs = {
      development: {
        default: { ttl: 60000, limit: 100 }, // 100 requests per minute
        batch: { ttl: 300000, limit: 20 }, // 20 batch operations per 5 minutes
        profile: { ttl: 60000, limit: 50 }, // 50 profile operations per minute
        internal: { ttl: 60000, limit: 2000 }, // 2000 internal requests per minute
        upload: { ttl: 60000, limit: 10 }, // 10 uploads per minute
        search: { ttl: 60000, limit: 200 }, // 200 search requests per minute
      },
      test: {
        default: { ttl: 60000, limit: 1000 }, // Higher limits for testing
        batch: { ttl: 300000, limit: 100 },
        profile: { ttl: 60000, limit: 500 },
        internal: { ttl: 60000, limit: 5000 },
        upload: { ttl: 60000, limit: 50 },
        search: { ttl: 60000, limit: 1000 },
      },
      production: {
        default: { ttl: 60000, limit: 60 }, // 60 requests per minute
        batch: { ttl: 300000, limit: 10 }, // 10 batch operations per 5 minutes
        profile: { ttl: 60000, limit: 30 }, // 30 profile operations per minute
        internal: { ttl: 60000, limit: 1000 }, // 1000 internal requests per minute
        upload: { ttl: 60000, limit: 5 }, // 5 uploads per minute
        search: { ttl: 60000, limit: 100 }, // 100 search requests per minute
      },
    };

    return baseConfigs[nodeEnv as keyof typeof baseConfigs] || baseConfigs.production;
  }

  /**
   * Validate production-specific configuration
   */
  private validateProductionConfig(): void {
    const productionChecks: Array<{
      key: keyof EnvironmentVariables;
      check: (value: any) => boolean;
      message: string;
    }> = [
        {
          key: 'POSTGRES_PASSWORD',
          check: (value: string) => value !== 'CHANGE_ME_IN_PRODUCTION',
          message:
            'POSTGRES_PASSWORD must be changed from default value in production',
        },
        {
          key: 'REDIS_PASSWORD',
          check: (value: string) => !value || value !== 'CHANGE_ME_IN_PRODUCTION',
          message:
            'REDIS_PASSWORD should be set and changed from default value in production',
        },
        {
          key: 'POSTGRES_MAX_CONNECTIONS',
          check: (value: number) => value >= 10 && value <= 100,
          message:
            'POSTGRES_MAX_CONNECTIONS should be between 10 and 100 in production',
        },
      ];

    for (const check of productionChecks) {
      const value = this.configService.get(check.key);
      if (value && !check.check(value)) {
        throw new Error(check.message);
      }
    }
  }
}
