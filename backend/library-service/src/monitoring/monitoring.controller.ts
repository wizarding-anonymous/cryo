import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrometheusMetricsService } from './prometheus-metrics.service';

/**
 * Monitoring controller for metrics and performance data
 */

@Controller('monitoring')
@ApiTags('Monitoring')
export class MonitoringController {
  constructor(
    private readonly prometheusMetricsService: PrometheusMetricsService,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Prometheus metrics in text format' })
  async getMetrics(): Promise<string> {
    return this.prometheusMetricsService.getMetrics();
  }

  @Get('status')
  @ApiOperation({ summary: 'Get monitoring status' })
  @ApiResponse({ status: 200, description: 'Current monitoring status' })
  async getMonitoringStatus() {
    return {
      status: 'active',
      timestamp: new Date().toISOString(),
      metrics: {
        prometheus: 'enabled',
        apm: process.env.ELASTIC_APM_SERVER_URL ? 'enabled' : 'disabled',
        logging: 'structured',
      },
    };
  }
}