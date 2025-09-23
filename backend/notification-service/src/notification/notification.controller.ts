import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  CreateNotificationDto,
  GetNotificationsDto,
  NotificationDto,
  NotificationSettingsDto,
  PaginatedNotificationsDto,
  UpdateNotificationSettingsDto,
} from './dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get notifications for a user' })
  @ApiOkResponse({ type: PaginatedNotificationsDto })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  getUserNotifications(
    @Req() req: any,
    @Param('userId') userId: string,
    @Query() query: GetNotificationsDto,
  ): Promise<PaginatedNotificationsDto> {
    if (req.user.id !== userId) {
      throw new ForbiddenException();
    }
    return this.notificationService.getUserNotifications(userId, query);
  }

  @Get('settings/:userId')
  @ApiOperation({ summary: 'Get notification settings for a user' })
  @ApiOkResponse({ type: NotificationSettingsDto })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  getSettings(
    @Req() req: any,
    @Param('userId') userId: string,
  ): Promise<NotificationSettingsDto> {
    if (req.user.id !== userId) {
      throw new ForbiddenException();
    }
    return this.notificationService.getSettings(userId);
  }

  @Put('settings/:userId')
  @ApiOperation({ summary: 'Update notification settings for a user' })
  @ApiOkResponse({ type: NotificationSettingsDto })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiParam({ name: 'userId', description: 'The ID of the user' })
  updateSettings(
    @Req() req: any,
    @Param('userId') userId: string,
    @Body() updateDto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    if (req.user.id !== userId) {
      throw new ForbiddenException();
    }
    return this.notificationService.updateSettings(userId, updateDto);
  }

  @Put(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiNoContentResponse({
    description: 'Notification marked as read successfully.',
  })
  @ApiForbiddenResponse({ description: 'Forbidden.' })
  @ApiParam({ name: 'id', description: 'The ID of the notification' })
  markAsRead(
    @Req() req: any,
    @Param('id') notificationId: string,
  ): Promise<void> {
    const userId = req.user.id;
    return this.notificationService.markAsRead(notificationId, userId);
  }

  // This endpoint is for direct creation, e.g. from an admin panel or for testing
  @Post()
  @ApiOperation({ summary: 'Create a notification directly' })
  @ApiCreatedResponse({ type: NotificationDto })
  async createNotification(
    @Body() createDto: CreateNotificationDto,
  ): Promise<NotificationDto | null> {
    return this.notificationService.createNotification(createDto);
  }

  // --- Webhook Endpoints ---

  @Post('webhook/payment')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Webhook for events from Payment Service' })
  @ApiAcceptedResponse({ description: 'Event accepted' })
  async handlePaymentWebhook(
    @Body() createDto: CreateNotificationDto,
  ): Promise<{ status: string }> {
    this.notificationService.createNotification(createDto);
    return { status: 'accepted' };
  }

  @Post('webhook/social')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Webhook for events from Social Service' })
  @ApiAcceptedResponse({ description: 'Event accepted' })
  async handleSocialWebhook(
    @Body() createDto: CreateNotificationDto,
  ): Promise<{ status: string }> {
    this.notificationService.createNotification(createDto);
    return { status: 'accepted' };
  }

  @Post('webhook/achievement')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Webhook for events from Achievement Service' })
  @ApiAcceptedResponse({ description: 'Event accepted' })
  async handleAchievementWebhook(
    @Body() createDto: CreateNotificationDto,
  ): Promise<{ status: string }> {
    this.notificationService.createNotification(createDto);
    return { status: 'accepted' };
  }

  @Post('webhook/review')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Webhook for events from Review Service' })
  @ApiAcceptedResponse({ description: 'Event accepted' })
  async handleReviewWebhook(
    @Body() createDto: CreateNotificationDto,
  ): Promise<{ status: string }> {
    this.notificationService.createNotification(createDto);
    return { status: 'accepted' };
  }
}
