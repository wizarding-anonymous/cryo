import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { UserService } from './user.service';
import { ProfileService } from '../profile/profile.service';
import { InternalServiceGuard } from '../common/guards/internal-service.guard';
import { ConfigService } from '@nestjs/config';
import { UserServiceError } from '../common/errors/user-service.error';

describe('InternalController', () => {
  let controller: InternalController;
  let userService: jest.Mocked<UserService>;
  let profileService: jest.Mocked<ProfileService>;

  const mockUser = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    name: 'Test User',
    password: '$2b$10$hashedPassword',
    isActive: true,
    lastLoginAt: new Date('2023-12-01T10:00:00Z'),
    createdAt: new Date('2023-01-01T10:00:00Z'),
    updatedAt: new Date('2023-12-01T10:00:00Z'),
    deletedAt: null,
    avatarUrl: 'https://example.com/avatar.jpg',
    preferences: {
      language: 'en',
      timezone: 'UTC',
      theme: 'light' as const,
      notifications: { email: true, push: true, sms: false },
      gameSettings: {
        autoDownload: false,
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
    metadata: null,
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        INTERNAL_API_KEYS: 'test-api-key',
        INTERNAL_ALLOWED_IPS: '127.0.0.1,::1',
        INTERNAL_SERVICE_SECRET: 'test-secret',
        NODE_ENV: 'test',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const mockUserService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      updateLastLogin: jest.fn(),
      update: jest.fn(),
      findUsersBatch: jest.fn(),
    };

    const mockProfileService = {
      getPreferences: jest.fn(),
      updatePreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: UserService, useValue: mockUserService },
        { provide: ProfileService, useValue: mockProfileService },
        { provide: ConfigService, useValue: mockConfigService },
        InternalServiceGuard,
      ],
    })
      .overrideGuard(InternalServiceGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<InternalController>(InternalController);
    userService = module.get(UserService);
    profileService = module.get(ProfileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('Auth Service Endpoints', () => {
    describe('createUserForAuth', () => {
      it('should create user and return internal response DTO', async () => {
        const createUserDto = {
          name: 'Test User',
          email: 'test@example.com',
          password: '$2b$10$hashedPassword',
        };

        userService.create.mockResolvedValue(mockUser);

        const result = await controller.createUserForAuth(createUserDto);

        expect(userService.create).toHaveBeenCalledWith(createUserDto);
        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          isActive: mockUser.isActive,
          lastLoginAt: mockUser.lastLoginAt,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        });
        expect(result).not.toHaveProperty('password');
      });
    });

    describe('getUserForAuth', () => {
      it('should return user for auth service', async () => {
        userService.findById.mockResolvedValue(mockUser);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        const result = await controller.getUserForAuth(mockUser.id, mockRequest);

        expect(userService.findById).toHaveBeenCalledWith(mockUser.id);
        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          isActive: mockUser.isActive,
          lastLoginAt: mockUser.lastLoginAt,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        });
      });

      it('should throw NotFoundException when user not found', async () => {
        userService.findById.mockResolvedValue(null);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        await expect(controller.getUserForAuth(mockUser.id, mockRequest)).rejects.toThrow(
          UserServiceError,
        );
      });
    });

    describe('getUserByEmailForAuth', () => {
      it('should return user by email for auth service', async () => {
        userService.findByEmail.mockResolvedValue(mockUser);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        const result = await controller.getUserByEmailForAuth(mockUser.email, mockRequest);

        expect(userService.findByEmail).toHaveBeenCalledWith(mockUser.email);
        expect(result).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          isActive: mockUser.isActive,
          lastLoginAt: mockUser.lastLoginAt,
          createdAt: mockUser.createdAt,
          updatedAt: mockUser.updatedAt,
        });
      });

      it('should throw NotFoundException when user not found', async () => {
        userService.findByEmail.mockResolvedValue(null);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        await expect(
          controller.getUserByEmailForAuth(mockUser.email, mockRequest),
        ).rejects.toThrow(UserServiceError);
      });
    });

    describe('updateLastLoginForAuth', () => {
      it('should update last login for auth service', async () => {
        userService.updateLastLogin.mockResolvedValue(undefined);

        const result = await controller.updateLastLoginForAuth(mockUser.id);

        expect(userService.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
        expect(result).toEqual({ message: 'Last login updated successfully' });
      });
    });
  });

  describe('Game Catalog Service Endpoints', () => {
    describe('getUserProfileForGameCatalog', () => {
      it('should return user profile for game catalog service', async () => {
        userService.findById.mockResolvedValue(mockUser);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        const result = await controller.getUserProfileForGameCatalog(
          mockUser.id,
          mockRequest,
          true,
          false,
        );

        expect(userService.findById).toHaveBeenCalledWith(mockUser.id);
        expect(result).toEqual({
          id: mockUser.id,
          name: mockUser.name,
          avatarUrl: mockUser.avatarUrl,
          preferences: mockUser.preferences,
          privacySettings: null,
          isActive: mockUser.isActive,
          lastLoginAt: mockUser.lastLoginAt,
        });
      });

      it('should throw NotFoundException when user not found', async () => {
        userService.findById.mockResolvedValue(null);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        await expect(
          controller.getUserProfileForGameCatalog(mockUser.id, mockRequest),
        ).rejects.toThrow(UserServiceError);
      });
    });

    describe('getBatchProfilesForGameCatalog', () => {
      it('should return batch profiles for game catalog service', async () => {
        const userIds = [mockUser.id, '456e7890-e89b-12d3-a456-426614174001'];
        const usersMap = new Map([[mockUser.id, mockUser]]);

        userService.findUsersBatch.mockResolvedValue(usersMap);

        const requestDto = {
          userIds,
          includePreferences: true,
          includePrivacySettings: false,
          chunkSize: 50,
        };

        const result =
          await controller.getBatchProfilesForGameCatalog(requestDto);

        expect(userService.findUsersBatch).toHaveBeenCalledWith(userIds, {
          chunkSize: 50,
        });
        expect(result.profiles).toHaveLength(1);
        expect(result.stats).toEqual({
          requested: 2,
          found: 1,
          missing: 1,
        });
      });
    });
  });

  describe('Payment Service Endpoints', () => {
    describe('getBillingInfoForPayment', () => {
      it('should return billing info for payment service', async () => {
        userService.findById.mockResolvedValue(mockUser);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        const result = await controller.getBillingInfoForPayment(mockUser.id, mockRequest);

        expect(userService.findById).toHaveBeenCalledWith(mockUser.id);
        expect(result).toEqual({
          userId: mockUser.id,
          name: mockUser.name,
          email: mockUser.email,
          language: mockUser.preferences.language,
          timezone: mockUser.preferences.timezone,
          isActive: mockUser.isActive,
          createdAt: mockUser.createdAt,
        });
      });

      it('should throw NotFoundException when user not found', async () => {
        userService.findById.mockResolvedValue(null);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        await expect(
          controller.getBillingInfoForPayment(mockUser.id, mockRequest),
        ).rejects.toThrow(UserServiceError);
      });
    });

    describe('updateBillingInfoForPayment', () => {
      it('should update billing info for payment service', async () => {
        const updateDto = {
          name: 'Updated Name',
          language: 'es',
        };

        userService.findById
          .mockResolvedValueOnce(mockUser)
          .mockResolvedValueOnce({ ...mockUser, name: 'Updated Name' });
        userService.update.mockResolvedValue(undefined);

        const mockRequest = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as any;
        const result = await controller.updateBillingInfoForPayment(
          mockUser.id,
          updateDto,
          mockRequest,
        );

        expect(userService.update).toHaveBeenCalledWith(mockUser.id, {
          name: 'Updated Name',
          preferences: {
            ...mockUser.preferences,
            language: 'es',
          },
        });
        expect(result.name).toBe('Updated Name');
      });
    });
  });

  describe('Library Service Endpoints', () => {
    describe('getPreferencesForLibrary', () => {
      it('should return preferences for library service', async () => {
        const mockPreferences = mockUser.preferences;
        profileService.getPreferences.mockResolvedValue(mockPreferences);

        const result = await controller.getPreferencesForLibrary(mockUser.id);

        expect(profileService.getPreferences).toHaveBeenCalledWith(mockUser.id);
        expect(result).toEqual(mockPreferences);
      });
    });

    describe('updatePreferencesForLibrary', () => {
      it('should update preferences for library service', async () => {
        const updateDto = {
          language: 'fr',
          theme: 'dark' as const,
        };
        const updatedPreferences = { ...mockUser.preferences, ...updateDto };

        profileService.updatePreferences.mockResolvedValue(updatedPreferences);

        const result = await controller.updatePreferencesForLibrary(
          mockUser.id,
          updateDto,
        );

        expect(profileService.updatePreferences).toHaveBeenCalledWith(
          mockUser.id,
          updateDto,
        );
        expect(result).toEqual(updatedPreferences);
      });
    });
  });
});
