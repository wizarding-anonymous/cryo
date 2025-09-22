import { Injectable, Logger } from '@nestjs/common';
import { Counter, Histogram, Gauge, register } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  // HTTP request metrics
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  
  // Database metrics
  private readonly dbConnectionsActive: Gauge<string>;
  private readonly dbQueryDuration: Histogram<string>;
  private readonly dbQueryErrors: Counter<string>;
  
  // Cache metrics
  private readonly cacheHits: Counter<string>;
  private readonly cacheMisses: Counter<string>;
  private readonly cacheErrors: Counter<string>;
  
  // Application metrics
  private readonly gamesCatalogSize: Gauge<string>;
  private readonly searchRequests: Counter<string>;
  private readonly healthCheckDuration: Histogram<string>;

  constructor() {
    // Initialize HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'game_catalog_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestDuration = new Histogram({
      name: 'game_catalog_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    });

    // Initialize database metrics
    this.dbConnectionsActive = new Gauge({
      name: 'game_catalog_db_connections_active',
      help: 'Number of active database connections',
    });

    this.dbQueryDuration = new Histogram({
      name: 'game_catalog_db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    });

    this.dbQueryErrors = new Counter({
      name: 'game_catalog_db_query_errors_total',
      help: 'Total number of database query errors',
      labelNames: ['operation', 'error_type'],
    });

    // Initialize cache metrics
    this.cacheHits = new Counter({
      name: 'game_catalog_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key_type'],
    });

    this.cacheMisses = new Counter({
      name: 'game_catalog_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key_type'],
    });

    this.cacheErrors = new Counter({
      name: 'game_catalog_cache_errors_total',
      help: 'Total number of cache errors',
      labelNames: ['operation', 'error_type'],
    });

    // Initialize application metrics
    this.gamesCatalogSize = new Gauge({
      name: 'game_catalog_games_total',
      help: 'Total number of games in catalog',
    });

    this.searchRequests = new Counter({
      name: 'game_catalog_search_requests_total',
      help: 'Total number of search requests',
      labelNames: ['search_type'],
    });

    this.healthCheckDuration = new Histogram({
      name: 'game_catalog_health_check_duration_seconds',
      help: 'Duration of health checks in seconds',
      labelNames: ['check_type'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
    });

    // Register all metrics
    register.registerMetric(this.httpRequestsTotal);
    register.registerMetric(this.httpRequestDuration);
    register.registerMetric(this.dbConnectionsActive);
    register.registerMetric(this.dbQueryDuration);
    register.registerMetric(this.dbQueryErrors);
    register.registerMetric(this.cacheHits);
    register.registerMetric(this.cacheMisses);
    register.registerMetric(this.cacheErrors);
    register.registerMetric(this.gamesCatalogSize);
    register.registerMetric(this.searchRequests);
    register.registerMetric(this.healthCheckDuration);

    this.logger.log('Metrics service initialized with Prometheus collectors');
  }

  // HTTP metrics methods
  incrementHttpRequests(method: string, route: string, statusCode: number): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
  }

  recordHttpRequestDuration(method: string, route: string, duration: number): void {
    this.httpRequestDuration.observe({ method, route }, duration);
  }

  // Database metrics methods
  setActiveDbConnections(count: number): void {
    this.dbConnectionsActive.set(count);
  }

  recordDbQueryDuration(operation: string, duration: number): void {
    this.dbQueryDuration.observe({ operation }, duration);
  }

  incrementDbQueryErrors(operation: string, errorType: string): void {
    this.dbQueryErrors.inc({ operation, error_type: errorType });
  }

  // Cache metrics methods
  incrementCacheHits(cacheKeyType: string): void {
    this.cacheHits.inc({ cache_key_type: cacheKeyType });
  }

  incrementCacheMisses(cacheKeyType: string): void {
    this.cacheMisses.inc({ cache_key_type: cacheKeyType });
  }

  incrementCacheErrors(operation: string, errorType: string): void {
    this.cacheErrors.inc({ operation, error_type: errorType });
  }

  // Application metrics methods
  setGamesCatalogSize(count: number): void {
    this.gamesCatalogSize.set(count);
  }

  incrementSearchRequests(searchType: string): void {
    this.searchRequests.inc({ search_type: searchType });
  }

  recordHealthCheckDuration(checkType: string, duration: number): void {
    this.healthCheckDuration.observe({ check_type: checkType }, duration);
  }

  /**
   * Get current metrics summary for logging
   */
  getMetricsSummary(): Record<string, any> {
    return {
      httpRequests: this.httpRequestsTotal['hashMap'],
      dbConnections: this.dbConnectionsActive['value'],
      cacheHits: this.cacheHits['hashMap'],
      gamesCatalogSize: this.gamesCatalogSize['value'],
    };
  }
}