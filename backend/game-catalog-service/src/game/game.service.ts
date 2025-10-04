import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../entities/game.entity';
import { IGameService } from '../interfaces/game-service.interface';
import { GetGamesDto } from '../dto/get-games.dto';
import { GameListResponse } from '../interfaces/game.interface';
import { CreateGameDto } from '../dto/create-game.dto';
import { UpdateGameDto } from '../dto/update-game.dto';
import { PurchaseInfoDto } from '../dto/purchase-info.dto';
import { CacheService } from '../common/services/cache.service';

@Injectable()
export class GameService implements IGameService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    private readonly cacheService: CacheService,
  ) {}

  async getAllGames(getGamesDto: GetGamesDto): Promise<GameListResponse> {
    const { page, limit, sortBy, sortOrder, genre, available } = getGamesDto;
    const skip = (page - 1) * limit;

    // Build where clause with business logic for availability
    const whereClause: Record<string, unknown> = {};

    // Default to showing only available games unless explicitly requested otherwise
    if (available !== undefined) {
      whereClause.available = available;
    } else {
      whereClause.available = true; // Business rule: default to available games only
    }

    // Add genre filter if provided
    if (genre) {
      whereClause.genre = genre;
    }

    // Build order clause
    const orderClause: Record<string, 'ASC' | 'DESC'> = {};
    if (sortBy && sortOrder) {
      orderClause[sortBy] = sortOrder;
    } else {
      orderClause.releaseDate = 'DESC'; // Default sorting
    }

    const [games, total] = await this.gameRepository.findAndCount({
      where: whereClause,
      take: limit,
      skip: skip,
      order: orderClause,
    });

    return {
      games,
      total,
      page,
      limit,
      hasNext: total > page * limit,
    };
  }

  async getGameById(id: string): Promise<Game> {
    // Business logic: Only return available games by default
    const game = await this.gameRepository.findOneBy({ id, available: true });
    if (!game) {
      // Check if game exists but is unavailable for better error messaging
      const unavailableGame = await this.gameRepository.findOneBy({ id });
      if (unavailableGame && !unavailableGame.available) {
        throw new NotFoundException(
          `Game with ID "${id}" is currently unavailable`,
        );
      }
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    return game;
  }

  async getGameDetails(id: string): Promise<Game> {
    return this.getGameById(id);
  }

  async createGame(createGameDto: CreateGameDto): Promise<Game> {
    const newGame = this.gameRepository.create(createGameDto);
    const savedGame = await this.gameRepository.save(newGame);

    // Invalidate relevant caches
    await this.cacheService.invalidateGameCache();

    return savedGame;
  }

  async updateGame(id: string, updateGameDto: UpdateGameDto): Promise<Game> {
    const game = await this.gameRepository.preload({
      id: id,
      ...updateGameDto,
    });
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }

    const updatedGame = await this.gameRepository.save(game);

    // Invalidate caches for this specific game and general game lists
    await this.cacheService.invalidateGameCache(id);

    return updatedGame;
  }

  async deleteGame(id: string): Promise<void> {
    const result = await this.gameRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }

    // Invalidate caches for this specific game and general game lists
    await this.cacheService.invalidateGameCache(id);
  }

  async getGamePurchaseInfo(id: string): Promise<PurchaseInfoDto> {
    const game = await this.getGameById(id);
    // Business logic: Additional availability check for purchase operations
    if (!game.available) {
      throw new NotFoundException(
        `Game with ID "${id}" is not available for purchase`,
      );
    }
    // The getGameById method already throws a NotFoundException if the game is not found or unavailable.
    return new PurchaseInfoDto(game);
  }
}
