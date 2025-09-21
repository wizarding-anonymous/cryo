import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import type { Cache } from 'cache-manager';

import { Review } from './entities/review.entity';
import { GameRating } from './entities/game-rating.entity';

@Injectable()
export class AppService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  getHello(): string {
    return 'Review Service API - Ready to serve game reviews and ratings!';
  }

  async getHealth() {
    const timestamp = new Date().toISOString();
    const uptime = process.uptime();
    
    try {
      // Check database connectivity
      const reviewCount = await this.reviewRepository.count();
      const ratingCount = await this.gameRatingRepository.count();
      
      // Check cache connectivity
      const cacheTestKey = `health_check_${Date.now()}`;
      await this.cacheManager.set(cacheTestKey, 'test', 1);
      const cacheValue = await this.cacheManager.get(cacheTestKey);
      await this.cacheManager.del(cacheTestKey);
      
      const cacheHealthy = cacheValue === 'test';

      return {
        status: 'ok',
        timestamp,
        service: 'review-service',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: `${Math.floor(uptime)}s`,
        checks: {
          database: {
            status: 'ok',
            reviews: reviewCount,
            ratings: ratingCount,
          },
          cache: {
            status: cacheHealthy ? 'ok' : 'error',
            connected: cacheHealthy,
          },
          memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          },
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp,
        service: 'review-service',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: `${Math.floor(uptime)}s`,
        error: error instanceof Error ? error.message : 'Unknown error',
        checks: {
          database: { status: 'error' },
          cache: { status: 'error' },
          memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          },
        },
      };
    }
  }
}
