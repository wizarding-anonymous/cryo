import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Preorder } from '../../domain/entities/preorder.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { CreatePreorderDto } from '../../infrastructure/http/dtos/create-preorder.dto';
import { UpdatePreorderDto } from '../../infrastructure/http/dtos/update-preorder.dto';
import { PreorderTier } from 'src/domain/entities/preorder-tier.entity';

@Injectable()
export class PreorderService {
  constructor(
    @InjectRepository(Preorder)
    private readonly preorderRepository: Repository<Preorder>,
    @InjectRepository(PreorderTier)
    private readonly tierRepository: Repository<PreorderTier>,
    private readonly gameRepository: GameRepository,
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
    const preorder = await this.findOne(id);
    // This is a simplified update. A real app would need more complex logic
    // to handle updating/adding/removing tiers.
    Object.assign(preorder, updatePreorderDto);
    return this.preorderRepository.save(preorder);
  }

  async remove(id: string): Promise<void> {
    const preorder = await this.findOne(id);
    await this.preorderRepository.remove(preorder);
  }
}
