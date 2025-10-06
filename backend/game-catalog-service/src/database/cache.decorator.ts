import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache:key';
export const CACHE_TTL_METADATA = 'cache:ttl';

/**
 * Cache decorator for methods
 * @param key Cache key pattern (can use {param} placeholders)
 * @param ttl TTL in seconds (default: 300)
 */
export const Cache = (key: string, ttl = 300) => {
  return (
    target: any,
    propertyName: string,
    descriptor: PropertyDescriptor,
  ) => {
    SetMetadata(CACHE_KEY_METADATA, key)(target, propertyName, descriptor);
    SetMetadata(CACHE_TTL_METADATA, ttl)(target, propertyName, descriptor);
    return descriptor;
  };
};

/**
 * Cache clear decorator for methods
 * @param patterns Array of cache key patterns to clear
 */
export const CacheClear = (patterns: string[]) => {
  return SetMetadata('cache:clear', patterns);
};
