import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsController } from './metrics.controller';
import { SystemMetricsService } from './system-metrics.service';
@Module({
  imports: [PrometheusModule],
  providers: [
    MetricsService,
    MetricsInterceptor,
    SystemMetricsService,

    // User operations metrics
    makeCounterProvider({
      name: 'user_operations_total',
      help: 'Total number of user operations',
      labelNames: ['operation', 'status'],
    }),
    makeHistogramProvider({
      name: 'user_operations_duration_seconds',
      help: 'Duration of user operations in seconds',
      labelNames: ['operation', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    }),

    // Cache metrics
    makeCounterProvider({
      name: 'user_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
    }),
    makeCounterProvider({
      name: 'user_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
    }),
    makeHistogramProvider({
      name: 'user_cache_operations_duration_seconds',
      help: 'Duration of cache operations in seconds',
      labelNames: ['operation', 'cache_type'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
    }),

    // Batch operations metrics
    makeCounterProvider({
      name: 'user_batch_operations_total',
      help: 'Total number of batch operations',
      labelNames: ['operation', 'status'],
    }),
    makeHistogramProvider({
      name: 'user_batch_operations_duration_seconds',
      help: 'Duration of batch operations in seconds',
      labelNames: ['operation', 'status'],
      buckets: [0.5, 1, 2, 5, 10, 30, 60, 120],
    }),
    makeCounterProvider({
      name: 'user_batch_items_processed_total',
      help: 'Total number of items processed in batch operations',
      labelNames: ['operation', 'status'],
    }),

    // External service calls metrics
    makeCounterProvider({
      name: 'user_external_service_calls_total',
      help: 'Total number of external service calls',
      labelNames: ['service', 'operation', 'status'],
    }),
    makeHistogramProvider({
      name: 'user_external_service_calls_duration_seconds',
      help: 'Duration of external service calls in seconds',
      labelNames: ['service', 'operation', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
    }),

    // Database metrics
    makeCounterProvider({
      name: 'user_database_operations_total',
      help: 'Total number of database operations',
      labelNames: ['operation', 'table', 'status'],
    }),
    makeHistogramProvider({
      name: 'user_database_operations_duration_seconds',
      help: 'Duration of database operations in seconds',
      labelNames: ['operation', 'table', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
    }),
    makeCounterProvider({
      name: 'user_database_slow_queries_total',
      help: 'Total number of slow database queries',
      labelNames: ['query_type', 'table'],
    }),

    // System metrics
    makeGaugeProvider({
      name: 'user_service_active_connections',
      help: 'Number of active connections to the service',
      labelNames: ['connection_type'],
    }),
    makeGaugeProvider({
      name: 'user_service_memory_usage_bytes',
      help: 'Memory usage of the service in bytes',
      labelNames: ['memory_type'],
    }),
    makeGaugeProvider({
      name: 'user_service_database_pool_size',
      help: 'Current database connection pool size',
      labelNames: ['pool_type'],
    }),
  ],
  controllers: [MetricsController],
  exports: [MetricsService, MetricsInterceptor, SystemMetricsService],
})
export class MetricsModule {}
