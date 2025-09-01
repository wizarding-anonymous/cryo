import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Bundle } from '../../domain/entities/bundle.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class BundleService {
  constructor(
    @InjectRepository(Bundle)
    private readonly bundleRepository: Repository<Bundle>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async createBundle(bundleData: Partial<Bundle>, gameIds: string[]): Promise<Bundle> {
    const games = await this.gameRepository.findBy({ id: In(gameIds) });
    if (games.length !== gameIds.length) {
      throw new NotFoundException('One or more games not found');
    }

    const bundle = this.bundleRepository.create({
      ...bundleData,
      games,
    });

    return this.bundleRepository.save(bundle);
  }

  async findBundleById(id: string): Promise<Bundle | null> {
    return this.bundleRepository.findOne({ where: { id }, relations: ['games'] });
  }
}
