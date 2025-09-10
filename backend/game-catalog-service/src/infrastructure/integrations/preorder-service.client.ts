import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface PreorderStatus {
    gameId: string;
    isAvailable: boolean;
    tiers: PreorderTier[];
    startDate: Date;
    releaseDate: Date;
}

export interface PreorderTier {
    id: string;
    name: string;
    price: number;
    bonuses: string[];
}

export interface GameSubmissionDto {
    gameId: string;
    title: string;
    description: string;
    releaseDate: Date;
    price: number;
}

@Injectable()
export class PreorderServiceClient {
    private readonly logger = new Logger(PreorderServiceClient.name);
    private readonly baseUrl: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.baseUrl = this.configService.get<string>('PREORDER_SERVICE_URL', 'http://preorder-service:3000');
    }

    async getPreorderStatus(gameId: string): Promise<PreorderStatus | null> {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.baseUrl}/preorders/game/${gameId}`)
            );
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                return null;
            }
            this.logger.error(`Failed to get preorder status for game ${gameId}:`, error.message);
            throw error;
        }
    }

    async submitGameForPreorder(gameData: GameSubmissionDto): Promise<void> {
        try {
            await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/preorders/submit`, gameData)
            );
            this.logger.log(`Game ${gameData.gameId} submitted for preorder`);
        } catch (error) {
            this.logger.error(`Failed to submit game ${gameData.gameId} for preorder:`, error.message);
            throw error;
        }
    }

    async handlePreorderFulfilled(gameId: string, preorderData: any): Promise<void> {
        this.logger.log(`Preorder fulfilled for game ${gameId}:`, preorderData);
        // Здесь можно добавить логику обновления статуса игры
    }
}