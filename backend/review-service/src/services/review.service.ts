import { Injectable, NotFoundException, ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { CreateReviewDto } from '../dto/create-review.dto';
import { UpdateReviewDto } from '../dto/update-review.dto';
import { PaginationDto } from '../dto/pagination.dto';
import { OwnershipService, RatingService } from './index';
import { ExternalIntegrationService } from './external-integration.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class ReviewService {
    private readonly logger = new Logger(ReviewService.name);

    constructor(
        @InjectRepository(Review)
        private readonly reviewRepository: Repository<Review>,
        private readonly ownershipService: OwnershipService,
        private readonly ratingService: RatingService,
        private readonly externalIntegrationService: ExternalIntegrationService,
        private readonly metricsService: MetricsService,
    ) { }

    async createReview(userId: string, createReviewDto: CreateReviewDto): Promise<Review> {
        this.logger.debug(`Creating review for user ${userId}, game ${createReviewDto.gameId}`);

        // Проверка существования игры в каталоге
        const gameExists = await this.externalIntegrationService.validateGameExists(createReviewDto.gameId);
        if (!gameExists) {
            throw new NotFoundException('Game not found in catalog');
        }

        // Проверка владения игрой
        const ownsGame = await this.ownershipService.checkGameOwnership(userId, createReviewDto.gameId);
        if (!ownsGame) {
            throw new ForbiddenException('You must own the game to leave a review');
        }

        // Проверка уникальности отзыва (один отзыв на игру от пользователя)
        const existingReview = await this.reviewRepository.findOne({
            where: {
                userId,
                gameId: createReviewDto.gameId,
            },
        });

        if (existingReview) {
            throw new ConflictException('You have already reviewed this game');
        }

        // Создание отзыва
        const review = this.reviewRepository.create({
            userId,
            gameId: createReviewDto.gameId,
            text: createReviewDto.text,
            rating: createReviewDto.rating,
        });

        const savedReview = await this.reviewRepository.save(review);
        this.logger.debug(`Review created with ID: ${savedReview.id}`);

        // Обновление рейтинга игры с метриками
        this.metricsService.recordRatingCalculation(createReviewDto.gameId, 'create');
        await this.ratingService.updateGameRating(createReviewDto.gameId);

        // Проверяем, является ли это первым отзывом пользователя
        const userReviewsCount = await this.reviewRepository.count({
            where: { userId },
        });

        if (userReviewsCount === 1) {
            // Уведомление Achievement Service о первом отзыве
            await this.externalIntegrationService.notifyFirstReviewAchievement(userId);
        }

        // Уведомление Notification Service о новом отзыве
        await this.externalIntegrationService.notifyReviewAction(savedReview, 'created');

        return savedReview;
    }

    async getGameReviews(gameId: string, paginationDto: PaginationDto): Promise<{
        reviews: Review[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const { page = 1, limit = 10 } = paginationDto;
        const skip = (page - 1) * limit;

        const [reviews, total] = await this.reviewRepository.findAndCount({
            where: { gameId },
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });

        return {
            reviews,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async updateReview(reviewId: string, userId: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
        this.logger.debug(`Updating review ${reviewId} for user ${userId}`);

        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        if (review.userId !== userId) {
            throw new ForbiddenException('You can only update your own reviews');
        }

        // Обновление отзыва
        Object.assign(review, updateReviewDto);
        const updatedReview = await this.reviewRepository.save(review);

        // Пересчет рейтинга игры если изменился рейтинг
        if (updateReviewDto.rating !== undefined) {
            this.metricsService.recordRatingCalculation(review.gameId, 'update');
            await this.ratingService.updateGameRating(review.gameId);
        }

        // Уведомление Notification Service об обновлении отзыва
        await this.externalIntegrationService.notifyReviewAction(updatedReview, 'updated');

        this.logger.debug(`Review ${reviewId} updated successfully`);
        return updatedReview;
    }

    async deleteReview(reviewId: string, userId: string): Promise<void> {
        this.logger.debug(`Deleting review ${reviewId} for user ${userId}`);

        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        if (review.userId !== userId) {
            throw new ForbiddenException('You can only delete your own reviews');
        }

        // Уведомление Notification Service об удалении отзыва (до удаления)
        await this.externalIntegrationService.notifyReviewAction(review, 'deleted');

        await this.reviewRepository.remove(review);

        // Пересчет рейтинга игры после удаления отзыва с метриками
        this.metricsService.recordRatingCalculation(review.gameId, 'delete');
        await this.ratingService.updateGameRating(review.gameId);

        this.logger.debug(`Review ${reviewId} deleted successfully`);
    }

    async getUserReviews(userId: string, paginationDto: PaginationDto): Promise<{
        reviews: Review[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }> {
        const { page = 1, limit = 10 } = paginationDto;
        const skip = (page - 1) * limit;

        const [reviews, total] = await this.reviewRepository.findAndCount({
            where: { userId },
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });

        return {
            reviews,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async getReviewWithGameInfo(reviewId: string): Promise<Review & { gameInfo?: { title: string; description?: string } }> {
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        // Получаем информацию об игре из Game Catalog Service
        const gameInfo = await this.externalIntegrationService.getGameInfo(review.gameId);

        return {
            ...review,
            gameInfo: gameInfo || undefined,
        };
    }

    async findReviewById(reviewId: string): Promise<Review | null> {
        return await this.reviewRepository.findOne({
            where: { id: reviewId },
        });
    }

    async getServiceHealthStatus(): Promise<{
        library: boolean;
        gameCatalog: boolean;
        achievement: boolean;
        notification: boolean;
    }> {
        return await this.externalIntegrationService.healthCheck();
    }
}