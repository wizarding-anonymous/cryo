import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class CacheHealthIndicator extends HealthIndicator {
  constructor(private readonly cacheService: CacheService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const healthCheck = await this.cacheService.healthCheck();
      const isUp = healthCheck.status === 'healthy';

      const result = this.getStatus(key, isUp, {
        healthStatus: healthCheck.status,
        stats: healthCheck.details.stats,
        canRead: healthCheck.details.canRead,
        canWrite: healthCheck.details.canWrite,
      });

      if (isUp) {
        return result;
      }

      throw new Error(
        `Cache health check failed: ${JSON.stringify(healthCheck.details)}`,
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Cache health check failed: ${errorMessage}`);
    }
  }
}
