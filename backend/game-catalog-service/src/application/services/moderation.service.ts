import { Injectable, NotFoundException, BadRequestException, Inject, ForbiddenException } from '@nestjs/common';
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

  async submitForModeration(id: string, developerId: string): Promise<Game> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    if (game.developerId !== developerId) {
      throw new ForbiddenException('You do not own this game.');
    }
    if (game.status !== GameStatus.DRAFT && game.status !== GameStatus.REJECTED) {
      throw new ForbiddenException(`Game cannot be submitted for moderation in its current state: ${game.status}`);
    }
    game.status = GameStatus.PENDING_REVIEW;
    const updatedGame = await this.gameRepository.save(game);
    await this.searchService.indexGame(updatedGame);
    await this.invalidateCache();
    this.eventPublisher.publish({ type: 'game.submitted', payload: { gameId: updatedGame.id } });
    return updatedGame;
  }

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
    game.moderationNotes = reason;

    const updatedGame = await this.gameRepository.save(game);
    await this.searchService.indexGame(updatedGame);
    await this.invalidateCache();
    this.eventPublisher.publish({ type: 'game.rejected', payload: { gameId: updatedGame.id, reason } });

    return updatedGame;
  }

  private async invalidateCache() {
    const keys = await this.cacheManager.store.keys('game-catalog-service*');
    if (keys.length > 0) {
      await this.cacheManager.store.del(keys);
    }
  }
}
