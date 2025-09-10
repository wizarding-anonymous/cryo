import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface GreenlightStatus {
  gameId: string;
  status: 'submitted' | 'voting' | 'approved' | 'rejected' | 'graduated';
  votesFor: number;
  votesAgainst: number;
  submissionDate: Date;
  approvalDate?: Date;
}

@Injectable()
export class GreenlightServiceClient {
  private readonly logger = new Logger(GreenlightServiceClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('GREENLIGHT_SERVICE_URL', 'http://greenlight-service:3000');
  }

  async getGreenlightStatus(gameId: string): Promise<GreenlightStatus | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/greenlight/game/${gameId}`)
      );
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      this.logger.error(`Failed to get Greenlight status for game ${gameId}:`, error.message);
      throw error;
    }
  }

  async submitToGreenlight(gameData: GameSubmissionDto): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/greenlight/submit`, gameData)
      );
      this.logger.log(`Game ${gameData.gameId} submitted to Greenlight`);
    } catch (error) {
      this.logger.error(`Failed to submit game ${gameData.gameId} to Greenlight:`, error.message);
      throw error;
    }
  }

  async handleGreenlightApproved(gameId: string): Promise<void> {
    this.logger.log(`Game ${gameId} approved through Greenlight`);
    // Здесь можно добавить логику обновления статуса игры на "Greenlight Graduate"
  }
}