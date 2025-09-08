import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GameVersionRepository } from '../../infrastructure/persistence/game-version.repository';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { EventPublisherService } from './event-publisher.service';
import { GameVersion } from '../../domain/entities/game-version.entity';
import { CreateVersionDto } from '../../infrastructure/http/dtos/create-version.dto';
import { DataSource } from 'typeorm';

@Injectable()
export class VersionService {
  constructor(
    private readonly versionRepository: GameVersionRepository,
    private readonly gameRepository: GameRepository,
    private readonly eventPublisher: EventPublisherService,
    private readonly dataSource: DataSource,
  ) {}

  async createVersion(
    gameId: string,
    developerId: string,
    createVersionDto: CreateVersionDto,
  ): Promise<GameVersion> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const game = await this.gameRepository.findById(gameId);
      if (!game) {
        throw new NotFoundException(`Game with ID "${gameId}" not found`);
      }
      if (game.developerId !== developerId) {
        throw new ForbiddenException('You do not own this game.');
      }

      // In a transaction, first set all other versions to not be current
      await this.versionRepository.unsetCurrent(gameId);

      const newVersion = await this.versionRepository.create({
        gameId,
        ...createVersionDto,
        isCurrent: true,
      });

      game.version = newVersion.version;
      await this.gameRepository.save(game);

      this.eventPublisher.publish({
        type: 'game.updated',
        payload: { gameId, version: newVersion.version, changelog: newVersion.changelog },
      });

      await queryRunner.commitTransaction();
      return newVersion;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getVersionHistory(gameId: string): Promise<GameVersion[]> {
    return this.versionRepository.findByGameId(gameId);
  }
}
