import { Injectable } from '@nestjs/common';
import { ProgressService } from './progress.service';

@Injectable()
export class EventService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly _progressService: ProgressService) {}

  handleGamePurchase(_userId: string, _gameId: string): Promise<void> {
    // TODO: Implement in task 7
    return Promise.resolve();
  }

  handleReviewCreated(_userId: string, _reviewId: string): Promise<void> {
    // TODO: Implement in task 7
    return Promise.resolve();
  }

  handleFriendAdded(_userId: string, _friendId: string): Promise<void> {
    // TODO: Implement in task 7
    return Promise.resolve();
  }

  notifyAchievementUnlocked(_userId: string, _achievementId: string): Promise<void> {
    // TODO: Implement in task 7
    return Promise.resolve();
  }
}
