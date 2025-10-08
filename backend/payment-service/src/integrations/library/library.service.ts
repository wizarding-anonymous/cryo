import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { AddGameToLibraryDto } from './dto/add-game-to-library.dto';
import { MetricsService } from '../../common/metrics/metrics.service';

@Injectable()
export class LibraryIntegrationService {
  private readonly logger = new Logger(LibraryIntegrationService.name);
  private readonly libraryServiceUrl: string;
  private readonly maxRetries: number;
  private readonly baseRetryDelay: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.libraryServiceUrl = this.configService.get<string>(
      'LIBRARY_SERVICE_URL',
    );
    this.maxRetries = this.configService.get<number>(
      'LIBRARY_SERVICE_MAX_RETRIES',
      3,
    );
    this.baseRetryDelay = this.configService.get<number>(
      'LIBRARY_SERVICE_RETRY_DELAY',
      1000,
    );
  }

  async addGameToLibrary(payload: AddGameToLibraryDto): Promise<boolean> {
    const startTime = Date.now();
    const url = `${this.libraryServiceUrl}/api/library/add`;

    this.logger.log(
      `Adding game ${payload.gameId} to library for user ${payload.userId} (order: ${payload.orderId})`,
      {
        userId: payload.userId,
        gameId: payload.gameId,
        orderId: payload.orderId,
        amount: payload.purchasePrice,
        currency: payload.currency,
      },
    );

    try {
      const response = await this.retryAddGameToLibrary(url, payload);
      const duration = (Date.now() - startTime) / 1000;

      if (!response || response.status !== 201) {
        this.logger.error(
          `Failed to add game ${payload.gameId} to library. Status: ${response?.status}`,
          {
            userId: payload.userId,
            gameId: payload.gameId,
            orderId: payload.orderId,
            status: response?.status,
            duration,
          },
        );

        this.metricsService.recordIntegrationRequest(
          'library',
          'addGame',
          'failed',
        );
        this.metricsService.recordIntegrationDuration(
          'library',
          'addGame',
          duration,
        );
        return false;
      }

      this.logger.log(
        `Successfully added game ${payload.gameId} to library for user ${payload.userId}`,
        {
          userId: payload.userId,
          gameId: payload.gameId,
          orderId: payload.orderId,
          duration,
        },
      );

      this.metricsService.recordIntegrationRequest(
        'library',
        'addGame',
        'success',
      );
      this.metricsService.recordIntegrationDuration(
        'library',
        'addGame',
        duration,
      );
      return true;
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      const errorMessage = error?.message || 'Unknown error';
      const errorStack = error?.stack || 'No stack trace available';

      this.logger.error(
        `Unhandled exception when calling Library Service: ${errorMessage}`,
        {
          userId: payload.userId,
          gameId: payload.gameId,
          orderId: payload.orderId,
          error: errorMessage,
          stack: errorStack,
          duration,
        },
      );

      this.metricsService.recordIntegrationRequest(
        'library',
        'addGame',
        'error',
      );
      this.metricsService.recordIntegrationDuration(
        'library',
        'addGame',
        duration,
      );
      return false;
    }
  }

  private async retryAddGameToLibrary(
    url: string,
    payload: AddGameToLibraryDto,
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Library integration attempt ${attempt}/${this.maxRetries} for order ${payload.orderId}`,
        );

        const response = await firstValueFrom(
          this.httpService.post(url, payload).pipe(
            timeout(8000),
            catchError((err) => {
              lastError = err;
              throw err;
            }),
          ),
        );

        return response;
      } catch (error) {
        lastError = error;

        if (attempt === this.maxRetries) {
          this.logger.error(
            `All ${this.maxRetries} attempts failed for library integration`,
            {
              orderId: payload.orderId,
              userId: payload.userId,
              gameId: payload.gameId,
              error: error?.message || 'Unknown error',
            },
          );
          throw error;
        }

        // Exponential backoff with jitter
        const backoffDelay = this.baseRetryDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 0.1 * backoffDelay;
        const totalDelay = backoffDelay + jitter;

        this.logger.warn(
          `Library integration attempt ${attempt} failed, retrying in ${Math.round(totalDelay)}ms`,
          {
            orderId: payload.orderId,
            error: error.message,
            nextAttempt: attempt + 1,
            delay: Math.round(totalDelay),
          },
        );

        await new Promise((resolve) => setTimeout(resolve, totalDelay));
      }
    }

    throw lastError;
  }

  async checkHealth(): Promise<{ status: string }> {
    const startTime = Date.now();
    const url = `${this.libraryServiceUrl}/api/health`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(timeout(2000)),
      );

      const duration = (Date.now() - startTime) / 1000;
      const isHealthy = response.data?.status === 'ok';

      this.metricsService.recordIntegrationRequest(
        'library',
        'healthCheck',
        isHealthy ? 'success' : 'failed',
      );
      this.metricsService.recordIntegrationDuration(
        'library',
        'healthCheck',
        duration,
      );

      return { status: isHealthy ? 'up' : 'down' };
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;

      this.logger.error(
        `Library Service health check failed: ${error?.message || 'Unknown error'}`,
        {
          error: error?.message || 'Unknown error',
          duration,
        },
      );

      this.metricsService.recordIntegrationRequest(
        'library',
        'healthCheck',
        'error',
      );
      this.metricsService.recordIntegrationDuration(
        'library',
        'healthCheck',
        duration,
      );

      return { status: 'down' };
    }
  }
}
