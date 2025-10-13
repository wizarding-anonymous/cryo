import { RedisService } from '../common/redis/redis.service';

/**
 * Мок Redis сервиса для тестов
 * Эмулирует поведение Redis без реального подключения
 */
export class TestRedisService implements Partial<RedisService> {
  private storage = new Map<string, { value: string; ttl?: number; expireAt?: number }>();
  private locks = new Map<string, { value: string; expireAt: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.storage.get(key);
    if (!item) return null;
    
    if (item.expireAt && Date.now() > item.expireAt) {
      this.storage.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expireAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.storage.set(key, { value, ttl: ttlSeconds, expireAt });
  }

  async setex(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<number> {
    const existed = this.storage.has(key);
    this.storage.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const item = this.storage.get(key);
    if (!item) return 0;
    
    if (item.expireAt && Date.now() > item.expireAt) {
      this.storage.delete(key);
      return 0;
    }
    
    return 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    const item = this.storage.get(key);
    if (!item) return 0;
    
    item.expireAt = Date.now() + (ttlSeconds * 1000);
    item.ttl = ttlSeconds;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const item = this.storage.get(key);
    if (!item) return -2;
    
    if (!item.expireAt) return -1;
    
    const remaining = Math.ceil((item.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  // Token blacklisting methods
  async blacklistToken(token: string, ttlSeconds: number): Promise<void> {
    await this.set(`blacklist:${token}`, 'true', ttlSeconds);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.get(`blacklist:${token}`);
    return result === 'true';
  }

  async removeFromBlacklist(token: string): Promise<void> {
    await this.del(`blacklist:${token}`);
  }

  // Distributed locking methods
  async setNX(key: string, value: string, ttlSeconds?: number): Promise<string | null> {
    const expireAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Date.now() + 30000;
    
    // Check if lock already exists and not expired
    const existingLock = this.locks.get(key);
    if (existingLock && Date.now() < existingLock.expireAt) {
      return null; // Lock already exists
    }
    
    // Set the lock
    this.locks.set(key, { value, expireAt });
    return 'OK';
  }

  async acquireLock(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.setNX(key, value, ttlSeconds);
    return result === 'OK';
  }

  async releaseLock(key: string, value: string): Promise<boolean> {
    const lock = this.locks.get(key);
    if (lock && lock.value === value) {
      this.locks.delete(key);
      return true;
    }
    return false;
  }

  async isLocked(key: string): Promise<boolean> {
    const lock = this.locks.get(key);
    if (!lock) return false;
    
    if (Date.now() > lock.expireAt) {
      this.locks.delete(key);
      return false;
    }
    
    return true;
  }

  async getLockTTL(key: string): Promise<number> {
    const lock = this.locks.get(key);
    if (!lock) return -2;
    
    const remaining = Math.ceil((lock.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  // Bulk operations
  async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map(key => this.get(key)));
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.storage.keys()).filter(key => regex.test(key));
  }

  // Cleanup methods for tests
  async flushall(): Promise<void> {
    this.storage.clear();
    this.locks.clear();
  }

  async reset(): Promise<void> {
    await this.flushall();
  }

  // Module lifecycle methods
  async onModuleInit(): Promise<void> {
    // No-op for test service
  }

  async onModuleDestroy(): Promise<void> {
    await this.flushall();
  }
}

/**
 * Создает мок Redis сервиса для тестов
 */
export const createTestRedisService = (): TestRedisService => {
  return new TestRedisService();
};

/**
 * Провайдер для тестового Redis сервиса
 */
export const testRedisProvider = {
  provide: RedisService,
  useFactory: createTestRedisService,
};