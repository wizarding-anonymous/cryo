import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { CacheService } from '../common/cache/cache.service';
import { SecurityClient } from '../integrations/security/security.client';
import { MetricsService } from '../common/metrics/metrics.service';

export interface BatchUpdateDto {
  id: string;
  data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;
}

export interface BatchOperationResult<T> {
  successful: T[];
  failed: Array<{
    item: any;
    error: string;
  }>;
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface BatchProcessingOptions {
  chunkSize?: number;
  maxConcurrency?: number;
  continueOnError?: boolean;
}

@Injectable()
export class BatchService {
  private readonly logger = new Logger(BatchService.name);
  private readonly DEFAULT_CHUNK_SIZE = 100;
  private readonly DEFAULT_MAX_CONCURRENCY = 5;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
    private readonly securityClient: SecurityClient,
    @Inject(forwardRef(() => MetricsService))
    private readonly metricsService?: MetricsService,
  ) {}

  /**
   * Create multiple users with chunk-based processing
   * @param createUserDtos - Array of user creation data
   * @param options - Processing options
   * @returns Batch operation result
   */
  async createUsers(
    createUserDtos: CreateUserDto[],
    options: BatchProcessingOptions = {},
  ): Promise<BatchOperationResult<User>> {
    const startTime = Date.now();
    const { chunkSize = this.DEFAULT_CHUNK_SIZE, continueOnError = true } =
      options;

    this.logger.log(
      `Starting batch user creation for ${createUserDtos.length} users`,
    );

    const result: BatchOperationResult<User> = {
      successful: [],
      failed: [],
      stats: {
        total: createUserDtos.length,
        successful: 0,
        failed: 0,
      },
    };

    if (createUserDtos.length === 0) {
      return result;
    }

    // Validate input data
    const validationErrors = this.validateCreateUserDtos(createUserDtos);
    if (validationErrors.length > 0) {
      result.failed.push(...validationErrors);
      result.stats.failed = validationErrors.length;
      result.stats.total = createUserDtos.length;
      return result;
    }

    // Process in chunks
    const chunks = this.createChunks(createUserDtos, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.logger.debug(
        `Processing chunk ${i + 1}/${chunks.length} with ${chunk.length} users`,
      );

      try {
        const chunkResult = await this.processCreateUsersChunk(
          chunk,
          continueOnError,
        );
        result.successful.push(...chunkResult.successful);
        result.failed.push(...chunkResult.failed);
      } catch (error) {
        this.logger.error(`Error processing chunk ${i + 1}:`, error);

        if (!continueOnError) {
          // Add remaining items as failed
          const remainingItems = chunks.slice(i).flat();
          result.failed.push(
            ...remainingItems.map((item) => ({
              item,
              error: `Batch processing stopped due to chunk error: ${error.message}`,
            })),
          );
          break;
        }

        // Mark entire chunk as failed
        result.failed.push(
          ...chunk.map((item) => ({
            item,
            error: `Chunk processing failed: ${error.message}`,
          })),
        );
      }
    }

    // Update stats
    result.stats.successful = result.successful.length;
    result.stats.failed = result.failed.length;

    // Cache successful users in batch
    if (result.successful.length > 0) {
      try {
        await this.cacheService.setUsersBatch(result.successful);
      } catch (error) {
        this.logger.warn('Failed to cache batch created users:', error);
      }
    }

    // Record metrics
    const duration = Date.now() - startTime;
    const status = result.stats.failed === 0 ? 'success' : 'error';
    this.metricsService?.recordBatchOperation(
      'create_users',
      status,
      result.stats.total,
      duration,
    );

    this.logger.log(
      `Batch user creation completed: ${result.stats.successful} successful, ${result.stats.failed} failed`,
    );
    return result;
  }

