import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key';
export const CACHE_INVALIDATE_METADATA = 'cache_invalidate';
export const CACHE_TTL_METADATA = 'cache_ttl';

/**
 * Decorator to set a cache key for a route.
 * Used by the HttpCacheInterceptor.
 * @param key - The cache key to use for this route's response.
 * @param ttl - Time to live in seconds (optional, defaults to 300s)
 */
export const Cache = (key: string, ttl?: number) => {
  return (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, descriptor);
    if (ttl !== undefined) {
      SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyKey, descriptor);
    }
  };
};

/**
 * Decorator to specify cache keys to invalidate upon successful execution of this route.
 * Used by the HttpCacheInterceptor.
 * @param keys - The cache keys to invalidate.
 */
export const InvalidateCache = (...keys: string[]) =>
  SetMetadata(CACHE_INVALIDATE_METADATA, keys);
