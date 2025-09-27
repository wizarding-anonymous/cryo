import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import {
  ProductionReadinessService,
  ReadinessCheck,
} from './production-readiness.service';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiResponse,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { HealthCheckResultDto, ServiceHealthStatusDto } from './dto/health.dto';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Health')
@Controller('health')
@ApiExtraModels(ErrorResponseDto)
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly productionReadinessService: ProductionReadinessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Проверка состояния API Gateway',
    description: `
      Возвращает общее состояние API Gateway, включая время работы и базовые метрики.
      
      Этот endpoint используется для:
      - Kubernetes liveness probes
      - Load balancer health checks
      - Мониторинга доступности сервиса
      
      **Статусы:**
      - \`ok\` - сервис работает нормально
      - \`error\` - обнаружены критические проблемы
    `,
  })
  @ApiOkResponse({
    type: HealthCheckResultDto,
    description: 'Состояние API Gateway',
    examples: {
      healthy: {
        summary: 'Здоровый сервис',
        value: {
          status: 'ok',
          timestamp: '2024-01-15T10:30:00.000Z',
          uptime: 3600,
        },
      },
      unhealthy: {
        summary: 'Проблемы с сервисом',
        value: {
          status: 'error',
          timestamp: '2024-01-15T10:30:00.000Z',
          uptime: 1800,
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Сервис недоступен',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async checkHealth(): Promise<HealthCheckResultDto> {
    return this.healthService.checkGateway();
  }

  @Get('services')
  @ApiOperation({
    summary: 'Проверка состояния всех микросервисов',
    description: `
      Возвращает детальную информацию о состоянии всех зарегистрированных микросервисов.
      
      Проверяет доступность следующих сервисов:
      - User Service
      - Game Catalog Service
      - Payment Service
      - Library Service
      - Social Service
      - Review Service
      - Achievement Service
      - Notification Service
      - Download Service
      - Security Service
      
      **Статусы сервисов:**
      - \`healthy\` - сервис доступен и отвечает
      - \`unhealthy\` - сервис недоступен или возвращает ошибки
      - \`unknown\` - состояние сервиса не определено
    `,
  })
  @ApiOkResponse({
    type: ServiceHealthStatusDto,
    isArray: true,
    description: 'Состояние всех микросервисов',
    examples: {
      allHealthy: {
        summary: 'Все сервисы здоровы',
        value: [
          {
            name: 'user-service',
            status: 'healthy',
            responseTime: 45,
            lastCheck: '2024-01-15T10:30:00.000Z',
          },
          {
            name: 'game-catalog-service',
            status: 'healthy',
            responseTime: 32,
            lastCheck: '2024-01-15T10:30:00.000Z',
          },
        ],
      },
      someUnhealthy: {
        summary: 'Некоторые сервисы недоступны',
        value: [
          {
            name: 'user-service',
            status: 'healthy',
            responseTime: 45,
            lastCheck: '2024-01-15T10:30:00.000Z',
          },
          {
            name: 'payment-service',
            status: 'unhealthy',
            lastCheck: '2024-01-15T10:29:30.000Z',
            error: 'Connection timeout',
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Один или несколько сервисов недоступны',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async checkServicesHealth(): Promise<ServiceHealthStatusDto[]> {
    return this.healthService.checkServices();
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'Проверка готовности к production',
    description: `
      Выполняет комплексную проверку готовности API Gateway к работе в production среде.
      
      Проверяет:
      - Валидность переменных окружения
      - Подключение к Redis
      - Доступность микросервисов
      - Конфигурацию памяти и производительности
      - Настройки безопасности
      
      **Статусы проверок:**
      - \`healthy\` - проверка прошла успешно
      - \`degraded\` - есть предупреждения, но сервис работоспособен
      - \`unhealthy\` - критические проблемы, требующие внимания
    `,
  })
  @ApiOkResponse({
    description: 'Результаты проверки готовности к production',
    examples: {
      allHealthy: {
        summary: 'Все проверки прошли успешно',
        value: [
          {
            name: 'Environment Variables',
            status: 'healthy',
            message: 'All required environment variables are set',
          },
          {
            name: 'Redis Connection',
            status: 'healthy',
            message: 'Redis connection is healthy',
          },
        ],
      },
      someIssues: {
        summary: 'Есть предупреждения',
        value: [
          {
            name: 'Environment Variables',
            status: 'healthy',
            message: 'All required environment variables are set',
          },
          {
            name: 'Security Configuration',
            status: 'degraded',
            message: 'Security warnings: CORS origin is set to wildcard',
            details: {
              corsOrigin: '*',
              rateLimitEnabled: true,
              logLevel: 'log',
            },
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Критические проблемы с готовностью к production',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async checkReadiness(): Promise<ReadinessCheck[]> {
    return this.productionReadinessService.performReadinessChecks();
  }
}
