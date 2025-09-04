import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { GameRepository } from '../../infrastructure/persistence/game.repository';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(private readonly gameRepository: GameRepository) {}

    async trackGameView(gameId: string): Promise<void> {
        try {
            // Using an atomic increment operation is better for performance and to avoid race conditions.
            await this.gameRepository.increment(gameId, 'viewsCount', 1);
            this.logger.log(`Tracked view for game: ${gameId}`);
        } catch (error) {
            // It's possible the game doesn't exist, which `increment` might throw on.
            // Or the DB could be down. We log the error but don't throw, as failing
            // to track analytics should not break the user-facing flow.
            this.logger.error(`Failed to track view for game ${gameId}`, error.stack);
        }
    }

    async trackSale(gameId: string, amount: number): Promise<void> {
        this.logger.log(`Received sale event for game ${gameId} with amount ${amount}`);
        try {
            // In a real system, sales data might be stored in a separate analytics database
            // for more complex analysis. For now, we'll just increment a counter.
            // This assumes a 'salesCount' property exists on the Game entity.
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
        // Storing every search query might be expensive. A better approach for a real
        // system would be to send this to a dedicated logging/analytics pipeline (e.g., ELK stack)
        // where it can be aggregated and analyzed. For this task, we'll just log it.
        this.logger.log(`Search performed: Query='${query}', Results=${resultCount}`);
    }
}
