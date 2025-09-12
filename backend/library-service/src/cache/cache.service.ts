import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return this.cacheManager.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // In cache-manager v5, ttl is in seconds.
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  /**
   * A wrapper to get data from cache or execute a function to get it and then cache it.
   * @param key The cache key.
   * @param fn The function to execute if the data is not in the cache.
   * @param ttl The time-to-live for the cache entry in seconds.
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cachedData = await this.get<T>(key);
    if (cachedData) {
      return cachedData;
    }

    const newData = await fn();
    await this.set(key, newData, ttl);
    return newData;
  }
}
