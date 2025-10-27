import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Logger,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiSecurity,
} from '@nestjs/swagger';

import { BatchService } from './batch.service';
import { CreateUserDto } from './dto/create-user.dto';
import { BatchUpdateDto, BatchProcessingOptions } from './batch.service';
import { BatchCreateUsersDto } from './dto/batch-create-users.dto';
import { BatchUpdateUsersDto } from './dto/batch-update-users.dto';
import { BatchUserIdsDto } from './dto/batch-user-ids.dto';
import { InternalServiceGuard, RateLimit, RateLimitType } from '../common/guards';
import { CacheService } from '../common/cache/cache.service';

@UseGuards(InternalServiceGuard)
@RateLimit({ type: RateLimitType.BATCH })
@ApiTags('batch-operations')
@ApiSecurity('internal-api-key')
@ApiSecurity('internal-bearer')
@Controller('batch')
export class BatchController {
  private readonly logger = new Logger(BatchController.name);

  constructor(
    private readonly batchService: BatchService,
    private readonly cacheService: CacheService,
  ) { }

  @Post('users/create')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({
    type: RateLimitType.BATCH,
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 5, // Only 5 batch creates per 5 minutes
    message: 'Too many batch create operations, please try again later'
  })
  @ApiOperation({
    summary: 'Create multiple users',
    description: 'Batch creation of users for internal service use',
  })
  @ApiResponse({
    status: 201,
    description: 'Users created successfully',
    type: [CreateUserDto],
  })
  async createUsersBatch(@Body() body: BatchCreateUsersDto) {
    try {
      const { users, options } = body;
      
      this.logger.log(`Received batch create request with ${users?.length || 0} users`);
      
      // Limit batch size to prevent memory issues
      if (users && users.length > 5000) {
        this.logger.warn(`Batch size too large: ${users.length} users`);
        return {
          success: false,
          message: `Batch size too large. Maximum 5000 users per batch, received ${users.length}`,
          data: [],
          failed: [],
          stats: { total: users.length, successful: 0, failed: users.length },
        };
      }

      // Handle empty or invalid users array
      if (!users || !Array.isArray(users) || users.length === 0) {
        this.logger.warn('No users provided for batch creation');
        return {
          success: false,
          message: 'No users provided for batch creation',
          data: [],
          failed: [],
          stats: { total: 0, successful: 0, failed: 0 },
        };
      }

      this.logger.log(`Batch creating ${users.length} users`);

      // Set reasonable chunk size for large batches
      const processOptions = {
        chunkSize: Math.min(options?.chunkSize || 100, 500),
        ...options,
      };

      const result = await this.batchService.createUsers(users, processOptions);

      return {
        success: result.stats.failed === 0,
        message: `Successfully created ${result.stats.successful} out of ${result.stats.total} users`,
        data: result.successful,
        failed: result.failed,
        stats: result.stats,
      };
    } catch (error) {
      this.logger.error(`Error in createUsersBatch: ${error.message}`);
      return {
        success: false,
        message: `Request processing error: ${error.message}`,
        data: [],
        failed: [],
        stats: { total: 0, successful: 0, failed: 0 },
      };
    }
  }

