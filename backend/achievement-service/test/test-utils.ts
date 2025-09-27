import { DataSource } from 'typeorm';
import { Achievement } from '../src/achievement/entities/achievement.entity';
import { UserAchievement } from '../src/achievement/entities/user-achievement.entity';
import { UserProgress } from '../src/achievement/entities/user-progress.entity';
import { AchievementType } from '../src/achievement/entities/achievement.entity';

export class TestDataFactory {
  static createTestAchievement(overrides: Partial<Achievement> = {}): Achievement {
    const achievement = new Achievement();
    achievement.id = overrides.id || '123e4567-e89b-12d3-a456-426614174001';
    achievement.name = overrides.name || 'Test Achievement';
    achievement.description = overrides.description || 'Test achievement description';
    achievement.type = overrides.type || AchievementType.FIRST_PURCHASE;
    achievement.condition = overrides.condition || { type: 'first_time' };
    achievement.iconUrl = overrides.iconUrl || 'https://example.com/icon.png';
    achievement.points = overrides.points || 100;
    achievement.isActive = overrides.isActive !== undefined ? overrides.isActive : true;
    achievement.createdAt = overrides.createdAt || new Date();
    achievement.updatedAt = overrides.updatedAt || new Date();
    return achievement;
  }

  static createTestUserAchievement(overrides: Partial<UserAchievement> = {}): UserAchievement {
    const userAchievement = new UserAchievement();
    userAchievement.id = overrides.id || '123e4567-e89b-12d3-a456-426614174002';
    userAchievement.userId = overrides.userId || '123e4567-e89b-12d3-a456-426614174000';
    userAchievement.achievementId =
      overrides.achievementId || '123e4567-e89b-12d3-a456-426614174001';
    userAchievement.unlockedAt = overrides.unlockedAt || new Date();
    return userAchievement;
  }

  static createTestUserProgress(overrides: Partial<UserProgress> = {}): UserProgress {
    const userProgress = new UserProgress();
    userProgress.id = overrides.id || '123e4567-e89b-12d3-a456-426614174003';
    userProgress.userId = overrides.userId || '123e4567-e89b-12d3-a456-426614174000';
    userProgress.achievementId = overrides.achievementId || '123e4567-e89b-12d3-a456-426614174001';
    userProgress.currentValue = overrides.currentValue || 0;
    userProgress.targetValue = overrides.targetValue || 1;
    userProgress.updatedAt = overrides.updatedAt || new Date();
    return userProgress;
  }
}

export async function seedTestData(dataSource: DataSource): Promise<void> {
  if (!dataSource || !dataSource.isInitialized) {
    throw new Error('DataSource is not initialized');
  }

  try {
    const achievementRepo = dataSource.getRepository(Achievement);
    const userAchievementRepo = dataSource.getRepository(UserAchievement);
    const userProgressRepo = dataSource.getRepository(UserProgress);

    // Clear existing data
    await userProgressRepo.clear();
    await userAchievementRepo.clear();
    await achievementRepo.clear();

    // Create test achievements
    const achievements = [
      TestDataFactory.createTestAchievement({
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'Первая покупка',
        description: 'Купите свою первую игру',
        type: AchievementType.FIRST_PURCHASE,
        condition: { type: 'first_time' },
        points: 100,
      }),
      TestDataFactory.createTestAchievement({
        id: '123e4567-e89b-12d3-a456-426614174002',
        name: 'Первый отзыв',
        description: 'Оставьте свой первый отзыв',
        type: AchievementType.FIRST_REVIEW,
        condition: { type: 'first_time' },
        points: 50,
      }),
      TestDataFactory.createTestAchievement({
        id: '123e4567-e89b-12d3-a456-426614174003',
        name: '5 игр',
        description: 'Купите 5 игр',
        type: AchievementType.GAMES_PURCHASED,
        condition: { type: 'count', target: 5 },
        points: 250,
      }),
    ];

    await achievementRepo.save(achievements);
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
}

export async function cleanupTestData(dataSource: DataSource): Promise<void> {
  if (!dataSource || !dataSource.isInitialized) {
    console.warn('DataSource is not initialized, skipping cleanup');
    return;
  }

  try {
    const userProgressRepo = dataSource.getRepository(UserProgress);
    const userAchievementRepo = dataSource.getRepository(UserAchievement);
    const achievementRepo = dataSource.getRepository(Achievement);

    await userProgressRepo.clear();
    await userAchievementRepo.clear();
    await achievementRepo.clear();
  } catch (error) {
    console.warn('Error during test cleanup:', error.message);
  }
}
