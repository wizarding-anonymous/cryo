import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Notification } from '../../entities/notification.entity';
import { NotificationSettings } from '../../entities/notification-settings.entity';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  CreateNotificationDto,
  GetNotificationsDto,
  PaginatedNotificationsDto,
  UpdateNotificationSettingsDto,
} from './dto';
import { NotificationChannel, NotificationType } from '../../common/enums';
import { EmailService } from './email.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

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
  ): Promise<Notification | null> {
    const settings = await this.settingsRepository.findOne({
      where: { userId: dto.userId },
    });

    // Default to true if settings don't exist for the user yet
    const canNotifyInApp = settings ? settings.inAppNotifications : true;
    const canNotifyByEmail = settings ? settings.emailNotifications : true;

    if (!canNotifyInApp && !canNotifyByEmail) {
      this.logger.log(
        `User ${dto.userId} has all notifications disabled. Skipping.`,
      );
      return null;
    }

    // Check notification type specific settings
    if (settings) {
      let suppressed = false;
      switch (dto.type) {
        case NotificationType.FRIEND_REQUEST:
          if (!settings.friendRequests) suppressed = true;
          break;
        case NotificationType.GAME_UPDATE:
          if (!settings.gameUpdates) suppressed = true;
          break;
        case NotificationType.ACHIEVEMENT:
          if (!settings.achievements) suppressed = true;
          break;
        case NotificationType.PURCHASE:
          if (!settings.purchases) suppressed = true;
          break;
        case NotificationType.SYSTEM:
          if (!settings.systemNotifications) suppressed = true;
          break;
      }
      if (suppressed) {
        this.logger.log(
          `Notification type "${dto.type}" is disabled for user ${dto.userId}. Skipping.`,
        );
        return null;
      }
    }

    const notification = this.notificationRepository.create(dto);
    const savedNotification = await this.notificationRepository.save(
      notification,
    );

    // Determine target channels based on user settings and request
    const targetChannels =
      dto.channels?.filter((channel) => {
        if (channel === NotificationChannel.EMAIL && !canNotifyByEmail) {
          return false;
        }
        if (channel === NotificationChannel.IN_APP && !canNotifyInApp) {
          return false;
        }
        return true;
      }) || [];

    if (targetChannels.includes(NotificationChannel.EMAIL)) {
      try {
        const userServiceUrl =
          this.configService.get<string>('USER_SERVICE_URL');
        if (!userServiceUrl) {
          this.logger.error(
            'USER_SERVICE_URL is not configured. Cannot send email.',
          );
          return savedNotification;
        }

        const { data: user } = await firstValueFrom(
          this.httpService.get<{ email: string }>(
            `${userServiceUrl}/api/users/${dto.userId}`,
          ),
        );

        if (user && user.email) {
          await this.emailService.sendNotificationEmail(
            user.email,
            savedNotification,
          );
        } else {
          this.logger.warn(
            `Could not find email for user ${dto.userId}. Skipping email notification.`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to fetch user data for email notification for user ${dto.userId}`,
          error.stack,
        );
      }
    }

    this.logger.log(
      `Successfully created notification ${savedNotification.id} for user ${savedNotification.userId}`,
    );

    return savedNotification;
  }

  async getUserNotifications(
    userId:string,
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
      order: {
        createdAt: 'DESC',
      },
    });

    return {
      data,
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

  async getSettings(userId: string): Promise<NotificationSettings> {
    const cacheKey = `settings:${userId}`;
    const cachedSettings = await this.cacheManager.get<string>(cacheKey);

    if (cachedSettings) {
      this.logger.log(`Cache HIT for user ${userId} settings.`);
      return JSON.parse(cachedSettings);
    }

    this.logger.log(`Cache MISS for user ${userId} settings.`);
    let settings = await this.settingsRepository.findOne({ where: { userId } });

    if (!settings) {
      this.logger.log(
        `No settings found for user ${userId}. Creating default settings.`,
      );
      settings = this.settingsRepository.create({ userId });
      await this.settingsRepository.save(settings);
    }

    await this.cacheManager.set(cacheKey, JSON.stringify(settings), 3600); // 1 hour TTL
    return settings;
  }

  async updateSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettings> {
    const settings = await this.getSettings(userId);

    Object.assign(settings, dto);

    const updatedSettings = await this.settingsRepository.save(settings);

    this.logger.log(`Updated settings for user ${userId}.`);

    // Invalidate cache
    const cacheKey = `settings:${userId}`;
    await this.cacheManager.del(cacheKey);
    this.logger.log(`Invalidated cache for user ${userId} settings.`);

    return updatedSettings;
  }
}
