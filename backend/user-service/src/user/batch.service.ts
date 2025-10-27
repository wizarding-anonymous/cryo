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

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly cacheService: CacheService,
    private readonly securityClient: SecurityClient,
    @Inject(forwardRef(() => MetricsService))
    private readonly metricsService?: MetricsService,
  ) {}

  /**
   * Validate a single user DTO
   */
  private validateUserDto(dto: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dto.name || typeof dto.name !== 'string' || dto.name.trim().length === 0) {
      errors.push('Name is required and must be a non-empty string');
    }

    if (!dto.email || typeof dto.email !== 'string') {
      errors.push('Email is required and must be a string');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(dto.email)) {
        errors.push('Email must be a valid email address');
      }
    }

    if (!dto.password || typeof dto.password !== 'string' || dto.password.length < 8) {
      errors.push('Password is required and must be at least 8 characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create multiple users with chunk-based processing and individual validation
   */
  async createUsers(
    createUserDtos: any[],
    options: BatchProcessingOptions = {},
  ): Promise<BatchOperationResult<User>> {
    const { chunkSize = this.DEFAULT_CHUNK_SIZE } = options;
    
    this.logger.log(`Starting batch user creation for ${createUserDtos.length} users`);
    
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

    // Process in chunks
    for (let i = 0; i < createUserDtos.length; i += chunkSize) {
      const chunk = createUserDtos.slice(i, i + chunkSize);
      
      // Validate and separate valid/invalid items in this chunk
      const validUsers: any[] = [];
      
      for (const dto of chunk) {
        const validation = this.validateUserDto(dto);
        
        if (validation.isValid) {
          validUsers.push(dto);
        } else {
          result.failed.push({
            item: dto,
            error: validation.errors.join(', '),
          });
          result.stats.failed++;
        }
      }

      // Process valid users
      if (validUsers.length > 0) {
        try {
          // Create users from valid DTOs
          const users = validUsers.map(dto => {
            const user = new User();
            user.name = dto.name.trim();
            user.email = dto.email.toLowerCase().trim();
            user.password = dto.password;
            user.isActive = true;
            user.createdAt = new Date();
            user.updatedAt = new Date();
            return user;
          });

          const savedUsers = await this.userRepository.save(users);
          result.successful.push(...savedUsers);
          result.stats.successful += savedUsers.length;
          
          this.logger.debug(`Successfully created ${savedUsers.length} valid users from chunk`);
        } catch (error: any) {
          this.logger.error(`Failed to create valid users in chunk: ${error.message}`);
          
          // Add failed items for database errors
          validUsers.forEach(dto => {
            result.failed.push({
              item: dto,
              error: `Database error: ${error.message}`,
            });
            result.stats.failed++;
          });
        }
      }
    }

    this.logger.log(`Batch creation completed: ${result.stats.successful}/${result.stats.total} successful`);
    return result;
  }

  /**
   * Get users by IDs
   */
  async getUsersByIds(
    ids: string[],
    options: BatchProcessingOptions = {}
  ): Promise<Map<string, User>> {
    const { chunkSize = this.DEFAULT_CHUNK_SIZE } = options;
    
    this.logger.log(`Looking up ${ids.length} users by ID`);
    
    const usersMap = new Map<string, User>();

    // Process in chunks
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      
      try {
        const users = await this.userRepository
          .createQueryBuilder('user')
          .where('user.id IN (:...ids)', { ids: chunk })
          .getMany();

        users.forEach(user => {
          usersMap.set(user.id, user);
        });
        
        this.logger.debug(`Found ${users.length} users in chunk of ${chunk.length}`);
      } catch (error: any) {
        this.logger.error(`Failed to lookup chunk: ${error.message}`);
      }
    }

    this.logger.log(`Lookup completed: found ${usersMap.size}/${ids.length} users`);
    return usersMap;
  }

  /**
   * Update multiple users
   */
  async updateUsers(
    updates: BatchUpdateDto[],
    options: BatchProcessingOptions = {}
  ): Promise<BatchOperationResult<User>> {
    const { chunkSize = this.DEFAULT_CHUNK_SIZE } = options;
    
    this.logger.log(`Starting batch update of ${updates.length} users`);
    
    const result: BatchOperationResult<User> = {
      successful: [],
      failed: [],
      stats: {
        total: updates.length,
        successful: 0,
        failed: 0,
      },
    };

    // Process in chunks
    for (let i = 0; i < updates.length; i += chunkSize) {
      const chunk = updates.slice(i, i + chunkSize);
      
      for (const update of chunk) {
        try {
          // Update individual user
          const updateResult = await this.userRepository
            .createQueryBuilder()
            .update(User)
            .set({ 
              ...update.data,
              updatedAt: new Date()
            })
            .where('id = :id', { id: update.id })
            .execute();

          if (updateResult.affected && updateResult.affected > 0) {
            // Fetch updated user
            const updatedUser = await this.userRepository.findOne({
              where: { id: update.id }
            });
            
            if (updatedUser) {
              result.successful.push(updatedUser);
              result.stats.successful++;
            }
          } else {
            result.failed.push({
              item: update,
              error: 'User not found or no changes made',
            });
            result.stats.failed++;
          }
        } catch (error: any) {
          this.logger.error(`Failed to update user ${update.id}: ${error.message}`);
          result.failed.push({
            item: update,
            error: error.message,
          });
          result.stats.failed++;
        }
      }
      
      this.logger.debug(`Processed update chunk of ${chunk.length} users`);
    }

    this.logger.log(`Batch update completed: ${result.stats.successful}/${result.stats.total} successful`);
    return result;
  }

  /**
   * Soft delete multiple users
   */
  async softDeleteUsers(
    userIds: string[],
    options: BatchProcessingOptions = {}
  ): Promise<BatchOperationResult<string>> {
    const { chunkSize = this.DEFAULT_CHUNK_SIZE } = options;
    
    this.logger.log(`Starting soft delete of ${userIds.length} users`);
    
    const result: BatchOperationResult<string> = {
      successful: [],
      failed: [],
      stats: {
        total: userIds.length,
        successful: 0,
        failed: 0,
      },
    };

    // Process in chunks
    for (let i = 0; i < userIds.length; i += chunkSize) {
      const chunk = userIds.slice(i, i + chunkSize);
      
      try {
        // Soft delete by setting isActive to false and deletedAt timestamp
        await this.userRepository
          .createQueryBuilder()
          .update(User)
          .set({ 
            isActive: false, 
            deletedAt: new Date() 
          })
          .where('id IN (:...ids)', { ids: chunk })
          .execute();

        result.successful.push(...chunk);
        result.stats.successful += chunk.length;
        
        this.logger.debug(`Soft deleted chunk of ${chunk.length} users`);
      } catch (error: any) {
        this.logger.error(`Failed to soft delete chunk: ${error.message}`);
        
        // Add failed items
        chunk.forEach(id => {
          result.failed.push({
            item: id,
            error: error.message,
          });
        });
        result.stats.failed += chunk.length;
      }
    }

    this.logger.log(`Soft delete completed: ${result.stats.successful}/${result.stats.total} successful`);
    return result;
  }

  /**
   * Get paginated users for performance testing
   */
  async getUsersPaginated(options: {
    skip: number;
    take: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<User[]> {
    const { skip, take, sortBy, sortOrder } = options;
    
    try {
      const queryBuilder = this.userRepository.createQueryBuilder('user');
      
      // Add sorting
      const sortField = sortBy === 'createdAt' ? 'user.createdAt' : `user.${sortBy}`;
      queryBuilder.orderBy(sortField, sortOrder.toUpperCase() as 'ASC' | 'DESC');
      
      // Add pagination
      queryBuilder.skip(skip).take(take);
      
      // Execute query
      const users = await queryBuilder.getMany();
      
      this.logger.debug(`Retrieved ${users.length} users with pagination (skip: ${skip}, take: ${take})`);
      
      return users;
    } catch (error: any) {
      this.logger.error(`Pagination query failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process items in chunks with a custom processor function
   */
  async processInChunks<T>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<void>
  ): Promise<void> {
    this.logger.log(`Processing ${items.length} items in chunks of ${chunkSize}`);
    
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      this.logger.debug(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(items.length / chunkSize)}`);
      
      try {
        await processor(chunk);
      } catch (error) {
        this.logger.error(`Failed to process chunk starting at index ${i}:`, error);
        throw error;
      }
    }
    
    this.logger.log(`Successfully processed all ${items.length} items`);
  }
}