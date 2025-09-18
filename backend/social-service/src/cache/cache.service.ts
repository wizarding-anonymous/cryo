import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    return await this.cacheManager.get<T>(key);
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.cacheManager.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    await this.cacheManager.del(key);
  }

  async reset(): Promise<void> {
    await this.cacheManager.reset();
  }

  // Helper methods for social service specific caching
  async getUserStatus(userId: string) {
    return await this.get(`user_status:${userId}`);
  }

  async setUserStatus(userId: string, status: any, ttl = 900): Promise<void> {
    await this.set(`user_status:${userId}`, status, ttl);
  }

  async getFriendsList(userId: string) {
    return await this.get(`friends_list:${userId}`);
  }

  async setFriendsList(userId: string, friends: any[], ttl = 600): Promise<void> {
    await this.set(`friends_list:${userId}`, friends, ttl);
  }

  async invalidateUserCache(userId: string): Promise<void> {
    await this.del(`user_status:${userId}`);
    await this.del(`friends_list:${userId}`);
  }

  async getFriendsStatus(userId: string) {
    return await this.get(`friends_status:${userId}`);
  }

  async setFriendsStatus(userId: string, statuses: any[], ttl = 300): Promise<void> {
    await this.set(`friends_status:${userId}`, statuses, ttl);
  }
}