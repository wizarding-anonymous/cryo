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

@Injectable()
export class GameService implements IGameService {
  constructor(
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async getAllGames(getGamesDto: GetGamesDto): Promise<GameListResponse> {
    const { page, limit } = getGamesDto;
    const skip = (page - 1) * limit;

    const [games, total] = await this.gameRepository.findAndCount({
      where: { available: true },
      take: limit,
      skip: skip,
      order: {
        releaseDate: 'DESC',
      },
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
    const game = await this.gameRepository.findOneBy({ id, available: true });
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    return game;
  }

  async getGameDetails(id: string): Promise<Game> {
    return this.getGameById(id);
  }

  async createGame(createGameDto: CreateGameDto): Promise<Game> {
    const newGame = this.gameRepository.create(createGameDto);
    return this.gameRepository.save(newGame);
  }

  async updateGame(id: string, updateGameDto: UpdateGameDto): Promise<Game> {
    const game = await this.gameRepository.preload({
      id: id,
      ...updateGameDto,
    });
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
    return this.gameRepository.save(game);
  }

  async deleteGame(id: string): Promise<void> {
    const result = await this.gameRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
  }

  async getGamePurchaseInfo(id: string): Promise<PurchaseInfoDto> {
    const game = await this.getGameById(id);
    // The getGameById method already throws a NotFoundException if the game is not found or unavailable.
    return new PurchaseInfoDto(game);
  }
}
