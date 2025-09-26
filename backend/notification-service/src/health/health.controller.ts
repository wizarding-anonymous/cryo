import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Проверка состояния сервиса' })
  @ApiResponse({ status: 200, description: 'Сервис работает нормально' })
  @ApiResponse({ status: 503, description: 'Сервис недоступен' })
  check() {
    const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10);
    const heapThreshold =
      parseInt(process.env.HEALTH_CHECK_MEMORY_HEAP_THRESHOLD || '300', 10) *
      1024 *
      1024;
    const rssThreshold =
      parseInt(process.env.HEALTH_CHECK_MEMORY_RSS_THRESHOLD || '300', 10) *
      1024 *
      1024;

    return this.health.check([
      // Database connectivity check
      () => this.db.pingCheck('database', { timeout }),

      // Memory usage checks
      () => this.memory.checkHeap('memory_heap', heapThreshold),
      () => this.memory.checkRSS('memory_rss', rssThreshold),

      // Disk space check (if available)
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.9, // 90% threshold
        }),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Проверка готовности сервиса' })
  @ApiResponse({ status: 200, description: 'Сервис готов к работе' })
  @ApiResponse({ status: 503, description: 'Сервис не готов' })
  readiness() {
    const timeout = parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10);

    return this.health.check([
      // Only essential checks for readiness
      () => this.db.pingCheck('database', { timeout }),
    ]);
  }

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Проверка жизнеспособности сервиса' })
  @ApiResponse({ status: 200, description: 'Сервис жив' })
  @ApiResponse({ status: 503, description: 'Сервис мертв' })
  liveness() {
    const heapThreshold =
      parseInt(process.env.HEALTH_CHECK_MEMORY_HEAP_THRESHOLD || '300', 10) *
      1024 *
      1024;

    return this.health.check([
      // Basic liveness checks
      () => this.memory.checkHeap('memory_heap', heapThreshold),
    ]);
  }
}
