// Type definitions for Redis cache configuration
declare module 'ioredis' {
  export interface RedisOptions {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    retryDelayOnFailover?: number;
    lazyConnect?: boolean;
    keepAlive?: number;
    connectTimeout?: number;
    commandTimeout?: number;
    maxLoadingTimeout?: number;
    enableReadyCheck?: boolean;
  }
}