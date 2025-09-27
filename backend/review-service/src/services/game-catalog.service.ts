import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { GameRating } from '../entities/game-rating.entity';

export interface GameRatingUpdateDto {
  gameId: string;
  averageRating: number;
  totalReviews: number;
  timestamp: string;
}

export interface GameCatalogResponse {
  success: boolean;
  message?: string;
}

@Injectable()
export class GameCatalogService {
  private readonly logger = new Logger(GameCatalogService.name);
  private readonly gameCatalogServiceUrl: string;
  private readonly requestTimeout: number;
  private readonly maxRetries: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.gameCatalogServiceUrl = this.configService.get<string>(
      'GAME_CATALOG_SERVICE_URL',
      'http://game-catalog-service:3000'
    );
    this.requestTimeout = this.configService.get<number>('GAME_CATALOG_REQUEST_TIMEOUT', 5000);
    this.maxRetries = this.configService.get<number>('GAME_CATALOG_MAX_RETRIES', 3);
  }

  async updateGameRating(gameRating: GameRating): Promise<boolean> {
    try {
      const payload: GameRatingUpdateDto = {
        gameId: gameRating.gameId,
        averageRating: gameRating.averageRating,
        totalReviews: gameRating.totalReviews,
        timestamp: gameRating.updatedAt.toISOString(),
      };

      this.logger.debug(`Updating game rating in Game Catalog: ${JSON.stringify(payload)}`);

      const response = await firstValueFrom(
        this.httpService
          .put<GameCatalogResponse>(`${this.gameCatalogServiceUrl}/games/${gameRating.gameId}/rating`, payload, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'review-service/1.0',
            },
          })
          .pipe(
            timeout(this.requestTimeout),
            retry({
              count: this.maxRetries,
              delay: (error, retryCount) => {
                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                this.logger.warn(`Retry ${retryCount}/${this.maxRetries} for game catalog update after ${delay}ms:`, error.message);
                return new Promise(resolve => setTimeout(resolve, delay));
              },
            }),
            catchError((error) => {
              this.logger.error(`Game Catalog Service update failed:`, error.response?.data || error.message);
              // Don't throw error - catalog update is not critical for review operations
              return Promise.resolve({
                data: { success: false, message: 'Service unavailable' },
                status: 503,
                statusText: 'Service Unavailable',
                headers: {},
                config: {} as any,
              });
            }),
          ),
      );

      const success = response.data?.success === true;
      if (success) {
        this.logger.log(`Game rating updated successfully in catalog for game ${gameRating.gameId}`);
      } else {
        this.logger.warn(`Game rating update failed in catalog for game ${gameRating.gameId}:`, response.data?.message);
      }

      return success;
    } catch (error) {
      this.logger.error(`Failed to update game rating in catalog for game ${gameRating.gameId}:`, error);
      return false; // Don't fail rating update if catalog sync fails
    }
  }

  async getGameInfo(gameId: string): Promise<{ name?: string; exists: boolean }> {
    try {
      this.logger.debug(`Getting game info from Game Catalog: ${gameId}`);

      const response = await firstValueFrom(
        this.httpService
          .get<{ id: string; name: string; [key: string]: any }>(`${this.gameCatalogServiceUrl}/games/${gameId}`, {
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'review-service/1.0',
            },
          })
          .pipe(
            timeout(this.requestTimeout),
            retry({
              count: this.maxRetries,
              delay: (error, retryCount) => {
                const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 5000);
                this.logger.warn(`Retry ${retryCount}/${this.maxRetries} for game info after ${delay}ms:`, error.message);
                return new Promise(resolve => setTimeout(resolve, delay));
              },
            }),
            catchError((error) => {
              // Handle 404 as "game not found"
              if (error.response?.status === 404) {
                this.logger.debug(`Game ${gameId} not found in catalog (404)`);
                return Promise.resolve({
                  data: null,
                  status: 404,
                  statusText: 'Not Found',
                  headers: {},
                  config: {} as any,
                });
              }
              
              this.logger.error(`Game Catalog Service game info failed:`, error.response?.data || error.message);
              return Promise.resolve({
                data: null,
                status: 503,
                statusText: 'Service Unavailable',
                headers: {},
                config: {} as any,
              });
            }),
          ),
      );

      if (response.status === 404) {
        return { exists: false };
      }

      const gameData = response.data;
      return {
        name: gameData?.name,
        exists: true,
      };
    } catch (error) {
      this.logger.error(`Failed to get game info for game ${gameId}:`, error);
      return { exists: false };
    }
  }

  async getServiceHealth(): Promise<{ status: 'healthy' | 'unhealthy'; gameCatalogService: boolean }> {
    try {
      const response = await firstValueFrom(
        this.httpService
          .get(`${this.gameCatalogServiceUrl}/health`, { timeout: 2000 })
          .pipe(
            timeout(2000),
            catchError(() => Promise.resolve({ status: 503 })),
          ),
      );
      
      const gameCatalogServiceHealthy = response.status === 200;
      
      return {
        status: gameCatalogServiceHealthy ? 'healthy' : 'unhealthy',
        gameCatalogService: gameCatalogServiceHealthy,
      };
    } catch (error) {
      this.logger.warn('Game Catalog Service health check failed:', error);
      return {
        status: 'unhealthy',
        gameCatalogService: false,
      };
    }
  }
}