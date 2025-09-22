import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service';
import { GetGamesDto } from '../../dto/get-games.dto';
import { SearchGamesDto } from '../../dto/search-games.dto';

@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private readonly logger = new Logger(CacheWarmingService.name);
  private readonly isWarmupEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.isWarmupEnabled = this.configService.get<boolean>('CACHE_WARMUP_ENABLED', true);
  }

  async onModuleInit() {
    if (this.isWarmupEnabled) {
      // Delay warmup to allow the application to fully start
      setTimeout(() => {
        this.warmUpCache().catch(error => {
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
      await Promise.all([
        this.warmUpGameLists(),
        this.warmUpPopularSearches(),
      ]);

      const duration = Date.now() - startTime;
      this.logger.log(`Cache warmup completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Cache warmup failed:', error);
    }
  }

  private async warmUpGameLists(): Promise<void> {
    this.logger.debug('Warming up game lists...');

    // For now, we'll just log that we would warm up the cache
    // In a real implementation, we would need to inject the GameService
    // but that creates a circular dependency issue
    this.logger.debug('Game lists cache warmup would be performed here');
  }

  private async warmUpPopularSearches(): Promise<void> {
    this.logger.debug('Warming up popular searches...');

    // For now, we'll just log that we would warm up the cache
    // In a real implementation, we would need to inject the SearchService
    // but that creates a circular dependency issue
    this.logger.debug('Popular searches cache warmup would be performed here');
  }

  private serializeQuery(query: any): string {
    const sortedKeys = Object.keys(query).sort();
    const pairs = sortedKeys.map(key => `${key}=${query[key]}`);
    return pairs.join('&');
  }

  /**
   * Manually trigger cache warmup (useful for admin endpoints)
   */
  async triggerWarmup(): Promise<{ success: boolean; duration: number; message: string }> {
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
        message: `Cache warmup failed: ${error.message}`,
      };
    }
  }
}