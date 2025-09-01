import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ISocialServiceIntegration } from '../../domain/interfaces/social-service.interface';
import { IPaymentServiceIntegration } from '../../domain/interfaces/payment-service.interface';
import { MetricsService } from './metrics.service';

export interface IntegrationHealthStatus {
  serviceName: string;
  isHealthy: boolean;
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
}

@Injectable()
export class IntegrationMonitoringService {
  private readonly logger = new Logger(IntegrationMonitoringService.name);
  private healthStatuses: Map<string, IntegrationHealthStatus> = new Map();

  constructor(
    @Inject(ISocialServiceIntegration) private readonly socialService: ISocialServiceIntegration,
    @Inject(IPaymentServiceIntegration) private readonly paymentService: IPaymentServiceIntegration,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Периодическая проверка здоровья интеграций каждые 30 секунд
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async performHealthChecks(): Promise<void> {
    this.logger.debug('Performing integration health checks');

    await Promise.all([
      this.checkServiceHealth('social-service', () => this.socialService.checkHealth()),
      this.checkServiceHealth('payment-service', () => this.paymentService.checkHealth()),
    ]);
  }

  /**
   * Проверка здоровья конкретного сервиса
   */
  private async checkServiceHealth(serviceName: string, healthCheckFn: () => Promise<boolean>): Promise<void> {
    const startTime = Date.now();

    try {
      const isHealthy = await healthCheckFn();
      const responseTime = Date.now() - startTime;

      const status: IntegrationHealthStatus = {
        serviceName,
        isHealthy,
        lastChecked: new Date(),
        responseTime,
      };

      this.healthStatuses.set(serviceName, status);

      // Обновляем метрики
      this.metricsService.recordIntegrationHealth(serviceName, isHealthy);
      this.metricsService.recordIntegrationResponseTime(serviceName, responseTime);

      if (!isHealthy) {
        this.logger.warn(`Integration health check failed for ${serviceName}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;

      const status: IntegrationHealthStatus = {
        serviceName,
        isHealthy: false,
        lastChecked: new Date(),
        responseTime,
        errorMessage: error.message,
      };

      this.healthStatuses.set(serviceName, status);

      // Обновляем метрики
      this.metricsService.recordIntegrationHealth(serviceName, false);
      this.metricsService.recordIntegrationResponseTime(serviceName, responseTime);

      this.logger.error(`Integration health check error for ${serviceName}`, error.message);
    }
  }

  /**
   * Получение статуса всех интеграций
   */
  getIntegrationStatuses(): IntegrationHealthStatus[] {
    return Array.from(this.healthStatuses.values());
  }

  /**
   * Получение статуса конкретной интеграции
   */
  getIntegrationStatus(serviceName: string): IntegrationHealthStatus | null {
    return this.healthStatuses.get(serviceName) || null;
  }

  /**
   * Проверка, все ли интеграции здоровы
   */
  areAllIntegrationsHealthy(): boolean {
    const statuses = this.getIntegrationStatuses();
    return statuses.length > 0 && statuses.every(status => status.isHealthy);
  }

  /**
   * Получение сводки по интеграциям
   */
  getIntegrationSummary(): {
    totalIntegrations: number;
    healthyIntegrations: number;
    unhealthyIntegrations: number;
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const statuses = this.getIntegrationStatuses();
    const healthyCount = statuses.filter(s => s.isHealthy).length;
    const totalCount = statuses.length;
    const unhealthyCount = totalCount - healthyCount;

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overallHealth = 'healthy';
    } else if (healthyCount > 0) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'unhealthy';
    }

    return {
      totalIntegrations: totalCount,
      healthyIntegrations: healthyCount,
      unhealthyIntegrations: unhealthyCount,
      overallHealth,
    };
  }

  /**
   * Ручная проверка всех интеграций
   */
  async performManualHealthCheck(): Promise<IntegrationHealthStatus[]> {
    await this.performHealthChecks();
    return this.getIntegrationStatuses();
  }
}
