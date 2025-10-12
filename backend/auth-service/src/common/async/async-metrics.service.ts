import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface PerformanceMetric {
  operationType: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  priority: string;
  queueTime?: number;
  retries?: number;
}

export interface AggregatedMetrics {
  operationType: string;
  totalOperations: number;
  successRate: number;
  averageDuration: number;
  p50Duration: number;
  p95Duration: number;
  p99Duration: number;
  averageQueueTime: number;
  totalRetries: number;
  lastUpdated: Date;
}

export interface SystemMetrics {
  totalOperations: number;
  operationsPerSecond: number;
  averageSystemLoad: number;
  backpressureEvents: number;
  queueSizes: {
    high: number;
    normal: number;
    low: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  lastUpdated: Date;
}

@Injectable()
export class AsyncMetricsService extends EventEmitter implements OnModuleDestroy {
  private readonly logger = new Logger(AsyncMetricsService.name);
  private readonly metrics = new Map<string, PerformanceMetric[]>();
  private readonly aggregatedMetrics = new Map<string, AggregatedMetrics>();
  private readonly systemMetrics: SystemMetrics = {
    totalOperations: 0,
    operationsPerSecond: 0,
    averageSystemLoad: 0,
    backpressureEvents: 0,
    queueSizes: { high: 0, normal: 0, low: 0 },
    memoryUsage: { heapUsed: 0, heapTotal: 0, external: 0 },
    lastUpdated: new Date(),
  };

  private readonly maxMetricsPerType = 10000;
  private readonly aggregationInterval = 60000; // 1 minute
  private readonly cleanupInterval = 300000; // 5 minutes
  private operationCounter = 0;
  private lastOperationCount = 0;
  private lastOperationTime = Date.now();
  
  // Timer references for cleanup
  private aggregationTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private systemMetricsTimer?: NodeJS.Timeout;

  constructor() {
    super();
    this.startAggregation();
    this.startCleanup();
    this.startSystemMetricsCollection();
  }

  /**
   * Record performance metric for an operation
   */
  recordMetric(metric: PerformanceMetric): void {
    const { operationType } = metric;
    
    if (!this.metrics.has(operationType)) {
      this.metrics.set(operationType, []);
    }

    const typeMetrics = this.metrics.get(operationType)!;
    typeMetrics.push(metric);

    // Limit metrics per type to prevent memory issues
    if (typeMetrics.length > this.maxMetricsPerType) {
      typeMetrics.splice(0, typeMetrics.length - this.maxMetricsPerType);
    }

    this.operationCounter++;
    this.updateSystemMetrics();

    this.logger.debug('Performance metric recorded', {
      operationType,
      duration: metric.duration,
      success: metric.success,
      priority: metric.priority,
    });

    this.emit('metric-recorded', metric);
  }

  /**
   * Record authentication flow metrics (critical path)
   */
  recordAuthFlowMetric(
    operation: 'register' | 'login' | 'logout' | 'validate' | 'refresh',
    duration: number,
    success: boolean,
    metadata?: any
  ): void {
    this.recordMetric({
      operationType: `auth_${operation}`,
      duration,
      timestamp: new Date(),
      success,
      priority: 'high',
      ...metadata,
    });

    // Emit specific auth flow events for monitoring
    this.emit('auth-flow-metric', {
      operation,
      duration,
      success,
      metadata,
    });

    // Alert on slow auth operations
    if (duration > 5000) { // 5 seconds
      this.logger.warn('Slow authentication operation detected', {
        operation,
        duration,
        success,
        metadata,
      });
      this.emit('slow-auth-operation', { operation, duration, success });
    }
  }

  /**
   * Record event processing metrics
   */
  recordEventMetric(
    eventType: string,
    duration: number,
    success: boolean,
    queueTime?: number,
    retries?: number
  ): void {
    this.recordMetric({
      operationType: `event_${eventType}`,
      duration,
      timestamp: new Date(),
      success,
      priority: 'normal',
      queueTime,
      retries,
    });
  }

  /**
   * Record external service call metrics
   */
  recordExternalServiceMetric(
    serviceName: string,
    operation: string,
    duration: number,
    success: boolean,
    statusCode?: number
  ): void {
    this.recordMetric({
      operationType: `external_${serviceName}_${operation}`,
      duration,
      timestamp: new Date(),
      success,
      priority: 'normal',
    });

    // Track service availability
    this.emit('external-service-call', {
      serviceName,
      operation,
      duration,
      success,
      statusCode,
    });
  }

