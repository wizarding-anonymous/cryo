/**
 * Redis mock for e2e tests
 * Provides in-memory cache implementation to avoid Redis authentication issues
 */

export class RedisMock {
  private store = new Map<string, string>();
  private ttlStore = new Map<string, number>();

  async get(key: string): Promise<string | null> {
    // Check if key has expired
    const ttl = this.ttlStore.get(key);
    if (ttl && Date.now() > ttl) {
      this.store.delete(key);
      this.ttlStore.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, value);
    if (ttlSeconds) {
      this.ttlStore.set(key, Date.now() + ttlSeconds * 1000);
    }
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.ttlStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async flushall(): Promise<void> {
    this.store.clear();
    this.ttlStore.clear();
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }
}

export const createRedisMock = () => new RedisMock();