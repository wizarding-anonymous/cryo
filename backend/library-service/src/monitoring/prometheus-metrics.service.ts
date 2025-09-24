import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as promClient from 'prom-client';

/**
 * Enhanced Prometheus metrics service for production monitoring
 * Features:
 * - Custom business metrics
 * - Performance monitoring
 * - Error tracking
 * - Resource utilization
 * - API metrics
 */

@Injectable()
export class PrometheusMetricsService {
  private readonly logger = new Logger(PrometheusMetricsService.name);
  private readonly register: promClient.Registry;

  // HTTP metrics
  private httpRequestsTotal!: promClient.Counter<string>;
  private httpRequestDuration!: promClient.Histogram<string>;
  private httpRequestSize!: promClient.Histogram<string>;
  private httpResponseSize!: promClient.Histogram<string>;

  // Business metrics
  private libraryOperationsTotal!: promClient.Counter<string>;
  private librarySize!: promClient.Gauge<string>;
  private purchaseHistoryOperations!: promClient.Counter<string>;
  private searchOperations!: promClient.Counter<string>;
  private cacheOperations!: promClient.Counter<string>;

  // Database metrics
  private databaseConnectionsActive!: promClient.Gauge<string>;
  private databaseQueryDuration!: promClient.Histogram<string>;
  private databaseOperationsTotal!: promClient.Counter<string>;

  // External service metrics
  private externalServiceCalls!: promClient.Counter<string>;
  private externalServiceDuration!: promClient.Histogram<string>;

  // Error metrics
  private errorsTotal!: promClient.Counter<string>;
  private businessErrorsTotal!: promClient.Counter<string>;

  // Performance metrics
  private memoryUsage!: promClient.Gauge<string>;
  private cpuUsage!: promClient.Gauge<string>;
  private eventLoopLag!: promClient.Gauge<string>;

  constructor(private readonly configService: ConfigService) {
    this.register = new promClient.Registry();

    // Set default labels
    const defaultLabels = this.configService.get(
      'monitoring.prometheus.defaultLabels',
      {},
    );
    this.register.setDefaultLabels(defaultLabels);

    // Initialize metrics
    this.initializeHttpMetrics();
    this.initializeBusinessMetrics();
    this.initializeDatabaseMetrics();
    this.initializeExternalServiceMetrics();
    this.initializeErrorMetrics();
    this.initializePerformanceMetrics();

    // Collect default metrics
    promClient.collectDefaultMetrics({
      register: this.register,
      prefix: 'library_service_',
    });

    // Start performance monitoring
    this.startPerformanceMonitoring();

    this.logger.log('Prometheus metrics service initialized');
  }

  /**
   * Get metrics registry
   */
  getRegistry(): promClient.Registry {
    return this.register;
  }

