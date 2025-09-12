import { Injectable, Inject, CACHE_MANAGER, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { GamePurchaseInfo } from './dto/game-purchase-info.dto';

@Injectable()
export class GameCatalogIntegrationService {
  private readonly logger = new Logger(GameCatalogIntegrationService.name);
  private readonly gameCatalogUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    this.gameCatalogUrl = this.configService.get<string>('GAME_CATALOG_SERVICE_URL');
  }

  async getGamePurchaseInfo(gameId: string): Promise<GamePurchaseInfo | null> {
    const cacheKey = `game-info-${gameId}`;
    const cachedGame = await this.cacheManager.get<GamePurchaseInfo>(cacheKey);

    if (cachedGame) {
      this.logger.log(`Cache hit for game ${gameId}`);
      return cachedGame;
    }

    this.logger.log(`Cache miss for game ${gameId}. Fetching from service.`);
    const url = `${this.gameCatalogUrl}/api/internal/games/${gameId}/purchase-info`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<GamePurchaseInfo>(url).pipe(
          timeout(5000),
          catchError(err => {
            this.logger.error(`Error fetching game info for ${gameId}: ${err.message}`);
            return of(null);
          }),
        ),
      );

      if (!response || !response.data) {
        return null;
      }

      const gameInfo = response.data;
      await this.cacheManager.set(cacheKey, gameInfo, 3600); // Cache for 1 hour
      return gameInfo;
    } catch (error) {
      this.logger.error(`Failed to fetch from Game Catalog Service: ${error.message}`);
      return null;
    }
  }

  async checkHealth(): Promise<{ status: string }> {
    const url = `${this.gameCatalogUrl}/api/health`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(timeout(2000)),
      );
      return { status: response.data?.status === 'ok' ? 'up' : 'down' };
    } catch (error) {
      this.logger.error(`Game Catalog Service health check failed: ${error.message}`);
      return { status: 'down' };
    }
  }
}
