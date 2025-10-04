import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private readonly isWarmupEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.isWarmupEnabled = this.configService.get<boolean>(
      'CACHE_WARMUP_ENABLED',
      true,
    );
  }

  onModuleInit(): void {
    if (this.isWarmupEnabled) {
      // Delay warmup to allow the application to fully start
      setTimeout(() => {
        void this.warmUpCache().catch((error) => {
          this.logger.error('Cache warmup failed:', error);
        });
      }, 5000);
    }
  }

  async warmUpCache(): Promise<void> {
    if (!this.isWarmupEnabled) {
      this.logger.log('Cache warmup is disabled');
      return;
    }

    this.logger.log('Starting cache warmup...');
    const startTime = Date.now();

    try {
      await Promise.all([this.warmUpGameLists(), this.warmUpPopularSearches()]);

      const duration = Date.now() - startTime;
      this.logger.log(`Cache warmup completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Cache warmup failed:', error);
    }
  }

  private async warmUpGameLists(): Promise<void> {
    this.logger.debug('Warming up game lists...');

    try {
      // Warm up common game list queries
      const commonQueries = [
        'game-catalog:games_list_page:1_limit:10_available:true',
        'game-catalog:games_list_page:1_limit:20_available:true',
        'game-catalog:games_list_page:1_limit:10_genre:action',
        'game-catalog:games_list_page:1_limit:10_sortBy:releaseDate',
      ];

      for (const key of commonQueries) {
        // Check if cache key exists, if not it will be populated on first request
        const cached = await this.cacheService.get(key);
        if (!cached) {
          this.logger.debug(
            `Cache miss for key: ${key} - will be populated on first request`,
          );
        }
      }

      this.logger.debug('Game lists cache warmup completed');
    } catch (error) {
      this.logger.warn('Game lists cache warmup failed:', error);
    }
  }

  private async warmUpPopularSearches(): Promise<void> {
    this.logger.debug('Warming up popular searches...');

    try {
      // Warm up common search queries
      const popularSearches = [
        'game-catalog:search_q:action_type:title',
        'game-catalog:search_q:adventure_type:title',
        'game-catalog:search_q:rpg_type:title',
        'game-catalog:search_q:strategy_type:title',
      ];

      for (const key of popularSearches) {
        // Check if cache key exists, if not it will be populated on first request
        const cached = await this.cacheService.get(key);
        if (!cached) {
          this.logger.debug(
            `Cache miss for key: ${key} - will be populated on first request`,
          );
        }
      }

      this.logger.debug('Popular searches cache warmup completed');
    } catch (error) {
      this.logger.warn('Popular searches cache warmup failed:', error);
    }
  }

  private serializeQuery(query: Record<string, unknown>): string {
    const sortedKeys = Object.keys(query).sort();
    const pairs = sortedKeys.map((key) => {
      const value = query[key];
      let serializedValue: string;

      if (typeof value === 'object' && value !== null) {
        serializedValue = JSON.stringify(value);
      } else if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        serializedValue = String(value);
      } else {
        serializedValue = '';
      }

      return `${key}=${serializedValue}`;
    });
    return pairs.join('&');
  }

  /**
   * Manually trigger cache warmup (useful for admin endpoints)
   */
  async triggerWarmup(): Promise<{
    success: boolean;
    duration: number;
    message: string;
  }> {
    const startTime = Date.now();

    try {
      await this.warmUpCache();
      const duration = Date.now() - startTime;

      return {
        success: true,
        duration,
        message: `Cache warmup completed successfully in ${duration}ms`,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        duration,
        message: `Cache warmup failed: ${(error as Error).message}`,
      };
    }
  }
}
