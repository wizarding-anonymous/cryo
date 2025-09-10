import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class GameKeysServiceClient {
  private readonly logger = new Logger(GameKeysServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('GAME_KEYS_SERVICE_URL', 'http://game-keys-service:3000');
  }

  async checkKeyActivationSupport(gameId: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/keys/game/${gameId}/support`)
      );
      return response.data.supported;
    } catch (error) {
      this.logger.error(`Failed to check key activation support for game ${gameId}:`, error.message);
      return false;
    }
  }

  async handleKeyActivated(gameId: string, keyData: any): Promise<void> {
    this.logger.log(`Key activated for game ${gameId}:`, keyData);
    // Здесь можно добавить логику обновления статистики игры
  }
}