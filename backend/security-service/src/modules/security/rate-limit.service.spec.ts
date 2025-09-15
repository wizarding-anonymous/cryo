import { Test } from '@nestjs/testing';
import { RateLimitService } from './rate-limit.service';
import { REDIS_CLIENT } from '../../redis/redis.constants';

const createRedisMock = () => {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
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
      return {
        incr: (k: string) => ops.push(['incr', k]),
        ttl: (k: string) => ops.push(['ttl', k]),
        expire: (k: string, s: number) => ops.push(['expire', k, s]),
        exec: async () => {
          const results: any[] = [];
          for (const op of ops) {
            if (op[0] === 'incr') results.push([null, await (this as any).incr(op[1])]);
            if (op[0] === 'ttl') results.push([null, await (this as any).ttl(op[1])]);
            if (op[0] === 'expire') results.push([null, await (this as any).expire(op[1], op[2])]);
          }
          return results;
        },
      } as any;
    }),
  } as any;
};

describe('RateLimitService', () => {
  it('enforces limits within a window', async () => {
    const redis = createRedisMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RateLimitService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    const service = moduleRef.get(RateLimitService);
    const key = 'test:rl';
    const limit = 3;
    const window = 60;

    const r1 = await service.checkRateLimit(key, limit, window);
    const r2 = await service.checkRateLimit(key, limit, window);
    const r3 = await service.checkRateLimit(key, limit, window);
    const r4 = await service.checkRateLimit(key, limit, window);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r4.allowed).toBe(false);
  });

  it('increments counter and resets', async () => {
    const redis = createRedisMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RateLimitService,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    const service = moduleRef.get(RateLimitService);
    const key = 'test:inc';
    const v1 = await service.incrementCounter(key, 60);
    const v2 = await service.incrementCounter(key, 60);
    expect(v1).toBe(1);
    expect(v2).toBe(2);
    await service.resetRateLimit(key);
    const v3 = await service.incrementCounter(key, 60);
    expect(v3).toBe(1);
  });
});

