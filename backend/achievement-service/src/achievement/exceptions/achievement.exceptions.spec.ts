import {
  AchievementNotFoundException,
  AchievementAlreadyUnlockedException,
  InvalidProgressDataException,
} from './achievement.exceptions';

describe('Achievement Exceptions', () => {
  describe('AchievementNotFoundException', () => {
    it('should create exception with correct message', () => {
      const achievementId = 'test-achievement-id';
      const exception = new AchievementNotFoundException(achievementId);

      expect(exception.message).toBe(`Achievement with ID ${achievementId} not found`);
      expect(exception.name).toBe('AchievementNotFoundException');
      expect(exception.getStatus()).toBe(404);
    });
  });

  describe('AchievementAlreadyUnlockedException', () => {
    it('should create exception with correct message', () => {
      const achievementId = 'test-achievement-id';
      const userId = 'test-user-id';
      const exception = new AchievementAlreadyUnlockedException(achievementId, userId);

      expect(exception.message).toBe(
        `Achievement ${achievementId} already unlocked for user ${userId}`,
      );
      expect(exception.name).toBe('AchievementAlreadyUnlockedException');
      expect(exception.getStatus()).toBe(409);
    });
  });

  describe('InvalidProgressDataException', () => {
    it('should create exception with correct message', () => {
      const message = 'Invalid event data format';
      const exception = new InvalidProgressDataException(message);

      expect(exception.message).toBe(`Invalid progress data: ${message}`);
      expect(exception.name).toBe('InvalidProgressDataException');
      expect(exception.getStatus()).toBe(400);
    });
  });
});
