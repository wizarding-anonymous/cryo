import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Tag } from '../../domain/entities/tag.entity';
import { PaginationDto } from '../http/dtos/pagination.dto';

@Injectable()
export class TagRepository {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async findAll(paginationDto: PaginationDto): Promise<{ data: Tag[], total: number }> {
    const { page = 1, limit = 10 } = paginationDto;
    const [data, total] = await this.tagRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total };
  }

  async findById(id: string): Promise<Tag | null> {
    return this.tagRepository.findOneBy({ id });
  }

  async findByIds(ids: string[]): Promise<Tag[]> {
    return this.tagRepository.findBy({ id: In(ids) });
  }

  async create(tag: Partial<Tag>): Promise<Tag> {
    const newTag = this.tagRepository.create(tag);
    return this.tagRepository.save(newTag);
  }

  async save(tag: Tag): Promise<Tag> {
    return this.tagRepository.save(tag);
  }

  async remove(tag: Tag): Promise<void> {
    await this.tagRepository.remove(tag);
  }
}