  /**
   * Get multiple users by IDs with chunk-based processing
   * @param ids - Array of user IDs to fetch
   * @param options - Processing options
   * @returns Map of user ID to User object
   */
  async getUsersByIds(
    ids: string[],
    options: BatchProcessingOptions = {},
  ): Promise<Map<string, User>> {
    const { chunkSize = this.DEFAULT_CHUNK_SIZE } = options;

    this.logger.log(`Starting batch user lookup for ${ids.length} users`);

    if (ids.length === 0) {
      return new Map();
    }

    // Remove duplicates and validate IDs
    const uniqueIds = [...new Set(ids)].filter((id) => this.isValidUUID(id));

    if (uniqueIds.length === 0) {
      this.logger.warn('No valid UUIDs provided for batch lookup');
      return new Map();
    }

    const result = new Map<string, User>();

    try {
      // Try to get users from cache first
      const cachedUsers = await this.cacheService.getUsersBatch(uniqueIds);

      // Find which users are missing from cache
      const missingIds = uniqueIds.filter((id) => !cachedUsers.has(id));

      // Add cached users to result
      for (const [id, user] of cachedUsers) {
        result.set(id, user);
      }

      if (missingIds.length > 0) {
        this.logger.debug(
          `${missingIds.length} users not found in cache, fetching from database`,
        );

        // Process missing IDs in chunks
        const chunks = this.createChunks(missingIds, chunkSize);

        for (const chunk of chunks) {
          const dbUsers = await this.userRepository
            .createQueryBuilder('user')
            .where('user.id IN (:...ids)', { ids: chunk })
            .andWhere('user.deletedAt IS NULL')
            .getMany();

          // Add database users to result and cache them
          for (const user of dbUsers) {
            result.set(user.id, user);
            // Cache each user individually for future single lookups
            await this.cacheService.setUser(user);
          }
        }
      }

      this.logger.log(
        `Batch user lookup completed: ${result.size} users found out of ${uniqueIds.length} requested`,
      );
      return result;
    } catch (error) {
      this.logger.error('Error in batch user lookup:', error);
      return result; // Return partial results
    }
  }

  /**
   * Update multiple users with chunk-based processing
   * @param updates - Array of user updates
   * @param options - Processing options
   * @returns Batch operation result
   */
  async updateUsers(
    updates: BatchUpdateDto[],
    options: BatchProcessingOptions = {},
  ): Promise<BatchOperationResult<User>> {
    const startTime = Date.now();
    const { chunkSize = this.DEFAULT_CHUNK_SIZE, continueOnError = true } =
      options;

    this.logger.log(`Starting batch user update for ${updates.length} users`);

    const result: BatchOperationResult<User> = {
      successful: [],
      failed: [],
      stats: {
        total: updates.length,
        successful: 0,
        failed: 0,
      },
    };

    if (updates.length === 0) {
      return result;
    }

    // Validate input data
    const validationErrors = this.validateUpdateDtos(updates);
    if (validationErrors.length > 0) {
      result.failed.push(...validationErrors);
      result.stats.failed = validationErrors.length;
      return result;
    }

    // Process in chunks
    const chunks = this.createChunks(updates, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.logger.debug(
        `Processing update chunk ${i + 1}/${chunks.length} with ${chunk.length} users`,
      );

      try {
        const chunkResult = await this.processUpdateUsersChunk(
          chunk,
          continueOnError,
        );
        result.successful.push(...chunkResult.successful);
        result.failed.push(...chunkResult.failed);
      } catch (error) {
        this.logger.error(`Error processing update chunk ${i + 1}:`, error);

        if (!continueOnError) {
          const remainingItems = chunks.slice(i).flat();
          result.failed.push(
            ...remainingItems.map((item) => ({
              item,
              error: `Batch processing stopped due to chunk error: ${error.message}`,
            })),
          );
          break;
        }

        result.failed.push(
          ...chunk.map((item) => ({
            item,
            error: `Chunk processing failed: ${error.message}`,
          })),
        );
      }
    }

    // Update stats
    result.stats.successful = result.successful.length;
    result.stats.failed = result.failed.length;

    // Invalidate cache for updated users
    if (result.successful.length > 0) {
      try {
        await Promise.all(
          result.successful.map((user) =>
            this.cacheService.invalidateUser(user.id),
          ),
        );
      } catch (error) {
        this.logger.warn(
          'Failed to invalidate cache for updated users:',
          error,
        );
      }
    }

    // Record metrics
    const duration = Date.now() - startTime;
    const status = result.stats.failed === 0 ? 'success' : 'error';
    this.metricsService?.recordBatchOperation(
      'update_users',
      status,
      result.stats.total,
      duration,
    );

    this.logger.log(
      `Batch user update completed: ${result.stats.successful} successful, ${result.stats.failed} failed`,
    );
    return result;
  }

  /**
   * Soft delete multiple users with chunk-based processing
   * @param userIds - Array of user IDs to delete
   * @param options - Processing options
   * @returns Batch operation result
   */
  async softDeleteUsers(
    userIds: string[],
    options: BatchProcessingOptions = {},
  ): Promise<BatchOperationResult<string>> {
    const startTime = Date.now();
    const { chunkSize = this.DEFAULT_CHUNK_SIZE, continueOnError = true } =
      options;

    this.logger.log(
      `Starting batch user soft delete for ${userIds.length} users`,
    );

    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      stats: {
        total: userIds.length,
        successful: 0,
        failed: 0,
      },
    };

