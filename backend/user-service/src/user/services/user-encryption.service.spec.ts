import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserEncryptionService } from './user-encryption.service';
import { EncryptionService } from '../../common/services/encryption.service';
import { UserPreferences, PrivacySettings } from '../interfaces';
import { User } from '../entities/user.entity';

describe('UserEncryptionService', () => {
  let service: UserEncryptionService;
  let encryptionService: EncryptionService;

  const mockPreferences: UserPreferences = {
    language: 'en',
    timezone: 'UTC',
    theme: 'dark',
    notifications: {
      email: true,
      push: false,
      sms: true,
    },
    gameSettings: {
      autoDownload: false,
      cloudSave: true,
      achievementNotifications: true,
    },
  };

  const mockPrivacySettings: PrivacySettings = {
    profileVisibility: 'friends',
    showOnlineStatus: true,
    showGameActivity: false,
    allowFriendRequests: true,
    showAchievements: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserEncryptionService,
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-encryption-key-32-chars-long'),
          },
        },
      ],
    }).compile();

    service = module.get<UserEncryptionService>(UserEncryptionService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('preferences encryption/decryption', () => {
    it('should encrypt and decrypt preferences correctly', () => {
      const encrypted = service.encryptPreferences(mockPreferences);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toContain('language');

      const decrypted = service.decryptPreferences(encrypted);
      expect(decrypted).toEqual(mockPreferences);
    });

    it('should handle null preferences', () => {
      expect(service.encryptPreferences(null)).toBeNull();
      expect(service.encryptPreferences(undefined)).toBeNull();
      expect(service.decryptPreferences(null)).toBeNull();
      expect(service.decryptPreferences(undefined)).toBeNull();
    });

    it('should handle invalid encrypted preferences gracefully', () => {
      const result = service.decryptPreferences('invalid-encrypted-data');
      expect(result).toBeNull();
    });
  });

  describe('privacy settings encryption/decryption', () => {
    it('should encrypt and decrypt privacy settings correctly', () => {
      const encrypted = service.encryptPrivacySettings(mockPrivacySettings);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toContain('profileVisibility');

      const decrypted = service.decryptPrivacySettings(encrypted);
      expect(decrypted).toEqual(mockPrivacySettings);
    });

    it('should handle null privacy settings', () => {
      expect(service.encryptPrivacySettings(null)).toBeNull();
      expect(service.encryptPrivacySettings(undefined)).toBeNull();
      expect(service.decryptPrivacySettings(null)).toBeNull();
      expect(service.decryptPrivacySettings(undefined)).toBeNull();
    });

    it('should handle invalid encrypted privacy settings gracefully', () => {
      const result = service.decryptPrivacySettings('invalid-encrypted-data');
      expect(result).toBeNull();
    });
  });

  describe('user entity preparation', () => {
    it('should prepare user for save by encrypting sensitive fields', () => {
      const user: Partial<User> = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        preferences: mockPreferences,
        privacySettings: mockPrivacySettings,
      };

      const prepared = service.prepareUserForSave(user);
      
      expect(prepared.id).toBe(user.id);
      expect(prepared.email).toBe(user.email);
      expect(prepared.name).toBe(user.name);
      expect(typeof prepared.preferences).toBe('string');
      expect(typeof prepared.privacySettings).toBe('string');
      expect(prepared.preferences).not.toContain('language');
      expect(prepared.privacySettings).not.toContain('profileVisibility');
    });

    it('should prepare user after load by decrypting sensitive fields', () => {
      const encryptedPreferences = service.encryptPreferences(mockPreferences);
      const encryptedPrivacySettings = service.encryptPrivacySettings(mockPrivacySettings);

      const user: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        preferences: encryptedPreferences as any,
        privacySettings: encryptedPrivacySettings as any,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const prepared = service.prepareUserAfterLoad(user);
      
      expect(prepared.id).toBe(user.id);
      expect(prepared.email).toBe(user.email);
      expect(prepared.name).toBe(user.name);
      expect(prepared.preferences).toEqual(mockPreferences);
      expect(prepared.privacySettings).toEqual(mockPrivacySettings);
    });

    it('should handle users without sensitive fields', () => {
      const user: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const prepared = service.prepareUserAfterLoad(user);
      expect(prepared).toEqual(user);
    });

    it('should prepare multiple users after load', () => {
      const encryptedPreferences = service.encryptPreferences(mockPreferences);
      const encryptedPrivacySettings = service.encryptPrivacySettings(mockPrivacySettings);

      const users: User[] = [
        {
          id: '123',
          email: 'test1@example.com',
          name: 'Test User 1',
          password: 'hashed-password',
          preferences: encryptedPreferences as any,
          privacySettings: encryptedPrivacySettings as any,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '456',
          email: 'test2@example.com',
          name: 'Test User 2',
          password: 'hashed-password',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const prepared = service.prepareUsersAfterLoad(users);
      
      expect(prepared).toHaveLength(2);
      expect(prepared[0].preferences).toEqual(mockPreferences);
      expect(prepared[0].privacySettings).toEqual(mockPrivacySettings);
      expect(prepared[1].preferences).toBeUndefined();
      expect(prepared[1].privacySettings).toBeUndefined();
    });
  });

  describe('user updates with encryption', () => {
    it('should update user with encrypted fields', () => {
      const existingUser: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updates: Partial<User> = {
        name: 'Updated Name',
        preferences: mockPreferences,
        privacySettings: mockPrivacySettings,
      };

      const updated = service.updateUserWithEncryption(existingUser, updates);
      
      expect(updated.id).toBe(existingUser.id);
      expect(updated.name).toBe('Updated Name');
      expect(typeof updated.preferences).toBe('string');
      expect(typeof updated.privacySettings).toBe('string');
    });

    it('should not re-encrypt fields that were not updated', () => {
      const existingUser: User = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashed-password',
        preferences: 'existing-encrypted-preferences' as any,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updates: Partial<User> = {
        name: 'Updated Name',
      };

      const updated = service.updateUserWithEncryption(existingUser, updates);
      
      expect(updated.name).toBe('Updated Name');
      expect(updated.preferences).toBe('existing-encrypted-preferences');
    });
  });

  describe('error handling', () => {
    it('should throw error when encryption fails', () => {
      jest.spyOn(encryptionService, 'encryptObject').mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      expect(() => {
        service.encryptPreferences(mockPreferences);
      }).toThrow('Failed to encrypt user preferences');
    });

    it('should throw error when privacy settings encryption fails', () => {
      jest.spyOn(encryptionService, 'encryptObject').mockImplementation(() => {
        throw new Error('Encryption failed');
      });

      expect(() => {
        service.encryptPrivacySettings(mockPrivacySettings);
      }).toThrow('Failed to encrypt privacy settings');
    });
  });
});