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
    const penaltyKey = `${key}:penalty`;

    const p = this.redis.multi();
    p.get(penaltyKey);
    p.incr(key);
    p.ttl(key);
    const results = (await p.exec()) as any;

    const penaltyLevel = Number(results[0]?.[1] ?? 0);
    const count = Number(results[1]?.[1] ?? 0);
    let ttl = Number(results[2]?.[1] ?? -1);

    if (count > limit) {
      // Exceeded limit, apply penalty
      const newPenaltyLevel = penaltyLevel + 1;
      const backoffSeconds = windowSeconds * Math.pow(2, newPenaltyLevel);

      const p2 = this.redis.multi();
      p2.incr(penaltyKey);
      p2.expire(penaltyKey, backoffSeconds);
      p2.expire(key, backoffSeconds);
      await p2.exec();

      return { allowed: false, remaining: 0, resetInSeconds: backoffSeconds };
    }

    if (ttl === -1) {
      // First request, set expiry
      await this.redis.expire(key, windowSeconds);
      ttl = windowSeconds;
    }

    const remaining = Math.max(0, limit - count);
    return { allowed: true, remaining, resetInSeconds: ttl };
  }

  async incrementCounter(key: string, windowSeconds: number): Promise<number> {
    const p = this.redis.multi();
    p.incr(key);
    p.expire(key, windowSeconds, 'NX');
    const results = (await p.exec()) as [Error | null, unknown][];
    const countResult = results[0];
    return Number(countResult?.[1] ?? 0);
  }

  async getRemainingRequests(key: string, limit: number, windowSeconds: number): Promise<number> {
    const val = await this.redis.get(key);
    const count = Number(val ?? 0);
    return Math.max(0, limit - count);
  }

  async resetRateLimit(key: string): Promise<void> {
    await this.redis.del(key);
    await this.redis.del(`${key}:penalty`);
  }
}
