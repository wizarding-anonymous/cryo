import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { StartupValidationService } from '../config/startup-validation.service';
import { AppConfigService } from '../config/config.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly startupValidation: StartupValidationService,
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
      // Custom validation check
      () => this.performCustomHealthCheck(),
    ]);
  }

  @Get('detailed')
  async detailedCheck() {
    const result = await this.startupValidation.performHealthCheck();
    return {
      timestamp: new Date().toISOString(),
      service: this.configService.serviceName,
      version: this.configService.serviceVersion,
      environment: this.configService.nodeEnv,
      ...result,
    };
  }

  private async performCustomHealthCheck(): Promise<{ [key: string]: any }> {
    const result = await this.startupValidation.performHealthCheck();

    if (result.status === 'unhealthy') {
      const failedChecks = Object.entries(result.checks)
        .filter(([, check]) => check.status === 'fail')
        .map(([name, check]) => `${name}: ${check.message}`)
        .join(', ');

      throw new Error(`Health check failed: ${failedChecks}`);
    }

    return {
      'custom-validation': {
        status: 'up',
        checks: result.checks,
      },
    };
  }
}
