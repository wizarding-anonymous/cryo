import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.cacheManager.set('health-check', 'ok', 10);
      const value = await this.cacheManager.get('health-check');
      if (value !== 'ok') {
        throw new Error('Redis health check failed');
      }
      return this.getStatus(key, true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new HealthCheckError(
        'RedisHealthIndicator failed',
        this.getStatus(key, false, { message }),
      );
    }
  }
}
