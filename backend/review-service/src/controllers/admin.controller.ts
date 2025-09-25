import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BackgroundTasksService } from '../services/background-tasks.service';
import { MetricsService } from '../services/metrics.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(
    private readonly backgroundTasksService: BackgroundTasksService,
    private readonly metricsService: MetricsService,
  ) {}

  @Post('recalculate-ratings')
  @ApiOperation({ summary: 'Trigger manual recalculation of all game ratings' })
  @ApiResponse({
    status: 200,
    description: 'Recalculation completed successfully',
    schema: {
      type: 'object',
      properties: {
        totalGames: { type: 'number' },
        successfulUpdates: { type: 'number' },
        failedUpdates: { type: 'number' },
        duration: { type: 'number' },
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: 'Recalculation already in progress',
  })
  async recalculateAllRatings() {
    return this.backgroundTasksService.recalculateAllGameRatings();
  }

  @Get('recalculation-status')
  @ApiOperation({ summary: 'Get status of rating recalculation process' })
  @ApiResponse({
    status: 200,
    description: 'Recalculation status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        inProgress: { type: 'boolean' },
        lastMetrics: {
          type: 'object',
          properties: {
            totalOperations: { type: 'number' },
            averageDuration: { type: 'number' },
            successRate: { type: 'number' },
            operationCounts: { type: 'object' },
            recentErrors: { type: 'array' },
          },
        },
      },
    },
  })
  async getRecalculationStatus() {
    return this.backgroundTasksService.getRecalculationStatus();
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get performance metrics for rating operations' })
  @ApiResponse({
    status: 200,
    description: 'Metrics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        totalOperations: { type: 'number' },
        averageDuration: { type: 'number' },
        successRate: { type: 'number' },
        operationCounts: { type: 'object' },
        recentErrors: { type: 'array' },
      },
    },
  })
  async getMetrics() {
    return this.metricsService.getMetricsSummary();
  }

  @Get('metrics/raw')
  @ApiOperation({ summary: 'Get raw performance metrics data' })
  @ApiResponse({
    status: 200,
    description: 'Raw metrics retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          operationType: { type: 'string' },
          gameId: { type: 'string' },
          duration: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
          success: { type: 'boolean' },
          error: { type: 'string' },
        },
      },
    },
  })
  async getRawMetrics() {
    return this.metricsService.getMetrics();
  }

  @Post('metrics/clear')
  @ApiOperation({ summary: 'Clear all performance metrics' })
  @ApiResponse({
    status: 200,
    description: 'Metrics cleared successfully',
  })
  async clearMetrics() {
    this.metricsService.clearMetrics();
    return { message: 'Metrics cleared successfully' };
  }
}