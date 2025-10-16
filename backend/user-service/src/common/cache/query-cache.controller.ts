import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmQueryCacheService } from './typeorm-query-cache.service';

export class InvalidateCacheDto {
  tags: string[];
}

export class WarmUpCacheDto {
  queries: Array<{
    query: string;
    parameters?: any[];
    options?: {
      ttl?: number;
      tags?: string[];
    };
  }>;
}

/**
 * Query Cache Management Controller
 * Provides endpoints for managing TypeORM query cache
 */
@ApiTags('Query Cache Management')
@Controller('admin/query-cache')
@UseGuards(ThrottlerGuard)
export class QueryCacheController {
  constructor(private readonly queryCacheService: TypeOrmQueryCacheService) {}

  /**
   * Get query cache statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Get query cache statistics',
    description:
      'Retrieve comprehensive statistics about query cache performance',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
  })
  async getCacheStats() {
    const stats = await this.queryCacheService.getStats();

    return {
      ...stats,
      hitRateFormatted: `${stats.hitRate.toFixed(2)}%`,
      memorySizeFormatted: this.formatBytes(stats.memoryUsage),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Reset cache statistics
   */
  @Post('stats/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset cache statistics',
    description: 'Reset all cache performance statistics counters',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics reset successfully',
  })
  async resetStats() {
    await this.queryCacheService.resetStats();

    return {
      message: 'Cache statistics reset successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Clear all query cache
   */
  @Delete('clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear all query cache',
    description: 'Remove all cached query results and reset cache',
  })
  @ApiResponse({ status: 200, description: 'Cache cleared successfully' })
  async clearCache() {
    await this.queryCacheService.clear();

    return {
      message: 'Query cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Invalidate cache by tags
   */
  @Post('invalidate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate cache by tags',
    description: 'Remove cached entries that match the specified tags',
  })
  @ApiResponse({ status: 200, description: 'Cache invalidated successfully' })
  async invalidateByTags(@Body() dto: InvalidateCacheDto) {
    const invalidatedCount = await this.queryCacheService.invalidateByTags(
      dto.tags,
    );

    return {
      message: `Invalidated ${invalidatedCount} cache entries`,
      tags: dto.tags,
      invalidatedCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Invalidate cache by pattern
   */
  @Delete('pattern/:pattern')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Invalidate cache by pattern',
    description: 'Remove cached entries that match the specified key pattern',
  })
  @ApiResponse({ status: 200, description: 'Cache invalidated successfully' })
  async invalidateByPattern(@Param('pattern') pattern: string) {
    const invalidatedCount =
      await this.queryCacheService.invalidateByPattern(pattern);

    return {
      message: `Invalidated ${invalidatedCount} cache entries`,
      pattern,
      invalidatedCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cache entries by tag
   */
  @Get('entries/tag/:tag')
  @ApiOperation({
    summary: 'Get cache entries by tag',
    description: 'List all cache entry keys that have the specified tag',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache entries retrieved successfully',
  })
  async getEntriesByTag(@Param('tag') tag: string) {
    const entries = await this.queryCacheService.getEntriesByTag(tag);

    return {
      tag,
      entries,
      count: entries.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Warm up cache with predefined queries
   */
  @Post('warmup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Warm up cache',
    description: 'Preload cache with frequently used queries',
  })
  @ApiResponse({ status: 200, description: 'Cache warmed up successfully' })
  async warmUpCache(@Body() dto: WarmUpCacheDto) {
    await this.queryCacheService.warmUp(dto.queries);

    return {
      message: `Cache warm-up initiated for ${dto.queries.length} queries`,
      queryCount: dto.queries.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cache health status
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get cache health status',
    description: 'Check the health and performance of the query cache system',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache health status retrieved successfully',
  })
  async getCacheHealth() {
    const stats = await this.queryCacheService.getStats();

    // Determine health status based on metrics
    const health = {
      status: 'healthy' as 'healthy' | 'warning' | 'critical',
      issues: [] as string[],
      recommendations: [] as string[],
    };

    // Check hit rate
    if (stats.hitRate < 30) {
      health.status = 'warning';
      health.issues.push('Low cache hit rate');
      health.recommendations.push('Review caching strategy and TTL settings');
    }

    // Check memory usage (if over 100MB)
    if (stats.memoryUsage > 100 * 1024 * 1024) {
      health.status = 'warning';
      health.issues.push('High memory usage');
      health.recommendations.push(
        'Consider reducing cache TTL or clearing old entries',
      );
    }

    // Check cache size
    if (stats.cacheSize > 10000) {
      health.status = 'warning';
      health.issues.push('Large number of cached entries');
      health.recommendations.push('Implement cache cleanup strategy');
    }

    return {
      ...health,
      stats,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get cache configuration
   */
  @Get('config')
  @ApiOperation({
    summary: 'Get cache configuration',
    description: 'Retrieve current cache configuration and settings',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache configuration retrieved successfully',
  })
  async getCacheConfig() {
    // This would typically come from configuration service
    return {
      defaultTTL: 300,
      maxMemoryUsage: '500MB',
      keyPrefix: 'user-service:typeorm-cache:',
      redisDB: 1,
      environment: process.env.NODE_ENV || 'development',
      features: {
        queryLogging: true,
        slowQueryDetection: true,
        automaticInvalidation: true,
        tagBasedInvalidation: true,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
