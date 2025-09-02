import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bundle } from '../../domain/entities/bundle.entity';

@Injectable()
export class BundleRepository {
  constructor(
    @InjectRepository(Bundle)
    private readonly bundleRepository: Repository<Bundle>,
  ) {}

  async findById(id: string): Promise<Bundle | null> {
    return this.bundleRepository.findOne({ where: { id }, relations: ['games'] });
  }

  async create(bundle: Partial<Bundle>): Promise<Bundle> {
    const newBundle = this.bundleRepository.create(bundle);
    return this.bundleRepository.save(newBundle);
  }

  async save(bundle: Bundle): Promise<Bundle> {
    return this.bundleRepository.save(bundle);
  }

  async remove(bundle: Bundle): Promise<void> {
    await this.bundleRepository.remove(bundle);
  }
}
