import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { EventService } from '../services/event.service';
import { Public } from '../decorators';

// DTOs for integration events
export class PaymentEventDto {
  userId!: string;
  gameId!: string;
  transactionId!: string;
  amount!: number;
  currency!: string;
  timestamp!: string;
}

export class ReviewEventDto {
  userId!: string;
  reviewId!: string;
  gameId!: string;
  rating!: number;
  timestamp!: string;
}

export class SocialEventDto {
  userId!: string;
  friendId!: string;
  eventType!: 'friend_added' | 'friend_removed';
  timestamp!: string;
}

export class LibraryEventDto {
  userId!: string;
  gameId!: string;
  action!: 'added' | 'removed';
  timestamp!: string;
}

@Controller('integration')
@ApiTags('integration')
@Public() // These endpoints should be accessible without JWT for service-to-service communication
export class IntegrationController {
  private readonly logger = new Logger(IntegrationController.name);

  constructor(private readonly eventService: EventService) {}

  /**
   * Webhook endpoint for Payment Service events
   */
  @Post('payment/purchase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook для событий покупки от Payment Service',
    description: 'Получает уведомления о покупках игр пользователями',
  })
  @ApiBody({ type: PaymentEventDto })
  @ApiResponse({
    status: 200,
    description: 'Событие успешно обработано',
  })
  @ApiResponse({
    status: 400,
    description: 'Некорректные данные события',
  })
  async handlePaymentPurchase(
    @Body() eventData: PaymentEventDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Received payment purchase event for user ${eventData.userId}, game ${eventData.gameId}`,
    );

    try {
      await this.eventService.handleGamePurchase(eventData.userId, eventData.gameId);

      return {
        success: true,
        message: 'Payment purchase event processed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to process payment purchase event:`, error);
      throw error;
    }
  }

  /**
   * Webhook endpoint for Review Service events
   */
  @Post('review/created')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook для событий создания отзывов от Review Service',
    description: 'Получает уведомления о создании отзывов пользователями',
  })
  @ApiBody({ type: ReviewEventDto })
  @ApiResponse({
    status: 200,
    description: 'Событие успешно обработано',
  })
  async handleReviewCreated(
    @Body() eventData: ReviewEventDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Received review created event for user ${eventData.userId}, review ${eventData.reviewId}`,
    );

    try {
      await this.eventService.handleReviewCreated(eventData.userId, eventData.reviewId);

      return {
        success: true,
        message: 'Review created event processed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to process review created event:`, error);
      throw error;
    }
  }

  /**
   * Webhook endpoint for Social Service events
   */
  @Post('social/friend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook для социальных событий от Social Service',
    description: 'Получает уведомления о добавлении/удалении друзей',
  })
  @ApiBody({ type: SocialEventDto })
  @ApiResponse({
    status: 200,
    description: 'Событие успешно обработано',
  })
  async handleSocialEvent(
    @Body() eventData: SocialEventDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Received social event ${eventData.eventType} for user ${eventData.userId}, friend ${eventData.friendId}`,
    );

    try {
      if (eventData.eventType === 'friend_added') {
        await this.eventService.handleFriendAdded(eventData.userId, eventData.friendId);
      }
      // Note: friend_removed events don't trigger achievements in MVP

      return {
        success: true,
        message: 'Social event processed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to process social event:`, error);
      throw error;
    }
  }

  /**
   * Webhook endpoint for Library Service events
   */
  @Post('library/update')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Webhook для событий библиотеки от Library Service',
    description: 'Получает уведомления об изменениях в библиотеке пользователя',
  })
  @ApiBody({ type: LibraryEventDto })
  @ApiResponse({
    status: 200,
    description: 'Событие успешно обработано',
  })
  async handleLibraryUpdate(
    @Body() eventData: LibraryEventDto,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.log(
      `Received library update event for user ${eventData.userId}, game ${eventData.gameId}, action ${eventData.action}`,
    );

    try {
      if (eventData.action === 'added') {
        // Trigger game purchase achievement logic
        await this.eventService.handleGamePurchase(eventData.userId, eventData.gameId);
      }
      // Note: removed games don't affect achievements in MVP

      return {
        success: true,
        message: 'Library update event processed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to process library update event:`, error);
      throw error;
    }
  }

  /**
   * Health check endpoint for integration webhooks
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check для integration endpoints',
    description: 'Проверка доступности webhook endpoints',
  })
  @ApiResponse({
    status: 200,
    description: 'Integration endpoints работают корректно',
  })
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
