import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GameRepository } from '../../infrastructure/persistence/game.repository';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(private readonly gameRepository: GameRepository) {}

    async trackGameView(gameId: string): Promise<void> {
        try {
            await this.gameRepository.increment(gameId, 'viewsCount', 1);
            this.logger.log(`Tracked view for game: ${gameId}`);
        } catch (error) {
            this.logger.error(`Failed to track view for game ${gameId}`, error.stack);
        }
    }

    async trackSale(gameId: string, amount: number): Promise<void> {
        this.logger.log(`Received sale event for game ${gameId} with amount ${amount}`);
        try {
            await this.gameRepository.increment(gameId, 'salesCount', 1);
            this.logger.log(`Tracked sale for game: ${gameId}`);
        } catch (error) {
            this.logger.error(`Failed to track sale for game ${gameId}`, error.stack);
        }
    }

    async trackDownload(gameId: string): Promise<void> {
        this.logger.log(`Received download event for game ${gameId}`);
        try {
            await this.gameRepository.increment(gameId, 'downloadCount', 1);
            this.logger.log(`Tracked download for game: ${gameId}`);
        } catch (error) {
            this.logger.error(`Failed to track download for game ${gameId}`, error.stack);
        }
    }

    async trackSearchQuery(query: string, resultCount: number): Promise<void> {
        this.logger.log(`Search performed: Query='${query}', Results=${resultCount}`);
    }
}
