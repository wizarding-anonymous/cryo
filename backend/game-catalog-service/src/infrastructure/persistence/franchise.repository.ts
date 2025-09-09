import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Franchise } from '../../domain/entities/franchise.entity';

@Injectable()
export class FranchiseRepository {
  constructor(
    @InjectRepository(Franchise)
    private readonly franchiseRepository: Repository<Franchise>,
  ) {}

  async findById(id: string): Promise<Franchise | null> {
    return this.franchiseRepository.findOne({ where: { id }, relations: ['games'] });
  }

  async create(franchise: Partial<Franchise>): Promise<Franchise> {
    const newFranchise = this.franchiseRepository.create(franchise);
    return this.franchiseRepository.save(newFranchise);
  }

  async save(franchise: Franchise): Promise<Franchise> {
    return this.franchiseRepository.save(franchise);
  }

  async remove(franchise: Franchise): Promise<void> {
    await this.franchiseRepository.remove(franchise);
  }
}
