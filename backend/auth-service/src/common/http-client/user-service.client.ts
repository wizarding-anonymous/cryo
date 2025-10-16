import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseCircuitBreakerClient, ServiceUnavailableError } from '../circuit-breaker/base-circuit-breaker.client';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../circuit-breaker/circuit-breaker.config';
import { UserCacheService } from '../cache/user-cache.service';

export interface CreateUserDto {
  name: string;
  email: string;
  password: string; // Pre-hashed password from Auth Service
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserExistsResponse {
  exists: boolean;
  userId?: string;
}

@Injectable()
export class UserServiceClient extends BaseCircuitBreakerClient {
  constructor(
    httpService: HttpService,
    configService: ConfigService,
    circuitBreakerService: CircuitBreakerService,
    circuitBreakerConfig: CircuitBreakerConfig,
    private readonly userCacheService: UserCacheService,
  ) {
    super(
      httpService,
      configService,
      circuitBreakerService,
      'UserService',
      'USER_SERVICE_URL',
      'http://localhost:3002',
      circuitBreakerConfig.getUserServiceConfig(),
    );
  }

  /**
   * Find user by email with Circuit Breaker protection and LRU caching
   * Requirement 2.2: Verify user existence through User Service
   * Task 17.1: Uses LRU cache instead of Map to prevent memory leaks
   */
  async findByEmail(email: string): Promise<User | null> {
    // Check LRU cache first (local + Redis)
    const cached = await this.userCacheService.getCachedUserByEmail(email);
    if (cached !== undefined) {
      this.logger.debug(`Cache hit for user email: ${email}`);
      return cached;
    }

    try {
      const user = await this.get<User>(`/api/users/email/${email}`);
      await this.userCacheService.setCachedUserByEmail(email, user);
      this.logger.debug(`User found and cached: ${email}`);
      return user;
    } catch (error) {
      if (error.response?.status === 404) {
        await this.userCacheService.setCachedUserByEmail(email, null);
        return null;
      }
      
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`User Service unavailable for findByEmail: ${email}`);
        // Return expired cache if available as fallback
        const expiredCache = await this.userCacheService.getExpiredCacheByEmail(email);
        if (expiredCache) {
          this.logger.warn(`Using expired cache for user email: ${email}`);
          return expiredCache;
        }
        throw new ServiceUnavailableException('User Service is currently unavailable');
      }
      
      this.logger.error(`Failed to find user by email: ${email}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Find user by ID with Circuit Breaker protection and LRU caching
   * Requirement 2.4: Verify user existence through User Service
   * Task 17.1: Uses LRU cache instead of Map to prevent memory leaks
   */
  async findById(id: string): Promise<User | null> {
    // Check LRU cache first (local + Redis)
    const cached = await this.userCacheService.getCachedUserById(id);
    if (cached !== undefined) {
      this.logger.debug(`Cache hit for user ID: ${id}`);
      return cached;
    }

    try {
      const user = await this.get<User>(`/api/users/${id}`);
      await this.userCacheService.setCachedUserById(id, user);
      this.logger.debug(`User found and cached: ${id}`);
      return user;
    } catch (error) {
      if (error.response?.status === 404) {
        await this.userCacheService.setCachedUserById(id, null);
        return null;
      }
      
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`User Service unavailable for findById: ${id}`);
        // Return expired cache if available as fallback
        const expiredCache = await this.userCacheService.getExpiredCacheById(id);
        if (expiredCache) {
          this.logger.warn(`Using expired cache for user ID: ${id}`);
          return expiredCache;
        }
        throw new ServiceUnavailableException('User Service is currently unavailable');
      }
      
      this.logger.error(`Failed to find user by ID: ${id}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Create user with Circuit Breaker protection and LRU caching
   * Requirement 2.1: Call User Service's user creation endpoint
   * Requirement 2.7: Pass already-hashed passwords for user creation
   * Task 17.1: Uses LRU cache instead of Map to prevent memory leaks
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = await this.post<User>('/api/users', createUserDto);
      
      // Cache the newly created user in both email and ID indexes
      await this.userCacheService.setCachedUser(user);
      
      this.logger.log(`Successfully created and cached user: ${user.id}`);
      return user;
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.error('User Service unavailable for user creation');
        throw new ServiceUnavailableException('User Service is currently unavailable for user creation');
      }
      
