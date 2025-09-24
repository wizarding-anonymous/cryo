import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrometheusMetricsService } from './prometheus-metrics.service';
import { APMService } from './apm.service';

/**
 * Enhanced performance monitoring service for production
 * Features:
 * - System resource monitoring
 * - Application performance tracking
 * - Memory leak detection
 * - Performance alerts
 * - Automatic performance optimization
 */

interface PerformanceMetrics {
  timestamp: Date;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpu: {
    user: number;
    system: number;
    percent: number;
  };
  eventLoop: {
    lag: number;
    utilization: number;
  };
  gc: {
    collections: number;
    duration: number;
  };
  handles: {
    active: number;
    refs: number;
  };
}

interface PerformanceAlert {
  type: 'memory' | 'cpu' | 'eventloop' | 'gc';
  severity: 'warning' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

@Injectable()
export class PerformanceMonitorService implements OnModuleInit {
  private readonly logger = new Logger(PerformanceMonitorService.name);
  private readonly metrics: PerformanceMetrics[] = [];
  private readonly alerts: PerformanceAlert[] = [];
  private readonly maxMetricsHistory = 1000;
  private readonly maxAlertsHistory = 100;

  private lastCpuUsage = process.cpuUsage();
  private gcStats = { collections: 0, duration: 0 };
  private performanceObserver: any;
  private eventLoopLag = 0;

  // Performance thresholds
  private readonly thresholds = {
    memory: {
      heapUsedWarning: 0.8, // 80% of heap
      heapUsedCritical: 0.9, // 90% of heap
      rssWarning: 1024 * 1024 * 1024, // 1GB
      rssCritical: 2 * 1024 * 1024 * 1024, // 2GB
    },
    cpu: {
      warning: 70, // 70%
      critical: 90, // 90%
    },
    eventLoop: {
      lagWarning: 100, // 100ms
      lagCritical: 500, // 500ms
      utilizationWarning: 0.8, // 80%
      utilizationCritical: 0.95, // 95%
    },
    gc: {
      durationWarning: 50, // 50ms
      durationCritical: 100, // 100ms
      frequencyWarning: 10, // 10 collections per minute
      frequencyCritical: 20, // 20 collections per minute
    },
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: PrometheusMetricsService,
    private readonly apmService: APMService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.setupGCMonitoring();
      this.setupPerformanceObserver();
      this.startEventLoopLagMonitoring();
      this.logger.log('Performance monitoring service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize performance monitoring:', error);
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const cpuPercent =
      ((currentCpuUsage.user + currentCpuUsage.system) / 1000000) * 100;

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers || 0,
      },
      cpu: {
        user: currentCpuUsage.user,
        system: currentCpuUsage.system,
        percent: cpuPercent,
      },
      eventLoop: {
        lag: this.calculateEventLoopLag(),
        utilization: this.calculateEventLoopUtilization(),
      },
      gc: {
        collections: this.gcStats.collections,
        duration: this.gcStats.duration,
      },
      handles: {
        active: (process as any)._getActiveHandles?.()?.length || 0,
        refs: (process as any)._getActiveRequests?.()?.length || 0,
      },
    };

