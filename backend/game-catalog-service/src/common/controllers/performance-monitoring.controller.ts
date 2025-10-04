import {
  Controller,
  Get,
  Query,
  Delete,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { PerformanceMonitoringService } from '../services/performance-monitoring.service';
import { PerformanceInterceptor } from '../interceptors/performance.interceptor';

@ApiTags('Performance Monitoring')
@Controller('admin/performance')
@UseInterceptors(PerformanceInterceptor)
export class PerformanceMonitoringController {
  constructor(
    private readonly performanceMonitoringService: PerformanceMonitoringService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get performance statistics',
    description:
      'Retrieve performance statistics for the specified time period',
  })
  @ApiQuery({
    name: 'minutes',
    required: false,
    description: 'Time period in minutes (default: 5)',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Performance statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalRequests: { type: 'number' },
        averageResponseTime: { type: 'number' },
        slowRequests: { type: 'number' },
        errorRate: { type: 'number' },
        cacheHitRate: { type: 'number' },
        topSlowEndpoints: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              endpoint: { type: 'string' },
              avgResponseTime: { type: 'number' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  getPerformanceStats(@Query('minutes') minutes: number = 5) {
    return this.performanceMonitoringService.getPerformanceStats(minutes);
  }

  @Get('cache-stats')
  @ApiOperation({
    summary: 'Get cache performance statistics',
    description:
      'Retrieve cache performance statistics for the specified time period',
  })
  @ApiQuery({
    name: 'minutes',
    required: false,
    description: 'Time period in minutes (default: 5)',
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalOperations: { type: 'number' },
        hitRate: { type: 'number' },
        averageResponseTime: { type: 'number' },
        operationBreakdown: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
      },
    },
  })
  getCacheStats(@Query('minutes') minutes: number = 5) {
    return this.performanceMonitoringService.getCacheStats(minutes);
  }

  @Delete('metrics')
  @ApiOperation({
    summary: 'Clear performance metrics',
    description: 'Clear all stored performance metrics from memory',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics cleared successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  clearMetrics() {
    try {
      this.performanceMonitoringService.clearMetrics();
      return {
        success: true,
        message: 'Performance metrics cleared successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to clear metrics: ${(error as Error).message}`,
      };
    }
  }
}
