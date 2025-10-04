import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CacheService } from '../services/cache.service';
import { CacheWarmingService } from '../services/cache-warming.service';
import { PerformanceInterceptor } from '../interceptors/performance.interceptor';

@ApiTags('Cache Management')
@Controller('admin/cache')
@UseInterceptors(PerformanceInterceptor)
export class CacheAdminController {
  constructor(
    private readonly cacheService: CacheService,
    private readonly cacheWarmingService: CacheWarmingService,
  ) {}

  @Get('stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Retrieve current cache statistics and health information',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        timestamp: { type: 'string' },
      },
    },
  })
  async getCacheStats(): Promise<Record<string, unknown>> {
    return this.cacheService.getCacheStats() as Promise<
      Record<string, unknown>
    >;
  }

  @Post('warmup')
  @ApiOperation({
    summary: 'Trigger cache warmup',
    description: 'Manually trigger cache warmup for frequently accessed data',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache warmup completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        duration: { type: 'number' },
        message: { type: 'string' },
      },
    },
  })
  async triggerCacheWarmup() {
    return this.cacheWarmingService.triggerWarmup();
  }

  @Delete('games')
  @ApiOperation({
    summary: 'Invalidate all game caches',
    description:
      'Clear all cached game data including lists, searches, and individual games',
  })
  @ApiResponse({
    status: 200,
    description: 'Game caches invalidated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async invalidateGameCaches() {
    try {
      await this.cacheService.invalidateGameCache();
      return {
        success: true,
        message: 'All game caches invalidated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to invalidate game caches: ${(error as Error).message}`,
      };
    }
  }

  @Delete('games/:id')
  @ApiOperation({
    summary: 'Invalidate cache for specific game',
    description: 'Clear cached data for a specific game by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the game',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Game cache invalidated successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async invalidateGameCache(@Param('id') gameId: string) {
    try {
      await this.cacheService.invalidateGameCache(gameId);
      return {
        success: true,
        message: `Cache invalidated for game ${gameId}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to invalidate cache for game ${gameId}: ${(error as Error).message}`,
      };
    }
  }
}
