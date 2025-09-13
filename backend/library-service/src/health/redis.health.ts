import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // A simple check to see if we can set and get a value from Redis
      await this.cacheManager.set('health-check', 'ok', 10);
      const value = await this.cacheManager.get('health-check');
      if (value !== 'ok') {
        throw new Error('Redis health check failed');
      }
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError('RedisHealthIndicator failed', this.getStatus(key, false, { message: error.message }));
    }
  }
}