  @Get('users/lookup')
  @ApiOperation({
    summary: 'Lookup multiple users by IDs (small batches)',
    description: 'Batch retrieval of users by their IDs via query parameter (limited to small batches)',
  })
  @ApiQuery({
    name: 'ids',
    description: 'Comma-separated list of user IDs (max 100 IDs)',
    example: 'uuid1,uuid2,uuid3',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async getUsersBatch(
    @Query('ids') idsParam: string,
    @Query('chunkSize') chunkSize?: string,
  ) {
    if (!idsParam) {
      return {
        success: false,
        message: 'No user IDs provided',
        data: [],
      };
    }

    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);

    // Limit GET requests to 100 IDs to avoid URL length issues
    if (ids.length > 100) {
      return {
        success: false,
        message: 'Too many IDs for GET request. Use POST /batch/users/lookup for large batches (max 100 IDs for GET)',
        data: [],
      };
    }

    this.logger.log(`Batch lookup for ${ids.length} users`);

    const options: BatchProcessingOptions = {};
    if (chunkSize) {
      const parsedChunkSize = parseInt(chunkSize, 10);
      if (!isNaN(parsedChunkSize) && parsedChunkSize > 0) {
        options.chunkSize = parsedChunkSize;
      }
    }

    const usersMap = await this.batchService.getUsersByIds(ids, options);
    const users = Array.from(usersMap.values());

    // Remove passwords from response
    const safeUsers = users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return {
      success: true,
      message: `Found ${users.length} out of ${ids.length} users`,
      data: safeUsers,
      stats: {
        requested: ids.length,
        found: users.length,
        missing: ids.length - users.length,
      },
    };
  }

  @Post('users/lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lookup multiple users by IDs (large batches)',
    description: 'Batch retrieval of users by their IDs via request body (supports large batches)',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async getUsersBatchPost(@Body() body: { ids: string[]; options?: BatchProcessingOptions }) {
    const { ids, options = {} } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        message: 'No user IDs provided',
        data: [],
      };
    }

    this.logger.log(`Batch lookup for ${ids.length} users`);

    const usersMap = await this.batchService.getUsersByIds(ids, options);
    const users = Array.from(usersMap.values());

    // Remove passwords from response
    const safeUsers = users.map((user) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    return {
      success: true,
      message: `Found ${users.length} out of ${ids.length} users`,
      data: safeUsers,
      stats: {
        requested: ids.length,
        found: users.length,
        missing: ids.length - users.length,
      },
    };
  }

  @Patch('users/last-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update last login for multiple users',
    description: 'Batch update of last login timestamps',
  })
  @ApiResponse({
    status: 200,
    description: 'Last login timestamps updated successfully',
  })
  async updateLastLoginBatch(@Body() body: BatchUserIdsDto) {
    const { userIds, options } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return {
        success: false,
        message: 'No user IDs provided',
        stats: { total: 0, successful: 0, failed: 0 },
      };
    }

    this.logger.log(`Batch updating last login for ${userIds.length} users`);

    // Create batch updates for last login
    const updates: BatchUpdateDto[] = userIds.map(id => ({
      id,
      data: { lastLoginAt: new Date() }
    }));

    const result = await this.batchService.updateUsers(updates, options);

