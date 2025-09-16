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
      providers: [
        RateLimitService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
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
});
