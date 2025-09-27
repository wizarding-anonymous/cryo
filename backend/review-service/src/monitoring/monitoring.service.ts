import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OwnershipService } from '../services/ownership.service';
import { NotificationService } from '../services/notification.service';
import { GameCatalogService } from '../services/game-catalog.service';
import { AchievementService } from '../services/achievement.service';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  lastCheck: Date;
  errorCount: number;
  uptime: number;
}

export interface MonitoringMetrics {
  services: ServiceStatus[];
  overallHealth: 'healthy' | 'unhealthy' | 'degraded';
  lastUpdate: Date;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private readonly maxErrorCount = 5;
  private readonly degradedThreshold = 1000; // 1 second response time

  constructor(
    private readonly ownershipService: OwnershipService,
    private readonly notificationService: NotificationService,
    private readonly gameCatalogService: GameCatalogService,
    private readonly achievementService: AchievementService,
  ) {
    this.initializeServiceStatuses();
  }

  private initializeServiceStatuses() {
    const services = [
      'libraryService',
      'notificationService',
      'gameCatalogService',
      'achievementService',
    ];

    services.forEach(service => {
      this.serviceStatuses.set(service, {
        name: service,
        status: 'healthy',
        lastCheck: new Date(),
        errorCount: 0,
        uptime: 100,
      });
    });
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkServiceHealth() {
    this.logger.debug('Starting service health checks');

    const healthChecks = [
      { name: 'libraryService', check: () => this.ownershipService.getServiceHealth() },
      { name: 'notificationService', check: () => this.notificationService.getServiceHealth() },
      { name: 'gameCatalogService', check: () => this.gameCatalogService.getServiceHealth() },
      { name: 'achievementService', check: () => this.achievementService.getServiceHealth() },
    ];

    for (const { name, check } of healthChecks) {
      await this.checkIndividualService(name, check);
    }

    this.logOverallHealth();
  }

  private async checkIndividualService(
    serviceName: string,
    healthCheck: () => Promise<any>
  ) {
    const startTime = Date.now();
    const currentStatus = this.serviceStatuses.get(serviceName);

    try {
      const result = await healthCheck();
      const responseTime = Date.now() - startTime;
      
      const isHealthy = result.status === 'healthy';
      const isDegraded = responseTime > this.degradedThreshold;
      
      let status: 'healthy' | 'unhealthy' | 'degraded';
      if (!isHealthy) {
        status = 'unhealthy';
      } else if (isDegraded) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      this.serviceStatuses.set(serviceName, {
        name: serviceName,
        status,
        responseTime,
        lastCheck: new Date(),
        errorCount: isHealthy ? 0 : (currentStatus?.errorCount || 0) + 1,
        uptime: this.calculateUptime(serviceName, isHealthy),
      });

      if (!isHealthy) {
        this.logger.warn(`Service ${serviceName} is unhealthy: ${JSON.stringify(result)}`);
      } else if (isDegraded) {
        this.logger.warn(`Service ${serviceName} is degraded: ${responseTime}ms response time`);
      }

    } catch (error) {
      const errorCount = (currentStatus?.errorCount || 0) + 1;
      
      this.serviceStatuses.set(serviceName, {
        name: serviceName,
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        lastCheck: new Date(),
        errorCount,
        uptime: this.calculateUptime(serviceName, false),
      });

      this.logger.error(`Health check failed for ${serviceName}:`, error);

      // Alert if error count exceeds threshold
      if (errorCount >= this.maxErrorCount) {
        this.logger.error(`Service ${serviceName} has exceeded error threshold (${errorCount}/${this.maxErrorCount})`);
        // Here you could integrate with alerting systems
      }
    }
  }

  private calculateUptime(serviceName: string, isHealthy: boolean): number {
    const currentStatus = this.serviceStatuses.get(serviceName);
    if (!currentStatus) return isHealthy ? 100 : 0;

    // Simple uptime calculation - in production, use more sophisticated tracking
    if (isHealthy) {
      return Math.min(100, currentStatus.uptime + 0.1);
    } else {
      return Math.max(0, currentStatus.uptime - 1);
    }
  }

  private logOverallHealth() {
    const metrics = this.getMonitoringMetrics();
    const unhealthyServices = metrics.services.filter(s => s.status === 'unhealthy');
    const degradedServices = metrics.services.filter(s => s.status === 'degraded');

    if (unhealthyServices.length > 0) {
      this.logger.error(`Unhealthy services: ${unhealthyServices.map(s => s.name).join(', ')}`);
    }

    if (degradedServices.length > 0) {
      this.logger.warn(`Degraded services: ${degradedServices.map(s => s.name).join(', ')}`);
    }

    this.logger.debug(`Overall health: ${metrics.overallHealth}`);
  }

  getMonitoringMetrics(): MonitoringMetrics {
    const services = Array.from(this.serviceStatuses.values());
    
    let overallHealth: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    
    if (services.some(s => s.status === 'unhealthy')) {
      overallHealth = 'unhealthy';
    } else if (services.some(s => s.status === 'degraded')) {
      overallHealth = 'degraded';
    }

    return {
      services,
      overallHealth,
      lastUpdate: new Date(),
    };
  }

  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(serviceName);
  }

  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  // Manual health check trigger
  async triggerHealthCheck(): Promise<MonitoringMetrics> {
    await this.checkServiceHealth();
    return this.getMonitoringMetrics();
  }

  // Reset error counts (useful for testing or after maintenance)
  resetErrorCounts() {
    this.serviceStatuses.forEach((status, name) => {
      this.serviceStatuses.set(name, {
        ...status,
        errorCount: 0,
        uptime: 100,
      });
    });
    this.logger.log('Error counts reset for all services');
  }
}