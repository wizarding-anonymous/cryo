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
import { LocalizationService } from './localization.service';

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
    private readonly localizationService: LocalizationService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @CacheTTL(60 * 5) // 5 minutes
  async findAll(paginationDto: PaginationDto, languageHeader?: string): Promise<{ data: Game[], total: number }> {
    const { data, total } = await this.gameRepository.findAll(paginationDto);

    if (!languageHeader || data.length === 0) {
      return { data, total };
    }

    const languageCode = this.localizationService.getLanguageFromHeader(languageHeader);
    const gameIds = data.map(g => g.id);
    const translationsMap = await this.localizationService.getTranslationsForGames(gameIds, languageCode);

    const localizedData = data.map(game => {
      const translation = translationsMap.get(game.id);
      return this.localizationService.applyTranslation(game, translation);
    });

    return { data: localizedData, total };
  }

  @CacheTTL(60 * 5) // 5 minutes
  async findByDeveloper(developerId: string, paginationDto: PaginationDto, languageHeader?: string): Promise<{ data: Game[], total: number }> {
    const { data, total } = await this.gameRepository.findByDeveloper(developerId, paginationDto);

    if (!languageHeader || data.length === 0) {
      return { data, total };
    }

    const languageCode = this.localizationService.getLanguageFromHeader(languageHeader);
    const gameIds = data.map(g => g.id);
    const translationsMap = await this.localizationService.getTranslationsForGames(gameIds, languageCode);

    const localizedData = data.map(game => {
      const translation = translationsMap.get(game.id);
      return this.localizationService.applyTranslation(game, translation);
    });

    return { data: localizedData, total };
  }

  @CacheTTL(60 * 60) // 1 hour
  async findOne(id: string, languageHeader?: string): Promise<Game | null> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }

    this.analyticsService.trackGameView(id);

    if (!languageHeader) {
      return game;
    }

    const languageCode = this.localizationService.getLanguageFromHeader(languageHeader);
    const translation = await this.localizationService.getTranslationWithFallback(id, languageCode);

    return this.localizationService.applyTranslation(game, translation);
  }

  async create(createGameDto: CreateGameDto, developerId: string): Promise<Game> {
    const { categoryIds, tagIds, ...rest } = createGameDto;
    const game = new Game();
    Object.assign(game, rest);
    game.developerId = developerId;

    // TODO: Fetch real names from User Service or an aggregated source
    game.developerName = 'Developer Name Placeholder';
    if (game.publisherId) {
      game.publisherName = 'Publisher Name Placeholder';
    }

    if (categoryIds && categoryIds.length > 0) {
      game.categories = await this.categoryRepository.findByIds(categoryIds);
    }
    if (tagIds && tagIds.length > 0) {
      game.tags = await this.tagRepository.findByIds(tagIds);
    }

    game.slug = await this.generateUniqueSlug(createGameDto.title);

    game.averageRating = 0;
    game.reviewsCount = 0;

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

    // TODO: Fetch real publisher name if publisherId is updated
    if (updateGameDto.publisherId) {
      game.publisherName = 'New Publisher Name Placeholder';
    }

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


  async getDeveloperGameAnalytics(id: string, developerId: string): Promise<GameAnalyticsDto> {
    const game = await this.findOne(id);

    if (game.developerId !== developerId) {
      throw new ForbiddenException('You do not have permission to view analytics for this game.');
    }

    return {
      gameId: game.id,
      title: game.title,
      viewsCount: game.viewsCount || 0,
      salesCount: game.salesCount || 0,
      downloadCount: game.downloadCount || 0,
      averageRating: game.averageRating || 0,
      reviewsCount: game.reviewsCount || 0,
    };
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
