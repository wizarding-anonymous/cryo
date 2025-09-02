import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discount } from '../../domain/entities/discount.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { CreatePromotionDto } from '../../infrastructure/http/dtos/create-promotion.dto';
import { UpdatePromotionDto } from '../../infrastructure/http/dtos/update-promotion.dto';

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(Discount)
    private readonly discountRepository: Repository<Discount>,
    private readonly gameRepository: GameRepository,
  ) {}

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
