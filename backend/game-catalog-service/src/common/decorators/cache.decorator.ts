import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_INVALIDATE_METADATA = 'cache_invalidate';

/**
 * Decorator to set a cache key for a route.
 * Used by the HttpCacheInterceptor.
 * @param key - The cache key to use for this route's response.
 */
export const Cache = (key: string) => SetMetadata(CACHE_KEY_METADATA, key);

/**
 * Decorator to specify cache keys to invalidate upon successful execution of this route.
 * Used by the HttpCacheInterceptor.
 * @param keys - The cache keys to invalidate.
 */
export const InvalidateCache = (...keys: string[]) => SetMetadata(CACHE_INVALIDATE_METADATA, keys);
