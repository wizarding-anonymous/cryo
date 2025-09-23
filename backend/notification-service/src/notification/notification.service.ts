import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { NotificationSettings } from '../entities/notification-settings.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CreateNotificationDto,
  GetNotificationsDto,
  NotificationDto,
  NotificationSettingsDto,
  PaginatedNotificationsDto,
  UpdateNotificationSettingsDto,
} from './dto';
import { NotificationChannel, NotificationType } from '../common/enums';
import { EmailService } from './email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly settingsCacheTtlSeconds = 3600;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationSettings)
    private readonly settingsRepository: Repository<NotificationSettings>,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly emailService: EmailService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async createNotification(
    dto: CreateNotificationDto,
  ): Promise<NotificationDto | null> {
    const settings = await this.settingsRepository.findOne({
      where: { userId: dto.userId },
    });

    const canNotifyInApp = settings ? settings.inAppNotifications : true;
    const canNotifyByEmail = settings ? settings.emailNotifications : true;

    if (!canNotifyInApp && !canNotifyByEmail) {
      this.logger.log(
        `User ${dto.userId} has all notifications disabled. Skipping.`,
      );
      return null;
    }

    if (settings) {
      let suppressed = false;
      switch (dto.type) {
        case NotificationType.FRIEND_REQUEST:
          suppressed = !settings.friendRequests;
          break;
        case NotificationType.GAME_UPDATE:
          suppressed = !settings.gameUpdates;
          break;
        case NotificationType.ACHIEVEMENT:
          suppressed = !settings.achievements;
          break;
        case NotificationType.PURCHASE:
          suppressed = !settings.purchases;
          break;
        case NotificationType.SYSTEM:
          suppressed = !settings.systemNotifications;
          break;
        default:
          suppressed = false;
      }

      if (suppressed) {
        this.logger.log(
          `Notification type "${dto.type}" is disabled for user ${dto.userId}. Skipping.`,
        );
        return null;
      }
    }

    const requestedChannels = dto.channels ?? [NotificationChannel.IN_APP];
    const targetChannels = requestedChannels.filter((channel) => {
      if (channel === NotificationChannel.EMAIL && !canNotifyByEmail) {
        return false;
      }
      if (channel === NotificationChannel.IN_APP && !canNotifyInApp) {
        return false;
      }
      return true;
    });

    const notification = this.notificationRepository.create({
      ...dto,
      channels: targetChannels,
    });
    const savedNotification = await this.notificationRepository.save(notification);

    if (targetChannels.includes(NotificationChannel.EMAIL)) {
      await this.trySendEmail(savedNotification);
    }

    this.logger.log(
      `Successfully created notification ${savedNotification.id} for user ${savedNotification.userId}`,
    );

    return this.toNotificationDto(savedNotification);
  }

  async getUserNotifications(
    userId: string,
    query: GetNotificationsDto,
  ): Promise<PaginatedNotificationsDto> {
    const { limit = 20, offset = 0, type, isRead } = query;

    const where: FindOptionsWhere<Notification> = { userId };
    if (type) {
      where.type = type;
    }
    if (isRead !== undefined) {
      where.isRead = isRead;
    }

    const [data, total] = await this.notificationRepository.findAndCount({
      where,
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    return {
      data: data.map((notification) => this.toNotificationDto(notification)),
      total,
      limit,
      offset,
    };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    const result = await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );

    if (result.affected === 0) {
      throw new NotFoundException(
        `Notification with ID "${notificationId}" not found or user does not have permission.`,
      );
    }
  }

  async getSettings(userId: string): Promise<NotificationSettingsDto> {
    const cacheKey = this.settingsCacheKey(userId);
    const cachedSettings = await this.cacheManager.get<NotificationSettingsDto>(
      cacheKey,
    );

    if (cachedSettings) {
      this.logger.log(`Cache HIT for user ${userId} settings.`);
      return cachedSettings;
    }

    this.logger.log(`Cache MISS for user ${userId} settings.`);
    const settingsEntity = await this.loadOrCreateSettingsEntity(userId);
    const dto = this.toSettingsDto(settingsEntity);
    await this.cacheManager.set(cacheKey, dto, this.settingsCacheTtlSeconds);
    return dto;
  }

  async updateSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettingsDto> {
    const settingsEntity = await this.loadOrCreateSettingsEntity(userId);
    Object.assign(settingsEntity, dto);

    const updatedSettings = await this.settingsRepository.save(settingsEntity);
    const settingsDto = this.toSettingsDto(updatedSettings);

    this.logger.log(`Updated settings for user ${userId}.`);

    await this.cacheManager.set(
      this.settingsCacheKey(userId),
      settingsDto,
      this.settingsCacheTtlSeconds,
    );

    return settingsDto;
  }

  private async trySendEmail(notification: Notification): Promise<void> {
    try {
      const userServiceUrl = this.configService.get<string>('USER_SERVICE_URL');
      if (!userServiceUrl) {
        this.logger.error(
          'USER_SERVICE_URL is not configured. Cannot send email.',
        );
        return;
      }

      const { data: user } = await firstValueFrom(
        this.httpService.get<{ email: string }>(
          `${userServiceUrl}/api/users/${notification.userId}`,
        ),
      );

      if (user?.email) {
        await this.emailService.sendNotificationEmail(user.email, notification);
      } else {
        this.logger.warn(
          `Could not find email for user ${notification.userId}. Skipping email notification.`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to fetch user data for email notification for user ${notification.userId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async loadOrCreateSettingsEntity(
    userId: string,
  ): Promise<NotificationSettings> {
    let settings = await this.settingsRepository.findOne({ where: { userId } });

    if (!settings) {
      this.logger.log(
        `No settings found for user ${userId}. Creating default settings.`,
      );
      settings = this.settingsRepository.create({ userId });
      settings = await this.settingsRepository.save(settings);
    }

    return settings;
  }

  private settingsCacheKey(userId: string): string {
    return `settings:${userId}`;
  }

  private toNotificationDto(notification: Notification): NotificationDto {
    return {
      id: notification.id,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      isRead: notification.isRead,
      priority: notification.priority,
      metadata: notification.metadata ?? undefined,
      channels: notification.channels ?? undefined,
      createdAt: notification.createdAt,
    };
  }

  private toSettingsDto(
    settings: NotificationSettings,
  ): NotificationSettingsDto {
    return {
      id: settings.id,
      userId: settings.userId,
      inAppNotifications: settings.inAppNotifications,
      emailNotifications: settings.emailNotifications,
      friendRequests: settings.friendRequests,
      gameUpdates: settings.gameUpdates,
      achievements: settings.achievements,
      purchases: settings.purchases,
      systemNotifications: settings.systemNotifications,
      updatedAt: settings.updatedAt,
    };
  }
}
