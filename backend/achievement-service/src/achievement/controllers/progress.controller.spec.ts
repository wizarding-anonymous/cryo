import { Test, TestingModule } from '@nestjs/testing';
import { ProgressController } from './progress.controller';
import { ProgressService } from '../services/progress.service';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import { UserProgressResponseDto } from '../dto/user-progress-response.dto';

describe('ProgressController', () => {
  let controller: ProgressController;
  let service: ProgressService;

  const mockProgressService = {
    getUserProgress: jest.fn(),
    updateProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        {
          provide: ProgressService,
          useValue: mockProgressService,
        },
      ],
    }).compile();

    controller = module.get<ProgressController>(ProgressController);
    service = module.get<ProgressService>(ProgressService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserProgress', () => {
    it('should return user progress', async () => {
      const userId = 'user-123';
      const mockProgress: UserProgressResponseDto[] = [
        {
          id: '1',
          userId: userId,
          achievement: {
            id: '1',
            name: 'First Purchase',
            description: 'Make your first purchase',
            type: 'first_purchase',
            iconUrl: 'icon.png',
            points: 10,
            condition: { type: 'first_time' },
          },
          currentValue: 0,
          targetValue: 1,
          progressPercentage: 0,
          updatedAt: new Date(),
        },
      ];

      mockProgressService.getUserProgress.mockResolvedValue(mockProgress);

      const result = await controller.getUserProgress(userId);

      expect(result).toEqual(mockProgress);
      expect(service.getUserProgress).toHaveBeenCalledWith(userId);
    });
  });

  describe('updateProgress', () => {
    it('should update progress', async () => {
      const dto: UpdateProgressDto = {
        userId: 'user-123',
        eventType: 'game_purchase',
        eventData: { gameId: 'game-456' },
      };

      const mockUpdatedProgress: UserProgressResponseDto[] = [
        {
          id: '1',
          userId: dto.userId,
          achievement: {
            id: '1',
            name: 'First Purchase',
            description: 'Make your first purchase',
            type: 'first_purchase',
            iconUrl: 'icon.png',
            points: 10,
            condition: { type: 'first_time' },
          },
          currentValue: 1,
          targetValue: 1,
          progressPercentage: 100,
          updatedAt: new Date(),
        },
      ];

      mockProgressService.updateProgress.mockResolvedValue(mockUpdatedProgress);

      const result = await controller.updateProgress(dto);

      expect(result).toEqual(mockUpdatedProgress);
      expect(service.updateProgress).toHaveBeenCalledWith(dto.userId, dto.eventType, dto.eventData);
    });
  });
});