  /**
   * Record backpressure event
   */
  recordBackpressureEvent(queueSizes: any, rejectedOperations: number): void {
    this.systemMetrics.backpressureEvents++;
    this.systemMetrics.queueSizes = queueSizes;

    this.logger.warn('Backpressure event recorded', {
      queueSizes,
      rejectedOperations,
      totalBackpressureEvents: this.systemMetrics.backpressureEvents,
    });

    this.emit('backpressure-event', {
      queueSizes,
      rejectedOperations,
      timestamp: new Date(),
    });
  }

  /**
   * Get aggregated metrics for specific operation type
   */
  getAggregatedMetrics(operationType: string): AggregatedMetrics | null {
    return this.aggregatedMetrics.get(operationType) || null;
  }

  /**
   * Get all aggregated metrics
   */
  getAllAggregatedMetrics(): Record<string, AggregatedMetrics> {
    const result: Record<string, AggregatedMetrics> = {};
    for (const [type, metrics] of this.aggregatedMetrics.entries()) {
      result[type] = metrics;
    }
    return result;
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Get performance summary for monitoring dashboard
   */
  getPerformanceSummary(): {
    authFlow: {
      averageLoginTime: number;
      loginSuccessRate: number;
      averageRegisterTime: number;
      registerSuccessRate: number;
    };
    eventProcessing: {
      averageProcessingTime: number;
      successRate: number;
      backlogSize: number;
    };
    externalServices: {
      [serviceName: string]: {
        averageResponseTime: number;
        successRate: number;
        availability: number;
      };
    };
    system: SystemMetrics;
  } {
    const authLogin = this.getAggregatedMetrics('auth_login');
    const authRegister = this.getAggregatedMetrics('auth_register');
    
    // Calculate event processing metrics
    const eventMetrics = Array.from(this.aggregatedMetrics.entries())
      .filter(([type]) => type.startsWith('event_'));
    
    const avgEventTime = eventMetrics.length > 0
      ? eventMetrics.reduce((sum, [, metrics]) => sum + metrics.averageDuration, 0) / eventMetrics.length
      : 0;
    
    const eventSuccessRate = eventMetrics.length > 0
      ? eventMetrics.reduce((sum, [, metrics]) => sum + metrics.successRate, 0) / eventMetrics.length
      : 100;

    // Calculate external service metrics
    const externalServices: any = {};
    Array.from(this.aggregatedMetrics.entries())
      .filter(([type]) => type.startsWith('external_'))
      .forEach(([type, metrics]) => {
        const serviceName = type.split('_')[1];
        if (!externalServices[serviceName]) {
          externalServices[serviceName] = {
            averageResponseTime: 0,
            successRate: 0,
            availability: 0,
            count: 0,
          };
        }
        externalServices[serviceName].averageResponseTime += metrics.averageDuration;
        externalServices[serviceName].successRate += metrics.successRate;
        externalServices[serviceName].count++;
      });

    // Average external service metrics
    Object.keys(externalServices).forEach(serviceName => {
      const service = externalServices[serviceName];
      service.averageResponseTime /= service.count;
      service.successRate /= service.count;
      service.availability = service.successRate; // Simplified availability calculation
      delete service.count;
    });

    return {
      authFlow: {
        averageLoginTime: authLogin?.averageDuration || 0,
        loginSuccessRate: authLogin?.successRate || 0,
        averageRegisterTime: authRegister?.averageDuration || 0,
        registerSuccessRate: authRegister?.successRate || 0,
      },
      eventProcessing: {
        averageProcessingTime: avgEventTime,
        successRate: eventSuccessRate,
        backlogSize: this.systemMetrics.queueSizes.high + 
                    this.systemMetrics.queueSizes.normal + 
                    this.systemMetrics.queueSizes.low,
      },
      externalServices,
      system: this.getSystemMetrics(),
    };
  }

  /**
   * Get health status based on metrics
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
    metrics: any;
  } {
    const issues: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Check auth flow performance
    const authLogin = this.getAggregatedMetrics('auth_login');
    if (authLogin) {
      if (authLogin.averageDuration > 3000) {
        issues.push('Slow login performance');
        status = 'degraded';
      }
      if (authLogin.successRate < 95) {
        issues.push('Low login success rate');
        status = 'unhealthy';
      }
    }

    // Check system load
    if (this.systemMetrics.operationsPerSecond > 1000) {
      issues.push('High operation load');
      status = status === 'unhealthy' ? 'unhealthy' : 'degraded';
    }

    // Check backpressure
    if (this.systemMetrics.backpressureEvents > 10) {
      issues.push('Frequent backpressure events');
      status = 'degraded';
    }

    // Check memory usage
    const memUsagePercent = (this.systemMetrics.memoryUsage.heapUsed / 
                            this.systemMetrics.memoryUsage.heapTotal) * 100;
    if (memUsagePercent > 90) {
      issues.push('High memory usage');
      status = 'unhealthy';
    }

    return {
      status,
      issues,
      metrics: this.getPerformanceSummary(),
    };
  }

  /**
   * Start aggregation of metrics
   */
  private startAggregation(): void {
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationInterval);
  }

