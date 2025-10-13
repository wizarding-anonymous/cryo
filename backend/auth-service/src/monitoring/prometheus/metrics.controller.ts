import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrometheusService } from './prometheus.service';
import { AuthMetricsService } from './auth-metrics.service';

@ApiTags('Monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly prometheusService: PrometheusService,
    private readonly authMetricsService: AuthMetricsService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  @ApiOperation({
    summary: 'Get Prometheus metrics',
    description: 'Returns all Prometheus metrics in text format for scraping',
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus metrics in text format',
    content: {
      'text/plain': {
        example: `# HELP auth_operations_total Total number of authentication operations
# TYPE auth_operations_total counter
auth_operations_total{operation="login",status="success",method="email"} 150
auth_operations_total{operation="login",status="failure",method="email"} 12
auth_operations_total{operation="register",status="success",method="email"} 45`,
      },
    },
  })
  async getMetrics(): Promise<string> {
    return this.prometheusService.getMetrics();
  }

  @Get('auth')
  @ApiOperation({
    summary: 'Get authentication-specific metrics',
    description: 'Returns current authentication metrics in JSON format',
  })
  @ApiResponse({
    status: 200,
    description: 'Authentication metrics',
    schema: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time' },
        metrics: { type: 'object' },
      },
    },
  })
  async getAuthMetrics(): Promise<any> {
    return this.authMetricsService.getCurrentMetrics();
  }
}