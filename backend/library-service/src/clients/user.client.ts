import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class UserServiceClient {
  private readonly logger = new Logger(UserServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get('services.user.url');
  }

  async doesUserExist(userId: string): Promise<boolean> {
    const url = `${this.baseUrl}/users/${userId}/exists`;

    // Retry and circuit breaker logic would be applied here as well.
    try {
      const response = await firstValueFrom(this.httpService.get(url));
      return response.data.exists === true;
    } catch (error) {
      this.logger.error(`Failed to check existence for user ${userId}: ${error.message}`);
      return false;
    }
  }
}