    return {
      success: result.stats.failed === 0,
      message: `Updated last login for ${result.stats.successful} out of ${result.stats.total} users`,
      data: result.successful,
      failed: result.failed,
      stats: result.stats,
    };
  }

  @Get('cache/stats')
  @ApiOperation({
    summary: 'Get cache statistics',
    description: 'Retrieve cache performance metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
  })
  async getCacheStats() {
    // Simple cache stats implementation
    const stats = {
      cacheType: 'Redis',
      status: 'active',
      // Add more stats if CacheService has methods for it
    };

    return {
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('cache/warm-up')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Warm up cache with user data',
    description: 'Preload frequently accessed users into cache',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache warmed up successfully',
  })
  async warmUpCache(@Body() body: { userIds: string[] }) {
    const { userIds } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return {
        success: false,
        message: 'No user IDs provided for cache warm-up',
      };
    }

    this.logger.log(`Warming up cache for ${userIds.length} users`);

    // Warm up cache by loading users
    const usersMap = await this.batchService.getUsersByIds(userIds);
    this.logger.log(`Loaded ${usersMap.size} users into cache`);

    return {
      success: true,
      message: `Cache warmed up for ${userIds.length} users`,
    };
  }

  @Post('cache/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear user cache',
    description: 'Clear all cached user data (maintenance operation)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
  })
  async clearCache() {
    this.logger.log('Clearing user cache');

    // Clear cache using Redis client directly
    try {
      const client = this.cacheService['redisService'].getClient();
      await client.flushdb(); // Clear current database
      this.logger.log('Cache cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear cache:', error.message);
      throw error;
    }

    return {
      success: true,
      message: 'User cache cleared successfully',
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('users/update')
  @HttpCode(HttpStatus.OK)
  @RateLimit({
    type: RateLimitType.BATCH,
    windowMs: 2 * 60 * 1000, // 2 minutes
    maxRequests: 10, // 10 batch updates per 2 minutes
    message: 'Too many batch update operations, please try again later'
  })
  @ApiOperation({
    summary: 'Update multiple users',
    description: 'Batch update of user data with chunk-based processing',
  })
  @ApiResponse({
    status: 200,
    description: 'Users updated successfully',
  })
  async updateUsersBatch(@Body() body: BatchUpdateUsersDto) {
    const { updates, options } = body;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return {
        success: false,
        message: 'No user updates provided',
        stats: { total: 0, successful: 0, failed: 0 },
      };
    }

    this.logger.log(`Batch updating ${updates.length} users`);

    // Преобразуем DTO в формат для сервиса
    const batchUpdates: BatchUpdateDto[] = updates.map((update) => ({
      id: update.id,
      data: update.data,
    }));

    const result = await this.batchService.updateUsers(
      batchUpdates,
      options,
    );

    return {
      success: result.stats.failed === 0,
      message: `Updated ${result.stats.successful} out of ${result.stats.total} users`,
      data: result.successful,
      failed: result.failed,
      stats: result.stats,
    };
  }

  @Delete('users/soft-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete multiple users',
    description: 'Batch soft deletion of users with chunk-based processing',
  })
  @ApiResponse({
    status: 200,
    description: 'Users soft deleted successfully',
  })
  async softDeleteUsersBatch(@Body() body: BatchUserIdsDto) {
    const { userIds, options } = body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return {
        success: false,
        message: 'No user IDs provided',
        stats: { total: 0, successful: 0, failed: 0 },
      };
    }

    this.logger.log(`Batch soft deleting ${userIds.length} users`);

    const result = await this.batchService.softDeleteUsers(
      userIds,
      options,
    );

    return {
      success: result.stats.failed === 0,
      message: `Soft deleted ${result.stats.successful} out of ${result.stats.total} users`,
      data: result.successful,
      failed: result.failed,
      stats: result.stats,
    };
  }

  @Get('users')
  @ApiOperation({
    summary: 'Get paginated list of users',
    description: 'Retrieve users with pagination support for performance testing',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 100, max: 5000)' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Sort field (default: createdAt)' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Sort order: asc or desc (default: desc)' })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
  async getUsersPaginated(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '100',
    @Query('sortBy') sortBy: string = 'createdAt',
    @Query('sortOrder') sortOrder: string = 'desc',
  ) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit, 10) || 100));
    
    this.logger.log(`Paginated user lookup: page=${pageNum}, limit=${limitNum}, sortBy=${sortBy}, sortOrder=${sortOrder}`);

    try {
      // Simple pagination implementation using BatchService
      const skip = (pageNum - 1) * limitNum;
      
      // For now, return a simple response structure
      // In a real implementation, this would use a proper pagination service
      const users = await this.batchService.getUsersPaginated({
        skip,
        take: limitNum,
        sortBy,
        sortOrder: sortOrder as 'asc' | 'desc',
      });

      // Remove passwords from response
      const safeUsers = users.map((user) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      return {
        success: true,
        data: safeUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: safeUsers.length,
          hasNext: safeUsers.length === limitNum,
          hasPrev: pageNum > 1,
        },
      };
    } catch (error) {
      this.logger.error(`Pagination error: ${error.message}`);
      return {
        success: false,
        message: 'Failed to retrieve users',
        data: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          hasNext: false,
          hasPrev: false,
        },
      };
    }
  }
}
