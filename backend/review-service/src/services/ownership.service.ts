import { Injectable, Inject, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { ExternalServiceBase, ExternalServiceError } from './external-service.base';

export interface GameOwnershipResponse {
  ownsGame: boolean;
  purchaseDate?: string;
  gameId: string;
  userId: string;
}

export interface UserGamesResponse {
  games: Array<{
    gameId: string;
    purchaseDate: string;
    title?: string;
  }>;
  total: number;
}

@Injectable()
export class OwnershipService extends ExternalServiceBase {
  private readonly logger = new Logger(OwnershipService.name);
  private readonly CACHE_TTL = 600; // 10 минут в секундах

  constructor(
    httpService: HttpService,
    configService: ConfigService,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {
    super(httpService, configService);
  }

  async checkGameOwnership(userId: string, gameId: string): Promise<boolean> {
    // Проверяем кеш
    const cacheKey = `ownership_${userId}_${gameId}`;
    const cachedResult = await this.cacheManager.get<boolean>(cacheKey);

    if (cachedResult !== undefined) {
      this.logger.debug(`Cache hit for ownership check: ${cacheKey}`);
      return cachedResult;
    }

    try {
      // Проверяем владение через Library Service с retry механизмом
      const ownershipData = await this.checkOwnershipWithRetry(userId, gameId);
      const ownsGame = ownershipData.ownsGame;

      // Кешируем результат
      await this.cacheManager.set(cacheKey, ownsGame, this.CACHE_TTL);
      this.logger.debug(`Cached ownership result for ${cacheKey}: ${ownsGame}`);

      return ownsGame;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        this.logger.error(`External service error: ${error.service} - ${error.operation}`, {
          statusCode: error.statusCode,
          message: error.message,
          retryable: error.retryable,
        });
        
        // Для некритических ошибок возвращаем false (пользователь не владеет игрой)
        if (!error.retryable) {
          return false;
        }
      }
      
      this.logger.error(`Failed to check game ownership for user ${userId}, game ${gameId}`, error);
      // В случае критических ошибок возвращаем false для безопасности
      return false;
    }
  }

  private async checkOwnershipWithRetry(userId: string, gameId: string): Promise<GameOwnershipResponse> {
    const libraryServiceUrl = this.getServiceUrl('library');
    const url = `${libraryServiceUrl}/api/v1/library/${userId}/games/${gameId}/ownership`;

    return await this.makeRequestWithRetry<GameOwnershipResponse>(
      url,
      {
        method: 'GET',
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
      },
      'library',
      'checkGameOwnership'
    );
  }

  async getUserOwnedGames(userId: string): Promise<string[]> {
    try {
      const libraryServiceUrl = this.getServiceUrl('library');
      const url = `${libraryServiceUrl}/api/v1/library/${userId}/games`;

      const response = await this.makeRequestWithRetry<UserGamesResponse>(
        url,
        {
          method: 'GET',
        },
        {
          maxRetries: 2, // Меньше попыток для списка игр
          baseDelay: 500,
        },
        'library',
        'getUserOwnedGames'
      );

      return response.games?.map(game => game.gameId) || [];
    } catch (error) {
      this.logger.error(`Failed to get user owned games for user ${userId}`, error);
      return [];
    }
  }

  async invalidateOwnershipCache(userId: string, gameId?: string): Promise<void> {
    try {
      if (gameId) {
        // Инвалидируем кеш для конкретной игры
        const cacheKey = `ownership_${userId}_${gameId}`;
        await this.cacheManager.del(cacheKey);
        this.logger.debug(`Invalidated ownership cache for ${cacheKey}`);
      } else {
        // Инвалидируем весь кеш пользователя
        // Для простоты MVP используем паттерн поиска (если поддерживается Redis)
        this.logger.debug(`Cache invalidation requested for user ${userId}`);
        // TODO: Реализовать массовую инвалидацию кеша по паттерну в будущих версиях
      }
    } catch (error) {
      this.logger.error('Failed to invalidate ownership cache', error);
    }
  }

  async warmUpOwnershipCache(userId: string, gameIds: string[]): Promise<void> {
    this.logger.debug(`Warming up ownership cache for user ${userId} with ${gameIds.length} games`);
    
    // Параллельно проверяем владение для всех игр
    const promises = gameIds.map(gameId => 
      this.checkGameOwnership(userId, gameId).catch(error => {
        this.logger.warn(`Failed to warm up cache for game ${gameId}`, error);
        return false;
      })
    );

    await Promise.allSettled(promises);
    this.logger.debug(`Completed cache warm-up for user ${userId}`);
  }
}