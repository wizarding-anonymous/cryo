import { registerAs } from '@nestjs/config';

export interface PerformanceConfig {
  // Database connection pool settings
  database: {
    maxConnections: number;
    minConnections: number;
    acquireTimeoutMillis: number;
    idleTimeoutMillis: number;
    reapIntervalMillis: number;
    createRetryIntervalMillis: number;
    createTimeoutMillis: number;
    destroyTimeoutMillis: number;
    propagateCreateError: boolean;
    // Query optimization
    queryTimeout: number;
    statementTimeout: number;
    lockTimeout: number;
    // Performance monitoring
    logSlowQueries: boolean;
    slowQueryThreshold: number;
  };

  // Cache configuration
  cache: {
    redis: {
      maxRetriesPerRequest: number;
      retryDelayOnFailover: number;
      enableReadyCheck: boolean;
      lazyConnect: boolean;
      keepAlive: number;
      family: number;
      // Connection pool
      maxConnections: number;
      minConnections: number;
    };
    // TTL settings
    defaultTtl: number;
    libraryTtl: number;
    searchTtl: number;
    ownershipTtl: number;
    statsTtl: number;
    // Cache strategies
    enableCacheWarming: boolean;
    cacheWarmingInterval: number;
    enableCacheCompression: boolean;
  };

  // Application performance settings
  application: {
    // Request handling
    maxRequestSize: string;
    requestTimeout: number;
    keepAliveTimeout: number;
    headersTimeout: number;
    // Pagination limits
    defaultPageSize: number;
    maxPageSize: number;
    maxSearchResults: number;
    // Bulk operation limits
    maxBulkInsertSize: number;
    bulkInsertBatchSize: number;
    // Memory management
    maxMemoryUsage: number; // in MB
    gcInterval: number; // in milliseconds
    // Performance monitoring
    enablePerformanceMonitoring: boolean;
    performanceMetricsInterval: number;
    maxMetricsHistory: number;
  };

  // Load balancing and scaling
  scaling: {
    // Auto-scaling thresholds
    cpuThreshold: number;
    memoryThreshold: number;
    responseTimeThreshold: number;
    errorRateThreshold: number;
    // Circuit breaker
    circuitBreakerThreshold: number;
    circuitBreakerTimeout: number;
    circuitBreakerResetTimeout: number;
    // Rate limiting
    enableRateLimit: boolean;
    rateLimitWindow: number;
    rateLimitMax: number;
  };

  // Optimization features
  optimization: {
    // Query optimization
    enableQueryCache: boolean;
    enablePreparedStatements: boolean;
    enableBatchQueries: boolean;
    // Index optimization
    enableAutoIndexing: boolean;
    indexMaintenanceInterval: number;
    // Materialized views
    enableMaterializedViews: boolean;
    materializedViewRefreshInterval: number;
    // Compression
    enableResponseCompression: boolean;
    compressionThreshold: number;
    compressionLevel: number;
  };
}

