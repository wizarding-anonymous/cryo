import { Test } from '@nestjs/testing';
import { RateLimitService } from './rate-limit.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';

// A more robust in-memory mock for ioredis
const createRedisMock = () => {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();

  const redisMock = {
    get: jest.fn(async (k: string) => store.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
      return 'OK';
    }),
    del: jest.fn(async (k: string) => (store.delete(k) ? 1 : 0)),
    incr: jest.fn(async (k: string) => {
      const v = Number(store.get(k) ?? 0) + 1;
      store.set(k, String(v));
      return v;
    }),
    ttl: jest.fn(async (k: string) => ttls.get(k) ?? -1),
    expire: jest.fn(async (k: string, s: number) => {
      ttls.set(k, s);
      return 1;
    }),
    multi: jest.fn(() => {
      const ops: any[] = [];
      const chain = {
        get: (k: string) => {
          ops.push(['get', k]);
          return chain;
        },
        incr: (k: string) => {
          ops.push(['incr', k]);
          return chain;
        },
        ttl: (k: string) => {
          ops.push(['ttl', k]);
          return chain;
        },
        expire: (k: string, s: number) => {
          ops.push(['expire', k, s]);
          return chain;
        },
        exec: async () => {
          const results: any[] = [];
          for (const op of ops) {
            const [command, ...args] = op;
            const res = await (redisMock as any)[command](...args);
            results.push([null, res]);
          }
          return results;
        },
      };
      return chain;
    }),
  };

  return redisMock;
};

