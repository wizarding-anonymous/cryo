import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Franchise } from '../../domain/entities/franchise.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class FranchiseService {
  constructor(
    @InjectRepository(Franchise)
    private readonly franchiseRepository: Repository<Franchise>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async createFranchise(franchiseData: Partial<Franchise>, gameIds: string[]): Promise<Franchise> {
    const games = await this.gameRepository.findBy({ id: In(gameIds) });
    if (games.length !== gameIds.length) {
      throw new NotFoundException('One or more games not found');
    }

    const franchise = this.franchiseRepository.create({
      ...franchiseData,
      games,
    });

    return this.franchiseRepository.save(franchise);
  }

  async findFranchiseById(id: string): Promise<Franchise | null> {
    return this.franchiseRepository.findOne({ where: { id }, relations: ['games'] });
  }

  async addGameToFranchise(franchiseId: string, gameId: string): Promise<Franchise> {
    const franchise = await this.findFranchiseById(franchiseId);
    if (!franchise) {
        throw new NotFoundException(`Franchise with ID "${franchiseId}" not found`);
    }
    const game = await this.gameRepository.findOneBy({ id: gameId });
    if (!game) {
        throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    franchise.games.push(game);
    return this.franchiseRepository.save(franchise);
  }
}
