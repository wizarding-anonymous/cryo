import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dlc } from '../../domain/entities/dlc.entity';
import { Game } from '../../domain/entities/game.entity';

@Injectable()
export class DlcService {
  constructor(
    @InjectRepository(Dlc)
    private readonly dlcRepository: Repository<Dlc>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
  ) {}

  async createDlc(baseGameId: string, dlcData: Partial<Dlc>): Promise<Dlc> {
    const baseGame = await this.gameRepository.findOneBy({ id: baseGameId });
    if (!baseGame) {
      throw new NotFoundException(`Base game with ID "${baseGameId}" not found`);
    }

    const dlc = this.dlcRepository.create({
      ...dlcData,
      baseGameId,
    });

    return this.dlcRepository.save(dlc);
  }

  async findDlcsForGame(baseGameId: string): Promise<Dlc[]> {
    return this.dlcRepository.find({ where: { baseGameId } });
  }
}