describe('RateLimitService', () => {
  let service: RateLimitService;
  let redis: ReturnType<typeof createRedisMock>;

  beforeEach(async () => {
    redis = createRedisMock();
    const moduleRef = await Test.createTestingModule({
      providers: [RateLimitService, { provide: REDIS_CLIENT, useValue: redis }],
    }).compile();

    service = moduleRef.get(RateLimitService);
  });

  it('should allow requests under the limit', async () => {
    const key = 'test:rl';
    const limit = 3;
    const window = 60;

    const r1 = await service.checkRateLimit(key, limit, window);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await service.checkRateLimit(key, limit, window);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it('should block requests exceeding the limit', async () => {
    const key = 'test:rl';
    const limit = 2;
    const window = 60;

    await service.checkRateLimit(key, limit, window);
    await service.checkRateLimit(key, limit, window);
    const r3 = await service.checkRateLimit(key, limit, window);

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('should apply exponential backoff penalty', async () => {
    const key = 'test:rl-penalty';
    const limit = 1;
    const window = 10; // 10 seconds base

    // First violation
    await service.checkRateLimit(key, limit, window); // count = 1
    const r2 = await service.checkRateLimit(key, limit, window); // count = 2, exceeds limit
    expect(r2.allowed).toBe(false);
    // penalty level 1, backoff = 10 * 2^1 = 20 seconds
    expect(r2.resetInSeconds).toBe(20);

    // Second violation
    const r3 = await service.checkRateLimit(key, limit, window); // count = 3, exceeds limit
    expect(r3.allowed).toBe(false);
    // penalty level 2, backoff = 10 * 2^2 = 40 seconds
    expect(r3.resetInSeconds).toBe(40);
  });

  it('should reset the limit and penalty', async () => {
    const key = 'test:rl-reset';
    const limit = 1;
    const window = 60;

    await service.checkRateLimit(key, limit, window);
    await service.checkRateLimit(key, limit, window); // Exceed limit, create penalty

    await service.resetRateLimit(key);

    const penalty = await redis.get(`${key}:penalty`);
    expect(penalty).toBeNull();
    const count = await redis.get(key);
    expect(count).toBeNull();
  });

  it('should increment counter correctly', async () => {
    const key = 'test:increment';
    const window = 60;

    const count1 = await service.incrementCounter(key, window);
    expect(count1).toBe(1);

    const count2 = await service.incrementCounter(key, window);
    expect(count2).toBe(2);

    const count3 = await service.incrementCounter(key, window);
    expect(count3).toBe(3);
  });

  it('should get remaining requests correctly', async () => {
    const key = 'test:remaining';
    const limit = 5;
    const window = 60;

    // Initially should have full limit
    const remaining1 = await service.getRemainingRequests(key, limit);
    expect(remaining1).toBe(5);

    // After one request
    await service.checkRateLimit(key, limit, window);
    const remaining2 = await service.getRemainingRequests(key, limit);
    expect(remaining2).toBe(4);

    // After two more requests
    await service.checkRateLimit(key, limit, window);
    await service.checkRateLimit(key, limit, window);
    const remaining3 = await service.getRemainingRequests(key, limit);
    expect(remaining3).toBe(2);
  });

  it('should handle different rate limit keys independently', async () => {
    const keyUser = 'user:123';
    const keyIP = 'ip:192.168.1.1';
    const limit = 2;
    const window = 60;

    // User key should work independently
    const userResult1 = await service.checkRateLimit(keyUser, limit, window);
    expect(userResult1.allowed).toBe(true);
    expect(userResult1.remaining).toBe(1);

    // IP key should work independently
    const ipResult1 = await service.checkRateLimit(keyIP, limit, window);
    expect(ipResult1.allowed).toBe(true);
    expect(ipResult1.remaining).toBe(1);

    // Both should be able to reach their limits independently
    await service.checkRateLimit(keyUser, limit, window);
    await service.checkRateLimit(keyIP, limit, window);

    const userResult2 = await service.checkRateLimit(keyUser, limit, window);
    const ipResult2 = await service.checkRateLimit(keyIP, limit, window);

    expect(userResult2.allowed).toBe(false);
    expect(ipResult2.allowed).toBe(false);
  });

  it('should handle Redis pipeline failures gracefully', async () => {
    const key = 'test:redis-failure';
    const limit = 5;
    const window = 60;

    // Mock Redis multi to fail
    redis.multi = jest.fn(() => {
      const chain: any = {
        get: jest.fn(() => chain),
        incr: jest.fn(() => chain),
        ttl: jest.fn(() => chain),
        exec: jest.fn().mockRejectedValue(new Error('Redis pipeline failed')),
      };
      return chain;
    }) as any;

    // Should handle the error gracefully
    await expect(service.checkRateLimit(key, limit, window)).rejects.toThrow('Redis pipeline failed');
  });

  it('should handle zero and negative limits', async () => {
    const key = 'test:zero-limit';
    const limit = 0;
    const window = 60;

    const result = await service.checkRateLimit(key, limit, window);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should handle very short time windows', async () => {
    const key = 'test:short-window';
    const limit = 3;
    const window = 1; // 1 second

    const result1 = await service.checkRateLimit(key, limit, window);
    expect(result1.allowed).toBe(true);
    expect(result1.resetInSeconds).toBe(1);
  });

  it('should handle concurrent requests correctly', async () => {
    const key = 'test:concurrent';
    const limit = 5;
    const window = 60;

    // Simulate concurrent requests
    const promises = Array(10).fill(null).map(() => 
      service.checkRateLimit(key, limit, window)
    );

    const results = await Promise.all(promises);
    
    // First 5 should be allowed, rest should be blocked
    const allowedCount = results.filter(r => r.allowed).length;
    const blockedCount = results.filter(r => !r.allowed).length;
    
    expect(allowedCount).toBeLessThanOrEqual(limit);
    expect(blockedCount).toBeGreaterThan(0);
  });

  it('should increment counter with proper expiry on first call', async () => {
    const key = 'test:first-increment';
    const window = 120;

    const count = await service.incrementCounter(key, window);

    expect(count).toBe(1);
    // The incr and expire are called via multi(), not directly
    expect(redis.multi).toHaveBeenCalled();
  });

  it('should handle missing TTL correctly', async () => {
    const key = 'test:missing-ttl';
    const limit = 3;
    const window = 60;

    // Mock TTL to return -1 (no expiry set)
    redis.multi = jest.fn(() => {
      const chain: any = {
        get: jest.fn(() => chain),
        incr: jest.fn(() => chain),
        ttl: jest.fn(() => chain),
        exec: jest.fn().mockResolvedValue([
          [null, '0'], // penalty level
          [null, '1'], // count
          [null, -1],  // ttl (no expiry)
        ]),
      };
      return chain;
    }) as any;

    const result = await service.checkRateLimit(key, limit, window);

    expect(result.allowed).toBe(true);
    expect(redis.expire).toHaveBeenCalledWith(key, window);
  });

  it('should calculate remaining requests for non-existent key', async () => {
    const key = 'test:nonexistent';
    const limit = 10;

    redis.get.mockResolvedValue(null);

    const remaining = await service.getRemainingRequests(key, limit);

    expect(remaining).toBe(10);
  });

  it('should calculate remaining requests for existing key', async () => {
    const key = 'test:existing';
    const limit = 10;

    redis.get.mockResolvedValue('3');

    const remaining = await service.getRemainingRequests(key, limit);

    expect(remaining).toBe(7);
  });

  it('should not allow negative remaining requests', async () => {
    const key = 'test:over-limit';
    const limit = 5;

    redis.get.mockResolvedValue('10'); // More than limit

    const remaining = await service.getRemainingRequests(key, limit);

    expect(remaining).toBe(0);
  });

  it('should reset both main key and penalty key', async () => {
    const key = 'test:reset-both';

    await service.resetRateLimit(key);

    expect(redis.del).toHaveBeenCalledWith(key);
    expect(redis.del).toHaveBeenCalledWith(`${key}:penalty`);
  });

  it('should handle maximum penalty levels', async () => {
    const key = 'test:max-penalty';
    const limit = 1;
    const window = 10;

    // Simulate very high penalty level
    redis.multi = jest.fn(() => {
      const chain: any = {
        get: jest.fn(() => chain),
        incr: jest.fn(() => chain),
        ttl: jest.fn(() => chain),
        expire: jest.fn(() => chain),
        exec: jest.fn().mockResolvedValue([
          [null, '10'], // Very high penalty level
          [null, '5'],  // count exceeds limit
          [null, 60],   // ttl
        ]),
      };
      return chain;
    }) as any;

    const result = await service.checkRateLimit(key, limit, window);

    expect(result.allowed).toBe(false);
    expect(result.resetInSeconds).toBe(window * Math.pow(2, 11)); // 10 + 1 penalty level
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const key = 'test:redis-error';
      const limit = 5;
      const window = 60;

      redis.multi = jest.fn(() => {
        const chain: any = {
          get: jest.fn(() => chain),
          incr: jest.fn(() => chain),
          ttl: jest.fn(() => chain),
          exec: jest.fn().mockRejectedValue(new Error('Redis connection lost')),
        };
        return chain;
      }) as any;

      await expect(service.checkRateLimit(key, limit, window)).rejects.toThrow('Redis connection lost');
    });

    it('should handle malformed Redis responses', async () => {
      const key = 'test:malformed';
      const limit = 5;
      const window = 60;

      redis.multi = jest.fn(() => {
        const chain: any = {
          get: jest.fn(() => chain),
          incr: jest.fn(() => chain),
          ttl: jest.fn(() => chain),
          exec: jest.fn().mockResolvedValue([
            [null, 'not-a-number'], // Invalid penalty level
            [null, 'also-not-a-number'], // Invalid count
            [null, 'invalid-ttl'], // Invalid TTL
          ]),
        };
        return chain;
      }) as any;

      const result = await service.checkRateLimit(key, limit, window);

      // Should handle NaN gracefully
      expect(result.allowed).toBe(true); // 0 > 5 is false, so allowed
      expect(typeof result.remaining).toBe('number');
      expect(typeof result.resetInSeconds).toBe('number');
    });

    it('should handle null Redis responses', async () => {
      const key = 'test:null-response';
      const limit = 5;
      const window = 60;

      redis.multi = jest.fn(() => {
        const chain: any = {
          get: jest.fn(() => chain),
          incr: jest.fn(() => chain),
          ttl: jest.fn(() => chain),
          exec: jest.fn().mockResolvedValue([
            [null, null], // Null penalty level
            [null, null], // Null count
            [null, null], // Null TTL
          ]),
        };
        return chain;
      }) as any;

      const result = await service.checkRateLimit(key, limit, window);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5); // limit - 0
      expect(redis.expire).toHaveBeenCalledWith(key, window);
    });

    it('should handle Redis exec returning null', async () => {
      const key = 'test:exec-null';
      const limit = 5;
      const window = 60;

      redis.multi = jest.fn(() => {
        const chain: any = {
          get: jest.fn(() => chain),
          incr: jest.fn(() => chain),
          ttl: jest.fn(() => chain),
          exec: jest.fn().mockResolvedValue(null),
        };
        return chain;
      }) as any;

      await expect(service.checkRateLimit(key, limit, window)).rejects.toThrow();
    });

    it('should handle Redis errors in incrementCounter', async () => {
      const key = 'test:increment-error';
      const window = 60;

      redis.multi = jest.fn(() => {
        const chain: any = {
          incr: jest.fn(() => chain),
          expire: jest.fn(() => chain),
          exec: jest.fn().mockRejectedValue(new Error('Redis increment failed')),
        };
        return chain;
      }) as any;

      await expect(service.incrementCounter(key, window)).rejects.toThrow('Redis increment failed');
    });

    it('should handle Redis errors in getRemainingRequests', async () => {
      const key = 'test:remaining-error';
      const limit = 10;

      redis.get.mockRejectedValue(new Error('Redis get failed'));

      await expect(service.getRemainingRequests(key, limit)).rejects.toThrow('Redis get failed');
    });

    it('should handle Redis errors in resetRateLimit', async () => {
      const key = 'test:reset-error';

      redis.del.mockRejectedValue(new Error('Redis delete failed'));

      await expect(service.resetRateLimit(key)).rejects.toThrow('Redis delete failed');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle rapid successive requests', async () => {
      const key = 'test:rapid';
      const limit = 100;
      const window = 60;

      // Simulate rapid requests
      const promises = Array(50).fill(null).map(() => 
        service.checkRateLimit(key, limit, window)
      );

      const results = await Promise.all(promises);

      // All should be allowed since we're under the limit
      results.forEach(result => {
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle very large limits', async () => {
      const key = 'test:large-limit';
      const limit = 1000000;
      const window = 3600;

      const result = await service.checkRateLimit(key, limit, window);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(999999);
      expect(result.resetInSeconds).toBe(window);
    });

    it('should handle very small windows', async () => {
      const key = 'test:small-window';
      const limit = 5;
      const window = 1;

      const result = await service.checkRateLimit(key, limit, window);

      expect(result.allowed).toBe(true);
      expect(result.resetInSeconds).toBe(1);
    });

    it('should handle burst traffic patterns', async () => {
      const key = 'test:burst';
      const limit = 10;
      const window = 60;

      // First burst - should all be allowed
      const firstBurst = await Promise.all(
        Array(5).fill(null).map(() => service.checkRateLimit(key, limit, window))
      );

      firstBurst.forEach(result => {
        expect(result.allowed).toBe(true);
      });

      // Second burst - some should be blocked
      const secondBurst = await Promise.all(
        Array(10).fill(null).map(() => service.checkRateLimit(key, limit, window))
      );

      const allowedCount = secondBurst.filter(r => r.allowed).length;
      const blockedCount = secondBurst.filter(r => !r.allowed).length;

      expect(allowedCount + blockedCount).toBe(10);
      expect(blockedCount).toBeGreaterThan(0); // Some should be blocked
    });
  });

  describe('Key Management and Isolation', () => {
    it('should handle keys with special characters', async () => {
      const specialKeys = [
        'test:user@example.com',
        'test:192.168.1.1',
        'test:user:123:action',
        'test:key-with-dashes',
        'test:key_with_underscores',
        'test:key.with.dots',
      ];

      for (const key of specialKeys) {
        const result = await service.checkRateLimit(key, 5, 60);
        expect(result.allowed).toBe(true);
      }
    });

    it('should handle very long keys', async () => {
      const longKey = 'test:' + 'x'.repeat(1000);
      const limit = 5;
      const window = 60;

      const result = await service.checkRateLimit(longKey, limit, window);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should maintain isolation between similar keys', async () => {
      const keys = [
        'user:123',
        'user:1234',
        'user:123:action',
        'users:123',
      ];

      // Each key should have independent limits
      for (const key of keys) {
        const result1 = await service.checkRateLimit(key, 2, 60);
        const result2 = await service.checkRateLimit(key, 2, 60);
        const result3 = await service.checkRateLimit(key, 2, 60);

        expect(result1.allowed).toBe(true);
        expect(result2.allowed).toBe(true);
        expect(result3.allowed).toBe(false); // Third should be blocked
      }
    });
  });

  describe('Penalty System Edge Cases', () => {
    it('should handle penalty overflow gracefully', async () => {
      const key = 'test:penalty-overflow';
      const limit = 1;
      const window = 1;

      // Simulate extremely high penalty level that could cause overflow
      redis.multi = jest.fn(() => {
        const chain: any = {
          get: jest.fn(() => chain),
          incr: jest.fn(() => chain),
          ttl: jest.fn(() => chain),
          expire: jest.fn(() => chain),
          exec: jest.fn().mockResolvedValue([
            [null, '50'], // Extremely high penalty level
            [null, '10'], // count exceeds limit
            [null, 60],   // ttl
          ]),
        };
        return chain;
      }) as any;

      const result = await service.checkRateLimit(key, limit, window);

      expect(result.allowed).toBe(false);
      expect(result.resetInSeconds).toBeGreaterThan(0);
      expect(Number.isFinite(result.resetInSeconds)).toBe(true);
    });

    it('should handle negative penalty levels', async () => {
      const key = 'test:negative-penalty';
      const limit = 5;
      const window = 60;

      redis.multi = jest.fn(() => {
        const chain: any = {
          get: jest.fn(() => chain),
          incr: jest.fn(() => chain),
          ttl: jest.fn(() => chain),
          exec: jest.fn().mockResolvedValue([
            [null, '-1'], // Negative penalty level
            [null, '1'],  // count within limit
            [null, 60],   // ttl
          ]),
        };
        return chain;
      }) as any;

      const result = await service.checkRateLimit(key, limit, window);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should handle penalty reset correctly', async () => {
      const key = 'test:penalty-reset';
      const limit = 2;
      const window = 60;

      // First, exceed the limit to create a penalty
      await service.checkRateLimit(key, limit, window); // count = 1
      await service.checkRateLimit(key, limit, window); // count = 2
      const blockedResult = await service.checkRateLimit(key, limit, window); // count = 3, blocked

      expect(blockedResult.allowed).toBe(false);

      // Reset the rate limit
      await service.resetRateLimit(key);

      // Should be able to make requests again
      const afterResetResult = await service.checkRateLimit(key, limit, window);

      expect(afterResetResult.allowed).toBe(true);
      expect(afterResetResult.remaining).toBe(1);
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle limit of 1', async () => {
      const key = 'test:limit-one';
      const limit = 1;
      const window = 60;

      const result1 = await service.checkRateLimit(key, limit, window);
      const result2 = await service.checkRateLimit(key, limit, window);

      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);
      expect(result2.allowed).toBe(false);
      expect(result2.remaining).toBe(0);
    });

    it('should handle window of 1 second', async () => {
      const key = 'test:window-one';
      const limit = 5;
      const window = 1;

      const result = await service.checkRateLimit(key, limit, window);

      expect(result.allowed).toBe(true);
      expect(result.resetInSeconds).toBe(1);
    });

    it('should handle exactly at limit boundary', async () => {
      const key = 'test:at-boundary';
      const limit = 3;
      const window = 60;

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await service.checkRateLimit(key, limit, window));
      }

      expect(results[0].allowed).toBe(true); // 1st request
      expect(results[1].allowed).toBe(true); // 2nd request
      expect(results[2].allowed).toBe(true); // 3rd request (at limit)
      expect(results[3].allowed).toBe(false); // 4th request (over limit)
      expect(results[4].allowed).toBe(false); // 5th request (over limit)
    });
  });
});
