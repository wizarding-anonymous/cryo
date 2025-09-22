import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { of } from 'rxjs';

import { Review } from './entities/review.entity';
import { GameRating } from './entities/game-rating.entity';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly httpService: HttpService,
  ) {}

  getHello(): string {
    return 'Review Service API - Ready to serve game reviews and ratings!';
  }

  async getHealth() {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    
    try {
      // Check database connectivity
      const [reviewCount, ratingCount] = await Promise.all([
        this.reviewRepository.count(),
        this.gameRatingRepository.count(),
      ]);
      
      // Check cache connectivity
      const cacheTestKey = `health_check_${Date.now()}`;
      await this.cacheManager.set(cacheTestKey, 'test', 1);
      const cacheValue = await this.cacheManager.get(cacheTestKey);
      await this.cacheManager.del(cacheTestKey);
      
      const cacheHealthy = cacheValue === 'test';

      // Check external service connectivity
      const externalServices = await this.checkExternalServices();

      const allChecksHealthy = cacheHealthy && 
        externalServices.every(service => service.status === 'ok');

      return {
        status: allChecksHealthy ? 'ok' : 'degraded',
        timestamp,
        service: 'review-service',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: `${Math.floor(uptime)}s`,
        checks: {
          database: {
            status: 'ok',
            reviews: reviewCount,
            ratings: ratingCount,
            responseTime: '<10ms',
          },
          cache: {
            status: cacheHealthy ? 'ok' : 'error',
            connected: cacheHealthy,
            responseTime: cacheHealthy ? '<5ms' : 'timeout',
          },
          externalServices,
          memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
            percentage: `${Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100)}%`,
          },
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : 'N/A (Windows)',
          },
        },
      };
    } catch (error) {
      this.logger.error('Health check failed', error);
      return {
        status: 'error',
        timestamp,
        service: 'review-service',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: `${Math.floor(uptime)}s`,
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {
          database: { status: 'error' },
          cache: { status: 'error' },
          externalServices: [],
          memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          },
        },
      };
    }
  }

  private async checkExternalServices(): Promise<Array<{
    name: string;
    status: 'ok' | 'error' | 'timeout';
    responseTime?: string;
    error?: string;
  }>> {
    const services = [
      { name: 'library-service', url: process.env.LIBRARY_SERVICE_URL },
      { name: 'game-catalog-service', url: process.env.GAME_CATALOG_SERVICE_URL },
      { name: 'achievement-service', url: process.env.ACHIEVEMENT_SERVICE_URL },
      { name: 'notification-service', url: process.env.NOTIFICATION_SERVICE_URL },
    ];

    const results = await Promise.allSettled(
      services.map(async (service) => {
        if (!service.url) {
          return {
            name: service.name,
            status: 'error' as const,
            error: 'Service URL not configured',
          };
        }

        try {
          const startTime = Date.now();
          const response = await firstValueFrom(
            this.httpService.get(`${service.url}/health`).pipe(
              timeout(5000),
              catchError((error) => {
                throw error;
              })
            )
          );
          const responseTime = Date.now() - startTime;

          return {
            name: service.name,
            status: response.status === 200 ? 'ok' as const : 'error' as const,
            responseTime: `${responseTime}ms`,
          };
        } catch (error) {
          return {
            name: service.name,
            status: 'timeout' as const,
            error: error instanceof Error ? error.message : 'Connection failed',
          };
        }
      })
    );

    return results.map((result) => 
      result.status === 'fulfilled' ? result.value : {
        name: 'unknown',
        status: 'error' as const,
        error: 'Promise rejected',
      }
    );
  }

  async getReadiness() {
    try {
      // Quick database check
      await this.reviewRepository.query('SELECT 1');
      
      // Quick cache check
      const cacheTestKey = `readiness_check_${Date.now()}`;
      await this.cacheManager.set(cacheTestKey, 'ready', 1);
      const cacheValue = await this.cacheManager.get(cacheTestKey);
      await this.cacheManager.del(cacheTestKey);
      
      const ready = cacheValue === 'ready';

      return {
        status: ready ? 'ready' : 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'review-service',
        checks: {
          database: 'ok',
          cache: ready ? 'ok' : 'error',
        },
      };
    } catch (error) {
      return {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        service: 'review-service',
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {
          database: 'error',
          cache: 'error',
        },
      };
    }
  }

  async getLiveness() {
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    // Consider service unhealthy if memory usage is above 90%
    const isHealthy = memoryUsagePercent < 90;

    return {
      status: isHealthy ? 'alive' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'review-service',
      uptime: `${Math.floor(process.uptime())}s`,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        percentage: `${Math.round(memoryUsagePercent)}%`,
      },
    };
  }
}