export default registerAs(
  'performance',
  (): PerformanceConfig => ({
    database: {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),
      minConnections: parseInt(process.env.DB_MIN_CONNECTIONS || '5', 10),
      acquireTimeoutMillis: parseInt(
        process.env.DB_ACQUIRE_TIMEOUT || '60000',
        10,
      ),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
      reapIntervalMillis: parseInt(process.env.DB_REAP_INTERVAL || '1000', 10),
      createRetryIntervalMillis: parseInt(
        process.env.DB_CREATE_RETRY_INTERVAL || '200',
        10,
      ),
      createTimeoutMillis: parseInt(
        process.env.DB_CREATE_TIMEOUT || '30000',
        10,
      ),
      destroyTimeoutMillis: parseInt(
        process.env.DB_DESTROY_TIMEOUT || '5000',
        10,
      ),
      propagateCreateError: process.env.DB_PROPAGATE_CREATE_ERROR === 'true',
      queryTimeout: parseInt(process.env.DB_QUERY_TIMEOUT || '30000', 10),
      statementTimeout: parseInt(
        process.env.DB_STATEMENT_TIMEOUT || '30000',
        10,
      ),
      lockTimeout: parseInt(process.env.DB_LOCK_TIMEOUT || '10000', 10),
      logSlowQueries: process.env.DB_LOG_SLOW_QUERIES === 'true',
      slowQueryThreshold: parseInt(
        process.env.DB_SLOW_QUERY_THRESHOLD || '1000',
        10,
      ),
    },

    cache: {
      redis: {
        maxRetriesPerRequest: parseInt(
          process.env.REDIS_MAX_RETRIES || '3',
          10,
        ),
        retryDelayOnFailover: parseInt(
          process.env.REDIS_RETRY_DELAY || '100',
          10,
        ),
        enableReadyCheck: process.env.REDIS_READY_CHECK !== 'false',
        lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true',
        keepAlive: parseInt(process.env.REDIS_KEEP_ALIVE || '30000', 10),
        family: parseInt(process.env.REDIS_FAMILY || '4', 10),
        maxConnections: parseInt(process.env.REDIS_MAX_CONNECTIONS || '10', 10),
        minConnections: parseInt(process.env.REDIS_MIN_CONNECTIONS || '2', 10),
      },
      defaultTtl: parseInt(process.env.CACHE_DEFAULT_TTL || '300', 10), // 5 minutes
      libraryTtl: parseInt(process.env.CACHE_LIBRARY_TTL || '600', 10), // 10 minutes
      searchTtl: parseInt(process.env.CACHE_SEARCH_TTL || '180', 10), // 3 minutes
      ownershipTtl: parseInt(process.env.CACHE_OWNERSHIP_TTL || '900', 10), // 15 minutes
      statsTtl: parseInt(process.env.CACHE_STATS_TTL || '1800', 10), // 30 minutes
      enableCacheWarming: process.env.CACHE_WARMING_ENABLED === 'true',
      cacheWarmingInterval: parseInt(
        process.env.CACHE_WARMING_INTERVAL || '300000',
        10,
      ), // 5 minutes
      enableCacheCompression: process.env.CACHE_COMPRESSION_ENABLED === 'true',
    },

    application: {
      maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
      keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '5000', 10),
      headersTimeout: parseInt(process.env.HEADERS_TIMEOUT || '60000', 10),
      defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20', 10),
      maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100', 10),
      maxSearchResults: parseInt(process.env.MAX_SEARCH_RESULTS || '1000', 10),
      maxBulkInsertSize: parseInt(
        process.env.MAX_BULK_INSERT_SIZE || '1000',
        10,
      ),
      bulkInsertBatchSize: parseInt(
        process.env.BULK_INSERT_BATCH_SIZE || '100',
        10,
      ),
      maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '512', 10), // 512MB
      gcInterval: parseInt(process.env.GC_INTERVAL || '60000', 10), // 1 minute
      enablePerformanceMonitoring:
        process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
      performanceMetricsInterval: parseInt(
        process.env.PERFORMANCE_METRICS_INTERVAL || '30000',
        10,
      ),
      maxMetricsHistory: parseInt(
        process.env.MAX_METRICS_HISTORY || '10000',
        10,
      ),
    },

    scaling: {
      cpuThreshold: parseFloat(process.env.CPU_THRESHOLD || '80'),
      memoryThreshold: parseFloat(process.env.MEMORY_THRESHOLD || '85'),
      responseTimeThreshold: parseInt(
        process.env.RESPONSE_TIME_THRESHOLD || '1000',
        10,
      ),
      errorRateThreshold: parseFloat(
        process.env.ERROR_RATE_THRESHOLD || '0.05',
      ),
      circuitBreakerThreshold: parseInt(
        process.env.CIRCUIT_BREAKER_THRESHOLD || '5',
        10,
      ),
      circuitBreakerTimeout: parseInt(
        process.env.CIRCUIT_BREAKER_TIMEOUT || '60000',
        10,
      ),
      circuitBreakerResetTimeout: parseInt(
        process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '30000',
        10,
      ),
      enableRateLimit: process.env.RATE_LIMIT_ENABLED === 'true',
      rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '60000', 10), // 1 minute
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    },

    optimization: {
      enableQueryCache: process.env.QUERY_CACHE_ENABLED !== 'false',
      enablePreparedStatements:
        process.env.PREPARED_STATEMENTS_ENABLED !== 'false',
      enableBatchQueries: process.env.BATCH_QUERIES_ENABLED === 'true',
      enableAutoIndexing: process.env.AUTO_INDEXING_ENABLED === 'true',
      indexMaintenanceInterval: parseInt(
        process.env.INDEX_MAINTENANCE_INTERVAL || '3600000',
        10,
      ), // 1 hour
      enableMaterializedViews:
        process.env.MATERIALIZED_VIEWS_ENABLED !== 'false',
      materializedViewRefreshInterval: parseInt(
        process.env.MATERIALIZED_VIEW_REFRESH_INTERVAL || '1800000',
        10,
      ), // 30 minutes
      enableResponseCompression:
        process.env.RESPONSE_COMPRESSION_ENABLED !== 'false',
      compressionThreshold: parseInt(
        process.env.COMPRESSION_THRESHOLD || '1024',
        10,
      ), // 1KB
      compressionLevel: parseInt(process.env.COMPRESSION_LEVEL || '6', 10),
    },
  }),
);
