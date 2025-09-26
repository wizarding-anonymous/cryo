import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';
import type { RedisClient } from './redis.constants';

describe('RedisService', () => {
  let service: RedisService;
  let mockRedisClient: jest.Mocked<RedisClient>;

  beforeEach(async () => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hdel: jest.fn(),
      hgetall: jest.fn(),
      lpush: jest.fn(),
      rpush: jest.fn(),
      lpop: jest.fn(),
      rpop: jest.fn(),
      llen: jest.fn(),
      lrange: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn(),
      sismember: jest.fn(),
      zadd: jest.fn(),
      zrem: jest.fn(),
      zrange: jest.fn(),
      zrangebyscore: jest.fn(),
      zcard: jest.fn(),
      zscore: jest.fn(),
      multi: jest.fn(),
      exec: jest.fn(),
      pipeline: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
      ping: jest.fn(),
      flushdb: jest.fn(),
      flushall: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      eval: jest.fn(),
      evalsha: jest.fn(),
      script: jest.fn(),
      publish: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      psubscribe: jest.fn(),
      punsubscribe: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      once: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn(),
      setMaxListeners: jest.fn(),
      getMaxListeners: jest.fn(),
      listeners: jest.fn(),
      rawListeners: jest.fn(),
      listenerCount: jest.fn(),
      prependListener: jest.fn(),
      prependOnceListener: jest.fn(),
      eventNames: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: REDIS_CLIENT,
          useValue: mockRedisClient,
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getClient', () => {
    it('should return the Redis client', () => {
      const client = service.getClient();
      expect(client).toBe(mockRedisClient);
    });

    it('should return the same client instance on multiple calls', () => {
      const client1 = service.getClient();
      const client2 = service.getClient();
      expect(client1).toBe(client2);
      expect(client1).toBe(mockRedisClient);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call quit on the Redis client', async () => {
      mockRedisClient.quit.mockResolvedValue('OK' as any);

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle quit errors gracefully', async () => {
      mockRedisClient.quit.mockRejectedValue(new Error('Connection already closed'));

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();

      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle quit rejection with non-Error objects', async () => {
      mockRedisClient.quit.mockRejectedValue('String error');

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.toBeUndefined();

      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });

    it('should handle quit returning undefined', async () => {
      mockRedisClient.quit.mockResolvedValue(undefined as any);

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration with Redis client', () => {
    it('should allow calling Redis methods through the client', async () => {
      mockRedisClient.get.mockResolvedValue('test-value');
      mockRedisClient.set.mockResolvedValue('OK' as any);

      const client = service.getClient();
      
      await client.set('test-key', 'test-value');
      const value = await client.get('test-key');

      expect(mockRedisClient.set).toHaveBeenCalledWith('test-key', 'test-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
      expect(value).toBe('test-value');
    });

    it('should handle Redis client errors', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection error'));

      const client = service.getClient();

      await expect(client.get('test-key')).rejects.toThrow('Redis connection error');
    });

    it('should support Redis hash operations', async () => {
      mockRedisClient.hset.mockResolvedValue(1 as any);
      mockRedisClient.hget.mockResolvedValue('hash-value');
      mockRedisClient.hgetall.mockResolvedValue({ field1: 'value1', field2: 'value2' } as any);

      const client = service.getClient();

      await client.hset('hash-key', 'field1', 'value1');
      const value = await client.hget('hash-key', 'field1');
      const allValues = await client.hgetall('hash-key');

      expect(mockRedisClient.hset).toHaveBeenCalledWith('hash-key', 'field1', 'value1');
      expect(mockRedisClient.hget).toHaveBeenCalledWith('hash-key', 'field1');
      expect(mockRedisClient.hgetall).toHaveBeenCalledWith('hash-key');
      expect(value).toBe('hash-value');
      expect(allValues).toEqual({ field1: 'value1', field2: 'value2' });
    });

    it('should support Redis list operations', async () => {
      mockRedisClient.lpush.mockResolvedValue(1 as any);
      mockRedisClient.rpop.mockResolvedValue('list-item' as any);
      mockRedisClient.llen.mockResolvedValue(5 as any);

      const client = service.getClient();

      await client.lpush('list-key', 'item1');
      const item = await client.rpop('list-key');
      const length = await client.llen('list-key');

      expect(mockRedisClient.lpush).toHaveBeenCalledWith('list-key', 'item1');
      expect(mockRedisClient.rpop).toHaveBeenCalledWith('list-key');
      expect(mockRedisClient.llen).toHaveBeenCalledWith('list-key');
      expect(item).toBe('list-item');
      expect(length).toBe(5);
    });

    it('should support Redis set operations', async () => {
      mockRedisClient.sadd.mockResolvedValue(1 as any);
      mockRedisClient.sismember.mockResolvedValue(1 as any);
      mockRedisClient.smembers.mockResolvedValue(['member1', 'member2'] as any);

      const client = service.getClient();

      await client.sadd('set-key', 'member1');
      const isMember = await client.sismember('set-key', 'member1');
      const members = await client.smembers('set-key');

      expect(mockRedisClient.sadd).toHaveBeenCalledWith('set-key', 'member1');
      expect(mockRedisClient.sismember).toHaveBeenCalledWith('set-key', 'member1');
      expect(mockRedisClient.smembers).toHaveBeenCalledWith('set-key');
      expect(isMember).toBe(1);
      expect(members).toEqual(['member1', 'member2']);
    });

    it('should support Redis sorted set operations', async () => {
      mockRedisClient.zadd.mockResolvedValue(1 as any);
      mockRedisClient.zscore.mockResolvedValue('10' as any);
      mockRedisClient.zrange.mockResolvedValue(['member1', 'member2'] as any);

      const client = service.getClient();

      await client.zadd('zset-key', 10, 'member1');
      const score = await client.zscore('zset-key', 'member1');
      const range = await client.zrange('zset-key', 0, -1);

      expect(mockRedisClient.zadd).toHaveBeenCalledWith('zset-key', 10, 'member1');
      expect(mockRedisClient.zscore).toHaveBeenCalledWith('zset-key', 'member1');
      expect(mockRedisClient.zrange).toHaveBeenCalledWith('zset-key', 0, -1);
      expect(score).toBe('10');
      expect(range).toEqual(['member1', 'member2']);
    });

    it('should support Redis expiration operations', async () => {
      mockRedisClient.expire.mockResolvedValue(1 as any);
      mockRedisClient.ttl.mockResolvedValue(300 as any);

      const client = service.getClient();

      await client.expire('key-with-ttl', 300);
      const ttl = await client.ttl('key-with-ttl');

      expect(mockRedisClient.expire).toHaveBeenCalledWith('key-with-ttl', 300);
      expect(mockRedisClient.ttl).toHaveBeenCalledWith('key-with-ttl');
      expect(ttl).toBe(300);
    });

    it('should support Redis transaction operations', async () => {
      const mockMulti = {
        set: jest.fn().mockReturnThis(),
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([['OK'], ['value']]),
      };
      mockRedisClient.multi.mockReturnValue(mockMulti as any);

      const client = service.getClient();
      const multi = client.multi();

      multi.set('key1', 'value1');
      multi.get('key1');
      const results = await multi.exec();

      expect(mockRedisClient.multi).toHaveBeenCalled();
      expect(mockMulti.set).toHaveBeenCalledWith('key1', 'value1');
      expect(mockMulti.get).toHaveBeenCalledWith('key1');
      expect(mockMulti.exec).toHaveBeenCalled();
      expect(results).toEqual([['OK'], ['value']]);
    });
  });
});