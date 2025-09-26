import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  CreateNotificationDto,
  GetNotificationsDto,
  NotificationDto,
  NotificationSettingsDto,
  PaginatedNotificationsDto,
  UpdateNotificationSettingsDto,
  GameCatalogEventDto,
  LibraryEventDto,
  PaymentEventDto,
  SocialEventDto,
  AchievementEventDto,
  ReviewEventDto,
} from './dto';
import { JwtAuthGuard, RolesGuard, Roles, Public } from '../auth';
import { NotificationType, NotificationChannel } from '../common/enums';
import { AuthenticatedRequest } from '../common/interfaces';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) { }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get notifications for a user' })
  @ApiOkResponse({ type: PaginatedNotificationsDto })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  async getUserNotifications(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Query() query: GetNotificationsDto,
  ): Promise<PaginatedNotificationsDto> {
    this.logger.log(
      `User ${req.user.id} requesting notifications for user ${userId}`,
    );

    // Users can only access their own notifications unless they are admin
    if (req.user.id !== userId && !req.user.isAdmin) {
      this.logger.warn(
        `User ${req.user.id} attempted to access notifications for user ${userId} without permission`,
      );
      throw new ForbiddenException(
        'You can only access your own notifications',
      );
    }

    const result = await this.notificationService.getUserNotifications(
      userId,
      query,
    );
    this.logger.log(
      `Successfully retrieved ${result.data.length} notifications for user ${userId}`,
    );

    return result;
  }

  @Get('settings/:userId')
  @ApiOperation({ summary: 'Get notification settings for a user' })
  @ApiOkResponse({ type: NotificationSettingsDto })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  async getSettings(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<NotificationSettingsDto> {
    this.logger.log(
      `User ${req.user.id} requesting settings for user ${userId}`,
    );

    // Users can only access their own settings unless they are admin
    if (req.user.id !== userId && !req.user.isAdmin) {
      this.logger.warn(
        `User ${req.user.id} attempted to access settings for user ${userId} without permission`,
      );
      throw new ForbiddenException('You can only access your own settings');
    }

    const result = await this.notificationService.getSettings(userId);
    this.logger.log(`Successfully retrieved settings for user ${userId}`);

    return result;
  }

  @Put('settings/:userId')
  @ApiOperation({ summary: 'Update notification settings for a user' })
  @ApiOkResponse({ type: NotificationSettingsDto })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  async updateSettings(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
    @Body() updateDto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    this.logger.log(`User ${req.user.id} updating settings for user ${userId}`);

    // Users can only update their own settings unless they are admin
    if (req.user.id !== userId && !req.user.isAdmin) {
      this.logger.warn(
        `User ${req.user.id} attempted to update settings for user ${userId} without permission`,
      );
      throw new ForbiddenException('You can only update your own settings');
    }

    const result = await this.notificationService.updateSettings(
      userId,
      updateDto,
    );
    this.logger.log(`Successfully updated settings for user ${userId}`);

    return result;
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiNoContentResponse({
    description: 'Notification marked as read successfully.',
  })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiParam({ name: 'id', description: 'The ID of the notification' })
  async markAsRead(
    @Req() req: AuthenticatedRequest,
    @Param('id') notificationId: string,
  ): Promise<void> {
    const userId = req.user.id;
    this.logger.log(
      `User ${userId} marking notification ${notificationId} as read`,
    );

    await this.notificationService.markAsRead(notificationId, userId);
    this.logger.log(
      `Successfully marked notification ${notificationId} as read for user ${userId}`,
    );
  }

  // This endpoint is for direct creation, e.g. from an admin panel or for testing
  @Post()
  @Roles('admin')
  @ApiOperation({ summary: 'Create a notification directly (Admin only)' })
  @ApiCreatedResponse({ type: NotificationDto })
  @ApiForbiddenResponse({ description: 'Admin access required.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async createNotification(
    @Req() req: AuthenticatedRequest,
    @Body() createDto: CreateNotificationDto,
  ): Promise<NotificationDto | null> {
    this.logger.log(
      `Admin ${req.user.id} creating notification for user ${createDto.userId}`,
    );

    const result = await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully created notification ${result?.id} for user ${createDto.userId}`,
    );

    return result;
  }

  // --- Specialized Webhook Endpoints for MVP Services (Public - no authentication required) ---

  @Post('webhook/payment/completed')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for payment completion events from Payment Service',
  })
  @ApiAcceptedResponse({ description: 'Payment completion event accepted' })
  async handlePaymentCompletedWebhook(
    @Body() eventDto: PaymentEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received payment completed webhook for user ${eventDto.userId}, payment: ${eventDto.data.paymentId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.PURCHASE,
      title: 'Покупка успешно завершена',
      message: `Ваша покупка игры "${eventDto.data.gameName}" на сумму ${eventDto.data.amount} ${eventDto.data.currency} успешно завершена. Игра добавлена в вашу библиотеку.`,
      metadata: {
        paymentId: eventDto.data.paymentId,
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        amount: eventDto.data.amount,
        currency: eventDto.data.currency,
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed payment completed webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/payment/failed')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for payment failure events from Payment Service',
  })
  @ApiAcceptedResponse({ description: 'Payment failure event accepted' })
  async handlePaymentFailedWebhook(
    @Body() eventDto: PaymentEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received payment failed webhook for user ${eventDto.userId}, payment: ${eventDto.data.paymentId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.PURCHASE,
      title: 'Ошибка при оплате',
      message: `Не удалось завершить покупку игры "${eventDto.data.gameName}". ${eventDto.data.errorMessage || 'Попробуйте еще раз или обратитесь в поддержку.'}`,
      metadata: {
        paymentId: eventDto.data.paymentId,
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        amount: eventDto.data.amount,
        currency: eventDto.data.currency,
        errorMessage: eventDto.data.errorMessage,
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed payment failed webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/social/friend-request')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for friend request events from Social Service',
  })
  @ApiAcceptedResponse({ description: 'Friend request event accepted' })
  async handleFriendRequestWebhook(
    @Body() eventDto: SocialEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received friend request webhook for user ${eventDto.userId} from ${eventDto.data.fromUserId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.FRIEND_REQUEST,
      title: 'Новая заявка в друзья',
      message: `Пользователь ${eventDto.data.fromUserName} хочет добавить вас в друзья. Примите или отклоните заявку в разделе "Друзья".`,
      metadata: {
        fromUserId: eventDto.data.fromUserId,
        fromUserName: eventDto.data.fromUserName,
      },
      channels: [NotificationChannel.IN_APP],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed friend request webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/social/friend-accepted')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for friend acceptance events from Social Service',
  })
  @ApiAcceptedResponse({ description: 'Friend acceptance event accepted' })
  async handleFriendAcceptedWebhook(
    @Body() eventDto: SocialEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received friend accepted webhook for user ${eventDto.userId} from ${eventDto.data.fromUserId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.FRIEND_REQUEST,
      title: 'Заявка в друзья принята',
      message: `${eventDto.data.fromUserName} принял вашу заявку в друзья! Теперь вы можете играть вместе и обмениваться сообщениями.`,
      metadata: {
        fromUserId: eventDto.data.fromUserId,
        fromUserName: eventDto.data.fromUserName,
      },
      channels: [NotificationChannel.IN_APP],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed friend accepted webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/social/message')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Webhook for message events from Social Service' })
  @ApiAcceptedResponse({ description: 'Message event accepted' })
  async handleMessageWebhook(
    @Body() eventDto: SocialEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received message webhook for user ${eventDto.userId} from ${eventDto.data.fromUserId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.SYSTEM,
      title: 'Новое сообщение',
      message: `${eventDto.data.fromUserName}: ${eventDto.data.messagePreview || 'Отправил вам сообщение'}`,
      metadata: {
        fromUserId: eventDto.data.fromUserId,
        fromUserName: eventDto.data.fromUserName,
        messageId: eventDto.data.messageId,
        messagePreview: eventDto.data.messagePreview,
      },
      channels: [NotificationChannel.IN_APP],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed message webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/achievement/unlocked')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for achievement unlock events from Achievement Service',
  })
  @ApiAcceptedResponse({ description: 'Achievement unlock event accepted' })
  async handleAchievementUnlockedWebhook(
    @Body() eventDto: AchievementEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received achievement unlocked webhook for user ${eventDto.userId}, achievement: ${eventDto.data.achievementId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.ACHIEVEMENT,
      title: 'Достижение разблокировано!',
      message: `Поздравляем! Вы получили достижение "${eventDto.data.achievementName}" в игре "${eventDto.data.gameName}". ${eventDto.data.achievementDescription}${eventDto.data.points ? ` (+${eventDto.data.points} очков)` : ''}`,
      metadata: {
        achievementId: eventDto.data.achievementId,
        achievementName: eventDto.data.achievementName,
        achievementDescription: eventDto.data.achievementDescription,
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        points: eventDto.data.points,
      },
      channels: [NotificationChannel.IN_APP],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed achievement unlocked webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/review/created')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for review creation events from Review Service',
  })
  @ApiAcceptedResponse({ description: 'Review creation event accepted' })
  async handleReviewCreatedWebhook(
    @Body() eventDto: ReviewEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received review created webhook for user ${eventDto.userId}, review: ${eventDto.data.reviewId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.SYSTEM,
      title: 'Новый отзыв на игру',
      message: `${eventDto.data.reviewerName} оставил отзыв (${eventDto.data.rating}/5 звезд) на игру "${eventDto.data.gameName}". Посмотрите, что думают другие игроки!`,
      metadata: {
        reviewId: eventDto.data.reviewId,
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        reviewerName: eventDto.data.reviewerName,
        rating: eventDto.data.rating,
      },
      channels: [NotificationChannel.IN_APP],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed review created webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/game-catalog/updated')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for game update events from Game Catalog Service',
  })
  @ApiAcceptedResponse({ description: 'Game update event accepted' })
  async handleGameUpdatedWebhook(
    @Body() eventDto: GameCatalogEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received game updated webhook for user ${eventDto.userId}, game: ${eventDto.data.gameId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.GAME_UPDATE,
      title: `Обновление игры: ${eventDto.data.gameName}`,
      message: `Доступно обновление ${eventDto.data.version || 'новой версии'} для игры "${eventDto.data.gameName}". ${eventDto.data.updateType === 'patch' ? 'Исправления и улучшения' : 'Новый контент'} уже ждут вас!`,
      metadata: {
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        updateType: eventDto.data.updateType,
        version: eventDto.data.version,
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed game updated webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/game-catalog/sale-started')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for game sale events from Game Catalog Service',
  })
  @ApiAcceptedResponse({ description: 'Game sale event accepted' })
  async handleGameSaleStartedWebhook(
    @Body() eventDto: GameCatalogEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received game sale started webhook for user ${eventDto.userId}, game: ${eventDto.data.gameId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.GAME_UPDATE,
      title: `Скидка на игру: ${eventDto.data.gameName}`,
      message: `Скидка ${eventDto.data.saleDiscount || 0}% на игру "${eventDto.data.gameName}"! Не упустите возможность приобрести игру по выгодной цене.`,
      metadata: {
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        saleDiscount: eventDto.data.saleDiscount,
      },
      channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed game sale started webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/library/game-added')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for game addition events from Library Service',
  })
  @ApiAcceptedResponse({ description: 'Game addition event accepted' })
  async handleLibraryGameAddedWebhook(
    @Body() eventDto: LibraryEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received library game added webhook for user ${eventDto.userId}, game: ${eventDto.data.gameId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.SYSTEM,
      title: 'Игра добавлена в библиотеку',
      message: `Игра "${eventDto.data.gameName}" успешно добавлена в вашу библиотеку. Теперь вы можете скачать и играть!`,
      metadata: {
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        addedAt: eventDto.data.addedAt,
      },
      channels: [NotificationChannel.IN_APP],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed library game added webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  @Post('webhook/library/game-removed')
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Webhook for game removal events from Library Service',
  })
  @ApiAcceptedResponse({ description: 'Game removal event accepted' })
  async handleLibraryGameRemovedWebhook(
    @Body() eventDto: LibraryEventDto,
  ): Promise<{ status: string }> {
    this.logger.log(
      `Received library game removed webhook for user ${eventDto.userId}, game: ${eventDto.data.gameId}`,
    );

    const createDto: CreateNotificationDto = {
      userId: eventDto.userId,
      type: NotificationType.SYSTEM,
      title: 'Игра удалена из библиотеки',
      message: `Игра "${eventDto.data.gameName}" была удалена из вашей библиотеки.`,
      metadata: {
        gameId: eventDto.data.gameId,
        gameName: eventDto.data.gameName,
        removedAt: eventDto.data.removedAt,
      },
      channels: [NotificationChannel.IN_APP],
    };

    await this.notificationService.createNotification(createDto);
    this.logger.log(
      `Successfully processed library game removed webhook for user ${eventDto.userId}`,
    );

    return { status: 'accepted' };
  }

  // --- Statistics and Bulk Operations Endpoints ---

  @Get('stats/:userId')
  @ApiOperation({ summary: 'Get notification statistics for a user' })
  @ApiOkResponse({
    description: 'User notification statistics',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        unread: { type: 'number' },
        byType: {
          type: 'object',
          additionalProperties: { type: 'number' },
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  async getUserStats(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<{
    total: number;
    unread: number;
    byType: Record<NotificationType, number>;
  }> {
    this.logger.log(`User ${req.user.id} requesting stats for user ${userId}`);

    // Users can only access their own stats unless they are admin
    if (req.user.id !== userId && !req.user.isAdmin) {
      this.logger.warn(
        `User ${req.user.id} attempted to access stats for user ${userId} without permission`,
      );
      throw new ForbiddenException('You can only access your own statistics');
    }

    const result =
      await this.notificationService.getUserNotificationStats(userId);
    this.logger.log(`Successfully retrieved stats for user ${userId}`);

    return result;
  }

  @Post('bulk')
  @Roles('admin')
  @ApiOperation({
    summary: 'Create bulk notifications for multiple users (Admin only)',
  })
  @ApiCreatedResponse({
    description: 'Bulk notification results',
    schema: {
      type: 'object',
      properties: {
        created: { type: 'number' },
        skipped: { type: 'number' },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Admin access required.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async createBulkNotifications(
    @Req() req: AuthenticatedRequest,
    @Body()
    bulkDto: {
      userIds: string[];
      notification: Omit<CreateNotificationDto, 'userId'>;
    },
  ): Promise<{ created: number; skipped: number }> {
    this.logger.log(
      `Admin ${req.user.id} creating bulk notifications for ${bulkDto.userIds.length} users`,
    );

    const result = await this.notificationService.createBulkNotifications(
      bulkDto.userIds,
      bulkDto.notification,
    );

    this.logger.log(
      `Successfully processed bulk notifications: ${result.created} created, ${result.skipped} skipped`,
    );

    return result;
  }

  // --- Cache Management Endpoints (Admin only) ---

  @Get('cache/stats')
  @Roles('admin')
  @ApiOperation({ summary: 'Get cache statistics (Admin only)' })
  @ApiOkResponse({
    description: 'Cache statistics',
    schema: {
      type: 'object',
      properties: {
        redisConnected: { type: 'boolean' },
        cacheKeys: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Admin access required.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  async getCacheStats(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ redisConnected: boolean; cacheKeys?: string[] }> {
    this.logger.log(`Admin ${req.user.id} requesting cache statistics`);

    const result = await this.notificationService.getCacheStats();
    this.logger.log(
      `Successfully retrieved cache statistics for admin ${req.user.id}`,
    );

    return result;
  }

  @Post('cache/clear/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear cache for a specific user' })
  @ApiNoContentResponse({ description: 'Cache cleared successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  async clearUserCache(
    @Req() req: AuthenticatedRequest,
    @Param('userId') userId: string,
  ): Promise<void> {
    this.logger.log(
      `User ${req.user.id} requesting cache clear for user ${userId}`,
    );

    // Only allow users to clear their own cache or admin users
    if (req.user.id !== userId && !req.user.isAdmin) {
      this.logger.warn(
        `User ${req.user.id} attempted to clear cache for user ${userId} without permission`,
      );
      throw new ForbiddenException('You can only clear your own cache');
    }

    await this.notificationService.clearSettingsCache(userId);
    this.logger.log(`Successfully cleared cache for user ${userId}`);
  }
}
