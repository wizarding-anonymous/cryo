import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Preorder } from '../../domain/entities/preorder.entity';
import { PreorderTier } from '../../domain/entities/preorder-tier.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class PreorderService {
  constructor(
    @InjectRepository(Preorder)
    private readonly preorderRepository: Repository<Preorder>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async createPreorder(gameId: string, preorderData: Partial<Preorder>): Promise<Preorder> {
    const game = await this.gameRepository.findOneBy({ id: gameId });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    const preorder = this.preorderRepository.create({
      ...preorderData,
      gameId,
    });

    return this.preorderRepository.save(preorder);
  }

  async addTierToPreorder(preorderId: string, tierData: Partial<PreorderTier>): Promise<PreorderTier> {
    const preorder = await this.preorderRepository.findOneBy({ id: preorderId });
    if (!preorder) {
        throw new NotFoundException(`Preorder with ID "${preorderId}" not found`);
    }

    const tier = new PreorderTier();
    Object.assign(tier, tierData);
    tier.preorderId = preorderId;

    // In a real app, you would save the tier, which is not directly possible this way
    // This is a simplified representation.
    preorder.tiers = [...(preorder.tiers || []), tier];
    await this.preorderRepository.save(preorder);
    return tier;
  }

  async getPreorderForGame(gameId: string): Promise<Preorder | null> {
    return this.preorderRepository.findOne({ where: { gameId }, relations: ['tiers'] });
  }
}
