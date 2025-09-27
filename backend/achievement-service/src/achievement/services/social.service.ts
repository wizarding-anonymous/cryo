import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UserFriend {
  friendshipId: string;
  userId: string;
  friendId: string;
  status: 'pending' | 'accepted' | 'blocked';
  createdAt: string;
  acceptedAt?: string;
}

export interface SocialStats {
  totalFriends: number;
  pendingRequests: number;
  sentRequests: number;
  firstFriendDate?: string;
  lastFriendAddedDate?: string;
}

export interface SocialServiceResponse<T> {
  success: boolean;
  data?: T;
  message: string;
}

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);
  private readonly socialServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.socialServiceUrl = this.configService.get<string>(
      'SOCIAL_SERVICE_URL',
      'http://social-service:3000',
    );
  }

  /**
   * Получение информации о дружбе
   */
  async getFriendship(friendshipId: string): Promise<UserFriend | null> {
    this.logger.log(`Getting friendship ${friendshipId}`);

    try {
      const response = await fetch(`${this.socialServiceUrl}/api/friendships/${friendshipId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Social Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.friendship || null;
    } catch (error) {
      this.logger.error(`Failed to get friendship ${friendshipId}:`, error);
      return null;
    }
  }

  /**
   * Получение списка друзей пользователя
   */
  async getUserFriends(userId: string, limit = 50, offset = 0): Promise<UserFriend[]> {
    this.logger.log(`Getting friends for user ${userId} (limit: ${limit}, offset: ${offset})`);

    try {
      const response = await fetch(
        `${this.socialServiceUrl}/api/users/${userId}/friends?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Social Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.friends || [];
    } catch (error) {
      this.logger.error(`Failed to get friends for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Получение количества друзей пользователя
   */
  async getUserFriendCount(userId: string): Promise<number> {
    this.logger.log(`Getting friend count for user ${userId}`);

    try {
      const response = await fetch(`${this.socialServiceUrl}/api/users/${userId}/friends/count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Social Service responded with ${response.status}`);
      }

      const result = await response.json();
      const friendCount = result.count || 0;

      this.logger.log(`User ${userId} has ${friendCount} friends`);
      return friendCount;
    } catch (error) {
      this.logger.error(`Failed to get friend count for user ${userId}:`, error);
      // Возвращаем 0 в случае ошибки, чтобы не нарушить логику достижений
      return 0;
    }
  }

  /**
   * Получение социальной статистики пользователя
   */
  async getUserSocialStats(userId: string): Promise<SocialStats | null> {
    this.logger.log(`Getting social stats for user ${userId}`);

    try {
      const response = await fetch(`${this.socialServiceUrl}/api/users/${userId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Social Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.stats || null;
    } catch (error) {
      this.logger.error(`Failed to get social stats for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Проверка дружбы между пользователями
   */
  async areFriends(userId: string, friendId: string): Promise<boolean> {
    this.logger.log(`Checking friendship between ${userId} and ${friendId}`);

    try {
      const response = await fetch(
        `${this.socialServiceUrl}/api/users/${userId}/friends/${friendId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        throw new Error(`Social Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.friendship?.status === 'accepted';
    } catch (error) {
      this.logger.error(`Failed to check friendship between ${userId} and ${friendId}:`, error);
      return false;
    }
  }

  /**
   * Получение входящих заявок в друзья
   */
  async getPendingFriendRequests(userId: string): Promise<UserFriend[]> {
    this.logger.log(`Getting pending friend requests for user ${userId}`);

    try {
      const response = await fetch(
        `${this.socialServiceUrl}/api/users/${userId}/friend-requests/incoming`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Social Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.requests || [];
    } catch (error) {
      this.logger.error(`Failed to get pending friend requests for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Получение исходящих заявок в друзья
   */
  async getSentFriendRequests(userId: string): Promise<UserFriend[]> {
    this.logger.log(`Getting sent friend requests for user ${userId}`);

    try {
      const response = await fetch(
        `${this.socialServiceUrl}/api/users/${userId}/friend-requests/outgoing`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Social Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.requests || [];
    } catch (error) {
      this.logger.error(`Failed to get sent friend requests for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Проверка доступности Social Service
   */
  async checkSocialServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.socialServiceUrl}/health`, {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`Social Service health check failed:`, error);
      return false;
    }
  }

  /**
   * Получение информации о первом друге пользователя
   */
  async getFirstFriendInfo(userId: string): Promise<{ friendId: string; addedAt: string } | null> {
    this.logger.log(`Getting first friend info for user ${userId}`);

    try {
      const stats = await this.getUserSocialStats(userId);
      if (!stats || !stats.firstFriendDate) {
        return null;
      }

      // Получаем первого друга из списка (отсортированного по дате добавления)
      const friends = await this.getUserFriends(userId, 1, 0);
      if (friends.length === 0) {
        return null;
      }

      return {
        friendId: friends[0].friendId,
        addedAt: stats.firstFriendDate,
      };
    } catch (error) {
      this.logger.error(`Failed to get first friend info for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Проверка валидности события добавления друга
   */
  async validateFriendAddedEvent(userId: string, friendId: string): Promise<boolean> {
    try {
      // Проверяем, что дружба действительно существует и активна
      const areFriends = await this.areFriends(userId, friendId);
      return areFriends;
    } catch (error) {
      this.logger.error(`Failed to validate friend added event for ${userId} and ${friendId}:`, error);
      return false;
    }
  }
}