import { Injectable, NotFoundException } from '@nestjs/common';
import { BundleRepository } from '../../infrastructure/persistence/bundle.repository';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Bundle } from '../../domain/entities/bundle.entity';
import { CreateBundleDto } from '../../infrastructure/http/dtos/create-bundle.dto';
import { UpdateBundleDto } from '../../infrastructure/http/dtos/update-bundle.dto';

@Injectable()
export class BundleService {
  constructor(
    private readonly bundleRepository: BundleRepository,
    private readonly gameRepository: GameRepository,
  ) {}

  async create(createBundleDto: CreateBundleDto): Promise<Bundle> {
    const { gameIds, ...bundleData } = createBundleDto;
    const bundle = new Bundle();
    Object.assign(bundle, bundleData);

    if (gameIds && gameIds.length > 0) {
      const games = await this.gameRepository.findByIds(gameIds);
      if (games.length !== gameIds.length) {
        throw new NotFoundException('One or more games not found in the bundle.');
      }
      bundle.games = games;
    }

    return this.bundleRepository.create(bundle);
  }

  async findOne(id: string): Promise<Bundle> {
    const bundle = await this.bundleRepository.findById(id);
    if (!bundle) {
      throw new NotFoundException(`Bundle with ID "${id}" not found`);
    }
    return bundle;
  }

  async update(id: string, updateBundleDto: UpdateBundleDto): Promise<Bundle> {
    const { gameIds, ...bundleData } = updateBundleDto;
    const bundle = await this.findOne(id);
    Object.assign(bundle, bundleData);

    if (gameIds) {
      const games = await this.gameRepository.findByIds(gameIds);
      if (games.length !== gameIds.length) {
        throw new NotFoundException('One or more games not found in the bundle.');
      }
      bundle.games = games;
    }

    return this.bundleRepository.save(bundle);
  }

  async remove(id: string): Promise<void> {
    const bundle = await this.findOne(id);
    await this.bundleRepository.remove(bundle);
  }
}
