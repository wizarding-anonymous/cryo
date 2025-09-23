import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { ExternalServiceBase, ExternalServiceError } from './external-service.base';
import { Review } from '../entities/review.entity';

export interface AchievementNotification {
    userId: string;
    achievementType: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface ReviewNotification {
    reviewId: string;
    userId: string;
    gameId: string;
    rating: number;
    timestamp: string;
    action: 'created' | 'updated' | 'deleted';
}

export interface GameRatingUpdate {
    gameId: string;
    averageRating: number;
    totalReviews: number;
    timestamp: string;
}

@Injectable()
export class ExternalIntegrationService extends ExternalServiceBase {
    private readonly logger = new Logger(ExternalIntegrationService.name);

    constructor(
        httpService: HttpService,
        configService: ConfigService,
    ) {
        super(httpService, configService);
    }

    async notifyFirstReviewAchievement(userId: string): Promise<void> {
        try {
            const achievementServiceUrl = this.getServiceUrl('achievement');
            const url = `${achievementServiceUrl}/api/v1/achievements/unlock`;

            const notification: AchievementNotification = {
                userId,
                achievementType: 'FIRST_REVIEW',
                timestamp: new Date().toISOString(),
                metadata: {
                    source: 'review-service',
                },
            };

            await this.makeRequestWithRetry(
                url,
                {
                    method: 'POST',
                    data: notification,
                },
                {
                    maxRetries: 2, // Меньше попыток для уведомлений
                    baseDelay: 500,
                },
                'achievement',
                'notifyFirstReview'
            );

            this.logger.debug(`Successfully notified Achievement Service about first review for user ${userId}`);
        } catch (error) {
            // Логируем ошибку, но не прерываем основной процесс
            this.logger.error(`Failed to notify Achievement Service about first review for user ${userId}`, error);
        }
    }

    async notifyReviewAction(review: Review, action: 'created' | 'updated' | 'deleted'): Promise<void> {
        try {
            const notificationServiceUrl = this.getServiceUrl('notification');
            const url = `${notificationServiceUrl}/api/v1/notifications/review-action`;

            const notification: ReviewNotification = {
                reviewId: review.id,
                userId: review.userId,
                gameId: review.gameId,
                rating: review.rating,
                timestamp: new Date().toISOString(),
                action,
            };

            await this.makeRequestWithRetry(
                url,
                {
                    method: 'POST',
                    data: notification,
                },
                {
                    maxRetries: 2,
                    baseDelay: 500,
                },
                'notification',
                'notifyReviewAction'
            );

            this.logger.debug(`Successfully notified Notification Service about review ${action} for review ${review.id}`);
        } catch (error) {
            this.logger.error(`Failed to notify Notification Service about review ${action} for review ${review.id}`, error);
        }
    }

    async updateGameCatalogRating(gameId: string, averageRating: number, totalReviews: number): Promise<void> {
        try {
            const gameCatalogServiceUrl = this.getServiceUrl('gameCatalog');
            const url = `${gameCatalogServiceUrl}/api/v1/games/${gameId}/rating`;

            const update: GameRatingUpdate = {
                gameId,
                averageRating,
                totalReviews,
                timestamp: new Date().toISOString(),
            };

            await this.makeRequestWithRetry(
                url,
                {
                    method: 'PUT',
                    data: update,
                },
                {
                    maxRetries: 3, // Больше попыток для критичных обновлений рейтинга
                    baseDelay: 1000,
                },
                'gameCatalog',
                'updateGameRating'
            );

            this.logger.debug(`Successfully updated game rating in Game Catalog for game ${gameId}`);
        } catch (error) {
            this.logger.error(`Failed to update game rating in Game Catalog for game ${gameId}`, error);
            // Для критичных обновлений рейтинга можем выбросить ошибку
            if (error instanceof ExternalServiceError && !error.retryable) {
                throw error;
            }
        }
    }

    async validateGameExists(gameId: string): Promise<boolean> {
        try {
            const gameCatalogServiceUrl = this.getServiceUrl('gameCatalog');
            const url = `${gameCatalogServiceUrl}/api/v1/games/${gameId}`;

            await this.makeRequestWithRetry(
                url,
                {
                    method: 'HEAD', // Используем HEAD для проверки существования
                },
                {
                    maxRetries: 2,
                    baseDelay: 500,
                },
                'gameCatalog',
                'validateGameExists'
            );

            return true;
        } catch (error) {
            if (error instanceof ExternalServiceError && error.statusCode === 404) {
                return false;
            }

            this.logger.error(`Failed to validate game existence for game ${gameId}`, error);
            // В случае ошибки сервиса считаем, что игра существует (fail-safe)
            return true;
        }
    }

    async getGameInfo(gameId: string): Promise<{ title: string; description?: string } | null> {
        try {
            const gameCatalogServiceUrl = this.getServiceUrl('gameCatalog');
            const url = `${gameCatalogServiceUrl}/api/v1/games/${gameId}`;

            const response = await this.makeRequestWithRetry<{
                id: string;
                title: string;
                description?: string;
            }>(
                url,
                {
                    method: 'GET',
                },
                {
                    maxRetries: 2,
                    baseDelay: 500,
                },
                'gameCatalog',
                'getGameInfo'
            );

            return {
                title: response.title,
                description: response.description,
            };
        } catch (error) {
            this.logger.error(`Failed to get game info for game ${gameId}`, error);
            return null;
        }
    }

    async healthCheck(): Promise<{
        library: boolean;
        gameCatalog: boolean;
        achievement: boolean;
        notification: boolean;
    }> {
        const services = ['library', 'gameCatalog', 'achievement', 'notification'] as const;
        const results: Record<string, boolean> = {};

        await Promise.allSettled(
            services.map(async (service) => {
                try {
                    const serviceUrl = this.getServiceUrl(service);
                    const url = `${serviceUrl}/health`;

                    await this.makeRequestWithRetry(
                        url,
                        {
                            method: 'GET',
                        },
                        {
                            maxRetries: 1,
                            baseDelay: 500,
                        },
                        service,
                        'healthCheck'
                    );

                    results[service] = true;
                } catch (error) {
                    this.logger.warn(`Health check failed for ${service} service`, error);
                    results[service] = false;
                }
            })
        );

        return results as {
            library: boolean;
            gameCatalog: boolean;
            achievement: boolean;
            notification: boolean;
        };
    }
}