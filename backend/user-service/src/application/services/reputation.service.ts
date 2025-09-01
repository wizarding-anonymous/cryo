import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { ReputationEntry } from '../../domain/entities/reputation-entry.entity';
import { EventPublisher } from '../events/event-publisher.service';

export interface ReputationChange {
  userId: string;
  change: number;
  reason: string;
  source: 'system' | 'user_review' | 'community_vote' | 'admin_action';
  sourceId?: string;
}

export interface ReputationPrivileges {
  canCreateGroups: boolean;
  canModerateComments: boolean;
  canAccessBetaFeatures: boolean;
  canCreateCustomTags: boolean;
  maxFriendsLimit: number;
  prioritySupport: boolean;
}

@Injectable()
export class ReputationService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ReputationEntry)
    private readonly reputationRepository: Repository<ReputationEntry>,
    private readonly eventPublisher: EventPublisher,
  ) {}

  /**
   * Обновляет репутацию пользователя
   */
  async updateReputation(reputationChange: ReputationChange): Promise<void> {
    const user = await this.userRepository.findOneBy({ id: reputationChange.userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Создаем запись в истории репутации
    const reputationEntry = this.reputationRepository.create({
      userId: reputationChange.userId,
      change: reputationChange.change,
      reason: reputationChange.reason,
      source: reputationChange.source,
      sourceId: reputationChange.sourceId,
      createdAt: new Date(),
    });

    await this.reputationRepository.save(reputationEntry);

    // Обновляем общую репутацию пользователя
    const newReputation = Math.max(0, user.reputationScore + reputationChange.change);
    await this.userRepository.update(reputationChange.userId, {
      reputationScore: newReputation,
    });

    // Публикуем событие об изменении репутации
    await this.eventPublisher.publish('user.reputation.changed', {
      userId: reputationChange.userId,
      oldReputation: user.reputationScore,
      newReputation,
      change: reputationChange.change,
      reason: reputationChange.reason,
      source: reputationChange.source,
      timestamp: new Date(),
    });
  }

  /**
   * Получает историю изменений репутации пользователя
   */
  async getReputationHistory(userId: string, limit = 50): Promise<ReputationEntry[]> {
    return this.reputationRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Получает текущую репутацию пользователя
   */
  async getUserReputation(userId: string): Promise<number> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.reputationScore;
  }

  /**
   * Определяет привилегии пользователя на основе репутации
   */
  async getUserPrivileges(userId: string): Promise<ReputationPrivileges> {
    const reputation = await this.getUserReputation(userId);

    return {
      canCreateGroups: reputation >= 100,
      canModerateComments: reputation >= 500,
      canAccessBetaFeatures: reputation >= 1000,
      canCreateCustomTags: reputation >= 250,
      maxFriendsLimit: this.calculateFriendsLimit(reputation),
      prioritySupport: reputation >= 2000,
    };
  }

  /**
   * Алгоритмы начисления репутации за различные активности
   */
  async awardForActivity(userId: string, activityType: string, metadata?: any): Promise<void> {
    let change = 0;
    let reason = '';

    switch (activityType) {
      case 'game_review':
        change = 5;
        reason = 'Написание отзыва на игру';
        break;
      case 'helpful_review':
        change = 10;
        reason = 'Полезный отзыв (получил лайки)';
        break;
      case 'community_post':
        change = 2;
        reason = 'Активность в сообществе';
        break;
      case 'bug_report':
        change = 15;
        reason = 'Сообщение об ошибке';
        break;
      case 'daily_login':
        change = 1;
        reason = 'Ежедневный вход в систему';
        break;
      case 'profile_completion':
        change = 20;
        reason = 'Заполнение профиля';
        break;
      case 'friend_referral':
        change = 25;
        reason = 'Приглашение друга';
        break;
      case 'achievement_unlock':
        change =
          metadata?.rarity === 'legendary'
            ? 50
            : metadata?.rarity === 'epic'
              ? 25
              : metadata?.rarity === 'rare'
                ? 10
                : 5;
        reason = `Получение достижения (${metadata?.rarity || 'common'})`;
        break;
      case 'game_completion':
        change = 30;
        reason = 'Завершение игры на 100%';
        break;
      case 'tournament_participation':
        change = 15;
        reason = 'Участие в турнире';
        break;
      case 'tournament_win':
        change = 100;
        reason = 'Победа в турнире';
        break;
      default:
        return; // Неизвестный тип активности
    }

    await this.updateReputation({
      userId,
      change,
      reason,
      source: 'system',
      sourceId: activityType,
    });
  }

  /**
   * Снижение репутации за нарушения
   */
  async penalizeForViolation(
    userId: string,
    violationType: string,
    severity: 'minor' | 'major' | 'severe',
  ): Promise<void> {
    let change = 0;
    let reason = '';

    const severityMultiplier = {
      minor: 1,
      major: 2,
      severe: 5,
    };

    switch (violationType) {
      case 'spam':
        change = -10 * severityMultiplier[severity];
        reason = `Спам (${severity})`;
        break;
      case 'inappropriate_content':
        change = -25 * severityMultiplier[severity];
        reason = `Неподходящий контент (${severity})`;
        break;
      case 'harassment':
        change = -50 * severityMultiplier[severity];
        reason = `Домогательства (${severity})`;
        break;
      case 'cheating':
        change = -100 * severityMultiplier[severity];
        reason = `Читерство (${severity})`;
        break;
      case 'fake_review':
        change = -30 * severityMultiplier[severity];
        reason = `Фальшивый отзыв (${severity})`;
        break;
      default:
        change = -20 * severityMultiplier[severity];
        reason = `Нарушение правил (${severity})`;
    }

    await this.updateReputation({
      userId,
      change,
      reason,
      source: 'admin_action',
      sourceId: violationType,
    });
  }

  /**
   * Получение топ пользователей по репутации
   */
  async getTopUsers(limit = 10): Promise<Array<{ userId: string; username: string; reputation: number }>> {
    const users = await this.userRepository
      .createQueryBuilder('user')
      .select(['user.id', 'user.username', 'user.reputationScore'])
      .orderBy('user.reputationScore', 'DESC')
      .limit(limit)
      .getMany();

    return users.map(user => ({
      userId: user.id,
      username: user.username,
      reputation: user.reputationScore,
    }));
  }

  /**
   * Расчет лимита друзей на основе репутации
   */
  private calculateFriendsLimit(reputation: number): number {
    if (reputation >= 5000) return 1000; // Безлимитно для топ пользователей
    if (reputation >= 2000) return 500;
    if (reputation >= 1000) return 300;
    if (reputation >= 500) return 200;
    if (reputation >= 100) return 150;
    return 100; // Базовый лимит
  }

  /**
   * Получение статистики репутации за период
   */
  async getReputationStats(
    userId: string,
    days = 30,
  ): Promise<{
    totalChange: number;
    positiveChanges: number;
    negativeChanges: number;
    averageDaily: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const entries = await this.reputationRepository
      .createQueryBuilder('entry')
      .where('entry.userId = :userId', { userId })
      .andWhere('entry.createdAt >= :startDate', { startDate })
      .getMany();

    const totalChange = entries.reduce((sum, entry) => sum + entry.change, 0);
    const positiveChanges = entries.filter(entry => entry.change > 0).length;
    const negativeChanges = entries.filter(entry => entry.change < 0).length;
    const averageDaily = totalChange / days;

    return {
      totalChange,
      positiveChanges,
      negativeChanges,
      averageDaily: Math.round(averageDaily * 100) / 100,
    };
  }
}
