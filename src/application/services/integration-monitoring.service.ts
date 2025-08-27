import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Cron, CronExpression } from '@nestjs/schedule';
import { 
  IntegrationHealth, 
  EventDeliveryMetrics, 
  IntegrationDashboardData 
} from '../interfaces/integration-monitoring.interface';

@Injectable()
export class IntegrationMonitoringService {
  private readonly logger = new Logger(IntegrationMonitoringService.name);
  private readonly HEALTH_CHECK_KEY = 'integration:health';
  private readonly EVENT_METRICS_KEY = 'integration:events';

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async recordEventDelivery(topic: string, success: boolean, deliveryTimeMs: number): Promise<void> {
    const key = `${this.EVENT_METRICS_KEY}:${topic}`;
    const now = Date.now();

    try {
      await this.redis
        .multi()
        .hincrby(key, success ? 'successCount' : 'failureCount', 1)
        .hset(key, 'lastDelivery', now)
        .hset(key, 'lastDeliveryTime', deliveryTimeMs)
        .expire(key, 86400) // 24 hours
        .exec();
    } catch (error) {
      this.logger.error(`Failed to record event delivery metrics for topic ${topic}:`, error);
    }
  }

  async recordIntegrationHealth(serviceName: string, health: Omit<IntegrationHealth, 'serviceName'>): Promise<void> {
    const key = `${this.HEALTH_CHECK_KEY}:${serviceName}`;
    
    try {
      await this.redis.hset(key, {
        status: health.status,
        lastCheck: health.lastCheck.toISOString(),
        responseTime: health.responseTime || 0,
        errorRate: health.errorRate || 0,
        details: JSON.stringify(health.details || {}),
      });
      
      await this.redis.expire(key, 300); // 5 minutes
    } catch (error) {
      this.logger.error(`Failed to record integration health for ${serviceName}:`, error);
    }
  }

  async getIntegrationHealth(serviceName?: string): Promise<IntegrationHealth[]> {
    try {
      const pattern = serviceName 
        ? `${this.HEALTH_CHECK_KEY}:${serviceName}`
        : `${this.HEALTH_CHECK_KEY}:*`;
      
      const keys = await this.redis.keys(pattern);
      const healthChecks: IntegrationHealth[] = [];

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        if (Object.keys(data).length > 0) {
          healthChecks.push({
            serviceName: key.split(':').pop()!,
            status: data.status as any,
            lastCheck: new Date(data.lastCheck),
            responseTime: parseInt(data.responseTime) || undefined,
            errorRate: parseFloat(data.errorRate) || undefined,
            details: data.details ? JSON.parse(data.details) : undefined,
          });
        }
      }

      return healthChecks;
    } catch (error) {
      this.logger.error('Failed to get integration health:', error);
      return [];
    }
  }

  async getEventDeliveryMetrics(topic?: string): Promise<EventDeliveryMetrics[]> {
    try {
      const pattern = topic 
        ? `${this.EVENT_METRICS_KEY}:${topic}`
        : `${this.EVENT_METRICS_KEY}:*`;
      
      const keys = await this.redis.keys(pattern);
      const metrics: EventDeliveryMetrics[] = [];

      for (const key of keys) {
        const data = await this.redis.hgetall(key);
        if (Object.keys(data).length > 0) {
          metrics.push({
            topic: key.split(':').pop()!,
            successCount: parseInt(data.successCount) || 0,
            failureCount: parseInt(data.failureCount) || 0,
            lastDelivery: new Date(parseInt(data.lastDelivery)),
            averageDeliveryTime: parseInt(data.lastDeliveryTime) || 0,
          });
        }
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get event delivery metrics:', error);
      return [];
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing integration health checks...');

    // Check Developer Portal Service integration
    await this.checkDeveloperPortalIntegration();
    
    // Check event delivery health
    await this.checkEventDeliveryHealth();
  }

  private async checkDeveloperPortalIntegration(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // In a real implementation, this would make an actual HTTP request
      // to Developer Portal Service health endpoint
      const responseTime = Date.now() - startTime;
      
      await this.recordIntegrationHealth('developer-portal-service', {
        status: 'healthy',
        lastCheck: new Date(),
        responseTime,
        errorRate: 0,
      });
    } catch (error) {
      await this.recordIntegrationHealth('developer-portal-service', {
        status: 'unhealthy',
        lastCheck: new Date(),
        errorRate: 1,
        details: { error: error.message },
      });
    }
  }

  private async checkEventDeliveryHealth(): Promise<void> {
    const metrics = await this.getEventDeliveryMetrics();
    
    for (const metric of metrics) {
      const totalEvents = metric.successCount + metric.failureCount;
      const errorRate = totalEvents > 0 ? metric.failureCount / totalEvents : 0;
      
      // Alert if error rate is above 10%
      if (errorRate > 0.1) {
        this.logger.warn(`High error rate detected for topic ${metric.topic}: ${(errorRate * 100).toFixed(2)}%`);
        
        // In a real implementation, this would trigger an alert
        // await this.alertingService.sendAlert({
        //   severity: 'warning',
        //   message: `High error rate for event topic ${metric.topic}`,
        //   details: metric,
        // });
      }
    }
  }

  async getIntegrationDashboardData(): Promise<IntegrationDashboardData> {
    const healthChecks = await this.getIntegrationHealth();
    const eventMetrics = await this.getEventDeliveryMetrics();
    
    const summary = {
      totalIntegrations: healthChecks.length,
      healthyIntegrations: healthChecks.filter(h => h.status === 'healthy').length,
      totalEvents: eventMetrics.reduce((sum, m) => sum + m.successCount + m.failureCount, 0),
      failedEvents: eventMetrics.reduce((sum, m) => sum + m.failureCount, 0),
    };

    return {
      healthChecks,
      eventMetrics,
      summary,
    };
  }
}