  /**
   * Aggregate raw metrics into summary statistics
   */
  private aggregateMetrics(): void {
    for (const [operationType, rawMetrics] of this.metrics.entries()) {
      if (rawMetrics.length === 0) continue;

      const recentMetrics = rawMetrics.filter(
        m => Date.now() - m.timestamp.getTime() < this.aggregationInterval * 5
      );

      if (recentMetrics.length === 0) continue;

      const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);
      const queueTimes = recentMetrics
        .map(m => m.queueTime)
        .filter(t => t !== undefined) as number[];
      
      const successCount = recentMetrics.filter(m => m.success).length;
      const totalRetries = recentMetrics.reduce((sum, m) => sum + (m.retries || 0), 0);

      const aggregated: AggregatedMetrics = {
        operationType,
        totalOperations: recentMetrics.length,
        successRate: (successCount / recentMetrics.length) * 100,
        averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        p50Duration: this.percentile(durations, 50),
        p95Duration: this.percentile(durations, 95),
        p99Duration: this.percentile(durations, 99),
        averageQueueTime: queueTimes.length > 0 
          ? queueTimes.reduce((sum, t) => sum + t, 0) / queueTimes.length 
          : 0,
        totalRetries,
        lastUpdated: new Date(),
      };

      this.aggregatedMetrics.set(operationType, aggregated);
    }

    this.emit('metrics-aggregated', {
      timestamp: new Date(),
      operationTypes: Array.from(this.aggregatedMetrics.keys()),
    });
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((p / 100) * values.length) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))];
  }

  /**
   * Update system metrics
   */
  private updateSystemMetrics(): void {
    const now = Date.now();
    const timeDiff = now - this.lastOperationTime;
    
    if (timeDiff >= 1000) { // Update every second
      this.systemMetrics.operationsPerSecond = 
        (this.operationCounter - this.lastOperationCount) / (timeDiff / 1000);
      this.lastOperationCount = this.operationCounter;
      this.lastOperationTime = now;
    }

    this.systemMetrics.totalOperations = this.operationCounter;
    this.systemMetrics.lastUpdated = new Date();
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetricsCollection(): void {
    this.systemMetricsTimer = setInterval(() => {
      const memUsage = process.memoryUsage();
      this.systemMetrics.memoryUsage = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
      };

      // Simple load average (could be enhanced with actual system load)
      this.systemMetrics.averageSystemLoad = this.systemMetrics.operationsPerSecond / 100;
    }, 5000); // Every 5 seconds
  }

  /**
   * Start cleanup of old metrics
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      
      for (const [operationType, rawMetrics] of this.metrics.entries()) {
        const filtered = rawMetrics.filter(m => m.timestamp.getTime() > cutoff);
        this.metrics.set(operationType, filtered);
      }

      this.logger.debug('Cleaned up old metrics', {
        operationTypes: this.metrics.size,
        timestamp: new Date(),
      });
    }, this.cleanupInterval);
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.metrics.clear();
    this.aggregatedMetrics.clear();
    this.operationCounter = 0;
    this.lastOperationCount = 0;
    this.systemMetrics.totalOperations = 0;
    this.systemMetrics.backpressureEvents = 0;
    this.logger.log('All metrics reset');
  }

  /**
   * Cleanup timers when module is destroyed
   */
  onModuleDestroy(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = undefined;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    if (this.systemMetricsTimer) {
      clearInterval(this.systemMetricsTimer);
      this.systemMetricsTimer = undefined;
    }
    this.logger.log('AsyncMetricsService timers cleaned up');
  }
}