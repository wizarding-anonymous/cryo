import { Injectable } from '@nestjs/common';

@Injectable()
export class AchievementService {
  getAllAchievements() {
    // TODO: Implement in task 5
    return Promise.resolve([]);
  }

  getUserAchievements(_userId: string) {
    // TODO: Implement in task 5
    return Promise.resolve([]);
  }

  unlockAchievement(_userId: string, _achievementId: string) {
    // TODO: Implement in task 5
    return Promise.resolve(null);
  }

  isAchievementUnlocked(_userId: string, _achievementId: string): Promise<boolean> {
    // TODO: Implement in task 5
    return Promise.resolve(false);
  }
}
