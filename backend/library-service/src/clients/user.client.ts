import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, retry, catchError, of } from 'rxjs';

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly baseUrl: string;
  private readonly retryAttempts = 3;
  private readonly retryDelay = 300;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const configuredBaseUrl = this.configService.get<string>('services.user.url');
    if (!configuredBaseUrl) {
      throw new Error('User service URL is not configured');
    }
    this.baseUrl = configuredBaseUrl;
  }

  async doesUserExist(userId: string): Promise<boolean> {
    const url = `${this.baseUrl}/users/${userId}/exists`;

    const request$ = this.httpService.get<{ exists: boolean }>(url).pipe(
      retry({ count: this.retryAttempts, delay: this.retryDelay }),
      catchError((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to check existence for user ${userId} after ${this.retryAttempts} attempts: ${message}`,
        );
        return of({ data: { exists: false } });
      }),
    );

    const response = await firstValueFrom(request$);
    return response.data.exists === true;
  }
}
