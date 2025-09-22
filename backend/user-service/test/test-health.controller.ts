import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { AppConfigService } from '../src/config/config.service';

@Controller('health')
export class TestHealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly configService: AppConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    const timeout = this.configService.healthCheckTimeout;

    return this.health.check([
      // Database check with configurable timeout
      () => this.db.pingCheck('database', { timeout }),
      // Memory checks with reasonable limits
      () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 250 * 1024 * 1024),
      // Simple test health check
      () => this.performTestHealthCheck(),
    ]);
  }

  @Get('detailed')
  async detailedCheck() {
    return {
      timestamp: new Date().toISOString(),
      service: this.configService.serviceName,
      version: this.configService.serviceVersion,
      environment: this.configService.nodeEnv,
      status: 'healthy',
      checks: {
        database: { status: 'pass' },
        cache: { status: 'pass' },
        environment: { status: 'pass' },
      },
    };
  }

  private async performTestHealthCheck(): Promise<{ [key: string]: any }> {
    return {
      'test-validation': {
        status: 'up',
        message: 'Test environment health check passed',
      },
    };
  }
}
