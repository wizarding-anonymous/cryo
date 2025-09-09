import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEdition } from '../../domain/entities/game-edition.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { CreateEditionDto } from '../../infrastructure/http/dtos/create-edition.dto';
import { UpdateEditionDto } from '../../infrastructure/http/dtos/update-edition.dto';

@Injectable()
export class EditionService {
  constructor(
    @InjectRepository(GameEdition)
    private readonly editionRepository: Repository<GameEdition>,
    private readonly gameRepository: GameRepository,
  ) {}

  async create(createEditionDto: CreateEditionDto): Promise<GameEdition> {
    const game = await this.gameRepository.findById(createEditionDto.gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${createEditionDto.gameId}" not found.`);
    }

    const edition = this.editionRepository.create({
      ...createEditionDto,
      game,
    });

    return this.editionRepository.save(edition);
  }

  async findOne(id: string): Promise<GameEdition> {
    const edition = await this.editionRepository.findOne({ where: { id }, relations: ['game'] });
    if (!edition) {
      throw new NotFoundException(`Edition with ID "${id}" not found.`);
    }
    return edition;
  }

  async update(id: string, updateEditionDto: UpdateEditionDto): Promise<GameEdition> {
    const edition = await this.findOne(id);
    Object.assign(edition, updateEditionDto);
    return this.editionRepository.save(edition);
  }

  async remove(id: string): Promise<void> {
    const edition = await this.findOne(id);
    await this.editionRepository.remove(edition);
  }

  async compareEditions(gameId: string): Promise<GameEdition[]> {
    return this.editionRepository.find({
      where: { gameId },
      order: { price: 'ASC' }, // Sort by price by default for comparison
    });
  }

  async calculateUpgradePrice(fromEditionId: string, toEditionId: string): Promise<{ upgradePrice: number }> {
    const fromEdition = await this.findOne(fromEditionId);
    const toEdition = await this.findOne(toEditionId);

    if (fromEdition.gameId !== toEdition.gameId) {
      throw new Error('Editions must be for the same game.');
    }

    if (fromEdition.price >= toEdition.price) {
      return { upgradePrice: 0 };
    }

    const upgradePrice = toEdition.price - fromEdition.price;
    return { upgradePrice };
  }
}
