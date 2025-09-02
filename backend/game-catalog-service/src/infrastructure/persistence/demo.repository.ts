import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Demo } from '../../domain/entities/demo.entity';

@Injectable()
export class DemoRepository {
  constructor(
    @InjectRepository(Demo)
    private readonly demoRepository: Repository<Demo>,
  ) {}

  async findById(id: string): Promise<Demo | null> {
    return this.demoRepository.findOneBy({ id });
  }

  async create(demo: Partial<Demo>): Promise<Demo> {
    const newDemo = this.demoRepository.create(demo);
    return this.demoRepository.save(newDemo);
  }

  async save(demo: Demo): Promise<Demo> {
    return this.demoRepository.save(demo);
  }

  async remove(demo: Demo): Promise<void> {
    await this.demoRepository.remove(demo);
  }
}
