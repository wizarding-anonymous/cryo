import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from '../dto';
import { OwnershipService, RatingService, AchievementService, NotificationService, GameCatalogService } from './index';

@Injectable()
export class ReviewService {
    constructor(
        @InjectRepository(Review)
        private readonly reviewRepository: Repository<Review>,
        private readonly ownershipService: OwnershipService,
        private readonly ratingService: RatingService,
        private readonly achievementService: AchievementService,
        private readonly notificationService: NotificationService,
        private readonly gameCatalogService: GameCatalogService,
    ) { }

    async createReview(userId: string, createReviewDto: CreateReviewDto): Promise<Review> {
        // Check if user owns the game
        const ownsGame = await this.ownershipService.checkGameOwnership(userId, createReviewDto.gameId);
        if (!ownsGame) {
            throw new ForbiddenException('You must own the game to leave a review');
        }

        // Check if user already has a review for this game (one review per game per user)
        const existingReview = await this.reviewRepository.findOne({
            where: {
                userId,
                gameId: createReviewDto.gameId,
            },
        });

        if (existingReview) {
            throw new ConflictException('You have already reviewed this game');
        }

        // Check if this is user's first review for achievement
        const isFirstReview = await this.achievementService.checkUserFirstReview(userId);

        // Create the review
        const review = this.reviewRepository.create({
            ...createReviewDto,
            userId,
        });

        const savedReview = await this.reviewRepository.save(review);

        // Update game rating after creating review
        const updatedRating = await this.ratingService.updateGameRating(createReviewDto.gameId);

        // Get game info for notifications
        const gameInfo = await this.gameCatalogService.getGameInfo(createReviewDto.gameId);

        // Notify Achievement Service about first review (fire and forget)
        if (isFirstReview) {
            this.achievementService.notifyFirstReview(userId, createReviewDto.gameId, savedReview.id)
                .catch(error => console.warn('Achievement notification failed:', error));
        }

        // Notify Notification Service about new review (fire and forget)
        this.notificationService.notifyNewReview(savedReview, gameInfo.name)
            .catch(error => console.warn('New review notification failed:', error));

        // Update Game Catalog Service with new rating (fire and forget)
        if (updatedRating) {
            this.gameCatalogService.updateGameRating(updatedRating)
                .catch(error => console.warn('Game catalog rating update failed:', error));
        }

        return savedReview;
    }

    async getGameReviews(gameId: string, paginationDto: PaginationDto): Promise<{ reviews: Review[]; total: number }> {
        const { page = 1, limit = 10 } = paginationDto;
        const skip = (page - 1) * limit;

        const [reviews, total] = await this.reviewRepository.findAndCount({
            where: { gameId },
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });

        return { reviews, total };
    }

    async updateReview(reviewId: string, userId: string, updateReviewDto: UpdateReviewDto): Promise<Review> {
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        // Check if user owns this review
        if (review.userId !== userId) {
            throw new ForbiddenException('You can only update your own reviews');
        }

        // Update the review
        Object.assign(review, updateReviewDto);
        const updatedReview = await this.reviewRepository.save(review);

        // Update game rating after updating review
        const updatedRating = await this.ratingService.updateGameRating(review.gameId);

        // Get game info for notifications
        const gameInfo = await this.gameCatalogService.getGameInfo(review.gameId);

        // Notify Notification Service about review update (fire and forget)
        this.notificationService.notifyReviewUpdate(updatedReview, gameInfo.name)
            .catch(error => console.warn('Review update notification failed:', error));

        // Update Game Catalog Service with new rating (fire and forget)
        if (updatedRating) {
            this.gameCatalogService.updateGameRating(updatedRating)
                .catch(error => console.warn('Game catalog rating update failed:', error));
        }

        return updatedReview;
    }

    async deleteReview(reviewId: string, userId: string): Promise<void> {
        const review = await this.reviewRepository.findOne({
            where: { id: reviewId },
        });

        if (!review) {
            throw new NotFoundException('Review not found');
        }

        // Check if user owns this review
        if (review.userId !== userId) {
            throw new ForbiddenException('You can only delete your own reviews');
        }

        const gameId = review.gameId;
        await this.reviewRepository.remove(review);

        // Update game rating after deleting review
        const updatedRating = await this.ratingService.updateGameRating(gameId);

        // Update Game Catalog Service with new rating (fire and forget)
        if (updatedRating) {
            this.gameCatalogService.updateGameRating(updatedRating)
                .catch(error => console.warn('Game catalog rating update failed:', error));
        }
    }

    async getUserReviews(userId: string, paginationDto: PaginationDto): Promise<{ reviews: Review[]; total: number }> {
        const { page = 1, limit = 10 } = paginationDto;
        const skip = (page - 1) * limit;

        const [reviews, total] = await this.reviewRepository.findAndCount({
            where: { userId },
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
        });

        return { reviews, total };
    }

    async findReviewById(reviewId: string): Promise<Review | null> {
        return this.reviewRepository.findOne({
            where: { id: reviewId },
        });
    }
}