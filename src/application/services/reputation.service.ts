import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { EventPublisher } from '../events/event-publisher.service';

export interface ReputationEntry {
  id: string;
  userId: string;
  change: number;
  reason: string;
  source: 'system' | 'user_review' | 'community_vote' | 'admin_action';
  sourceId?: string;
  createdAt: Date;
}

export interface ReputationPrivileges {
  canModerateComments: boolean;
  canCreatePolls: boolean;
  canAccessBetaFeatures: boolean;
  canBypassRateLimit: boolean;
  maxFriendsCount: number;
  prioritySupport: boolean;
}

@Injectable()
export class ReputationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventPublisher: EventPublisher,
  ) { }

  async updateReputationScore(
    userId: string,
    change: number,
    reason: string,
    source: ReputationEntry['source'] = 'system',
    sourceId?: string
  ): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldScore = user.reputationScore || 0;
    const newScore = Math.max(0, oldScore + change); // Репутация не может быть отрицательной

    // Обновляем репутацию пользователя
    await this.userRepository.update(userId, { reputationScore: newScore });

    // Создаем запись в истории репутации
    const reputationEntry: ReputationEntry = {
      id: `rep_${Date.now()}`,
      userId,
      change,
      reason,
      source,
      sourceId,
      createdAt: new Date(),
    };

    // В реальной реализации сохраняем в таблицу reputation_history
    await this.eventPublisher.publish('ReputationChanged', {
      userId,
      oldScore,
      newScore,
      change,
      reason,
      source,
      sourceId,
      entry: reputationEntry,
      updatedAt: new Date(),
    });

    // Проверяем достижение новых уровней репутации
    await this.checkReputationMilestones(userId, oldScore, newScore);
  }

  async getReputationHistory(userId: string, limit: number = 50): Promise<ReputationEntry[]> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // В реальной реализации запрос к таблице reputation_history с LIMIT
    // Для примера возвращаем заглушку с учетом лимита
    const mockEntries = [
      {
        id: 'rep_1',
        userId,
        change: 10,
        reason: 'Helpful review',
        source: 'user_review' as const,
        sourceId: 'review_123',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      },
      {
        id: 'rep_2',
        userId,
        change: 5,
        reason: 'Daily login bonus',
        source: 'system' as const,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      },
    ];

    return mockEntries.slice(0, limit);
  }

  async getUserReputationPrivileges(userId: string): Promise<ReputationPrivileges> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const score = user.reputationScore || 0;

    return {
      canModerateComments: score >= 100,
      canCreatePolls: score >= 50,
      canAccessBetaFeatures: score >= 200,
      canBypassRateLimit: score >= 500,
      maxFriendsCount: Math.min(1000, 100 + Math.floor(score / 10)),
      prioritySupport: score >= 1000,
    };
  }

  async calculateReputationForActivity(activity: string, metadata?: any): Promise<number> {
    const reputationRules: Record<string, number> = {
      'daily_login': 1,
      'first_game_purchase': 10,
      'game_review_helpful': 5,
      'game_review_unhelpful': -2,
      'community_post_liked': 2,
      'community_post_disliked': -1,
      'achievement_unlocked': 3,
      'friend_referral': 15,
      'beta_feedback': 20,
      'bug_report': 10,
      'spam_reported': -10,
      'toxic_behavior': -25,
      'admin_warning': -50,
    };

    let baseScore = reputationRules[activity] || 0;

    // Модификаторы на основе метаданных
    if (metadata) {
      switch (activity) {
        case 'game_review_helpful':
          // Больше репутации за отзывы на популярные игры
          if (metadata.gamePopularity === 'high') baseScore *= 1.5;
          break;
        case 'achievement_unlocked':
          // Больше репутации за редкие достижения
          if (metadata.achievementRarity === 'legendary') baseScore *= 3;
          else if (metadata.achievementRarity === 'epic') baseScore *= 2;
          break;
        case 'community_post_liked':
          // Больше репутации если пост набрал много лайков
          if (metadata.totalLikes > 100) baseScore *= 2;
          break;
      }
    }

    return Math.floor(baseScore);
  }

  async processActivityReputationUpdate(
    userId: string,
    activity: string,
    metadata?: any
  ): Promise<void> {
    const reputationChange = await this.calculateReputationForActivity(activity, metadata);

    if (reputationChange !== 0) {
      await this.updateReputationScore(
        userId,
        reputationChange,
        `Activity: ${activity}`,
        'system',
        metadata?.sourceId
      );
    }
  }

  async getTopReputationUsers(limit: number = 10): Promise<Array<{ userId: string; username: string; reputationScore: number }>> {
    // В реальной реализации запрос к БД с сортировкой по reputationScore
    const users = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.reputationScore'])
      .orderBy('user.reputationScore', 'DESC')
      .limit(limit)
      .getMany();

    return users.map(user => ({
      userId: user.id,
      username: user.username,
      reputationScore: user.reputationScore || 0,
    }));
  }

  private async checkReputationMilestones(userId: string, oldScore: number, newScore: number): Promise<void> {
    const milestones = [50, 100, 200, 500, 1000, 2000, 5000];

    for (const milestone of milestones) {
      if (oldScore < milestone && newScore >= milestone) {
        // Пользователь достиг нового уровня репутации
        await this.eventPublisher.publish('ReputationMilestoneReached', {
          userId,
          milestone,
          reachedAt: new Date(),
        });

        // Дополнительная награда за достижение уровня
        await this.updateReputationScore(
          userId,
          Math.floor(milestone * 0.1), // 10% от уровня как бонус
          `Milestone reached: ${milestone}`,
          'system'
        );
      }
    }
  }
}
