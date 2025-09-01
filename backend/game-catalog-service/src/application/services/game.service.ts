import { Injectable, NotFoundException } from '@nestjs/common';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Game } from '../../domain/entities/game.entity';
import { CreateGameDto } from '../../infrastructure/http/dtos/create-game.dto';
import { UpdateGameDto } from '../../infrastructure/http/dtos/update-game.dto';
import { PaginationDto } from '../../infrastructure/http/dtos/pagination.dto';
import { SearchService } from './search.service';

@Injectable()
export class GameService {
  constructor(
    private readonly gameRepository: GameRepository,
    private readonly searchService: SearchService,
    ) {}

  async findAll(paginationDto: PaginationDto): Promise<{ data: Game[], total: number }> {
    return this.gameRepository.findAll(paginationDto);
  }

  async findOne(id: string): Promise<Game | null> {
    const game = await this.gameRepository.findById(id);
    if (!game) {
      throw new NotFoundException(`Game with ID "${id}" not found`);
    }
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
}
