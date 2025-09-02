import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Demo } from '../../domain/entities/demo.entity';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { CreateDemoDto } from '../../infrastructure/http/dtos/create-demo.dto';
import { UpdateDemoDto } from '../../infrastructure/http/dtos/update-demo.dto';

@Injectable()
export class DemoService {
  constructor(
    @InjectRepository(Demo)
    private readonly demoRepository: Repository<Demo>,
    private readonly gameRepository: GameRepository,
  ) {}

  async create(createDemoDto: CreateDemoDto): Promise<Demo> {
    const game = await this.gameRepository.findById(createDemoDto.gameId);
    if (!game) {
      throw new NotFoundException(`Game with ID "${createDemoDto.gameId}" not found.`);
    }

    const demo = this.demoRepository.create({
      ...createDemoDto,
      game,
    });

    return this.demoRepository.save(demo);
  }

  async findOne(id: string): Promise<Demo> {
    const demo = await this.demoRepository.findOne({ where: { id }, relations: ['game'] });
    if (!demo) {
      throw new NotFoundException(`Demo with ID "${id}" not found.`);
    }
    return demo;
  }

  async findByGame(gameId: string): Promise<Demo | null> {
    return this.demoRepository.findOne({ where: { gameId } });
  }

  async update(id: string, updateDemoDto: UpdateDemoDto): Promise<Demo> {
    const demo = await this.findOne(id);
    Object.assign(demo, updateDemoDto);
    return this.demoRepository.save(demo);
  }

  async remove(id: string): Promise<void> {
    const demo = await this.findOne(id);
    await this.demoRepository.remove(demo);
  }
}
