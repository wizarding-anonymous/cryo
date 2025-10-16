import { Injectable, Logger } from '@nestjs/common';
import { EncryptionService } from '../../common/services/encryption.service';
import { UserPreferences, PrivacySettings } from '../interfaces';
import { User } from '../entities/user.entity';

@Injectable()
export class UserEncryptionService {
  private readonly logger = new Logger(UserEncryptionService.name);

  constructor(private readonly encryptionService: EncryptionService) {}

  /**
   * Encrypts user preferences before saving to database
   * @param preferences - User preferences to encrypt
   * @returns Encrypted preferences string or null
   */
  encryptPreferences(preferences: UserPreferences | null | undefined): string | null {
    if (!preferences) {
      return null;
    }

    try {
      return this.encryptionService.encryptObject(preferences);
    } catch (error) {
      this.logger.error('Failed to encrypt user preferences', error);
      throw new Error('Failed to encrypt user preferences');
    }
  }

  /**
   * Decrypts user preferences after loading from database
   * @param encryptedPreferences - Encrypted preferences string
   * @returns Decrypted preferences or null
   */
  decryptPreferences(encryptedPreferences: string | null | undefined): UserPreferences | null {
    if (!encryptedPreferences) {
      return null;
    }

    try {
      return this.encryptionService.decryptObject<UserPreferences>(encryptedPreferences);
    } catch (error) {
      this.logger.warn('Failed to decrypt user preferences, returning null', error);
      return null;
    }
  }

  /**
   * Encrypts privacy settings before saving to database
   * @param privacySettings - Privacy settings to encrypt
   * @returns Encrypted privacy settings string or null
   */
  encryptPrivacySettings(privacySettings: PrivacySettings | null | undefined): string | null {
    if (!privacySettings) {
      return null;
    }

    try {
      return this.encryptionService.encryptObject(privacySettings);
    } catch (error) {
      this.logger.error('Failed to encrypt privacy settings', error);
      throw new Error('Failed to encrypt privacy settings');
    }
  }

  /**
   * Decrypts privacy settings after loading from database
   * @param encryptedPrivacySettings - Encrypted privacy settings string
   * @returns Decrypted privacy settings or null
   */
  decryptPrivacySettings(encryptedPrivacySettings: string | null | undefined): PrivacySettings | null {
    if (!encryptedPrivacySettings) {
      return null;
    }

    try {
      return this.encryptionService.decryptObject<PrivacySettings>(encryptedPrivacySettings);
    } catch (error) {
      this.logger.warn('Failed to decrypt privacy settings, returning null', error);
      return null;
    }
  }

  /**
   * Prepares user entity for saving by encrypting sensitive fields
   * @param user - User entity to prepare
   * @returns User entity with encrypted sensitive fields
   */
  prepareUserForSave(user: Partial<User>): Partial<User> {
    const preparedUser = { ...user };

    // Encrypt preferences if provided
    if ('preferences' in user) {
      preparedUser.preferences = this.encryptPreferences(user.preferences) as any;
    }

    // Encrypt privacy settings if provided
    if ('privacySettings' in user) {
      preparedUser.privacySettings = this.encryptPrivacySettings(user.privacySettings) as any;
    }

    return preparedUser;
  }

  /**
   * Prepares user entity after loading by decrypting sensitive fields
   * @param user - User entity loaded from database
   * @returns User entity with decrypted sensitive fields
   */
  prepareUserAfterLoad(user: User): User {
    if (!user) {
      return user;
    }

    const preparedUser = { ...user };

    // Decrypt preferences if present
    if (user.preferences) {
      preparedUser.preferences = this.decryptPreferences(user.preferences as any);
    }

    // Decrypt privacy settings if present
    if (user.privacySettings) {
      preparedUser.privacySettings = this.decryptPrivacySettings(user.privacySettings as any);
    }

    return preparedUser;
  }

  /**
   * Prepares multiple user entities after loading by decrypting sensitive fields
   * @param users - Array of user entities loaded from database
   * @returns Array of user entities with decrypted sensitive fields
   */
  prepareUsersAfterLoad(users: User[]): User[] {
    return users.map(user => this.prepareUserAfterLoad(user));
  }

  /**
   * Safely updates encrypted fields in user entity
   * @param existingUser - Current user entity
   * @param updates - Updates to apply
   * @returns Updated user entity with properly encrypted fields
   */
  updateUserWithEncryption(existingUser: User, updates: Partial<User>): User {
    const updatedUser = { ...existingUser, ...updates };

    // Re-encrypt preferences if they were updated
    if ('preferences' in updates) {
      updatedUser.preferences = this.encryptPreferences(updates.preferences) as any;
    }

    // Re-encrypt privacy settings if they were updated
    if ('privacySettings' in updates) {
      updatedUser.privacySettings = this.encryptPrivacySettings(updates.privacySettings) as any;
    }

    return updatedUser;
  }
}