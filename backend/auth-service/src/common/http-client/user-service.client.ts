import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BaseCircuitBreakerClient, ServiceUnavailableError } from '../circuit-breaker/base-circuit-breaker.client';
import { CircuitBreakerService } from '../circuit-breaker/circuit-breaker.service';
import { CircuitBreakerConfig } from '../circuit-breaker/circuit-breaker.config';

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
  private readonly userCache = new Map<string, { user: User | null; timestamp: number }>();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes cache

  constructor(
    httpService: HttpService,
    configService: ConfigService,
    circuitBreakerService: CircuitBreakerService,
    private readonly circuitBreakerConfig: CircuitBreakerConfig,
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
   * Find user by email with Circuit Breaker protection and caching
   * Requirement 2.2: Verify user existence through User Service
   */
  async findByEmail(email: string): Promise<User | null> {
    const cacheKey = `email:${email}`;
    
    // Check cache first
    const cached = this.getCachedUser(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const user = await this.get<User>(`/users/email/${email}`);
      this.setCachedUser(cacheKey, user);
      return user;
    } catch (error) {
      if (error.response?.status === 404) {
        this.setCachedUser(cacheKey, null);
        return null;
      }
      
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`User Service unavailable for findByEmail: ${email}`);
        // Return cached value if available, even if expired
        const expiredCache = this.userCache.get(cacheKey);
        if (expiredCache) {
          this.logger.warn(`Using expired cache for user email: ${email}`);
          return expiredCache.user;
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
   * Find user by ID with Circuit Breaker protection and caching
   * Requirement 2.4: Verify user existence through User Service
   */
  async findById(id: string): Promise<User | null> {
    const cacheKey = `id:${id}`;
    
    // Check cache first
    const cached = this.getCachedUser(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    try {
      const user = await this.get<User>(`/users/${id}`);
      this.setCachedUser(cacheKey, user);
      return user;
    } catch (error) {
      if (error.response?.status === 404) {
        this.setCachedUser(cacheKey, null);
        return null;
      }
      
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`User Service unavailable for findById: ${id}`);
        // Return cached value if available, even if expired
        const expiredCache = this.userCache.get(cacheKey);
        if (expiredCache) {
          this.logger.warn(`Using expired cache for user ID: ${id}`);
          return expiredCache.user;
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
   * Create user with Circuit Breaker protection
   * Requirement 2.1: Call User Service's user creation endpoint
   * Requirement 2.7: Pass already-hashed passwords for user creation
   */
  async createUser(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = await this.post<User>('/users', createUserDto);
      
      // Cache the newly created user
      this.setCachedUser(`id:${user.id}`, user);
      this.setCachedUser(`email:${user.email}`, user);
      
      this.logger.log(`Successfully created user: ${user.id}`);
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
   * Update user's last login timestamp
   * Requirement 2.3: Call User Service to update last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.patch(`/users/${userId}/last-login`, {
        lastLoginAt: new Date().toISOString(),
      });
      
      // Invalidate cache for this user
      this.invalidateUserCache(userId);
      
      this.logger.log(`Successfully updated last login for user: ${userId}`);
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
   * Check if user exists by ID
   * Requirement 2.5: Check user existence through User Service
   */
  async userExists(userId: string): Promise<boolean> {
    try {
      const response = await this.get<UserExistsResponse>(`/users/${userId}/exists`);
      return response.exists;
    } catch (error) {
      if (error.response?.status === 404) {
        return false;
      }
      
      if (error instanceof ServiceUnavailableError) {
        this.logger.warn(`User Service unavailable for userExists check: ${userId}`);
        // Fallback: try to get user from cache
        const cached = this.getCachedUser(`id:${userId}`);
        if (cached !== undefined) {
          this.logger.warn(`Using cached data for userExists check: ${userId}`);
          return cached !== null;
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
   * Get cached user data
   */
  private getCachedUser(cacheKey: string): User | null | undefined {
    const cached = this.userCache.get(cacheKey);
    if (!cached) {
      return undefined;
    }
    
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.userCache.delete(cacheKey);
      return undefined;
    }
    
    return cached.user;
  }

  /**
   * Set cached user data
   */
  private setCachedUser(cacheKey: string, user: User | null): void {
    this.userCache.set(cacheKey, {
      user,
      timestamp: Date.now(),
    });
  }

  /**
   * Invalidate cache for a specific user
   */
  private invalidateUserCache(userId: string): void {
    // Remove by ID
    this.userCache.delete(`id:${userId}`);
    
    // Find and remove by email (we need to search through cache)
    for (const [key, value] of this.userCache.entries()) {
      if (key.startsWith('email:') && value.user?.id === userId) {
        this.userCache.delete(key);
        break;
      }
    }
  }

  /**
   * Clear all cached user data
   */
  clearCache(): void {
    this.userCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.userCache.size,
      timeout: this.cacheTimeout,
    };
  }
}