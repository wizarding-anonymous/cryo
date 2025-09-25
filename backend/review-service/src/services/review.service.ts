import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { CreateReviewDto, UpdateReviewDto, PaginationDto } from '../dto';
import { OwnershipService, RatingService } from './index';

@Injectable()
export class ReviewService {
    constructor(
        @InjectRepository(Review)
        private readonly reviewRepository: Repository<Review>,
        private readonly ownershipService: OwnershipService,
        private readonly ratingService: RatingService,
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

        // Create the review
        const review = this.reviewRepository.create({
            ...createReviewDto,
            userId,
        });

        const savedReview = await this.reviewRepository.save(review);

        // Update game rating after creating review
        await this.ratingService.updateGameRating(createReviewDto.gameId);

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
        await this.ratingService.updateGameRating(review.gameId);

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
        await this.ratingService.updateGameRating(gameId);
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