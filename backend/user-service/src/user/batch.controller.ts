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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { BatchUpdateDto, BatchProcessingOptions } from './batch.service';
import { BatchCreateUsersDto } from './dto/batch-create-users.dto';
import { BatchUpdateUsersDto } from './dto/batch-update-users.dto';
import { BatchUserIdsDto } from './dto/batch-user-ids.dto';
import { InternalServiceGuard, RateLimit, RateLimitType } from '../common/guards';

@UseGuards(InternalServiceGuard)
@RateLimit({ type: RateLimitType.BATCH })
@ApiTags('batch-operations')
@ApiSecurity('internal-api-key')
@ApiSecurity('internal-bearer')
@Controller('batch')
export class BatchController {
  private readonly logger = new Logger(BatchController.name);

  constructor(private readonly userService: UserService) {}

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
    const { users, options } = body;
    this.logger.log(`Batch creating ${users.length} users`);

    const result = await this.userService.createUsersBatch(users, options);

    return {
      success: result.stats.failed === 0,
      message: `Successfully created ${result.stats.successful} out of ${result.stats.total} users`,
      data: result.successful,
      failed: result.failed,
      stats: result.stats,
    };
  }

  @Get('users/lookup')
  @ApiOperation({
    summary: 'Lookup multiple users by IDs',
    description: 'Batch retrieval of users by their IDs with caching',
  })
  @ApiQuery({
    name: 'ids',
    description: 'Comma-separated list of user IDs',
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
    this.logger.log(`Batch lookup for ${ids.length} users`);

    const options: BatchProcessingOptions = {};
    if (chunkSize) {
      const parsedChunkSize = parseInt(chunkSize, 10);
      if (!isNaN(parsedChunkSize) && parsedChunkSize > 0) {
        options.chunkSize = parsedChunkSize;
      }
    }

    const usersMap = await this.userService.findUsersBatch(ids, options);
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

    const result = await this.userService.updateLastLoginBatch(
      userIds,
      options,
    );

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
    const stats = await this.userService.getCacheStats();

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

    await this.userService.warmUpCache(userIds);

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

    await this.userService.clearCache();

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

    const result = await this.userService.updateUsersBatch(
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

    const result = await this.userService.softDeleteUsersBatch(
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
}
