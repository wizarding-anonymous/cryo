import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { GameDetailsDto } from '../library/dto/response.dto';

@Injectable()
export class GameCatalogClient {
  private readonly logger = new Logger(GameCatalogClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('services.gamesCatalog.url');
  }

  async getGamesByIds(gameIds: string[]): Promise<GameDetailsDto[]> {
    if (gameIds.length === 0) {
      return [];
    }
    const url = `${this.baseUrl}/internal/games/batch?ids=${gameIds.join(',')}`;

    // In a real application, you would implement retry logic and a circuit breaker here.
    // Example using a simple retry:
    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data.games || [];
    } catch (error) {
      this.logger.error(`Failed to fetch games from GameCatalogService: ${error.message}`);
      // In a circuit breaker pattern, you might open the circuit here.
      // For now, we return an empty array to prevent cascading failures.
      return [];
    }
  }

  async doesGameExist(gameId: string): Promise<boolean> {
    const url = `${this.baseUrl}/internal/games/${gameId}/exists`;
    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data.exists === true;
    } catch (error) {
      this.logger.error(`Failed to check existence for game ${gameId}: ${error.message}`);
      return false;
    }
  }
}
