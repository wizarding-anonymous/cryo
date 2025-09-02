import { Injectable, NotFoundException } from '@nestjs/common';
import { DlcRepository } from '../../infrastructure/persistence/dlc.repository';
import { GameRepository } from '../../infrastructure/persistence/game.repository';
import { Dlc } from '../../domain/entities/dlc.entity';
import { CreateDlcDto } from '../../infrastructure/http/dtos/create-dlc.dto';
import { UpdateDlcDto } from '../../infrastructure/http/dtos/update-dlc.dto';

@Injectable()
export class DlcService {
  constructor(
    private readonly dlcRepository: DlcRepository,
    private readonly gameRepository: GameRepository,
  ) {}

  async create(createDlcDto: CreateDlcDto): Promise<Dlc> {
    const baseGame = await this.gameRepository.findById(createDlcDto.baseGameId);
    if (!baseGame) {
      throw new NotFoundException(`Base game with ID "${createDlcDto.baseGameId}" not found`);
    }

    const dlc = new Dlc();
    Object.assign(dlc, createDlcDto);
    dlc.baseGame = baseGame;

    return this.dlcRepository.create(dlc);
  }

  async findByGame(gameId: string): Promise<Dlc[]> {
    return this.dlcRepository.findByGameId(gameId);
  }

  async findOne(id: string): Promise<Dlc> {
    const dlc = await this.dlcRepository.findById(id);
    if (!dlc) {
      throw new NotFoundException(`DLC with ID "${id}" not found`);
    }
    return dlc;
  }

  async update(id: string, updateDlcDto: UpdateDlcDto): Promise<Dlc> {
    const dlc = await this.findOne(id);
    Object.assign(dlc, updateDlcDto);
    return this.dlcRepository.save(dlc);
  }

  async remove(id: string): Promise<void> {
    const dlc = await this.findOne(id);
    await this.dlcRepository.remove(dlc);
  }
}
