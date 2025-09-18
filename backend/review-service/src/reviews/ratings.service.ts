import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

import { GameRating } from '../entities/game-rating.entity';
import { Review } from '../entities/review.entity';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);
  private gameCatalogServiceUrl: string;

  constructor(
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.gameCatalogServiceUrl = this.configService.get<string>('GAME_CATALOG_SERVICE_URL');
  }

  async getGameRating(gameId: string): Promise<GameRating> {
    const cacheKey = `game-rating:${gameId}`;
    const ttl = 300;

    const cachedRating = await this.cacheManager.get<GameRating>(cacheKey);
    if (cachedRating) {
      const rating = new GameRating();
      Object.assign(rating, cachedRating);
      return rating;
    }

    const dbRating = await this.gameRatingRepository.findOne({ where: { gameId } });

    if (dbRating) {
      await this.cacheManager.set(cacheKey, dbRating, ttl);
      return dbRating;
    }

    const defaultRating = new GameRating();
    defaultRating.gameId = gameId;
    defaultRating.averageRating = 0;
    defaultRating.totalReviews = 0;

    await this.cacheManager.set(cacheKey, defaultRating, ttl);

    return defaultRating;
  }

  async updateGameRating(gameId: string): Promise<GameRating> {
    const { averageRating, totalReviews } = await this.calculateGameRating(gameId);

    const newRating = this.gameRatingRepository.create({
      gameId,
      averageRating,
      totalReviews,
    });

    const savedRating = await this.gameRatingRepository.save(newRating);

    const cacheKey = `game-rating:${gameId}`;
    await this.cacheManager.del(cacheKey);

    this.notifyGameCatalogService(savedRating);

    return savedRating;
  }

  private notifyGameCatalogService(rating: GameRating): void {
    if (!this.gameCatalogServiceUrl) {
      this.logger.warn('GAME_CATALOG_SERVICE_URL is not configured. Skipping notification.');
      return;
    }
    // This endpoint is hypothetical, based on the requirement to notify the service.
    const url = `${this.gameCatalogServiceUrl}/api/internal/catalog/ratings`;

    firstValueFrom(this.httpService.post(url, rating)).catch(error => {
      this.logger.error(`Failed to notify Game Catalog Service: ${error.message}`, error.stack);
    });
  }

  private async calculateGameRating(gameId: string): Promise<{ averageRating: number; totalReviews: number }> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'totalReviews')
      .addSelect('AVG(review.rating)', 'averageRating')
      .where('review.gameId = :gameId', { gameId })
      .getRawOne();

    const totalReviews = parseInt(result.totalReviews, 10) || 0;
    const averageRating = parseFloat(result.averageRating) || 0;

    return {
      totalReviews,
      averageRating: Math.round(averageRating * 100) / 100,
    };
  }
}
