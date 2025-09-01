import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Preorder } from '../../domain/entities/preorder.entity';

@Injectable()
export class PreorderFulfillmentTask {
  private readonly logger = new Logger(PreorderFulfillmentTask.name);

  constructor(
    @InjectRepository(Preorder)
    private readonly preorderRepository: Repository<Preorder>,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Checking for pre-orders to fulfill...');

    const preordersToFulfill = await this.preorderRepository.find({
      where: {
        releaseDate: LessThanOrEqual(new Date()),
        isAvailable: true,
      },
      relations: ['game'],
    });

    if (preordersToFulfill.length === 0) {
      this.logger.log('No pre-orders to fulfill at this time.');
      return;
    }

    for (const preorder of preordersToFulfill) {
      this.logger.log(`Fulfilling pre-order for game: ${preorder.game.title} (ID: ${preorder.gameId})`);

      // In a real application, this is where you would:
      // 1. Find all users who purchased this pre-order.
      // 2. Emit an event to the Library Service for each user to add the game and bonuses to their library.
      // 3. Emit an event to the Payment Service to finalize the charge if it was only an authorization.
      // For now, we will just log it and mark the pre-order as fulfilled.

      preorder.isAvailable = false;
      await this.preorderRepository.save(preorder);

      this.logger.log(`Pre-order for game ${preorder.game.title} has been fulfilled and is no longer available.`);
    }
  }
}
