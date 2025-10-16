import { Controller, Get, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import {
  SlowQueryMonitorService,
  SlowQueryStats,
  SlowQueryLog,
} from './slow-query-monitor.service';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';

@ApiTags('Database Monitoring')
@Controller('internal/database/slow-queries')
@UseGuards(InternalServiceGuard)
export class SlowQueryController {
  constructor(private readonly slowQueryMonitor: SlowQueryMonitorService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get slow query statistics' })
  @ApiResponse({
    status: 200,
    description: 'Slow query statistics retrieved successfully',
  })
  async getSlowQueryStats(): Promise<SlowQueryStats> {
    return this.slowQueryMonitor.getSlowQueryStats();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent slow queries' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of queries to return',
  })
  @ApiResponse({
    status: 200,
    description: 'Recent slow queries retrieved successfully',
  })
  async getRecentSlowQueries(
    @Query('limit') limit?: number,
  ): Promise<SlowQueryLog[]> {
    return this.slowQueryMonitor.getRecentSlowQueries(limit);
  }

  @Get('by-repository')
  @ApiOperation({ summary: 'Get slow queries by repository' })
  @ApiQuery({
    name: 'repository',
    required: true,
    type: String,
    description: 'Repository name',
  })
  @ApiResponse({
    status: 200,
    description: 'Slow queries by repository retrieved successfully',
  })
  async getSlowQueriesByRepository(
    @Query('repository') repository: string,
  ): Promise<SlowQueryLog[]> {
    return this.slowQueryMonitor.getSlowQueriesByRepository(repository);
  }

  @Get('threshold')
  @ApiOperation({ summary: 'Get slow query threshold' })
  @ApiResponse({
    status: 200,
    description: 'Slow query threshold retrieved successfully',
  })
  async getSlowQueryThreshold(): Promise<{ threshold: number }> {
    return {
      threshold: this.slowQueryMonitor.getSlowQueryThreshold(),
    };
  }

  @Delete('logs')
  @ApiOperation({ summary: 'Clear slow query logs' })
  @ApiResponse({
    status: 200,
    description: 'Slow query logs cleared successfully',
  })
  async clearSlowQueryLogs(): Promise<{ message: string }> {
    this.slowQueryMonitor.clearSlowQueryLogs();
    return { message: 'Slow query logs cleared successfully' };
  }
}
