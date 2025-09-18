import { Injectable, NotFoundException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

import { Review } from '../entities/review.entity';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from './dto/review.dto';
import { OwnershipService } from './ownership.service';
import { RatingsService } from './ratings.service';

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);
  private achievementServiceUrl: string;
  private notificationServiceUrl: string;

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    private readonly ownershipService: OwnershipService,
    private readonly ratingsService: RatingsService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.achievementServiceUrl = this.configService.get<string>('ACHIEVEMENT_SERVICE_URL');
    this.notificationServiceUrl = this.configService.get<string>('NOTIFICATION_SERVICE_URL');
  }

  async createReview(userId: string, createReviewDto: CreateReviewDto): Promise<Review> {
    const { gameId, text, rating } = createReviewDto;

    const ownsGame = await this.ownershipService.checkGameOwnership(userId, gameId);
    if (!ownsGame) {
      throw new ForbiddenException('You must own the game to leave a review.');
    }

    const existingReview = await this.reviewRepository.findOne({ where: { userId, gameId } });
    if (existingReview) {
      throw new ConflictException('You have already reviewed this game.');
    }

    const newReview = this.reviewRepository.create({ userId, gameId, text, rating });
    const savedReview = await this.reviewRepository.save(newReview);

    await this.ratingsService.updateGameRating(gameId);

    // Fire-and-forget notifications
    this.notifyAchievementService(savedReview);
    this.notifyNotificationService(savedReview);

    return savedReview;
  }

  private notifyAchievementService(review: Review): void {
    if (!this.achievementServiceUrl) {
      this.logger.warn('ACHIEVEMENT_SERVICE_URL is not configured. Skipping notification.');
      return;
    }
    const url = `${this.achievementServiceUrl}/api/achievements/progress/update`;
    const payload = {
      userId: review.userId,
      eventType: 'review_created',
      eventData: { gameId: review.gameId, rating: review.rating },
    };

    firstValueFrom(this.httpService.post(url, payload)).catch(error => {
      this.logger.error(`Failed to notify Achievement Service: ${error.message}`, error.stack);
    });
  }

  private notifyNotificationService(review: Review): void {
    if (!this.notificationServiceUrl) {
      this.logger.warn('NOTIFICATION_SERVICE_URL is not configured. Skipping notification.');
      return;
    }
    const url = `${this.notificationServiceUrl}/api/notifications`;
    const payload = {
      userId: review.userId,
      type: 'review_published',
      title: 'Отзыв опубликован',
      message: `Ваш отзыв на игру успешно опубликован.`,
    };

    firstValueFrom(this.httpService.post(url, payload)).catch(error => {
        this.logger.error(`Failed to notify Notification Service: ${error.message}`, error.stack);
    });
  }

  async getGameReviews(gameId: string, paginationDto: PaginationDto): Promise<[Review[], number]> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [reviews, total] = await this.reviewRepository.findAndCount({
      where: { gameId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: skip,
    });

    return [reviews, total];
  }

  async updateReview(id: string, userId: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
    const review = await this.reviewRepository.findOne({ where: { id } });

    if (!review) {
      throw new NotFoundException(`Review with ID "${id}" not found`);
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You are not allowed to edit this review');
    }

    this.reviewRepository.merge(review, updateReviewDto);
    const updatedReview = await this.reviewRepository.save(review);

    if (updateReviewDto.rating) {
      await this.ratingsService.updateGameRating(review.gameId);
    }

    return updatedReview;
  }

  async deleteReview(id: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.findOne({ where: { id } });

    if (!review) {
      throw new NotFoundException(`Review with ID "${id}" not found`);
    }

    if (review.userId !== userId) {
      throw new ForbiddenException('You are not allowed to delete this review');
    }

    const gameId = review.gameId;
    const result = await this.reviewRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Review with ID "${id}" not found`);
    }

    await this.ratingsService.updateGameRating(gameId);
  }

  async getUserReviews(userId: string, paginationDto: PaginationDto): Promise<[Review[], number]> {
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [reviews, total] = await this.reviewRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: skip,
    });

    return [reviews, total];
  }
}
