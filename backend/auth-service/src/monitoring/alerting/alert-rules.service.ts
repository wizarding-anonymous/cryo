import { Injectable } from '@nestjs/common';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: (metrics: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldownMinutes: number;
  enabled: boolean;
}

export interface AlertEvent {
  ruleId: string;
  ruleName: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class AlertRulesService {
  private readonly rules: Map<string, AlertRule> = new Map();
  private readonly lastAlertTimes: Map<string, Date> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    // Authentication failure rate alert
    this.addRule({
      id: 'auth-failure-rate-high',
      name: 'High Authentication Failure Rate',
      description: 'Authentication failure rate exceeds 20% in the last 5 minutes',
      condition: (metrics) => {
        const failures = metrics.authFailures || 0;
        const total = metrics.authTotal || 1;
        return (failures / total) > 0.2 && total > 10;
      },
      severity: 'high',
      cooldownMinutes: 15,
      enabled: true,
    });

    // Multiple failed login attempts
    this.addRule({
      id: 'multiple-failed-logins',
      name: 'Multiple Failed Login Attempts',
      description: 'More than 10 failed login attempts from same IP in 5 minutes',
      condition: (metrics) => {
        return metrics.failedLoginsPerIp && 
               Object.values(metrics.failedLoginsPerIp).some((count: number) => count > 10);
      },
      severity: 'medium',
      cooldownMinutes: 10,
      enabled: true,
    });

    // Service unavailable
    this.addRule({
      id: 'external-service-unavailable',
      name: 'External Service Unavailable',
      description: 'External service has been unavailable for more than 2 minutes',
      condition: (metrics) => {
        return metrics.externalServiceErrors && 
               Object.values(metrics.externalServiceErrors).some((errorRate: number) => errorRate > 0.9);
      },
      severity: 'critical',
      cooldownMinutes: 5,
      enabled: true,
    });

    // High response time
    this.addRule({
      id: 'high-response-time',
      name: 'High Response Time',
      description: 'Average response time exceeds 2 seconds',
      condition: (metrics) => {
        return metrics.averageResponseTime > 2000;
      },
      severity: 'medium',
      cooldownMinutes: 10,
      enabled: true,
    });

    // Memory usage high
    this.addRule({
      id: 'memory-usage-high',
      name: 'High Memory Usage',
      description: 'Memory usage exceeds 85%',
      condition: (metrics) => {
        return metrics.memoryUsagePercent > 85;
      },
      severity: 'high',
      cooldownMinutes: 5,
      enabled: true,
    });

    // Rate limit exceeded frequently
    this.addRule({
      id: 'rate-limit-exceeded',
      name: 'Rate Limit Frequently Exceeded',
      description: 'Rate limit exceeded more than 50 times in 5 minutes',
      condition: (metrics) => {
        return metrics.rateLimitHits > 50;
      },
      severity: 'medium',
      cooldownMinutes: 15,
      enabled: true,
    });

    // Circuit breaker open
    this.addRule({
      id: 'circuit-breaker-open',
      name: 'Circuit Breaker Open',
      description: 'Circuit breaker is open for external service',
      condition: (metrics) => {
        return metrics.circuitBreakerStates && 
               Object.values(metrics.circuitBreakerStates).some((state: string) => state === 'open');
      },
      severity: 'high',
      cooldownMinutes: 5,
      enabled: true,
    });

    // Database connection issues
    this.addRule({
      id: 'database-connection-issues',
      name: 'Database Connection Issues',
      description: 'Database operation failure rate exceeds 10%',
      condition: (metrics) => {
        const dbFailures = metrics.dbFailures || 0;
        const dbTotal = metrics.dbTotal || 1;
        return (dbFailures / dbTotal) > 0.1 && dbTotal > 5;
      },
      severity: 'critical',
      cooldownMinutes: 5,
      enabled: true,
    });

    // Redis connection issues
    this.addRule({
      id: 'redis-connection-issues',
      name: 'Redis Connection Issues',
      description: 'Redis operation failure rate exceeds 5%',
      condition: (metrics) => {
        const redisFailures = metrics.redisFailures || 0;
        const redisTotal = metrics.redisTotal || 1;
        return (redisFailures / redisTotal) > 0.05 && redisTotal > 10;
      },
      severity: 'high',
      cooldownMinutes: 5,
      enabled: true,
    });

    // Suspicious activity detected
    this.addRule({
      id: 'suspicious-activity',
      name: 'Suspicious Activity Detected',
      description: 'Unusual patterns in authentication attempts detected',
      condition: (metrics) => {
        return metrics.suspiciousActivityScore > 0.8;
      },
      severity: 'high',
      cooldownMinutes: 5,
      enabled: true,
    });
  }

  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.lastAlertTimes.delete(ruleId);
  }

  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      this.rules.set(ruleId, { ...rule, ...updates });
    }
  }

  enableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: true });
  }

  disableRule(ruleId: string): void {
    this.updateRule(ruleId, { enabled: false });
  }

  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  evaluateRules(metrics: any): AlertEvent[] {
    const alerts: AlertEvent[] = [];
    const now = new Date();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      // Check cooldown
      const lastAlertTime = this.lastAlertTimes.get(rule.id);
      if (lastAlertTime) {
        const cooldownMs = rule.cooldownMinutes * 60 * 1000;
        if (now.getTime() - lastAlertTime.getTime() < cooldownMs) {
          continue;
        }
      }

      // Evaluate condition
      try {
        if (rule.condition(metrics)) {
          const alert: AlertEvent = {
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: rule.description,
            timestamp: now,
            metadata: {
              metrics: this.extractRelevantMetrics(rule.id, metrics),
            },
          };

          alerts.push(alert);
          this.lastAlertTimes.set(rule.id, now);
        }
      } catch (error) {
        console.error(`Error evaluating alert rule ${rule.id}:`, error);
      }
    }

    return alerts;
  }

  private extractRelevantMetrics(ruleId: string, metrics: any): any {
    // Extract only relevant metrics for the alert
    switch (ruleId) {
      case 'auth-failure-rate-high':
        return {
          authFailures: metrics.authFailures,
          authTotal: metrics.authTotal,
          failureRate: metrics.authTotal > 0 ? metrics.authFailures / metrics.authTotal : 0,
        };
      case 'multiple-failed-logins':
        return {
          failedLoginsPerIp: metrics.failedLoginsPerIp,
        };
      case 'external-service-unavailable':
        return {
          externalServiceErrors: metrics.externalServiceErrors,
        };
      case 'high-response-time':
        return {
          averageResponseTime: metrics.averageResponseTime,
        };
      case 'memory-usage-high':
        return {
          memoryUsagePercent: metrics.memoryUsagePercent,
        };
      default:
        return metrics;
    }
  }

  getAlertHistory(): { ruleId: string; lastAlertTime: Date }[] {
    return Array.from(this.lastAlertTimes.entries()).map(([ruleId, lastAlertTime]) => ({
      ruleId,
      lastAlertTime,
    }));
  }

  clearAlertHistory(ruleId?: string): void {
    if (ruleId) {
      this.lastAlertTimes.delete(ruleId);
    } else {
      this.lastAlertTimes.clear();
    }
  }
}