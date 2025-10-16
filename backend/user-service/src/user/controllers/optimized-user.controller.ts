import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { OptimizedUserService } from '../services/optimized-user.service';
import {
  CursorPaginationOptions,
  UserSearchFilters,
  BatchOperationOptions,
} from '../repositories/optimized-user.repository';
import { User } from '../entities/user.entity';

// DTOs for request/response
export class CursorPaginationDto implements CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt';
  sortOrder?: 'ASC' | 'DESC';
}

export class UserSearchFiltersDto implements UserSearchFilters {
  isActive?: boolean;
  hasLastLogin?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  emailDomain?: string;
}

export class BatchUserIdsDto {
  userIds: string[];
}

export class BatchCreateUsersDto {
  users: Partial<User>[];
  options?: BatchOperationOptions;
}

export class BatchUpdateUsersDto {
  updates: Array<{ id: string; data: Partial<User> }>;
  options?: BatchOperationOptions;
}

/**
 * Optimized User Controller for high-performance operations
 * Handles large datasets with cursor-based pagination and batch operations
 */
@ApiTags('Optimized Users')
@Controller('optimized/users')
@UseGuards(ThrottlerGuard)
export class OptimizedUserController {
  constructor(private readonly optimizedUserService: OptimizedUserService) {}

  /**
   * Get users with cursor-based pagination
   */
  @Get()
  @ApiOperation({
    summary: 'Get users with cursor-based pagination',
    description:
      'Efficiently retrieve users using cursor-based pagination for large datasets',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Cursor for pagination',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of users to return (max 1000)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['createdAt', 'updatedAt', 'lastLoginAt'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsers(
    @Query('cursor') cursor?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit?: number,
    @Query('sortBy') sortBy?: 'createdAt' | 'updatedAt' | 'lastLoginAt',
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    const paginationOptions: CursorPaginationOptions = {
      cursor,
      limit,
      sortBy,
      sortOrder,
    };

    return this.optimizedUserService.getUsersWithPagination(paginationOptions);
  }

  /**
   * Search users with advanced filters and pagination
   */
  @Get('search')
  @ApiOperation({
    summary: 'Search users with filters',
    description:
      'Search users with advanced filters and cursor-based pagination',
  })
  @ApiResponse({ status: 200, description: 'Users found successfully' })
  async searchUsers(
    @Query() filters: UserSearchFiltersDto,
    @Query() paginationOptions: CursorPaginationDto,
  ) {
    return this.optimizedUserService.searchUsersWithFilters(
      filters,
      paginationOptions,
    );
  }

  /**
   * Get multiple users by IDs (batch operation)
   */
  @Post('batch/lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get multiple users by IDs',
    description:
      'Efficiently retrieve multiple users by their IDs using batch processing',
  })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getUsersBatch(@Body() batchDto: BatchUserIdsDto) {
    const usersMap = await this.optimizedUserService.getUsersByIdsBatch(
      batchDto.userIds,
    );

    // Convert Map to object for JSON response
    const users: Record<string, User> = {};
    for (const [id, user] of usersMap) {
      users[id] = user;
    }

    return {
      users,
      totalFound: usersMap.size,
      totalRequested: batchDto.userIds.length,
    };
  }

  /**
   * Create multiple users (batch operation)
   */
  @Post('batch/create')
  @ApiOperation({
    summary: 'Create multiple users',
    description:
      'Create multiple users in a single batch operation for better performance',
  })
  @ApiResponse({ status: 201, description: 'Users created successfully' })
  async createUsersBatch(@Body() batchDto: BatchCreateUsersDto) {
    const createdUsers = await this.optimizedUserService.createUsersBatch(
      batchDto.users,
      batchDto.options,
    );

    return {
      users: createdUsers,
      totalCreated: createdUsers.length,
      totalRequested: batchDto.users.length,
    };
  }

