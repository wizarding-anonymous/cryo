import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dlc } from '../../domain/entities/dlc.entity';

@Injectable()
export class DlcRepository {
  constructor(
    @InjectRepository(Dlc)
    private readonly dlcRepository: Repository<Dlc>,
  ) {}

  async findById(id: string): Promise<Dlc | null> {
    return this.dlcRepository.findOne({ where: { id }, relations: ['baseGame'] });
  }

  async findByGameId(gameId: string): Promise<Dlc[]> {
    return this.dlcRepository.find({ where: { baseGame: { id: gameId } } });
  }

  async create(dlc: Partial<Dlc>): Promise<Dlc> {
    const newDlc = this.dlcRepository.create(dlc);
    return this.dlcRepository.save(newDlc);
  }

  async save(dlc: Dlc): Promise<Dlc> {
    return this.dlcRepository.save(dlc);
  }

  async remove(dlc: Dlc): Promise<void> {
    await this.dlcRepository.remove(dlc);
  }
}
