import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';
import { SearchService } from './search.service';
import { EventPublisherService } from './event-publisher.service';

@Injectable()
export class ModerationService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly searchService: SearchService,
    private readonly eventPublisher: EventPublisherService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getModerationQueue(paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    return this.gameRepository.findByStatus(GameStatus.PENDING_REVIEW, paginationDto);
  }

  async approveGame(id: string): Promise<Game> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    if (game.status !== GameStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Game is not pending review.`);
    }

    await this.runAutomaticChecks(game);

    game.status = GameStatus.PUBLISHED;
    const updatedGame = await this.gameRepository.save(game);

    await this.searchService.indexGame(updatedGame);
    await this.invalidateCache();
    this.eventPublisher.publish({ type: 'game.approved', payload: { gameId: updatedGame.id } });

    return updatedGame;
  }

  async rejectGame(id: string, reason: string): Promise<Game> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
        throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    if (game.status !== GameStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Game is not pending review.`);
    }

    game.status = GameStatus.REJECTED;
    // In a real application, this reason would be stored in a dedicated moderation history table.
    game.moderationNotes = reason;

    const updatedGame = await this.gameRepository.save(game);
    await this.searchService.indexGame(updatedGame);
    await this.invalidateCache();
    this.eventPublisher.publish({ type: 'game.rejected', payload: { gameId: updatedGame.id, reason } });

    return updatedGame;
  }

  /**
   * Placeholder for automatic content checks against Russian legislation.
   * This could involve checks for forbidden keywords, image analysis, etc.
   * @param game The game to check.
   */
  private async runAutomaticChecks(game: Game): Promise<void> {
    console.log(`Running automatic compliance checks for game: ${game.title}`);
    // Example: Check for forbidden words in title or description
    const forbiddenWords = ['word1', 'word2', 'запрещенка'];
    const content = `${game.title} ${game.description}`.toLowerCase();
    for (const word of forbiddenWords) {
      if (content.includes(word)) {
        // In a real scenario, this would trigger a more complex flow,
        // maybe auto-rejecting or flagging for senior moderator review.
        throw new BadRequestException(`Game contains forbidden content: ${word}`);
      }
    }
    // This is a simplified placeholder. A real implementation would be much more complex.
    console.log(`Automatic checks passed for game: ${game.title}`);
  }

  private async invalidateCache() {
    const keys = await this.cacheManager.store.keys('game-catalog-service*');
    if (keys.length > 0) {
      await this.cacheManager.store.del(keys);
    }
  }
}
