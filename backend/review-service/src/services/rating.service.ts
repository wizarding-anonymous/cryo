import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async calculateGameRating(gameId: string): Promise<{ averageRating: number; totalReviews: number }> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'totalReviews')
      .where('review.gameId = :gameId', { gameId })
      .getRawOne();

    const averageRating = result.averageRating ? parseFloat(result.averageRating) : 0;
    const totalReviews = parseInt(result.totalReviews) || 0;

    return {
      averageRating: Math.round(averageRating * 100) / 100, // Round to 2 decimal places
      totalReviews,
    };
  }

  async updateGameRating(gameId: string): Promise<GameRating> {
    const { averageRating, totalReviews } = await this.calculateGameRating(gameId);

    // Find existing game rating or create new one
    let gameRating = await this.gameRatingRepository.findOne({
      where: { gameId },
    });

    if (!gameRating) {
      gameRating = this.gameRatingRepository.create({
        gameId,
        averageRating,
        totalReviews,
      });
    } else {
      gameRating.averageRating = averageRating;
      gameRating.totalReviews = totalReviews;
    }

    const savedRating = await this.gameRatingRepository.save(gameRating);

    // Invalidate cache for this game's rating
    await this.cacheManager.del(`game_rating_${gameId}`);

    return savedRating;
  }

  async getGameRating(gameId: string): Promise<GameRating | null> {
    // Try to get from cache first
    const cacheKey = `game_rating_${gameId}`;
    const cachedRating = await this.cacheManager.get<GameRating>(cacheKey);

    if (cachedRating) {
      return cachedRating;
    }

    // Get from database
    const gameRating = await this.gameRatingRepository.findOne({
      where: { gameId },
    });

    if (gameRating) {
      // Cache for 5 minutes (300 seconds)
      await this.cacheManager.set(cacheKey, gameRating, 300);
    }

    return gameRating;
  }
}