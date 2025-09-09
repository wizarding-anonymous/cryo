import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Preorder, PreorderStatus } from '../../domain/entities/preorder.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { CreatePreorderDto } from '../../infrastructure/http/dtos/create-preorder.dto';
import { UpdatePreorderDto } from '../../infrastructure/http/dtos/update-preorder.dto';
import { PreorderTier } from '../../domain/entities/preorder-tier.entity';
import { EventPublisherService } from './event-publisher.service';

@Injectable()
export class PreorderService {
  private readonly logger = new Logger(PreorderService.name);

  constructor(
    @InjectRepository(Preorder)
    private readonly preorderRepository: Repository<Preorder>,
    @InjectRepository(PreorderTier)
    private readonly tierRepository: Repository<PreorderTier>,
    private readonly gameRepository: GameRepository,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async create(createPreorderDto: CreatePreorderDto): Promise<Preorder> {
    const game = await this.gameRepository.findById(createPreorderDto.gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${createPreorderDto.gameId}" not found.`);
    }

    const { tiers, ...preorderData } = createPreorderDto;

    const preorder = this.preorderRepository.create({
      ...preorderData,
      game,
    });

    if (tiers && tiers.length > 0) {
        const tierEntities = tiers.map(tierDto => this.tierRepository.create(tierDto));
        preorder.tiers = tierEntities;
    }

    return this.preorderRepository.save(preorder);
  }

  async findOne(id: string): Promise<Preorder> {
    const preorder = await this.preorderRepository.findOne({ where: { id }, relations: ['game', 'tiers'] });
    if (!preorder) {
      throw new NotFoundException(`Preorder with ID "${id}" not found.`);
    }
    return preorder;
  }

  async findByGame(gameId: string): Promise<Preorder | null> {
    return this.preorderRepository.findOne({ where: { gameId }, relations: ['tiers'] });
  }

  async update(id: string, updatePreorderDto: UpdatePreorderDto): Promise<Preorder> {
    const { tiers, tiersToDelete, ...preorderData } = updatePreorderDto;
    const preorder = await this.findOne(id);

    // Update top-level preorder fields
    Object.assign(preorder, preorderData);

    // Process tiers to delete
    if (tiersToDelete && tiersToDelete.length > 0) {
      await this.tierRepository.delete(tiersToDelete);
    }

    // Process tiers to update or create
    if (tiers) {
      const updatedTiers = await Promise.all(
        tiers.map(async (tierDto) => {
          if (tierDto.id) {
            // Update existing tier
            const existingTier = preorder.tiers.find(t => t.id === tierDto.id);
            if (existingTier) {
              return this.tierRepository.save({ ...existingTier, ...tierDto });
            }
          }
          // Create new tier
          return this.tierRepository.create({ ...tierDto, preorder });
        }),
      );
      preorder.tiers = updatedTiers;
    }

    return this.preorderRepository.save(preorder);
  }

  async remove(id: string): Promise<void> {
    const preorder = await this.findOne(id);
    await this.preorderRepository.remove(preorder);
  }

  async cancel(id: string): Promise<Preorder> {
    const preorder = await this.findOne(id);
    const now = new Date();

    if (now >= preorder.releaseDate) {
      throw new Error('Cannot cancel a preorder on or after its release date.');
    }

    if (preorder.status !== PreorderStatus.ACTIVE) {
      throw new Error(`Cannot cancel a preorder with status: ${preorder.status}`);
    }

    preorder.status = PreorderStatus.CANCELLED;
    const updatedPreorder = await this.preorderRepository.save(preorder);

    // In a real application, you would also fetch the user ID associated with this preorder
    // and include it in the event payload for the payment service.
    this.eventPublisher.publish({
      type: 'preorder.cancelled',
      payload: {
        preorderId: preorder.id,
        gameId: preorder.gameId,
        // userId: preorder.userId,
      },
    });

    return updatedPreorder;
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleFulfilledPreorders() {
    this.logger.log('Checking for pre-orders to fulfill...');
    const now = new Date();
    const fulfillablePreorders = await this.preorderRepository.find({
      where: {
        releaseDate: LessThan(now),
        status: PreorderStatus.ACTIVE,
      },
    });

    if (fulfillablePreorders.length === 0) {
      this.logger.log('No pre-orders to fulfill at this time.');
      return;
    }

    for (const preorder of fulfillablePreorders) {
      preorder.status = PreorderStatus.FULFILLED;
      await this.preorderRepository.save(preorder);
      // In a real application, you would also fetch the user ID associated with this preorder
      // and include it in the event payload.
      this.eventPublisher.publish({
        type: 'preorder.fulfilled',
        payload: {
          preorderId: preorder.id,
          gameId: preorder.gameId,
          // userId: preorder.userId,
        },
      });
      this.logger.log(`Fulfilled preorder ${preorder.id} for game ${preorder.gameId}`);
    }
  }
}
