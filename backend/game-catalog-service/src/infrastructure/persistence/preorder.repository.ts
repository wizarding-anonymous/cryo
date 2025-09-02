import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Preorder } from '../../domain/entities/preorder.entity';

@Injectable()
export class PreorderRepository {
  constructor(
    @InjectRepository(Preorder)
    private readonly preorderRepository: Repository<Preorder>,
  ) {}

  async findById(id: string): Promise<Preorder | null> {
    return this.preorderRepository.findOne({ where: { id }, relations: ['tiers'] });
  }

  async create(preorder: Partial<Preorder>): Promise<Preorder> {
    const newPreorder = this.preorderRepository.create(preorder);
    return this.preorderRepository.save(newPreorder);
  }

  async save(preorder: Preorder): Promise<Preorder> {
    return this.preorderRepository.save(preorder);
  }

  async remove(preorder: Preorder): Promise<void> {
    await this.preorderRepository.remove(preorder);
  }
}
