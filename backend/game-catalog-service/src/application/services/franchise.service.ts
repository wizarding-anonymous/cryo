import { Injectable, NotFoundException } from '@nestjs/common';
import { FranchiseRepository } from '../../infrastructure/persistence/franchise.repository';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Franchise } from '../../domain/entities/franchise.entity';
import { CreateFranchiseDto } from '../../infrastructure/http/dtos/create-franchise.dto';
import { UpdateFranchiseDto } from '../../infrastructure/http/dtos/update-franchise.dto';

@Injectable()
export class FranchiseService {
  constructor(
    private readonly franchiseRepository: FranchiseRepository,
    private readonly gameRepository: GameRepository,
  ) {}

  async create(createFranchiseDto: CreateFranchiseDto): Promise<Franchise> {
    const { gameIds, ...franchiseData } = createFranchiseDto;
    const franchise = new Franchise();
    Object.assign(franchise, franchiseData);

    if (gameIds && gameIds.length > 0) {
      const games = await this.gameRepository.findByIds(gameIds);
      if (games.length !== gameIds.length) {
        throw new NotFoundException('One or more games not found for the franchise.');
      }
      franchise.games = games;
    }

    return this.franchiseRepository.create(franchise);
  }

  async findOne(id: string): Promise<Franchise> {
    const franchise = await this.franchiseRepository.findById(id);
    if (!franchise) {
      throw new NotFoundException(`Franchise with ID "${id}" not found`);
    }
    return franchise;
  }

  async update(id: string, updateFranchiseDto: UpdateFranchiseDto): Promise<Franchise> {
    const { gameIds, ...franchiseData } = updateFranchiseDto;
    const franchise = await this.findOne(id);
    Object.assign(franchise, franchiseData);

    if (gameIds) {
      const games = await this.gameRepository.findByIds(gameIds);
      if (games.length !== gameIds.length) {
        throw new NotFoundException('One or more games not found for the franchise.');
      }
      franchise.games = games;
    }

    return this.franchiseRepository.save(franchise);
  }

  async remove(id: string): Promise<void> {
    const franchise = await this.findOne(id);
    await this.franchiseRepository.remove(franchise);
  }
}
