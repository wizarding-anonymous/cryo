import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { In } from 'typeorm';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { CategoryRepository } from '../../infrastructure/persistence/category.repository';
import { TagRepository } from '../../infrastructure/persistence/tag.repository';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { CreateGameDto } from '../../infrastructure/http/dtos/create-game.dto';
import { UpdateGameDto } from '../../infrastructure/http/dtos/update-game.dto';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';
import { SearchService } from './search.service';
import { AnalyticsService } from './analytics.service';
import { EventPublisherService } from './event-publisher.service';

@Injectable()
@UseInterceptors(CacheInterceptor)
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly categoryRepository: CategoryRepository,
    private readonly tagRepository: TagRepository,
    private readonly searchService: SearchService,
    private readonly analyticsService: AnalyticsService,
    private readonly eventPublisher: EventPublisherService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @CacheTTL(60 * 5) // 5 minutes
  async findAll(paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    return this.gameRepository.findAll(paginationDto);
  }

  @CacheTTL(60 * 5) // 5 minutes
  async findByDeveloper(developerId: string, paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    return this.gameRepository.findByDeveloper(developerId, paginationDto);
  }

  @CacheTTL(60 * 60) // 1 hour
  async findOne(id: string): Promise<Game | null> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    // This part should not be cached, so it's a trade-off.
    // A better approach might be to track views via a separate, non-cached endpoint or event.
    this.analyticsService.trackGameView(id);
    return game;
  }

  async create(createGameDto: CreateGameDto, developerId: string): Promise<Game> {
    const { categoryIds, tagIds, ...rest } = createGameDto;
    const game = new Game();
    Object.assign(game, rest);
    game.developerId = developerId;

    if (categoryIds && categoryIds.length > 0) {
      game.categories = await this.categoryRepository.findByIds(categoryIds);
    }
    if (tagIds && tagIds.length > 0) {
      game.tags = await this.tagRepository.findByIds(tagIds);
    }

    game.slug = await this.generateUniqueSlug(createGameDto.title);

    const newGame = await this.gameRepository.create(game);
    await this.searchService.indexGame(newGame);
    await this.invalidateCache();
    return newGame;
  }

  async update(id: string, updateGameDto: UpdateGameDto, developerId: string): Promise<Game> {
    const { categoryIds, tagIds, ...rest } = updateGameDto;
    const game = await this.findOne(id);

    if (game.developerId !== developerId) {
        throw new ForbiddenException('You do not have permission to update this game.');
    }

    Object.assign(game, rest);

    if (categoryIds) {
        game.categories = await this.categoryRepository.findByIds(categoryIds);
    }
    if (tagIds) {
        game.tags = await this.tagRepository.findByIds(tagIds);
    }

    if (updateGameDto.title && updateGameDto.title !== game.title) {
        game.slug = await this.generateUniqueSlug(updateGameDto.title);
    }

    const updatedGame = await this.gameRepository.save(game);
    await this.searchService.indexGame(updatedGame);
    await this.invalidateCache();
    return updatedGame;
  }

  private async generateUniqueSlug(title: string): Promise<string> {
    let slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // remove special characters
      .replace(/\s+/g, '-') // replace spaces with hyphens
      .replace(/-+/g, '-'); // remove consecutive hyphens

    let existingGame = await this.gameRepository.findBySlug(slug);
    let counter = 1;
    while (existingGame) {
      const newSlug = `${slug}-${counter}`;
      existingGame = await this.gameRepository.findBySlug(newSlug);
      if (!existingGame) {
        slug = newSlug;
      }
      counter++;
    }
    return slug;
  }

  async remove(id: string, developerId: string): Promise<void> {
    const game = await this.findOne(id);
    if (game.developerId !== developerId) {
        throw new ForbiddenException('You do not have permission to delete this game.');
    }
    await this.gameRepository.remove(game);
    await this.searchService.removeGame(id);
    await this.invalidateCache();
  }

  async submitForModeration(id: string, developerId: string): Promise<Game> {
    const game = await this.findOne(id);
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
    return updatedGame;
  }

  async getModerationQueue(paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    return this.gameRepository.findByStatus(GameStatus.PENDING_REVIEW, paginationDto);
  }

  async approveGame(id: string): Promise<Game> {
    const game = await this.findOne(id);
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
    const game = await this.findOne(id);
    if (game.status !== GameStatus.PENDING_REVIEW) {
      throw new BadRequestException(`Game is not pending review.`);
    }
    game.status = GameStatus.REJECTED;
    // We would store the rejection reason in a separate field/table in a real app
    console.log(`Game ${id} rejected. Reason: ${reason}`);
    const updatedGame = await this.gameRepository.save(game);
    await this.searchService.indexGame(updatedGame);
    await this.invalidateCache();
    this.eventPublisher.publish({ type: 'game.rejected', payload: { gameId: updatedGame.id, reason } });
    return updatedGame;
  }

  private async invalidateCache() {
    // This is a naive way to invalidate cache. A more robust solution
    // would involve more granular invalidation based on keys.
    // For example, invalidating specific pages of findAll results.
    const keys = await this.cacheManager.store.keys('game-catalog-service*');
    if (keys.length > 0) {
      await this.cacheManager.store.del(keys);
    }
  }
}
