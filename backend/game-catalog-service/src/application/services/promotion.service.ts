import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Not } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Discount } from '../../domain/entities/discount.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { CreatePromotionDto } from '../../infrastructure/http/dtos/create-promotion.dto';
import { UpdatePromotionDto } from '../../infrastructure/http/dtos/update-promotion.dto';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    private readonly gameRepository: GameRepository,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDiscountUpdates() {
    this.logger.log('Checking for discount updates...');
    const now = new Date();

    // Find discounts that should be active but aren't
    const toActivate = await this.discountRepository.find({
      where: {
        startDate: LessThan(now),
        endDate: MoreThan(now),
        isActive: false,
      },
    });

    // Find discounts that should be inactive but are
    const toDeactivate = await this.discountRepository.find({
      where: {
        endDate: LessThan(now),
        isActive: true,
      },
    });

    for (const discount of toActivate) {
      const game = await this.gameRepository.findById(discount.gameId);
      if (game) {
        game.price = game.price * (1 - discount.percentage / 100);
        await this.gameRepository.save(game);
        discount.isActive = true;
        await this.discountRepository.save(discount);
        this.logger.log(`Activated discount for game ${game.id}. New price: ${game.price}`);
      }
    }

    for (const discount of toDeactivate) {
        const game = await this.gameRepository.findById(discount.gameId);
        if (game) {
          // This assumes only one discount can be active at a time.
          // A more robust solution would re-calculate the price based on the base price.
          game.price = game.price / (1 - discount.percentage / 100);
          await this.gameRepository.save(game);
          discount.isActive = false;
          await this.discountRepository.save(discount);
          this.logger.log(`Deactivated discount for game ${game.id}. Price reverted.`);
        }
      }
  }

  async create(createPromotionDto: CreatePromotionDto): Promise<Discount> {
    const game = await this.gameRepository.findById(createPromotionDto.gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${createPromotionDto.gameId}" not found.`);
    }

    const discount = this.discountRepository.create({
      ...createPromotionDto,
      game,
    });

    return this.discountRepository.save(discount);
  }

  async findOne(id: string): Promise<Discount> {
    const discount = await this.discountRepository.findOne({ where: { id }, relations: ['game'] });
    if (!discount) {
      throw new NotFoundException(`Promotion (Discount) with ID "${id}" not found.`);
    }
    return discount;
  }

  async update(id: string, updatePromotionDto: UpdatePromotionDto): Promise<Discount> {
    const discount = await this.findOne(id);
    Object.assign(discount, updatePromotionDto);
    return this.discountRepository.save(discount);
  }

  async remove(id: string): Promise<void> {
    const discount = await this.findOne(id);
    await this.discountRepository.remove(discount);
  }
}