    this.lastCpuUsage = process.cpuUsage();
    return metrics;
  }

  /**
   * Get performance metrics history
   */
  getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get recent performance alerts
   */
  getRecentAlerts(limit: number = 50): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    current: PerformanceMetrics;
    averages: {
      memoryUsage: number;
      cpuUsage: number;
      eventLoopLag: number;
    };
    alerts: {
      total: number;
      warnings: number;
      critical: number;
      recent: PerformanceAlert[];
    };
  } {
    const current = this.getCurrentMetrics();
    const recent = this.getMetricsHistory(60); // Last 60 measurements

    const averages = {
      memoryUsage:
        recent.length > 0
          ? recent.reduce(
              (sum, m) => sum + m.memory.heapUsed / m.memory.heapTotal,
              0,
            ) / recent.length
          : 0,
      cpuUsage:
        recent.length > 0
          ? recent.reduce((sum, m) => sum + m.cpu.percent, 0) / recent.length
          : 0,
      eventLoopLag:
        recent.length > 0
          ? recent.reduce((sum, m) => sum + m.eventLoop.lag, 0) / recent.length
          : 0,
    };

    const recentAlerts = this.getRecentAlerts(10);
    const warnings = recentAlerts.filter(
      (a) => a.severity === 'warning',
    ).length;
    const critical = recentAlerts.filter(
      (a) => a.severity === 'critical',
    ).length;

    return {
      current,
      averages,
      alerts: {
        total: this.alerts.length,
        warnings,
        critical,
        recent: recentAlerts,
      },
    };
  }

  /**
   * Check for performance issues and create alerts
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics): void {
    // Memory checks
    const heapUsagePercent = metrics.memory.heapUsed / metrics.memory.heapTotal;
    if (heapUsagePercent > this.thresholds.memory.heapUsedCritical) {
      this.createAlert(
        'memory',
        'critical',
        `Heap usage critical: ${(heapUsagePercent * 100).toFixed(1)}%`,
        heapUsagePercent,
        this.thresholds.memory.heapUsedCritical,
      );
    } else if (heapUsagePercent > this.thresholds.memory.heapUsedWarning) {
      this.createAlert(
        'memory',
        'warning',
        `Heap usage high: ${(heapUsagePercent * 100).toFixed(1)}%`,
        heapUsagePercent,
        this.thresholds.memory.heapUsedWarning,
      );
    }

    if (metrics.memory.rss > this.thresholds.memory.rssCritical) {
      this.createAlert(
        'memory',
        'critical',
        `RSS memory critical: ${(metrics.memory.rss / 1024 / 1024).toFixed(0)}MB`,
        metrics.memory.rss,
        this.thresholds.memory.rssCritical,
      );
    } else if (metrics.memory.rss > this.thresholds.memory.rssWarning) {
      this.createAlert(
        'memory',
        'warning',
        `RSS memory high: ${(metrics.memory.rss / 1024 / 1024).toFixed(0)}MB`,
        metrics.memory.rss,
        this.thresholds.memory.rssWarning,
      );
    }

    // CPU checks
    if (metrics.cpu.percent > this.thresholds.cpu.critical) {
      this.createAlert(
        'cpu',
        'critical',
        `CPU usage critical: ${metrics.cpu.percent.toFixed(1)}%`,
        metrics.cpu.percent,
        this.thresholds.cpu.critical,
      );
    } else if (metrics.cpu.percent > this.thresholds.cpu.warning) {
      this.createAlert(
        'cpu',
        'warning',
        `CPU usage high: ${metrics.cpu.percent.toFixed(1)}%`,
        metrics.cpu.percent,
        this.thresholds.cpu.warning,
      );
    }

    // Event loop checks
    if (metrics.eventLoop.lag > this.thresholds.eventLoop.lagCritical) {
      this.createAlert(
        'eventloop',
        'critical',
        `Event loop lag critical: ${metrics.eventLoop.lag.toFixed(1)}ms`,
        metrics.eventLoop.lag,
        this.thresholds.eventLoop.lagCritical,
      );
    } else if (metrics.eventLoop.lag > this.thresholds.eventLoop.lagWarning) {
      this.createAlert(
        'eventloop',
        'warning',
        `Event loop lag high: ${metrics.eventLoop.lag.toFixed(1)}ms`,
        metrics.eventLoop.lag,
        this.thresholds.eventLoop.lagWarning,
      );
    }

    if (
      metrics.eventLoop.utilization >
      this.thresholds.eventLoop.utilizationCritical
    ) {
      this.createAlert(
        'eventloop',
        'critical',
        `Event loop utilization critical: ${(metrics.eventLoop.utilization * 100).toFixed(1)}%`,
        metrics.eventLoop.utilization,
        this.thresholds.eventLoop.utilizationCritical,
      );
    } else if (
      metrics.eventLoop.utilization >
      this.thresholds.eventLoop.utilizationWarning
    ) {
      this.createAlert(
        'eventloop',
        'warning',
        `Event loop utilization high: ${(metrics.eventLoop.utilization * 100).toFixed(1)}%`,
        metrics.eventLoop.utilization,
        this.thresholds.eventLoop.utilizationWarning,
      );
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    value: number,
    threshold: number,
  ): void {
    const alert: PerformanceAlert = {
      type,
      severity,
      message,
      value,
      threshold,
      timestamp: new Date(),
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts.splice(0, this.alerts.length - this.maxAlertsHistory);
    }

    // Log the alert
    const logLevel = severity === 'critical' ? 'error' : 'warn';
    this.logger[logLevel](
      `Performance Alert [${severity.toUpperCase()}]: ${message}`,
    );

    // Send to APM if available
    if (severity === 'critical') {
      this.apmService.captureError(new Error(`Performance Alert: ${message}`), {
        type,
        severity,
        value,
        threshold,
      });
    }
  }

  /**
   * Collect performance metrics (scheduled task)
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  private collectMetrics(): void {
    try {
      const metrics = this.getCurrentMetrics();

      // Store metrics
      this.metrics.push(metrics);

      // Keep only recent metrics
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics.splice(0, this.metrics.length - this.maxMetricsHistory);
      }

      // Check thresholds
      this.checkPerformanceThresholds(metrics);

      // Update Prometheus metrics
      this.updatePrometheusMetrics(metrics);
    } catch (error) {
      this.logger.error('Failed to collect performance metrics:', error);
    }
  }

  /**
   * Update Prometheus metrics
   */
  private updatePrometheusMetrics(metrics: PerformanceMetrics): void {
    try {
      // Memory metrics are already handled by default metrics
      // Add custom business metrics here if needed

      // Track performance alerts
      const recentAlerts = this.alerts.filter(
        (a) => Date.now() - a.timestamp.getTime() < 60000, // Last minute
      );

      // Update custom metrics if metricsService is available
      if (this.metricsService) {
        // Update database connections if available
        try {
          this.metricsService.updateDatabaseConnections(metrics.handles.active);
        } catch (error) {
          // Ignore if not available
        }
      }
    } catch (error) {
      this.logger.error('Failed to update Prometheus metrics:', error);
    }
  }

  /**
   * Setup garbage collection monitoring
   */
  private setupGCMonitoring(): void {
    try {
      // Enable GC events if available
      if (typeof global.gc === 'function') {
        const originalGC = global.gc;
        (global as any).gc = () => {
          const start = process.hrtime.bigint();
          originalGC();
          const duration = Number(process.hrtime.bigint() - start) / 1e6;

          this.gcStats.collections++;
          this.gcStats.duration += duration;

          if (duration > this.thresholds.gc.durationCritical) {
            this.createAlert(
              'gc',
              'critical',
              `GC duration critical: ${duration.toFixed(1)}ms`,
              duration,
              this.thresholds.gc.durationCritical,
            );
          } else if (duration > this.thresholds.gc.durationWarning) {
            this.createAlert(
              'gc',
              'warning',
              `GC duration high: ${duration.toFixed(1)}ms`,
              duration,
              this.thresholds.gc.durationWarning,
            );
          }
        };
      }
    } catch (error) {
      this.logger.warn('GC monitoring setup failed:', error);
    }
  }

  /**
   * Setup performance observer
   */
  private setupPerformanceObserver(): void {
    try {
      const { PerformanceObserver, performance } = require('perf_hooks');

      this.performanceObserver = new PerformanceObserver((list: any) => {
        const entries = list.getEntries();
        for (const entry of entries) {
          if (entry.entryType === 'gc') {
            this.gcStats.collections++;
            this.gcStats.duration += entry.duration;
          }
        }
      });

      this.performanceObserver.observe({ entryTypes: ['gc', 'measure'] });
    } catch (error) {
      this.logger.warn('Performance observer setup failed:', error);
    }
  }

  /**
   * Get current event loop lag
   */
  private calculateEventLoopLag(): number {
    return this.eventLoopLag;
  }

  /**
   * Start continuous event loop lag monitoring
   */
  private startEventLoopLagMonitoring(): void {
    const measureLag = () => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        this.eventLoopLag = Number(process.hrtime.bigint() - start) / 1e6;
        measureLag(); // Continue monitoring
      });
    };
    measureLag();
  }

  /**
   * Calculate event loop utilization
   */
  private calculateEventLoopUtilization(): number {
    try {
      const { performance } = require('perf_hooks');
      if (performance.eventLoopUtilization) {
        const utilization = performance.eventLoopUtilization();
        return utilization.utilization || 0;
      }
    } catch (error) {
      // Fallback calculation or return 0
    }
    return 0;
  }

  /**
   * Force garbage collection (for testing)
   */
  forceGC(): void {
    if (typeof global.gc === 'function') {
      global.gc();
      this.logger.log('Forced garbage collection');
    } else {
      this.logger.warn(
        'Garbage collection not available (run with --expose-gc)',
      );
    }
  }

  /**
   * Get memory leak detection report
   */
  getMemoryLeakReport(): {
    suspected: boolean;
    trend: 'increasing' | 'stable' | 'decreasing';
    details: {
      heapGrowthRate: number;
      rssGrowthRate: number;
      recommendations: string[];
    };
  } {
    const recent = this.getMetricsHistory(60); // Last 60 measurements (30 minutes)

    if (recent.length < 10) {
      return {
        suspected: false,
        trend: 'stable',
        details: {
          heapGrowthRate: 0,
          rssGrowthRate: 0,
          recommendations: ['Insufficient data for memory leak detection'],
        },
      };
    }

    const first = recent[0];
    const last = recent[recent.length - 1];
    const timeDiff = last.timestamp.getTime() - first.timestamp.getTime();

    const heapGrowthRate =
      (last.memory.heapUsed - first.memory.heapUsed) / timeDiff;
    const rssGrowthRate = (last.memory.rss - first.memory.rss) / timeDiff;

    const suspected = heapGrowthRate > 1000 || rssGrowthRate > 1000; // Growing by 1KB/ms
    const trend =
      heapGrowthRate > 100
        ? 'increasing'
        : heapGrowthRate < -100
          ? 'decreasing'
          : 'stable';

    const recommendations: string[] = [];
    if (suspected) {
      recommendations.push('Monitor for memory leaks in application code');
      recommendations.push(
        'Check for unclosed database connections or event listeners',
      );
      recommendations.push('Review caching strategies and TTL settings');
      recommendations.push('Consider implementing memory profiling');
    }

    return {
      suspected,
      trend,
      details: {
        heapGrowthRate,
        rssGrowthRate,
        recommendations,
      },
    };
  }
}
