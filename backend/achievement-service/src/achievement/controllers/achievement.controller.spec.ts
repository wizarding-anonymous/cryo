import { Test, TestingModule } from '@nestjs/testing';
import { AchievementController } from './achievement.controller';
import { AchievementService } from '../services/achievement.service';
import { UnlockAchievementDto } from '../dto/unlock-achievement.dto';
import { AchievementResponseDto } from '../dto/achievement-response.dto';
import { UserAchievementResponseDto } from '../dto/user-achievement-response.dto';
import { PaginatedUserAchievementsResponseDto } from '../dto/paginated-user-achievements-response.dto';
import { AchievementType } from '../entities/achievement.entity';

describe('AchievementController', () => {
  let controller: AchievementController;
  let service: AchievementService;

  const mockAchievementService = {
    getAllAchievements: jest.fn(),
    getUserAchievements: jest.fn(),
    unlockAchievement: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AchievementController],
      providers: [
        {
          provide: AchievementService,
          useValue: mockAchievementService,
        },
      ],
    }).compile();

    controller = module.get<AchievementController>(AchievementController);
    service = module.get<AchievementService>(AchievementService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllAchievements', () => {
    it('should return all achievements', async () => {
      const mockAchievements: AchievementResponseDto[] = [
        {
          id: '1',
          name: 'First Purchase',
          description: 'Make your first purchase',
          type: AchievementType.FIRST_PURCHASE,
          iconUrl: 'icon.png',
          points: 10,
          condition: { type: 'first_time' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockAchievementService.getAllAchievements.mockResolvedValue(mockAchievements);

      const result = await controller.getAllAchievements();

      expect(result).toEqual(mockAchievements);
      expect(service.getAllAchievements).toHaveBeenCalledTimes(1);
    });
  });

  describe('getUserAchievements', () => {
    it('should return paginated user achievements', async () => {
      const userId = 'user-123';
      const mockPaginatedResponse: PaginatedUserAchievementsResponseDto = {
        achievements: [
          {
            id: '1',
            userId: userId,
            achievementId: '1',
            achievement: {
              id: '1',
              name: 'First Purchase',
              description: 'Make your first purchase',
              type: AchievementType.FIRST_PURCHASE,
              iconUrl: 'icon.png',
              points: 10,
              condition: { type: 'first_time' },
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            unlockedAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      mockAchievementService.getUserAchievements.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.getUserAchievements(userId);

      expect(result).toEqual(mockPaginatedResponse);
      expect(service.getUserAchievements).toHaveBeenCalledWith(userId, {
        page: undefined,
        limit: undefined,
        type: undefined,
        unlocked: undefined,
      });
    });

    it('should pass query parameters to service', async () => {
      const userId = 'user-123';
      const mockPaginatedResponse: PaginatedUserAchievementsResponseDto = {
        achievements: [],
        total: 0,
        page: 2,
        limit: 10,
        totalPages: 0,
      };

      mockAchievementService.getUserAchievements.mockResolvedValue(mockPaginatedResponse);

      await controller.getUserAchievements(userId, 2, 10, 'first_purchase', true);

      expect(service.getUserAchievements).toHaveBeenCalledWith(userId, {
        page: 2,
        limit: 10,
        type: 'first_purchase',
        unlocked: true,
      });
    });
  });

  describe('unlockAchievement', () => {
    it('should unlock achievement', async () => {
      const dto: UnlockAchievementDto = {
        userId: 'user-123',
        achievementId: 'achievement-456',
      };

      const mockUnlockedAchievement: UserAchievementResponseDto = {
        id: '1',
        userId: dto.userId,
        achievementId: dto.achievementId,
        achievement: {
          id: dto.achievementId,
          name: 'First Purchase',
          description: 'Make your first purchase',
          type: AchievementType.FIRST_PURCHASE,
          iconUrl: 'icon.png',
          points: 10,
          condition: { type: 'first_time' },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        unlockedAt: new Date(),
      };

      mockAchievementService.unlockAchievement.mockResolvedValue(mockUnlockedAchievement);

      const result = await controller.unlockAchievement(dto);

      expect(result).toEqual(mockUnlockedAchievement);
      expect(service.unlockAchievement).toHaveBeenCalledWith(dto.userId, dto.achievementId);
    });
  });
});
