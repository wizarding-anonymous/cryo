import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { SystemMetricsService } from './system-metrics.service';

@ApiTags('Metrics')
@Controller('internal/metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly systemMetricsService: SystemMetricsService,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get metrics summary' })
  @ApiResponse({
    status: 200,
    description: 'Metrics summary retrieved successfully',
  })
  async getMetricsSummary() {
    return this.metricsService.getMetricsSummary();
  }

  @Get('system')
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({
    status: 200,
    description: 'System metrics retrieved successfully',
  })
  async getSystemMetrics() {
    return this.systemMetricsService.getSystemMetricsSnapshot();
  }

  @Get('memory')
  @ApiOperation({ summary: 'Get memory usage' })
  @ApiResponse({
    status: 200,
    description: 'Memory usage retrieved successfully',
  })
  getMemoryUsage() {
    return this.systemMetricsService.getMemoryUsageBreakdown();
  }

  @Get('cpu')
  @ApiOperation({ summary: 'Get CPU usage' })
  @ApiResponse({ status: 200, description: 'CPU usage retrieved successfully' })
  getCpuUsage() {
    return this.systemMetricsService.getCpuUsage();
  }

  @Get('health')
  @ApiOperation({ summary: 'Get health check with all metrics' })
  @ApiResponse({
    status: 200,
    description: 'Health check completed successfully',
  })
  async getHealthCheck() {
    try {
      const [metrics, system, memory, cpu] = await Promise.all([
        this.metricsService.getMetricsSummary(),
        this.systemMetricsService.getSystemMetricsSnapshot(),
        Promise.resolve(this.systemMetricsService.getMemoryUsageBreakdown()),
        Promise.resolve(this.systemMetricsService.getCpuUsage()),
      ]);

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics,
        system,
        memory,
        cpu,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
