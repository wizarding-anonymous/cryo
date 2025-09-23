import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from '../entities/review.entity';
import { GameRating } from '../entities/game-rating.entity';
import { MetricsService } from '../services/metrics.service';
import {
  AchievementWebhookDto,
  NotificationWebhookDto,
  GameCatalogWebhookDto,
  LibraryWebhookDto,
} from '../dto/webhook.dto';

export interface WebhookProcessingResult {
  processed: boolean;
  message: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(GameRating)
    private readonly gameRatingRepository: Repository<GameRating>,
    private readonly metricsService: MetricsService,
  ) {}

  async processAchievementWebhook(
    webhookData: AchievementWebhookDto,
  ): Promise<WebhookProcessingResult> {
    try {
      this.logger.debug(`Processing achievement webhook: ${JSON.stringify(webhookData)}`);

      // Записываем метрики получения webhook
      this.metricsService.recordWebhookReceived('achievement', webhookData.achievementType);

      // Проверяем, что это webhook о первом отзыве
      if (webhookData.achievementType === 'FIRST_REVIEW') {
        // Проверяем, действительно ли у пользователя есть отзывы
        const userReviewsCount = await this.reviewRepository.count({
          where: { userId: webhookData.userId },
        });

        if (userReviewsCount > 0) {
          this.logger.log(
            `Achievement webhook confirmed: User ${webhookData.userId} has ${userReviewsCount} reviews`
          );

          // Записываем успешную обработку
          this.metricsService.recordWebhookProcessed('achievement', 'success');

          return {
            processed: true,
            message: 'First review achievement confirmed',
            metadata: {
              userId: webhookData.userId,
              reviewsCount: userReviewsCount,
              achievementType: webhookData.achievementType,
            },
          };
        } else {
          this.logger.warn(
            `Achievement webhook mismatch: User ${webhookData.userId} has no reviews but received FIRST_REVIEW achievement`
          );

          this.metricsService.recordWebhookProcessed('achievement', 'mismatch');

          return {
            processed: false,
            message: 'Achievement webhook data mismatch',
            metadata: {
              userId: webhookData.userId,
              reviewsCount: userReviewsCount,
              achievementType: webhookData.achievementType,
            },
          };
        }
      }

      // Обрабатываем другие типы достижений
      this.logger.debug(`Processing other achievement type: ${webhookData.achievementType}`);
      this.metricsService.recordWebhookProcessed('achievement', 'other');

      return {
        processed: true,
        message: `Achievement webhook processed for type: ${webhookData.achievementType}`,
        metadata: {
          userId: webhookData.userId,
          achievementType: webhookData.achievementType,
        },
      };
    } catch (error) {
      this.logger.error('Failed to process achievement webhook', error);
      this.metricsService.recordWebhookProcessed('achievement', 'error');

      return {
        processed: false,
        message: 'Failed to process achievement webhook',
        metadata: {
          error: error.message,
        },
      };
    }
  }

  async processNotificationWebhook(
    webhookData: NotificationWebhookDto,
  ): Promise<WebhookProcessingResult> {
    try {
      this.logger.debug(`Processing notification webhook: ${JSON.stringify(webhookData)}`);

      // Записываем метрики получения webhook
      this.metricsService.recordWebhookReceived('notification', webhookData.notificationType);

      // Проверяем, что отзыв существует
      const review = await this.reviewRepository.findOne({
        where: { id: webhookData.reviewId },
      });

      if (!review) {
        this.logger.warn(`Notification webhook for non-existent review: ${webhookData.reviewId}`);
        this.metricsService.recordWebhookProcessed('notification', 'not_found');

        return {
          processed: false,
          message: 'Review not found',
          metadata: {
            reviewId: webhookData.reviewId,
            notificationType: webhookData.notificationType,
          },
        };
      }

      // Обрабатываем подтверждение отправки уведомления
      if (webhookData.status === 'sent') {
        this.logger.log(
          `Notification sent successfully for review ${webhookData.reviewId}, type: ${webhookData.notificationType}`
        );
        this.metricsService.recordWebhookProcessed('notification', 'success');
      } else if (webhookData.status === 'failed') {
        this.logger.warn(
          `Notification failed for review ${webhookData.reviewId}, type: ${webhookData.notificationType}`
        );
        this.metricsService.recordWebhookProcessed('notification', 'failed');
      }

      return {
        processed: true,
        message: `Notification webhook processed with status: ${webhookData.status}`,
        metadata: {
          reviewId: webhookData.reviewId,
          notificationType: webhookData.notificationType,
          status: webhookData.status,
          userId: review.userId,
          gameId: review.gameId,
        },
      };
    } catch (error) {
      this.logger.error('Failed to process notification webhook', error);
      this.metricsService.recordWebhookProcessed('notification', 'error');

      return {
        processed: false,
        message: 'Failed to process notification webhook',
        metadata: {
          error: error.message,
        },
      };
    }
  }

  async processGameCatalogWebhook(
    webhookData: GameCatalogWebhookDto,
  ): Promise<WebhookProcessingResult> {
    try {
      this.logger.debug(`Processing game catalog webhook: ${JSON.stringify(webhookData)}`);

      // Записываем метрики получения webhook
      this.metricsService.recordWebhookReceived('game_catalog', 'rating_sync');

      // Проверяем, что рейтинг игры существует в нашей системе
      const gameRating = await this.gameRatingRepository.findOne({
        where: { gameId: webhookData.gameId },
      });

      if (!gameRating) {
        this.logger.warn(`Game catalog webhook for unknown game: ${webhookData.gameId}`);
        this.metricsService.recordWebhookProcessed('game_catalog', 'not_found');

        return {
          processed: false,
          message: 'Game rating not found in review service',
          metadata: {
            gameId: webhookData.gameId,
            syncStatus: webhookData.syncStatus,
          },
        };
      }

      // Обрабатываем подтверждение синхронизации рейтинга
      if (webhookData.syncStatus === 'success') {
        this.logger.log(
          `Rating sync successful for game ${webhookData.gameId}: ${gameRating.averageRating} (${gameRating.totalReviews} reviews)`
        );
        this.metricsService.recordWebhookProcessed('game_catalog', 'success');

        // Проверяем соответствие данных
        const ratingMatch = Math.abs(gameRating.averageRating - webhookData.averageRating) < 0.01;
        const reviewsMatch = gameRating.totalReviews === webhookData.totalReviews;

        if (!ratingMatch || !reviewsMatch) {
          this.logger.warn(
            `Rating sync data mismatch for game ${webhookData.gameId}. ` +
            `Local: ${gameRating.averageRating}/${gameRating.totalReviews}, ` +
            `Remote: ${webhookData.averageRating}/${webhookData.totalReviews}`
          );
          this.metricsService.recordWebhookProcessed('game_catalog', 'mismatch');
        }
      } else if (webhookData.syncStatus === 'failed') {
        this.logger.error(
          `Rating sync failed for game ${webhookData.gameId}: ${webhookData.errorMessage || 'Unknown error'}`
        );
        this.metricsService.recordWebhookProcessed('game_catalog', 'sync_failed');
      }

      return {
        processed: true,
        message: `Game catalog webhook processed with status: ${webhookData.syncStatus}`,
        metadata: {
          gameId: webhookData.gameId,
          syncStatus: webhookData.syncStatus,
          localRating: gameRating.averageRating,
          localReviews: gameRating.totalReviews,
          remoteRating: webhookData.averageRating,
          remoteReviews: webhookData.totalReviews,
          errorMessage: webhookData.errorMessage,
        },
      };
    } catch (error) {
      this.logger.error('Failed to process game catalog webhook', error);
      this.metricsService.recordWebhookProcessed('game_catalog', 'error');

      return {
        processed: false,
        message: 'Failed to process game catalog webhook',
        metadata: {
          error: error.message,
        },
      };
    }
  }

  async processLibraryWebhook(
    webhookData: LibraryWebhookDto,
  ): Promise<WebhookProcessingResult> {
    try {
      this.logger.debug(`Processing library webhook: ${JSON.stringify(webhookData)}`);

      // Записываем метрики получения webhook
      this.metricsService.recordWebhookReceived('library', webhookData.eventType);

      // Обрабатываем различные типы событий библиотеки
      switch (webhookData.eventType) {
        case 'GAME_PURCHASED':
          // При покупке игры инвалидируем кеш владения
          // Это позволит пользователю сразу оставить отзыв
          this.logger.log(
            `Game purchased: User ${webhookData.userId} bought game ${webhookData.gameId}`
          );
          break;

        case 'GAME_REMOVED':
        case 'GAME_REFUNDED':
          // При удалении или возврате игры проверяем, есть ли отзывы
          const userReviews = await this.reviewRepository.find({
            where: {
              userId: webhookData.userId,
              gameId: webhookData.gameId,
            },
          });

          if (userReviews.length > 0) {
            this.logger.warn(
              `User ${webhookData.userId} has ${userReviews.length} reviews for removed/refunded game ${webhookData.gameId}`
            );
            
            // Можем пометить отзывы как требующие проверки
            // В MVP просто логируем, в будущем можем добавить автоматическое удаление
          }
          break;

        default:
          this.logger.warn(`Unknown library event type: ${webhookData.eventType}`);
      }

      this.metricsService.recordWebhookProcessed('library', 'success');

      return {
        processed: true,
        message: `Library webhook processed for event: ${webhookData.eventType}`,
        metadata: {
          userId: webhookData.userId,
          gameId: webhookData.gameId,
          eventType: webhookData.eventType,
          timestamp: webhookData.timestamp,
        },
      };
    } catch (error) {
      this.logger.error('Failed to process library webhook', error);
      this.metricsService.recordWebhookProcessed('library', 'error');

      return {
        processed: false,
        message: 'Failed to process library webhook',
        metadata: {
          error: error.message,
        },
      };
    }
  }

  async getWebhookStatistics(): Promise<{
    achievement: {
      received: number;
      processed: number;
      errors: number;
    };
    notification: {
      received: number;
      processed: number;
      errors: number;
    };
    gameCatalog: {
      received: number;
      processed: number;
      errors: number;
    };
    library: {
      received: number;
      processed: number;
      errors: number;
    };
  }> {
    // Получаем статистику из MetricsService
    const summary = await this.metricsService.getWebhookMetricsSummary();

    return {
      achievement: {
        received: summary.webhooksReceived.achievement || 0,
        processed: summary.webhooksProcessed.achievement || 0,
        errors: summary.webhookErrors.achievement || 0,
      },
      notification: {
        received: summary.webhooksReceived.notification || 0,
        processed: summary.webhooksProcessed.notification || 0,
        errors: summary.webhookErrors.notification || 0,
      },
      gameCatalog: {
        received: summary.webhooksReceived.game_catalog || 0,
        processed: summary.webhooksProcessed.game_catalog || 0,
        errors: summary.webhookErrors.game_catalog || 0,
      },
      library: {
        received: summary.webhooksReceived.library || 0,
        processed: summary.webhooksProcessed.library || 0,
        errors: summary.webhookErrors.library || 0,
      },
    };
  }
}