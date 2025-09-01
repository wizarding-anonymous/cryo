import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Demo } from '../../domain/entities/demo.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class DemoService {
  constructor(
    @InjectRepository(Demo)
    private readonly demoRepository: Repository<Demo>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async createDemo(gameId: string, demoData: Partial<Demo>): Promise<Demo> {
    const game = await this.gameRepository.findOneBy({ id: gameId });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found`);
    }

    const demo = this.demoRepository.create({
      ...demoData,
      gameId,
    });

    return this.demoRepository.save(demo);
  }

  async getDemoForGame(gameId: string): Promise<Demo | null> {
    return this.demoRepository.findOne({ where: { gameId } });
  }
}
