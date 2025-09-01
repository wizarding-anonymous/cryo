import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEdition } from '../../domain/entities/game-edition.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class EditionService {
  constructor(
    @InjectRepository(GameEdition)
    private readonly editionRepository: Repository<GameEdition>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async createEdition(gameId: string, editionData: Partial<GameEdition>): Promise<GameEdition> {
    const game = await this.gameRepository.findOneBy({ id: gameId });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    const edition = this.editionRepository.create({
      ...editionData,
      gameId,
    });

    return this.editionRepository.save(edition);
  }

  async findEditionsForGame(gameId: string): Promise<GameEdition[]> {
    return this.editionRepository.find({ where: { gameId } });
  }
}
