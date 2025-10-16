import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import { UserService } from '../user/user.service';
import { CacheService } from '../common/cache/cache.service';

describe('ProfileService', () => {
  let service: ProfileService;
  let mockUserService: Partial<UserService>;
  let mockCacheService: Partial<CacheService>;

  const mockUser = {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    avatarUrl: null,
    preferences: {
      language: 'en',
      theme: 'dark' as const,
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      gameSettings: {
        autoDownload: true,
        cloudSave: true,
        achievementNotifications: true,
      },
    },
    privacySettings: {
      profileVisibility: 'public' as const,
      showOnlineStatus: true,
      showGameActivity: true,
      allowFriendRequests: true,
      showAchievements: true,
    },
  };

  beforeEach(async () => {
    mockUserService = {
      findById: jest.fn(),
      findByIdWithoutPassword: jest.fn(),
      update: jest.fn(),
      deleteUser: jest.fn(),
    };

    mockCacheService = {
      invalidateUser: jest.fn(),
      invalidateProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<ProfileService>(ProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return user profile without password', async () => {
      const userId = 'test-user-id';
      (mockUserService.findByIdWithoutPassword as jest.Mock).mockResolvedValue(
        mockUser,
      );

      const result = await service.getProfile(userId);

      expect(mockUserService.findByIdWithoutPassword).toHaveBeenCalledWith(
        userId,
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 'non-existent-user';
      (mockUserService.findByIdWithoutPassword as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.getProfile(userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfile', () => {
    it('should update profile and invalidate cache', async () => {
      const userId = 'test-user-id';
      const updateData = { name: 'Updated Name' };
      const updatedUser = {
        ...mockUser,
        name: 'Updated Name',
        password: 'hashed-password',
      };

      (mockUserService.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateProfile(userId, updateData);

      expect(mockUserService.update).toHaveBeenCalledWith(userId, updateData);
      expect(mockCacheService.invalidateProfile).toHaveBeenCalledWith(userId);
      expect(result).not.toHaveProperty('password');
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('uploadAvatar', () => {
    const mockFile = {
      filename: 'test-avatar.jpg',
      originalname: 'avatar.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    } as Express.Multer.File;

    it('should upload avatar successfully', async () => {
      const userId = 'test-user-id';
      (mockUserService.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockUserService.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.uploadAvatar(userId, mockFile);

      expect(result).toEqual({
        avatarUrl: '/uploads/avatars/test-avatar.jpg',
        message: 'Аватар успешно загружен',
      });
      expect(mockUserService.update).toHaveBeenCalledWith(userId, {
        avatarUrl: '/uploads/avatars/test-avatar.jpg',
      });
      expect(mockCacheService.invalidateUser).toHaveBeenCalledWith(userId);
      expect(mockCacheService.invalidateProfile).toHaveBeenCalledWith(userId);
    });

    it('should throw BadRequestException when no file provided', async () => {
      const userId = 'test-user-id';

      await expect(service.uploadAvatar(userId, null)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when user not found', async () => {
      const userId = 'non-existent-user';
      (mockUserService.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.uploadAvatar(userId, mockFile)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteAvatar', () => {
    it('should delete avatar successfully', async () => {
      const userId = 'test-user-id';
      const userWithAvatar = {
        ...mockUser,
        avatarUrl: '/uploads/avatars/old-avatar.jpg',
      };
      (mockUserService.findById as jest.Mock).mockResolvedValue(userWithAvatar);
      (mockUserService.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.deleteAvatar(userId);

      expect(result).toEqual({ message: 'Аватар успешно удален' });
      expect(mockUserService.update).toHaveBeenCalledWith(userId, {
        avatarUrl: null,
      });
      expect(mockCacheService.invalidateUser).toHaveBeenCalledWith(userId);
      expect(mockCacheService.invalidateProfile).toHaveBeenCalledWith(userId);
    });

    it('should throw BadRequestException when user has no avatar', async () => {
      const userId = 'test-user-id';
      (mockUserService.findById as jest.Mock).mockResolvedValue(mockUser);

      await expect(service.deleteAvatar(userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updatePreferences', () => {
    it('should update preferences successfully', async () => {
      const userId = 'test-user-id';
      const updateData = { language: 'ru', theme: 'light' as const };
      (mockUserService.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockUserService.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.updatePreferences(userId, updateData);

      expect(result.language).toBe('ru');
      expect(result.theme).toBe('light');
      expect(mockCacheService.invalidateUser).toHaveBeenCalledWith(userId);
      expect(mockCacheService.invalidateProfile).toHaveBeenCalledWith(userId);
    });
  });

  describe('updatePrivacySettings', () => {
    it('should update privacy settings successfully', async () => {
      const userId = 'test-user-id';
      const updateData = {
        profileVisibility: 'private' as const,
        showOnlineStatus: false,
      };
      (mockUserService.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockUserService.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.updatePrivacySettings(userId, updateData);

      expect(result.profileVisibility).toBe('private');
      expect(result.showOnlineStatus).toBe(false);
      expect(mockCacheService.invalidateUser).toHaveBeenCalledWith(userId);
      expect(mockCacheService.invalidateProfile).toHaveBeenCalledWith(userId);
    });
  });
});