      if (error.response?.status === 409) {
        this.logger.warn(`User creation failed - email already exists: ${createUserDto.email}`);
        throw error; // Re-throw conflict errors as-is
      }
      
      this.logger.error('Failed to create user', {
        error: error.message,
        stack: error.stack,
        email: createUserDto.email,
      });
      throw error;
    }
  }

  /**
   * Update user's last login timestamp with LRU cache invalidation
   * Requirement 2.3: Call User Service to update last login timestamp
   * Task 17.1: Uses LRU cache instead of Map to prevent memory leaks
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.patch(`/api/users/${userId}/last-login`, {
        lastLoginAt: new Date().toISOString(),
      });
      
      // Invalidate LRU cache for this user (both email and ID entries)
      await this.userCacheService.invalidateUser(userId);
      
      this.logger.log(`Successfully updated last login and invalidated cache for user: ${userId}`);
    } catch (error) {
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`User Service unavailable for updating last login: ${userId}`);
        // Don't throw error as this is not critical for authentication flow
        return;
      }
      
      this.logger.error(`Failed to update last login for user: ${userId}`, {
        error: error.message,
        stack: error.stack,
      });
      // Don't throw error as this is not critical for authentication flow
    }
  }

  /**
   * Check if user exists by ID with LRU cache fallback
   * Requirement 2.5: Check user existence through User Service
   * Task 17.1: Uses LRU cache instead of Map to prevent memory leaks
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const response = await this.get<UserExistsResponse>(`/api/users/${userId}/exists`);
      return response.exists;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`User Service unavailable for userExists check: ${userId}`);
        // Fallback: try to get user from LRU cache
        const cached = await this.userCacheService.getCachedUserById(userId);
        if (cached !== undefined) {
          this.logger.warn(`Using cached data for userExists check: ${userId}`);
          return cached !== null;
        }
        
        // Try expired cache as last resort
        const expiredCache = await this.userCacheService.getExpiredCacheById(userId);
        if (expiredCache !== null) {
          this.logger.warn(`Using expired cache for userExists check: ${userId}`);
          return true;
        }
        
        throw new ServiceUnavailableException('User Service is currently unavailable');
      }
      
      this.logger.error(`Failed to check user existence: ${userId}`, {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Clear all cached user data (delegates to LRU cache service)
   * Task 17.1: Replaced Map-based cache with LRU cache to prevent memory leaks
   */
  async clearCache(): Promise<void> {
    await this.userCacheService.clear();
    this.logger.log('User cache cleared');
  }

  /**
   * Get comprehensive cache statistics with memory leak prevention metrics
   * Task 17.1: Enhanced statistics including hit/miss ratios and memory usage
   */
  getCacheStats() {
    return this.userCacheService.getUserCacheStats();
  }

  /**
   * Get cache metrics for monitoring and alerting
   * Task 17.1: Added metrics for Prometheus/monitoring systems
   */
  getCacheMetrics() {
    return this.userCacheService.getMetrics();
  }

  /**
   * Get cache health information
   * Task 17.1: Added health monitoring to detect memory pressure
   */
  getCacheHealth() {
    const info = this.userCacheService.getCacheInfo();
    return {
      isHealthy: info.isHealthy,
      memoryPressure: info.memoryPressure,
      recommendedAction: info.performance ? 'Cache is performing well' : 'Consider reviewing cache configuration',
      uptime: info.uptime,
      redisEnabled: info.redisEnabled
    };
  }
}