import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameLifecycleStatusEntity, GameLifecycleStatus } from '../../domain/entities/game-lifecycle-status.entity';
import { GameRoadmap, RoadmapStatus } from '../../domain/entities/game-roadmap.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class GameLifecycleService {
  constructor(
    @InjectRepository(GameLifecycleStatusEntity)
    private readonly lifecycleStatusRepository: Repository<GameLifecycleStatusEntity>,
    @InjectRepository(GameRoadmap)
    private readonly roadmapRepository: Repository<GameRoadmap>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  private readonly validTransitions: Record<GameLifecycleStatus, GameLifecycleStatus[]> = {
    [GameLifecycleStatus.DRAFT]: [GameLifecycleStatus.IN_DEVELOPMENT],
    [GameLifecycleStatus.IN_DEVELOPMENT]: [GameLifecycleStatus.ALPHA, GameLifecycleStatus.COMING_SOON],
    [GameLifecycleStatus.ALPHA]: [GameLifecycleStatus.BETA, GameLifecycleStatus.EARLY_ACCESS],
    [GameLifecycleStatus.BETA]: [GameLifecycleStatus.EARLY_ACCESS, GameLifecycleStatus.COMING_SOON],
    [GameLifecycleStatus.EARLY_ACCESS]: [GameLifecycleStatus.RELEASED],
    [GameLifecycleStatus.COMING_SOON]: [GameLifecycleStatus.RELEASED],
    [GameLifecycleStatus.RELEASED]: [GameLifecycleStatus.DISCONTINUED],
    [GameLifecycleStatus.DISCONTINUED]: [],
  };

  async updateLifecycleStatus(
    gameId: string,
    newStatus: GameLifecycleStatus,
    updatedBy: string,
  ): Promise<GameLifecycleStatusEntity> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    let statusEntity = await this.lifecycleStatusRepository.findOne({ where: { gameId } });
    
    if (statusEntity) {
      if (!this.validateStatusTransition(statusEntity.status, newStatus)) {
        throw new BadRequestException(
          `Invalid status transition from ${statusEntity.status} to ${newStatus}`
        );
      }
      statusEntity.status = newStatus;
      statusEntity.updatedAt = new Date();
      statusEntity.updatedBy = updatedBy;
    } else {
      statusEntity = this.lifecycleStatusRepository.create({
        gameId,
        status: newStatus,
        updatedBy,
      });
    }

    return this.lifecycleStatusRepository.save(statusEntity);
  }

  validateStatusTransition(currentStatus: GameLifecycleStatus, newStatus: GameLifecycleStatus): boolean {
    return this.validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  async getGamesByStatus(status: GameLifecycleStatus): Promise<Game[]> {
    const statusEntities = await this.lifecycleStatusRepository.find({
      where: { status },
      relations: ['game'],
    });
    return statusEntities.map(entity => entity.game);
  }

  async createRoadmapMilestone(
    gameId: string,
    milestoneName: string,
    description?: string,
    targetDate?: Date,
  ): Promise<GameRoadmap> {
    const game = await this.gameRepository.findOne({ where: { id: gameId } });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    const milestone = this.roadmapRepository.create({
      gameId,
      milestoneName,
      description,
      targetDate,
      status: RoadmapStatus.PLANNED,
    });

    return this.roadmapRepository.save(milestone);
  }

  async updateRoadmapMilestone(
    milestoneId: string,
    updates: Partial<GameRoadmap>,
  ): Promise<GameRoadmap> {
    const milestone = await this.roadmapRepository.findOne({ where: { id: milestoneId } });
    if (!milestone) {
      throw new NotFoundException(`Milestone with ID "${milestoneId}" not found`);
    }

    Object.assign(milestone, updates);
    milestone.updatedAt = new Date();

    return this.roadmapRepository.save(milestone);
  }

  async getGameRoadmap(gameId: string): Promise<GameRoadmap[]> {
    return this.roadmapRepository.find({
      where: { gameId },
      order: { targetDate: 'ASC', createdAt: 'ASC' },
    });
  }
}