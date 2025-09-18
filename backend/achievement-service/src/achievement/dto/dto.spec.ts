import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';
import {
  UnlockAchievementDto,
  UpdateProgressDto,
  EventType,
  UserProgressResponseDto,
  AchievementResponseDto,
} from './index';
import { AchievementType } from '../entities/achievement.entity';

describe('Achievement DTOs', () => {
  describe('UnlockAchievementDto', () => {
    it('should validate valid UUID inputs', async () => {
      const dto = plainToClass(UnlockAchievementDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        achievementId: '123e4567-e89b-12d3-a456-426614174001',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid UUID inputs', async () => {
      const dto = plainToClass(UnlockAchievementDto, {
        userId: 'invalid-uuid',
        achievementId: 'invalid-uuid',
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(2);
    });
  });

  describe('UpdateProgressDto', () => {
    it('should validate valid event type and data', async () => {
      const dto = plainToClass(UpdateProgressDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        eventType: EventType.GAME_PURCHASE,
        eventData: { gameId: '123e4567-e89b-12d3-a456-426614174002' },
      });

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail validation for invalid event type', async () => {
      const dto = plainToClass(UpdateProgressDto, {
        userId: '123e4567-e89b-12d3-a456-426614174000',
        eventType: 'invalid_event',
        eventData: { gameId: '123e4567-e89b-12d3-a456-426614174002' },
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('UserProgressResponseDto', () => {
    it('should calculate progress percentage correctly', () => {
      const mockAchievement: AchievementResponseDto = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Achievement',
        description: 'Test Description',
        type: AchievementType.GAMES_PURCHASED,
        iconUrl: null,
        points: 100,
        condition: { type: 'count', target: 5 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dto = new UserProgressResponseDto({
        id: '123e4567-e89b-12d3-a456-426614174004',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        achievementId: '123e4567-e89b-12d3-a456-426614174001',
        achievement: mockAchievement,
        currentValue: 3,
        targetValue: 5,
        updatedAt: new Date(),
      });

      expect(dto.progressPercentage).toBe(60);
    });

    it('should handle 100% progress correctly', () => {
      const mockAchievement: AchievementResponseDto = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Achievement',
        description: 'Test Description',
        type: AchievementType.GAMES_PURCHASED,
        iconUrl: null,
        points: 100,
        condition: { type: 'count', target: 5 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dto = new UserProgressResponseDto({
        id: '123e4567-e89b-12d3-a456-426614174004',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        achievementId: '123e4567-e89b-12d3-a456-426614174001',
        achievement: mockAchievement,
        currentValue: 5,
        targetValue: 5,
        updatedAt: new Date(),
      });

      expect(dto.progressPercentage).toBe(100);
    });

    it('should handle over 100% progress correctly', () => {
      const mockAchievement: AchievementResponseDto = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Achievement',
        description: 'Test Description',
        type: AchievementType.GAMES_PURCHASED,
        iconUrl: null,
        points: 100,
        condition: { type: 'count', target: 5 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dto = new UserProgressResponseDto({
        id: '123e4567-e89b-12d3-a456-426614174004',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        achievementId: '123e4567-e89b-12d3-a456-426614174001',
        achievement: mockAchievement,
        currentValue: 7,
        targetValue: 5,
        updatedAt: new Date(),
      });

      expect(dto.progressPercentage).toBe(100);
    });

    it('should handle zero target value', () => {
      const mockAchievement: AchievementResponseDto = {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Test Achievement',
        description: 'Test Description',
        type: AchievementType.FIRST_PURCHASE,
        iconUrl: null,
        points: 100,
        condition: { type: 'first_time' },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const dto = new UserProgressResponseDto({
        id: '123e4567-e89b-12d3-a456-426614174004',
        userId: '123e4567-e89b-12d3-a456-426614174000',
        achievementId: '123e4567-e89b-12d3-a456-426614174001',
        achievement: mockAchievement,
        currentValue: 1,
        targetValue: 0,
        updatedAt: new Date(),
      });

      expect(dto.progressPercentage).toBe(0);
    });
  });
});