  /**
   * Update multiple users (batch operation)
   */
  @Patch('batch/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update multiple users',
    description: 'Update multiple users in a single batch operation',
  })
  @ApiResponse({ status: 200, description: 'Users updated successfully' })
  async updateUsersBatch(@Body() batchDto: BatchUpdateUsersDto) {
    await this.optimizedUserService.updateUsersBatch(
      batchDto.updates,
      batchDto.options,
    );

    return {
      message: 'Users updated successfully',
      totalUpdated: batchDto.updates.length,
    };
  }

  /**
   * Soft delete multiple users (batch operation)
   */
  @Delete('batch/soft-delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Soft delete multiple users',
    description: 'Soft delete multiple users in a single batch operation',
  })
  @ApiResponse({ status: 200, description: 'Users deleted successfully' })
  async softDeleteUsersBatch(@Body() batchDto: BatchUserIdsDto) {
    await this.optimizedUserService.softDeleteUsersBatch(batchDto.userIds);

    return {
      message: 'Users soft deleted successfully',
      totalDeleted: batchDto.userIds.length,
    };
  }

  /**
   * Get recently active users
   */
  @Get('recently-active')
  @ApiOperation({
    summary: 'Get recently active users',
    description:
      'Get users who have logged in within the specified number of days',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to look back (default: 30)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recently active users retrieved successfully',
  })
  async getRecentlyActiveUsers(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
    @Query() paginationOptions: CursorPaginationDto,
  ) {
    return this.optimizedUserService.getRecentlyActiveUsers(
      days,
      paginationOptions,
    );
  }

  /**
   * Get users by email domain
   */
  @Get('by-domain/:domain')
  @ApiOperation({
    summary: 'Get users by email domain',
    description: 'Get all users with email addresses from a specific domain',
  })
  @ApiResponse({
    status: 200,
    description: 'Users by domain retrieved successfully',
  })
  async getUsersByEmailDomain(
    @Param('domain') domain: string,
    @Query() paginationOptions: CursorPaginationDto,
  ) {
    return this.optimizedUserService.getUsersByEmailDomain(
      domain,
      paginationOptions,
    );
  }

  /**
   * Get user statistics
   */
  @Get('statistics')
  @ApiOperation({
    summary: 'Get user statistics',
    description:
      'Get comprehensive user statistics including performance metrics',
  })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved successfully',
  })
  async getUserStatistics() {
    return this.optimizedUserService.getUserStatistics();
  }

  /**
   * Get active users count
   */
  @Get('count/active')
  @ApiOperation({
    summary: 'Get active users count',
    description: 'Get the count of active users with optional filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Active users count retrieved successfully',
  })
  async getActiveUsersCount(@Query() filters: UserSearchFiltersDto) {
    const count = await this.optimizedUserService.getActiveUsersCount(filters);
    return { count };
  }

  /**
   * Warm up cache with user IDs
   */
  @Post('cache/warmup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Warm up cache',
    description:
      'Preload frequently accessed users into cache for better performance',
  })
  @ApiResponse({ status: 200, description: 'Cache warmed up successfully' })
  async warmUpCache(@Body() batchDto: BatchUserIdsDto) {
    await this.optimizedUserService.warmUpCache(batchDto.userIds);

    return {
      message: 'Cache warmed up successfully',
      totalUsers: batchDto.userIds.length,
    };
  }

  /**
   * Get performance metrics
   */
  @Get('metrics/performance')
  @ApiOperation({
    summary: 'Get performance metrics',
    description: 'Get current performance metrics for monitoring',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved successfully',
  })
  async getPerformanceMetrics() {
    return this.optimizedUserService.getPerformanceMetrics();
  }

  /**
   * Reset performance metrics
   */
  @Post('metrics/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset performance metrics',
    description: 'Reset performance metrics counters',
  })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics reset successfully',
  })
  async resetPerformanceMetrics() {
    this.optimizedUserService.resetPerformanceMetrics();

    return {
      message: 'Performance metrics reset successfully',
    };
  }
}
