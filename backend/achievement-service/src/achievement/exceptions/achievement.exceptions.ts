import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

export class AchievementNotFoundException extends NotFoundException {
  constructor(achievementId: string) {
    super(`Achievement with ID ${achievementId} not found`);
  }
}

export class AchievementAlreadyUnlockedException extends ConflictException {
  constructor(achievementId: string, userId: string) {
    super(`Achievement ${achievementId} already unlocked for user ${userId}`);
  }
}

export class InvalidProgressDataException extends BadRequestException {
  constructor(message: string) {
    super(`Invalid progress data: ${message}`);
  }
}

export class UserNotFoundException extends NotFoundException {
  constructor(userId: string) {
    super(`User with ID ${userId} not found`);
  }
}
