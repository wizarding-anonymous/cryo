import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { LibraryService } from './library.service';
import { PaymentService } from './payment.service';
import { ReviewService } from './review.service';
import { SocialService } from './social.service';

export interface ServiceHealthStatus {
  serviceName: string;
  isHealthy: boolean;
  responseTime?: number;
  lastChecked: string;
  error?: string;
}

export interface IntegrationHealthReport {
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealthStatus[];
  timestamp: string;
  healthyServices: number;
  totalServices: number;
}

@Injectable()
export class IntegrationMonitorService {
  private readonly logger = new Logger(IntegrationMonitorService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly libraryService: LibraryService,
    private readonly paymentService: PaymentService,
    private readonly reviewService: ReviewService,
    private readonly socialService: SocialService,
  ) {}

  /**
   * Проверка здоровья всех интегрированных сервисов
   */
  async checkAllServicesHealth(): Promise<IntegrationHealthReport> {
    this.logger.log('Starting health check for all integrated services');

    const services = [
      {
        name: 'notification-service',
        checkFn: () => this.notificationService.checkNotificationServiceHealth(),
      },
      {
        name: 'library-service',
        checkFn: () => this.libraryService.checkLibraryServiceHealth(),
      },
      {
        name: 'payment-service',
        checkFn: () => this.paymentService.checkPaymentServiceHealth(),
      },
      {
        name: 'review-service',
        checkFn: () => this.reviewService.checkReviewServiceHealth(),
      },
      {
        name: 'social-service',
        checkFn: () => this.socialService.checkSocialServiceHealth(),
      },
    ];

    const healthStatuses: ServiceHealthStatus[] = [];

    for (const service of services) {
      const status = await this.checkServiceHealth(service.name, service.checkFn);
      healthStatuses.push(status);
    }

    const healthyServices = healthStatuses.filter(s => s.isHealthy).length;
    const totalServices = healthStatuses.length;

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      overallHealth = 'healthy';
    } else if (healthyServices >= totalServices / 2) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'unhealthy';
    }

    const report: IntegrationHealthReport = {
      overallHealth,
      services: healthStatuses,
      timestamp: new Date().toISOString(),
      healthyServices,
      totalServices,
    };

    this.logger.log(
      `Health check completed: ${healthyServices}/${totalServices} services healthy (${overallHealth})`,
    );

    return report;
  }

  /**
   * Проверка здоровья отдельного сервиса с измерением времени отклика
   */
  private async checkServiceHealth(
    serviceName: string,
    healthCheckFn: () => Promise<boolean>,
  ): Promise<ServiceHealthStatus> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await healthCheckFn();
      const responseTime = Date.now() - startTime;

      return {
        serviceName,
        isHealthy,
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      this.logger.warn(`Health check failed for ${serviceName}:`, error);

      return {
        serviceName,
        isHealthy: false,
        responseTime,
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Проверка готовности к обработке событий
   */
  async checkIntegrationReadiness(): Promise<{
    ready: boolean;
    criticalServices: string[];
    optionalServices: string[];
    message: string;
  }> {
    const healthReport = await this.checkAllServicesHealth();

    // Критически важные сервисы для базовой функциональности
    const criticalServiceNames = ['library-service', 'notification-service'];
    
    // Опциональные сервисы для расширенной функциональности
    const optionalServiceNames = ['payment-service', 'review-service', 'social-service'];

    const criticalServices = healthReport.services.filter(s => 
      criticalServiceNames.includes(s.serviceName)
    );
    
    const optionalServices = healthReport.services.filter(s => 
      optionalServiceNames.includes(s.serviceName)
    );

    const criticalHealthy = criticalServices.filter(s => s.isHealthy);
    const optionalHealthy = optionalServices.filter(s => s.isHealthy);

    const ready = criticalHealthy.length === criticalServices.length;

    let message: string;
    if (ready) {
      if (optionalHealthy.length === optionalServices.length) {
        message = 'All services are healthy and ready for full integration';
      } else {
        message = `Ready with limited functionality. ${optionalServices.length - optionalHealthy.length} optional services unavailable`;
      }
    } else {
      const unhealthyCritical = criticalServices.filter(s => !s.isHealthy).map(s => s.serviceName);
      message = `Not ready. Critical services unavailable: ${unhealthyCritical.join(', ')}`;
    }

    return {
      ready,
      criticalServices: criticalServices.map(s => s.serviceName),
      optionalServices: optionalServices.map(s => s.serviceName),
      message,
    };
  }

  /**
   * Получение метрик производительности интеграций
   */
  async getIntegrationMetrics(): Promise<{
    averageResponseTime: number;
    slowestService: string | null;
    fastestService: string | null;
    serviceMetrics: Array<{
      serviceName: string;
      responseTime: number;
      isHealthy: boolean;
    }>;
  }> {
    const healthReport = await this.checkAllServicesHealth();

    const healthyServices = healthReport.services.filter(s => s.isHealthy && s.responseTime !== undefined);

    if (healthyServices.length === 0) {
      return {
        averageResponseTime: 0,
        slowestService: null,
        fastestService: null,
        serviceMetrics: [],
      };
    }

    const responseTimes = healthyServices.map(s => s.responseTime!);
    const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;

    const slowestService = healthyServices.reduce((slowest, current) => 
      (current.responseTime! > slowest.responseTime!) ? current : slowest
    );

    const fastestService = healthyServices.reduce((fastest, current) => 
      (current.responseTime! < fastest.responseTime!) ? current : fastest
    );

    return {
      averageResponseTime: Math.round(averageResponseTime),
      slowestService: slowestService.serviceName,
      fastestService: fastestService.serviceName,
      serviceMetrics: healthReport.services.map(s => ({
        serviceName: s.serviceName,
        responseTime: s.responseTime || 0,
        isHealthy: s.isHealthy,
      })),
    };
  }

  /**
   * Проверка конкретного типа интеграции
   */
  async checkIntegrationType(type: 'payment' | 'review' | 'social' | 'library' | 'notification'): Promise<ServiceHealthStatus> {
    switch (type) {
      case 'payment':
        return this.checkServiceHealth('payment-service', () => this.paymentService.checkPaymentServiceHealth());
      case 'review':
        return this.checkServiceHealth('review-service', () => this.reviewService.checkReviewServiceHealth());
      case 'social':
        return this.checkServiceHealth('social-service', () => this.socialService.checkSocialServiceHealth());
      case 'library':
        return this.checkServiceHealth('library-service', () => this.libraryService.checkLibraryServiceHealth());
      case 'notification':
        return this.checkServiceHealth('notification-service', () => this.notificationService.checkNotificationServiceHealth());
      default:
        throw new Error(`Unknown integration type: ${type}`);
    }
  }

  /**
   * Получение рекомендаций по улучшению интеграций
   */
  async getIntegrationRecommendations(): Promise<{
    recommendations: string[];
    warnings: string[];
    criticalIssues: string[];
  }> {
    const healthReport = await this.checkAllServicesHealth();
    const metrics = await this.getIntegrationMetrics();

    const recommendations: string[] = [];
    const warnings: string[] = [];
    const criticalIssues: string[] = [];

    // Анализ доступности сервисов
    const unhealthyServices = healthReport.services.filter(s => !s.isHealthy);
    if (unhealthyServices.length > 0) {
      criticalIssues.push(`${unhealthyServices.length} services are unavailable: ${unhealthyServices.map(s => s.serviceName).join(', ')}`);
    }

    // Анализ производительности
    if (metrics.averageResponseTime > 1000) {
      warnings.push(`Average response time is high (${metrics.averageResponseTime}ms). Consider optimizing service calls.`);
    }

    if (metrics.slowestService && healthReport.services.find(s => s.serviceName === metrics.slowestService)?.responseTime! > 2000) {
      warnings.push(`${metrics.slowestService} is responding slowly. Check service performance.`);
    }

    // Рекомендации по улучшению
    if (healthReport.overallHealth === 'healthy') {
      recommendations.push('All services are healthy. Consider implementing circuit breakers for better resilience.');
      recommendations.push('Monitor service response times and set up alerts for degraded performance.');
    }

    if (healthReport.overallHealth === 'degraded') {
      recommendations.push('Some services are unavailable. Implement graceful degradation strategies.');
      recommendations.push('Add retry logic with exponential backoff for failed service calls.');
    }

    if (healthReport.overallHealth === 'unhealthy') {
      recommendations.push('Multiple services are down. Implement fallback mechanisms.');
      recommendations.push('Consider using cached data when services are unavailable.');
    }

    return {
      recommendations,
      warnings,
      criticalIssues,
    };
  }
}