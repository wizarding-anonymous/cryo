import { makeCounterProvider, makeGaugeProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

export const metricsProviders = [
  // Health check metrics
  makeCounterProvider({
    name: 'library_service_health_checks_total',
    help: 'Total number of health checks performed',
    labelNames: ['component', 'status'],
  }),

  // External service status (1 = healthy, 0 = unhealthy)
  makeGaugeProvider({
    name: 'library_service_external_service_status',
    help: 'Status of external services (1 = healthy, 0 = unhealthy)',
    labelNames: ['service'],
  }),

  // External service response times
  makeHistogramProvider({
    name: 'library_service_external_service_response_time',
    help: 'Response time of external services in seconds',
    labelNames: ['service'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  // Database connection metrics
  makeGaugeProvider({
    name: 'library_service_database_connections',
    help: 'Number of database connections',
    labelNames: ['type'], // active, idle
  }),

  // Cache operation metrics
  makeCounterProvider({
    name: 'library_service_cache_operations_total',
    help: 'Total number of cache operations',
    labelNames: ['operation', 'status'], // operation: get/set/del, status: hit/miss/error
  }),

  // Circuit breaker state (0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN)
  makeGaugeProvider({
    name: 'library_service_circuit_breaker_state',
    help: 'Circuit breaker state (0 = CLOSED, 1 = HALF_OPEN, 2 = OPEN)',
    labelNames: ['service'],
  }),

  // Library service specific metrics
  makeCounterProvider({
    name: 'library_service_requests_total',
    help: 'Total number of requests to library service',
    labelNames: ['method', 'endpoint', 'status'],
  }),

  makeHistogramProvider({
    name: 'library_service_request_duration',
    help: 'Request duration in seconds',
    labelNames: ['method', 'endpoint'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  }),

  makeGaugeProvider({
    name: 'library_service_active_users',
    help: 'Number of active users with libraries',
  }),

  makeCounterProvider({
    name: 'library_service_games_added_total',
    help: 'Total number of games added to libraries',
  }),

  makeCounterProvider({
    name: 'library_service_searches_total',
    help: 'Total number of library searches performed',
    labelNames: ['type'], // library, history
  }),
];