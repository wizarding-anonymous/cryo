import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { UserServiceError, ErrorCodes } from '../common/errors';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { SecurityClient } from '../integrations/security/security.client';
import { IntegrationService } from '../integrations/integration.service';
import { CacheService } from '../common/cache/cache.service';
import { LoggingService, AuditService } from '../common/logging';
import {
  LogDatabaseOperation,
  LogCacheOperation,
} from '../common/logging/log-method.decorator';
import {
  BatchService,
  BatchUpdateDto,
  BatchOperationResult,
  BatchProcessingOptions,
} from './batch.service';
import { PaginationService } from '../common/services/pagination.service';
import { UserFilterDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/api-response.dto';
import { UserEncryptionService } from './services/user-encryption.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly securityClient: SecurityClient,
    private readonly integrationService: IntegrationService,
    private readonly cacheService: CacheService,
    private readonly batchService: BatchService,
    private readonly loggingService: LoggingService,
    private readonly auditService: AuditService,
    private readonly paginationService: PaginationService,
    private readonly userEncryptionService: UserEncryptionService,
  ) {}

  /**
   * Creates a new user in the database.
   * Password should already be hashed by calling service.
   * Used by other services during user registration process.
   * @param createUserDto - The data to create a user.
   * @returns The newly created user.
   * @throws ConflictException if user with email already exists.
   */
  @LogDatabaseOperation('users', 'create')
  async create(
    createUserDto: CreateUserDto,
    correlationId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<User> {
    const startTime = Date.now();
    const { name, email, password } = createUserDto;
    const normalizedEmail = email.toLowerCase().trim();

    this.loggingService.info('Creating new user', {
      correlationId: correlationId || 'unknown',
      operation: 'user_create',
      metadata: {
        email: normalizedEmail,
        hasPassword: !!password,
      },
    });

    // Check if user with this email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      this.loggingService.warn('User creation failed - email already exists', {
        correlationId: correlationId || 'unknown',
        operation: 'user_create_conflict',
        metadata: {
          email: normalizedEmail,
          existingUserId: existingUser.id,
        },
      });
      throw UserServiceError.userAlreadyExists(normalizedEmail, correlationId);
    }

    // Password is already hashed by calling service
    const newUser = this.userRepository.create({
      name: name.trim(),
      email: normalizedEmail,
      password, // Already hashed
    });

    try {
      // Prepare user for save (encrypt sensitive fields if present)
      const preparedUser = this.userEncryptionService.prepareUserForSave(newUser);
      const savedUser = await this.userRepository.save(preparedUser);
      
      // Decrypt sensitive fields for response
      const decryptedUser = this.userEncryptionService.prepareUserAfterLoad(savedUser);
      const duration = Date.now() - startTime;

      // Log database operation
      this.loggingService.logDatabaseOperation(
        'CREATE',
        'users',
        correlationId || 'unknown',
        duration,
        true,
        1,
      );

      // Enhanced audit logging with suspicious activity detection
      await this.auditService.logEnhancedDataAccess({
        operation: 'CREATE',
        table: 'users',
        recordId: savedUser.id,
        userId: 'system', // System-initiated creation
        correlationId: correlationId || 'unknown',
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        fieldsAccessed: ['email', 'password', 'name'],
        success: true,
      });

      // Cache the newly created user (with decrypted data)
      try {
        await this.cacheService.setUser(decryptedUser);
        this.loggingService.logCacheOperation(
          'set',
          `user:${decryptedUser.id}`,
          correlationId || 'unknown',
          Date.now() - startTime,
          true,
        );
      } catch (cacheError) {
        this.loggingService.warn('Failed to cache new user', {
          correlationId: correlationId || 'unknown',
          operation: 'cache_set_error',
          metadata: {
            userId: decryptedUser.id,
            error: cacheError.message,
          },
        });
      }

      // Notify Auth Service and other microservices about user creation
      try {
        await this.integrationService.notifyUserCreated(decryptedUser);
        this.loggingService.info(
          'Successfully notified services about user creation',
          {
            correlationId: correlationId || 'unknown',
            operation: 'user_create_notification',
            metadata: {
              userId: decryptedUser.id,
            },
          },
        );
      } catch (integrationError) {
        this.loggingService.error(
          'Failed to notify services about user creation',
          {
            correlationId: correlationId || 'unknown',
            operation: 'user_create_notification_error',
            metadata: {
              userId: decryptedUser.id,
              error: integrationError.message,
            },
          },
          integrationError,
        );
      }

      // Log a security event for the new user creation
      try {
        await this.securityClient.logSecurityEvent({
          userId: decryptedUser.id,
          type: 'USER_CREATED',
          ipAddress: ipAddress || '::1',
          timestamp: new Date(),
        });
      } catch (securityError) {
        this.loggingService.warn('Failed to log security event', {
          correlationId: correlationId || 'unknown',
          operation: 'security_event_error',
          metadata: {
            userId: decryptedUser.id,
            error: securityError.message,
          },
        });
      }

      this.loggingService.info('User created successfully', {
        correlationId: correlationId || 'unknown',
        operation: 'user_create_success',
        duration,
        metadata: {
          userId: decryptedUser.id,
          email: normalizedEmail,
        },
      });

      return decryptedUser;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log database operation failure
      this.loggingService.logDatabaseOperation(
        'CREATE',
        'users',
        correlationId || 'unknown',
        duration,
        false,
        0,
        error,
      );

      // Enhanced audit logging for failed creation
      await this.auditService.logEnhancedDataAccess({
        operation: 'CREATE',
        table: 'users',
        userId: 'system',
        correlationId: correlationId || 'unknown',
        ipAddress: ipAddress || 'unknown',
        userAgent: userAgent || 'unknown',
        fieldsAccessed: ['email', 'password', 'name'],
        success: false,
        error: error.message,
      });

      // Handle database constraint violations
      if (error.code === '23505') {
        this.loggingService.warn(
          'User creation failed - database constraint violation',
          {
            correlationId: correlationId || 'unknown',
            operation: 'user_create_constraint_error',
            metadata: {
              email: normalizedEmail,
              errorCode: error.code,
            },
          },
        );
        throw UserServiceError.userAlreadyExists(
          normalizedEmail,
          correlationId,
        );
      }

      this.loggingService.error(
        'User creation failed',
        {
          correlationId: correlationId || 'unknown',
          operation: 'user_create_error',
          duration,
          metadata: {
            email: normalizedEmail,
            errorCode: error.code,
            errorMessage: error.message,
          },
        },
        error,
      );

      throw error;
    }
  }

  /**
   * Finds a user by their email address.
   * Used by other services for user lookup.
   * @param email - The email of the user to find.
   * @returns The user if found, otherwise null.
   */
  @LogDatabaseOperation('users', 'findByEmail')
  async findByEmail(
    email: string,
    correlationId?: string,
  ): Promise<User | null> {
    if (!email || typeof email !== 'string') {
      this.loggingService.warn('Invalid email provided for user lookup', {
        correlationId: correlationId || 'unknown',
        operation: 'user_find_by_email_invalid',
        metadata: {
          email: typeof email,
          emailProvided: !!email,
        },
      });
      return null;
    }

    const startTime = Date.now();
    const normalizedEmail = email.toLowerCase().trim();

    try {
      this.loggingService.debug('Looking up user by email', {
        correlationId: correlationId || 'unknown',
        operation: 'user_find_by_email',
        metadata: {
          email: normalizedEmail,
        },
      });

      // Try to find user in database (email is not cached by ID)
      const user = await this.userRepository.findOne({
        where: { email: normalizedEmail },
      });

      const duration = Date.now() - startTime;

      // Log database operation
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        true,
        user ? 1 : 0,
      );

      // If user found, decrypt sensitive fields and cache it by ID for future lookups
      if (user) {
        const decryptedUser = this.userEncryptionService.prepareUserAfterLoad(user);
        try {
          await this.cacheService.setUser(decryptedUser);
          this.loggingService.logCacheOperation(
            'set',
            `user:${decryptedUser.id}`,
            correlationId || 'unknown',
            Date.now() - startTime,
            true,
          );
        } catch (cacheError) {
          this.loggingService.warn('Failed to cache user after email lookup', {
            correlationId: correlationId || 'unknown',
            operation: 'cache_set_error',
            metadata: {
              userId: decryptedUser.id,
              error: cacheError.message,
            },
          });
        }

        this.loggingService.debug('User found by email', {
          correlationId: correlationId || 'unknown',
          operation: 'user_find_by_email_success',
          duration,
          metadata: {
            userId: decryptedUser.id,
            email: normalizedEmail,
          },
        });
        
        return decryptedUser;
      } else {
        this.loggingService.debug('User not found by email', {
          correlationId: correlationId || 'unknown',
          operation: 'user_find_by_email_not_found',
          duration,
          metadata: {
            email: normalizedEmail,
          },
        });
        return null;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log database operation failure
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        false,
        0,
        error,
      );

      this.loggingService.error(
        'Error finding user by email',
        {
          correlationId: correlationId || 'unknown',
          operation: 'user_find_by_email_error',
          duration,
          metadata: {
            email: normalizedEmail,
            errorMessage: error.message,
          },
        },
        error,
      );

      return null;
    }
  }

  /**
   * Finds a user by their ID.
   * Used by other services for user verification.
   * @param id - The UUID of the user to find.
   * @returns The user if found, otherwise null.
   */
  @LogCacheOperation('get')
  async findById(id: string, correlationId?: string): Promise<User | null> {
    if (!id || typeof id !== 'string') {
      this.loggingService.warn('Invalid ID provided for user lookup', {
        correlationId: correlationId || 'unknown',
        operation: 'user_find_by_id_invalid',
        metadata: {
          idType: typeof id,
          idProvided: !!id,
        },
      });
      return null;
    }

    const startTime = Date.now();

    try {
      this.loggingService.debug('Looking up user by ID', {
        correlationId: correlationId || 'unknown',
        operation: 'user_find_by_id',
        metadata: {
          userId: id,
        },
      });

      // Try cache first (cache-aside pattern)
      const cachedUser = await this.cacheService.getUser(id);
      if (cachedUser) {
        const duration = Date.now() - startTime;
        this.loggingService.logCacheOperation(
          'get',
          `user:${id}`,
          correlationId || 'unknown',
          duration,
          true,
        );

        this.loggingService.debug('User found in cache', {
          correlationId: correlationId || 'unknown',
          operation: 'user_find_by_id_cache_hit',
          duration,
          metadata: {
            userId: id,
          },
        });

        return cachedUser;
      }

      // Cache miss - log it
      this.loggingService.logCacheOperation(
        'get',
        `user:${id}`,
        correlationId || 'unknown',
        Date.now() - startTime,
        false,
      );

      // If not in cache, fetch from database
      const user = await this.userRepository.findOne({
        where: { id },
      });

      const duration = Date.now() - startTime;

      // Log database operation
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        true,
        user ? 1 : 0,
      );

      // Cache the result if user found (decrypt sensitive fields first)
      if (user) {
        const decryptedUser = this.userEncryptionService.prepareUserAfterLoad(user);
        try {
          await this.cacheService.setUser(decryptedUser);
          this.loggingService.logCacheOperation(
            'set',
            `user:${id}`,
            correlationId || 'unknown',
            Date.now() - startTime,
            true,
          );
        } catch (cacheError) {
          this.loggingService.warn(
            'Failed to cache user after database lookup',
            {
              correlationId: correlationId || 'unknown',
              operation: 'cache_set_error',
              metadata: {
                userId: id,
                error: cacheError.message,
              },
            },
          );
        }

        this.loggingService.debug('User found in database and cached', {
          correlationId: correlationId || 'unknown',
          operation: 'user_find_by_id_db_success',
          duration,
          metadata: {
            userId: id,
          },
        });
        
        return decryptedUser;
      } else {
        this.loggingService.debug('User not found by ID', {
          correlationId: correlationId || 'unknown',
          operation: 'user_find_by_id_not_found',
          duration,
          metadata: {
            userId: id,
          },
        });
        return null;
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log database operation failure
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        false,
        0,
        error,
      );

      this.loggingService.error(
        'Error finding user by ID',
        {
          correlationId: correlationId || 'unknown',
          operation: 'user_find_by_id_error',
          duration,
          metadata: {
            userId: id,
            errorMessage: error.message,
          },
        },
        error,
      );

      return null;
    }
  }

  /**
   * Finds a user by their ID without password.
   * @param id - The UUID of the user to find.
   * @returns The user if found (without password), otherwise null.
   */
  async findByIdWithoutPassword(
    id: string,
  ): Promise<Omit<User, 'password'> | null> {
    // Use cached findById method
    const user = await this.findById(id);
    if (!user) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Updates a user's information.
   * @param id - The ID of the user to update.
   * @param updateData - The data to update (partial user data).
   * @returns The updated user.
   * @throws NotFoundException if the user does not exist.
   * @throws ConflictException if email is already in use by another user.
   */
  async update(
    id: string,
    updateData: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>,
    correlationId?: string,
  ): Promise<User> {
    // Check if email is being updated and if it's already in use
    if (updateData.email) {
      const existingUser = await this.findByEmail(updateData.email);
      if (existingUser && existingUser.id !== id) {
        throw UserServiceError.userAlreadyExists(
          updateData.email,
          correlationId,
        );
      }
    }

    // Password updates are handled by authentication service
    // User Service only manages user profile data
    if (updateData.password) {
      throw new UserServiceError(
        ErrorCodes.FORBIDDEN_OPERATION,
        'Password updates must be handled by authentication service',
        { field: 'password' },
        correlationId,
      );
    }

    const existingUser = await this.userRepository.findOne({ where: { id } });
    if (!existingUser) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    // Prepare update data with encryption for sensitive fields
    const preparedUpdateData = this.userEncryptionService.prepareUserForSave(updateData);
    
    const userToUpdate = await this.userRepository.preload({
      id: id,
      ...preparedUpdateData,
    });

    if (!userToUpdate) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    const savedUser = await this.userRepository.save(userToUpdate);
    const updatedUser = this.userEncryptionService.prepareUserAfterLoad(savedUser);

    // Invalidate cache after update
    await this.cacheService.invalidateUser(id);

    // Cache the updated user
    await this.cacheService.setUser(updatedUser);

    // Notify Auth Service and other microservices about user update
    try {
      await this.integrationService.notifyUserUpdated(updatedUser, updateData);
    } catch (integrationError) {
      // Log integration error but don't fail user update
      console.error(
        'Failed to notify services about user update:',
        integrationError,
      );
    }

    return updatedUser;
  }

  /**
   * Soft deletes a user from the database.
   * @param id - The ID of the user to delete.
   * @returns A promise that resolves when the user is deleted.
   * @throws NotFoundException if the user does not exist.
   */
  async delete(id: string, correlationId?: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    const result = await this.userRepository.softDelete(id);
    if (result.affected === 0) {
      throw UserServiceError.userNotFound(id, correlationId);
    }

    // Invalidate cache after deletion
    await this.cacheService.invalidateUser(id);

    // Notify Auth Service and other microservices about user deletion
    try {
      await this.integrationService.notifyUserDeleted(id);
    } catch (integrationError) {
      // Log integration error but don't fail user deletion
      console.error(
        'Failed to notify services about user deletion:',
        integrationError,
      );
    }

    // Log security event for account deletion
    void this.securityClient.logSecurityEvent({
      userId: id,
      type: 'USER_DELETED',
      ipAddress: '::1', // Mock IP address for now
      timestamp: new Date(),
    });
  }

  /**
   * Alias for delete method to match controller naming.
   * @param id - The ID of the user to delete.
   * @returns A promise that resolves when the user is deleted.
   */
  async deleteUser(id: string): Promise<void> {
    return this.delete(id);
  }

  /**
   * Checks if a user exists by their ID.
   * Used by other services for user validation without returning sensitive data.
   * @param id - The UUID of the user to check.
   * @returns True if the user exists, false otherwise.
   */
  async exists(id: string): Promise<boolean> {
    if (!id || typeof id !== 'string') {
      return false;
    }

    try {
      const count = await this.userRepository.count({
        where: { id },
      });
      return count > 0;
    } catch (error) {
      // Log error but don't throw to allow graceful handling
      console.error('Error checking user existence:', error);
      return false;
    }
  }

  /**
   * Updates a user's profile information.
   * @param id - The ID of the user to update.
   * @param updateData - The profile data to update.
   * @returns The updated user (without password).
   */
  async updateProfile(
    id: string,
    updateData: { name?: string },
  ): Promise<Omit<User, 'password'>> {
    const updatedUser = await this.update(id, updateData);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Updates the last login timestamp for a user.
   * Called by authentication service after successful login.
   * @param id - The ID of the user.
   * @returns Promise that resolves when last login is updated.
   * @throws NotFoundException if the user does not exist.
   */
  async updateLastLogin(id: string, correlationId?: string): Promise<void> {
    if (!id || typeof id !== 'string') {
      throw new UserServiceError(
        ErrorCodes.INVALID_USER_DATA,
        'Invalid user ID provided',
        { field: 'id', value: id },
        correlationId,
      );
    }

    try {
      const result = await this.userRepository.update(id, {
        lastLoginAt: new Date(),
      });

      // Check if any rows were affected
      if (result.affected === 0) {
        throw UserServiceError.userNotFound(id, correlationId);
      }

      // Invalidate cache after last login update
      await this.cacheService.invalidateUser(id);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      // Log error and re-throw as UserServiceError for consistency
      this.loggingService.error(
        'Error updating last login',
        {
          correlationId: correlationId || 'unknown',
          operation: 'update_last_login_error',
          metadata: { userId: id },
        },
        error,
      );
      throw UserServiceError.databaseError(
        'Failed to update last login',
        error,
        correlationId,
      );
    }
  }

  /**
   * Get multiple users by IDs with caching (batch operation)
   * @param ids - Array of user IDs to fetch
   * @param options - Batch processing options
   * @returns Map of user ID to User object
   */
  async findUsersBatch(
    ids: string[],
    options?: BatchProcessingOptions,
  ): Promise<Map<string, User>> {
    return this.batchService.getUsersByIds(ids, options);
  }

  /**
   * Create multiple users (batch operation)
   * @param createUserDtos - Array of user creation data
   * @param options - Batch processing options
   * @returns Batch operation result with successful and failed users
   */
  async createUsersBatch(
    createUserDtos: CreateUserDto[],
    options?: BatchProcessingOptions,
  ): Promise<BatchOperationResult<User>> {
    return this.batchService.createUsers(createUserDtos, options);
  }

  /**
   * Update last login for multiple users (batch operation)
   * @param userIds - Array of user IDs to update
   * @param options - Batch processing options
   * @returns Batch operation result
   */
  async updateLastLoginBatch(
    userIds: string[],
    options?: BatchProcessingOptions,
  ): Promise<BatchOperationResult<User>> {
    const updates: BatchUpdateDto[] = userIds.map((id) => ({
      id,
      data: { lastLoginAt: new Date() },
    }));

    return this.batchService.updateUsers(updates, options);
  }

  /**
   * Update multiple users (batch operation)
   * @param updates - Array of user updates
   * @param options - Batch processing options
   * @returns Batch operation result
   */
  async updateUsersBatch(
    updates: BatchUpdateDto[],
    options?: BatchProcessingOptions,
  ): Promise<BatchOperationResult<User>> {
    return this.batchService.updateUsers(updates, options);
  }

  /**
   * Soft delete multiple users (batch operation)
   * @param userIds - Array of user IDs to delete
   * @param options - Batch processing options
   * @returns Batch operation result
   */
  async softDeleteUsersBatch(
    userIds: string[],
    options?: BatchProcessingOptions,
  ): Promise<BatchOperationResult<string>> {
    return this.batchService.softDeleteUsers(userIds, options);
  }

  /**
   * Get cache statistics for monitoring
   * @returns Cache statistics
   */
  async getCacheStats() {
    return this.cacheService.getCacheStats();
  }

  /**
   * Warm up cache with frequently accessed users
   * @param userIds - Array of user IDs to preload
   */
  async warmUpCache(userIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    try {
      // Fetch users from database
      const users = await this.userRepository.findByIds(userIds);

      // Warm up cache
      await this.cacheService.warmUpCache(users);
    } catch (error) {
      console.error('Error warming up cache:', error);
    }
  }

  /**
   * Clear user cache (for maintenance)
   */
  async clearCache(): Promise<void> {
    await this.cacheService.clearCache();
  }

  /**
   * Find users with pagination and filtering
   * @param filterDto - Filter and pagination parameters
   * @returns Paginated list of users
   */
  async findUsersWithPagination(
    filterDto: UserFilterDto,
    correlationId?: string,
  ): Promise<PaginatedResponseDto<Omit<User, 'password'>>> {
    const startTime = Date.now();

    try {
      this.loggingService.info('Finding users with pagination', {
        correlationId: correlationId || 'unknown',
        operation: 'users_find_paginated',
        metadata: {
          filters: {
            name: filterDto.name,
            email: filterDto.email,
            isActive: filterDto.isActive,
            includeDeleted: filterDto.includeDeleted,
          },
          pagination: {
            page: filterDto.page,
            limit: filterDto.limit,
            cursor: !!filterDto.cursor,
            sortBy: filterDto.sortBy,
            sortOrder: filterDto.sortOrder,
          },
        },
      });

      // Create query builder
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      // Apply filters
      this.paginationService.applyUserFilters(queryBuilder, filterDto, 'user');

      // Apply pagination (prefer cursor-based if cursor is provided)
      const result = filterDto.cursor
        ? await this.paginationService.applyCursorPagination(
            queryBuilder,
            filterDto,
            'user',
          )
        : await this.paginationService.applyOffsetPagination(
            queryBuilder,
            filterDto,
            'user',
          );

      const duration = Date.now() - startTime;

      // Log database operation
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        true,
        result.items.length,
      );

      // Remove passwords from response
      const usersWithoutPasswords = result.items.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      const paginatedResponse = this.paginationService.createPaginatedResponse(
        usersWithoutPasswords,
        result.pagination,
      );

      this.loggingService.info('Users found with pagination', {
        correlationId: correlationId || 'unknown',
        operation: 'users_find_paginated_success',
        duration,
        metadata: {
          totalFound: result.items.length,
          hasNext: result.pagination.hasNext,
          hasPrevious: result.pagination.hasPrevious,
        },
      });

      return paginatedResponse;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log database operation failure
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        false,
        0,
        error,
      );

      this.loggingService.error(
        'Error finding users with pagination',
        {
          correlationId: correlationId || 'unknown',
          operation: 'users_find_paginated_error',
          duration,
          metadata: {
            errorMessage: error.message,
          },
        },
        error,
      );

      throw error;
    }
  }

  /**
   * Search users by name or email with pagination
   * @param searchTerm - Search term for name or email
   * @param filterDto - Filter and pagination parameters
   * @returns Paginated list of users matching search term
   */
  async searchUsers(
    searchTerm: string,
    filterDto: UserFilterDto,
    correlationId?: string,
  ): Promise<PaginatedResponseDto<Omit<User, 'password'>>> {
    const startTime = Date.now();

    try {
      this.loggingService.info('Searching users', {
        correlationId: correlationId || 'unknown',
        operation: 'users_search',
        metadata: {
          searchTerm: searchTerm.substring(0, 50), // Limit logged search term length
          pagination: {
            page: filterDto.page,
            limit: filterDto.limit,
            cursor: !!filterDto.cursor,
            sortBy: filterDto.sortBy,
            sortOrder: filterDto.sortOrder,
          },
        },
      });

      // Create query builder with search conditions
      const queryBuilder = this.userRepository.createQueryBuilder('user');

      // Apply search conditions (name OR email)
      if (searchTerm && searchTerm.trim()) {
        const trimmedSearchTerm = searchTerm.trim();
        queryBuilder.andWhere(
          '(user.name ILIKE :searchTerm OR user.email ILIKE :searchTerm)',
          { searchTerm: `%${trimmedSearchTerm}%` },
        );
      }

      // Apply additional filters
      this.paginationService.applyUserFilters(queryBuilder, filterDto, 'user');

      // Apply pagination
      const result = filterDto.cursor
        ? await this.paginationService.applyCursorPagination(
            queryBuilder,
            filterDto,
            'user',
          )
        : await this.paginationService.applyOffsetPagination(
            queryBuilder,
            filterDto,
            'user',
          );

      const duration = Date.now() - startTime;

      // Log database operation
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        true,
        result.items.length,
      );

      // Remove passwords from response
      const usersWithoutPasswords = result.items.map((user) => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });

      const paginatedResponse = this.paginationService.createPaginatedResponse(
        usersWithoutPasswords,
        result.pagination,
      );

      this.loggingService.info('Users search completed', {
        correlationId: correlationId || 'unknown',
        operation: 'users_search_success',
        duration,
        metadata: {
          searchTerm: searchTerm.substring(0, 50),
          totalFound: result.items.length,
          hasNext: result.pagination.hasNext,
          hasPrevious: result.pagination.hasPrevious,
        },
      });

      return paginatedResponse;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log database operation failure
      this.loggingService.logDatabaseOperation(
        'READ',
        'users',
        correlationId || 'unknown',
        duration,
        false,
        0,
        error,
      );

      this.loggingService.error(
        'Error searching users',
        {
          correlationId: correlationId || 'unknown',
          operation: 'users_search_error',
          duration,
          metadata: {
            searchTerm: searchTerm.substring(0, 50),
            errorMessage: error.message,
          },
        },
        error,
      );

      throw error;
    }
  }
}
