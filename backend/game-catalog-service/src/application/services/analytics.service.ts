import { Injectable, Logger } from '@nestjs/common';
import { GameRepository } from '../../infrastructure/persistence/game.repository';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(private readonly gameRepository: GameRepository) {}

    async trackGameView(gameId: string): Promise<void> {
        // This is a simplified implementation. A real implementation would
        // likely send an event to a Kafka topic, which would be consumed
        // by a dedicated analytics service.
        try {
            const game = await this.gameRepository.findById(gameId);
            if (game) {
                // In a real app, this would be an atomic increment operation.
                // game.viewsCount = (game.viewsCount || 0) + 1;
                // await this.gameRepository.save(game);
                this.logger.log(`Tracked view for game: ${gameId}`);
            }
        } catch (error) {
            this.logger.error(`Failed to track view for game ${gameId}`, error.stack);
        }
    }
}
