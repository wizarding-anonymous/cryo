import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError, of, retry } from 'rxjs';
import { AddGameToLibraryDto } from './dto/add-game-to-library.dto';

@Injectable()
export class LibraryIntegrationService {
  private readonly logger = new Logger(LibraryIntegrationService.name);
  private readonly libraryServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.libraryServiceUrl = this.configService.get<string>('LIBRARY_SERVICE_URL');
  }

  async addGameToLibrary(payload: AddGameToLibraryDto): Promise<boolean> {
    const url = `${this.libraryServiceUrl}/api/library/add`;
    this.logger.log(`Adding game ${payload.gameId} to library for user ${payload.userId}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(url, payload).pipe(
          timeout(8000),
          retry(3), // Retry 3 times
          catchError(err => {
            this.logger.error(
              `Error adding game ${payload.gameId} to library: ${err.message}`,
              err.stack,
            );
            return of(null);
          }),
        ),
      );

      if (!response || response.status !== 201) {
        this.logger.error(`Failed to add game ${payload.gameId} to library. Status: ${response?.status}`);
        return false;
      }

      this.logger.log(`Successfully added game ${payload.gameId} to library for user ${payload.userId}`);
      return true;
    } catch (error) {
      this.logger.error(`Unhandled exception when calling Library Service: ${error.message}`);
      return false;
    }
  }

  async checkHealth(): Promise<{ status: string }> {
    const url = `${this.libraryServiceUrl}/api/health`;
    try {
      const response = await firstValueFrom(
        this.httpService.get(url).pipe(timeout(2000)),
      );
      return { status: response.data?.status === 'ok' ? 'up' : 'down' };
    } catch (error) {
      this.logger.error(`Library Service health check failed: ${error.message}`);
      return { status: 'down' };
    }
  }
}
