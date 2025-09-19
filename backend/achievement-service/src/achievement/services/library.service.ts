import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UserLibraryGame {
  gameId: string;
  gameName: string;
  addedAt: string;
  purchasePrice?: number;
  platform?: string;
}

export interface UserLibraryStats {
  totalGames: number;
  totalSpent: number;
  firstPurchaseDate?: string;
  lastPurchaseDate?: string;
  favoriteGenre?: string;
}

export interface LibraryServiceResponse<T> {
  success: boolean;
  data?: T;
  message: string;
}

@Injectable()
export class LibraryService {
  private readonly logger = new Logger(LibraryService.name);
  private readonly libraryServiceUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.libraryServiceUrl = this.configService.get<string>(
      'LIBRARY_SERVICE_URL',
      'http://library-service:3000'
    );
  }

  /**
   * Получение количества игр в библиотеке пользователя
   */
  async getUserGameCount(userId: string): Promise<number> {
    this.logger.log(`Getting game count for user ${userId}`);

    try {
      const response = await fetch(`${this.libraryServiceUrl}/api/library/${userId}/count`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Library Service responded with ${response.status}`);
      }

      const result = await response.json();
      const gameCount = result.count || 0;
      
      this.logger.log(`User ${userId} has ${gameCount} games in library`);
      return gameCount;

    } catch (error) {
      this.logger.error(`Failed to get game count for user ${userId}:`, error);
      // Возвращаем 0 в случае ошибки, чтобы не нарушить логику достижений
      return 0;
    }
  }

  /**
   * Получение статистики библиотеки пользователя
   */
  async getUserLibraryStats(userId: string): Promise<UserLibraryStats | null> {
    this.logger.log(`Getting library stats for user ${userId}`);

    try {
      const response = await fetch(`${this.libraryServiceUrl}/api/library/${userId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (!response.ok) {
        throw new Error(`Library Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.stats || null;

    } catch (error) {
      this.logger.error(`Failed to get library stats for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Проверка наличия игры в библиотеке пользователя
   */
  async hasGameInLibrary(userId: string, gameId: string): Promise<boolean> {
    this.logger.log(`Checking if user ${userId} has game ${gameId} in library`);

    try {
      const response = await fetch(`${this.libraryServiceUrl}/api/library/${userId}/games/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Name': 'achievement-service',
        },
      });

      if (response.status === 404) {
        return false;
      }

      if (!response.ok) {
        throw new Error(`Library Service responded with ${response.status}`);
      }

      return true;

    } catch (error) {
      this.logger.error(`Failed to check game ${gameId} for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * Получение списка игр пользователя (для расширенной логики достижений)
   */
  async getUserGames(userId: string, limit = 100, offset = 0): Promise<UserLibraryGame[]> {
    this.logger.log(`Getting games for user ${userId} (limit: ${limit}, offset: ${offset})`);

    try {
      const response = await fetch(
        `${this.libraryServiceUrl}/api/library/${userId}/games?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Name': 'achievement-service',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Library Service responded with ${response.status}`);
      }

      const result = await response.json();
      return result.games || [];

    } catch (error) {
      this.logger.error(`Failed to get games for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Проверка доступности Library Service
   */
  async checkLibraryServiceHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.libraryServiceUrl}/health`, {
        method: 'GET',
        headers: {
          'X-Service-Name': 'achievement-service',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.warn(`Library Service health check failed:`, error);
      return false;
    }
  }

  /**
   * Получение информации о первой покупке пользователя
   */
  async getFirstPurchaseInfo(userId: string): Promise<{ gameId: string; purchaseDate: string } | null> {
    this.logger.log(`Getting first purchase info for user ${userId}`);

    try {
      const stats = await this.getUserLibraryStats(userId);
      if (!stats || !stats.firstPurchaseDate) {
        return null;
      }

      // Получаем первую игру из библиотеки (отсортированную по дате добавления)
      const games = await this.getUserGames(userId, 1, 0);
      if (games.length === 0) {
        return null;
      }

      return {
        gameId: games[0].gameId,
        purchaseDate: stats.firstPurchaseDate
      };

    } catch (error) {
      this.logger.error(`Failed to get first purchase info for user ${userId}:`, error);
      return null;
    }
  }
}