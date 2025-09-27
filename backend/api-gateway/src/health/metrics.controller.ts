import { Controller, Get, Header } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiProduces,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto';

@ApiTags('Metrics')
@Controller('metrics')
@ApiExtraModels(ErrorResponseDto)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOperation({
    summary: 'Prometheus метрики для мониторинга',
    description: `
      Возвращает метрики в формате Prometheus для мониторинга производительности и состояния API Gateway.
      
      **Доступные метрики:**
      
      **HTTP метрики:**
      - \`http_requests_total\` - общее количество HTTP запросов
      - \`http_request_duration_seconds\` - время выполнения HTTP запросов
      - \`http_requests_in_flight\` - количество активных запросов
      
      **Proxy метрики:**
      - \`proxy_requests_total\` - количество проксированных запросов по сервисам
      - \`proxy_request_duration_seconds\` - время проксирования запросов
      - \`proxy_errors_total\` - количество ошибок проксирования
      
      **Rate limiting метрики:**
      - \`rate_limit_hits_total\` - количество срабатываний rate limiting
      - \`rate_limit_blocks_total\` - количество заблокированных запросов
      
      **Аутентификация метрики:**
      - \`auth_requests_total\` - количество запросов аутентификации
      - \`auth_failures_total\` - количество неудачных аутентификаций
      
      **Системные метрики:**
      - \`nodejs_heap_size_total_bytes\` - размер heap памяти
      - \`nodejs_heap_size_used_bytes\` - используемая heap память
      - \`process_cpu_user_seconds_total\` - время CPU пользователя
      - \`process_resident_memory_bytes\` - резидентная память процесса
      
      Этот endpoint используется Prometheus для сбора метрик мониторинга.
    `,
  })
  @ApiProduces('text/plain')
  @ApiResponse({
    status: 200,
    description: 'Метрики в формате Prometheus',
    content: {
      'text/plain': {
        example: `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/games",status_code="200"} 1234

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/games",le="0.1"} 800
http_request_duration_seconds_bucket{method="GET",route="/api/games",le="0.5"} 1200
http_request_duration_seconds_bucket{method="GET",route="/api/games",le="+Inf"} 1234
http_request_duration_seconds_sum{method="GET",route="/api/games"} 45.67
http_request_duration_seconds_count{method="GET",route="/api/games"} 1234

# HELP proxy_requests_total Total number of proxy requests by service
# TYPE proxy_requests_total counter
proxy_requests_total{service="user-service",status="success"} 567
proxy_requests_total{service="game-catalog-service",status="success"} 890

# HELP rate_limit_hits_total Total number of rate limit hits
# TYPE rate_limit_hits_total counter
rate_limit_hits_total{ip="192.168.1.100"} 45

# HELP nodejs_heap_size_total_bytes Process heap size in bytes
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes 67108864`,
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Ошибка при получении метрик',
    schema: { $ref: getSchemaPath(ErrorResponseDto) },
  })
  async getMetrics(): Promise<string> {
    return this.metricsService.metrics();
  }
}
