import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';
import { UpdatePreferencesDto } from '../user/dto/update-preferences.dto';
import { UpdatePrivacySettingsDto } from '../user/dto/update-privacy-settings.dto';
import { CacheService } from '../common/cache/cache.service';
import { UserPreferences, PrivacySettings } from '../user/interfaces';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Get user profile by ID
   * @param userId - User ID
   * @returns User profile without password
   */
  async getProfile(userId: string) {
    const user = await this.userService.findByIdWithoutPassword(userId);
    if (!user) {
      throw new NotFoundException(
        `Профиль пользователя с ID ${userId} не найден`,
      );
    }
    return user;
  }

  /**
   * Update user profile
   * @param userId - User ID
   * @param updateProfileDto - Profile update data
   * @returns Updated user profile
   */
  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const updatedUser = await this.userService.update(userId, updateProfileDto);

    // Invalidate profile cache
    await this.cacheService.invalidateProfile(userId);

    // Return user without password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Delete user profile (soft delete)
   * @param userId - User ID
   */
  async deleteProfile(userId: string) {
    await this.userService.deleteUser(userId);

    // Clean up avatar file if exists
    const user = await this.userService.findById(userId);
    if (user?.avatarUrl) {
      await this.deleteAvatarFile(user.avatarUrl);
    }
  }

  /**
   * Upload user avatar
   * @param userId - User ID
   * @param file - Uploaded file
   * @returns Avatar URL
   */
  async uploadAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatarUrl: string; message: string }> {
    if (!file) {
      throw new BadRequestException('Файл аватара не предоставлен');
    }

    // Get current user to check for existing avatar
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }

    // Delete old avatar file if exists
    if (user.avatarUrl) {
      await this.deleteAvatarFile(user.avatarUrl);
    }

    // Generate avatar URL (in production, this would be a CDN URL)
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    // Update user with new avatar URL
    await this.userService.update(userId, { avatarUrl });

    // Invalidate cache
    await this.cacheService.invalidateUser(userId);
    await this.cacheService.invalidateProfile(userId);

    this.logger.log(`Avatar uploaded for user ${userId}: ${avatarUrl}`);

    return {
      avatarUrl,
      message: 'Аватар успешно загружен',
    };
  }

  /**
   * Delete user avatar
   * @param userId - User ID
   */
  async deleteAvatar(userId: string): Promise<{ message: string }> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }

    if (!user.avatarUrl) {
      throw new BadRequestException('У пользователя нет аватара для удаления');
    }

    // Delete avatar file
    await this.deleteAvatarFile(user.avatarUrl);

    // Update user to remove avatar URL
    await this.userService.update(userId, { avatarUrl: null });

    // Invalidate cache
    await this.cacheService.invalidateUser(userId);
    await this.cacheService.invalidateProfile(userId);

    this.logger.log(`Avatar deleted for user ${userId}`);

    return {
      message: 'Аватар успешно удален',
    };
  }

  /**
   * Get user preferences
   * @param userId - User ID
   * @returns User preferences
   */
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }
    return user.preferences || null;
  }

  /**
   * Update user preferences
   * @param userId - User ID
   * @param updatePreferencesDto - Preferences update data
   * @returns Updated preferences
   */
  async updatePreferences(
    userId: string,
    updatePreferencesDto: UpdatePreferencesDto,
  ): Promise<UserPreferences> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }

    // Merge existing preferences with updates
    const updatedPreferences: UserPreferences = {
      ...user.preferences,
      ...updatePreferencesDto,
      notifications: {
        ...user.preferences?.notifications,
        ...updatePreferencesDto.notifications,
      },
      gameSettings: {
        ...user.preferences?.gameSettings,
        ...updatePreferencesDto.gameSettings,
      },
    };

    // Update user with new preferences
    await this.userService.update(userId, { preferences: updatedPreferences });

    // Invalidate cache
    await this.cacheService.invalidateUser(userId);
    await this.cacheService.invalidateProfile(userId);

    this.logger.log(`Preferences updated for user ${userId}`);

    return updatedPreferences;
  }

  /**
   * Get user privacy settings
   * @param userId - User ID
   * @returns Privacy settings
   */
  async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }
    return user.privacySettings || null;
  }

  /**
   * Update user privacy settings
   * @param userId - User ID
   * @param updatePrivacySettingsDto - Privacy settings update data
   * @returns Updated privacy settings
   */
  async updatePrivacySettings(
    userId: string,
    updatePrivacySettingsDto: UpdatePrivacySettingsDto,
  ): Promise<PrivacySettings> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new NotFoundException(`Пользователь с ID ${userId} не найден`);
    }

    // Merge existing privacy settings with updates
    const updatedPrivacySettings: PrivacySettings = {
      ...user.privacySettings,
      ...updatePrivacySettingsDto,
    };

    // Update user with new privacy settings
    await this.userService.update(userId, {
      privacySettings: updatedPrivacySettings,
    });

    // Invalidate cache
    await this.cacheService.invalidateUser(userId);
    await this.cacheService.invalidateProfile(userId);

    this.logger.log(`Privacy settings updated for user ${userId}`);

    return updatedPrivacySettings;
  }

  /**
   * Delete avatar file from filesystem
   * @param avatarUrl - Avatar URL
   */
  private async deleteAvatarFile(avatarUrl: string): Promise<void> {
    try {
      // Extract filename from URL
      const filename = avatarUrl.split('/').pop();
      if (!filename) return;

      const filePath = join(process.cwd(), 'uploads', 'avatars', filename);

      if (existsSync(filePath)) {
        await unlink(filePath);
        this.logger.log(`Avatar file deleted: ${filePath}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to delete avatar file: ${(error as Error).message}`,
      );
      // Don't throw error - file deletion failure shouldn't break the operation
    }
  }
}
