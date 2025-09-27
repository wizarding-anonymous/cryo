import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { IntegrationMonitorService, IntegrationHealthReport, ServiceHealthStatus } from '../services/integration-monitor.service';
import { Public } from '../decorators';

@Controller('monitoring')
@ApiTags('monitoring')
@Public() // Monitoring endpoints should be accessible without JWT
export class MonitoringController {
  constructor(private readonly integrationMonitorService: IntegrationMonitorService) {}

  /**
   * Проверка здоровья всех интегрированных сервисов
   */
  @Get('health/integrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Проверка здоровья всех интегрированных сервисов',
    description: 'Возвращает статус здоровья всех MVP сервисов',
  })
  @ApiResponse({
    status: 200,
    description: 'Отчет о здоровье интеграций',
  })
  async getIntegrationsHealth(): Promise<IntegrationHealthReport> {
    return this.integrationMonitorService.checkAllServicesHealth();
  }

  /**
   * Проверка готовности к обработке событий
   */
  @Get('readiness')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Проверка готовности к обработке событий',
    description: 'Проверяет готовность системы к обработке интеграционных событий',
  })
  @ApiResponse({
    status: 200,
    description: 'Статус готовности системы',
  })
  async getIntegrationReadiness(): Promise<{
    ready: boolean;
    criticalServices: string[];
    optionalServices: string[];
    message: string;
  }> {
    return this.integrationMonitorService.checkIntegrationReadiness();
  }

  /**
   * Получение метрик производительности интеграций
   */
  @Get('metrics/integrations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Метрики производительности интеграций',
    description: 'Возвращает метрики производительности всех интегрированных сервисов',
  })
  @ApiResponse({
    status: 200,
    description: 'Метрики производительности',
  })
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
    return this.integrationMonitorService.getIntegrationMetrics();
  }

  /**
   * Проверка здоровья конкретного типа интеграции
   */
  @Get('health/integration/:type')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Проверка здоровья конкретной интеграции',
    description: 'Проверяет здоровье конкретного типа интеграции',
  })
  @ApiParam({
    name: 'type',
    description: 'Тип интеграции',
    enum: ['payment', 'review', 'social', 'library', 'notification'],
  })
  @ApiResponse({
    status: 200,
    description: 'Статус здоровья интеграции',
  })
  @ApiResponse({
    status: 400,
    description: 'Неизвестный тип интеграции',
  })
  async getIntegrationHealth(
    @Param('type') type: 'payment' | 'review' | 'social' | 'library' | 'notification',
  ): Promise<ServiceHealthStatus> {
    return this.integrationMonitorService.checkIntegrationType(type);
  }

  /**
   * Получение рекомендаций по улучшению интеграций
   */
  @Get('recommendations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Рекомендации по улучшению интеграций',
    description: 'Возвращает рекомендации по улучшению интеграций на основе текущего состояния',
  })
  @ApiResponse({
    status: 200,
    description: 'Рекомендации и предупреждения',
  })
  async getIntegrationRecommendations(): Promise<{
    recommendations: string[];
    warnings: string[];
    criticalIssues: string[];
  }> {
    return this.integrationMonitorService.getIntegrationRecommendations();
  }

  /**
   * Общий статус системы для Kubernetes probes
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Общий статус системы',
    description: 'Упрощенный endpoint для Kubernetes health checks',
  })
  @ApiResponse({
    status: 200,
    description: 'Система работает',
  })
  @ApiResponse({
    status: 503,
    description: 'Система недоступна',
  })
  async getSystemStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    ready: boolean;
  }> {
    const healthReport = await this.integrationMonitorService.checkAllServicesHealth();
    const readiness = await this.integrationMonitorService.checkIntegrationReadiness();

    // Возвращаем 503 если система не готова к работе
    if (!readiness.ready) {
      throw new Error('System not ready');
    }

    return {
      status: healthReport.overallHealth,
      timestamp: healthReport.timestamp,
      ready: readiness.ready,
    };
  }
}