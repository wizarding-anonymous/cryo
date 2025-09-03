import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FranchiseRepository } from '../../infrastructure/persistence/franchise.repository';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Franchise } from '../../domain/entities/franchise.entity';
import { FranchiseGame } from '../../domain/entities/franchise-game.entity';
import { CreateFranchiseDto } from '../../infrastructure/http/dtos/create-franchise.dto';
import { UpdateFranchiseDto } from '../../infrastructure/http/dtos/update-franchise.dto';

@Injectable()
export class FranchiseService {
  constructor(
    private readonly franchiseRepository: FranchiseRepository,
    private readonly gameRepository: GameRepository,
    @InjectRepository(FranchiseGame)
    private readonly franchiseGameRepository: Repository<FranchiseGame>,
  ) {}

  async create(createFranchiseDto: CreateFranchiseDto): Promise<Franchise> {
    const { games, ...franchiseData } = createFranchiseDto;
    const franchise = this.franchiseRepository.create(franchiseData);
    const newFranchise = await this.franchiseRepository.save(franchise);

    if (games && games.length > 0) {
      const franchiseGames = games.map(dto =>
        this.franchiseGameRepository.create({
          franchiseId: newFranchise.id,
          gameId: dto.gameId,
          orderInSeries: dto.orderInSeries,
        })
      );
      await this.franchiseGameRepository.save(franchiseGames);
    }

    return this.findOne(newFranchise.id);
  }

  async findOne(id: string): Promise<Franchise> {
    const franchise = await this.franchiseRepository.findOne({
        where: { id },
        relations: ['gamesInFranchise', 'gamesInFranchise.game'],
        order: {
            gamesInFranchise: {
                orderInSeries: 'ASC'
            }
        }
    });

    if (!franchise) {
      throw new NotFoundException(`Franchise with ID "${id}" not found`);
    }
    return franchise;
  }

  async update(id: string, updateFranchiseDto: UpdateFranchiseDto): Promise<Franchise> {
    const { gamesToUpdate, gamesToRemove, ...franchiseData } = updateFranchiseDto;
    const franchise = await this.findOne(id);

    // Update franchise metadata
    Object.assign(franchise, franchiseData);
    await this.franchiseRepository.save(franchise);

    // Remove games
    if (gamesToRemove && gamesToRemove.length > 0) {
      await this.franchiseGameRepository.delete({
        franchiseId: id,
        gameId: In(gamesToRemove),
      });
    }

    // Add/Update games
    if (gamesToUpdate && gamesToUpdate.length > 0) {
      for (const gameDto of gamesToUpdate) {
        let franchiseGame = await this.franchiseGameRepository.findOne({ where: { franchiseId: id, gameId: gameDto.gameId } });
        if (franchiseGame) {
          // Update order
          franchiseGame.orderInSeries = gameDto.orderInSeries;
        } else {
          // Create new entry
          franchiseGame = this.franchiseGameRepository.create({ ...gameDto, franchiseId: id });
        }
        await this.franchiseGameRepository.save(franchiseGame);
      }
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const franchise = await this.findOne(id);
    await this.franchiseRepository.remove(franchise);
  }
}
