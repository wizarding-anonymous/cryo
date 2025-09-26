import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisClient } from '../redis/redis.constants';
import { RedisService } from '../redis/redis.service';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
  windowMs: number;
}

@Injectable()
export class RateLimitService {
  private readonly enabled: boolean;
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.enabled = this.configService.get<boolean>('RATE_LIMIT_ENABLED', true);
    this.windowMs = Number(
      this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 60000),
    );
    this.maxRequests = Number(
      this.configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 60),
    );
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async check(
    ip: string,
    route: string,
    method: string,
  ): Promise<RateLimitResult> {
    const client: RedisClient = this.redisService.getClient();
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const key = this.key(ip, method, route);

    // Sliding window via ZSET timestamps
    const multi = client.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zcard(key);
    const exec1 = (await multi.exec()) as Array<[Error | null, number]> | null;

    let current = 0;
    if (exec1 && exec1[1] && typeof exec1[1][1] === 'number') {
      current = exec1[1][1];
    }

    if (current >= this.maxRequests) {
      // compute reset timestamp (oldest in window + windowMs)
      const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTs = oldest && oldest.length >= 2 ? Number(oldest[1]) : now;
      const reset = oldestTs + this.windowMs;
      return {
        allowed: false,
        limit: this.maxRequests,
        remaining: 0,
        reset,
        windowMs: this.windowMs,
      };
    }

    // allow this request, add timestamp and set TTL roughly to window
    const multi2 = client.multi();
    multi2.zadd(key, now, String(now));
    multi2.pexpire(key, this.windowMs);
    const exec2 = await multi2.exec();
    // remaining after adding this one
    const remaining = Math.max(0, this.maxRequests - (current + 1));
    return {
      allowed: true,
      limit: this.maxRequests,
      remaining,
      reset: now + this.windowMs,
      windowMs: this.windowMs,
    };
  }

  private key(ip: string, method: string, route: string): string {
    const safeRoute = route.replace(/\s+/g, '').slice(0, 128);
    return `ratelimit:${ip}:${method}:${safeRoute}`;
  }
}
