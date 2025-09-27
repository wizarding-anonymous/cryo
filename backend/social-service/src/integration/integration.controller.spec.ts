import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationController } from './integration.controller';
import { IntegrationService } from './integration.service';
import { InternalAuthGuard } from '../auth/guards/internal-auth.guard';

describe('IntegrationController', () => {
  let controller: IntegrationController;
  let integrationService: jest.Mocked<IntegrationService>;

  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockFriendId = '123e4567-e89b-12d3-a456-426614174001';
  const mockTargetUserId = '123e4567-e89b-12d3-a456-426614174002';

  beforeEach(async () => {
    const mockIntegrationService = {
      getFriendsForAchievements: jest.fn(),
      notifyFirstFriendAchievement: jest.fn(),
      checkSocialConnection: jest.fn(),
      getMutualFriendsCount: jest.fn(),
      getNotificationPreferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IntegrationController],
      providers: [
        {
          provide: IntegrationService,
          useValue: mockIntegrationService,
        },
      ],
    })
      .overrideGuard(InternalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<IntegrationController>(IntegrationController);
    integrationService = module.get(IntegrationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getFriendsForAchievements', () => {
    it('should return friends list for achievements', async () => {
      const mockResponse = {
        userId: mockUserId,
        friendIds: [mockFriendId, mockTargetUserId],
        totalFriends: 2,
        retrievedAt: new Date(),
      };

      integrationService.getFriendsForAchievements.mockResolvedValue(mockResponse);

      const result = await controller.getFriendsForAchievements(mockUserId);

      expect(result).toEqual(mockResponse);
      expect(integrationService.getFriendsForAchievements).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('notifyFirstFriendAchievement', () => {
    it('should notify first friend achievement', async () => {
      const dto = { userId: mockUserId, friendId: mockFriendId };

      await controller.notifyFirstFriendAchievement(dto);

      expect(integrationService.notifyFirstFriendAchievement).toHaveBeenCalledWith(
        mockUserId,
        mockFriendId,
      );
    });
  });

  describe('checkSocialConnection', () => {
    it('should check social connection between users', async () => {
      const mockResponse = {
        userId: mockUserId,
        targetUserId: mockTargetUserId,
        areFriends: true,
        connectionType: 'friends' as const,
        friendshipDate: new Date(),
      };

      integrationService.checkSocialConnection.mockResolvedValue(mockResponse);

      const result = await controller.checkSocialConnection(mockUserId, mockTargetUserId);

      expect(result).toEqual(mockResponse);
      expect(integrationService.checkSocialConnection).toHaveBeenCalledWith(
        mockUserId,
        mockTargetUserId,
      );
    });
  });

  describe('getMutualFriendsCount', () => {
    it('should return mutual friends count', async () => {
      const mockResponse = {
        mutualFriendsCount: 3,
        userId: mockUserId,
        targetUserId: mockTargetUserId,
      };

      integrationService.getMutualFriendsCount.mockResolvedValue(mockResponse);

      const result = await controller.getMutualFriendsCount(mockUserId, mockTargetUserId);

      expect(result).toEqual(mockResponse);
      expect(integrationService.getMutualFriendsCount).toHaveBeenCalledWith(
        mockUserId,
        mockTargetUserId,
      );
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return notification preferences', async () => {
      const mockResponse = {
        userId: mockUserId,
        friendRequestNotifications: true,
        messageNotifications: true,
        achievementNotifications: true,
      };

      integrationService.getNotificationPreferences.mockResolvedValue(mockResponse);

      const result = await controller.getNotificationPreferences(mockUserId);

      expect(result).toEqual(mockResponse);
      expect(integrationService.getNotificationPreferences).toHaveBeenCalledWith(mockUserId);
    });
  });
});