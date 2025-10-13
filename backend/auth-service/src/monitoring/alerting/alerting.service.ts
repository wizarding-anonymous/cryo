import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AlertRulesService } from './alert-rules.service';
import { AlertManagerService } from './alert-manager.service';
import { AuthMetricsService } from '../prometheus/auth-metrics.service';
import { StructuredLoggerService } from '../logging/structured-logger.service';

@Injectable()
export class AlertingService {
  private metricsCache: any = {};
  private isEvaluating = false;

  constructor(
    private readonly alertRules: AlertRulesService,
    private readonly alertManager: AlertManagerService,
    private readonly authMetrics: AuthMetricsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  /**
   * Evaluate alert rules every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async evaluateAlerts(): Promise<void> {
    if (this.isEvaluating) {
      return; // Skip if already evaluating
    }

    this.isEvaluating = true;
    
    try {
      // Collect current metrics
      const metrics = await this.collectMetrics();
      
      // Evaluate alert rules
      const alerts = this.alertRules.evaluateRules(metrics);
      
      // Send alerts
      for (const alert of alerts) {
        await this.alertManager.sendAlert(alert);
      }

      if (alerts.length > 0) {
        this.logger.log(`Processed ${alerts.length} alerts`, {
          operation: 'evaluate-alerts',
          alertCount: alerts.length,
          metadata: {
            alertRules: alerts.map(a => a.ruleId),
          },
        });
      }
    } catch (error) {
      this.logger.error('Failed to evaluate alerts', error, {
        operation: 'evaluate-alerts',
      });
    } finally {
      this.isEvaluating = false;
    }
  }

  /**
   * Collect metrics for alert evaluation
   */
  private async collectMetrics(): Promise<any> {
    try {
      // Get Prometheus metrics
      const prometheusMetrics = await this.authMetrics.getCurrentMetrics();
      
      // Parse metrics and calculate derived values
      const metrics = {
        timestamp: new Date(),
        
        // Authentication metrics
        authTotal: this.getMetricValue(prometheusMetrics, 'auth_operations_total'),
        authFailures: this.getMetricValue(prometheusMetrics, 'auth_operations_total', { status: 'failure' }),
        authSuccesses: this.getMetricValue(prometheusMetrics, 'auth_operations_total', { status: 'success' }),
        
        // Token metrics
        tokenOperations: this.getMetricValue(prometheusMetrics, 'auth_token_operations_total'),
        blacklistedTokens: this.getMetricValue(prometheusMetrics, 'auth_blacklisted_tokens_total'),
        
        // Session metrics
        activeSessions: this.getMetricValue(prometheusMetrics, 'auth_active_sessions_total'),
        
        // Rate limiting
        rateLimitHits: this.getMetricValue(prometheusMetrics, 'auth_rate_limit_hits_total'),
        
        // External services
        externalServiceCalls: this.getMetricValue(prometheusMetrics, 'auth_external_service_calls_total'),
        externalServiceFailures: this.getMetricValue(prometheusMetrics, 'auth_external_service_calls_total', { status: 'failure' }),
        
        // Database operations
        dbTotal: this.getMetricValue(prometheusMetrics, 'auth_db_operations_total'),
        dbFailures: this.getMetricValue(prometheusMetrics, 'auth_db_operations_total', { status: 'failure' }),
        
        // Redis operations
        redisTotal: this.getMetricValue(prometheusMetrics, 'auth_redis_operations_total'),
        redisFailures: this.getMetricValue(prometheusMetrics, 'auth_redis_operations_total', { status: 'failure' }),
        
        // System metrics
        memoryUsagePercent: this.getSystemMemoryUsage(),
        averageResponseTime: this.calculateAverageResponseTime(prometheusMetrics),
        
        // Derived metrics
        authFailureRate: 0,
        externalServiceErrorRate: 0,
        dbErrorRate: 0,
        redisErrorRate: 0,
        
        // Custom metrics
        failedLoginsPerIp: this.getFailedLoginsPerIp(),
        circuitBreakerStates: this.getCircuitBreakerStates(),
        suspiciousActivityScore: this.calculateSuspiciousActivityScore(),
      };

      // Calculate rates
      if (metrics.authTotal > 0) {
        metrics.authFailureRate = metrics.authFailures / metrics.authTotal;
      }
      
      if (metrics.externalServiceCalls > 0) {
        metrics.externalServiceErrorRate = metrics.externalServiceFailures / metrics.externalServiceCalls;
      }
      
      if (metrics.dbTotal > 0) {
        metrics.dbErrorRate = metrics.dbFailures / metrics.dbTotal;
      }
      
      if (metrics.redisTotal > 0) {
        metrics.redisErrorRate = metrics.redisFailures / metrics.redisTotal;
      }

      // Cache metrics for comparison
      this.metricsCache = metrics;
      
      return metrics;
    } catch (error) {
      this.logger.error('Failed to collect metrics', error, {
        operation: 'collect-metrics',
      });
      return this.metricsCache; // Return cached metrics as fallback
    }
  }

  private getMetricValue(_metrics: any, _metricName: string, _labels?: Record<string, string>): number {
    // This is a simplified implementation
    // In a real scenario, you would parse the Prometheus metrics format
    // For now, return a mock value or 0
    return 0;
  }

  private getSystemMemoryUsage(): number {
    const used = process.memoryUsage();
    const total = used.heapTotal;
    return total > 0 ? (used.heapUsed / total) * 100 : 0;
  }

  private calculateAverageResponseTime(_metrics: any): number {
    // Calculate from histogram metrics
    // This is a simplified implementation
    return 0;
  }

  private getFailedLoginsPerIp(): Record<string, number> {
    // This would typically come from a cache or database
    // For now, return empty object
    return {};
  }

  private getCircuitBreakerStates(): Record<string, string> {
    // This would come from circuit breaker service
    // For now, return empty object
    return {};
  }

  private calculateSuspiciousActivityScore(): number {
    // Implement suspicious activity detection logic
    // This could include:
    // - Multiple failed logins from same IP
    // - Unusual login patterns
    // - Geographic anomalies
    // - Time-based anomalies
    return 0;
  }

  /**
   * Manually trigger alert evaluation
   */
  async triggerEvaluation(): Promise<void> {
    await this.evaluateAlerts();
  }

  /**
   * Test alert system with a mock alert
   */
  async testAlert(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    const testAlert = {
      ruleId: 'test-alert',
      ruleName: 'Test Alert',
      severity,
      message: 'This is a test alert to verify the alerting system is working',
      timestamp: new Date(),
      metadata: {
        test: true,
        triggeredBy: 'manual-test',
      },
    };

    await this.alertManager.sendAlert(testAlert);
    
    this.logger.log('Test alert sent', {
      operation: 'test-alert',
      severity,
    });
  }

  /**
   * Get alerting system status
   */
  getStatus(): {
    isEvaluating: boolean;
    lastEvaluation: Date | null;
    rulesCount: number;
    channelsCount: number;
    alertHistory: any[];
  } {
    return {
      isEvaluating: this.isEvaluating,
      lastEvaluation: this.metricsCache.timestamp || null,
      rulesCount: this.alertRules.getAllRules().length,
      channelsCount: this.alertManager.getAllChannels().length,
      alertHistory: this.alertManager.getAlertHistory(10),
    };
  }
}