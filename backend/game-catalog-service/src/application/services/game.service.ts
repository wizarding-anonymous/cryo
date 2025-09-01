import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Game, GameStatus } from '../../domain/entities/game.entity';
import { CreateGameDto } from '../../infrastructure/http/dtos/create-game.dto';
import { UpdateGameDto } from '../../infrastructure/http/dtos/update-game.dto';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';
import { SearchService } from './search.service';
import { AnalyticsService } from './analytics.service';

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly searchService: SearchService,
    private readonly analyticsService: AnalyticsService,
    ) {}

  async findAll(paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    return this.gameRepository.findAll(paginationDto);
  }

  async findByDeveloper(developerId: string, paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    return this.gameRepository.findByDeveloper(developerId, paginationDto);
  }

  async findOne(id: string): Promise<Game | null> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    this.analyticsService.trackGameView(id);
    return game;
  }

  async create(createGameDto: CreateGameDto): Promise<Game> {
    const game = new Game();
    Object.assign(game, createGameDto);
    // This is a simplified mapping. A real implementation might use a mapper class.
    // Also, slug generation should be handled here.
    game.slug = createGameDto.title.toLowerCase().replace(/ /g, '-');
    const newGame = await this.gameRepository.create(game);
    await this.searchService.indexGame(newGame);
    return newGame;
  }

  async update(id: string, updateGameDto: UpdateGameDto): Promise<Game> {
    const game = await this.findOne(id);
    Object.assign(game, updateGameDto);
    if (updateGameDto.title) {
        game.slug = updateGameDto.title.toLowerCase().replace(/ /g, '-');
    }
    const updatedGame = await this.gameRepository.save(game);
    await this.searchService.indexGame(updatedGame);
    return updatedGame;
  }

  async remove(id: string): Promise<void> {
    const game = await this.findOne(id);
    await this.gameRepository.remove(game);
    await this.searchService.removeGame(id);
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
    // In a real app, we would also emit an event here e.g. GameApprovedEvent
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
    // In a real app, we would also emit an event here e.g. GameRejectedEvent
    return updatedGame;
  }
}
