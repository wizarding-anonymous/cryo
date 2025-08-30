import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { MetricsService } from '../../../application/services/metrics.service';

@ApiTags('Monitoring')
@Controller()
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly health: HealthCheckService,
  ) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  async getMetrics() {
    return this.metricsService.getMetrics();
  }

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Get service health status' })
  check() {
    return this.health.check([
      // Simple health check without database dependency
      () => ({ 'user-service': { status: 'up', timestamp: new Date().toISOString() } }),
    ]);
  }
}