  /**
   * Get metrics as string
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Initialize HTTP metrics
   */
  private initializeHttpMetrics(): void {
    this.httpRequestsTotal = new promClient.Counter({
      name: 'library_service_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'user_id'],
      registers: [this.register],
    });

    this.httpRequestDuration = new promClient.Histogram({
      name: 'library_service_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });

    this.httpRequestSize = new promClient.Histogram({
      name: 'library_service_http_request_size_bytes',
      help: 'HTTP request size in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.register],
    });

    this.httpResponseSize = new promClient.Histogram({
      name: 'library_service_http_response_size_bytes',
      help: 'HTTP response size in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.register],
    });
  }

  /**
   * Initialize business metrics
   */
  private initializeBusinessMetrics(): void {
    this.libraryOperationsTotal = new promClient.Counter({
      name: 'library_service_library_operations_total',
      help: 'Total number of library operations',
      labelNames: ['operation', 'user_id', 'status'],
      registers: [this.register],
    });

    this.librarySize = new promClient.Gauge({
      name: 'library_service_library_size',
      help: 'Number of games in user libraries',
      labelNames: ['user_id'],
      registers: [this.register],
    });

    this.purchaseHistoryOperations = new promClient.Counter({
      name: 'library_service_purchase_history_operations_total',
      help: 'Total number of purchase history operations',
      labelNames: ['operation', 'user_id', 'status'],
      registers: [this.register],
    });

    this.searchOperations = new promClient.Counter({
      name: 'library_service_search_operations_total',
      help: 'Total number of search operations',
      labelNames: ['type', 'user_id', 'results_count'],
      registers: [this.register],
    });

    this.cacheOperations = new promClient.Counter({
      name: 'library_service_cache_operations_total',
      help: 'Total number of cache operations',
      labelNames: ['operation', 'key_type', 'status'],
      registers: [this.register],
    });
  }

  /**
   * Initialize database metrics
   */
  private initializeDatabaseMetrics(): void {
    this.databaseConnectionsActive = new promClient.Gauge({
      name: 'library_service_database_connections_active',
      help: 'Number of active database connections',
      registers: [this.register],
    });

    this.databaseQueryDuration = new promClient.Histogram({
      name: 'library_service_database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
      registers: [this.register],
    });

    this.databaseOperationsTotal = new promClient.Counter({
      name: 'library_service_database_operations_total',
      help: 'Total number of database operations',
      labelNames: ['operation', 'table', 'status'],
      registers: [this.register],
    });
  }

  /**
   * Initialize external service metrics
   */
  private initializeExternalServiceMetrics(): void {
    this.externalServiceCalls = new promClient.Counter({
      name: 'library_service_external_service_calls_total',
      help: 'Total number of external service calls',
      labelNames: ['service', 'method', 'status_code'],
      registers: [this.register],
    });

    this.externalServiceDuration = new promClient.Histogram({
      name: 'library_service_external_service_duration_seconds',
      help: 'External service call duration in seconds',
      labelNames: ['service', 'method'],
      buckets: [0.1, 0.3, 0.5, 1, 2, 5, 10],
      registers: [this.register],
    });
  }

  /**
   * Initialize error metrics
   */
  private initializeErrorMetrics(): void {
    this.errorsTotal = new promClient.Counter({
      name: 'library_service_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'method', 'route'],
      registers: [this.register],
    });

    this.businessErrorsTotal = new promClient.Counter({
      name: 'library_service_business_errors_total',
      help: 'Total number of business logic errors',
      labelNames: ['error_code', 'operation', 'user_id'],
      registers: [this.register],
    });
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): void {
    this.memoryUsage = new promClient.Gauge({
      name: 'library_service_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.register],
    });

    this.cpuUsage = new promClient.Gauge({
      name: 'library_service_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.register],
    });

    this.eventLoopLag = new promClient.Gauge({
      name: 'library_service_event_loop_lag_seconds',
      help: 'Event loop lag in seconds',
      registers: [this.register],
    });
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
    }, 10000); // Every 10 seconds

    // Monitor CPU usage
    let lastCpuUsage = process.cpuUsage();
    setInterval(() => {
      const currentCpuUsage = process.cpuUsage(lastCpuUsage);
      const totalUsage = currentCpuUsage.user + currentCpuUsage.system;
      const cpuPercent = (totalUsage / 1000000) * 100; // Convert to percentage
      this.cpuUsage.set(cpuPercent);
      lastCpuUsage = process.cpuUsage();
    }, 10000); // Every 10 seconds

    // Monitor event loop lag
    setInterval(() => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e9;
        this.eventLoopLag.set(lag);
      });
    }, 5000); // Every 5 seconds
  }

  // Public methods for recording metrics

  /**
   * Record HTTP request
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number,
    userId?: string,
  ): void {
    const labels = { method, route, status_code: statusCode.toString() };

    this.httpRequestsTotal.inc({ ...labels, user_id: userId || 'anonymous' });
    this.httpRequestDuration.observe(labels, duration / 1000); // Convert to seconds

    if (requestSize) {
      this.httpRequestSize.observe({ method, route }, requestSize);
    }

    if (responseSize) {
      this.httpResponseSize.observe({ ...labels }, responseSize);
    }
  }

  /**
   * Record library operation
   */
  recordLibraryOperation(
    operation: string,
    userId: string,
    status: 'success' | 'error',
  ): void {
    this.libraryOperationsTotal.inc({ operation, user_id: userId, status });
  }

  /**
   * Update library size
   */
  updateLibrarySize(userId: string, size: number): void {
    this.librarySize.set({ user_id: userId }, size);
  }

  /**
   * Record purchase history operation
   */
  recordPurchaseHistoryOperation(
    operation: string,
    userId: string,
    status: 'success' | 'error',
  ): void {
    this.purchaseHistoryOperations.inc({ operation, user_id: userId, status });
  }

  /**
   * Record search operation
   */
  recordSearchOperation(
    type: string,
    userId: string,
    resultsCount: number,
  ): void {
    this.searchOperations.inc({
      type,
      user_id: userId,
      results_count: resultsCount.toString(),
    });
  }

  /**
   * Record cache operation
   */
  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    keyType: string,
    status: 'success' | 'error' = 'success',
  ): void {
    this.cacheOperations.inc({ operation, key_type: keyType, status });
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(
    queryType: string,
    table: string,
    duration: number,
    status: 'success' | 'error',
  ): void {
    this.databaseQueryDuration.observe(
      { query_type: queryType, table },
      duration / 1000,
    );
    this.databaseOperationsTotal.inc({ operation: queryType, table, status });
  }

  /**
   * Update database connections
   */
  updateDatabaseConnections(count: number): void {
    this.databaseConnectionsActive.set(count);
  }

  /**
   * Record external service call
   */
  recordExternalServiceCall(
    service: string,
    method: string,
    statusCode: number,
    duration: number,
  ): void {
    this.externalServiceCalls.inc({
      service,
      method,
      status_code: statusCode.toString(),
    });
    this.externalServiceDuration.observe({ service, method }, duration / 1000);
  }

  /**
   * Record error
   */
  recordError(type: string, method: string, route: string): void {
    this.errorsTotal.inc({ type, method, route });
  }

  /**
   * Record business error
   */
  recordBusinessError(
    errorCode: string,
    operation: string,
    userId: string,
  ): void {
    this.businessErrorsTotal.inc({
      error_code: errorCode,
      operation,
      user_id: userId,
    });
  }
}
