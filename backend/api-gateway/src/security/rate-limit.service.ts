import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RedisClient } from '../redis/redis.constants';
import { RedisService } from '../redis/redis.service';
import { RateLimitConfig } from '../common/interfaces/rate-limit-config.interface';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
  windowMs: number;
}

export interface RouteRateLimitConfig {
  pattern: string;
  config: RateLimitConfig;
}

@Injectable()
export class RateLimitService {
  private readonly enabled: boolean;
  private readonly defaultWindowMs: number;
  private readonly defaultMaxRequests: number;
  private readonly routeConfigs: RouteRateLimitConfig[];

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.enabled = this.configService.get<boolean>('RATE_LIMIT_ENABLED', true);
    this.defaultWindowMs = Number(
      this.configService.get<number>('RATE_LIMIT_WINDOW_MS', 60000),
    );
    this.defaultMaxRequests = Number(
      this.configService.get<number>('RATE_LIMIT_MAX_REQUESTS', 100),
    );

    // Configure different limits for different routes
    this.routeConfigs = this.loadRouteConfigs();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async check(
    ip: string,
    route: string,
    method: string,
  ): Promise<RateLimitResult> {
    const config = this.getConfigForRoute(route);
    const client: RedisClient = this.redisService.getClient();
    const now = Date.now();
    const windowStart = now - config.windowMs;
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

    if (current >= config.requests) {
      // compute reset timestamp (oldest in window + windowMs)
      const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTs = oldest && oldest.length >= 2 ? Number(oldest[1]) : now;
      const reset = oldestTs + config.windowMs;
      return {
        allowed: false,
        limit: config.requests,
        remaining: 0,
        reset,
        windowMs: config.windowMs,
      };
    }

    // allow this request, add timestamp and set TTL roughly to window
    const multi2 = client.multi();
    multi2.zadd(key, now, String(now));
    multi2.pexpire(key, config.windowMs);
    const exec2 = await multi2.exec();
    // remaining after adding this one
    const remaining = Math.max(0, config.requests - (current + 1));
    return {
      allowed: true,
      limit: config.requests,
      remaining,
      reset: now + config.windowMs,
      windowMs: config.windowMs,
    };
  }

  private loadRouteConfigs(): RouteRateLimitConfig[] {
    return [
      // Authentication endpoints - more restrictive
      {
        pattern: '/api/auth/*',
        config: {
          requests: 10,
          windowMs: 60000, // 1 minute
        },
      },
      // Payment endpoints - very restrictive
      {
        pattern: '/api/payments/*',
        config: {
          requests: 20,
          windowMs: 60000, // 1 minute
        },
      },
      // Game catalog - more permissive for browsing
      {
        pattern: '/api/games*',
        config: {
          requests: 200,
          windowMs: 60000, // 1 minute
        },
      },
      // Download endpoints - moderate limits
      {
        pattern: '/api/downloads/*',
        config: {
          requests: 50,
          windowMs: 60000, // 1 minute
        },
      },
      // User profile endpoints
      {
        pattern: '/api/users/*',
        config: {
          requests: 60,
          windowMs: 60000, // 1 minute
        },
      },
    ];
  }

  private getConfigForRoute(route: string): RateLimitConfig {
    // Find matching route configuration
    for (const routeConfig of this.routeConfigs) {
      if (this.matchesPattern(route, routeConfig.pattern)) {
        return routeConfig.config;
      }
    }

    // Return default configuration if no specific route matches
    return {
      requests: this.defaultMaxRequests,
      windowMs: this.defaultWindowMs,
    };
  }

  private matchesPattern(route: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(route);
  }

  private key(ip: string, method: string, route: string): string {
    const safeRoute = route.replace(/\s+/g, '').slice(0, 128);
    return `ratelimit:${ip}:${method}:${safeRoute}`;
  }
}
