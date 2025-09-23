import { Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CacheService, CacheStats } from './cache.service';

@ApiTags('Cache Management')
@Controller('cache')
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        hits: { type: 'number', description: 'Number of cache hits' },
        misses: { type: 'number', description: 'Number of cache misses' },
        hitRate: { type: 'number', description: 'Cache hit rate (0-1)' },
        totalOperations: { type: 'number', description: 'Total cache operations' },
      },
    },
  })
  getStats(): CacheStats {
    return this.cacheService.getStats();
  }

  @Post('stats/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reset cache statistics' })
  @ApiResponse({ status: 204, description: 'Cache statistics reset successfully' })
  resetStats(): void {
    this.cacheService.resetStats();
  }

  @Get('patterns')
  @ApiOperation({ summary: 'Get cache patterns configuration' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache patterns retrieved successfully',
    schema: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Cache key pattern' },
          ttl: { type: 'number', description: 'Time to live in seconds' },
          description: { type: 'string', description: 'Pattern description' },
        },
      },
    },
  })
  getCachePatterns() {
    return this.cacheService.getCachePatterns();
  }

  @Get('health')
  @ApiOperation({ summary: 'Check cache health' })
  @ApiResponse({ 
    status: 200, 
    description: 'Cache health check completed',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy'] },
        details: { type: 'object' },
      },
    },
  })
  async healthCheck() {
    return this.cacheService.healthCheck();
  }
}