import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as client from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly register: client.Registry;
  
  // HTTP metrics
  private readonly httpRequestsTotal: client.Counter<string>;
  private readonly httpRequestDuration: client.Histogram<string>;
  
  // Achievement metrics
  private readonly achievementsUnlockedTotal: client.Counter<string>;
  private readonly progressUpdatesTotal: client.Counter<string>;
  private readonly achievementCheckDuration: client.Histogram<string>;
  
  // Service integration metrics
  private readonly serviceCallsTotal: client.Counter<string>;
  private readonly serviceCallDuration: client.Histogram<string>;
  private readonly serviceErrorsTotal: client.Counter<string>;
  
  // Database metrics
  private readonly databaseConnectionsActive: client.Gauge<string>;
  private readonly databaseQueryDuration: client.Histogram<string>;
  
  // Cache metrics
  private readonly cacheHitsTotal: client.Counter<string>;
  private readonly cacheMissesTotal: client.Counter<string>;

  constructor(private readonly configService: ConfigService) {
    this.register = new client.Registry();
    
    // Collect default metrics
    client.collectDefaultMetrics({ register: this.register });
    
    // HTTP metrics
    this.httpRequestsTotal = new client.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });
    
    this.httpRequestDuration = new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
      registers: [this.register],
    });
    
    // Achievement metrics
    this.achievementsUnlockedTotal = new client.Counter({
      name: 'achievements_unlocked_total',
      help: 'Total number of achievements unlocked',
      labelNames: ['achievement_type', 'user_id'],
      registers: [this.register],
    });
    
    this.progressUpdatesTotal = new client.Counter({
      name: 'progress_updates_total',
      help: 'Total number of progress updates',
      labelNames: ['event_type', 'achievement_type'],
      registers: [this.register],
    });
    
    this.achievementCheckDuration = new client.Histogram({
      name: 'achievement_check_duration_seconds',
      help: 'Duration of achievement condition checks',
      labelNames: ['achievement_type'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1],
      registers: [this.register],
    });
    
    // Service integration metrics
    this.serviceCallsTotal = new client.Counter({
      name: 'service_calls_total',
      help: 'Total number of external service calls',
      labelNames: ['service_name', 'method', 'status'],
      registers: [this.register],
    });
    
    this.serviceCallDuration = new client.Histogram({
      name: 'service_call_duration_seconds',
      help: 'Duration of external service calls',
      labelNames: ['service_name', 'method'],
      buckets: [0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.register],
    });
    
    this.serviceErrorsTotal = new client.Counter({
      name: 'service_errors_total',
      help: 'Total number of service integration errors',
      labelNames: ['service_name', 'error_type'],
      registers: [this.register],
    });
    
    // Database metrics
    this.databaseConnectionsActive = new client.Gauge({
      name: 'database_connections_active',
      help: 'Number of active database connections',
      registers: [this.register],
    });
    
    this.databaseQueryDuration = new client.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries',
      labelNames: ['query_type', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
      registers: [this.register],
    });
    
    // Cache metrics
    this.cacheHitsTotal = new client.Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key'],
      registers: [this.register],
    });
    
    this.cacheMissesTotal = new client.Counter({
      name: 'cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key'],
      registers: [this.register],
    });
  }

  onModuleInit() {
    // Initialize any startup metrics
  }

  getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  // HTTP metrics methods
  incrementHttpRequests(method: string, route: string, statusCode: number) {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode.toString() });
  }

  observeHttpRequestDuration(method: string, route: string, statusCode: number, duration: number) {
    this.httpRequestDuration.observe(
      { method, route, status_code: statusCode.toString() },
      duration
    );
  }

  // Achievement metrics methods
  incrementAchievementUnlocked(achievementType: string, userId: string) {
    this.achievementsUnlockedTotal.inc({ achievement_type: achievementType, user_id: userId });
  }

  incrementProgressUpdate(eventType: string, achievementType: string) {
    this.progressUpdatesTotal.inc({ event_type: eventType, achievement_type: achievementType });
  }

  observeAchievementCheckDuration(achievementType: string, duration: number) {
    this.achievementCheckDuration.observe({ achievement_type: achievementType }, duration);
  }

  // Service integration metrics methods
  incrementServiceCall(serviceName: string, method: string, status: string) {
    this.serviceCallsTotal.inc({ service_name: serviceName, method, status });
  }

  observeServiceCallDuration(serviceName: string, method: string, duration: number) {
    this.serviceCallDuration.observe({ service_name: serviceName, method }, duration);
  }

  incrementServiceError(serviceName: string, errorType: string) {
    this.serviceErrorsTotal.inc({ service_name: serviceName, error_type: errorType });
  }

  // Database metrics methods
  setDatabaseConnectionsActive(count: number) {
    this.databaseConnectionsActive.set(count);
  }

  observeDatabaseQueryDuration(queryType: string, table: string, duration: number) {
    this.databaseQueryDuration.observe({ query_type: queryType, table }, duration);
  }

  // Cache metrics methods
  incrementCacheHit(cacheKey: string) {
    this.cacheHitsTotal.inc({ cache_key: cacheKey });
  }

  incrementCacheMiss(cacheKey: string) {
    this.cacheMissesTotal.inc({ cache_key: cacheKey });
  }
}