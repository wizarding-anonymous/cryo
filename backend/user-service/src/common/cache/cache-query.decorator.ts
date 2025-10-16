import { SetMetadata } from '@nestjs/common';

export const CACHE_QUERY_KEY = 'cache_query';

export interface CacheQueryMetadata {
  ttl?: number;
  tags?: readonly string[] | string[];
  keyGenerator?: (...args: any[]) => string;
  condition?: (...args: any[]) => boolean;
}

/**
 * Decorator to enable query caching for repository methods
 *
 * @param options - Cache configuration options
 *
 * @example
 * ```typescript
 * @CacheQuery({ ttl: 300, tags: ['users'] })
 * async findActiveUsers(): Promise<User[]> {
 *   return this.repository.find({ where: { isActive: true } });
 * }
 *
 * @CacheQuery({
 *   ttl: 600,
 *   tags: ['users', 'profiles'],
 *   condition: (id: string) => !!id
 * })
 * async findUserById(id: string): Promise<User | null> {
 *   return this.repository.findOne({ where: { id } });
 * }
 * ```
 */
export const CacheQuery = (options: CacheQueryMetadata = {}) => {
  return SetMetadata(CACHE_QUERY_KEY, options);
};

/**
 * Decorator to skip caching for specific method calls
 * Useful for methods that should never be cached
 */
export const SkipCache = () => {
  return SetMetadata(CACHE_QUERY_KEY, { condition: () => false });
};

/**
 * Decorator for methods that should invalidate cache
 * Used on write operations to clear related cache entries
 *
 * @param tags - Cache tags to invalidate
 *
 * @example
 * ```typescript
 * @InvalidateCache(['users', 'statistics'])
 * async createUser(userData: CreateUserDto): Promise<User> {
 *   return this.repository.save(userData);
 * }
 * ```
 */
export const InvalidateCache = (tags: string[]) => {
  return SetMetadata('invalidate_cache', tags);
};

/**
 * Predefined cache configurations for common query patterns
 */
export const CacheConfigs = {
  /**
   * Short-term cache for frequently changing data
   */
  SHORT: { ttl: 60, tags: ['short-term'] },

  /**
   * Medium-term cache for moderately stable data
   */
  MEDIUM: { ttl: 300, tags: ['medium-term'] },

  /**
   * Long-term cache for stable data
   */
  LONG: { ttl: 1800, tags: ['long-term'] },

  /**
   * User-specific cache configuration
   */
  USER: {
    ttl: 300,
    tags: ['users'],
    keyGenerator: (id: string) => `user:${id}`,
  },

  /**
   * Statistics cache configuration
   */
  STATISTICS: {
    ttl: 120,
    tags: ['statistics', 'time-sensitive'],
  },

  /**
   * Profile cache configuration
   */
  PROFILE: {
    ttl: 600,
    tags: ['users', 'profiles'],
    keyGenerator: (userId: string) => `profile:${userId}`,
  },

  /**
   * Search results cache configuration
   */
  SEARCH: {
    ttl: 180,
    tags: ['search', 'users'],
    condition: (query: string) => query && query.length > 2,
  },
} as const;

/**
 * Helper function to create conditional cache decorator
 *
 * @example
 * ```typescript
 * @ConditionalCache((searchTerm: string) => searchTerm.length > 2, { ttl: 300 })
 * async searchUsers(searchTerm: string): Promise<User[]> {
 *   // Only cache if search term is longer than 2 characters
 * }
 * ```
 */
export const ConditionalCache = (
  condition: (...args: any[]) => boolean,
  options: Omit<CacheQueryMetadata, 'condition'> = {},
) => {
  return CacheQuery({ ...options, condition });
};

/**
 * Helper function to create user-specific cache decorator
 *
 * @example
 * ```typescript
 * @UserCache(300) // Cache for 5 minutes
 * async getUserPreferences(userId: string): Promise<UserPreferences> {
 *   // Automatically tagged with 'users' and keyed by userId
 * }
 * ```
 */
export const UserCache = (ttl: number = 300) => {
  return CacheQuery({
    ttl,
    tags: ['users'],
    keyGenerator: (userId: string) => `user:${userId}`,
    condition: (userId: string) => !!userId,
  });
};

/**
 * Helper function to create time-sensitive cache decorator
 * For data that changes frequently and should have short cache times
 *
 * @example
 * ```typescript
 * @TimeSensitiveCache(['statistics'])
 * async getUserCount(): Promise<number> {
 *   // Cached for only 1 minute due to time-sensitive nature
 * }
 * ```
 */
export const TimeSensitiveCache = (additionalTags: string[] = []) => {
  return CacheQuery({
    ttl: 60, // 1 minute
    tags: ['time-sensitive', ...additionalTags],
  });
};
