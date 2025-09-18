import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class OwnershipService {
  private readonly logger = new Logger(OwnershipService.name);
  private libraryServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // It's a good practice to fetch this from a dedicated app config structure
    this.libraryServiceUrl = this.configService.get<string>('LIBRARY_SERVICE_URL');
  }

  async checkGameOwnership(userId: string, gameId: string): Promise<boolean> {
    if (!this.libraryServiceUrl) {
      this.logger.error('LIBRARY_SERVICE_URL is not configured. Denying ownership check by default.');
      return false;
    }

    const url = `${this.libraryServiceUrl}/api/library/user/${userId}/owns/${gameId}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get<{ owns: boolean }>(url, {
          // recommended by axios-http-adapter to avoid issues
          headers: { 'Accept-Encoding': 'gzip,deflate,compress' },
        }),
      );
      return response.data.owns;
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to check game ownership for user ${userId} on game ${gameId}. URL: ${url}. Error: ${axiosError.message}`,
        axiosError.stack,
      );
      // To be safe, if the external service is down or there's an error, deny the action.
      return false;
    }
  }
}
