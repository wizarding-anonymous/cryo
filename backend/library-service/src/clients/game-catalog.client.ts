import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, catchError, of } from 'rxjs';
import { GameDetailsDto } from '../library/dto/response.dto';

@Injectable()
export class GameCatalogClient {
  private readonly logger = new Logger(GameCatalogClient.name);
  private readonly baseUrl: string;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 300;

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

    const request$ = this.httpService.get<{ games: GameDetailsDto[] }>(url).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError(error => {
        this.logger.error(`Failed to fetch games from GameCatalogService after ${this.retryAttempts} attempts: ${error.message}`);
        return of({ data: { games: [] } });
      }),
    );

    const response = await firstValueFrom(request$);
    return response.data.games || [];
  }

  async doesGameExist(gameId: string): Promise<boolean> {
    const url = `${this.baseUrl}/internal/games/${gameId}/exists`;

    const request$ = this.httpService.get<{ exists: boolean }>(url).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError(error => {
        this.logger.error(`Failed to check existence for game ${gameId} after ${this.retryAttempts} attempts: ${error.message}`);
        return of({ data: { exists: false } });
      }),
    );

    const response = await firstValueFrom(request$);
    return response.data.exists === true;
  }
}
