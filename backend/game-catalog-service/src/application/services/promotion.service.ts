import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from '../../domain/entities/discount.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async createDiscount(gameId: string, percentage: number, startDate: Date, endDate: Date): Promise<Discount> {
    const game = await this.gameRepository.findOneBy({ id: gameId });
    if (!game) {
      throw new Error('Game not found');
    }

    const discount = this.discountRepository.create({
      gameId,
      percentage,
      startDate,
      endDate,
      isActive: true,
    });

    // In a real app, we would update the game's price here or have a
    // dynamic price calculation that considers active discounts.
    return this.discountRepository.save(discount);
  }

  async getActiveDiscountsForGame(gameId: string): Promise<Discount[]> {
    return this.discountRepository.find({
      where: {
        gameId,
        isActive: true,
        endDate: new Date(), // Simplified logic: find discounts that have not ended
      },
    });
  }
}
