import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameVersion } from '../../domain/entities/game-version.entity';

@Injectable()
export class GameVersionRepository {
  constructor(
    @InjectRepository(GameVersion)
    private readonly repository: Repository<GameVersion>,
  ) {}

  async create(data: Partial<GameVersion>): Promise<GameVersion> {
    const newVersion = this.repository.create(data);
    return this.repository.save(newVersion);
  }

  async findByGameId(gameId: string): Promise<GameVersion[]> {
    return this.repository.find({
      where: { gameId },
      order: { createdAt: 'DESC' },
    });
  }

  async unsetCurrent(gameId: string): Promise<void> {
    await this.repository.update({ gameId, isCurrent: true }, { isCurrent: false });
  }
}
