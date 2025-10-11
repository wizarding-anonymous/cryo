import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, catchError, of, timer } from 'rxjs';
import { GameDetailsDto } from '../library/dto';

interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class GameCatalogClient {
  private readonly logger = new Logger(GameCatalogClient.name);
  private readonly baseUrl: string;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 300;

  // Circuit Breaker configuration
  private readonly circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
  };
  private readonly failureThreshold = 5;
  private readonly recoveryTimeout = 60000; // 60 seconds
  private readonly halfOpenMaxCalls = 3;
  private halfOpenCalls = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const configuredBaseUrl = this.configService.get<string>(
      'GAMES_CATALOG_SERVICE_URL',
    );
    if (!configuredBaseUrl) {
      throw new Error('Game Catalog service URL is not configured');
    }
    this.baseUrl = configuredBaseUrl;
  }

  private checkCircuitBreaker(): boolean {
    const now = Date.now();

    switch (this.circuitBreaker.state) {
      case 'OPEN':
        if (now - this.circuitBreaker.lastFailureTime > this.recoveryTimeout) {
          this.circuitBreaker.state = 'HALF_OPEN';
          this.halfOpenCalls = 0;
          this.logger.log('Circuit breaker moved to HALF_OPEN state');
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return this.halfOpenCalls < this.halfOpenMaxCalls;

      case 'CLOSED':
      default:
        return true;
    }
  }

  private onSuccess(): void {
    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'CLOSED';
      this.circuitBreaker.failures = 0;
      this.logger.log('Circuit breaker moved to CLOSED state');
    } else if (this.circuitBreaker.state === 'CLOSED') {
      this.circuitBreaker.failures = 0;
    }
  }

  private onFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn('Circuit breaker moved to OPEN state from HALF_OPEN');
    } else if (this.circuitBreaker.failures >= this.failureThreshold) {
      this.circuitBreaker.state = 'OPEN';
      this.logger.warn(
        `Circuit breaker OPENED after ${this.circuitBreaker.failures} failures`,
      );
    }
  }

  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    if (!this.checkCircuitBreaker()) {
      const error = new Error(
        'Circuit breaker is OPEN - GameCatalog service unavailable',
      );
      this.logger.warn('Request blocked by circuit breaker');
      throw error;
    }

    if (this.circuitBreaker.state === 'HALF_OPEN') {
      this.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  async getGamesByIds(gameIds: string[]): Promise<GameDetailsDto[]> {
    if (gameIds.length === 0) {
      return [];
    }

    return this.executeWithCircuitBreaker(async () => {
      const params = new URLSearchParams({ ids: gameIds.join(',') });
      const url = `${this.baseUrl}/internal/games/batch?${params.toString()}`;

      const request$ = this.httpService
        .get<{ games: GameDetailsDto[] }>(url)
        .pipe(
          retry({
            count: this.retryAttempts,
            delay: (error, retryCount) => {
              this.logger.warn(
                `Retry attempt ${retryCount} for getGamesByIds: ${error.message}`,
              );
              return timer(this.retryDelay * retryCount);
            },
          }),
          catchError((error: unknown) => {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.error(
              `Failed to fetch games from GameCatalogService after ${this.retryAttempts} attempts: ${message}`,
            );
            return of({ data: { games: [] } });
          }),
        );

      const response = await firstValueFrom(request$);
      return response.data.games ?? [];
    });
  }

  async doesGameExist(gameId: string): Promise<boolean> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/internal/games/${gameId}/exists`;

      const request$ = this.httpService.get<{ exists: boolean }>(url).pipe(
        retry({
          count: this.retryAttempts,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Retry attempt ${retryCount} for doesGameExist: ${error.message}`,
            );
            return timer(this.retryDelay * retryCount);
          },
        }),
        catchError((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to check existence for game ${gameId} after ${this.retryAttempts} attempts: ${message}`,
          );
          return of({ data: { exists: false } });
        }),
      );

      const response = await firstValueFrom(request$);
      return response.data.exists === true;
    });
  }

  async getGameDetails(gameId: string): Promise<GameDetailsDto | null> {
    return this.executeWithCircuitBreaker(async () => {
      const url = `${this.baseUrl}/internal/games/${gameId}`;

      const request$ = this.httpService.get<GameDetailsDto>(url).pipe(
        retry({
          count: this.retryAttempts,
          delay: (error, retryCount) => {
            this.logger.warn(
              `Retry attempt ${retryCount} for getGameDetails: ${error.message}`,
            );
            return timer(this.retryDelay * retryCount);
          },
        }),
        catchError((error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(
            `Failed to get game details for ${gameId} after ${this.retryAttempts} attempts: ${message}`,
          );
          return of({ data: null });
        }),
      );

      const response = await firstValueFrom(request$);
      return response.data;
    });
  }
}
