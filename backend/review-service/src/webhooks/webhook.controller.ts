import {
  Controller,
  Post,
  Body,
  HttpStatus,
  Logger,
  UseGuards,
  Headers,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { WebhookService } from './webhook.service';
import { WebhookAuthGuard } from '../guards';
import {
  AchievementWebhookDto,
  NotificationWebhookDto,
  GameCatalogWebhookDto,
  LibraryWebhookDto,
} from '../dto/webhook.dto';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('achievement/first-review')
  @UseGuards(WebhookAuthGuard)
  @ApiOperation({
    summary: 'Webhook для уведомления Achievement Service о первом отзыве',
    description: 'Получает уведомления от Achievement Service о разблокировке достижения "Первый отзыв"',
  })
  @ApiHeader({
    name: 'X-Webhook-Secret',
    description: 'Секретный ключ для аутентификации webhook',
    required: true,
  })
  @ApiBody({ type: AchievementWebhookDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook успешно обработан',
    schema: {
      example: {
        success: true,
        message: 'Achievement webhook processed successfully',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Неверный секретный ключ',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Некорректные данные webhook',
  })
  async handleAchievementWebhook(
    @Body() webhookData: AchievementWebhookDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    this.logger.debug(`Received achievement webhook for user ${webhookData.userId}`);

    const result = await this.webhookService.processAchievementWebhook(webhookData);

    this.logger.log(`Achievement webhook processed successfully for user ${webhookData.userId}`);

    return {
      success: true,
      message: 'Achievement webhook processed successfully',
      timestamp: new Date().toISOString(),
      data: result,
    };
  }

  @Post('notification/review-action')
  @UseGuards(WebhookAuthGuard)
  @ApiOperation({
    summary: 'Webhook для уведомления Notification Service о действиях с отзывами',
    description: 'Получает подтверждения от Notification Service об отправке уведомлений',
  })
  @ApiHeader({
    name: 'X-Webhook-Secret',
    description: 'Секретный ключ для аутентификации webhook',
    required: true,
  })
  @ApiBody({ type: NotificationWebhookDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook успешно обработан',
    schema: {
      example: {
        success: true,
        message: 'Notification webhook processed successfully',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async handleNotificationWebhook(
    @Body() webhookData: NotificationWebhookDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    this.logger.debug(`Received notification webhook for review ${webhookData.reviewId}`);

    const result = await this.webhookService.processNotificationWebhook(webhookData);

    this.logger.log(`Notification webhook processed successfully for review ${webhookData.reviewId}`);

    return {
      success: true,
      message: 'Notification webhook processed successfully',
      timestamp: new Date().toISOString(),
      data: result,
    };
  }

  @Post('game-catalog/rating-sync')
  @UseGuards(WebhookAuthGuard)
  @ApiOperation({
    summary: 'Webhook для синхронизации рейтингов с Game Catalog Service',
    description: 'Получает подтверждения от Game Catalog Service об обновлении рейтингов игр',
  })
  @ApiHeader({
    name: 'X-Webhook-Secret',
    description: 'Секретный ключ для аутентификации webhook',
    required: true,
  })
  @ApiBody({ type: GameCatalogWebhookDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook успешно обработан',
    schema: {
      example: {
        success: true,
        message: 'Game catalog webhook processed successfully',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async handleGameCatalogWebhook(
    @Body() webhookData: GameCatalogWebhookDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    this.logger.debug(`Received game catalog webhook for game ${webhookData.gameId}`);

    const result = await this.webhookService.processGameCatalogWebhook(webhookData);

    this.logger.log(`Game catalog webhook processed successfully for game ${webhookData.gameId}`);

    return {
      success: true,
      message: 'Game catalog webhook processed successfully',
      timestamp: new Date().toISOString(),
      data: result,
    };
  }

  @Post('library/ownership-change')
  @UseGuards(WebhookAuthGuard)
  @ApiOperation({
    summary: 'Webhook для уведомлений Library Service об изменениях владения играми',
    description: 'Получает уведомления от Library Service о покупке, возврате или удалении игр из библиотеки',
  })
  @ApiHeader({
    name: 'X-Webhook-Secret',
    description: 'Секретный ключ для аутентификации webhook',
    required: true,
  })
  @ApiBody({ type: LibraryWebhookDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Webhook успешно обработан',
    schema: {
      example: {
        success: true,
        message: 'Library webhook processed successfully',
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  async handleLibraryWebhook(
    @Body() webhookData: LibraryWebhookDto,
    @Headers('x-webhook-secret') secret: string,
  ) {
    this.logger.debug(`Received library webhook for user ${webhookData.userId}, game ${webhookData.gameId}`);

    const result = await this.webhookService.processLibraryWebhook(webhookData);

    this.logger.log(`Library webhook processed successfully for user ${webhookData.userId}, game ${webhookData.gameId}`);

    return {
      success: true,
      message: 'Library webhook processed successfully',
      timestamp: new Date().toISOString(),
      data: result,
    };
  }
}