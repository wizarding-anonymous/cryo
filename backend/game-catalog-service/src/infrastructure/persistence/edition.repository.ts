import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEdition } from '../../domain/entities/game-edition.entity';

@Injectable()
export class EditionRepository {
  constructor(
    @InjectRepository(GameEdition)
    private readonly editionRepository: Repository<GameEdition>,
  ) {}

  async findById(id: string): Promise<GameEdition | null> {
    return this.editionRepository.findOneBy({ id });
  }

  async create(edition: Partial<GameEdition>): Promise<GameEdition> {
    const newEdition = this.editionRepository.create(edition);
    return this.editionRepository.save(newEdition);
  }

  async save(edition: GameEdition): Promise<GameEdition> {
    return this.editionRepository.save(edition);
  }

  async remove(edition: GameEdition): Promise<void> {
    await this.editionRepository.remove(edition);
  }
}
