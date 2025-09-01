import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';

// These interfaces would be defined in a more central place in a real app
interface PrivacySettings {
  profileVisibility: 'public' | 'friends' | 'private';
  showEmail: boolean;
  showRealName: boolean;
}
interface NotificationSettings {
  emailNotifications: boolean;
  pushNotifications: boolean;
  gameInvites: boolean;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async updatePrivacySettings(userId: string, settings: Partial<PrivacySettings>): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    const updatedSettings = {
      ...(user.privacySettings as object),
      ...settings,
    };

    await this.userRepository.update(userId, {
      privacySettings: updatedSettings,
    });

    this.logger.log(`🔒 Privacy settings updated for user ${userId}`);
  }

  async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    const updatedSettings = {
      ...(user.notificationSettings as object),
      ...settings,
    };

    await this.userRepository.update(userId, {
      notificationSettings: updatedSettings,
    });

    this.logger.log(`🔔 Notification settings updated for user ${userId}`);
  }
}
