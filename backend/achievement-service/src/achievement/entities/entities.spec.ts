import { Achievement, UserAchievement, UserProgress } from './index';
import { AchievementType } from './achievement.entity';

describe('Entity Classes', () => {
  describe('Achievement Entity', () => {
    it('should create achievement instance with all properties', () => {
      const achievement = new Achievement();
      achievement.id = 'test-id';
      achievement.name = 'Test Achievement';
      achievement.description = 'Test Description';
      achievement.type = AchievementType.FIRST_PURCHASE;
      achievement.condition = { type: 'first_time' };
      achievement.iconUrl = 'test-icon.png';
      achievement.points = 100;
      achievement.isActive = true;
      achievement.createdAt = new Date();
      achievement.updatedAt = new Date();
      achievement.userAchievements = [];

      expect(achievement.id).toBe('test-id');
      expect(achievement.name).toBe('Test Achievement');
      expect(achievement.description).toBe('Test Description');
      expect(achievement.type).toBe(AchievementType.FIRST_PURCHASE);
      expect(achievement.condition).toEqual({ type: 'first_time' });
      expect(achievement.iconUrl).toBe('test-icon.png');
      expect(achievement.points).toBe(100);
      expect(achievement.isActive).toBe(true);
      expect(achievement.createdAt).toBeInstanceOf(Date);
      expect(achievement.updatedAt).toBeInstanceOf(Date);
      expect(achievement.userAchievements).toEqual([]);
    });

    it('should have default values', () => {
      const achievement = new Achievement();
      
      expect(achievement.points).toBeUndefined();
      expect(achievement.isActive).toBeUndefined();
      expect(achievement.userAchievements).toBeUndefined();
    });
  });

  describe('UserAchievement Entity', () => {
    it('should create user achievement instance with all properties', () => {
      const userAchievement = new UserAchievement();
      userAchievement.id = 'test-id';
      userAchievement.userId = 'user-id';
      userAchievement.achievementId = 'achievement-id';
      userAchievement.unlockedAt = new Date();
      
      const achievement = new Achievement();
      achievement.id = 'achievement-id';
      userAchievement.achievement = achievement;

      expect(userAchievement.id).toBe('test-id');
      expect(userAchievement.userId).toBe('user-id');
      expect(userAchievement.achievementId).toBe('achievement-id');
      expect(userAchievement.unlockedAt).toBeInstanceOf(Date);
      expect(userAchievement.achievement).toBe(achievement);
    });

    it('should handle relationship with achievement', () => {
      const userAchievement = new UserAchievement();
      const achievement = new Achievement();
      achievement.name = 'Test Achievement';
      
      userAchievement.achievement = achievement;
      
      expect(userAchievement.achievement.name).toBe('Test Achievement');
    });
  });

  describe('UserProgress Entity', () => {
    it('should create user progress instance with all properties', () => {
      const userProgress = new UserProgress();
      userProgress.id = 'test-id';
      userProgress.userId = 'user-id';
      userProgress.achievementId = 'achievement-id';
      userProgress.currentValue = 5;
      userProgress.targetValue = 10;
      userProgress.updatedAt = new Date();
      
      const achievement = new Achievement();
      achievement.id = 'achievement-id';
      userProgress.achievement = achievement;

      expect(userProgress.id).toBe('test-id');
      expect(userProgress.userId).toBe('user-id');
      expect(userProgress.achievementId).toBe('achievement-id');
      expect(userProgress.currentValue).toBe(5);
      expect(userProgress.targetValue).toBe(10);
      expect(userProgress.updatedAt).toBeInstanceOf(Date);
      expect(userProgress.achievement).toBe(achievement);
    });

    it('should handle default values', () => {
      const userProgress = new UserProgress();
      
      expect(userProgress.currentValue).toBeUndefined();
      expect(userProgress.targetValue).toBeUndefined();
    });

    it('should calculate progress percentage', () => {
      const userProgress = new UserProgress();
      userProgress.currentValue = 7;
      userProgress.targetValue = 10;
      
      const percentage = (userProgress.currentValue / userProgress.targetValue) * 100;
      expect(percentage).toBe(70);
    });
  });

  describe('AchievementType Enum', () => {
    it('should have all expected values', () => {
      expect(AchievementType.FIRST_PURCHASE).toBe('first_purchase');
      expect(AchievementType.FIRST_REVIEW).toBe('first_review');
      expect(AchievementType.FIRST_FRIEND).toBe('first_friend');
      expect(AchievementType.GAMES_PURCHASED).toBe('games_purchased');
      expect(AchievementType.REVIEWS_WRITTEN).toBe('reviews_written');
    });

    it('should be used in achievement entity', () => {
      const achievement = new Achievement();
      achievement.type = AchievementType.FIRST_PURCHASE;
      
      expect(achievement.type).toBe('first_purchase');
    });
  });
});