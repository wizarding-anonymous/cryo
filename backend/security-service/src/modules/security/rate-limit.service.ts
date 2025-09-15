import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '../../redis/redis.constants';
import type Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
}

@Injectable()
export class RateLimitService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const p = this.redis.multi();
    p.incr(key);
    p.ttl(key);
    const [countRaw, ttlRaw] = (await p.exec()) as [unknown, unknown][];
    const count = Number(countRaw?.[1] ?? 0);
    let ttl = Number(ttlRaw?.[1] ?? -1);
    if (ttl === -1) {
      await this.redis.expire(key, windowSeconds);
      ttl = windowSeconds;
    }
    const remaining = Math.max(0, limit - count);
    return { allowed: count <= limit, remaining, resetInSeconds: ttl >= 0 ? ttl : windowSeconds };
  }

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    const p = this.redis.multi();
    p.incr(key);
    p.expire(key, windowSeconds, 'NX');
    const [countRaw] = (await p.exec()) as [unknown][];
    return Number(countRaw?.[1] ?? 0);
  }

  async getRemainingRequests(key: string, limit: number, windowSeconds: number): Promise<number> {
    const val = await this.redis.get(key);
    const count = Number(val ?? 0);
    return Math.max(0, limit - count);
  }

  async resetRateLimit(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