    if (userIds.length === 0) {
      return result;
    }

    // Remove duplicates and validate IDs
    const uniqueIds = [...new Set(userIds)].filter((id) =>
      this.isValidUUID(id),
    );

    if (uniqueIds.length === 0) {
      result.failed.push(
        ...userIds.map((id) => ({
          item: id,
          error: 'Invalid UUID format',
        })),
      );
      result.stats.failed = userIds.length;
      return result;
    }

    // Process in chunks
    const chunks = this.createChunks(uniqueIds, chunkSize);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.logger.debug(
        `Processing delete chunk ${i + 1}/${chunks.length} with ${chunk.length} users`,
      );

      try {
        const chunkResult = await this.processSoftDeleteUsersChunk(
          chunk,
          continueOnError,
        );
        result.successful.push(...chunkResult.successful);
        result.failed.push(...chunkResult.failed);
      } catch (error) {
        this.logger.error(`Error processing delete chunk ${i + 1}:`, error);

        if (!continueOnError) {
          const remainingItems = chunks.slice(i).flat();
          result.failed.push(
            ...remainingItems.map((item) => ({
              item,
              error: `Batch processing stopped due to chunk error: ${error.message}`,
            })),
          );
          break;
        }

        result.failed.push(
          ...chunk.map((item) => ({
            item,
            error: `Chunk processing failed: ${error.message}`,
          })),
        );
      }
    }

    // Update stats
    result.stats.successful = result.successful.length;
    result.stats.failed = result.failed.length;

    // Invalidate cache for deleted users
    if (result.successful.length > 0) {
      try {
        await Promise.all(
          result.successful.map((userId) =>
            this.cacheService.invalidateUser(userId),
          ),
        );

        // Log security events for deleted users
        await Promise.all(
          result.successful.map((userId) =>
            this.securityClient.logSecurityEvent({
              userId,
              type: 'USER_DELETED',
              ipAddress: '::1', // This should come from request context
              timestamp: new Date(),
            }),
          ),
        );
      } catch (error) {
        this.logger.warn(
          'Failed to invalidate cache or log security events for deleted users:',
          error,
        );
      }
    }

    // Record metrics
    const duration = Date.now() - startTime;
    const status = result.stats.failed === 0 ? 'success' : 'error';
    this.metricsService?.recordBatchOperation(
      'soft_delete_users',
      status,
      result.stats.total,
      duration,
    );

    this.logger.log(
      `Batch user soft delete completed: ${result.stats.successful} successful, ${result.stats.failed} failed`,
    );
    return result;
  }

  /**
   * Generic method for processing items in chunks
   * @param items - Array of items to process
   * @param chunkSize - Size of each chunk
   * @param processor - Function to process each chunk
   * @returns Promise that resolves when all chunks are processed
   */
  async processInChunks<T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<R>,
  ): Promise<R[]> {
    const chunks = this.createChunks(items, chunkSize);
    const results: R[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      this.logger.debug(
        `Processing generic chunk ${i + 1}/${chunks.length} with ${chunk.length} items`,
      );

      try {
        const result = await processor(chunk);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error processing generic chunk ${i + 1}:`, error);
        throw error;
      }
    }

    return results;
  }

  // Private helper methods

  private createChunks<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private async processCreateUsersChunk(
    chunk: CreateUserDto[],
    continueOnError: boolean,
  ): Promise<BatchOperationResult<User>> {
    const result: BatchOperationResult<User> = {
      successful: [],
      failed: [],
      stats: { total: chunk.length, successful: 0, failed: 0 },
    };

    for (const dto of chunk) {
      try {
        // Normalize email for consistency
        const normalizedEmail = dto.email.toLowerCase().trim();

        // Check if user with this email already exists
        const existingUser = await this.userRepository.findOne({
          where: { email: normalizedEmail },
        });

        if (existingUser) {
          result.failed.push({
            item: dto,
            error: 'User with this email already exists',
          });
          continue;
        }

        // Create new user
        const newUser = this.userRepository.create({
          name: dto.name.trim(),
          email: normalizedEmail,
          password: dto.password, // Already hashed by calling service
        });

        const savedUser = await this.userRepository.save(newUser);
        result.successful.push(savedUser);

        // Log security event
        void this.securityClient.logSecurityEvent({
          userId: savedUser.id,
          type: 'USER_CREATED',
          ipAddress: '::1',
          timestamp: new Date(),
        });
      } catch (error) {
        result.failed.push({
          item: dto,
          error: error.message || 'Unknown error during user creation',
        });

        if (!continueOnError) {
          throw error;
        }
      }
    }

    return result;
  }

  private async processUpdateUsersChunk(
    chunk: BatchUpdateDto[],
    continueOnError: boolean,
  ): Promise<BatchOperationResult<User>> {
    const result: BatchOperationResult<User> = {
      successful: [],
      failed: [],
      stats: { total: chunk.length, successful: 0, failed: 0 },
    };

    for (const update of chunk) {
      try {
        // Check if email is being updated and if it's already in use
        if (update.data.email) {
          const existingUser = await this.userRepository.findOne({
            where: { email: update.data.email.toLowerCase().trim() },
          });
          if (existingUser && existingUser.id !== update.id) {
            result.failed.push({
              item: update,
              error: 'Email already used by another user',
            });
            continue;
          }
        }

        // Password updates are not allowed in User Service
        if (update.data.password) {
          result.failed.push({
            item: update,
            error: 'Password updates must be handled by authentication service',
          });
          continue;
        }

        const userToUpdate = await this.userRepository.preload({
          id: update.id,
          ...update.data,
        });

        if (!userToUpdate) {
          result.failed.push({
            item: update,
            error: 'User not found',
          });
          continue;
        }

        const updatedUser = await this.userRepository.save(userToUpdate);
        result.successful.push(updatedUser);
      } catch (error) {
        result.failed.push({
          item: update,
          error: error.message || 'Unknown error during user update',
        });

        if (!continueOnError) {
          throw error;
        }
      }
    }

    return result;
  }

  private async processSoftDeleteUsersChunk(
    chunk: string[],
    continueOnError: boolean,
  ): Promise<BatchOperationResult<string>> {
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      stats: { total: chunk.length, successful: 0, failed: 0 },
    };

    try {
      // Perform batch soft delete
      const deleteResult = await this.userRepository.softDelete(chunk);

      if (deleteResult.affected) {
        // All users in chunk were successfully deleted
        result.successful.push(...chunk);
      } else {
        // No users were deleted - they might not exist
        for (const id of chunk) {
          const user = await this.userRepository.findOne({ where: { id } });
          if (!user) {
            result.failed.push({
              item: id,
              error: 'User not found',
            });
          } else {
            result.failed.push({
              item: id,
              error: 'Failed to delete user',
            });
          }
        }
      }
    } catch (error) {
      // If batch operation fails, try individual deletes if continueOnError is true
      if (continueOnError) {
        for (const id of chunk) {
          try {
            const deleteResult = await this.userRepository.softDelete(id);
            if (deleteResult.affected && deleteResult.affected > 0) {
              result.successful.push(id);
            } else {
              result.failed.push({
                item: id,
                error: 'User not found or already deleted',
              });
            }
          } catch (individualError) {
            result.failed.push({
              item: id,
              error:
                individualError.message || 'Unknown error during user deletion',
            });
          }
        }
      } else {
        throw error;
      }
    }

    return result;
  }

  private validateCreateUserDtos(
    dtos: CreateUserDto[],
  ): Array<{ item: CreateUserDto; error: string }> {
    const errors: Array<{ item: CreateUserDto; error: string }> = [];

    for (const dto of dtos) {
      if (
        !dto.email ||
        typeof dto.email !== 'string' ||
        !this.isValidEmail(dto.email)
      ) {
        errors.push({ item: dto, error: 'Invalid email format' });
        continue;
      }

      if (
        !dto.name ||
        typeof dto.name !== 'string' ||
        dto.name.trim().length === 0
      ) {
        errors.push({
          item: dto,
          error: 'Name is required and cannot be empty',
        });
        continue;
      }

      if (
        !dto.password ||
        typeof dto.password !== 'string' ||
        dto.password.length === 0
      ) {
        errors.push({ item: dto, error: 'Password is required' });
        continue;
      }
    }

    return errors;
  }

  private validateUpdateDtos(
    updates: BatchUpdateDto[],
  ): Array<{ item: BatchUpdateDto; error: string }> {
    const errors: Array<{ item: BatchUpdateDto; error: string }> = [];

    for (const update of updates) {
      if (!update.id || !this.isValidUUID(update.id)) {
        errors.push({ item: update, error: 'Invalid user ID format' });
        continue;
      }

      if (!update.data || Object.keys(update.data).length === 0) {
        errors.push({ item: update, error: 'No update data provided' });
        continue;
      }

      if (update.data.email && !this.isValidEmail(update.data.email)) {
        errors.push({ item: update, error: 'Invalid email format' });
        continue;
      }

      if (
        update.data.name !== undefined &&
        (!update.data.name || update.data.name.trim().length === 0)
      ) {
        errors.push({ item: update, error: 'Name cannot be empty' });
        continue;
      }
    }

    return errors;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
}
